"use server";

import { requireInterpreterEligible } from "@/lib/authz";
import { requestAssignment, withdrawFromAssignment } from "@/lib/assignments/service";
import { revalidatePath } from "next/cache";

export async function requestAssignmentAction(assignmentId: string) {
  const me = await requireInterpreterEligible();

  try {
    await requestAssignment(me.id, assignmentId);
    revalidatePath("/interpreter/jobs");
    revalidatePath(`/interpreter/jobs/${assignmentId}`);
    revalidatePath("/interpreter/dashboard");
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to request assignment" };
  }
}

export async function withdrawFromAssignmentAction(assignmentId: string) {
  const me = await requireInterpreterEligible();

  try {
    await withdrawFromAssignment(me.id, assignmentId);
    revalidatePath("/interpreter/jobs");
    revalidatePath(`/interpreter/jobs/${assignmentId}`);
    revalidatePath("/interpreter/dashboard");
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to withdraw" };
  }
}