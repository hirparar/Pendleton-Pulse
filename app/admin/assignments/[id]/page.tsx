// app/admin/assignments/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { MotionIn } from "@/components/motion";
import { AssignmentCommandPanel } from "./ui";

export const dynamic = "force-dynamic";
type PageProps = { params: Promise<{ id: string }> };

const DELIVERY_LABELS: Record<string, string> = {
  IN_PERSON: "In-person", REMOTE: "Remote (phone)",
  VIDEO_RELAY: "Video relay (VRS)", VIDEO_REMOTE: "Video remote (VRI)",
};

function fmt(d: Date | string) {
  return new Date(d).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}
function dur(start: Date | string, end: Date | string) {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const h = Math.floor(diff / 3600000), m = Math.round((diff % 3600000) / 60000);
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
}

export default async function AssignmentDetailPage({ params }: PageProps) {
  await requireAdmin();
  const { id } = await params;

  const [assignment, eligibleInterpreters] = await Promise.all([
    prisma.assignment.findUnique({
      where: { id },
      include: {
        interpreters: {
          include: { userProfile: { include: { interpreterProfile: true } } },
          orderBy: { assignedAt: "desc" },
        },
        visibility: { include: { userProfile: { include: { interpreterProfile: true } } } },
        auditEvents: { orderBy: { createdAt: "desc" }, take: 100 },
        _count: { select: { interpreters: { where: { status: "ASSIGNED" } } } },
      },
    }),
    prisma.userProfile.findMany({
      where: { role: "INTERPRETER", status: "APPROVED", isActive: true },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { interpreterProfile: true },
    }),
  ]);

  if (!assignment) notFound();

  const assignedCount = assignment._count.interpreters;
  const isFull = assignedCount >= assignment.interpretersNeeded;

  const statusColor = {
    OPEN:      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
    ASSIGNED:  "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    COMPLETED: "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
    CANCELLED: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
  }[assignment.status] ?? "border-zinc-200 bg-zinc-50 text-zinc-600";

  return (
    <MotionIn className="space-y-6 pb-16">
      {/* ── Breadcrumb ────────────────────────────────────────────────── */}
      <nav className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/admin/assignments" className="hover:text-zinc-900 dark:hover:text-white transition-colors">
          Assignments
        </Link>
        <span>/</span>
        <span className="text-zinc-900 dark:text-white font-medium truncate max-w-sm">{assignment.title}</span>
      </nav>

      {/* ── Hero header ───────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            {/* badges */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {assignment.isUrgent && (
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                  🔴 URGENT
                </span>
              )}
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusColor}`}>
                {assignment.status}
              </span>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                isFull
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
              }`}>
                {assignedCount}/{assignment.interpretersNeeded} filled
              </span>
              <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                {DELIVERY_LABELS[assignment.deliveryMode] ?? assignment.deliveryMode}
              </span>
              {assignment.visibilityMode === "RESTRICTED" && (
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  🔒 Restricted
                </span>
              )}
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white leading-tight">
              {assignment.title}
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {assignment.clientName}
              {assignment.clientOrganization && <span className="text-zinc-400 dark:text-zinc-500"> · {assignment.clientOrganization}</span>}
              {" · "}{assignment.languagePair}{" · "}{assignment.assignmentType}
            </p>
          </div>

          <Link href="/admin/assignments"
            className="shrink-0 inline-flex h-9 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700">
            ← Back
          </Link>
        </div>

        {/* Schedule strip */}
        <div className="grid grid-cols-3 divide-x divide-zinc-100 border-t border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
          <div className="px-6 py-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-1">Start</div>
            <div className="text-sm font-medium text-zinc-900 dark:text-white">{fmt(assignment.scheduledStart)}</div>
          </div>
          <div className="px-6 py-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-1">End</div>
            <div className="text-sm font-medium text-zinc-900 dark:text-white">{fmt(assignment.scheduledEnd)}</div>
          </div>
          <div className="px-6 py-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-1">Duration</div>
            <div className="text-sm font-medium text-zinc-900 dark:text-white">{dur(assignment.scheduledStart, assignment.scheduledEnd)}</div>
          </div>
        </div>
      </div>

      {/* ── Two-column layout ────────────────────────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">

        {/* Left: read-only details ─────────────────────────────────────── */}
        <div className="space-y-5 min-w-0">

          {/* Location / Remote */}
          <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
                {["REMOTE","VIDEO_RELAY","VIDEO_REMOTE"].includes(assignment.deliveryMode) ? "Remote details" : "Location & access"}
              </h2>
            </div>
            <div className="px-6 py-2">
              <DR label="Location"    value={assignment.location} />
              {assignment.address         && <DR label="Address"         value={assignment.address} />}
              {assignment.roomFloor       && <DR label="Room / floor"    value={assignment.roomFloor} />}
              {assignment.dresscode       && <DR label="Dress code"      value={assignment.dresscode} />}
              {assignment.parkingNotes    && <DR label="Parking"         value={assignment.parkingNotes} />}
              {assignment.accessInstructions && <DR label="Access"       value={assignment.accessInstructions} />}
              {assignment.meetingLink     && <DR label="Meeting link"    value={assignment.meetingLink} link />}
              {assignment.meetingPassword && <DR label="Meeting pass"    value={assignment.meetingPassword} mono />}
              {assignment.platformNotes   && <DR label="Platform notes"  value={assignment.platformNotes} />}
            </div>
          </div>

          {/* Requirements */}
          {(assignment.requiredCertifications.length > 0 || assignment.requiredLanguagePair || assignment.requiredExperienceYears != null || assignment.requiredModes.length > 0) && (
            <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Interpreter requirements</h2>
              </div>
              <div className="px-6 py-2">
                {assignment.requiredLanguagePair    && <DR label="Language pair" value={assignment.requiredLanguagePair} />}
                {assignment.requiredExperienceYears != null && <DR label="Min experience" value={`${assignment.requiredExperienceYears}+ years`} />}
                {assignment.requiredCertifications.length > 0 && (
                  <DR label="Certifications" value={
                    <div className="flex flex-wrap gap-1.5">
                      {assignment.requiredCertifications.map((c) => (
                        <span key={c} className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300">{c}</span>
                      ))}
                      <span className="text-xs text-zinc-400">(need at least one)</span>
                    </div>
                  } />
                )}
                {assignment.requiredModes.length > 0 && (
                  <DR label="Modalities" value={
                    <div className="flex flex-wrap gap-1.5">
                      {assignment.requiredModes.map((m) => (
                        <span key={m} className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{DELIVERY_LABELS[m] ?? m}</span>
                      ))}
                    </div>
                  } />
                )}
              </div>
            </div>
          )}

          {/* Compensation */}
          {(assignment.compensationRate != null || assignment.compensationNotes) && (
            <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Compensation</h2>
                  <span className={`text-xs font-medium ${assignment.isCompensationVisible ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400"}`}>
                    {assignment.isCompensationVisible ? "Visible to interpreters" : "Hidden from interpreters"}
                  </span>
                </div>
              </div>
              <div className="px-6 py-2">
                {assignment.compensationRate != null && (
                  <DR label="Rate" value={
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      ${assignment.compensationRate.toFixed(2)}
                      {assignment.compensationUnit && <span className="font-normal text-zinc-500 dark:text-zinc-400"> {assignment.compensationUnit}</span>}
                    </span>
                  } />
                )}
                {assignment.compensationNotes && <DR label="Notes" value={assignment.compensationNotes} />}
              </div>
            </div>
          )}

          {/* Notes */}
          {(assignment.specialNotes || assignment.internalNotes) && (
            <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Notes</h2>
              </div>
              <div className="px-6 py-4 space-y-4">
                {assignment.specialNotes && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-2">Visible to interpreters</div>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">{assignment.specialNotes}</p>
                  </div>
                )}
                {assignment.internalNotes && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-amber-500 mb-2">Admin only — not shown to interpreters</div>
                    <p className="text-sm text-amber-800 dark:text-amber-300 whitespace-pre-wrap leading-relaxed">{assignment.internalNotes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: command panel ───────────────────────────────────────── */}
        <div className="xl:sticky xl:top-6 self-start">
          <AssignmentCommandPanel
            assignment={{
              id: assignment.id,
              title: assignment.title,
              clientName: assignment.clientName,
              clientOrganization: assignment.clientOrganization ?? null,
              languagePair: assignment.languagePair,
              assignmentType: assignment.assignmentType,
              deliveryMode: assignment.deliveryMode as string,
              location: assignment.location,
              address: assignment.address ?? null,
              roomFloor: assignment.roomFloor ?? null,
              dresscode: assignment.dresscode ?? null,
              parkingNotes: assignment.parkingNotes ?? null,
              accessInstructions: assignment.accessInstructions ?? null,
              meetingLink: assignment.meetingLink ?? null,
              meetingPassword: assignment.meetingPassword ?? null,
              platformNotes: assignment.platformNotes ?? null,
              scheduledStart: assignment.scheduledStart.toISOString(),
              scheduledEnd: assignment.scheduledEnd.toISOString(),
              timezone: assignment.timezone,
              interpretersNeeded: assignment.interpretersNeeded,
              isUrgent: assignment.isUrgent,
              specialNotes: assignment.specialNotes ?? null,
              internalNotes: assignment.internalNotes ?? null,
              requiredLanguagePair: assignment.requiredLanguagePair ?? null,
              requiredCertifications: assignment.requiredCertifications,
              requiredExperienceYears: assignment.requiredExperienceYears ?? null,
              requiredModes: assignment.requiredModes,
              compensationRate: assignment.compensationRate ?? null,
              compensationUnit: assignment.compensationUnit ?? null,
              compensationNotes: assignment.compensationNotes ?? null,
              isCompensationVisible: assignment.isCompensationVisible,
              status: assignment.status as any,
              visibilityMode: assignment.visibilityMode,
              assignedCount,
              visibilityAllowedIds: assignment.visibility.map((v) => v.userProfileId),
              assignedInterpreters: assignment.interpreters.map((link) => ({
                linkId: link.id,
                userProfileId: link.userProfileId,
                status: link.status as "ASSIGNED" | "REMOVED",
                assignedAt: link.assignedAt.toISOString(),
                removedAt: link.removedAt?.toISOString() ?? null,
                note: link.note ?? null,
                label: link.userProfile.interpreterProfile?.displayName ?? link.userProfile.email ?? link.userProfile.id.slice(0, 8),
                email: link.userProfile.email ?? null,
                location: link.userProfile.interpreterProfile?.location ?? null,
                languages: link.userProfile.interpreterProfile?.languages ?? [],
                certifications: link.userProfile.interpreterProfile?.certifications ?? [],
                experienceYears: link.userProfile.interpreterProfile?.experienceYears ?? null,
              })),
            }}
            eligibleInterpreters={eligibleInterpreters.map((u) => ({
              id: u.id,
              label: u.interpreterProfile?.displayName ?? u.email ?? u.id.slice(0, 8),
              email: u.email ?? null,
              location: u.interpreterProfile?.location ?? null,
              languages: u.interpreterProfile?.languages ?? [],
              certifications: u.interpreterProfile?.certifications ?? [],
              experienceYears: u.interpreterProfile?.experienceYears ?? null,
              preferredModes: u.interpreterProfile?.preferredModes ?? [],
            }))}
            auditEvents={assignment.auditEvents.map((e) => ({
              id: e.id, action: e.action, actor: e.actor ?? null,
              note: e.note ?? null, createdAt: e.createdAt.toISOString(),
            }))}
          />
        </div>
      </div>
    </MotionIn>
  );
}

// ─── Detail row — reusable read-only display ──────────────────────────────────

function DR({ label, value, link, mono }: {
  label: string; value: React.ReactNode; link?: boolean; mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-4 py-3.5 border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
      <span className="w-36 shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400 pt-0.5">{label}</span>
      <span className={`flex-1 text-sm text-zinc-900 dark:text-zinc-100 leading-relaxed ${mono ? "font-mono" : ""}`}>
        {link && typeof value === "string" ? (
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:text-sky-700 dark:text-sky-400 underline underline-offset-2 break-all">
            {value} ↗
          </a>
        ) : value}
      </span>
    </div>
  );
}