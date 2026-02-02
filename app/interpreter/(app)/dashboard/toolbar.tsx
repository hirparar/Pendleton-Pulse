"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function JobFeedToolbar({ disabled }: { disabled?: boolean }) {
  return (
    <section className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between")}>
      <div className="flex flex-1 items-center gap-2">
        <Input
          placeholder="Search jobs (language, location, type)…"
          className="h-11 rounded-2xl bg-white dark:bg-zinc-900"
          disabled={disabled}
        />
        {disabled ? (
          <Badge variant="secondary" className="rounded-full">
            Approval required
          </Badge>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="secondary" className="h-11 rounded-2xl" disabled={disabled}>
          Filters
        </Button>
        <Button variant="secondary" className="h-11 rounded-2xl" disabled={disabled}>
          Sort: Newest
        </Button>
      </div>
    </section>
  );
}
