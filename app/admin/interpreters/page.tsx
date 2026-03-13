import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { MotionIn, MotionStagger, MotionItem } from "@/components/motion";
import { InterpretersTable } from "./table";
import { Users, Clock, CheckCircle2, XCircle, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminInterpretersPage() {
  await requireAdmin();

  const interpreters = await prisma.userProfile.findMany({
    where: { role: "INTERPRETER" },
    orderBy: { createdAt: "desc" },
    take: 250,
    include: { interpreterProfile: true },
  });

  const total = interpreters.length;
  const pending = interpreters.filter((u) => u.status === "PENDING").length;
  const approved = interpreters.filter((u) => u.status === "APPROVED").length;
  const denied = interpreters.filter((u) => u.status === "DENIED").length;
  const active = interpreters.filter((u) => u.isActive && u.status === "APPROVED").length;

  const kpis = [
    { label: "Total", value: total, icon: Users, color: "text-violet-600", bg: "bg-violet-50", ring: "ring-violet-200/60", bar: "bg-violet-500" },
    { label: "Active", value: active, icon: UserCheck, color: "text-emerald-600", bg: "bg-emerald-50", ring: "ring-emerald-200/60", bar: "bg-emerald-500" },
    { label: "Pending", value: pending, icon: Clock, color: "text-amber-600", bg: "bg-amber-50", ring: "ring-amber-200/60", bar: "bg-amber-500" },
    { label: "Approved", value: approved, icon: CheckCircle2, color: "text-sky-600", bg: "bg-sky-50", ring: "ring-sky-200/60", bar: "bg-sky-500" },
    { label: "Denied", value: denied, icon: XCircle, color: "text-rose-600", bg: "bg-rose-50", ring: "ring-rose-200/60", bar: "bg-rose-500" },
  ];

  return (
    <MotionIn className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Interpreters</h1>
          <p className="mt-1 text-sm text-zinc-500">Search profiles, review status, and manage access.</p>
        </div>
      </div>

      <MotionStagger className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <MotionItem key={k.label}>
            <KpiCard {...k} />
          </MotionItem>
        ))}
      </MotionStagger>

      <InterpretersTable initial={interpreters} />
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
    <div className="card-hover relative overflow-hidden rounded-xl border border-zinc-200/80 bg-white p-4">
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
