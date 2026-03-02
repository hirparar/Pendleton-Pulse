import Link from "next/link";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/brand";
import { Separator } from "@/components/ui/separator";

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
    <div className={cn("min-h-screen", "bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50")}>
      <div className="mx-auto flex min-h-screen max-w-7xl">
        {/* Sidebar */}
        <aside
          className={cn(
            "hidden w-72 flex-col border-r px-4 py-6 lg:flex",
            "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
          )}
        >
          <div className="flex items-center gap-3 px-2">
            {!isAdmin ? <LogoMark /> : <div className="h-9 w-9 rounded-2xl bg-zinc-950 dark:bg-white" />}
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">Pendleton Connect</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {isAdmin ? "Admin Console" : "Interpreter Workspace"}
              </div>
            </div>
          </div>

          <Separator className="my-5 opacity-70" />

          <nav className="space-y-1 px-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm",
                  "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100",
                  "dark:text-zinc-300 dark:hover:text-white dark:hover:bg-zinc-800/60",
                  "transition-colors"
                )}
              >
                <span className="font-medium tracking-tight">{item.label}</span>
                {item.badge ? (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {item.badge}
                  </span>
                ) : (
                  <span className="text-xs opacity-0 transition-opacity group-hover:opacity-100">↗</span>
                )}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main */}
        <div className="flex-1">
          {/* Topbar */}
          <header
            className={cn(
              "sticky top-0 z-30 border-b",
              "border-zinc-200 bg-white/85 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70"
            )}
          >
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold tracking-tight">{title}</div>
                {subtitle ? (
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{subtitle}</div>
                ) : null}
              </div>
              <div className="flex items-center gap-2">{right}</div>
            </div>
          </header>

          <main className="mx-auto max-w-7xl px-4 py-8 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
