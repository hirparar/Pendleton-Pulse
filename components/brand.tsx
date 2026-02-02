import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid h-9 w-9 place-items-center rounded-2xl",
        "bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-amber-400",
        "shadow-[0_12px_30px_-18px_rgba(99,102,241,.65)]",
        className
      )}
      aria-hidden="true"
    >
      <div className="h-4.5 w-4.5 rounded-xl bg-white/90 mix-blend-soft-light" />
    </div>
  );
}
