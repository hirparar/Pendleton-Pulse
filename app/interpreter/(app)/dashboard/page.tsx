// app/interpreter/(app)/dashboard/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireInterpreterEligible } from "@/lib/authz";
import { MotionIn, MotionStagger, MotionItem } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { minToHHMM } from "@/lib/availability/service";
import {
  Rss,
  Calendar,
  User,
  ArrowUpRight,
  Briefcase,
  CheckCircle2,
  CalendarDays,
  Clock,
  MapPin,
  Languages,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  function fmtDate(dateStr: string) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
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
      {/* Hero banner */}
      <section className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white p-6">
        {/* Subtle background gradient */}
        <div className="pointer-events-none absolute right-0 top-0 h-48 w-64 rounded-bl-3xl bg-gradient-to-bl from-indigo-500/6 via-transparent to-transparent" />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-950">
              Interpreter workspace
            </h1>
            <p className="text-sm text-zinc-500">
              Your live overview — availability, jobs, and upcoming commitments.
            </p>
            {/* Availability pill */}
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-zinc-200/80 bg-zinc-50 px-3 py-1.5 text-xs">
              <span className="text-zinc-400">Availability</span>
              <span className="text-zinc-300">·</span>
              <span className="font-medium text-zinc-700">
                {slotCount === 0
                  ? "No slots set"
                  : `${slotCount} slot${slotCount !== 1 ? "s" : ""} total`}
              </span>
              {daysWithAvailability > 0 && (
                <>
                  <span className="text-zinc-300">·</span>
                  <span className="font-medium text-emerald-600">
                    {daysWithAvailability} day{daysWithAvailability !== 1 ? "s" : ""} this week
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge
              variant="secondary"
              className="rounded-full text-[11px]"
            >
              {upcomingAssignments.length} upcoming
            </Badge>
            <Link href="/interpreter/availability">
              <Button size="sm" variant="secondary" className="rounded-xl">
                Set availability
              </Button>
            </Link>
          </div>
        </div>

        {/* Next assignment highlight */}
        {nextJob && (
          <>
            <Separator className="my-5 opacity-50" />
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-sky-600">
                Next assignment
              </p>
              <p className="text-sm font-semibold text-zinc-950">
                {nextJob.title}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                <span className="flex items-center gap-1">
                  <Languages className="size-3" />
                  {nextJob.languagePair}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="size-3" />
                  {nextJob.location}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {fmtTime(nextJob.scheduledStart)} → {fmtTime(nextJob.scheduledEnd)}
                </span>
              </div>
            </div>
          </>
        )}

        <Separator className="my-5 opacity-50" />

        {/* Metric row */}
        <MotionStagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MotionItem>
            <Metric
              title="Open jobs"
              value={String(openJobCount)}
              sub="Available to pick"
              color="text-primary"
              bg="bg-primary/8"
            />
          </MotionItem>
          <MotionItem>
            <Metric
              title="Upcoming"
              value={String(upcomingAssignments.length)}
              sub="Confirmed"
              color="text-sky-600"
              bg="bg-sky-500/8"
            />
          </MotionItem>
          <MotionItem>
            <Metric
              title="Avail. days"
              value={String(daysWithAvailability)}
              sub="This week"
              color="text-emerald-600"
              bg="bg-emerald-500/8"
            />
          </MotionItem>
          <MotionItem>
            <Metric
              title="Completed"
              value={String(completedCount)}
              sub="All time"
              color="text-violet-600"
              bg="bg-violet-500/8"
            />
          </MotionItem>
        </MotionStagger>
      </section>

      {/* Quick actions */}
      <MotionStagger className="grid gap-3 sm:grid-cols-3">
        <MotionItem>
          <QuickCard
            title="Browse jobs"
            body={`${openJobCount} open now`}
            href="/interpreter/jobs"
            icon={Rss}
            tone="primary"
          />
        </MotionItem>
        <MotionItem>
          <QuickCard
            title="Availability"
            body={slotCount === 0 ? "No slots yet" : `${slotCount} slots set`}
            href="/interpreter/availability"
            icon={Calendar}
          />
        </MotionItem>
        <MotionItem>
          <QuickCard
            title="Profile"
            body="Languages & certifications"
            href="/interpreter/profile"
            icon={User}
          />
        </MotionItem>
      </MotionStagger>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Availability snapshot */}
        <section className="rounded-2xl border border-zinc-200/80 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-950">
                Availability — next 7 days
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Admins see this when assigning jobs
              </p>
            </div>
            <Link href="/interpreter/availability">
              <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs">
                Edit
              </Button>
            </Link>
          </div>

          {snapshotDays.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              message="No availability set for the next 7 days"
              action={{ label: "Add it now", href: "/interpreter/availability" }}
            />
          ) : (
            <div className="space-y-2">
              {snapshotDays.map(([dateStr, slots]) => (
                <div
                  key={dateStr}
                  className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50/80 px-4 py-3"
                >
                  <p className="text-sm font-medium text-zinc-950">
                    {fmtDate(dateStr)}
                  </p>
                  <div className="flex flex-wrap justify-end gap-1">
                    {slots.map((s, i) => (
                      <span
                        key={i}
                        className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
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

        {/* Upcoming assignments */}
        <section className="rounded-2xl border border-zinc-200/80 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-950">
                Upcoming assignments
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Jobs you&apos;re confirmed for
              </p>
            </div>
            <Badge variant="secondary" className="rounded-full text-[11px]">
              {upcomingAssignments.length}
            </Badge>
          </div>

          {upcomingAssignments.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              message="No upcoming assignments"
              action={{ label: "Browse open jobs", href: "/interpreter/jobs" }}
            />
          ) : (
            <div className="space-y-2">
              {upcomingAssignments.map((a) => (
                <div
                  key={a.id}
                  className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-950">
                        {a.title}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {a.clientName} · {a.languagePair}
                      </p>
                      <p className="mt-1.5 text-xs text-zinc-600">
                        {fmtTime(a.scheduledStart)} → {fmtTime(a.scheduledEnd)}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className="shrink-0 rounded-full text-[11px]"
                    >
                      {a.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Recent activity */}
      {recentAudit.length > 0 && (
        <section className="rounded-2xl border border-zinc-200/80 bg-white p-6">
          <p className="mb-4 text-sm font-semibold text-zinc-950">
            Recent activity
          </p>
          <div>
            {recentAudit.map((e, i) => (
              <div
                key={i}
                className="flex items-start justify-between gap-3 border-b border-zinc-100 py-3 last:border-0"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-zinc-100">
                    <CheckCircle2 className="size-3 text-zinc-400" />
                  </div>
                  <div>
                    <p className="text-sm capitalize text-zinc-700">
                      {fmtAudit(e.action)}
                    </p>
                    {e.note && (
                      <p className="mt-0.5 max-w-xs truncate text-xs text-zinc-400">
                        {e.note}
                      </p>
                    )}
                  </div>
                </div>
                <p className="shrink-0 text-[11px] text-zinc-400">
                  {new Date(e.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </MotionIn>
  );
}

function Metric({
  title,
  value,
  sub,
  color,
  bg,
}: {
  title: string;
  value: string;
  sub: string;
  color: string;
  bg: string;
}) {
  return (
    <div className={cn("rounded-xl px-4 py-3.5", bg)}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
        {title}
      </p>
      <p className={cn("mt-1 text-2xl font-semibold tracking-tight tabular-nums", color)}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>
    </div>
  );
}

function QuickCard({
  title,
  body,
  href,
  icon: Icon,
  tone,
}: {
  title: string;
  body: string;
  href: string;
  icon: React.ElementType;
  tone?: "primary";
}) {
  const isPrimary = tone === "primary";
  return (
    <Link
      href={href}
      className={cn(
        "card-hover group flex items-center gap-4 rounded-2xl border p-4 transition-colors",
        isPrimary
          ? "border-primary/30 bg-primary text-primary-foreground hover:bg-primary/90"
          : "border-zinc-200/80 bg-white text-zinc-950 hover:border-zinc-300"
      )}
    >
      <div
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1",
          isPrimary
            ? "bg-white/15 ring-white/20"
            : "bg-zinc-100 ring-zinc-200/80"
        )}
      >
        <Icon
          className={cn(
            "size-5",
            isPrimary ? "text-white" : "text-zinc-600"
          )}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold tracking-tight">{title}</p>
        <p className={cn("mt-0.5 truncate text-xs", isPrimary ? "text-white/70" : "text-zinc-500")}>
          {body}
        </p>
      </div>
      <ArrowUpRight
        className={cn(
          "size-4 shrink-0 opacity-40 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-80",
          isPrimary ? "text-white" : "text-zinc-500"
        )}
      />
    </Link>
  );
}

function EmptyState({
  icon: Icon,
  message,
  action,
}: {
  icon: React.ElementType;
  message: string;
  action: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 py-10">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-100">
        <Icon className="size-5 text-zinc-400" />
      </div>
      <p className="mt-3 text-sm text-zinc-500">{message}</p>
      <Link
        href={action.href}
        className="mt-2 flex items-center gap-1 text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-900"
      >
        {action.label}
        <ArrowUpRight className="size-3" />
      </Link>
    </div>
  );
}
