// app/admin/availability/[id]/page.tsx
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { notFound } from "next/navigation";
import { MotionIn } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { formatLocalDate, minToHHMM } from "@/lib/availability/service";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

const WEEKDAYS_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(firstDay);
    d.setDate(1 - startOffset + i);
    days.push(d);
  }
  return days;
}

function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function AdminAvailabilityDetailPage({ params }: PageProps) {
  await requireAdmin();
  const { id } = await params;

  const user = await prisma.userProfile.findUnique({
    where: { id },
    include: {
      interpreterProfile: true,
      availabilitySlots: {
        orderBy: [{ date: "asc" }, { startMin: "asc" }],
        take: 500,
      },
    },
  });

  if (!user || user.role !== "INTERPRETER") notFound();

  // Group slots by date
  const slotsByDate: Record<string, { startMin: number; endMin: number }[]> = {};
  for (const s of user.availabilitySlots) {
    const key = formatLocalDate(s.date);
    if (!slotsByDate[key]) slotsByDate[key] = [];
    slotsByDate[key].push({ startMin: s.startMin, endMin: s.endMin });
  }

  // Calendar for current + next month
  const now = new Date();
  const cal1 = { year: now.getFullYear(), month: now.getMonth() };
  const cal2 = { year: now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear(), month: (now.getMonth() + 1) % 12 };

  const totalSlots = user.availabilitySlots.length;
  const uniqueDays = Object.keys(slotsByDate).length;

  return (
    <MotionIn className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">
            {user.interpreterProfile?.displayName ?? user.email ?? "Interpreter"}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Read-only availability view · {user.interpreterProfile?.location ?? "No location"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-full">{user.status}</Badge>
          <Badge variant="secondary" className="rounded-full">{uniqueDays} days · {totalSlots} slots</Badge>
          <Link
            href="/admin/availability"
            className="inline-flex h-9 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            Back
          </Link>
        </div>
      </header>

      {totalSlots === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700 px-6 py-14 text-center text-sm text-zinc-400">
          This interpreter has not set any availability yet.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {[cal1, cal2].map(({ year, month }) => {
            const days = getCalendarDays(year, month);
            return (
              <div key={`${year}-${month}`} className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 text-sm font-semibold text-zinc-950 dark:text-white">
                  {MONTHS[month]} {year}
                </div>
                <div className="grid grid-cols-7 border-b border-zinc-100 dark:border-zinc-800">
                  {WEEKDAYS_SHORT.map((d) => (
                    <div key={d} className="py-2 text-center text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {days.map((day, i) => {
                    const dateStr = formatYMD(day);
                    const daySlots = slotsByDate[dateStr] ?? [];
                    const isCurrentMonth = day.getMonth() === month;
                    const hasSlots = daySlots.length > 0;

                    return (
                      <div
                        key={i}
                        title={hasSlots ? daySlots.map((s) => `${minToHHMM(s.startMin)}–${minToHHMM(s.endMin)}`).join(", ") : undefined}
                        className={[
                          "flex flex-col items-start p-1.5 min-h-[56px] border-b border-r border-zinc-100 dark:border-zinc-800",
                          !isCurrentMonth ? "opacity-20" : "",
                          hasSlots && isCurrentMonth ? "bg-emerald-500/5" : "",
                        ].join(" ")}
                      >
                        <span className={`text-xs ${isCurrentMonth ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-300"} font-medium`}>
                          {day.getDate()}
                        </span>
                        {hasSlots && isCurrentMonth && (
                          <div className="mt-1 w-full space-y-0.5">
                            {daySlots.slice(0, 2).map((s, si) => (
                              <div key={si} className="text-[9px] leading-none rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1 py-0.5 truncate">
                                {minToHHMM(s.startMin)}–{minToHHMM(s.endMin)}
                              </div>
                            ))}
                            {daySlots.length > 2 && (
                              <div className="text-[9px] text-emerald-600 dark:text-emerald-400">+{daySlots.length - 2}</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detailed list */}
      {totalSlots > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 text-sm font-semibold text-zinc-950 dark:text-white">
            All availability slots
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-96 overflow-auto">
            {Object.entries(slotsByDate)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, slots]) => (
                <div key={date} className="flex items-center gap-4 px-5 py-3">
                  <div className="w-28 text-sm font-medium text-zinc-950 dark:text-white">
                    {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                      weekday: "short", month: "short", day: "numeric",
                    })}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {slots.map((s, i) => (
                      <span key={i} className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        {minToHHMM(s.startMin)}–{minToHHMM(s.endMin)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </MotionIn>
  );
}