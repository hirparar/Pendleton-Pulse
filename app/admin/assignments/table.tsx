// app/admin/assignments/table.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Building2, Phone, Tv2, Monitor,
  Clock, Zap, Lock, CheckCircle2, Search,
  Users, DollarSign, ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

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

const DELIVERY_ICON: Record<string, React.ElementType> = {
  IN_PERSON: Building2,
  REMOTE: Phone,
  VIDEO_RELAY: Tv2,
  VIDEO_REMOTE: Monitor,
};
const DELIVERY_LABEL: Record<string, string> = {
  IN_PERSON: "In-person", REMOTE: "Remote", VIDEO_RELAY: "VRS", VIDEO_REMOTE: "VRI",
};

const STATUS_STYLE: Record<Status, string> = {
  OPEN:      "border-sky-200 bg-sky-50 text-sky-700",
  ASSIGNED:  "border-emerald-200 bg-emerald-50 text-emerald-700",
  COMPLETED: "border-zinc-200 bg-zinc-50 text-zinc-600",
  CANCELLED: "border-rose-200 bg-rose-50 text-rose-600",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}
function dur(start: string, end: string) {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.round((diff % 3600000) / 60000);
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
}

type Tab = "ALL" | Status;
const TABS: Tab[] = ["ALL", "OPEN", "ASSIGNED", "COMPLETED", "CANCELLED"];
const TAB_LABELS: Record<Tab, string> = {
  ALL: "All", OPEN: "Open", ASSIGNED: "Assigned", COMPLETED: "Completed", CANCELLED: "Cancelled",
};

export function AssignmentsTable({ initial }: { initial: Row[] }) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("ALL");
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

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: initial.length };
    for (const a of initial) counts[a.status] = (counts[a.status] ?? 0) + 1;
    return counts;
  }, [initial]);

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="space-y-3 rounded-xl border border-zinc-200/80 bg-white p-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, client, language, location…"
            className="h-9 rounded-lg pl-9 text-sm"
          />
        </div>

        {/* Tabs + mode filter */}
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
          <div className="h-5 w-px bg-zinc-200 mx-1" />
          {(["ALL", "IN_PERSON", "REMOTE_ALL"] as const).map((m) => {
            const MIcon = m === "IN_PERSON" ? Building2 : m === "REMOTE_ALL" ? Monitor : null;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setModeFilter(m)}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-all",
                  modeFilter === m
                    ? "bg-zinc-950 text-white shadow-sm"
                    : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                )}
              >
                {MIcon && <MIcon className="size-3.5" />}
                {m === "ALL" ? "All modes" : m === "IN_PERSON" ? "In-person" : "Remote"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/80 text-left">
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Assignment
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Schedule
                </th>
                <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Filled
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Pay
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
                        <Search className="size-4 text-zinc-400" />
                      </div>
                      <p className="text-sm font-medium text-zinc-900">No assignments match</p>
                      <p className="text-xs text-zinc-500">Try a different filter or search term.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((a) => {
                  const DelivIcon = DELIVERY_ICON[a.deliveryMode] ?? Building2;
                  const isFull = a.assignedCount >= a.interpretersNeeded;
                  return (
                    <tr key={a.id} className="group transition-colors hover:bg-zinc-50/70">
                      {/* Assignment */}
                      <td className="max-w-xs px-4 py-4">
                        <Link href={`/admin/assignments/${a.id}`} className="block">
                          <div className="mb-1 flex items-center gap-2">
                            {a.isUrgent && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold text-rose-700">
                                <Zap className="size-2.5" />
                                URGENT
                              </span>
                            )}
                            <span className="font-semibold leading-tight text-zinc-950 group-hover:text-primary transition-colors">
                              {a.title}
                            </span>
                          </div>
                          <p className="truncate text-xs text-zinc-500">
                            {a.clientName}
                            {a.clientOrganization && (
                              <span className="text-zinc-400"> · {a.clientOrganization}</span>
                            )}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-md border border-zinc-100 bg-zinc-50 px-1.5 py-0.5 text-[11px] text-zinc-500">
                              <DelivIcon className="size-3" />
                              {DELIVERY_LABEL[a.deliveryMode] ?? a.deliveryMode}
                            </span>
                            <span className="text-[11px] text-zinc-400">{a.languagePair}</span>
                            <span className="text-[11px] text-zinc-300">·</span>
                            <span className="text-[11px] text-zinc-400">{a.assignmentType}</span>
                            {a.requiredCertifications.length > 0 && (
                              <span className="rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                                Cert req.
                              </span>
                            )}
                            {a.visibilityMode === "RESTRICTED" && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-600">
                                <Lock className="size-2.5" />
                                Restricted
                              </span>
                            )}
                          </div>
                        </Link>
                      </td>

                      {/* Schedule */}
                      <td className="px-4 py-4">
                        <p className="text-sm font-medium text-zinc-900">{fmt(a.scheduledStart)}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">→ {fmt(a.scheduledEnd)}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-400">
                          <Clock className="size-3" />
                          {dur(a.scheduledStart, a.scheduledEnd)}
                        </p>
                      </td>

                      {/* Filled */}
                      <td className="px-4 py-4 text-center">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
                          isFull ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                        )}>
                          {isFull && <CheckCircle2 className="size-3" />}
                          <Users className="size-3" />
                          {a.assignedCount}/{a.interpretersNeeded}
                        </span>
                      </td>

                      {/* Pay */}
                      <td className="px-4 py-4">
                        {a.isCompensationVisible && a.compensationRate != null ? (
                          <span className="flex items-center gap-1 text-sm font-semibold text-emerald-700">
                            <DollarSign className="size-3.5" />
                            {a.compensationRate.toFixed(0)}
                            {a.compensationUnit && (
                              <span className="text-xs font-normal text-zinc-400">
                                /{a.compensationUnit.replace("per ", "")}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-xs italic text-zinc-300">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <span className={cn(
                            "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                            STATUS_STYLE[a.status]
                          )}>
                            {a.status}
                          </span>
                          <Link
                            href={`/admin/assignments/${a.id}`}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ArrowUpRight className="size-4 text-zinc-400 hover:text-zinc-700" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="border-t border-zinc-100 bg-zinc-50/50 px-4 py-2.5">
            <p className="text-xs text-zinc-400">
              Showing <span className="font-medium text-zinc-600">{filtered.length}</span> of {initial.length} assignments
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
