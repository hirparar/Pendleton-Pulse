// app/interpreter/jobs/ui.tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { requestAssignmentAction, withdrawFromAssignmentAction } from "./actions";

type Job = {
  id: string;
  title: string;
  clientName: string;
  clientOrganization: string | null;
  languagePair: string;
  assignmentType: string;
  deliveryMode: string;
  location: string;
  scheduledStart: string;
  scheduledEnd: string;
  interpretersNeeded: number;
  assignedCount: number;
  status: "OPEN" | "ASSIGNED";
  isUrgent: boolean;
  compensationRate: number | null;
  compensationUnit: string | null;
  isCompensationVisible: boolean;
  requiredCertifications: string[];
  requiredExperienceYears: number | null;
  requiredLanguagePair: string | null;
  myStatus: "ASSIGNED" | "REMOVED" | null;
  // eligibility pre-computed server-side
  eligibilityIssues: { field: string }[];
  hasAvailability: boolean;
};

type Slot = { date: string; startMin: number; endMin: number };

const DELIVERY_ICONS: Record<string, string> = {
  IN_PERSON:    "🏢",
  REMOTE:       "📞",
  VIDEO_RELAY:  "📺",
  VIDEO_REMOTE: "💻",
};

const DELIVERY_LABELS: Record<string, string> = {
  IN_PERSON:    "In-person",
  REMOTE:       "Remote",
  VIDEO_RELAY:  "VRS",
  VIDEO_REMOTE: "VRI",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function duration(start: string, end: string) {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.round((diff % 3600000) / 60000);
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
}

function TabChip({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick}
      className={[
        "h-9 rounded-full px-4 text-sm font-medium transition-colors",
        active
          ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
          : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
      ].join(" ")}>
      {children}
    </button>
  );
}

function JobCard({ job, onPick, onWithdraw, isPending }: {
  job: Job;
  onPick: (id: string) => void;
  onWithdraw: (id: string) => void;
  isPending: boolean;
}) {
  const isAssigned = job.myStatus === "ASSIGNED";
  const isFull = job.assignedCount >= job.interpretersNeeded;
  const isBlocked = job.eligibilityIssues.length > 0 || !job.hasAvailability;
  const canPick = !isAssigned && !isFull && !isBlocked;

  return (
    <div className={[
      "group relative rounded-2xl border bg-white dark:bg-zinc-900 transition-all",
      isAssigned
        ? "border-emerald-200 dark:border-emerald-800"
        : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm",
    ].join(" ")}>
      {/* urgent stripe */}
      {job.isUrgent && (
        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-rose-500" />
      )}

      <div className="p-5 pl-6">
        <div className="flex items-start justify-between gap-4">
          {/* left */}
          <div className="min-w-0 flex-1 space-y-2">
            {/* badges row */}
            <div className="flex flex-wrap items-center gap-1.5">
              {job.isUrgent && (
                <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                  URGENT
                </span>
              )}
              <span className={[
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                job.status === "OPEN"
                  ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
              ].join(" ")}>
                {job.status}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                {DELIVERY_ICONS[job.deliveryMode]} {DELIVERY_LABELS[job.deliveryMode] ?? job.deliveryMode}
              </span>
              {isAssigned && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  ✓ Assigned
                </span>
              )}
            </div>

            {/* title */}
            <div className="text-sm font-semibold text-zinc-900 dark:text-white leading-tight">
              {job.title}
            </div>

            {/* meta */}
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {job.clientName}
              {job.clientOrganization && <span className="text-zinc-400"> · {job.clientOrganization}</span>}
              {" · "}{job.languagePair}{" · "}{job.assignmentType}
            </div>

            {/* schedule */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600 dark:text-zinc-300">
              <span>🗓 {fmt(job.scheduledStart)}</span>
              <span className="text-zinc-400 dark:text-zinc-500">·</span>
              <span className="text-zinc-400">{duration(job.scheduledStart, job.scheduledEnd)}</span>
              {["IN_PERSON", "REMOTE"].includes(job.deliveryMode) && job.location && (
                <>
                  <span className="text-zinc-400 dark:text-zinc-500">·</span>
                  <span>📍 {job.location}</span>
                </>
              )}
            </div>

            {/* blocking issues summary */}
            {!isAssigned && isBlocked && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {!job.hasAvailability && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                    ⚠ No availability
                  </span>
                )}
                {job.eligibilityIssues.map((i) => (
                  <span key={i.field} className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                    ⚠ Missing: {i.field}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* right */}
          <div className="shrink-0 flex flex-col items-end gap-2.5" onClick={(e) => e.stopPropagation()}>
            {/* fill badge */}
            <span className={[
              "rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums",
              isFull
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
            ].join(" ")}>
              {job.assignedCount}/{job.interpretersNeeded}
            </span>

            {/* compensation */}
            {job.isCompensationVisible && job.compensationRate != null && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                ${job.compensationRate.toFixed(0)}{job.compensationUnit ? `/${job.compensationUnit.replace("per ", "")}` : ""}
              </span>
            )}

            {/* actions */}
            <div className="flex items-center gap-2 mt-1">
              <Link
                href={`/interpreter/jobs/${job.id}`}
                className="inline-flex h-9 items-center rounded-xl border border-zinc-200 bg-white px-3.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                View details
              </Link>

              {isAssigned ? (
                <button type="button" disabled={isPending} onClick={() => onWithdraw(job.id)}
                  className="inline-flex h-9 items-center rounded-xl border border-rose-200 bg-white px-3.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50 dark:border-rose-800 dark:bg-zinc-800 dark:text-rose-400">
                  Withdraw
                </button>
              ) : (
                <button type="button" disabled={isPending || !canPick} onClick={() => canPick && onPick(job.id)}
                  title={
                    isFull ? "Assignment is full"
                      : !job.hasAvailability ? "No availability set"
                      : job.eligibilityIssues.length > 0 ? "Requirements not met — view details"
                      : undefined
                  }
                  className={[
                    "inline-flex h-9 items-center rounded-xl px-3.5 text-xs font-semibold transition-colors",
                    canPick && !isPending
                      ? "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                      : "cursor-not-allowed bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600",
                  ].join(" ")}>
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

export function JobFeed({
  jobs: initialJobs,
  availabilitySlots,
}: {
  jobs: Job[];
  availabilitySlots: Slot[];
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

  const myCount   = jobs.filter((j) => j.myStatus === "ASSIGNED").length;
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

  function handleWithdraw(id: string) {
    startTransition(async () => {
      const res = await withdrawFromAssignmentAction(id);
      if (res.ok) {
        const job = jobs.find((j) => j.id === id);
        patchJob(id, { myStatus: "REMOVED", assignedCount: Math.max(0, (job?.assignedCount ?? 1) - 1) });
        toast("Withdrawn", { description: "You've been removed from this assignment." });
      } else {
        toast.error("Couldn't withdraw", { description: res.error });
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* urgent banner */}
      {urgentCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-800 dark:bg-rose-950/30">
          <span className="text-lg">🔴</span>
          <p className="text-sm font-medium text-rose-800 dark:text-rose-300">
            {urgentCount} urgent assignment{urgentCount > 1 ? "s" : ""} need{urgentCount === 1 ? "s" : ""} coverage
          </p>
        </div>
      )}

      {/* controls */}
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search language, client, type, location…"
          className="h-10 w-full max-w-sm rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-400 focus:bg-white transition-colors dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
        />
        <div className="flex flex-wrap gap-2">
          <TabChip active={tab === "ALL"} onClick={() => setTab("ALL")}>All ({jobs.length})</TabChip>
          <TabChip active={tab === "OPEN"} onClick={() => setTab("OPEN")}>Available ({openCount})</TabChip>
          <TabChip active={tab === "MINE"} onClick={() => setTab("MINE")}>Mine ({myCount})</TabChip>
        </div>
      </div>

      {/* feed */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700 px-6 py-16 text-center">
          <p className="text-sm font-medium text-zinc-900 dark:text-white mb-1">
            {jobs.length === 0 ? "No jobs available" : "No jobs match your filter"}
          </p>
          <p className="text-xs text-zinc-400">
            {jobs.length === 0
              ? "New assignments appear here when admins post them."
              : "Try clearing your search or switching tabs."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((job) => (
            <JobCard key={job.id} job={job} onPick={handlePick} onWithdraw={handleWithdraw} isPending={isPending} />
          ))}
        </div>
      )}
    </div>
  );
}