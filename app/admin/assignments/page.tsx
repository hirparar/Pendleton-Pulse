// app/admin/assignments/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { MotionIn, MotionStagger, MotionItem } from "@/components/motion";
import { AssignmentsTable } from "./table";
import { Plus, ListChecks, CheckCircle2, XCircle, Zap, Users, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

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
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const upcoming = assignments.filter(
    (a) => a.status === "OPEN" || a.status === "ASSIGNED"
  ).length;
  const urgent = assignments.filter(
    (a) => a.isUrgent && (a.status === "OPEN" || a.status === "ASSIGNED")
  ).length;

  const kpis = [
    { label: "Open", value: counts.OPEN ?? 0, icon: ListChecks, color: "text-sky-600", bg: "bg-sky-50", ring: "ring-sky-200/60", bar: "bg-sky-500" },
    { label: "Assigned", value: counts.ASSIGNED ?? 0, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", ring: "ring-emerald-200/60", bar: "bg-emerald-500" },
    { label: "Completed", value: counts.COMPLETED ?? 0, icon: CheckCircle2, color: "text-zinc-500", bg: "bg-zinc-100", ring: "ring-zinc-200/60", bar: "bg-zinc-400" },
    { label: "Cancelled", value: counts.CANCELLED ?? 0, icon: XCircle, color: "text-rose-600", bg: "bg-rose-50", ring: "ring-rose-200/60", bar: "bg-rose-500" },
    { label: "Active", value: upcoming, icon: Clock, color: "text-amber-600", bg: "bg-amber-50", ring: "ring-amber-200/60", bar: "bg-amber-500" },
    { label: "Urgent", value: urgent, icon: Zap, color: "text-red-600", bg: "bg-red-50", ring: "ring-red-200/60", bar: "bg-red-500" },
  ];

  return (
    <MotionIn className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
            Assignments
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Create, staff, and manage interpreter assignments.
          </p>
        </div>
        <Link
          href="/admin/assignments/new"
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          <Plus className="size-4" />
          New assignment
        </Link>
      </div>

      {/* KPIs */}
      <MotionStagger className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <MotionItem key={k.label}>
            <KpiCard {...k} />
          </MotionItem>
        ))}
      </MotionStagger>

      {/* Table */}
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

function KpiCard({
  label, value, icon: Icon, color, bg, ring, bar,
}: {
  label: string; value: number;
  icon: React.ElementType; color: string; bg: string; ring: string; bar: string;
}) {
  return (
    <div className={cn("card-hover relative overflow-hidden rounded-xl border border-zinc-200/80 bg-white p-4")}>
      <div className={cn("absolute inset-x-0 top-0 h-0.5 opacity-80", bar)} />
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-zinc-500">{label}</p>
          <p className={cn("mt-1.5 text-2xl font-semibold tabular-nums tracking-tight", color)}>
            {value}
          </p>
        </div>
        <div className={cn("grid h-8 w-8 place-items-center rounded-lg ring-1", bg, ring)}>
          <Icon className={cn("size-4", color)} />
        </div>
      </div>
    </div>
  );
}
