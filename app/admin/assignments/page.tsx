// app/admin/assignments/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { MotionIn } from "@/components/motion";
import { AssignmentsTable } from "./table";

export const dynamic = "force-dynamic";

export default async function AdminAssignmentsPage() {
  await requireAdmin();

  const assignments = await prisma.assignment.findMany({
    orderBy: [{ scheduledStart: "asc" }, { createdAt: "desc" }],
    take: 500,
    include: {
      _count: { select: { interpreters: { where: { status: "ASSIGNED" } } } },
    },
  });

  const counts = assignments.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1; return acc;
  }, {} as Record<string, number>);

  const upcoming = assignments.filter((a) => a.status === "OPEN" || a.status === "ASSIGNED").length;
  const urgent   = assignments.filter((a) => a.isUrgent && (a.status === "OPEN" || a.status === "ASSIGNED")).length;

  return (
    <MotionIn className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">Assignments</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Create, staff, and manage interpreter assignments.
          </p>
        </div>
        <Link href="/admin/assignments/new"
          className="inline-flex h-10 items-center rounded-2xl bg-zinc-950 px-5 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100">
          Create assignment
        </Link>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Kpi label="Open"         value={counts.OPEN ?? 0}      color="sky" />
        <Kpi label="Assigned"     value={counts.ASSIGNED ?? 0}  color="emerald" />
        <Kpi label="Completed"    value={counts.COMPLETED ?? 0} color="zinc" />
        <Kpi label="Cancelled"    value={counts.CANCELLED ?? 0} color="rose" />
        <Kpi label="Active"       value={upcoming}              color="amber" />
        <Kpi label="Urgent"       value={urgent}                color="red" />
      </div>

      <AssignmentsTable
        initial={assignments.map((a) => ({
          id: a.id,
          title: a.title,
          clientName: a.clientName,
          clientOrganization: a.clientOrganization ?? null,
          languagePair: a.languagePair,
          assignmentType: a.assignmentType,
          deliveryMode: a.deliveryMode,
          location: a.location,
          scheduledStart: a.scheduledStart.toISOString(),
          scheduledEnd: a.scheduledEnd.toISOString(),
          interpretersNeeded: a.interpretersNeeded,
          status: a.status,
          visibilityMode: a.visibilityMode,
          isUrgent: a.isUrgent,
          assignedCount: a._count.interpreters,
          compensationRate: a.compensationRate ?? null,
          compensationUnit: a.compensationUnit ?? null,
          isCompensationVisible: a.isCompensationVisible,
          requiredCertifications: a.requiredCertifications,
          requiredLanguagePair: a.requiredLanguagePair ?? null,
          createdAt: a.createdAt.toISOString(),
        }))}
      />
    </MotionIn>
  );
}

function Kpi({ label, value, color }: {
  label: string; value: number;
  color: "sky" | "emerald" | "zinc" | "rose" | "amber" | "red";
}) {
  const c = {
    sky:     "text-sky-600 dark:text-sky-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    zinc:    "text-zinc-600 dark:text-zinc-400",
    rose:    "text-rose-600 dark:text-rose-400",
    amber:   "text-amber-600 dark:text-amber-400",
    red:     "text-red-600 dark:text-red-400",
  }[color];
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className={`mt-1.5 text-2xl font-semibold tabular-nums ${c}`}>{value}</div>
    </div>
  );
}