// app/interpreter/jobs/[id]/ui.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { requestAssignmentAction, withdrawFromAssignmentAction } from "../actions";

// ─── types ────────────────────────────────────────────────────────────────────

type EligibilityIssue = { field: string; required: string; yours: string };

type Job = {
  id: string;
  title: string;
  clientName: string;
  clientOrganization: string | null;
  languagePair: string;
  assignmentType: string;
  deliveryMode: string;
  scheduledStart: string;
  scheduledEnd: string;
  timezone: string;
  location: string;
  address: string | null;
  roomFloor: string | null;
  parkingNotes: string | null;
  accessInstructions: string | null;
  dresscode: string | null;
  meetingLink: string | null;
  meetingPassword: string | null;
  platformNotes: string | null;
  interpretersNeeded: number;
  assignedCount: number;
  status: string;
  isUrgent: boolean;
  requiredLanguagePair: string | null;
  requiredCertifications: string[];
  requiredExperienceYears: number | null;
  requiredModes: string[];
  compensationRate: number | null;
  compensationUnit: string | null;
  compensationNotes: string | null;
  isCompensationVisible: boolean;
  specialNotes: string | null;
  myStatus: "ASSIGNED" | "REMOVED" | null;
  myAssignedAt: string | null;
  isFull: boolean;
  hasAvailability: boolean;
  eligibilityIssues: EligibilityIssue[];
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
    ...opts,
  });
}

function duration(start: string, end: string) {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.round((diff % 3600000) / 60000);
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
}

const DELIVERY_LABELS: Record<string, string> = {
  IN_PERSON:    "In-person",
  REMOTE:       "Remote (phone)",
  VIDEO_RELAY:  "Video relay (VRS)",
  VIDEO_REMOTE: "Video remote (VRI)",
};

const DELIVERY_ICONS: Record<string, string> = {
  IN_PERSON:    "🏢",
  REMOTE:       "📞",
  VIDEO_RELAY:  "📺",
  VIDEO_REMOTE: "💻",
};

// ─── small ui primitives ──────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-4">
      {children}
    </h3>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
      <span className="w-40 shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400 pt-0.5">{label}</span>
      <span className={`flex-1 text-sm text-zinc-900 dark:text-zinc-100 leading-relaxed ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function Pill({ children, color = "zinc" }: {
  children: React.ReactNode;
  color?: "zinc" | "sky" | "emerald" | "amber" | "rose" | "violet";
}) {
  const cls = {
    zinc:    "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
    sky:     "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    amber:   "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    rose:    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
    violet:  "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800",
  }[color];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>
      {children}
    </div>
  );
}

// ─── eligibility panel ────────────────────────────────────────────────────────

function EligibilityPanel({
  issues,
  hasAvailability,
  isFull,
  myStatus,
}: {
  issues: EligibilityIssue[];
  hasAvailability: boolean;
  isFull: boolean;
  myStatus: "ASSIGNED" | "REMOVED" | null;
}) {
  if (myStatus === "ASSIGNED") {
    return (
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950">
            <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-white">You're assigned</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              You're confirmed for this assignment. Review the details below.
            </div>
          </div>
        </div>
      </Card>
    );
  }

  const allClear = issues.length === 0 && hasAvailability && !isFull;
  const blockingIssues = [
    ...issues,
    ...(!hasAvailability ? [{ field: "Availability", required: "Must be set for this time window", yours: "No slot found — update your availability" }] : []),
    ...(isFull ? [{ field: "Capacity", required: "Open spot required", yours: "Assignment is fully staffed" }] : []),
  ];

  if (allClear) {
    return (
      <Card className="p-5 border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950">
            <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">You're eligible</div>
            <div className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
              Your profile meets all requirements and you have availability set. You can pick this job.
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5 border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
      <div className="flex items-start gap-3 mb-4">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950">
          <svg className="h-4 w-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            {isFull ? "Assignment full" : "Requirements not met"}
          </div>
          <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
            {isFull
              ? "This assignment has no open spots."
              : "Your profile is missing the following requirements."}
          </div>
        </div>
      </div>

      {!isFull && (
        <div className="space-y-2.5">
          {blockingIssues.map((issue) => (
            <div key={issue.field} className="rounded-xl border border-amber-200 bg-white/60 px-4 py-3 dark:border-amber-900 dark:bg-zinc-900/60">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{issue.field}</span>
                <a href="/interpreter/profile" className="text-xs font-medium text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200 underline underline-offset-2">
                  Update profile →
                </a>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-zinc-500 dark:text-zinc-500">Required: </span>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">{issue.required}</span>
                </div>
                <div>
                  <span className="text-zinc-500 dark:text-zinc-500">Yours: </span>
                  <span className="font-medium text-amber-700 dark:text-amber-400">{issue.yours}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── main client component ────────────────────────────────────────────────────

export function JobDetailClient({ job }: { job: Job }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [myStatus, setMyStatus] = useState(job.myStatus);
  const [assignedCount, setAssignedCount] = useState(job.assignedCount);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);

  const isFull = assignedCount >= job.interpretersNeeded;
  const isAssigned = myStatus === "ASSIGNED";
  const isOpen = job.status === "OPEN" || job.status === "ASSIGNED";
  const canPick = isOpen && !isFull && !isAssigned && job.eligibilityIssues.length === 0 && job.hasAvailability;

  function handlePick() {
    startTransition(async () => {
      const res = await requestAssignmentAction(job.id);
      if (res.ok) {
        setMyStatus("ASSIGNED");
        setAssignedCount((c) => c + 1);
        toast.success("Assignment picked!", { description: "You've been added to this assignment." });
      } else {
        toast.error("Couldn't pick job", { description: res.error });
      }
    });
  }

  function handleWithdraw() {
    startTransition(async () => {
      const res = await withdrawFromAssignmentAction(job.id);
      if (res.ok) {
        setMyStatus("REMOVED");
        setAssignedCount((c) => Math.max(0, c - 1));
        setConfirmWithdraw(false);
        toast("Withdrawn", { description: "You've been removed from this assignment." });
        router.push("/interpreter/jobs");
      } else {
        toast.error("Couldn't withdraw", { description: res.error });
      }
    });
  }

  const isRemote = ["REMOTE", "VIDEO_RELAY", "VIDEO_REMOTE"].includes(job.deliveryMode);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">

      {/* ── Left column: all details ──────────────────────────────────────── */}
      <div className="space-y-5 min-w-0">

        {/* Header card */}
        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {job.isUrgent && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                    🔴 Urgent
                  </span>
                )}
                <Pill color={job.status === "OPEN" ? "sky" : "emerald"}>{job.status}</Pill>
                <Pill color="zinc">{DELIVERY_ICONS[job.deliveryMode]} {DELIVERY_LABELS[job.deliveryMode] ?? job.deliveryMode}</Pill>
                {isAssigned && <Pill color="emerald">✓ Assigned to you</Pill>}
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-white leading-tight">
                {job.title}
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {job.clientName}
                {job.clientOrganization && <span className="text-zinc-400"> · {job.clientOrganization}</span>}
              </p>
            </div>
            <div className={[
              "shrink-0 rounded-xl border px-3.5 py-2 text-center",
              isFull
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
                : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30",
            ].join(" ")}>
              <div className="text-lg font-bold tabular-nums text-zinc-900 dark:text-white">
                {assignedCount}/{job.interpretersNeeded}
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">filled</div>
            </div>
          </div>

          {/* Schedule summary */}
          <div className="grid gap-3 sm:grid-cols-3 rounded-xl border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50 p-4">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-1">Date</div>
              <div className="text-sm font-medium text-zinc-900 dark:text-white">
                {new Date(job.scheduledStart).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-1">Time</div>
              <div className="text-sm font-medium text-zinc-900 dark:text-white">
                {new Date(job.scheduledStart).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                {" – "}
                {new Date(job.scheduledEnd).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-1">Duration</div>
              <div className="text-sm font-medium text-zinc-900 dark:text-white">{duration(job.scheduledStart, job.scheduledEnd)}</div>
            </div>
          </div>
        </Card>

        {/* Job details */}
        <Card className="px-6 py-5">
          <SectionTitle>Assignment details</SectionTitle>
          <DetailRow label="Language pair" value={job.languagePair} />
          <DetailRow label="Type" value={job.assignmentType} />
          <DetailRow label="Delivery mode" value={`${DELIVERY_ICONS[job.deliveryMode]} ${DELIVERY_LABELS[job.deliveryMode] ?? job.deliveryMode}`} />
          <DetailRow label="Timezone" value={job.timezone} />
        </Card>

        {/* Location / Remote */}
        {!isRemote ? (
          <Card className="px-6 py-5">
            <SectionTitle>Location & access</SectionTitle>
            <DetailRow label="Location" value={job.location} />
            {job.address && <DetailRow label="Address" value={job.address} />}
            {job.roomFloor && <DetailRow label="Room / floor" value={job.roomFloor} />}
            {job.dresscode && <DetailRow label="Dress code" value={job.dresscode} />}
            {job.parkingNotes && <DetailRow label="Parking" value={job.parkingNotes} />}
            {job.accessInstructions && <DetailRow label="Access" value={job.accessInstructions} />}
            {!job.address && !job.roomFloor && !job.dresscode && !job.parkingNotes && !job.accessInstructions && (
              <p className="text-sm text-zinc-400 dark:text-zinc-500 py-2">No additional location details provided.</p>
            )}
          </Card>
        ) : (
          <Card className="px-6 py-5">
            <SectionTitle>Remote details</SectionTitle>
            {job.meetingLink ? (
              <DetailRow
                label="Meeting link"
                value={
                  <a href={job.meetingLink} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sky-600 hover:text-sky-700 dark:text-sky-400 underline underline-offset-2">
                    Join meeting ↗
                  </a>
                }
              />
            ) : (
              <DetailRow label="Meeting link" value={<span className="text-zinc-400 italic">To be provided</span>} />
            )}
            {job.meetingPassword && <DetailRow label="Password" value={job.meetingPassword} mono />}
            {job.platformNotes && <DetailRow label="Platform notes" value={job.platformNotes} />}
          </Card>
        )}

        {/* Requirements */}
        {(job.requiredCertifications.length > 0 || job.requiredLanguagePair || job.requiredExperienceYears != null || job.requiredModes.length > 0) && (
          <Card className="px-6 py-5">
            <SectionTitle>Requirements</SectionTitle>
            {job.requiredLanguagePair && (
              <DetailRow label="Language pair" value={job.requiredLanguagePair} />
            )}
            {job.requiredCertifications.length > 0 && (
              <DetailRow
                label="Certification"
                value={
                  <div className="flex flex-wrap gap-1.5">
                    {job.requiredCertifications.map((c) => <Pill key={c} color="violet">{c}</Pill>)}
                    <span className="text-xs text-zinc-400">(need at least one)</span>
                  </div>
                }
              />
            )}
            {job.requiredExperienceYears != null && (
              <DetailRow label="Experience" value={`${job.requiredExperienceYears}+ years`} />
            )}
            {job.requiredModes.length > 0 && (
              <DetailRow
                label="Modality"
                value={
                  <div className="flex flex-wrap gap-1.5">
                    {job.requiredModes.map((m) => <Pill key={m} color="sky">{DELIVERY_LABELS[m] ?? m}</Pill>)}
                  </div>
                }
              />
            )}
          </Card>
        )}

        {/* Compensation */}
        {job.isCompensationVisible && (job.compensationRate != null || job.compensationNotes) && (
          <Card className="px-6 py-5">
            <SectionTitle>Compensation</SectionTitle>
            {job.compensationRate != null && (
              <DetailRow
                label="Rate"
                value={
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    ${job.compensationRate.toFixed(2)}
                    {job.compensationUnit && <span className="font-normal text-zinc-500 dark:text-zinc-400"> {job.compensationUnit}</span>}
                  </span>
                }
              />
            )}
            {job.compensationNotes && <DetailRow label="Notes" value={job.compensationNotes} />}
          </Card>
        )}

        {/* Special notes (only if assigned) */}
        {job.specialNotes && isAssigned && (
          <Card className="px-6 py-5 border-sky-200 bg-sky-50/40 dark:border-sky-800 dark:bg-sky-950/20">
            <SectionTitle>Notes from admin</SectionTitle>
            <p className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">
              {job.specialNotes}
            </p>
          </Card>
        )}

      </div>

      {/* ── Right column: sticky action panel ────────────────────────────── */}
      <div className="lg:sticky lg:top-6 self-start space-y-4">

        {/* Eligibility */}
        <EligibilityPanel
          issues={job.eligibilityIssues}
          hasAvailability={job.hasAvailability}
          isFull={isFull}
          myStatus={myStatus}
        />

        {/* CTA card */}
        {isOpen && (
          <Card className="p-5">
            {isAssigned ? (
              <div className="space-y-3">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  Assigned{job.myAssignedAt ? ` on ${new Date(job.myAssignedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}.
                  {" "}Withdrawing before the job starts will log an audit event.
                </div>
                {!confirmWithdraw ? (
                  <button
                    type="button"
                    onClick={() => setConfirmWithdraw(true)}
                    className="w-full rounded-xl border border-rose-200 bg-white py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors dark:border-rose-800 dark:bg-zinc-900 dark:text-rose-400"
                  >
                    Withdraw from assignment
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Are you sure? This can't be undone.</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmWithdraw(false)}
                        className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleWithdraw}
                        disabled={isPending}
                        className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 transition-colors disabled:opacity-60"
                      >
                        {isPending ? "Withdrawing…" : "Yes, withdraw"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {canPick
                    ? "Your profile meets all requirements. Picking this job will add you immediately."
                    : "Resolve the issues above before picking this job."}
                </div>
                <button
                  type="button"
                  onClick={handlePick}
                  disabled={isPending || !canPick}
                  className={[
                    "w-full rounded-xl py-3 text-sm font-semibold transition-all",
                    canPick && !isPending
                      ? "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                      : "bg-zinc-100 text-zinc-400 cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-600",
                  ].join(" ")}
                >
                  {isPending ? "Picking…" : canPick ? "Pick this job" : "Not eligible"}
                </button>
              </div>
            )}
          </Card>
        )}

        {/* Quick facts */}
        <Card className="p-5 space-y-3">
          <SectionTitle>Quick info</SectionTitle>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500">Client</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100 text-right max-w-[160px] truncate">{job.clientName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Language</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{job.languagePair}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Type</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{job.assignmentType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Duration</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{duration(job.scheduledStart, job.scheduledEnd)}</span>
            </div>
            {job.isCompensationVisible && job.compensationRate != null && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Rate</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  ${job.compensationRate.toFixed(2)}{job.compensationUnit ? ` ${job.compensationUnit}` : ""}
                </span>
              </div>
            )}
          </div>
        </Card>

      </div>
    </div>
  );
}