// app/admin/assignments/new/page.tsx
import Link from "next/link";
import { requireAdmin } from "@/lib/authz";
import { MotionIn } from "@/components/motion";
import { CreateAssignmentForm } from "./ui";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function NewAssignmentPage() {
  await requireAdmin();
  return (
    <MotionIn className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Create assignment</h1>
          <p className="mt-1 text-sm text-zinc-500">
            End time is required. Status auto-updates when all interpreters are filled.
          </p>
        </div>
        <Link
          href="/admin/assignments"
          className="flex h-9 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
      </div>
      <CreateAssignmentForm />
    </MotionIn>
  );
}
