// app/admin/interpreters/table.tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { motion, cubicBezier } from "framer-motion";
import Link from "next/link";
import { toast } from "sonner";
import { formatDateISO, formatDateTimeISO } from "@/lib/datetime";

import {
  approveInterpreterById,
  denyInterpreterById,
  setInterpreterActive,
  bulkSetInterpreterActive,
} from "./actions";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ─── types ────────────────────────────────────────────────────────────────────

type InterpreterProfile = {
  displayName: string | null;
  phone: string | null;
  location: string | null;
  bio: string | null;
  languages: string[];
  certifications: string[];
  experienceYears: number | null;
  preferredModes: string[];
  // availabilityNote removed — field no longer exists in schema
  updatedAt: Date;
};

type Row = {
  id: string;
  email: string | null;
  status: "PENDING" | "APPROVED" | "DENIED";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  interpreterProfile: InterpreterProfile | null;
};

// ─── helpers ─────────────────────────────────────────────────────────────────

const ease = cubicBezier(0.16, 1, 0.3, 1);

function completeness(p: InterpreterProfile | null) {
  if (!p) return { score: 0, label: "No profile" };

  const fields = [
    p.displayName,
    p.phone,
    p.location,
    p.bio,
    (p.languages?.length ?? 0) > 0 ? "x" : null,
    (p.certifications?.length ?? 0) > 0 ? "x" : null,
    p.experienceYears !== null ? "x" : null,
    (p.preferredModes?.length ?? 0) > 0 ? "x" : null,
  ];
  const filled = fields.filter(Boolean).length;
  const pct = Math.round((filled / fields.length) * 100);
  const label =
    pct >= 85 ? "Strong" : pct >= 60 ? "Good" : pct >= 35 ? "Basic" : "Incomplete";

  return { score: pct, label };
}

function StatusBadge({ status }: { status: Row["status"] }) {
  const cls =
    status === "APPROVED"
      ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/25 dark:text-emerald-300"
      : status === "PENDING"
      ? "bg-amber-500/15 text-amber-800 border-amber-500/25 dark:text-amber-300"
      : "bg-rose-500/15 text-rose-800 border-rose-500/25 dark:text-rose-300";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${cls}`}>
      {status === "APPROVED" ? "Approved" : status === "PENDING" ? "Pending" : "Denied"}
    </span>
  );
}

function ActiveBadge({ isActive }: { isActive: boolean }) {
  const cls = isActive
    ? "bg-sky-500/15 text-sky-800 border-sky-500/25 dark:text-sky-300"
    : "bg-zinc-500/15 text-zinc-800 border-zinc-500/25 dark:text-zinc-300";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${cls}`}>
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function InterpretersTable({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"ALL" | "PENDING" | "APPROVED" | "DENIED">("ALL");

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  );

  const [open, setOpen] = useState(false);
  const [activeRow, setActiveRow] = useState<Row | null>(null);
  const [note, setNote] = useState("");

  const [confirmSingleOpen, setConfirmSingleOpen] = useState(false);
  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);
  const [pendingRow, setPendingRow] = useState<Row | null>(null);
  const [pendingNextActive, setPendingNextActive] = useState(false);
  const [bulkNextActive, setBulkNextActive] = useState(true);

  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab !== "ALL" && r.status !== tab) return false;
      if (!query) return true;
      return (
        (r.email ?? "").toLowerCase().includes(query) ||
        (r.interpreterProfile?.displayName ?? "").toLowerCase().includes(query) ||
        (r.interpreterProfile?.location ?? "").toLowerCase().includes(query)
      );
    });
  }, [q, tab, rows]);

  const shownIds = useMemo(() => filtered.map((r) => r.id), [filtered]);

  const allShownSelected = useMemo(
    () => shownIds.length > 0 && shownIds.every((id) => selected[id]),
    [shownIds, selected]
  );

  const anyShownSelected = useMemo(
    () => shownIds.some((id) => selected[id]),
    [shownIds, selected]
  );

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function openReview(row: Row) {
    setActiveRow(row);
    setNote("");
    setOpen(true);
  }

  function doApprove(id: string, noteValue?: string) {
    startTransition(async () => {
      try {
        await approveInterpreterById(id, noteValue ?? "");
        updateRow(id, { status: "APPROVED" });
        toast.success("Approved", { description: "Interpreter now has job feed access (if active)." });
        setOpen(false);
      } catch {
        toast.error("Could not approve");
      }
    });
  }

  function doDeny(id: string, noteValue?: string) {
    startTransition(async () => {
      try {
        await denyInterpreterById(id, noteValue ?? "");
        updateRow(id, { status: "DENIED" });
        toast("Denied", { description: "Interpreter access blocked." });
        setOpen(false);
      } catch {
        toast.error("Could not deny");
      }
    });
  }

  function openSingleToggleConfirm(row: Row, nextActive: boolean) {
    setPendingRow(row);
    setPendingNextActive(nextActive);
    setConfirmSingleOpen(true);
  }

  function openBulkToggleConfirm(nextActive: boolean) {
    setBulkNextActive(nextActive);
    setConfirmBulkOpen(true);
  }

  function doSingleToggle() {
    if (!pendingRow) return;
    startTransition(async () => {
      try {
        const res = await setInterpreterActive({
          userProfileId: pendingRow.id,
          isActive: pendingNextActive,
          note,
        });
        if (res?.ok) {
          updateRow(pendingRow.id, { isActive: res.isActive });
          toast.success(res.isActive ? "Activated" : "Deactivated");
          setConfirmSingleOpen(false);
          setPendingRow(null);
          setNote("");
        } else {
          toast.error("Could not update");
        }
      } catch {
        toast.error("Could not update");
      }
    });
  }

  function doBulkToggle() {
    if (selectedIds.length === 0) return;
    startTransition(async () => {
      try {
        const res = await bulkSetInterpreterActive({
          userProfileIds: selectedIds,
          isActive: bulkNextActive,
          note,
        });
        if (res?.ok) {
          setRows((prev) =>
            prev.map((r) => (selected[r.id] ? { ...r, isActive: bulkNextActive } : r))
          );
          toast.success(bulkNextActive ? "Activated" : "Deactivated", {
            description: `${res.updated} updated (${res.total} matched).`,
          });
          setConfirmBulkOpen(false);
          setNote("");
          setSelected({});
        } else {
          toast.error("Bulk update failed");
        }
      } catch {
        toast.error("Bulk update failed");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-3">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search email, name, location…"
              className="h-11 rounded-2xl bg-white dark:bg-zinc-900 max-w-sm"
            />
            <Badge variant="secondary" className="rounded-full">{filtered.length} shown</Badge>
            {anyShownSelected && (
              <Badge variant="secondary" className="rounded-full">{selectedIds.length} selected</Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {(["ALL", "PENDING", "APPROVED", "DENIED"] as const).map((t) => (
              <Chip key={t} active={tab === t} onClick={() => setTab(t)}>
                {t === "ALL" ? "All" : t.charAt(0) + t.slice(1).toLowerCase()}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-semibold text-zinc-950 dark:text-white">Bulk actions</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {selectedIds.length} selected
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional audit note…"
                className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-zinc-800 dark:bg-zinc-950 w-64"
              />
              <Button className="h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-600/90" disabled={isPending} onClick={() => openBulkToggleConfirm(true)}>Activate</Button>
              <Button className="h-11 rounded-2xl bg-rose-600 hover:bg-rose-600/90" disabled={isPending} onClick={() => openBulkToggleConfirm(false)}>Deactivate</Button>
              <Button variant="secondary" className="h-11 rounded-2xl" onClick={() => setSelected({})}>Clear</Button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-white">
              Interpreter directory
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Select rows for bulk actions. Click a row to review.
            </div>
          </div>
          {isPending && <span className="text-xs text-zinc-400">Saving…</span>}
        </div>

        <Separator className="opacity-60" />

        <div className="max-h-[620px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-white/90 backdrop-blur dark:bg-zinc-900/90">
              <tr className="text-left text-xs text-zinc-500 dark:text-zinc-400">
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allShownSelected}
                    onChange={(e) => {
                      const next: Record<string, boolean> = { ...selected };
                      for (const id of shownIds) {
                        if (e.target.checked) next[id] = true;
                        else delete next[id];
                      }
                      setSelected(next);
                    }}
                  />
                </th>
                <th className="px-4 py-3">Interpreter</th>
                <th className="px-4 py-3">Profile</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Access</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-14 text-center text-sm text-zinc-400">
                    No interpreters match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((r, idx) => {
                  const comp = completeness(r.interpreterProfile);
                  return (
                    <motion.tr
                      key={r.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, ease, delay: Math.min(idx * 0.01, 0.12) }}
                      className="group border-t border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/30 cursor-pointer"
                      onClick={() => openReview(r)}
                    >
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={Boolean(selected[r.id])}
                          onChange={(e) => setSelected((prev) => ({ ...prev, [r.id]: e.target.checked }))}
                        />
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-medium text-zinc-950 dark:text-white">
                          {r.interpreterProfile?.displayName ?? r.email ?? "Unknown"}
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {r.email ?? "No email"} · {r.interpreterProfile?.location ?? "No location"}
                        </div>
                        <div className="mt-2 hidden items-center gap-2 opacity-0 transition-opacity group-hover:flex group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" className={`h-8 rounded-xl text-xs ${!r.isActive ? "bg-emerald-600 hover:bg-emerald-600/90" : "bg-rose-600 hover:bg-rose-600/90"}`} disabled={isPending} onClick={() => openSingleToggleConfirm(r, !r.isActive)}>
                            {r.isActive ? "Deactivate" : "Activate"}
                          </Button>
                          {r.status === "PENDING" ? (
                            <>
                              <Button size="sm" className="h-8 rounded-xl text-xs bg-emerald-600 hover:bg-emerald-600/90" disabled={isPending} onClick={() => doApprove(r.id)}>Approve</Button>
                              <Button size="sm" className="h-8 rounded-xl text-xs bg-rose-600 hover:bg-rose-600/90" disabled={isPending} onClick={() => doDeny(r.id)}>Deny</Button>
                            </>
                          ) : (
                            <Link href={`/admin/interpreters/${r.id}`} className="inline-flex h-8 items-center rounded-xl border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" onClick={(e) => e.stopPropagation()}>
                              View
                            </Link>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                            <div className="h-full bg-zinc-900 dark:bg-white" style={{ width: `${comp.score}%` }} />
                          </div>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">{comp.label}</span>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-xs text-zinc-600 dark:text-zinc-400">
                        {formatDateISO(r.createdAt)}
                      </td>

                      <td className="px-4 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <ActiveBadge isActive={r.isActive} />
                          <StatusBadge status={r.status} />
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="tracking-tight">Interpreter profile</DialogTitle>
            <DialogDescription>Review status and access. Full editing is in the details view.</DialogDescription>
          </DialogHeader>

          {activeRow && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="font-medium text-zinc-950 dark:text-white">
                  {activeRow.interpreterProfile?.displayName ?? activeRow.email ?? "Unknown"}
                </div>
                <div className="text-xs text-zinc-500 mt-1">{activeRow.email ?? "—"} · {activeRow.interpreterProfile?.location ?? "—"}</div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ActiveBadge isActive={activeRow.isActive} />
                    <StatusBadge status={activeRow.status} />
                  </div>
                  <span className="text-xs text-zinc-400">{formatDateTimeISO(activeRow.createdAt)}</span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Mini label="Languages" value={(activeRow.interpreterProfile?.languages ?? []).join(", ") || "—"} />
                <Mini label="Certifications" value={(activeRow.interpreterProfile?.certifications ?? []).join(", ") || "—"} />
                <Mini label="Experience" value={activeRow.interpreterProfile?.experienceYears?.toString() ?? "—"} />
                <Mini label="Preferred modes" value={(activeRow.interpreterProfile?.preferredModes ?? []).join(", ") || "—"} />
              </div>

              <div>
                <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">Admin note</div>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note for audit…"
                  className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-zinc-800 dark:bg-zinc-900"
                />
              </div>

              <div className="flex flex-wrap gap-2 justify-end">
                <Button variant="secondary" className="h-11 rounded-2xl" onClick={() => setOpen(false)}>Close</Button>
                <Link href={`/admin/interpreters/${activeRow.id}`} className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white">
                  Full details
                </Link>
                <Button
                  className={`h-11 rounded-2xl ${activeRow.isActive ? "bg-rose-600 hover:bg-rose-600/90" : "bg-emerald-600 hover:bg-emerald-600/90"}`}
                  disabled={isPending}
                  onClick={() => openSingleToggleConfirm(activeRow, !activeRow.isActive)}
                >
                  {activeRow.isActive ? "Deactivate" : "Activate"}
                </Button>
                {activeRow.status === "PENDING" && (
                  <>
                    <Button className="h-11 rounded-2xl bg-rose-600 hover:bg-rose-600/90" disabled={isPending} onClick={() => doDeny(activeRow.id, note)}>Deny</Button>
                    <Button className="h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-600/90" disabled={isPending} onClick={() => doApprove(activeRow.id, note)}>Approve</Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm single toggle */}
      <Dialog open={confirmSingleOpen} onOpenChange={setConfirmSingleOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>{pendingNextActive ? "Activate interpreter?" : "Deactivate interpreter?"}</DialogTitle>
            <DialogDescription>
              {pendingNextActive
                ? "Activating restores eligibility. If approved, access returns immediately."
                : "Deactivating blocks interpreter pages and protected APIs immediately."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" className="h-11 rounded-2xl" disabled={isPending} onClick={() => setConfirmSingleOpen(false)}>Cancel</Button>
            <Button className={`h-11 rounded-2xl ${pendingNextActive ? "bg-emerald-600 hover:bg-emerald-600/90" : "bg-rose-600 hover:bg-rose-600/90"}`} disabled={isPending} onClick={doSingleToggle}>Confirm</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm bulk toggle */}
      <Dialog open={confirmBulkOpen} onOpenChange={setConfirmBulkOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>{bulkNextActive ? "Activate selected?" : "Deactivate selected?"}</DialogTitle>
            <DialogDescription>
              Updates eligibility for {selectedIds.length} interpreter{selectedIds.length !== 1 ? "s" : ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" className="h-11 rounded-2xl" disabled={isPending} onClick={() => setConfirmBulkOpen(false)}>Cancel</Button>
            <Button className={`h-11 rounded-2xl ${bulkNextActive ? "bg-emerald-600 hover:bg-emerald-600/90" : "bg-rose-600 hover:bg-rose-600/90"}`} disabled={isPending} onClick={doBulkToggle}>Confirm</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Chip({ active, children, onClick }: { active?: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "h-10 rounded-full px-4 text-sm font-medium transition-colors",
        active
          ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
          : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-1 text-sm font-medium text-zinc-950 dark:text-white">{value}</div>
    </div>
  );
}