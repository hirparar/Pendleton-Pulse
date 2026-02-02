import { requireInterpreter } from "@/lib/authz";
import { UserCluster } from "@/components/user-header";
import { LogoMark } from "@/components/brand";

export default async function InterpreterGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireInterpreter();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="border-b border-zinc-200 bg-white/85 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <LogoMark />
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">Pendleton Connect</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Interpreter access
              </div>
            </div>
          </div>
          <UserCluster status={profile.status} />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">{children}</main>
    </div>
  );
}
