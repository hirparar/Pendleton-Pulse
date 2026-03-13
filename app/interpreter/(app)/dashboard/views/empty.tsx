import Link from "next/link";
import { Briefcase, Clock, XCircle, User, Calendar, ArrowRight } from "lucide-react";

export function JobFeedEmpty({ status }: { status: "PENDING" | "APPROVED" | "DENIED" }) {
  const pending = status === "PENDING";
  const denied = status === "DENIED";

  const Icon = denied ? XCircle : pending ? Clock : Briefcase;
  const iconColor = denied ? "text-rose-500" : pending ? "text-amber-500" : "text-zinc-400";
  const iconBg = denied ? "bg-rose-50 ring-rose-200/60" : pending ? "bg-amber-50 ring-amber-200/60" : "bg-zinc-50 ring-zinc-200/60";

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 py-16">
      <div className={`grid h-14 w-14 place-items-center rounded-2xl ring-1 ${iconBg}`}>
        <Icon className={`size-6 ${iconColor}`} />
      </div>
      <h2 className="mt-4 text-base font-semibold tracking-tight text-zinc-950">
        {denied ? "Access required" : pending ? "Awaiting approval" : "No jobs available yet"}
      </h2>
      <p className="mx-auto mt-1.5 max-w-sm text-center text-sm text-zinc-500">
        {denied
          ? "Your interpreter access is currently denied. Contact your admin if you believe this is incorrect."
          : pending
          ? "Once your account is approved, jobs posted by admins will appear here instantly."
          : "Admins haven't posted any jobs yet. When they do, you'll see them here with all details."}
      </p>
      <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row">
        <Link
          href="/interpreter/profile"
          className="flex h-9 items-center gap-2 rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          <User className="size-4" />
          Complete profile
        </Link>
        <Link
          href="/interpreter/availability"
          className="flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
        >
          <Calendar className="size-4" />
          Set availability
          <ArrowRight className="size-3.5 opacity-60" />
        </Link>
      </div>
      {pending && (
        <p className="mt-4 text-xs text-zinc-400">
          You can refresh your approval status from the pending page.
        </p>
      )}
    </div>
  );
}
