"use client";

import { useMemo, useState, useTransition } from "react";
import { motion, cubicBezier } from "framer-motion";
import { toast } from "sonner";
import { approveMany, denyMany } from "./actions";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Row = {
  id: string;
  email: string | null;
  createdAt: Date;
};

const ease = cubicBezier(0.16, 1, 0.3, 1);

export function ApprovalsTable({ initial }: { initial: Row[] }) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Row | null>(null);
  const [singleNote, setSingleNote] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return initial;
    return initial.filter((r) => (r.email ?? "").toLowerCase().includes(query));
  }, [q, initial]);

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected]
  );

  const allVisibleSelected = filtered.length > 0 && filtered.every((r) => selected[r.id]);
  const someVisibleSelected = filtered.some((r) => selected[r.id]);

  function toggleAllVisible(checked: boolean) {
    const next = { ...selected };
    for (const r of filtered) next[r.id] = checked;
    setSelected(next);
  }

  function resetBatch() {
    setSelected({});
    setNote("");
  }

  function openDrawer(row: Row) {
    setActive(row);
    setSingleNote("");
    setOpen(true);
  }

  async function approve(ids: string[], noteValue?: string) {
    startTransition(async () => {
      await approveMany(ids, noteValue ?? "");
      toast.success("Approved", {
        description: ids.length === 1 ? "Interpreter approved." : `${ids.length} interpreter(s) approved.`,
      });
      setOpen(false);
      setActive(null);
      resetBatch();
    });
  }

  async function deny(ids: string[], noteValue?: string) {
    startTransition(async () => {
      await denyMany(ids, noteValue ?? "");
      toast("Denied", {
        description: ids.length === 1 ? "Interpreter denied." : `${ids.length} interpreter(s) denied.`,
      });
      setOpen(false);
      setActive(null);
      resetBatch();
    });
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-3">
            <div className="min-w-[240px] flex-1">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by email…"
                className="h-11 rounded-2xl bg-white dark:bg-zinc-900"
              />
            </div>

            <Badge variant="secondary" className="rounded-full">
              {filtered.length} shown
            </Badge>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note (batch)…"
              className="h-11 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-zinc-800 dark:bg-zinc-950 sm:w-[320px]"
            />

            <div className="flex items-center gap-2">
              <ConfirmBatch
                disabled={isPending || selectedIds.length === 0}
                label={`Approve (${selectedIds.length})`}
                tone="approve"
                onConfirm={() => approve(selectedIds, note)}
              />

              <ConfirmBatch
                disabled={isPending || selectedIds.length === 0}
                label={`Deny (${selectedIds.length})`}
                tone="deny"
                onConfirm={() => deny(selectedIds, note)}
              />
            </div>
          </div>
        </div>

        {selectedIds.length > 0 ? (
          <>
            <Separator className="my-4 opacity-60" />
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Batch actions are server-authorized. Notes are optional and capped.
            </div>
          </>
        ) : null}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="space-y-0.5">
            <div className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-white">
              Pending requests
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Click a row to review. Hover for quick actions.
            </div>
          </div>

          {isPending ? (
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Applying changes…</div>
          ) : null}
        </div>

        <Separator className="opacity-60" />

        <div className="max-h-[560px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-white/90 backdrop-blur dark:bg-zinc-900/90">
              <tr className="text-left text-xs text-zinc-500 dark:text-zinc-400">
                <th className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                      onCheckedChange={(v) => toggleAllVisible(Boolean(v))}
                    />
                    <span>Select</span>
                  </div>
                </th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-14">
                    <EmptyApprovals />
                  </td>
                </tr>
              ) : (
                filtered.map((r, idx) => (
                  <motion.tr
                    key={r.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease, delay: Math.min(idx * 0.01, 0.12) }}
                    className="group border-t border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/30"
                    onClick={() => openDrawer(r)}
                    role="button"
                    tabIndex={0}
                  >
                    <td
                      className="px-4 py-4"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={Boolean(selected[r.id])}
                        onCheckedChange={(v) => setSelected((s) => ({ ...s, [r.id]: Boolean(v) }))}
                      />
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="font-medium tracking-tight text-zinc-950 dark:text-white">
                            {r.email ?? "No email"}
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            Interpreter access request
                          </div>
                        </div>

                        {/* Quick actions appear on hover */}
                        <div
                          className="hidden items-center gap-2 opacity-0 transition-opacity group-hover:flex group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            size="sm"
                            className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-600/90"
                            disabled={isPending}
                            onClick={() => approve([r.id], "")}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            className="h-9 rounded-xl bg-rose-600 hover:bg-rose-600/90"
                            disabled={isPending}
                            onClick={() => deny([r.id], "")}
                          >
                            Deny
                          </Button>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-zinc-600 dark:text-zinc-300">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>

                    <td className="px-4 py-4 text-right">
                      <Badge variant="secondary" className="rounded-full">
                        Pending
                      </Badge>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Drawer (Dialog) */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="tracking-tight">Review request</DialogTitle>
            <DialogDescription>
              Approve to unlock the interpreter job feed. Deny to block access.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">User</div>
              <div className="mt-1 font-medium text-zinc-950 dark:text-white">
                {active?.email ?? "No email"}
              </div>
              <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Requested:{" "}
                <span className="text-zinc-700 dark:text-zinc-300">
                  {active?.createdAt ? new Date(active.createdAt).toLocaleString() : "-"}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Optional note
              </div>
              <input
                value={singleNote}
                onChange={(e) => setSingleNote(e.target.value)}
                placeholder="Short note (optional)…"
                className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-zinc-800 dark:bg-zinc-900"
              />
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Notes help future audit and internal clarity.
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                className="h-11 rounded-2xl"
                onClick={() => setOpen(false)}
              >
                Close
              </Button>
              <Button
                className="h-11 rounded-2xl bg-rose-600 hover:bg-rose-600/90"
                disabled={isPending || !active?.id}
                onClick={() => active?.id && deny([active.id], singleNote)}
              >
                Deny
              </Button>
              <Button
                className="h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-600/90"
                disabled={isPending || !active?.id}
                onClick={() => active?.id && approve([active.id], singleNote)}
              >
                Approve
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyApprovals() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
      <div className="h-12 w-12 rounded-3xl bg-zinc-100 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700" />
      <div className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-white">
        Nothing to review
      </div>
      <div className="text-xs text-zinc-500 dark:text-zinc-400">
        New interpreter signups will appear here for approval.
      </div>
    </div>
  );
}

function ConfirmBatch({
  label,
  tone,
  disabled,
  onConfirm,
}: {
  label: string;
  tone: "approve" | "deny";
  disabled?: boolean;
  onConfirm: () => void;
}) {
  const title = tone === "approve" ? "Approve selected users?" : "Deny selected users?";
  const desc =
    tone === "approve"
      ? "They will immediately gain access to the interpreter job feed."
      : "They will be blocked and see the denied screen.";

  const actionClass =
    tone === "approve"
      ? "bg-emerald-600 hover:bg-emerald-600/90"
      : "bg-rose-600 hover:bg-rose-600/90";

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={disabled} className={`h-11 rounded-2xl ${actionClass}`}>
          {label}
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent className="rounded-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="tracking-tight">{title}</AlertDialogTitle>
          <AlertDialogDescription>{desc}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-2xl">Cancel</AlertDialogCancel>
          <AlertDialogAction className={`rounded-2xl ${actionClass}`} onClick={onConfirm}>
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
