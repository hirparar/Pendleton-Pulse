// app/admin/availability/page.tsx
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { MotionIn } from "@/components/motion";
import Link from "next/link";
import { formatLocalDate } from "@/lib/availability/service";
import { Calendar, MapPin, ArrowUpRight, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminAvailabilityPage() {
  await requireAdmin();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const twoWeeks = new Date(today);
  twoWeeks.setDate(twoWeeks.getDate() + 14);

  const interpreters = await prisma.userProfile.findMany({
    where: { role: "INTERPRETER", status: "APPROVED", isActive: true },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      interpreterProfile: true,
      availabilitySlots: {
        where: { date: { gte: today, lte: twoWeeks } },
        select: { date: true, startMin: true, endMin: true },
        orderBy: { date: "asc" },
      },
    },
  });

  const withSlots = interpreters.filter((i) => i.availabilitySlots.length > 0).length;

  return (
    <MotionIn className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Interpreter Availability</h1>
          <p className="mt-1 text-sm text-zinc-500">
            View each interpreter's concrete availability slots for scheduling.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600">
            <Users className="size-3" />
            {interpreters.length} eligible
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <Calendar className="size-3" />
            {withSlots} available (next 14d)
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/80 text-left">
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Interpreter</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Location</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Next 14 days</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Slots</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {interpreters.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-200 bg-zinc-50">
                        <Calendar className="size-4 text-zinc-400" />
                      </div>
                      <p className="text-sm font-medium text-zinc-900">No approved active interpreters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                interpreters.map((u) => {
                  const slots = u.availabilitySlots;
                  const uniqueDates = [...new Set(slots.map((s) => formatLocalDate(s.date)))];
                  const totalSlots = slots.length;

                  return (
                    <tr key={u.id} className="group transition-colors hover:bg-zinc-50/70">
                      <td className="px-4 py-4">
                        <Link
                          href={`/admin/availability/${u.id}`}
                          className="block"
                        >
                          <p className="font-semibold text-zinc-950 group-hover:text-primary transition-colors">
                            {u.interpreterProfile?.displayName ?? u.email ?? "Interpreter"}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-400">{u.email ?? "—"}</p>
                        </Link>
                      </td>
                      <td className="px-4 py-4">
                        {u.interpreterProfile?.location ? (
                          <span className="flex items-center gap-1 text-sm text-zinc-600">
                            <MapPin className="size-3 text-zinc-400" />
                            {u.interpreterProfile.location}
                          </span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {uniqueDates.length === 0 ? (
                          <span className="text-xs text-zinc-400 italic">No availability set</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {uniqueDates.slice(0, 5).map((d) => (
                              <span key={d} className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                                {new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                            ))}
                            {uniqueDates.length > 5 && (
                              <span className="text-[11px] text-zinc-400">+{uniqueDates.length - 5}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <span className={cn(
                            "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tabular-nums",
                            totalSlots > 0
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-zinc-200 bg-zinc-50 text-zinc-500"
                          )}>
                            {totalSlots}
                          </span>
                          <Link href={`/admin/availability/${u.id}`} className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <ArrowUpRight className="size-4 text-zinc-400 hover:text-zinc-700" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {interpreters.length > 0 && (
          <div className="border-t border-zinc-100 bg-zinc-50/50 px-4 py-2.5">
            <p className="text-xs text-zinc-400">
              Showing <span className="font-medium text-zinc-600">{interpreters.length}</span> approved active interpreters
            </p>
          </div>
        )}
      </div>
    </MotionIn>
  );
}
