// lib/admin/interpreters.ts

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";

export async function assertInterpreterExists(userProfileId: string) {
  const target = await prisma.userProfile.findUnique({
    where: { id: userProfileId },
    select: { id: true, role: true, isActive: true, status: true },
  });

  if (!target || target.role !== "INTERPRETER") {
    throw new Error("Interpreter not found");
  }

  return target;
}

export async function setInterpreterActiveCore(args: {
  userProfileId: string;
  isActive: boolean;
  actor: string;
  note?: string | null;
}) {
  const { userProfileId, isActive, actor, note } = args;

  const before = await assertInterpreterExists(userProfileId);

  if (before.isActive === isActive) {
    return { ok: true, isActive: before.isActive };
  }

  await prisma.userProfile.update({
    where: { id: userProfileId },
    data: { isActive },
  });

  await prisma.auditEvent.create({
    data: {
      userProfileId,
      action: isActive ? AUDIT_ACTIONS.ACTIVATED : AUDIT_ACTIONS.DEACTIVATED,
      actor,
      note: note ?? null,
      meta: {
        previous: { isActive: before.isActive, status: before.status },
        next: { isActive, status: before.status },
      } as Prisma.InputJsonValue,
    },
  });

  return { ok: true, isActive };
}

export async function bulkSetInterpreterActiveCore(args: {
  userProfileIds: string[];
  isActive: boolean;
  actor: string;
  note?: string | null;
}) {
  const { userProfileIds, isActive, actor, note } = args;

  if (!Array.isArray(userProfileIds) || userProfileIds.length === 0) {
    throw new Error("No interpreters selected");
  }

  const targets = await prisma.userProfile.findMany({
    where: { id: { in: userProfileIds }, role: "INTERPRETER" },
    select: { id: true, isActive: true, status: true },
  });

  const toUpdate = targets.filter((t) => t.isActive !== isActive);

  if (toUpdate.length === 0) {
    return { ok: true, updated: 0, total: targets.length };
  }

  await prisma.$transaction([
    prisma.userProfile.updateMany({
      where: { id: { in: toUpdate.map((t) => t.id) } },
      data: { isActive },
    }),
    ...toUpdate.map((t) =>
      prisma.auditEvent.create({
        data: {
          userProfileId: t.id,
          action: isActive ? AUDIT_ACTIONS.ACTIVATED : AUDIT_ACTIONS.DEACTIVATED,
          actor,
          note: note ?? null,
          meta: {
            previous: { isActive: t.isActive, status: t.status },
            next: { isActive, status: t.status },
            bulk: true,
          } as Prisma.InputJsonValue,
        },
      })
    ),
  ]);

  return { ok: true, updated: toUpdate.length, total: targets.length };
}