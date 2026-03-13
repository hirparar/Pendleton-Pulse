import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative grid h-9 w-9 place-items-center rounded-xl",
        "bg-gradient-to-br from-indigo-500 via-violet-500 to-indigo-600",
        "shadow-[0_0_0_1px_rgba(99,102,241,0.3),0_8px_24px_-8px_rgba(99,102,241,0.5)]",
        className
      )}
      aria-hidden="true"
    >
      {/* Inner highlight */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-transparent via-white/5 to-white/15" />
      {/* Mark */}
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10"
      >
        <circle cx="9" cy="9" r="3.5" fill="white" fillOpacity="0.95" />
        <circle cx="9" cy="9" r="6.5" stroke="white" strokeOpacity="0.35" strokeWidth="1.5" />
      </svg>
    </div>
  );
}
