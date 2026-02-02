"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { revalidatePath } from "next/cache";

function cleanNote(note: unknown) {
  const s = String(note ?? "").trim();
  return s.length ? s.slice(0, 500) : null;
}

export async function approveMany(ids: string[], note?: string) {
  const admin = await requireAdmin();
  const reviewNote = cleanNote(note);

  if (!ids?.length) return;

  await prisma.userProfile.updateMany({
    where: { id: { in: ids }, role: "INTERPRETER", status: "PENDING" },
    data: {
      status: "APPROVED",
      reviewedBy: admin.email ?? admin.clerkUserId,
      reviewedAt: new Date(),
      reviewNote,
    },
  });

  revalidatePath("/admin/pending");
}

export async function denyMany(ids: string[], note?: string) {
  const admin = await requireAdmin();
  const reviewNote = cleanNote(note);

  if (!ids?.length) return;

  await prisma.userProfile.updateMany({
    where: { id: { in: ids }, role: "INTERPRETER", status: "PENDING" },
    data: {
      status: "DENIED",
      reviewedBy: admin.email ?? admin.clerkUserId,
      reviewedAt: new Date(),
      reviewNote,
    },
  });

  revalidatePath("/admin/pending");
}
