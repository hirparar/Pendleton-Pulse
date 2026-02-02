import Link from "next/link";
import { MotionIn } from "@/components/motion";

export default function DeniedPage() {
  return (
    <MotionIn className="mx-auto max-w-2xl space-y-6">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold tracking-tight">Access denied</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Your interpreter access request was denied. If you believe this is a mistake, contact your admin.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/interpreter/support"
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-zinc-950 px-5 text-sm font-medium text-white hover:bg-zinc-900 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
          >
            Contact support
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800/60"
          >
            Switch account
          </Link>
        </div>
      </section>
    </MotionIn>
  );
}
