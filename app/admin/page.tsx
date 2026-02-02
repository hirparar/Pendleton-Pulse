import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MotionIn } from "@/components/motion";

export default async function AdminHome() {
  const [pending, totalInterpreters] = await Promise.all([
    prisma.userProfile.count({ where: { role: "INTERPRETER", status: "PENDING" } }),
    prisma.userProfile.count({ where: { role: "INTERPRETER" } }),
  ]);

  return (
    <MotionIn className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">
          Admin overview
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Jobs are the primary workflow. Use this console to manage people and access.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        <AdminCard
          title="Jobs"
          body="Create and manage interpreting jobs (coming soon)."
          href="/admin/jobs"
          tone="primary"
        />
        <AdminCard
          title="Interpreters"
          body={`${totalInterpreters} total interpreters in the directory.`}
          href="/admin/interpreters"
        />
        <AdminCard
          title="Approvals"
          body={`${pending} interpreter request(s) waiting for review.`}
          href="/admin/pending"
        />
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-white">
          What’s next
        </div>
        <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Once jobs are implemented, the main admin workflow will shift to:
          <span className="font-medium text-zinc-900 dark:text-white"> post jobs → match interpreters → manage assignments</span>.
          The approvals system stays as an access gate, not the product.
        </div>
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
