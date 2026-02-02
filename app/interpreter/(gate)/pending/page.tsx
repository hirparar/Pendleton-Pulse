import { requireInterpreter } from "@/lib/authz";
import { MotionIn } from "@/components/motion";
import { PendingClientWatcher } from "./watcher";

export default async function PendingPage() {
  const profile = await requireInterpreter();

  return (
    <MotionIn className="mx-auto max-w-2xl space-y-6">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold tracking-tight">Approval in progress</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Your interpreter account is being reviewed. Once approved, you’ll gain access to the full job feed.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Step label="Request received" state="done" />
          <Step label="Admin review" state="active" />
          <Step label="Access granted" state="locked" />
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
          Keep this tab open — we’ll automatically redirect you when approval completes.
        </div>
      </section>

      <PendingClientWatcher initialStatus={profile.status} />
    </MotionIn>
  );
}

function Step({
  label,
  state,
}: {
  label: string;
  state: "done" | "active" | "locked";
}) {
  const dot =
    state === "done"
      ? "bg-emerald-500"
      : state === "active"
      ? "bg-amber-500 animate-pulse"
      : "bg-zinc-300 dark:bg-zinc-700";

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2">
        <div className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        <div className="text-xs font-medium tracking-tight">{label}</div>
      </div>
    </div>
  );
}
