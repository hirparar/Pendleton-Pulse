"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authz";
import { cleanText, cleanStringArray, cleanOptionalInt } from "@/lib/validation/core";
import { prisma } from "@/lib/prisma";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { writeInterpreterAuditEvent } from "@/lib/audit/write";
import { setInterpreterActiveCore } from "@/lib/admin/interpreters";

function actorFromAdmin(admin: { email: string | null; clerkUserId: string }) {
  return admin.email ?? admin.clerkUserId;
}

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

  revalidatePath("/admin");
  revalidatePath("/admin/interpreters");
  revalidatePath(`/admin/interpreters/${args.userProfileId}`);

  return res;
}

export async function updateInterpreterCore(input: {
  userProfileId: string;
  languages: unknown;
  certifications: unknown;
  experienceYears: unknown;
  note?: string;
}) {
  const admin = await requireAdmin();
  const actor = actorFromAdmin(admin);

  const userProfileId = String(input.userProfileId ?? "").trim();
  if (!userProfileId) throw new Error("Missing userProfileId");

  const languages = cleanStringArray(input.languages, 25, 60);
  const certifications = cleanStringArray(input.certifications, 25, 80);
  const experienceYears = cleanOptionalInt(input.experienceYears, 0, 60);
  const note = cleanText(input.note, 500);

  const user = await prisma.userProfile.findUnique({
    where: { id: userProfileId },
    select: { id: true, role: true },
  });

  if (!user || user.role !== "INTERPRETER") {
    throw new Error("Interpreter not found");
  }

  const before = await prisma.interpreterProfile.findUnique({
    where: { userProfileId },
    select: { languages: true, certifications: true, experienceYears: true },
  });

  if (!before) {
    await prisma.interpreterProfile.create({
      data: {
        userProfileId,
        languages,
        certifications,
        experienceYears,
      },
    });
  } else {
    await prisma.interpreterProfile.update({
      where: { userProfileId },
      data: {
        languages,
        certifications,
        experienceYears,
      },
    });
  }

  await writeInterpreterAuditEvent({
    userProfileId,
    action: AUDIT_ACTIONS.PROFILE_CORE_UPDATED,
    actor,
    note,
    meta: {
      before: before ?? null,
      after: { languages, certifications, experienceYears },
    },
  });

  revalidatePath("/admin/interpreters");
  revalidatePath(`/admin/interpreters/${userProfileId}`);

  return { ok: true };
}
