"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { revalidatePath } from "next/cache";

function cleanNote(note: unknown) {
  const s = String(note ?? "").trim();
  return s.length ? s.slice(0, 500) : null;
}

async function audit(userProfileId: string, action: string, actor: string, note?: string | null) {
  await prisma.interpreterAuditEvent.create({
    data: {
      userProfileId,
      action,
      actor,
      note: note ?? null,
    },
  });
}

export async function approveInterpreterById(userProfileId: string, note?: string) {
  const admin = await requireAdmin();
  const actor = admin.email ?? admin.clerkUserId;
  const reviewNote = cleanNote(note);

  await prisma.userProfile.update({
    where: { id: userProfileId },
    data: {
      status: "APPROVED",
      reviewedBy: actor,
      reviewedAt: new Date(),
      reviewNote,
    },
  });

  await audit(userProfileId, "APPROVED", actor, reviewNote);

  revalidatePath("/admin/interpreters");
  revalidatePath("/admin/pending");
}

export async function denyInterpreterById(userProfileId: string, note?: string) {
  const admin = await requireAdmin();
  const actor = admin.email ?? admin.clerkUserId;
  const reviewNote = cleanNote(note);

  await prisma.userProfile.update({
    where: { id: userProfileId },
    data: {
      status: "DENIED",
      reviewedBy: actor,
      reviewedAt: new Date(),
      reviewNote,
    },
  });

  await audit(userProfileId, "DENIED", actor, reviewNote);

  revalidatePath("/admin/interpreters");
  revalidatePath("/admin/pending");
}
