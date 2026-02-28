// app/interpreter/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireInterpreterEligible } from "@/lib/authz";
import { MotionIn } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { minToHHMM, formatLocalDate } from "@/lib/availability/service";

export const dynamic = "force-dynamic";

export default async function InterpreterDashboard() {
  const me = await requireInterpreterEligible();

  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysOut = new Date(today);
  sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);

  const [slotCount, upcomingSlots, upcoming] = await Promise.all([
    // Total slots set (across all time)
    prisma.availabilitySlot.count({ where: { userProfileId: me.id } }),

    // Slots in the next 7 days for the dashboard snapshot
    prisma.availabilitySlot.findMany({
      where: {
        userProfileId: me.id,
        date: { gte: today, lte: sevenDaysOut },
      },
      orderBy: [{ date: "asc" }, { startMin: "asc" }],
    }),

    // Upcoming assigned jobs
    prisma.assignment.findMany({
      where: {
        interpreters: { some: { userProfileId: me.id, status: "ASSIGNED" } },
        scheduledStart: { gte: now },
      },
      orderBy: { scheduledStart: "asc" },
      take: 5,
    }),
  ]);

  // Group slots by date for the snapshot
  const slotsByDate: Record<string, { startMin: number; endMin: number }[]> = {};
  for (const s of upcomingSlots) {
    const key = formatLocalDate(s.date);
    if (!slotsByDate[key]) slotsByDate[key] = [];
    slotsByDate[key].push({ startMin: s.startMin, endMin: s.endMin });
  }

  const snapshotDays = Object.entries(slotsByDate).slice(0, 6);
  const daysWithAvailability = Object.keys(slotsByDate).length;

  function fmtJobTime(d: Date) {
    return d.toLocaleString("en-US", {
      month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    });
  }

  function fmtSnapshotDate(dateStr: string) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric",
    });
  }

  return (
    <MotionIn className="space-y-6">
      {/* Hero */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">
              Interpreter workspace
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Manage your availability and upcoming commitments.
            </p>

            <div className="mt-2 inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
              <span className="text-zinc-500 dark:text-zinc-400">Availability</span>
              <span className="text-zinc-400">·</span>
              <span className="font-medium">
                {slotCount === 0
                  ? "No slots set"
                  : `${slotCount} total slot${slotCount !== 1 ? "s" : ""}`}
              </span>
              {daysWithAvailability > 0 && (
                <>
                  <span className="text-zinc-400">·</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    {daysWithAvailability} day{daysWithAvailability !== 1 ? "s" : ""} this week
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              {upcoming.length} upcoming
            </Badge>
            <Link href="/interpreter/availability">
              <Button className="h-11 rounded-2xl" variant="secondary">
                Set availability
              </Button>
            </Link>
          </div>
        </div>

        <Separator className="my-5 opacity-60" />

        <div className="grid gap-4 lg:grid-cols-3">
          <Metric
            title="Available jobs"
            value="—"
            hint="Job feed visible once admin posts open assignments."
          />
          <Metric
            title="Upcoming commitments"
            value={String(upcoming.length)}
            hint="Assignments you're already scheduled for."
          />
          <Metric
            title="Availability slots"
            value={String(slotCount)}
            hint="More slots set = better matching by admins."
          />
        </div>
      </section>

      {/* Quick actions */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card
          title="Availability"
          body="Set day-by-day windows. Use templates for recurring schedules."
          href="/interpreter/availability"
          tone="primary"
        />
        <Card
          title="Jobs"
          body="Browse open assignments visible to you."
          href="/interpreter/jobs"
        />
        <Card
          title="Profile"
          body="Keep languages and certifications accurate."
          href="/interpreter/profile"
        />
      </section>

      {/* Availability snapshot — next 7 days */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-white">
              Availability — next 7 days
            </div>
            <div className="text-sm text-zinc-600 dark:text-zinc-300">
              Days you have availability set. Admins see this when assigning jobs.
            </div>
          </div>

          <Link href="/interpreter/availability">
            <Button variant="secondary" className="h-10 rounded-2xl">
              Edit
            </Button>
          </Link>
        </div>

        <Separator className="my-5 opacity-60" />

        {snapshotDays.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
            No availability set for the next 7 days.{" "}
            <Link href="/interpreter/availability" className="underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-200">
              Add it now →
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {snapshotDays.map(([dateStr, slots]) => (
              <div
                key={dateStr}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-zinc-950 dark:text-white">
                    {fmtSnapshotDate(dateStr)}
                  </div>
                  <Badge variant="secondary" className="rounded-full text-[11px]">
                    {slots.length} slot{slots.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {slots.map((s, i) => (
                    <span
                      key={i}
                      className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300"
                    >
                      {minToHHMM(s.startMin)}–{minToHHMM(s.endMin)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Upcoming commitments */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-white">
              Upcoming commitments
            </div>
            <div className="text-sm text-zinc-600 dark:text-zinc-300">
              Assignments you're scheduled for.
            </div>
          </div>

          <Badge variant="secondary" className="rounded-full">
            {upcoming.length}
          </Badge>
        </div>

        <Separator className="my-5 opacity-60" />

        {upcoming.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
            No assignments yet. When an admin assigns you, they'll appear here automatically.
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((a) => (
              <div
                key={a.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-white">
                      {a.title}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {a.clientName} · {a.languagePair} · {a.assignmentType}
                    </div>
                    <div className="text-xs text-zinc-400 dark:text-zinc-500">{a.location}</div>
                    <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
                      {fmtJobTime(a.scheduledStart)} → {fmtJobTime(a.scheduledEnd)}
                    </div>
                  </div>

                  <Badge variant="secondary" className="rounded-full flex-shrink-0">
                    {a.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </MotionIn>
  );
}

function Metric({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-white">{title}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white">{value}</div>
      <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{hint}</div>
    </div>
  );
}

function Card({
  title,
  body,
  href,
  tone,
}: {
  title: string;
  body: string;
  href: string;
  tone?: "primary";
}) {
  const cls =
    tone === "primary"
      ? "bg-zinc-950 text-white hover:bg-zinc-900 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
      : "bg-white text-zinc-950 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800/60";

  return (
    <Link
      href={href}
      className={[
        "group rounded-3xl border border-zinc-200 p-5 transition-colors dark:border-zinc-800",
        cls,
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="text-sm font-semibold tracking-tight">{title}</div>
          <div className="text-sm opacity-80">{body}</div>
        </div>
        <div className="text-sm opacity-70 transition group-hover:translate-x-0.5">↗</div>
      </div>
    </Link>
  );
}