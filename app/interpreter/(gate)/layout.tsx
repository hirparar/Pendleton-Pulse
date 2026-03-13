import { requireInterpreter } from "@/lib/authz";
import { UserCluster } from "@/components/user-header";
import { LogoMark } from "@/components/brand";
import { redirect } from "next/navigation";

export default async function InterpreterGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireInterpreter();
  if (profile.isActive === false) redirect("/interpreter/inactive");

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <LogoMark />
            <div>
              <p className="text-sm font-semibold tracking-tight text-zinc-950">
                Pendleton Pulse
              </p>
              <p className="text-xs text-zinc-500">Interpreter access</p>
            </div>
          </div>
          <UserCluster status={profile.status} />
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-12">{children}</main>
    </div>
  );
}
