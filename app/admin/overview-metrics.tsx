"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

type Metrics = {
  totalInterpreters: number;
  activeInterpreters: number;
  inactiveInterpreters: number;
  pendingApprovals: number;
};

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

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-white">
          System metrics
        </div>

        <div className="flex items-center gap-2">
          {isPending ? (
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Loading…</div>
          ) : null}

          <Button
            variant="secondary"
            className="h-9 rounded-2xl"
            onClick={() => startTransition(() => void load())}
            disabled={isPending}
          >
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-5 text-sm text-rose-900 dark:text-rose-200">
          <div className="font-medium">Couldn’t load metrics</div>
          <div className="mt-1 opacity-90">{error}</div>
          <div className="mt-3">
            <Button
              className="h-10 rounded-2xl bg-zinc-950 text-white hover:bg-zinc-900 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
              onClick={() => startTransition(() => void load())}
              disabled={isPending}
            >
              Retry
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-4">
        <Metric
          title="Total interpreters"
          value={data ? String(data.totalInterpreters) : "—"}
          hint="All interpreter accounts in the system."
        />
        <Metric
          title="Active interpreters"
          value={data ? String(data.activeInterpreters) : "—"}
          hint="Active = allowed to use the interpreter app (if approved)."
        />
        <Metric
          title="Inactive interpreters"
          value={data ? String(data.inactiveInterpreters) : "—"}
          hint="Inactive accounts are blocked from interpreter pages and APIs."
        />
        <Metric
          title="Pending approvals"
          value={data ? String(data.pendingApprovals) : "—"}
          hint="Awaiting admin review."
        />
      </div>
    </section>
  );
}

function Metric({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-white">{title}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white">
        {value}
      </div>
      <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{hint}</div>
    </div>
  );
}
