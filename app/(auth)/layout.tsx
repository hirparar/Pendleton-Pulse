import type { PropsWithChildren } from "react"

export default function AuthLayout({ children }: PropsWithChildren) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* subtle grid / glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 h-72 w-[48rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/20 via-sky-500/20 to-emerald-500/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border))_1px,transparent_0)] [background-size:24px_24px] opacity-40" />
      </div>

      <div className="relative mx-auto grid min-h-screen w-full max-w-6xl items-stretch gap-8 px-4 py-10 md:grid-cols-2 md:py-0">
        {/* Left brand panel */}
        <aside className="hidden flex-col justify-center md:flex">
          <div className="max-w-md">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
                PC
              </div>
              <div>
                <p className="text-2xl font-medium text-muted-foreground">
                  Pendleton Connect
                </p>
                <h1 className="text-sm font-semibold tracking-tight">
                  Secure access to your platform
                </h1>
              </div>
            </div>

            <p className="mt-6 text-sm leading-6 text-muted-foreground">
              Manage scheduling, job matching, availability, and profiles in one
              organized workspace.
            </p>

            <div className="mt-6 text-xs text-muted-foreground">
              © {new Date().getFullYear()} Pendleton Connect
            </div>
          </div>
        </aside>

        {/* Right auth slot */}
        <main className="flex items-center justify-center">
          {children}
        </main>
      </div>
    </div>
  )
}
