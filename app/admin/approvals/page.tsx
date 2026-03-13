import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { MotionIn } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { ApprovalsTable } from "./table";

export default async function AdminApprovalsPage() {
  await requireAdmin();

  const pending = await prisma.userProfile.findMany({
    where: { role: "INTERPRETER", status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: 250,
    select: {
      id: true,
      email: true,
      status: true,
      isActive: true,
      createdAt: true,
      interpreterProfile: {
        select: {
          displayName: true,
          location: true,
          languages: true,
          certifications: true,
          experienceYears: true,
          updatedAt: true,
        },
      },
    },
  });

  return (
    <MotionIn className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
            Approvals
          </h1>
          <p className="text-sm text-zinc-600">
            Review pending interpreter accounts. Approving grants access to the interpreter job feed (if active).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            {pending.length} pending
          </Badge>
        </div>
      </header>

      <ApprovalsTable initial={pending} />
    </MotionIn>
  );
}
