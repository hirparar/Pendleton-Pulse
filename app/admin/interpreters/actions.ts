"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { cleanText } from "@/lib/validation/core";
import { writeInterpreterAuditEvent } from "@/lib/audit/write";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { setInterpreterActiveCore, bulkSetInterpreterActiveCore } from "@/lib/admin/interpreters";

function actorFromAdmin(admin: { email: string | null; clerkUserId: string }) {
  return admin.email ?? admin.clerkUserId;
}

async function revalidateEverywhere(userProfileId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/approvals");
  revalidatePath("/admin/interpreters");
  if (userProfileId) revalidatePath(`/admin/interpreters/${userProfileId}`);
}

export async function approveInterpreterById(userProfileId: string, note?: string) {
  const admin = await requireAdmin();
  const actor = actorFromAdmin(admin);

  const reviewNote = cleanText(note, 500);

  await prisma.userProfile.update({
    where: { id: userProfileId },
    data: {
      status: "APPROVED",
      reviewedBy: actor,
      reviewedAt: new Date(),
      reviewNote,
    },
  });

  await writeInterpreterAuditEvent({
    userProfileId,
    action: AUDIT_ACTIONS.APPROVED,
    actor,
    note: reviewNote,
  });

  await revalidateEverywhere(userProfileId);
}

export async function denyInterpreterById(userProfileId: string, note?: string) {
  const admin = await requireAdmin();
  const actor = actorFromAdmin(admin);

  const reviewNote = cleanText(note, 500);

  await prisma.userProfile.update({
    where: { id: userProfileId },
    data: {
      status: "DENIED",
      reviewedBy: actor,
      reviewedAt: new Date(),
      reviewNote,
    },
  });

  await writeInterpreterAuditEvent({
    userProfileId,
    action: AUDIT_ACTIONS.DENIED,
    actor,
    note: reviewNote,
  });

  await revalidateEverywhere(userProfileId);
}

/** Phase 3: toggle active status (single) */
export async function setInterpreterActive(args: {
  userProfileId: string;
  isActive: boolean;
  note?: string;
}) {
  const admin = await requireAdmin();
  const actor = actorFromAdmin(admin);
  const note = cleanText(args.note, 500);

  const res = await setInterpreterActiveCore({
    userProfileId: String(args.userProfileId ?? "").trim(),
    isActive: Boolean(args.isActive),
    actor,
    note,
  });

  await revalidateEverywhere(args.userProfileId);

  return res;
}

/** Phase 3: bulk toggle active */
export async function bulkSetInterpreterActive(args: {
  userProfileIds: string[];
  isActive: boolean;
  note?: string;
}) {
  const admin = await requireAdmin();
  const actor = actorFromAdmin(admin);
  const note = cleanText(args.note, 500);

  const ids = Array.isArray(args.userProfileIds) ? args.userProfileIds.map(String) : [];

  const res = await bulkSetInterpreterActiveCore({
    userProfileIds: ids,
    isActive: Boolean(args.isActive),
    actor,
    note,
  });

  await revalidateEverywhere();

  return res;
}
