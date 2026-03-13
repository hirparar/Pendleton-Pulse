// app/admin/availability/[id]/page.tsx
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { notFound } from "next/navigation";
import { MotionIn } from "@/components/motion";
import Link from "next/link";
import { formatLocalDate, minToHHMM } from "@/lib/availability/service";
import { ArrowLeft, Calendar, Clock, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

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

  const slotsByDate: Record<string, { startMin: number; endMin: number }[]> = {};
  for (const s of user.availabilitySlots) {
    const key = formatLocalDate(s.date);
    if (!slotsByDate[key]) slotsByDate[key] = [];
    slotsByDate[key].push({ startMin: s.startMin, endMin: s.endMin });
  }

  const now = new Date();
  const cal1 = { year: now.getFullYear(), month: now.getMonth() };
  const cal2 = {
    year: now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear(),
    month: (now.getMonth() + 1) % 12,
  };

  const totalSlots = user.availabilitySlots.length;
  const uniqueDays = Object.keys(slotsByDate).length;
  const name = user.interpreterProfile?.displayName ?? user.email ?? "Interpreter";

  return (
    <MotionIn className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
            {user.interpreterProfile?.location && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" />
                {user.interpreterProfile.location}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="size-3.5" />
              {uniqueDays} days · {totalSlots} slots
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
            user.status === "APPROVED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-zinc-200 bg-zinc-50 text-zinc-500"
          )}>
            {user.status}
          </span>
          <Link
            href="/admin/availability"
            className="flex h-9 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </div>
      </div>

      {totalSlots === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-200 py-16">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-zinc-200 bg-zinc-50">
            <Calendar className="size-5 text-zinc-400" />
          </div>
          <p className="text-sm font-medium text-zinc-900">No availability set</p>
          <p className="text-xs text-zinc-500">This interpreter hasn't set any availability slots yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {[cal1, cal2].map(({ year, month }) => {
            const days = getCalendarDays(year, month);
            return (
              <div key={`${year}-${month}`} className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white">
                <div className="border-b border-zinc-100 px-5 py-4">
                  <p className="text-sm font-semibold text-zinc-950">{MONTHS[month]} {year}</p>
                </div>
                <div className="grid grid-cols-7 border-b border-zinc-100">
                  {WEEKDAYS_SHORT.map((d) => (
                    <div key={d} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
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
                    const isToday = formatYMD(day) === formatYMD(new Date());

                    return (
                      <div
                        key={i}
                        title={hasSlots ? daySlots.map((s) => `${minToHHMM(s.startMin)}–${minToHHMM(s.endMin)}`).join(", ") : undefined}
                        className={cn(
                          "flex min-h-[52px] flex-col items-start border-b border-r border-zinc-100 p-1.5",
                          !isCurrentMonth && "opacity-25",
                          hasSlots && isCurrentMonth && "bg-emerald-50/60"
                        )}
                      >
                        <span className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium",
                          isToday ? "bg-zinc-950 text-white" : isCurrentMonth ? "text-zinc-700" : "text-zinc-300"
                        )}>
                          {day.getDate()}
                        </span>
                        {hasSlots && isCurrentMonth && (
                          <div className="mt-0.5 w-full space-y-0.5">
                            {daySlots.slice(0, 2).map((s, si) => (
                              <div key={si} className="truncate rounded bg-emerald-500/20 px-1 py-0.5 text-[9px] leading-none text-emerald-700">
                                {minToHHMM(s.startMin)}–{minToHHMM(s.endMin)}
                              </div>
                            ))}
                            {daySlots.length > 2 && (
                              <div className="text-[9px] text-emerald-600">+{daySlots.length - 2}</div>
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

      {totalSlots > 0 && (
        <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white">
          <div className="flex items-center gap-2 border-b border-zinc-100 px-5 py-4">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-50 ring-1 ring-emerald-200/60">
              <Clock className="size-3.5 text-emerald-600" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-950">All availability slots</h2>
          </div>
          <div className="max-h-96 divide-y divide-zinc-100 overflow-auto">
            {Object.entries(slotsByDate)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, slots]) => (
                <div key={date} className="flex items-center gap-4 px-5 py-3">
                  <div className="w-32 shrink-0 text-sm font-medium text-zinc-950">
                    {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                      weekday: "short", month: "short", day: "numeric",
                    })}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {slots.map((s, i) => (
                      <span key={i} className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
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
