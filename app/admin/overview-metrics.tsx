"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { MotionStagger, MotionItem } from "@/components/motion";
import { Users, UserCheck, UserMinus, Clock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type Metrics = {
  totalInterpreters: number;
  activeInterpreters: number;
  inactiveInterpreters: number;
  pendingApprovals: number;
};

type MetricConfig = {
  title: string;
  hint: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  ring: string;
  bar: string;
  valueCls: string;
};

const METRIC_CONFIG: MetricConfig[] = [
  {
    title: "Total interpreters",
    hint: "All interpreter accounts in the system.",
    icon: Users,
    color: "text-violet-600",
    bg: "bg-violet-500/8",
    ring: "ring-violet-500/20",
    bar: "bg-violet-500",
    valueCls: "text-zinc-950",
  },
  {
    title: "Active",
    hint: "Active = allowed to use the interpreter app (if approved).",
    icon: UserCheck,
    color: "text-emerald-600",
    bg: "bg-emerald-500/8",
    ring: "ring-emerald-500/20",
    bar: "bg-emerald-500",
    valueCls: "text-emerald-700",
  },
  {
    title: "Inactive",
    hint: "Inactive accounts are blocked from interpreter pages and APIs.",
    icon: UserMinus,
    color: "text-rose-600",
    bg: "bg-rose-500/8",
    ring: "ring-rose-500/20",
    bar: "bg-rose-500",
    valueCls: "text-rose-700",
  },
  {
    title: "Pending approvals",
    hint: "Awaiting admin review.",
    icon: Clock,
    color: "text-amber-600",
    bg: "bg-amber-500/8",
    ring: "ring-amber-500/20",
    bar: "bg-amber-500",
    valueCls: "text-amber-700",
  },
];

export function AdminOverviewMetrics() {
  const [data, setData] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function load() {
    setError(null);
    const res = await fetch("/api/admin/metrics", { cache: "no-store" });
    if (!res.ok) {
      setError("Metrics failed to load.");
      setData(null);
      return;
    }
    const json = (await res.json()) as Metrics;
    setData(json);
  }

  useEffect(() => {
    startTransition(() => {
      void load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const values = data
    ? [
        data.totalInterpreters,
        data.activeInterpreters,
        data.inactiveInterpreters,
        data.pendingApprovals,
      ]
    : [null, null, null, null];

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold tracking-tight text-zinc-950">
          System metrics
        </p>
        <div className="flex items-center gap-2">
          {isPending && (
            <span className="text-xs text-zinc-400">Refreshing…</span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-lg text-xs"
            onClick={() => startTransition(() => void load())}
            disabled={isPending}
          >
            <RefreshCw className={cn("size-3", isPending && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5">
          <p className="text-sm font-medium text-rose-800">
            Couldn&apos;t load metrics
          </p>
          <p className="mt-1 text-xs text-rose-600/80">
            {error}
          </p>
          <Button
            size="sm"
            className="mt-3 h-8 rounded-lg"
            onClick={() => startTransition(() => void load())}
            disabled={isPending}
          >
            Retry
          </Button>
        </div>
      ) : null}

      <MotionStagger className="grid gap-4 lg:grid-cols-4">
        {METRIC_CONFIG.map((cfg, i) => (
          <MotionItem key={cfg.title}>
            <MetricCard
              {...cfg}
              value={values[i] !== null ? String(values[i]) : "—"}
              loading={isPending && data === null}
            />
          </MotionItem>
        ))}
      </MotionStagger>
    </section>
  );
}

function MetricCard({
  title,
  hint,
  icon: Icon,
  color,
  bg,
  ring,
  bar,
  valueCls,
  value,
  loading,
}: MetricConfig & { value: string; loading: boolean }) {
  return (
    <div className="card-hover group relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white p-5">
      {/* Colored accent top bar */}
      <div className={cn("absolute inset-x-0 top-0 h-0.5 opacity-70", bar)} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-zinc-500">
            {title}
          </p>
          <p className={cn("mt-2 text-3xl font-semibold tracking-tight tabular-nums", valueCls)}>
            {loading ? (
              <span className="inline-block h-8 w-12 rounded-lg skeleton" />
            ) : (
              value
            )}
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
            {hint}
          </p>
        </div>
        <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1", bg, ring)}>
          <Icon className={cn("size-4", color)} />
        </div>
      </div>
    </div>
  );
}
