// app/admin/assignments/new/page.tsx
import Link from "next/link";
import { requireAdmin } from "@/lib/authz";
import { MotionIn } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { CreateAssignmentForm } from "./ui";

export const dynamic = "force-dynamic";

export default async function NewAssignmentPage() {
  await requireAdmin();
  return (
    <MotionIn className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">
            Create assignment
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            End time is required. Status auto-updates when interpreters are filled.
          </p>
        </div>
        <Link href="/admin/assignments">
          <Button variant="secondary" className="h-10 rounded-2xl">Back</Button>
        </Link>
      </header>
      <CreateAssignmentForm />
    </MotionIn>
  );
}