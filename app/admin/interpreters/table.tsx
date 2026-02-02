"use client";

import { useMemo, useState, useTransition } from "react";
import { motion, cubicBezier } from "framer-motion";
import Link from "next/link";
import { toast } from "sonner";

import { approveInterpreterById, denyInterpreterById } from "./actions";

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

type InterpreterProfile = {
  displayName: string | null;
  phone: string | null;
  location: string | null;
  bio: string | null;
  languages: string[];
  certifications: string[];
  experienceYears: number | null;
  preferredModes: string[];
  availabilityNote: string | null;
  updatedAt: Date;
};

type Row = {
  id: string;
  email: string | null;
  status: "PENDING" | "APPROVED" | "DENIED";
  createdAt: Date;
  updatedAt: Date;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  interpreterProfile: InterpreterProfile | null;
};

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
  const total = fields.length;
  const pct = Math.round((filled / total) * 100);

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

export function InterpretersTable({ initial }: { initial: Row[] }) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"ALL" | "PENDING" | "APPROVED" | "DENIED">("ALL");

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Row | null>(null);
  const [note, setNote] = useState("");

  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    return initial.filter((r) => {
      if (tab !== "ALL" && r.status !== tab) return false;
      if (!query) return true;

      const name = r.interpreterProfile?.displayName ?? "";
      const email = r.email ?? "";
      const location = r.interpreterProfile?.location ?? "";
      return (
        email.toLowerCase().includes(query) ||
        name.toLowerCase().includes(query) ||
        location.toLowerCase().includes(query)
      );
    });
  }, [q, tab, initial]);

  function openReview(row: Row) {
    setActive(row);
    setNote("");
    setOpen(true);
  }

  function doApprove(id: string, noteValue?: string) {
    startTransition(async () => {
      await approveInterpreterById(id, noteValue ?? "");
      toast.success("Approved", { description: "Interpreter now has job feed access." });
      setOpen(false);
    });
  }

  function doDeny(id: string, noteValue?: string) {
    startTransition(async () => {
      await denyInterpreterById(id, noteValue ?? "");
      toast("Denied", { description: "Interpreter access blocked." });
      setOpen(false);
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
                placeholder="Search email, name, location…"
                className="h-11 rounded-2xl bg-white dark:bg-zinc-900"
              />
            </div>

            <Badge variant="secondary" className="rounded-full">
              {filtered.length} shown
            </Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            <Chip active={tab === "ALL"} onClick={() => setTab("ALL")}>All</Chip>
            <Chip active={tab === "PENDING"} onClick={() => setTab("PENDING")}>Pending</Chip>
            <Chip active={tab === "APPROVED"} onClick={() => setTab("APPROVED")}>Approved</Chip>
            <Chip active={tab === "DENIED"} onClick={() => setTab("DENIED")}>Denied</Chip>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="space-y-0.5">
            <div className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-white">
              Interpreter directory
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Click a row for full profile. Hover for quick actions.
            </div>
          </div>

          {isPending ? (
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Saving…</div>
          ) : null}
        </div>

        <Separator className="opacity-60" />

        <div className="max-h-[620px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-white/90 backdrop-blur dark:bg-zinc-900/90">
              <tr className="text-left text-xs text-zinc-500 dark:text-zinc-400">
                <th className="px-4 py-3">Interpreter</th>
                <th className="px-4 py-3">Profile</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-14">
                    <EmptyState />
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
                      className="group border-t border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/30"
                      onClick={() => openReview(r)}
                      role="button"
                      tabIndex={0}
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="font-medium tracking-tight text-zinc-950 dark:text-white">
                              {r.interpreterProfile?.displayName ?? r.email ?? "Unknown"}
                            </div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">
                              {r.email ?? "No email"} · {r.interpreterProfile?.location ?? "No location"}
                            </div>
                          </div>

                          <div
                            className="hidden items-center gap-2 opacity-0 transition-opacity group-hover:flex group-hover:opacity-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {r.status === "PENDING" ? (
                              <>
                                <Button
                                  size="sm"
                                  className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-600/90"
                                  disabled={isPending}
                                  onClick={() => doApprove(r.id)}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-9 rounded-xl bg-rose-600 hover:bg-rose-600/90"
                                  disabled={isPending}
                                  onClick={() => doDeny(r.id)}
                                >
                                  Deny
                                </Button>
                              </>
                            ) : (
                              <Link
                                href={`/admin/interpreters/${r.id}`}
                                className="inline-flex h-9 items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800/60"
                              >
                                View
                              </Link>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-28 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                            <div
                              className="h-full bg-zinc-900 dark:bg-white"
                              style={{ width: `${comp.score}%` }}
                            />
                          </div>
                          <div className="text-xs text-zinc-600 dark:text-zinc-300">
                            {comp.label} · {comp.score}%
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-zinc-600 dark:text-zinc-300">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </td>

                      <td className="px-4 py-4 text-right">
                        <StatusBadge status={r.status} />
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review drawer (Dialog) */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="tracking-tight">Interpreter profile</DialogTitle>
            <DialogDescription>
              Review profile quality, status, and audit details. Jobs history will appear here later.
            </DialogDescription>
          </DialogHeader>

          {active ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">Identity</div>
                <div className="mt-1 font-medium text-zinc-950 dark:text-white">
                  {active.interpreterProfile?.displayName ?? active.email ?? "Unknown"}
                </div>
                <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Email: <span className="text-zinc-700 dark:text-zinc-300">{active.email ?? "-"}</span>
                </div>
                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Location:{" "}
                  <span className="text-zinc-700 dark:text-zinc-300">
                    {active.interpreterProfile?.location ?? "-"}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <StatusBadge status={active.status} />
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Requested: {new Date(active.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Mini label="Languages" value={(active.interpreterProfile?.languages ?? []).join(", ") || "—"} />
                <Mini label="Certifications" value={(active.interpreterProfile?.certifications ?? []).join(", ") || "—"} />
                <Mini label="Experience" value={active.interpreterProfile?.experienceYears?.toString() ?? "—"} />
                <Mini label="Preferred modes" value={(active.interpreterProfile?.preferredModes ?? []).join(", ") || "—"} />
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Admin note</div>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note for audit (optional)…"
                  className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-zinc-800 dark:bg-zinc-900"
                />
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Stored for audit. Keep it short and factual.
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="secondary" className="h-11 rounded-2xl" onClick={() => setOpen(false)}>
                  Close
                </Button>

                <Link
                  href={`/admin/interpreters/${active.id}`}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800/60"
                >
                  Full details
                </Link>

                {active.status === "PENDING" ? (
                  <>
                    <Button
                      className="h-11 rounded-2xl bg-rose-600 hover:bg-rose-600/90"
                      disabled={isPending}
                      onClick={() => doDeny(active.id, note)}
                    >
                      Deny
                    </Button>
                    <Button
                      className="h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-600/90"
                      disabled={isPending}
                      onClick={() => doApprove(active.id, note)}
                    >
                      Approve
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "h-10 rounded-full px-4 text-sm font-medium transition-colors",
        active
          ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
          : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800/60",
      ].join(" ")}
      type="button"
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

function EmptyState() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
      <div className="h-12 w-12 rounded-3xl bg-zinc-100 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700" />
      <div className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-white">
        No interpreters match your filters
      </div>
      <div className="text-xs text-zinc-500 dark:text-zinc-400">
        Try clearing search or switching status filters.
      </div>
    </div>
  );
}
