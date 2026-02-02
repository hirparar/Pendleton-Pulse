import Link from "next/link";

export function JobFeedEmpty({ status }: { status: "PENDING" | "APPROVED" | "DENIED" }) {
  const pending = status === "PENDING";
  const denied = status === "DENIED";

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto mb-4 h-12 w-12 rounded-3xl bg-zinc-100 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700" />
      <h2 className="text-lg font-semibold tracking-tight">
        {denied ? "Access required" : "No jobs available yet"}
      </h2>

      <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-300">
        {denied
          ? "Your interpreter access is currently denied. Contact your admin if you believe this is incorrect."
          : pending
          ? "Once your account is approved, jobs posted by admins will appear here instantly."
          : "Admins haven’t posted any jobs yet. When they do, you’ll see them here with details and actions."}
      </p>

      <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
        <Link
          href="/interpreter/profile"
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-zinc-950 px-5 text-sm font-medium text-white hover:bg-zinc-900 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
        >
          Complete profile
        </Link>
        <Link
          href="/interpreter/availability"
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800/60"
        >
          Set availability
        </Link>
      </div>

      {pending ? (
        <div className="mt-6 text-xs text-zinc-500 dark:text-zinc-400">
          Tip: You can refresh approval status from the pending page.
        </div>
      ) : null}
    </section>
  );
}
