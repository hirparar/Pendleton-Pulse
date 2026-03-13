// app/interpreter/jobs/[id]/ui.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { requestAssignmentAction } from "../actions";
import {
  Building2, Phone, Tv2, Monitor, MapPin, Calendar, Clock,
  Zap, CheckCircle2, AlertTriangle, Loader2, Users, DollarSign,
  ExternalLink, Languages, ArrowLeft, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

type EligibilityIssue = { field: string; required: string; yours: string };

type Job = {
  id: string; title: string; clientName: string; clientOrganization: string | null;
  languagePair: string; assignmentType: string; deliveryMode: string;
  scheduledStart: string; scheduledEnd: string; timezone: string;
  location: string; address: string | null; roomFloor: string | null;
  parkingNotes: string | null; accessInstructions: string | null;
  dresscode: string | null; meetingLink: string | null;
  meetingPassword: string | null; platformNotes: string | null;
  interpretersNeeded: number; assignedCount: number; status: string;
  isUrgent: boolean; requiredLanguagePair: string | null;
  requiredCertifications: string[]; requiredExperienceYears: number | null;
  requiredModes: string[]; compensationRate: number | null;
  compensationUnit: string | null; compensationNotes: string | null;
  isCompensationVisible: boolean; specialNotes: string | null;
  myStatus: "ASSIGNED" | "REMOVED" | null; myAssignedAt: string | null;
  isFull: boolean; hasAvailability: boolean;
  eligibilityIssues: EligibilityIssue[];
};

const DELIVERY_ICON: Record<string, React.ElementType> = {
  IN_PERSON: Building2, REMOTE: Phone
};
const DELIVERY_LABEL: Record<string, string> = {
  IN_PERSON: "In-person", REMOTE: "Remote (phone)",
};

function dur(start: string, end: string) {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.round((diff % 3600000) / 60000);
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white">
      <div className="border-b border-zinc-100 px-5 py-3.5">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start gap-4 border-b border-zinc-100 py-3 last:border-0">
      <span className="w-36 shrink-0 pt-0.5 text-xs font-medium text-zinc-500">{label}</span>
      <span className={cn("flex-1 text-sm leading-relaxed text-zinc-900", mono && "font-mono")}>
        {value}
      </span>
    </div>
  );
}

function Tag({ children, color = "zinc" }: {
  children: React.ReactNode;
  color?: "zinc" | "sky" | "emerald" | "amber" | "rose" | "violet";
}) {
  const cls = {
    zinc:    "bg-zinc-100 text-zinc-700 border-zinc-200",
    sky:     "bg-sky-50 text-sky-700 border-sky-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber:   "bg-amber-50 text-amber-700 border-amber-200",
    rose:    "bg-rose-50 text-rose-700 border-rose-200",
    violet:  "bg-violet-50 text-violet-700 border-violet-200",
  }[color];
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", cls)}>
      {children}
    </span>
  );
}

function EligibilityCard({
  issues, hasAvailability, isFull, myStatus,
}: {
  issues: EligibilityIssue[]; hasAvailability: boolean;
  isFull: boolean; myStatus: "ASSIGNED" | "REMOVED" | null;
}) {
  if (myStatus === "ASSIGNED") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-100">
          <CheckCircle2 className="size-4 text-emerald-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-emerald-800">You&apos;re assigned</p>
          <p className="mt-0.5 text-xs text-emerald-700">
            You&apos;re confirmed for this assignment. Review the details below.
          </p>
        </div>
      </div>
    );
  }

  const allClear = issues.length === 0 && hasAvailability && !isFull;
  const blocking = [
    ...issues,
    ...(!hasAvailability ? [{ field: "Availability", required: "Must be set for this time window", yours: "No slot found — update your availability" }] : []),
    ...(isFull ? [{ field: "Capacity", required: "Open spot required", yours: "Assignment is fully staffed" }] : []),
  ];

  if (allClear) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-100">
          <CheckCircle2 className="size-4 text-emerald-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-emerald-800">You&apos;re eligible</p>
          <p className="mt-0.5 text-xs text-emerald-700">
            Your profile meets all requirements and you have availability for this time.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <div className="mb-3 flex items-start gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-100">
          <AlertTriangle className="size-4 text-amber-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-amber-800">
            {isFull ? "Assignment full" : "Requirements not met"}
          </p>
          <p className="mt-0.5 text-xs text-amber-700">
            {isFull ? "No open spots remain." : "Update your profile to become eligible."}
          </p>
        </div>
      </div>

      {!isFull && (
        <div className="space-y-2">
          {blocking.map((issue) => (
            <div key={issue.field} className="rounded-lg border border-amber-200 bg-white/70 px-3 py-2.5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-800">{issue.field}</span>
                <Link
                  href="/interpreter/profile"
                  className="text-[10px] font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2"
                >
                  Update profile →
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-zinc-400">Required: </span>
                  <span className="font-medium text-zinc-800">{issue.required}</span>
                </div>
                <div>
                  <span className="text-zinc-400">Yours: </span>
                  <span className="font-medium text-amber-700">{issue.yours}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function JobDetailClient({ job }: { job: Job }) {
  const [isPending, startTransition] = useTransition();
  const [myStatus, setMyStatus] = useState(job.myStatus);
  const [assignedCount, setAssignedCount] = useState(job.assignedCount);

  const isFull = assignedCount >= job.interpretersNeeded;
  const isAssigned = myStatus === "ASSIGNED";
  const isOpen = job.status === "OPEN" || job.status === "ASSIGNED";
  const canPick = isOpen && !isFull && !isAssigned && job.eligibilityIssues.length === 0 && job.hasAvailability;
  const isRemote = ["REMOTE"].includes(job.deliveryMode);
  const DelivIcon = DELIVERY_ICON[job.deliveryMode] ?? Building2;

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

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      {/* Left: Details */}
      <div className="min-w-0 space-y-4">
        {/* Header card */}
        <div className="relative overflow-hidden rounded-xl border border-zinc-200/80 bg-white p-6">
          {job.isUrgent && (
            <div className="absolute inset-x-0 top-0 h-0.5 bg-rose-500" />
          )}

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {/* Badges */}
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                {job.isUrgent && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700">
                    <Zap className="size-3" />
                    Urgent
                  </span>
                )}
                <span className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                  job.status === "OPEN"
                    ? "border-sky-200 bg-sky-50 text-sky-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                )}>
                  {job.status}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                  <DelivIcon className="size-3" />
                  {DELIVERY_LABEL[job.deliveryMode] ?? job.deliveryMode}
                </span>
                {isAssigned && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="size-3" />
                    Assigned to you
                  </span>
                )}
              </div>

              <h1 className="text-xl font-semibold tracking-tight text-zinc-950 leading-snug">
                {job.title}
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                {job.clientName}
                {job.clientOrganization && (
                  <span className="text-zinc-400"> · {job.clientOrganization}</span>
                )}
              </p>
            </div>

            {/* Fill counter */}
            <div className={cn(
              "shrink-0 rounded-xl border px-4 py-3 text-center",
              isFull
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-200 bg-amber-50"
            )}>
              <p className="text-xl font-bold tabular-nums text-zinc-900">
                {assignedCount}/{job.interpretersNeeded}
              </p>
              <p className="text-[10px] font-medium text-zinc-500">filled</p>
            </div>
          </div>

          {/* Schedule grid */}
          <div className="mt-5 grid gap-4 rounded-xl border border-zinc-100 bg-zinc-50/60 p-4 sm:grid-cols-3">
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                <Calendar className="size-3" />
                Date
              </p>
              <p className="text-sm font-medium text-zinc-900">
                {new Date(job.scheduledStart).toLocaleDateString("en-US", {
                  weekday: "short", month: "short", day: "numeric", year: "numeric",
                })}
              </p>
            </div>
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                <Clock className="size-3" />
                Time
              </p>
              <p className="text-sm font-medium text-zinc-900">
                {new Date(job.scheduledStart).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                {" – "}
                {new Date(job.scheduledEnd).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </p>
            </div>
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                <Clock className="size-3" />
                Duration
              </p>
              <p className="text-sm font-medium text-zinc-900">
                {dur(job.scheduledStart, job.scheduledEnd)}
              </p>
            </div>
          </div>
        </div>

        {/* Assignment details */}
        <Section title="Assignment details">
          <Row label="Language pair" value={<span className="flex items-center gap-1.5"><Languages className="size-3.5 text-zinc-400" />{job.languagePair}</span>} />
          <Row label="Type" value={job.assignmentType} />
          <Row label="Delivery mode" value={<span className="flex items-center gap-1.5"><DelivIcon className="size-3.5 text-zinc-400" />{DELIVERY_LABEL[job.deliveryMode] ?? job.deliveryMode}</span>} />
          <Row label="Timezone" value={job.timezone} />
        </Section>

        {/* Location / Remote */}
        {!isRemote ? (
          <Section title="Location & access">
            <Row label="Location" value={<span className="flex items-center gap-1.5"><MapPin className="size-3.5 text-zinc-400" />{job.location}</span>} />
            {job.address && <Row label="Address" value={job.address} />}
            {job.roomFloor && <Row label="Room / floor" value={job.roomFloor} />}
            {job.dresscode && <Row label="Dress code" value={job.dresscode} />}
            {job.parkingNotes && <Row label="Parking" value={job.parkingNotes} />}
            {job.accessInstructions && <Row label="Access" value={job.accessInstructions} />}
            {!job.address && !job.roomFloor && !job.dresscode && !job.parkingNotes && !job.accessInstructions && (
              <p className="text-sm text-zinc-400">No additional location details provided.</p>
            )}
          </Section>
        ) : (
          <Section title="Remote details">
            {job.meetingLink ? (
              <Row
                label="Meeting link"
                value={
                  <a
                    href={job.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-primary underline underline-offset-2 hover:text-primary/80"
                  >
                    Join meeting
                    <ExternalLink className="size-3.5" />
                  </a>
                }
              />
            ) : (
              <Row label="Meeting link" value={<span className="italic text-zinc-400">To be provided</span>} />
            )}
            {job.meetingPassword && <Row label="Password" value={job.meetingPassword} mono />}
            {job.platformNotes && <Row label="Platform notes" value={job.platformNotes} />}
          </Section>
        )}

        {/* Requirements */}
        {(job.requiredCertifications.length > 0 || job.requiredLanguagePair || job.requiredExperienceYears != null || job.requiredModes.length > 0) && (
          <Section title="Requirements">
            {job.requiredLanguagePair && <Row label="Language pair" value={job.requiredLanguagePair} />}
            {job.requiredCertifications.length > 0 && (
              <Row
                label="Certification"
                value={
                  <div className="flex flex-wrap gap-1.5">
                    {job.requiredCertifications.map((c) => <Tag key={c} color="violet">{c}</Tag>)}
                    <span className="text-xs text-zinc-400">(need at least one)</span>
                  </div>
                }
              />
            )}
            {job.requiredExperienceYears != null && (
              <Row label="Experience" value={`${job.requiredExperienceYears}+ years`} />
            )}
            {job.requiredModes.length > 0 && (
              <Row
                label="Modality"
                value={
                  <div className="flex flex-wrap gap-1.5">
                    {job.requiredModes.map((m) => <Tag key={m} color="sky">{DELIVERY_LABEL[m] ?? m}</Tag>)}
                  </div>
                }
              />
            )}
          </Section>
        )}

        {/* Compensation */}
        {job.isCompensationVisible && (job.compensationRate != null || job.compensationNotes) && (
          <Section title="Compensation">
            {job.compensationRate != null && (
              <Row
                label="Rate"
                value={
                  <span className="flex items-center gap-1 font-semibold text-emerald-700">
                    <DollarSign className="size-3.5" />
                    {job.compensationRate.toFixed(2)}
                    {job.compensationUnit && (
                      <span className="font-normal text-zinc-500 text-xs"> {job.compensationUnit}</span>
                    )}
                  </span>
                }
              />
            )}
            {job.compensationNotes && <Row label="Notes" value={job.compensationNotes} />}
          </Section>
        )}

        {/* Special notes (assigned only) */}
        {job.specialNotes && isAssigned && (
          <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-sky-600">
              Notes from admin
            </p>
            <p className="text-sm leading-relaxed text-zinc-800 whitespace-pre-wrap">
              {job.specialNotes}
            </p>
          </div>
        )}
      </div>

      {/* Right: Action panel */}
      <div className="self-start space-y-3 lg:sticky lg:top-6">
        {/* Eligibility */}
        <EligibilityCard
          issues={job.eligibilityIssues}
          hasAvailability={job.hasAvailability}
          isFull={isFull}
          myStatus={myStatus}
        />

        {/* CTA */}
        {isOpen && (
          <div className="rounded-xl border border-zinc-200/80 bg-white p-4">
            {isAssigned ? (
              <div className="space-y-2">
                <p className="text-xs text-zinc-500">
                  Assigned
                  {job.myAssignedAt
                    ? ` on ${new Date(job.myAssignedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                    : ""}.
                </p>
                <div className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5">
                  <Lock className="mt-0.5 size-3.5 shrink-0 text-zinc-400" />
                  <p className="text-xs text-zinc-500">
                    Only an admin can remove you from this assignment. Contact your administrator if needed.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-zinc-500">
                  {canPick
                    ? "Your profile meets all requirements. Picking adds you immediately."
                    : "Resolve the issues above to become eligible for this job."}
                </p>
                <button
                  type="button"
                  onClick={handlePick}
                  disabled={isPending || !canPick}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all",
                    canPick && !isPending
                      ? "bg-zinc-950 text-white hover:bg-zinc-800"
                      : "cursor-not-allowed bg-zinc-100 text-zinc-400"
                  )}
                >
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                  {isPending ? "Picking…" : canPick ? "Pick this job" : "Not eligible"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Quick facts */}
        <div className="rounded-xl border border-zinc-200/80 bg-white p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">Quick info</p>
          <div className="space-y-2.5">
            {[
              { label: "Client", value: job.clientName },
              { label: "Language", value: job.languagePair },
              { label: "Type", value: job.assignmentType },
              { label: "Duration", value: dur(job.scheduledStart, job.scheduledEnd) },
              ...(job.isCompensationVisible && job.compensationRate != null
                ? [{ label: "Rate", value: `$${job.compensationRate.toFixed(2)}${job.compensationUnit ? ` ${job.compensationUnit}` : ""}`, highlight: true }]
                : []),
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-2">
                <span className="text-xs text-zinc-500">{item.label}</span>
                <span className={cn(
                  "max-w-[160px] truncate text-right text-xs font-medium",
                  "highlight" in item && item.highlight ? "text-emerald-600" : "text-zinc-900"
                )}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Back link */}
        <Link
          href="/interpreter/jobs"
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to job feed
        </Link>
      </div>
    </div>
  );
}
