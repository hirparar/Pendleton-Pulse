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

type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateAssignmentAction(
  assignmentId: string,
  patch: unknown
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    await updateAssignmentDetails(admin, assignmentId, patch);
    invalidate(assignmentId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update assignment" };
  }
}

export async function setStatusAction(
  assignmentId: string,
  status: unknown,
  note?: unknown
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    await setAssignmentStatus(admin, assignmentId, status, note);
    invalidate(assignmentId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update status" };
  }
}

export async function setVisibilityAction(
  assignmentId: string,
  mode: "ALL" | "RESTRICTED",
  allowedIds: string[],
  note?: unknown
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    await setAssignmentVisibility(admin, assignmentId, mode, allowedIds, note);
    invalidate(assignmentId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update visibility" };
  }
}

export async function assignInterpreterAction(
  assignmentId: string,
  interpreterProfileId: string,
  note?: string
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    await assignInterpreterToJob(admin, assignmentId, interpreterProfileId, note);
    invalidate(assignmentId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to assign interpreter" };
  }
}

export async function removeInterpreterAction(
  assignmentId: string,
  interpreterProfileId: string,
  note?: string
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    await removeInterpreterFromJob(admin, assignmentId, interpreterProfileId, note);
    invalidate(assignmentId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to remove interpreter" };
  }
}