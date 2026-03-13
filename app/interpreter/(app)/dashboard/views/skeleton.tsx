export function JobsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-zinc-200/80 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <div className="skeleton h-5 w-16 rounded-full" />
                <div className="skeleton h-5 w-20 rounded-full" />
              </div>
              <div className="skeleton h-4 w-3/4 rounded-lg" />
              <div className="skeleton h-3 w-1/2 rounded-lg" />
              <div className="flex gap-2">
                <div className="skeleton h-3 w-24 rounded-lg" />
                <div className="skeleton h-3 w-16 rounded-lg" />
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <div className="skeleton h-7 w-12 rounded-full" />
              <div className="flex gap-2">
                <div className="skeleton h-8 w-16 rounded-lg" />
                <div className="skeleton h-8 w-20 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
