// app/admin/assignments/table.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Status = "OPEN" | "ASSIGNED" | "COMPLETED" | "CANCELLED";

type Row = {
  id: string;
  title: string;
  clientName: string;
  languagePair: string;
  assignmentType: string;
  location: string;
  scheduledStart: string;
  scheduledEnd: string;
  interpretersNeeded: number;
  status: Status;
  visibilityMode: "ALL" | "RESTRICTED";
  assignedCount: number;
  createdAt: string;
  updatedAt: string;
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function StatusPill({ status }: { status: Status }) {
  const cls: Record<Status, string> = {
    OPEN: "bg-sky-500/10 text-sky-700 border-sky-500/20 dark:text-sky-300",
    ASSIGNED: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-300",
    COMPLETED: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-400",
    CANCELLED: "bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-300",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cls[status]}`}>
      {status}
    </span>
  );
}

export function AssignmentsTable({ initial }: { initial: Row[] }) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"ALL" | Status>("ALL");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return initial.filter((a) => {
      if (tab !== "ALL" && a.status !== tab) return false;
      if (!query) return true;
      return (
        a.title.toLowerCase().includes(query) ||
        a.clientName.toLowerCase().includes(query) ||
        a.location.toLowerCase().includes(query) ||
        a.languagePair.toLowerCase().includes(query) ||
        a.assignmentType.toLowerCase().includes(query)
      );
    });
  }, [initial, q, tab]);

  const tabs: ("ALL" | Status)[] = ["ALL", "OPEN", "ASSIGNED", "COMPLETED", "CANCELLED"];

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by title, client, location, language…"
          className="h-10 rounded-xl bg-white dark:bg-zinc-900 max-w-sm"
        />
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={[
                "h-9 rounded-xl px-3.5 text-xs font-medium transition-colors",
                tab === t
                  ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                  : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
              ].join(" ")}
            >
              {t === "ALL" ? `All (${initial.length})` : t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-900 text-left text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                <th className="px-4 py-3">Assignment</th>
                <th className="px-4 py-3">Schedule</th>
                <th className="px-4 py-3 text-center">Filled</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-950">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-14 text-center text-sm text-zinc-400">
                    No assignments match your search.
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-900/50 transition-colors">
                    <td className="px-4 py-4">
                      <Link href={`/admin/assignments/${a.id}`} className="block">
                        <div className="font-medium text-zinc-950 dark:text-white hover:underline">
                          {a.title}
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {a.languagePair} · {a.assignmentType} · {a.location}
                        </div>
                        <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                          {a.visibilityMode === "RESTRICTED" ? (
                            <span className="text-amber-600 dark:text-amber-400">Restricted</span>
                          ) : (
                            <span>Public</span>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">
                      <div className="text-sm font-medium">{fmt(a.scheduledStart)}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">→ {fmt(a.scheduledEnd)}</div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div
                        className={[
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                          a.assignedCount >= a.interpretersNeeded
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                        ].join(" ")}
                      >
                        {a.assignedCount}/{a.interpretersNeeded}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <StatusPill status={a.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-4 py-2.5 text-xs text-zinc-400">
            Showing {filtered.length} of {initial.length} assignments
          </div>
        )}
      </div>
    </div>
  );
}