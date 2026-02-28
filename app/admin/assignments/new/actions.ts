"use server";

import { requireAdmin } from "@/lib/authz";
import { createAssignment } from "@/lib/assignments/service";
import { revalidatePath } from "next/cache";

export async function createAssignmentAction(body: unknown) {
  const admin = await requireAdmin();
  const created = await createAssignment(admin, body);
  revalidatePath("/admin/assignments");
  return { ok: true as const, id: created.id };
}
