// app/admin/assignments/[id]/actions.ts
"use server";

import { requireAdmin } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import {
  updateAssignmentDetails,
  setAssignmentStatus,
  setAssignmentVisibility,
  assignInterpreterToJob,
  removeInterpreterFromJob,
} from "@/lib/assignments/service";

function invalidate(assignmentId: string) {
  revalidatePath("/admin/assignments");
  revalidatePath(`/admin/assignments/${assignmentId}`);
}

export async function updateAssignmentAction(assignmentId: string, patch: unknown) {
  const admin = await requireAdmin();
  await updateAssignmentDetails(admin, assignmentId, patch);
  invalidate(assignmentId);
  return { ok: true as const };
}

export async function setStatusAction(assignmentId: string, status: unknown, note?: unknown) {
  const admin = await requireAdmin();
  await setAssignmentStatus(admin, assignmentId, status, note);
  invalidate(assignmentId);
  return { ok: true as const };
}

export async function setVisibilityAction(
  assignmentId: string,
  mode: "ALL" | "RESTRICTED",
  allowedIds: string[],
  note?: unknown
) {
  const admin = await requireAdmin();
  await setAssignmentVisibility(admin, assignmentId, mode, allowedIds, note);
  invalidate(assignmentId);
  return { ok: true as const };
}

export async function assignInterpreterAction(
  assignmentId: string,
  interpreterProfileId: string,
  note?: string
) {
  const admin = await requireAdmin();
  await assignInterpreterToJob(admin, assignmentId, interpreterProfileId, note);
  invalidate(assignmentId);
  return { ok: true as const };
}

export async function removeInterpreterAction(
  assignmentId: string,
  interpreterProfileId: string,
  note?: string
) {
  const admin = await requireAdmin();
  await removeInterpreterFromJob(admin, assignmentId, interpreterProfileId, note);
  invalidate(assignmentId);
  return { ok: true as const };
}