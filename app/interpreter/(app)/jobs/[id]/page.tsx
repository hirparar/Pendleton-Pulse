// app/interpreter/jobs/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireInterpreterEligible } from "@/lib/authz";
import { MotionIn } from "@/components/motion";
import { JobDetailClient } from "./ui";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

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

export default async function InterpreterJobDetailPage({ params }: Props) {
  const me = await requireInterpreterEligible();
  const { id } = await params;

  const [rawJob, profile, slots] = await Promise.all([
    prisma.assignment.findUnique({
      where: { id },
      include: {
        _count: { select: { interpreters: { where: { status: "ASSIGNED" } } } },
        interpreters: {
          where: { userProfileId: me.id },
          select: { status: true, assignedAt: true },
        },
      },
    }),
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

  if (!rawJob) notFound();
  if (rawJob.status === "CANCELLED") notFound();

  if (rawJob.visibilityMode === "RESTRICTED") {
    const grant = await prisma.assignmentVisibility.findUnique({
      where: {
        assignmentId_userProfileId: {
          assignmentId: id,
          userProfileId: me.id,
        },
      },
    });
    if (!grant) notFound();
  }

  const myLink = rawJob.interpreters?.[0] ?? null;
  const myStatus = myLink?.status ?? null;

  const interp = profile ?? {
    timezone: "America/New_York",
    languages: [],
    certifications: [],
    experienceYears: null,
    preferredModes: [],
  };

  const interpreterTimezone = interp.timezone ?? "America/New_York";

  const eligibilityIssues: { field: string; required: string; yours: string }[] = [];

  if (rawJob.requiredLanguagePair) {
    const has = interp.languages.some(
      (l) => l.toLowerCase() === rawJob.requiredLanguagePair!.toLowerCase()
    );

    if (!has) {
      eligibilityIssues.push({
        field: "Language pair",
        required: rawJob.requiredLanguagePair,
        yours: interp.languages.length > 0 ? interp.languages.join(", ") : "None on profile",
      });
    }
  }

  if (rawJob.requiredCertifications.length > 0) {
    const hasCert = rawJob.requiredCertifications.some((req) =>
      interp.certifications.some((c) => c.toLowerCase().includes(req.toLowerCase()))
    );

    if (!hasCert) {
      eligibilityIssues.push({
        field: "Certification",
        required: `One of: ${rawJob.requiredCertifications.join(", ")}`,
        yours: interp.certifications.length > 0 ? interp.certifications.join(", ") : "None on profile",
      });
    }
  }

  if (rawJob.requiredExperienceYears != null) {
    const exp = interp.experienceYears ?? 0;
    if (exp < rawJob.requiredExperienceYears) {
      eligibilityIssues.push({
        field: "Experience",
        required: `${rawJob.requiredExperienceYears}+ years`,
        yours: exp > 0 ? `${exp} years` : "Not set on profile",
      });
    }
  }

  if (rawJob.requiredModes.length > 0) {
    const hasMode = rawJob.requiredModes.some((m) => interp.preferredModes.includes(m));
    if (!hasMode) {
      eligibilityIssues.push({
        field: "Modality",
        required: rawJob.requiredModes.join(" or "),
        yours: interp.preferredModes.length > 0 ? interp.preferredModes.join(", ") : "None on profile",
      });
    }
  }

  // IMPORTANT: availability check must match requestAssignment() logic
  const localStart = toLocalDateParts(rawJob.scheduledStart, interpreterTimezone);
  const localEnd = toLocalDateParts(rawJob.scheduledEnd, interpreterTimezone);

  const hasAvailability = slots.some((s) => {
    const slotDateStr = s.date.toISOString().slice(0, 10);
    return (
      slotDateStr === localStart.dateStr &&
      s.startMin <= localStart.min &&
      s.endMin >= localEnd.min
    );
  });

  const isFull = rawJob._count.interpreters >= rawJob.interpretersNeeded;

  const job = {
    id: rawJob.id,
    title: rawJob.title,
    clientName: rawJob.clientName,
    clientOrganization: rawJob.clientOrganization ?? null,
    languagePair: rawJob.languagePair,
    assignmentType: rawJob.assignmentType,
    deliveryMode: rawJob.deliveryMode as string,
    scheduledStart: rawJob.scheduledStart.toISOString(),
    scheduledEnd: rawJob.scheduledEnd.toISOString(),
    timezone: rawJob.timezone,
    location: rawJob.location,
    address: rawJob.address ?? null,
    roomFloor: rawJob.roomFloor ?? null,
    parkingNotes: rawJob.parkingNotes ?? null,
    accessInstructions: rawJob.accessInstructions ?? null,
    dresscode: rawJob.dresscode ?? null,
    meetingLink: rawJob.meetingLink ?? null,
    meetingPassword: rawJob.meetingPassword ?? null,
    platformNotes: rawJob.platformNotes ?? null,
    interpretersNeeded: rawJob.interpretersNeeded,
    assignedCount: rawJob._count.interpreters,
    status: rawJob.status as string,
    isUrgent: rawJob.isUrgent,
    requiredLanguagePair: rawJob.requiredLanguagePair ?? null,
    requiredCertifications: rawJob.requiredCertifications,
    requiredExperienceYears: rawJob.requiredExperienceYears ?? null,
    requiredModes: rawJob.requiredModes,
    compensationRate: rawJob.compensationRate ?? null,
    compensationUnit: rawJob.compensationUnit ?? null,
    compensationNotes: rawJob.compensationNotes ?? null,
    isCompensationVisible: rawJob.isCompensationVisible,
    specialNotes: rawJob.specialNotes ?? null,
    myStatus: (myStatus ?? null) as "ASSIGNED" | "REMOVED" | null,
    myAssignedAt: myLink?.assignedAt?.toISOString() ?? null,
    isFull,
    hasAvailability,
    eligibilityIssues,
  };

  return (
    <MotionIn className="space-y-6">
      <nav className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/interpreter/jobs" className="hover:text-zinc-900 transition-colors">
          Job feed
        </Link>
        <span>/</span>
        <span className="text-zinc-900 font-medium truncate max-w-xs">{job.title}</span>
      </nav>

      <JobDetailClient job={job} />
    </MotionIn>
  );
}