import { requireInterpreter } from "@/lib/authz";
import { MotionIn } from "@/components/motion";
import { PendingClientWatcher } from "./watcher";
import { CheckCircle2, Clock, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function PendingPage() {
  const profile = await requireInterpreter();

  const steps = [
    {
      icon: CheckCircle2,
      label: "Request received",
      sub: "Your account was created",
      state: "done" as const,
    },
    {
      icon: Clock,
      label: "Admin review",
      sub: "Under review now",
      state: "active" as const,
    },
    {
      icon: ShieldCheck,
      label: "Access granted",
      sub: "You'll be redirected",
      state: "locked" as const,
    },
  ];

  return (
    <MotionIn className="mx-auto max-w-lg space-y-4">
      {/* Main card */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white p-8">
        {/* Subtle top gradient */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        <div className="flex flex-col items-center text-center">
          {/* Icon */}
          <div className="relative mb-6">
            <div className="grid h-16 w-16 place-items-center rounded-2xl border border-amber-200/80 bg-amber-50 shadow-sm">
              <Clock className="size-7 text-amber-600" />
            </div>
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
            </span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
            Approval in progress
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">
            Your interpreter account is being reviewed by an administrator. Once
            approved, you&apos;ll get instant access to the full job feed.
          </p>
        </div>

        {/* Steps */}
        <div className="mt-8 space-y-2">
          {steps.map((step, i) => (
            <StepRow key={i} {...step} />
          ))}
        </div>

        {/* Info banner */}
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-zinc-400" />
          <p className="text-xs leading-relaxed text-zinc-500">
            Keep this tab open — we&apos;ll automatically redirect you the moment
            your status changes. No need to refresh.
          </p>
        </div>
      </div>

      {/* Live watcher */}
      <PendingClientWatcher initialStatus={profile.status} />
    </MotionIn>
  );
}

function StepRow({
  icon: Icon,
  label,
  sub,
  state,
}: {
  icon: React.ElementType;
  label: string;
  sub: string;
  state: "done" | "active" | "locked";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3 transition-all",
        state === "done" && "border-emerald-200/80 bg-emerald-50/60",
        state === "active" && "border-amber-200/80 bg-amber-50/60",
        state === "locked" && "border-zinc-100 bg-zinc-50/60 opacity-60"
      )}
    >
      <div
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
          state === "done" && "bg-emerald-100",
          state === "active" && "bg-amber-100",
          state === "locked" && "bg-zinc-100"
        )}
      >
        <Icon
          className={cn(
            "size-4",
            state === "done" && "text-emerald-600",
            state === "active" && "text-amber-600",
            state === "locked" && "text-zinc-400"
          )}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-medium",
            state === "done" && "text-emerald-800",
            state === "active" && "text-amber-800",
            state === "locked" && "text-zinc-400"
          )}
        >
          {label}
        </p>
        <p
          className={cn(
            "text-xs",
            state === "done" && "text-emerald-600",
            state === "active" && "text-amber-600",
            state === "locked" && "text-zinc-400"
          )}
        >
          {sub}
        </p>
      </div>
      {state === "done" && (
        <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
      )}
      {state === "active" && (
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
        </span>
      )}
    </div>
  );
}
