// app/admin/assignments/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { MotionIn } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { AssignmentCommandPanel } from "./ui";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

function fmt(iso: Date | string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

export default async function AssignmentDetailPage({ params }: PageProps) {
  await requireAdmin();
  const { id } = await params;

  const [assignment, eligibleInterpreters] = await Promise.all([
    prisma.assignment.findUnique({
      where: { id },
      include: {
        interpreters: {
          include: {
            userProfile: { include: { interpreterProfile: true } },
          },
          orderBy: { assignedAt: "desc" },
        },
        visibility: { include: { userProfile: { include: { interpreterProfile: true } } } },
        auditEvents: { orderBy: { createdAt: "desc" }, take: 50 },
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

  return (
    <MotionIn className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">
              {assignment.title}
            </h1>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {assignment.clientName} · {assignment.languagePair} · {assignment.assignmentType}
          </p>
          <p className="text-xs text-zinc-400 mt-1">{assignment.location}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="secondary"
            className={[
              "rounded-full font-medium",
              assignment.status === "OPEN" ? "bg-sky-500/10 text-sky-700 border-sky-500/20" :
              assignment.status === "ASSIGNED" ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" :
              assignment.status === "COMPLETED" ? "bg-zinc-500/10 text-zinc-600 border-zinc-500/20" :
              "bg-rose-500/10 text-rose-700 border-rose-500/20",
            ].join(" ")}
          >
            {assignment.status}
          </Badge>
          <Badge
            variant="secondary"
            className={`rounded-full ${isFull ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" : "bg-amber-500/10 text-amber-700 border-amber-500/20"}`}
          >
            {assignedCount}/{assignment.interpretersNeeded} filled
          </Badge>
          <Link
            href="/admin/assignments"
            className="inline-flex h-9 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            Back
          </Link>
        </div>
      </header>

      {/* Schedule info */}
      <div className="grid gap-3 lg:grid-cols-3">
        <InfoCard label="Start" value={fmt(assignment.scheduledStart)} />
        <InfoCard label="End" value={fmt(assignment.scheduledEnd)} />
        <InfoCard
          label="Duration"
          value={(() => {
            const diff = new Date(assignment.scheduledEnd).getTime() - new Date(assignment.scheduledStart).getTime();
            const h = Math.floor(diff / 3600000);
            const m = Math.round((diff % 3600000) / 60000);
            return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ""}`.trim() : `${m}m`;
          })()}
        />
      </div>

      {/* Main command panel */}
      <AssignmentCommandPanel
        assignment={{
          id: assignment.id,
          title: assignment.title,
          clientName: assignment.clientName,
          languagePair: assignment.languagePair,
          assignmentType: assignment.assignmentType,
          location: assignment.location,
          scheduledStart: assignment.scheduledStart.toISOString(),
          scheduledEnd: assignment.scheduledEnd.toISOString(),
          interpretersNeeded: assignment.interpretersNeeded,
          specialNotes: assignment.specialNotes,
          status: assignment.status as any,
          visibilityMode: assignment.visibilityMode,
          assignedCount,
          visibilityAllowedIds: assignment.visibility.map((v) => v.userProfileId),
          assignedInterpreters: assignment.interpreters.map((link) => ({
            linkId: link.id,
            userProfileId: link.userProfileId,
            status: link.status,
            assignedAt: link.assignedAt.toISOString(),
            removedAt: link.removedAt?.toISOString() ?? null,
            label:
              link.userProfile.interpreterProfile?.displayName ??
              link.userProfile.email ??
              link.userProfile.id.slice(0, 8),
            email: link.userProfile.email ?? null,
            location: link.userProfile.interpreterProfile?.location ?? null,
          })),
        }}
        eligibleInterpreters={eligibleInterpreters.map((u) => ({
          id: u.id,
          label: u.interpreterProfile?.displayName ?? u.email ?? u.id.slice(0, 8),
          email: u.email ?? null,
          location: u.interpreterProfile?.location ?? null,
          languages: u.interpreterProfile?.languages ?? [],
        }))}
        auditEvents={assignment.auditEvents.map((e) => ({
          id: e.id,
          action: e.action,
          actor: e.actor ?? null,
          note: e.note ?? null,
          createdAt: e.createdAt.toISOString(),
        }))}
      />

      {/* Notes */}
      {assignment.specialNotes && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Special notes</div>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
            {assignment.specialNotes}
          </p>
        </div>
      )}
    </MotionIn>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{label}</div>
      <div className="mt-1.5 text-sm font-medium text-zinc-950 dark:text-white">{value}</div>
    </div>
  );
}