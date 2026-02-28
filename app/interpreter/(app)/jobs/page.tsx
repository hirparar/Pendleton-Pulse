// app/interpreter/jobs/page.tsx
import { prisma } from "@/lib/prisma";
import { requireInterpreterEligible } from "@/lib/authz";
import { MotionIn } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { listJobsForInterpreter } from "@/lib/assignments/service";

export const dynamic = "force-dynamic";

function fmt(iso: Date) {
  return iso.toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function durationStr(start: Date, end: Date) {
  const diff = end.getTime() - start.getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.round((diff % 3600000) / 60000);
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
}

export default async function InterpreterJobsPage() {
  const me = await requireInterpreterEligible();
  const jobs = await listJobsForInterpreter(me.id);

  const open = jobs.filter((j) => j.status === "OPEN");
  const assigned = jobs.filter((j) => j.status === "ASSIGNED");

  return (
    <MotionIn className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">Job feed</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Assignments visible to you based on your eligibility and visibility settings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-full">{open.length} open</Badge>
          <Badge variant="secondary" className="rounded-full bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
            {assigned.length} assigned
          </Badge>
        </div>
      </header>

      {jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700 px-6 py-16 text-center">
          <div className="text-sm font-medium text-zinc-950 dark:text-white mb-1">No jobs available</div>
          <div className="text-xs text-zinc-400">New assignments will appear here when admins post them.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const filled = job._count.interpreters;
            const isFull = filled >= job.interpretersNeeded;
            return (
              <div
                key={job.id}
                className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 p-5 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-zinc-950 dark:text-white">{job.title}</span>
                      <span
                        className={[
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                          job.status === "OPEN"
                            ? "bg-sky-500/10 text-sky-700 border-sky-500/20 dark:text-sky-300"
                            : "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-300",
                        ].join(" ")}
                      >
                        {job.status}
                      </span>
                    </div>

                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {job.clientName} · {job.languagePair} · {job.assignmentType}
                    </div>

                    <div className="text-xs text-zinc-600 dark:text-zinc-300">
                      📍 {job.location}
                    </div>

                    <div className="text-xs text-zinc-600 dark:text-zinc-300">
                      🗓 {fmt(job.scheduledStart)} → {fmt(job.scheduledEnd)}{" "}
                      <span className="text-zinc-400">({durationStr(job.scheduledStart, job.scheduledEnd)})</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <div
                      className={[
                        "text-xs font-medium rounded-full px-2.5 py-1",
                        isFull
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                      ].join(" ")}
                    >
                      {filled}/{job.interpretersNeeded} filled
                    </div>

                    {job.specialNotes && (
                      <div className="text-[11px] text-zinc-400 max-w-48 text-right truncate">
                        Note: {job.specialNotes}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </MotionIn>
  );
}