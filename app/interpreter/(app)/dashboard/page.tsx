// app/interpreter/(app)/dashboard/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireInterpreterEligible } from "@/lib/authz";
import { MotionIn } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { minToHHMM } from "@/lib/availability/service";

export const dynamic = "force-dynamic";

export default async function InterpreterDashboard() {
  const me = await requireInterpreterEligible();

  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysOut = new Date(today);
  sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);

  const [
    slotCount,
    upcomingSlots,
    upcomingAssignments,
    openJobCount,
    completedCount,
    recentAudit,
  ] = await Promise.all([
    prisma.availabilitySlot.count({ where: { userProfileId: me.id } }),

    prisma.availabilitySlot.findMany({
      where: { userProfileId: me.id, date: { gte: today, lte: sevenDaysOut } },
      orderBy: [{ date: "asc" }, { startMin: "asc" }],
    }),

    prisma.assignment.findMany({
      where: {
        interpreters: { some: { userProfileId: me.id, status: "ASSIGNED" } },
        scheduledStart: { gte: now },
      },
      orderBy: { scheduledStart: "asc" },
      take: 5,
    }),

    prisma.assignment.count({
      where: {
        status: "OPEN",
        OR: [
          { visibilityMode: "ALL" },
          { visibilityMode: "RESTRICTED", visibility: { some: { userProfileId: me.id } } },
        ],
      },
    }),

    prisma.assignment.count({
      where: {
        interpreters: { some: { userProfileId: me.id, status: "ASSIGNED" } },
        status: "COMPLETED",
      },
    }),

    prisma.auditEvent.findMany({
      where: { userProfileId: me.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { action: true, note: true, createdAt: true },
    }),
  ]);

  const slotsByDate: Record<string, { startMin: number; endMin: number }[]> = {};
  for (const s of upcomingSlots) {
    const key = s.date.toISOString().slice(0, 10);
    if (!slotsByDate[key]) slotsByDate[key] = [];
    slotsByDate[key].push({ startMin: s.startMin, endMin: s.endMin });
  }
  const snapshotDays = Object.entries(slotsByDate).slice(0, 6);
  const daysWithAvailability = Object.keys(slotsByDate).length;
  const nextJob = upcomingAssignments[0] ?? null;

  function fmtTime(d: Date) {
    return d.toLocaleString("en-US", {
      month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    });
  }

  function fmtDate(dateStr: string) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric",
    });
  }

  function fmtAudit(action: string) {
    const map: Record<string, string> = {
      INTERPRETER_SELF_REQUESTED: "Picked a job",
      INTERPRETER_WITHDREW: "Withdrew from a job",
      APPROVED: "Account approved",
      ACTIVATED: "Account activated",
      DEACTIVATED: "Account deactivated",
    };
    return map[action] ?? action.replace(/_/g, " ").toLowerCase();
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
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Your live overview — availability, jobs, and upcoming commitments.
            </p>
            <div className="mt-2 inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-950">
              <span className="text-zinc-400">Availability</span>
              <span className="text-zinc-300 dark:text-zinc-700">·</span>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {slotCount === 0 ? "No slots set" : `${slotCount} slot${slotCount !== 1 ? "s" : ""} total`}
              </span>
              {daysWithAvailability > 0 && (
                <>
                  <span className="text-zinc-300 dark:text-zinc-700">·</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {daysWithAvailability} day{daysWithAvailability !== 1 ? "s" : ""} this week
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="rounded-full">{upcomingAssignments.length} upcoming</Badge>
            <Link href="/interpreter/availability">
              <Button variant="secondary" className="h-10 rounded-2xl">Set availability</Button>
            </Link>
          </div>
        </div>

        {nextJob && (
          <>
            <Separator className="my-4 opacity-60" />
            <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 px-4 py-3">
              <div className="text-[10px] font-medium uppercase tracking-wider text-sky-600 dark:text-sky-400 mb-1">
                Next assignment
              </div>
              <div className="text-sm font-semibold text-zinc-950 dark:text-white">{nextJob.title}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {nextJob.clientName} · {nextJob.languagePair} · {nextJob.location}
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-300 mt-1">
                {fmtTime(nextJob.scheduledStart)} → {fmtTime(nextJob.scheduledEnd)}
              </div>
            </div>
          </>
        )}

        <Separator className="my-4 opacity-60" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric title="Open jobs" value={String(openJobCount)} sub="Available to pick" />
          <Metric title="Upcoming" value={String(upcomingAssignments.length)} sub="Confirmed" />
          <Metric title="Avail. days" value={String(daysWithAvailability)} sub="This week" />
          <Metric title="Completed" value={String(completedCount)} sub="All time" />
        </div>
      </section>

      {/* Quick actions */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickCard title="Browse jobs" body={`${openJobCount} open now`} href="/interpreter/jobs" tone="primary" />
        <QuickCard title="Availability" body={slotCount === 0 ? "No slots yet" : `${slotCount} slots set`} href="/interpreter/availability" />
        <QuickCard title="Profile" body="Languages & certifications" href="/interpreter/profile" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Availability snapshot */}
        <section className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold text-zinc-950 dark:text-white">Availability — next 7 days</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Admins see this when assigning jobs</div>
            </div>
            <Link href="/interpreter/availability">
              <Button variant="secondary" className="h-9 rounded-2xl text-xs">Edit</Button>
            </Link>
          </div>

          {snapshotDays.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700 px-4 py-8 text-center">
              <div className="text-sm text-zinc-400 mb-2">No availability set for the next 7 days</div>
              <Link href="/interpreter/availability" className="text-xs underline underline-offset-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200">
                Add it now →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {snapshotDays.map(([dateStr, slots]) => (
                <div key={dateStr} className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="text-sm font-medium text-zinc-950 dark:text-white">{fmtDate(dateStr)}</div>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {slots.map((s, i) => (
                      <span key={i} className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                        {minToHHMM(s.startMin)}–{minToHHMM(s.endMin)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Upcoming assignments */}
        <section className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold text-zinc-950 dark:text-white">Upcoming assignments</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Jobs you're confirmed for</div>
            </div>
            <Badge variant="secondary" className="rounded-full">{upcomingAssignments.length}</Badge>
          </div>

          {upcomingAssignments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700 px-4 py-8 text-center">
              <div className="text-sm text-zinc-400 mb-2">No upcoming assignments</div>
              <Link href="/interpreter/jobs" className="text-xs underline underline-offset-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200">
                Browse open jobs →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingAssignments.map((a) => (
                <div key={a.id} className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-zinc-950 dark:text-white truncate">{a.title}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{a.clientName} · {a.languagePair}</div>
                      <div className="text-xs text-zinc-600 dark:text-zinc-300 mt-1.5">
                        {fmtTime(a.scheduledStart)} → {fmtTime(a.scheduledEnd)}
                      </div>
                    </div>
                    <Badge variant="secondary" className="rounded-full flex-shrink-0 text-[11px]">{a.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Recent activity */}
      {recentAudit.length > 0 && (
        <section className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-sm font-semibold text-zinc-950 dark:text-white mb-4">Recent activity</div>
          <div className="space-y-0">
            {recentAudit.map((e, i) => (
              <div key={i} className="flex items-start justify-between gap-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                <div>
                  <div className="text-sm text-zinc-700 dark:text-zinc-300 capitalize">{fmtAudit(e.action)}</div>
                  {e.note && <div className="text-xs text-zinc-400 mt-0.5 truncate max-w-xs">{e.note}</div>}
                </div>
                <div className="text-[11px] text-zinc-400 flex-shrink-0">
                  {new Date(e.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </MotionIn>
  );
}

function Metric({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 mb-1">{title}</div>
      <div className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">{value}</div>
      <div className="text-xs text-zinc-400 mt-1">{sub}</div>
    </div>
  );
}

function QuickCard({ title, body, href, tone }: { title: string; body: string; href: string; tone?: "primary" }) {
  const cls = tone === "primary"
    ? "bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
    : "bg-white text-zinc-950 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800/60";
  return (
    <Link href={href} className={`group rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 transition-colors ${cls}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs opacity-70 mt-0.5">{body}</div>
        </div>
        <span className="text-xs opacity-50 transition group-hover:translate-x-0.5">↗</span>
      </div>
    </Link>
  );
}