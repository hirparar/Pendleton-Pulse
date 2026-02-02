import { Skeleton } from "@/components/ui/skeleton";

export function JobsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <Skeleton className="h-5 w-64" />
              <Skeleton className="h-4 w-80" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-10 w-28 rounded-2xl" />
          </div>
        </div>
      ))}
    </div>
  );
}
