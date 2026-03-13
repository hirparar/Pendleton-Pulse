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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search, Loader2, ArrowUpRight, CheckCircle2, XCircle,
  MapPin, Languages, Star, UserCheck, UserX, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
    p.displayName, p.phone, p.location, p.bio,
    (p.languages?.length ?? 0) > 0 ? "x" : null,
    (p.certifications?.length ?? 0) > 0 ? "x" : null,
    p.experienceYears !== null ? "x" : null,
    (p.preferredModes?.length ?? 0) > 0 ? "x" : null,
  ];
  const filled = fields.filter(Boolean).length;
  const pct = Math.round((filled / fields.length) * 100);
  const label = pct >= 85 ? "Strong" : pct >= 60 ? "Good" : pct >= 35 ? "Basic" : "Incomplete";
  return { score: pct, label };
}

function getInitials(name: string | null, email: string | null) {
  const src = name ?? email ?? "?";
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function Avatar({ name, email, size = "md" }: { name: string | null; email: string | null; size?: "sm" | "md" }) {
  const initials = getInitials(name, email);
  const colors = [
    "bg-indigo-100 text-indigo-700",
    "bg-violet-100 text-violet-700",
    "bg-sky-100 text-sky-700",
    "bg-emerald-100 text-emerald-700",
    "bg-amber-100 text-amber-700",
  ];
  const src = name ?? email ?? "";
  const colorIdx = src.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;
  return (
    <div className={cn(
      "flex shrink-0 items-center justify-center rounded-full font-semibold",
      size === "sm" ? "size-8 text-[11px]" : "size-10 text-sm",
      colors[colorIdx]
    )}>
      {initials}
    </div>
  );
}

// ─── status components ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Row["status"] }) {
  const styles = {
    APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
    PENDING: "border-amber-200 bg-amber-50 text-amber-700",
    DENIED: "border-rose-200 bg-rose-50 text-rose-600",
  };
  return (
    <span className={cn("rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", styles[status])}>
      {status === "APPROVED" ? "Approved" : status === "PENDING" ? "Pending" : "Denied"}
    </span>
  );
}

function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <span className={cn(
      "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
      isActive
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : "border-zinc-200 bg-zinc-50 text-zinc-500"
    )}>
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
  const anyShownSelected = useMemo(() => shownIds.some((id) => selected[id]), [shownIds, selected]);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: rows.length };
    for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
    return counts;
  }, [rows]);

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

  const TABS = ["ALL", "PENDING", "APPROVED", "DENIED"] as const;
  const TAB_LABELS: Record<typeof TABS[number], string> = {
    ALL: "All", PENDING: "Pending", APPROVED: "Approved", DENIED: "Denied",
  };

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="space-y-3 rounded-xl border border-zinc-200/80 bg-white p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, location…"
            className="h-9 rounded-lg pl-9 text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "h-8 rounded-lg px-3 text-xs font-medium transition-all",
                tab === t
                  ? "bg-zinc-950 text-white shadow-sm"
                  : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
              )}
            >
              {TAB_LABELS[t]}
              <span className={cn("ml-1.5 tabular-nums", tab === t ? "opacity-70" : "text-zinc-400")}>
                {tabCounts[t] ?? 0}
              </span>
            </button>
          ))}
          {anyShownSelected && (
            <>
              <div className="h-5 w-px bg-zinc-200 mx-1" />
              <span className="text-xs text-zinc-500 tabular-nums">{selectedIds.length} selected</span>
            </>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200/80 bg-white p-3">
          <span className="text-xs font-semibold text-zinc-700">
            Bulk actions ({selectedIds.length})
          </span>
          <div className="h-4 w-px bg-zinc-200" />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional audit note…"
            className="h-8 flex-1 min-w-40 rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
          />
          <button
            type="button"
            disabled={isPending}
            onClick={() => openBulkToggleConfirm(true)}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {isPending ? <Loader2 className="size-3 animate-spin" /> : <UserCheck className="size-3" />}
            Activate
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => openBulkToggleConfirm(false)}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
          >
            {isPending ? <Loader2 className="size-3 animate-spin" /> : <UserX className="size-3" />}
            Deactivate
          </button>
          <button
            type="button"
            onClick={() => setSelected({})}
            className="h-8 rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50"
          >
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/80 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-zinc-950">Interpreter directory</p>
            <p className="text-xs text-zinc-500">Click a row to review details and actions.</p>
          </div>
          {isPending && (
            <span className="flex items-center gap-1.5 text-xs text-zinc-400">
              <Loader2 className="size-3 animate-spin" />
              Saving…
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left">
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allShownSelected}
                    className="accent-primary h-3.5 w-3.5 rounded"
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
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Interpreter
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Profile
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Joined
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-200 bg-zinc-50">
                        <Users className="size-4 text-zinc-400" />
                      </div>
                      <p className="text-sm font-medium text-zinc-900">No interpreters match</p>
                      <p className="text-xs text-zinc-500">Try a different filter or search term.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((r, idx) => {
                  const comp = completeness(r.interpreterProfile);
                  const compColor = comp.score >= 85 ? "bg-emerald-500" : comp.score >= 60 ? "bg-sky-500" : comp.score >= 35 ? "bg-amber-500" : "bg-zinc-300";
                  return (
                    <motion.tr
                      key={r.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, ease, delay: Math.min(idx * 0.01, 0.1) }}
                      className="group cursor-pointer transition-colors hover:bg-zinc-50/70"
                      onClick={() => openReview(r)}
                    >
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={Boolean(selected[r.id])}
                          className="accent-primary h-3.5 w-3.5 rounded"
                          onChange={(e) =>
                            setSelected((prev) => ({ ...prev, [r.id]: e.target.checked }))
                          }
                        />
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={r.interpreterProfile?.displayName ?? null} email={r.email} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-zinc-950">
                              {r.interpreterProfile?.displayName ?? r.email ?? "Unknown"}
                            </p>
                            <p className="truncate text-xs text-zinc-500">{r.email ?? "No email"}</p>
                            {r.interpreterProfile?.location && (
                              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-zinc-400">
                                <MapPin className="size-2.5" />
                                {r.interpreterProfile.location}
                              </p>
                            )}
                          </div>
                        </div>
                        {/* Hover actions */}
                        <div
                          className="mt-2 hidden items-center gap-2 opacity-0 transition-opacity group-hover:flex group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => openSingleToggleConfirm(r, !r.isActive)}
                            className={cn(
                              "flex h-7 items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition disabled:opacity-50",
                              r.isActive
                                ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
                                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            )}
                          >
                            {isPending ? <Loader2 className="size-3 animate-spin" /> : null}
                            {r.isActive ? "Deactivate" : "Activate"}
                          </button>
                          {r.status === "PENDING" ? (
                            <>
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => doApprove(r.id)}
                                className="flex h-7 items-center gap-1 rounded-lg bg-emerald-50 px-2.5 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                              >
                                <CheckCircle2 className="size-3" />
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => doDeny(r.id)}
                                className="flex h-7 items-center gap-1 rounded-lg bg-rose-50 px-2.5 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                              >
                                <XCircle className="size-3" />
                                Deny
                              </button>
                            </>
                          ) : (
                            <Link
                              href={`/admin/interpreters/${r.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex h-7 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-50"
                            >
                              View
                              <ArrowUpRight className="size-3 opacity-60" />
                            </Link>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-100">
                              <div className={cn("h-full transition-all", compColor)} style={{ width: `${comp.score}%` }} />
                            </div>
                            <span className="text-[11px] text-zinc-500">{comp.label}</span>
                          </div>
                          {(r.interpreterProfile?.languages ?? []).length > 0 && (
                            <p className="flex items-center gap-1 text-[11px] text-zinc-400">
                              <Languages className="size-2.5" />
                              {r.interpreterProfile!.languages.slice(0, 2).join(", ")}
                              {r.interpreterProfile!.languages.length > 2 && ` +${r.interpreterProfile!.languages.length - 2}`}
                            </p>
                          )}
                          {(r.interpreterProfile?.certifications ?? []).length > 0 && (
                            <p className="flex items-center gap-1 text-[11px] text-zinc-400">
                              <Star className="size-2.5" />
                              {r.interpreterProfile!.certifications.slice(0, 2).join(", ")}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4 text-xs text-zinc-500">
                        {formatDateISO(r.createdAt)}
                      </td>

                      <td className="px-4 py-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <ActiveBadge isActive={r.isActive} />
                          <StatusBadge status={r.status} />
                          <ArrowUpRight className="size-3.5 text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="border-t border-zinc-100 bg-zinc-50/50 px-4 py-2.5">
            <p className="text-xs text-zinc-400">
              Showing <span className="font-medium text-zinc-600">{filtered.length}</span> of {rows.length} interpreters
            </p>
          </div>
        )}
      </div>

      {/* Review dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="tracking-tight">Interpreter review</DialogTitle>
            <DialogDescription>Quick actions and profile snapshot.</DialogDescription>
          </DialogHeader>

          {activeRow && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                <Avatar name={activeRow.interpreterProfile?.displayName ?? null} email={activeRow.email} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-950">
                    {activeRow.interpreterProfile?.displayName ?? activeRow.email ?? "Unknown"}
                  </p>
                  <p className="truncate text-xs text-zinc-500">{activeRow.email ?? "—"}</p>
                  {activeRow.interpreterProfile?.location && (
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-zinc-400">
                      <MapPin className="size-2.5" />
                      {activeRow.interpreterProfile.location}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <ActiveBadge isActive={activeRow.isActive} />
                  <StatusBadge status={activeRow.status} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Languages", value: (activeRow.interpreterProfile?.languages ?? []).join(", ") || "—" },
                  { label: "Certifications", value: (activeRow.interpreterProfile?.certifications ?? []).join(", ") || "—" },
                  { label: "Experience", value: activeRow.interpreterProfile?.experienceYears !== null && activeRow.interpreterProfile?.experienceYears !== undefined ? `${activeRow.interpreterProfile.experienceYears} yrs` : "—" },
                  { label: "Joined", value: formatDateTimeISO(activeRow.createdAt) },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg border border-zinc-100 bg-white p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
                    <p className="mt-0.5 text-xs font-medium text-zinc-800">{value}</p>
                  </div>
                ))}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-600">Admin note (optional)</label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="For audit log…"
                  className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-8 rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50"
                >
                  Close
                </button>
                <Link
                  href={`/admin/interpreters/${activeRow.id}`}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                >
                  Full details
                  <ArrowUpRight className="size-3 opacity-60" />
                </Link>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => openSingleToggleConfirm(activeRow, !activeRow.isActive)}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition disabled:opacity-50",
                    activeRow.isActive
                      ? "bg-rose-600 text-white hover:bg-rose-700"
                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                  )}
                >
                  {isPending ? <Loader2 className="size-3 animate-spin" /> : null}
                  {activeRow.isActive ? "Deactivate" : "Activate"}
                </button>
                {activeRow.status === "PENDING" && (
                  <>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => doDeny(activeRow.id, note)}
                      className="flex h-8 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
                    >
                      {isPending ? <Loader2 className="size-3 animate-spin" /> : <XCircle className="size-3" />}
                      Deny
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => doApprove(activeRow.id, note)}
                      className="flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {isPending ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
                      Approve
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm single toggle */}
      <Dialog open={confirmSingleOpen} onOpenChange={setConfirmSingleOpen}>
        <DialogContent className="max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle>{pendingNextActive ? "Activate interpreter?" : "Deactivate interpreter?"}</DialogTitle>
            <DialogDescription>
              {pendingNextActive
                ? "Activating restores eligibility. If approved, access returns immediately."
                : "Deactivating blocks interpreter pages and protected APIs immediately."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirmSingleOpen(false)}
              className="h-9 rounded-lg border border-zinc-200 px-4 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={doSingleToggle}
              className={cn(
                "flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition disabled:opacity-50",
                pendingNextActive ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
              )}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Confirm
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm bulk toggle */}
      <Dialog open={confirmBulkOpen} onOpenChange={setConfirmBulkOpen}>
        <DialogContent className="max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle>{bulkNextActive ? "Activate selected?" : "Deactivate selected?"}</DialogTitle>
            <DialogDescription>
              Updates eligibility for {selectedIds.length} interpreter{selectedIds.length !== 1 ? "s" : ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirmBulkOpen(false)}
              className="h-9 rounded-lg border border-zinc-200 px-4 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={doBulkToggle}
              className={cn(
                "flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition disabled:opacity-50",
                bulkNextActive ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
              )}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Confirm
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
