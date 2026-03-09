// app/admin/assignments/table.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Status = "OPEN" | "ASSIGNED" | "COMPLETED" | "CANCELLED";
type Row = {
  id: string; title: string; clientName: string; clientOrganization: string | null;
  languagePair: string; assignmentType: string; deliveryMode: string;
  location: string; scheduledStart: string; scheduledEnd: string;
  interpretersNeeded: number; status: Status; visibilityMode: "ALL" | "RESTRICTED";
  isUrgent: boolean; assignedCount: number;
  compensationRate: number | null; compensationUnit: string | null; isCompensationVisible: boolean;
  requiredCertifications: string[]; requiredLanguagePair: string | null;
  createdAt: string;
};

const DELIVERY_ICONS: Record<string, string> = { IN_PERSON: "🏢", REMOTE: "📞", VIDEO_RELAY: "📺", VIDEO_REMOTE: "💻" };
const DELIVERY_SHORT: Record<string, string> = { IN_PERSON: "In-person", REMOTE: "Remote", VIDEO_RELAY: "VRS", VIDEO_REMOTE: "VRI" };

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}
function dur(start: string, end: string) {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const h = Math.floor(diff / 3600000), m = Math.round((diff % 3600000) / 60000);
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
}

function StatusPill({ status }: { status: Status }) {
  const cls: Record<Status, string> = {
    OPEN:      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
    ASSIGNED:  "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    COMPLETED: "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
    CANCELLED: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cls[status]}`}>
      {status}
    </span>
  );
}

export function AssignmentsTable({ initial }: { initial: Row[] }) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"ALL" | Status>("ALL");
  const [modeFilter, setModeFilter] = useState<"ALL" | "IN_PERSON" | "REMOTE_ALL">("ALL");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return initial.filter((a) => {
      if (tab !== "ALL" && a.status !== tab) return false;
      if (modeFilter === "IN_PERSON" && a.deliveryMode !== "IN_PERSON") return false;
      if (modeFilter === "REMOTE_ALL" && a.deliveryMode === "IN_PERSON") return false;
      if (!query) return true;
      return (
        a.title.toLowerCase().includes(query) ||
        a.clientName.toLowerCase().includes(query) ||
        a.location.toLowerCase().includes(query) ||
        a.languagePair.toLowerCase().includes(query) ||
        a.assignmentType.toLowerCase().includes(query) ||
        (a.clientOrganization?.toLowerCase().includes(query) ?? false)
      );
    });
  }, [initial, q, tab, modeFilter]);

  const tabs: ("ALL" | Status)[] = ["ALL","OPEN","ASSIGNED","COMPLETED","CANCELLED"];

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between">
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, client, language, location…"
          className="h-10 w-full max-w-sm rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-400 focus:bg-white transition-colors dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500" />
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`h-9 rounded-xl px-3.5 text-xs font-medium transition-colors ${tab === t ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"}`}>
              {t === "ALL" ? `All (${initial.length})` : t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
          <div className="w-px bg-zinc-200 dark:bg-zinc-700 mx-1" />
          {(["ALL","IN_PERSON","REMOTE_ALL"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setModeFilter(m)}
              className={`h-9 rounded-xl px-3.5 text-xs font-medium transition-colors ${modeFilter === m ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"}`}>
              {m === "ALL" ? "All modes" : m === "IN_PERSON" ? "🏢 In-person" : "🖥 Remote"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-900 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3.5">Assignment</th>
                <th className="px-4 py-3.5">Schedule</th>
                <th className="px-4 py-3.5 text-center">Filled</th>
                <th className="px-4 py-3.5">Compensation</th>
                <th className="px-4 py-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-950">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center text-sm text-zinc-400">
                    No assignments match your filter.
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a.id} className="group hover:bg-zinc-50/70 dark:hover:bg-zinc-900/50 transition-colors">
                    <td className="px-4 py-4 max-w-xs">
                      <Link href={`/admin/assignments/${a.id}`} className="block">
                        <div className="flex items-start gap-2 mb-1">
                          {a.isUrgent && (
                            <span className="mt-0.5 shrink-0 inline-flex rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                              URGENT
                            </span>
                          )}
                          <span className="font-semibold text-zinc-950 dark:text-white group-hover:underline leading-tight">
                            {a.title}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                          {a.clientName}
                          {a.clientOrganization && <span className="text-zinc-400"> · {a.clientOrganization}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 rounded-md border border-zinc-100 bg-zinc-50 px-1.5 py-0.5 text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                            {DELIVERY_ICONS[a.deliveryMode]} {DELIVERY_SHORT[a.deliveryMode] ?? a.deliveryMode}
                          </span>
                          <span className="text-[11px] text-zinc-400">{a.languagePair}</span>
                          <span className="text-[11px] text-zinc-300 dark:text-zinc-600">·</span>
                          <span className="text-[11px] text-zinc-400">{a.assignmentType}</span>
                          {a.requiredCertifications.length > 0 && (
                            <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300">
                              Cert req.
                            </span>
                          )}
                          {a.visibilityMode === "RESTRICTED" && (
                            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">🔒 Restricted</span>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-zinc-900 dark:text-white">{fmt(a.scheduledStart)}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">→ {fmt(a.scheduledEnd)}</div>
                      <div className="text-xs text-zinc-400 mt-0.5">{dur(a.scheduledStart, a.scheduledEnd)}</div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
                        a.assignedCount >= a.interpretersNeeded
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                      }`}>
                        {a.assignedCount}/{a.interpretersNeeded}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {a.isCompensationVisible && a.compensationRate != null ? (
                        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          ${a.compensationRate.toFixed(0)}
                          {a.compensationUnit && <span className="font-normal text-zinc-400 text-xs"> /{a.compensationUnit.replace("per ","")}</span>}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-300 dark:text-zinc-600 italic">—</span>
                      )}
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
          <div className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-2.5 text-xs text-zinc-400">
            Showing {filtered.length} of {initial.length}
          </div>
        )}
      </div>
    </div>
  );
}