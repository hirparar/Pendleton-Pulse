import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { MotionIn } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { InterpretersTable } from "./table";

export default async function AdminInterpretersPage() {
  await requireAdmin();

  const interpreters = await prisma.userProfile.findMany({
    where: { role: "INTERPRETER" },
    orderBy: { createdAt: "desc" },
    take: 250,
    include: {
      interpreterProfile: true,
    },
  });

  const pendingCount = interpreters.filter((u) => u.status === "PENDING").length;

  return (
    <MotionIn className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">
            Interpreters
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Search profiles, review status, and inspect audit. Mutations are limited to approvals in this phase.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            {interpreters.length} total
          </Badge>
          <Badge variant="secondary" className="rounded-full">
            {pendingCount} pending
          </Badge>
        </div>
      </header>

      <InterpretersTable initial={interpreters} />
    </MotionIn>
  );
}
