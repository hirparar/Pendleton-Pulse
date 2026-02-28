// app/admin/availability/page.tsx
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { MotionIn } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { formatLocalDate } from "@/lib/availability/service";

export const dynamic = "force-dynamic";

export default async function AdminAvailabilityPage() {
  await requireAdmin();

  // Today + next 14 days range for "available soon" counts
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
        where: {
          date: { gte: today, lte: twoWeeks },
        },
        select: { date: true, startMin: true, endMin: true },
        orderBy: { date: "asc" },
      },
    },
  });

  const withSlots = interpreters.filter((i) => i.availabilitySlots.length > 0).length;

  return (
    <MotionIn className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">
            Interpreter Availability
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            View each interpreter's concrete availability slots for scheduling.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            {interpreters.length} eligible
          </Badge>
          <Badge variant="secondary" className="rounded-full bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
            {withSlots} available next 14d
          </Badge>
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-900 text-left text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
              <th className="px-4 py-3">Interpreter</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Next 14 days</th>
              <th className="px-4 py-3 text-right">Slots</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-950">
            {interpreters.map((u) => {
              const slots = u.availabilitySlots;
              // Get unique dates with slots
              const uniqueDates = [...new Set(slots.map((s) => formatLocalDate(s.date)))];
              const totalSlots = slots.length;

              return (
                <tr key={u.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40 transition-colors">
                  <td className="px-4 py-4">
                    <Link
                      href={`/admin/availability/${u.id}`}
                      className="font-medium text-zinc-950 dark:text-white hover:underline"
                    >
                      {u.interpreterProfile?.displayName ?? u.email ?? "Interpreter"}
                    </Link>
                    <div className="text-xs text-zinc-400 mt-0.5">{u.email ?? "—"}</div>
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                    {u.interpreterProfile?.location ?? "—"}
                  </td>
                  <td className="px-4 py-4">
                    {uniqueDates.length === 0 ? (
                      <span className="text-sm text-zinc-400">No availability set</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {uniqueDates.slice(0, 5).map((d) => (
                          <span key={d} className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                            {new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        ))}
                        {uniqueDates.length > 5 && (
                          <span className="text-xs text-zinc-400">+{uniqueDates.length - 5} more</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Badge
                      variant="secondary"
                      className={`rounded-full ${totalSlots > 0 ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" : ""}`}
                    >
                      {totalSlots}
                    </Badge>
                  </td>
                </tr>
              );
            })}
            {interpreters.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-14 text-center text-sm text-zinc-400">
                  No approved active interpreters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </MotionIn>
  );
}