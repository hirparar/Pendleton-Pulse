import { cn } from "@/lib/utils";

export function SoftCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm",
        "dark:border-zinc-800 dark:bg-zinc-900",
        className
      )}
    >
      {children}
    </section>
  );
}

export function SoftCardTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-white">
      {children}
    </div>
  );
}

export function SoftCardHint({ children }: { children: React.ReactNode }) {
  return <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{children}</div>;
}
