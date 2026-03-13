"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  approvePendingInterpreter,
  denyPendingInterpreter,
  bulkApprovePending,
  bulkDenyPending,
} from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  XCircle,
  Search,
  Loader2,
  UserCheck,
  ArrowUpRight,
  Users,
  MapPin,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

type InterpreterProfile = {
  displayName: string | null;
  location: string | null;
  languages: string[];
  certifications: string[];
  experienceYears: number | null;
  updatedAt: Date;
};

type Row = {
  id: string;
  email: string | null;
  status: "PENDING" | "APPROVED" | "DENIED";
  isActive: boolean;
  createdAt: Date;
  interpreterProfile: InterpreterProfile | null;
};

function Initials({ name, email }: { name: string | null; email: string | null }) {
  const str = name ?? email ?? "?";
  const parts = str.split(/[\s@]/);
  const init = parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : str.slice(0, 2).toUpperCase();
  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200/60">
      {init}
    </div>
  );
}

export function ApprovalsTable({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(() => initial.filter((r) => r.status === "PENDING"));
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<"APPROVE" | "DENY">("APPROVE");
  const [confirmOneOpen, setConfirmOneOpen] = useState(false);
  const [oneMode, setOneMode] = useState<"APPROVE" | "DENY">("APPROVE");
  const [activeRow, setActiveRow] = useState<Row | null>(null);

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const pending = rows.filter((r) => r.status === "PENDING");
    if (!query) return pending;
    return pending.filter((r) => {
      const name = r.interpreterProfile?.displayName ?? "";
      const email = r.email ?? "";
      const loc = r.interpreterProfile?.location ?? "";
      return (
        email.toLowerCase().includes(query) ||
        name.toLowerCase().includes(query) ||
        loc.toLowerCase().includes(query)
      );
    });
  }, [q, rows]);

  const shownIds = useMemo(() => filtered.map((r) => r.id), [filtered]);
  const allShownSelected = useMemo(
    () => shownIds.length > 0 && shownIds.every((id) => selected[id]),
    [shownIds, selected]
  );

  function toggleAllShown() {
    if (allShownSelected) {
      setSelected((prev) => {
        const next = { ...prev };
        for (const id of shownIds) delete next[id];
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = { ...prev };
        for (const id of shownIds) next[id] = true;
        return next;
      });
    }
  }

  function removeRows(ids: string[]) {
    const set = new Set(ids);
    setRows((prev) => prev.filter((r) => !set.has(r.id)));
    setSelected((prev) => {
      const next = { ...prev };
      for (const id of ids) delete next[id];
      return next;
    });
  }

  function doOne() {
    if (!activeRow) return;
    startTransition(async () => {
      try {
        if (oneMode === "APPROVE") {
          await approvePendingInterpreter({ userProfileId: activeRow.id, note });
          toast.success("Interpreter approved", { description: "They now have access pending activation." });
        } else {
          await denyPendingInterpreter({ userProfileId: activeRow.id, note });
          toast.success("Interpreter denied", { description: "They've been routed to the denied gate." });
        }
        removeRows([activeRow.id]);
        setNote("");
        setConfirmOneOpen(false);
        setActiveRow(null);
      } catch {
        toast.error("Action failed", { description: "Please try again." });
      }
    });
  }

  function doBulk() {
    if (selectedIds.length === 0) return;
    startTransition(async () => {
      try {
        if (bulkMode === "APPROVE") {
          const res = await bulkApprovePending({ userProfileIds: selectedIds, note });
          toast.success(`Approved ${res.updated}`, { description: "Accounts now have pending access." });
        } else {
          const res = await bulkDenyPending({ userProfileIds: selectedIds, note });
          toast.success(`Denied ${res.updated}`, { description: "Accounts have been rejected." });
        }
        removeRows(selectedIds);
        setNote("");
        setConfirmBulkOpen(false);
      } catch {
        toast.error("Bulk action failed", { description: "Please try again." });
      }
    });
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200/80 bg-white p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email, or location…"
            className="h-9 rounded-lg pl-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600">
            {filtered.length} pending
          </span>
          {selectedIds.length > 0 && (
            <span className="rounded-full border border-primary/20 bg-primary/8 px-2.5 py-1 text-xs font-medium text-primary">
              {selectedIds.length} selected
            </span>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-zinc-200/80 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-zinc-950">
              {selectedIds.length} selected
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Approving grants access (if active). Denying blocks access permanently.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional audit note…"
              className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none transition focus:border-zinc-400 focus:bg-white sm:w-56"
              disabled={isPending}
            />
            <Button
              size="sm"
              className="h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={isPending}
              onClick={() => { setBulkMode("APPROVE"); setConfirmBulkOpen(true); }}
            >
              {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
              Approve all
            </Button>
            <Button
              size="sm"
              className="h-9 rounded-lg bg-rose-600 hover:bg-rose-700 text-white"
              disabled={isPending}
              onClick={() => { setBulkMode("DENY"); setConfirmBulkOpen(true); }}
            >
              {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <XCircle className="size-3.5" />}
              Deny all
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-lg"
              disabled={isPending}
              onClick={() => setSelected({})}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white">
        {/* Table header */}
        <div className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3">
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={allShownSelected}
              onChange={toggleAllShown}
              disabled={filtered.length === 0}
              className="h-4 w-4 rounded border-zinc-300 accent-primary"
              aria-label="Select all shown"
            />
            <span className="text-xs font-medium text-zinc-500">
              Select all
            </span>
          </label>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-zinc-400">
            <Users className="size-3.5" />
            {filtered.length} pending
          </div>
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <EmptyState hasSearch={q.length > 0} />
        ) : (
          <div className="divide-y divide-zinc-100">
            {filtered.map((r) => (
              <div
                key={r.id}
                className={cn(
                  "flex items-center gap-4 px-4 py-4 transition-colors",
                  selected[r.id] ? "bg-primary/4" : "hover:bg-zinc-50/80"
                )}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={Boolean(selected[r.id])}
                  onChange={(e) =>
                    setSelected((prev) => ({ ...prev, [r.id]: e.target.checked }))
                  }
                  className="h-4 w-4 shrink-0 rounded border-zinc-300 accent-primary"
                  aria-label={`Select ${r.email ?? r.id}`}
                />

                {/* Avatar */}
                <Initials
                  name={r.interpreterProfile?.displayName ?? null}
                  email={r.email}
                />

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-zinc-950">
                      {r.interpreterProfile?.displayName ?? r.email ?? "Unknown"}
                    </p>
                    <span className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                      r.isActive
                        ? "border-sky-200 bg-sky-50 text-sky-700"
                        : "border-zinc-200 bg-zinc-50 text-zinc-500"
                    )}>
                      {r.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    {r.email && (
                      <span className="text-xs text-zinc-400 truncate">{r.email}</span>
                    )}
                    {r.interpreterProfile?.location && (
                      <span className="flex items-center gap-1 text-xs text-zinc-400">
                        <MapPin className="size-3" />
                        {r.interpreterProfile.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-zinc-400">
                      <Calendar className="size-3" />
                      {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  {r.interpreterProfile?.languages && r.interpreterProfile.languages.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {r.interpreterProfile.languages.slice(0, 3).map((l) => (
                        <span key={l} className="rounded-md border border-zinc-100 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                          {l}
                        </span>
                      ))}
                      {r.interpreterProfile.languages.length > 3 && (
                        <span className="text-[10px] text-zinc-400">
                          +{r.interpreterProfile.languages.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/admin/interpreters/${r.id}`}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                  >
                    View
                    <ArrowUpRight className="size-3 opacity-60" />
                  </Link>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => { setActiveRow(r); setOneMode("DENY"); setConfirmOneOpen(true); }}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                  >
                    Deny
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => { setActiveRow(r); setOneMode("APPROVE"); setConfirmOneOpen(true); }}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm single */}
      <ConfirmDialog
        open={confirmOneOpen}
        onOpenChange={setConfirmOneOpen}
        mode={oneMode}
        count={1}
        note={note}
        onNoteChange={setNote}
        isPending={isPending}
        onConfirm={doOne}
        label={activeRow?.interpreterProfile?.displayName ?? activeRow?.email ?? "this interpreter"}
      />

      {/* Confirm bulk */}
      <ConfirmDialog
        open={confirmBulkOpen}
        onOpenChange={setConfirmBulkOpen}
        mode={bulkMode}
        count={selectedIds.length}
        note={note}
        onNoteChange={setNote}
        isPending={isPending}
        onConfirm={doBulk}
      />
    </div>
  );
}

function ConfirmDialog({
  open,
  onOpenChange,
  mode,
  count,
  note,
  onNoteChange,
  isPending,
  onConfirm,
  label,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: "APPROVE" | "DENY";
  count: number;
  note: string;
  onNoteChange: (v: string) => void;
  isPending: boolean;
  onConfirm: () => void;
  label?: string;
}) {
  const isApprove = mode === "APPROVE";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 tracking-tight">
            {isApprove ? (
              <CheckCircle2 className="size-5 text-emerald-600" />
            ) : (
              <XCircle className="size-5 text-rose-600" />
            )}
            {isApprove ? "Approve" : "Deny"}{" "}
            {count === 1 ? label ?? "interpreter" : `${count} interpreters`}?
          </DialogTitle>
          <DialogDescription className="text-sm text-zinc-500">
            {isApprove
              ? "Approving grants job feed access if the account is active."
              : "Denying routes the interpreter to the denied gate and blocks access."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-700">
            Audit note <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <input
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Short factual note for the audit log…"
            className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none transition focus:border-zinc-400 focus:bg-white"
            disabled={isPending}
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            className="h-10 rounded-lg"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className={cn(
              "h-10 rounded-lg text-white",
              isApprove ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
            )}
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isApprove ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <XCircle className="size-4" />
            )}
            {isPending ? "Saving…" : isApprove ? "Approve" : "Deny"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-zinc-200 bg-zinc-50">
        <UserCheck className="size-5 text-zinc-400" />
      </div>
      <p className="mt-3 text-sm font-semibold text-zinc-900">
        {hasSearch ? "No results found" : "No pending interpreters"}
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        {hasSearch
          ? "Try a different search term."
          : "New sign-ups will appear here automatically."}
      </p>
    </div>
  );
}
