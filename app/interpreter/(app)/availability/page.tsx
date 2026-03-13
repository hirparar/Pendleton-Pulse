// app/interpreter/availability/page.tsx
import { prisma } from "@/lib/prisma";
import { requireInterpreterEligible } from "@/lib/authz";
import { MotionIn } from "@/components/motion";
import { formatLocalDate } from "@/lib/availability/service";
import { AvailabilityManager } from "./ui";

export const dynamic = "force-dynamic";

export default async function InterpreterAvailabilityPage() {
  const me = await requireInterpreterEligible();

  const profile = await prisma.interpreterProfile.findUnique({
    where: { userProfileId: me.id },
    select: { timezone: true },
  });

  const tz = profile?.timezone ?? "America/New_York";

  // Load slots for the next 60 days + past 7 days
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 7);
  const end = new Date();
  end.setUTCDate(end.getUTCDate() + 60);

  const [slots, templates, upcomingJobs] = await Promise.all([
    prisma.availabilitySlot.findMany({
      where: {
        userProfileId: me.id,
        date: { gte: start, lte: end },
      },
      orderBy: [{ date: "asc" }, { startMin: "asc" }],
    }),

    prisma.availabilityTemplate.findMany({
      where: { userProfileId: me.id },
      orderBy: { createdAt: "desc" },
    }),

    prisma.assignment.findMany({
      where: {
        interpreters: { some: { userProfileId: me.id, status: "ASSIGNED" } },
        scheduledStart: { gte: new Date() },
      },
      orderBy: { scheduledStart: "asc" },
      take: 20,
      select: {
        id: true,
        title: true,
        clientName: true,
        scheduledStart: true,
        scheduledEnd: true,
        assignmentType: true,
        languagePair: true,
        location: true,
      },
    }),
  ]);

  return (
    <MotionIn className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
          Availability
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Set your availability per day. Admins see this to assign jobs accurately.
        </p>
      </header>

      <AvailabilityManager
        userProfileId={me.id}
        timezone={tz}
        initialSlots={slots.map((s) => ({
          id: s.id,
          date: formatLocalDate(s.date),
          startMin: s.startMin,
          endMin: s.endMin,
          timezone: s.timezone,
          note: s.note,
          templateId: s.templateId,
        }))}
        initialTemplates={templates.map((t) => ({
          id: t.id,
          name: t.name,
          timezone: t.timezone,
          days: t.days as { weekday: number; startMin: number; endMin: number }[],
        }))}
        upcomingJobs={upcomingJobs.map((j) => ({
          id: j.id,
          title: j.title,
          clientName: j.clientName,
          scheduledStart: j.scheduledStart.toISOString(),
          scheduledEnd: j.scheduledEnd.toISOString(),
          assignmentType: j.assignmentType,
          languagePair: j.languagePair,
          location: j.location,
        }))}
      />
    </MotionIn>
  );
}