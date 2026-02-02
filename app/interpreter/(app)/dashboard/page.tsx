import { requireInterpreter } from "@/lib/authz";
import { MotionIn } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { JobFeedToolbar } from "./toolbar";
import { JobFeedEmpty } from "./views/empty";
import { JobsSkeleton } from "./views/skeleton";

export default async function InterpreterDashboard() {
  const profile = await requireInterpreter();

  // Future: fetch jobs once job logic exists
  const jobs: any[] = [];
  const isLoading = false;

  const isPending = profile.status === "PENDING";
  const isDenied = profile.status === "DENIED";

  return (
    <MotionIn className="space-y-6">
      {/* Hero */}
      <section className="flex flex-col gap-3 rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Available interpreting jobs</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Jobs posted by admins will appear here. Filter, open details, and express interest.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              {jobs.length} jobs
            </Badge>
            <Button className="rounded-2xl" variant="secondary">
              Set availability
            </Button>
          </div>
        </div>

        {isPending ? (
          <div className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
            Your account is pending approval. Once approved, you’ll be able to view and take jobs.
          </div>
        ) : null}

        {isDenied ? (
          <div className="mt-4 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-900 dark:text-rose-200">
            Your access was denied. If this is a mistake, contact your admin or support.
          </div>
        ) : null}
      </section>

      {/* Metrics (job-first, honest zeros) */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Metric title="Available jobs" value={`${jobs.length}`} hint="Jobs posted and currently open." />
        <Metric title="Upcoming assignments" value="0" hint="Once you accept jobs, they’ll appear here." />
        <Metric title="Completed this month" value="0" hint="Your completed jobs will show here." />
      </section>

      <Separator className="opacity-70" />

      {/* Feed Toolbar */}
      <JobFeedToolbar disabled={profile.status !== "APPROVED"} />

      {/* Feed */}
      {isLoading ? (
        <JobsSkeleton />
      ) : jobs.length === 0 ? (
        <JobFeedEmpty status={profile.status} />
      ) : (
        <div className="space-y-3">{/* Future: map jobs into JobCard list */}</div>
      )}
    </MotionIn>
  );
}

function Metric({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-sm font-semibold tracking-tight">{title}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{hint}</div>
    </div>
  );
}
