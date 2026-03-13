import Link from "next/link";
import { MotionIn, MotionStagger, MotionItem } from "@/components/motion";
import { AdminOverviewMetrics } from "./overview-metrics";
import { UserCheck, Briefcase, Users, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

const ADMIN_CARDS = [
  {
    title: "Approvals",
    body: "Review and approve pending interpreter accounts to grant platform access.",
    href: "/admin/approvals",
    icon: UserCheck,
    tone: "primary" as const,
  },
  {
    title: "Interpreters",
    body: "Search, inspect, and audit all interpreter records in the system.",
    href: "/admin/interpreters",
    icon: Users,
  },
  {
    title: "Assignments",
    body: "Post and manage interpreting jobs visible to eligible interpreters.",
    href: "/admin/assignments",
    icon: Briefcase,
  },
];

export default async function AdminHome() {
  return (
    <MotionIn className="space-y-8">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
          Overview
        </h1>
        <p className="text-sm text-zinc-500">
          System health at a glance.
        </p>
      </header>

      <AdminOverviewMetrics />

      <section className="space-y-3">
        <p className="text-sm font-medium text-zinc-500">
          Quick navigation
        </p>
        <MotionStagger className="grid gap-4 lg:grid-cols-3">
          {ADMIN_CARDS.map((card) => (
            <MotionItem key={card.href}>
              <AdminCard {...card} />
            </MotionItem>
          ))}
        </MotionStagger>
      </section>
    </MotionIn>
  );
}

function AdminCard({
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
        "card-hover group relative flex flex-col gap-4 overflow-hidden rounded-2xl border p-5 transition-colors",
        isPrimary
          ? "border-primary/30 bg-primary text-primary-foreground hover:bg-primary/90"
          : "border-zinc-200/80 bg-white text-zinc-950 hover:border-zinc-300"
      )}
    >
      {/* Subtle bg glow for primary */}
      {isPrimary && (
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
      )}

      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "grid h-10 w-10 place-items-center rounded-xl ring-1",
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
        <ArrowUpRight
          className={cn(
            "size-4 opacity-40 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-80",
            isPrimary ? "text-white" : "text-zinc-500"
          )}
        />
      </div>

      <div className="space-y-1">
        <p className={cn("text-sm font-semibold tracking-tight", isPrimary ? "text-white" : "")}>
          {title}
        </p>
        <p className={cn("text-xs leading-relaxed", isPrimary ? "text-white/70" : "text-zinc-500")}>
          {body}
        </p>
      </div>
    </Link>
  );
}
