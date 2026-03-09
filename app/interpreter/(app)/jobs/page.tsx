// app/interpreter/jobs/page.tsx
import { requireInterpreterEligible } from "@/lib/authz";
import { listJobsForInterpreter } from "@/lib/assignments/service";
import { prisma } from "@/lib/prisma";
import { MotionIn } from "@/components/motion";
import { JobFeed } from "./ui";

export const dynamic = "force-dynamic";

function toLocalDateParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const hour = parseInt(get("hour"), 10);
  const minute = parseInt(get("minute"), 10);

  return {
    dateStr: `${get("year")}-${get("month")}-${get("day")}`,
    min: (hour === 24 ? 0 : hour) * 60 + minute,
  };
}

export default async function InterpreterJobsPage() {
  const me = await requireInterpreterEligible();

  const [rawJobs, profile, slots] = await Promise.all([
    listJobsForInterpreter(me.id),
    prisma.interpreterProfile.findUnique({
      where: { userProfileId: me.id },
      select: {
        timezone: true,
        languages: true,
        certifications: true,
        experienceYears: true,
        preferredModes: true,
      },
    }),
    prisma.availabilitySlot.findMany({
      where: { userProfileId: me.id, date: { gte: new Date("2000-01-01T00:00:00.000Z") } },
      select: { date: true, startMin: true, endMin: true },
      orderBy: [{ date: "asc" }, { startMin: "asc" }],
    }),
  ]);

  const interp = profile ?? {
    timezone: "America/New_York",
    languages: [],
    certifications: [],
    experienceYears: null,
    preferredModes: [],
  };

  const interpreterTimezone = interp.timezone ?? "America/New_York";

  const jobs = rawJobs.map((j) => {
    const issues: { field: string }[] = [];

    if (j.requiredLanguagePair) {
      const has = interp.languages.some(
        (l) => l.toLowerCase() === j.requiredLanguagePair!.toLowerCase()
      );
      if (!has) issues.push({ field: "Language" });
    }

    if (j.requiredCertifications.length > 0) {
      const hasCert = j.requiredCertifications.some((req) =>
        interp.certifications.some((c) => c.toLowerCase().includes(req.toLowerCase()))
      );
      if (!hasCert) issues.push({ field: "Certification" });
    }

    if (j.requiredExperienceYears != null) {
      if ((interp.experienceYears ?? 0) < j.requiredExperienceYears) {
        issues.push({ field: "Experience" });
      }
    }

    if (j.requiredModes.length > 0) {
      if (!j.requiredModes.some((m) => interp.preferredModes.includes(m))) {
        issues.push({ field: "Modality" });
      }
    }

    // IMPORTANT: availability check must match requestAssignment() logic
    const localStart = toLocalDateParts(j.scheduledStart, interpreterTimezone);
    const localEnd = toLocalDateParts(j.scheduledEnd, interpreterTimezone);

    const hasAvailability = slots.some((s) => {
      const slotDateStr = s.date.toISOString().slice(0, 10);
      return (
        slotDateStr === localStart.dateStr &&
        s.startMin <= localStart.min &&
        s.endMin >= localEnd.min
      );
    });

    return {
      id: j.id,
      title: j.title,
      clientName: j.clientName,
      clientOrganization: (j as any).clientOrganization ?? null,
      languagePair: j.languagePair,
      assignmentType: j.assignmentType,
      deliveryMode: (j as any).deliveryMode ?? "IN_PERSON",
      location: j.location,
      scheduledStart: j.scheduledStart.toISOString(),
      scheduledEnd: j.scheduledEnd.toISOString(),
      interpretersNeeded: j.interpretersNeeded,
      assignedCount: j._count.interpreters,
      status: j.status as "OPEN" | "ASSIGNED",
      isUrgent: (j as any).isUrgent ?? false,
      compensationRate: (j as any).compensationRate ?? null,
      compensationUnit: (j as any).compensationUnit ?? null,
      isCompensationVisible: (j as any).isCompensationVisible ?? true,
      requiredCertifications: j.requiredCertifications ?? [],
      requiredExperienceYears: j.requiredExperienceYears ?? null,
      requiredLanguagePair: j.requiredLanguagePair ?? null,
      requiredModes: j.requiredModes ?? [],
      myStatus: (j.interpreters?.[0]?.status ?? null) as "ASSIGNED" | "REMOVED" | null,
      eligibilityIssues: issues,
      hasAvailability,
    };
  });

  const availabilitySlots = slots.map((s) => ({
    date: s.date.toISOString(),
    startMin: s.startMin,
    endMin: s.endMin,
  }));

  const assignedCount = jobs.filter((j) => j.myStatus === "ASSIGNED").length;
  const openCount = jobs.filter((j) => j.status === "OPEN" && j.myStatus !== "ASSIGNED").length;
  const urgentCount = jobs.filter((j) => j.isUrgent && j.status === "OPEN" && j.myStatus !== "ASSIGNED").length;

  return (
    <MotionIn className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">
            Job feed
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Browse open assignments. Eligibility and availability are checked automatically.
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
          <span><strong className="text-zinc-900 dark:text-white">{openCount}</strong> open</span>
          <span><strong className="text-zinc-900 dark:text-white">{assignedCount}</strong> mine</span>
          {urgentCount > 0 && (
            <span className="font-semibold text-rose-600 dark:text-rose-400">{urgentCount} urgent</span>
          )}
        </div>
      </header>

      <JobFeed jobs={jobs} availabilitySlots={availabilitySlots} />
    </MotionIn>
  );
}