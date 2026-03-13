import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/brand";
import { NavLinks } from "@/components/nav-links";

type NavItem = { href: string; label: string; badge?: string };

export function AppShell({
  children,
  title,
  subtitle,
  nav,
  accent = "interpreter",
  right,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  nav: NavItem[];
  accent?: "interpreter" | "admin";
  right?: ReactNode;
}) {
  const isAdmin = accent === "admin";

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto flex min-h-screen max-w-7xl">
        {/* Sidebar */}
        <aside
          className={cn(
            "hidden w-60 shrink-0 flex-col border-r lg:flex",
            "border-zinc-200/80 bg-white"
          )}
        >
          {/* Logo area */}
          <div className="flex h-16 items-center gap-3 border-b border-zinc-200/80 px-5">
            {!isAdmin ? (
              <LogoMark className="shrink-0" />
            ) : (
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-zinc-950 shadow-sm">
                <span className="text-[10px] font-bold tracking-widest text-white">
                  ADM
                </span>
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-tight text-zinc-950">
                Pendleton Pulse
              </div>
              <div className="truncate text-[11px] text-zinc-500">
                {isAdmin ? "Admin Console" : "Interpreter Workspace"}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto py-3">
            <NavLinks nav={nav} />
          </div>

          {/* Sidebar footer */}
          <div className="border-t border-zinc-200/80 px-4 py-4">
            <div className="rounded-xl bg-zinc-50 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                Platform
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Pendleton Pulse v0.1
              </p>
            </div>
          </div>
        </aside>

        {/* Content area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Topbar */}
          <header
            className={cn(
              "sticky top-0 z-30 border-b",
              "border-zinc-200/80 bg-white/80 backdrop-blur-xl"
            )}
          >
            <div className="flex h-16 items-center justify-between px-6">
              <div className="min-w-0 space-y-0.5">
                <p className="truncate text-sm font-semibold tracking-tight text-zinc-950">
                  {title}
                </p>
                {subtitle ? (
                  <p className="max-w-md truncate text-[11px] text-zinc-500">
                    {subtitle}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">{right}</div>
            </div>
          </header>

          <main className="flex-1 px-6 py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
