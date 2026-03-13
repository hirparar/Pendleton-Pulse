import type { PropsWithChildren } from "react";
import { LogoMark } from "@/components/brand";
import { Calendar, Briefcase, Users, ShieldCheck } from "lucide-react";

const features = [
  {
    icon: Briefcase,
    title: "Job matching",
    body: "Browse and claim interpreting assignments posted by admins.",
  },
  {
    icon: Calendar,
    title: "Availability management",
    body: "Set your schedule and let admins know when you're free.",
  },
  {
    icon: Users,
    title: "Interpreter directory",
    body: "Admins manage and audit all interpreter accounts in one place.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    body: "Separate, secure workflows for interpreters and administrators.",
  },
];

export default function AuthLayout({ children }: PropsWithChildren) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-white">
      {/* Subtle background accents */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/4 h-80 w-80 -translate-x-1/2 rounded-full bg-indigo-100/60 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-violet-100/40 blur-3xl" />
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #6366f1 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-6xl items-stretch gap-8 px-8 py-10 md:grid-cols-2 md:py-0">
        {/* Left brand panel */}
        <aside className="hidden flex-col justify-center md:flex">
          <div className="max-w-sm">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <LogoMark className="h-10 w-10" />
              <div>
                <p className="text-xl font-semibold tracking-tight text-zinc-950">
                  Pendleton Pulse
                </p>
                <p className="text-sm text-zinc-500">Interpreter Platform</p>
              </div>
            </div>

            <p className="mt-8 text-sm leading-relaxed text-zinc-500">
              A unified workspace for scheduling, job matching, availability,
              and profile management — built for interpreting teams.
            </p>

            {/* Feature list */}
            <ul className="mt-8 space-y-5">
              {features.map((f) => (
                <li key={f.title} className="flex items-start gap-3">
                  <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-zinc-100 ring-1 ring-zinc-200/80">
                    <f.icon className="size-4 text-zinc-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{f.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                      {f.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-10 text-xs text-zinc-400">
              © {new Date().getFullYear()} Pendleton Pulse. All rights reserved.
            </p>
          </div>
        </aside>

        {/* Right auth slot */}
        <main className="flex items-center justify-center">
          {children}
        </main>
      </div>
    </div>
  );
}
