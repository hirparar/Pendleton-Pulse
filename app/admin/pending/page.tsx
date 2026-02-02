import { prisma } from "@/lib/prisma";
import { MotionIn } from "@/components/motion";
import { ApprovalsTable } from "./table";
import { Badge } from "@/components/ui/badge";

export default async function PendingApprovalsPage() {
  const data = await prisma.userProfile.findMany({
    where: { role: "INTERPRETER", status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return (
    <MotionIn className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">
            Approvals
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Access control for interpreters. This is secondary — jobs are the primary workflow.
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Approve to unlock the interpreter job feed. Deny to block access.
          </p>
        </div>

        <Badge variant="secondary" className="w-fit rounded-full">
          {data.length} pending
        </Badge>
      </header>

      <ApprovalsTable initial={data} />
    </MotionIn>
  );
}
