// app/admin/assignments/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { MotionIn } from "@/components/motion";
import { AssignmentCommandPanel } from "./ui";

export const dynamic = "force-dynamic";
type PageProps = { params: Promise<{ id: string }> };

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

  return (
    <MotionIn className="pb-16">
      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-6">
        <Link href="/admin/assignments" className="hover:text-zinc-900 dark:hover:text-white transition-colors">
          Assignments
        </Link>
        <span>/</span>
        <span className="text-zinc-900 dark:text-white font-medium truncate max-w-sm">
          {assignment.title}
        </span>
        <Link
          href="/admin/assignments"
          className="ml-auto shrink-0 inline-flex h-8 items-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
        >
          ← Back
        </Link>
      </nav>

      {/* ── Full-width command panel ── */}
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
            label:
              link.userProfile.interpreterProfile?.displayName ??
              link.userProfile.email ??
              link.userProfile.id.slice(0, 8),
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
          id: e.id,
          action: e.action,
          actor: e.actor ?? null,
          note: e.note ?? null,
          createdAt: e.createdAt.toISOString(),
        }))}
      />
    </MotionIn>
  );
}