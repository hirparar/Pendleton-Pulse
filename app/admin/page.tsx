import Link from "next/link";
import { MotionIn } from "@/components/motion";
import { AdminOverviewMetrics } from "./overview-metrics";

export default async function AdminHome() {
  return (
    <MotionIn className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">
          Overview
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          System health at a glance.
        </p>
      </header>

      <AdminOverviewMetrics />

      <section className="grid gap-4 lg:grid-cols-3">
        <AdminCard
          title="Approvals"
          body="Review and approve pending interpreters."
          href="/admin/approvals"
          tone="primary"
        />
        <AdminCard
          title="Interpreters"
          body="Search, inspect, and audit interpreter records."
          href="/admin/interpreters"
        />
        <AdminCard
          title="Assignments"
          body="Admins will post interpreting jobs."
          href="/admin/assignments"
        />
      </section>
    </MotionIn>
  );
}

function AdminCard({
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
  const primary =
    tone === "primary"
      ? "bg-zinc-950 text-white hover:bg-zinc-900 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
      : "bg-white text-zinc-950 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800/60";

  return (
    <Link
      href={href}
      className={[
        "group rounded-3xl border border-zinc-200 p-5 transition-colors",
        "dark:border-zinc-800",
        primary,
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
