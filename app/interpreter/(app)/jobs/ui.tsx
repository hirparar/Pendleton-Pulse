// app/interpreter/jobs/ui.tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { requestAssignmentAction } from "./actions";
import {
  Building2, Phone, Tv2, Monitor, MapPin, Calendar,
  Clock, Zap, CheckCircle2, AlertTriangle, Loader2,
  Search, ArrowUpRight, DollarSign, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type Job = {
  id: string; title: string; clientName: string; clientOrganization: string | null;
  languagePair: string; assignmentType: string; deliveryMode: string;
  location: string; scheduledStart: string; scheduledEnd: string;
  interpretersNeeded: number; assignedCount: number;
  status: "OPEN" | "ASSIGNED"; isUrgent: boolean;
  compensationRate: number | null; compensationUnit: string | null;
  isCompensationVisible: boolean; requiredCertifications: string[];
  requiredExperienceYears: number | null; requiredLanguagePair: string | null;
  myStatus: "ASSIGNED" | "REMOVED" | null;
  eligibilityIssues: { field: string }[];
  hasAvailability: boolean;
};

type Slot = { date: string; startMin: number; endMin: number };

const DELIVERY_ICON: Record<string, React.ElementType> = {
  IN_PERSON: Building2, REMOTE: Phone, VIDEO_RELAY: Tv2, VIDEO_REMOTE: Monitor,
};
const DELIVERY_LABEL: Record<string, string> = {
  IN_PERSON: "In-person", REMOTE: "Remote", VIDEO_RELAY: "VRS", VIDEO_REMOTE: "VRI",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}
function dur(start: string, end: string) {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.round((diff % 3600000) / 60000);
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
}

function JobCard({ job, onPick, isPending }: {
  job: Job; onPick: (id: string) => void; isPending: boolean;
}) {
  const isAssigned = job.myStatus === "ASSIGNED";
  const isFull = job.assignedCount >= job.interpretersNeeded;
  const isBlocked = job.eligibilityIssues.length > 0 || !job.hasAvailability;
  const canPick = !isAssigned && !isFull && !isBlocked;
  const DelivIcon = DELIVERY_ICON[job.deliveryMode] ?? Building2;

  return (
    <div className={cn(
      "group relative overflow-hidden rounded-xl border bg-white transition-all",
      isAssigned
        ? "border-emerald-200 shadow-[0_0_0_1px_rgba(16,185,129,0.1)]"
        : "border-zinc-200/80 hover:border-zinc-300 hover:shadow-sm"
    )}>
      {/* Urgent accent bar */}
      {job.isUrgent && (
        <div className="absolute inset-y-0 left-0 w-0.5 bg-rose-500" />
      )}

      <div className={cn("p-5", job.isUrgent && "pl-6")}>
        <div className="flex items-start justify-between gap-4">
          {/* Left content */}
          <div className="min-w-0 flex-1 space-y-2.5">
            {/* Badge row */}
            <div className="flex flex-wrap items-center gap-1.5">
              {job.isUrgent && (
                <span className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                  <Zap className="size-2.5" />
                  URGENT
                </span>
              )}
              <span className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                job.status === "OPEN"
                  ? "border-sky-200 bg-sky-50 text-sky-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              )}>
                {job.status}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                <DelivIcon className="size-3" />
                {DELIVERY_LABEL[job.deliveryMode] ?? job.deliveryMode}
              </span>
              {isAssigned && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  <CheckCircle2 className="size-3" />
                  Assigned
                </span>
              )}
            </div>

            {/* Title */}
            <p className="text-sm font-semibold leading-snug text-zinc-900">
              {job.title}
            </p>

            {/* Meta */}
            <p className="text-xs text-zinc-500">
              {job.clientName}
              {job.clientOrganization && (
                <span className="text-zinc-400"> · {job.clientOrganization}</span>
              )}
              {" · "}{job.languagePair}{" · "}{job.assignmentType}
            </p>

            {/* Schedule + location */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <Calendar className="size-3" />
                {fmt(job.scheduledStart)}
              </span>
              <span className="flex items-center gap-1 text-zinc-400">
                <Clock className="size-3" />
                {dur(job.scheduledStart, job.scheduledEnd)}
              </span>
              {["IN_PERSON", "REMOTE"].includes(job.deliveryMode) && job.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3" />
                  {job.location}
                </span>
              )}
            </div>

            {/* Blocking issues */}
            {!isAssigned && isBlocked && (
              <div className="flex flex-wrap gap-1.5">
                {!job.hasAvailability && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                    <AlertTriangle className="size-3" />
                    No availability
                  </span>
                )}
                {job.eligibilityIssues.map((i) => (
                  <span key={i.field} className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                    <AlertTriangle className="size-3" />
                    Missing: {i.field}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Right panel */}
          <div className="flex shrink-0 flex-col items-end gap-2" onClick={(e) => e.stopPropagation()}>
            {/* Fill indicator */}
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums",
              isFull ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            )}>
              <Users className="size-3" />
              {job.assignedCount}/{job.interpretersNeeded}
            </span>

            {/* Compensation */}
            {job.isCompensationVisible && job.compensationRate != null && (
              <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600">
                <DollarSign className="size-3" />
                {job.compensationRate.toFixed(0)}
                {job.compensationUnit ? `/${job.compensationUnit.replace("per ", "")}` : ""}
              </span>
            )}

            {/* Actions */}
            <div className="mt-1 flex items-center gap-2">
              <Link
                href={`/interpreter/jobs/${job.id}`}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                Details
                <ArrowUpRight className="size-3 opacity-60" />
              </Link>

              {!isAssigned && (
                <button
                  type="button"
                  disabled={isPending || !canPick}
                  onClick={() => canPick && onPick(job.id)}
                  title={
                    isFull ? "Assignment is full"
                      : !job.hasAvailability ? "No availability set"
                      : job.eligibilityIssues.length > 0 ? "Requirements not met"
                      : undefined
                  }
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition",
                    canPick && !isPending
                      ? "bg-zinc-950 text-white hover:bg-zinc-800"
                      : "cursor-not-allowed bg-zinc-100 text-zinc-400"
                  )}
                >
                  {isPending ? <Loader2 className="size-3 animate-spin" /> : null}
                  {isFull ? "Full" : isBlocked ? "Ineligible" : "Pick job"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function JobFeed({ jobs: initialJobs, availabilitySlots }: {
  jobs: Job[]; availabilitySlots: Slot[];
}) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"ALL" | "OPEN" | "MINE">("ALL");
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return jobs.filter((j) => {
      if (tab === "OPEN" && (j.status !== "OPEN" || j.myStatus === "ASSIGNED")) return false;
      if (tab === "MINE" && j.myStatus !== "ASSIGNED") return false;
      if (!query) return true;
      return (
        j.title.toLowerCase().includes(query) ||
        j.clientName.toLowerCase().includes(query) ||
        j.languagePair.toLowerCase().includes(query) ||
        j.assignmentType.toLowerCase().includes(query) ||
        j.location.toLowerCase().includes(query)
      );
    });
  }, [jobs, q, tab]);

  const myCount = jobs.filter((j) => j.myStatus === "ASSIGNED").length;
  const openCount = jobs.filter((j) => j.status === "OPEN" && j.myStatus !== "ASSIGNED").length;
  const urgentCount = jobs.filter((j) => j.isUrgent && j.status === "OPEN" && j.myStatus !== "ASSIGNED").length;

  function patchJob(id: string, patch: Partial<Job>) {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }

  function handlePick(id: string) {
    startTransition(async () => {
      const res = await requestAssignmentAction(id);
      if (res.ok) {
        const job = jobs.find((j) => j.id === id);
        patchJob(id, { myStatus: "ASSIGNED", assignedCount: (job?.assignedCount ?? 0) + 1 });
        toast.success("Job picked!", { description: "You've been added to this assignment." });
      } else {
        toast.error("Couldn't pick job", { description: res.error });
      }
    });
  }

  const tabs = [
    { id: "ALL" as const, label: "All", count: jobs.length },
    { id: "OPEN" as const, label: "Available", count: openCount },
    { id: "MINE" as const, label: "Mine", count: myCount },
  ];

  return (
    <div className="space-y-4">
      {/* Urgent banner */}
      {urgentCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-rose-100">
            <Zap className="size-4 text-rose-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-rose-800">
              {urgentCount} urgent assignment{urgentCount > 1 ? "s" : ""} need{urgentCount === 1 ? "s" : ""} coverage
            </p>
            <p className="text-xs text-rose-600">Act quickly — urgent jobs are time-sensitive.</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200/80 bg-white p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search language, client, type, location…"
            className="h-9 rounded-lg pl-9 text-sm"
          />
        </div>
        <div className="flex gap-1.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "h-8 rounded-lg px-3 text-xs font-medium transition-all",
                tab === t.id
                  ? "bg-zinc-950 text-white shadow-sm"
                  : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
              )}
            >
              {t.label}
              <span className={cn("ml-1.5 tabular-nums", tab === t.id ? "opacity-70" : "text-zinc-400")}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Job list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 py-16">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-zinc-200 bg-zinc-50">
            <Search className="size-5 text-zinc-400" />
          </div>
          <p className="mt-3 text-sm font-semibold text-zinc-900">
            {jobs.length === 0 ? "No jobs available" : "No jobs match your filter"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {jobs.length === 0
              ? "New assignments will appear here as admins post them."
              : "Try clearing your search or switching tabs."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onPick={handlePick}
              isPending={isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
