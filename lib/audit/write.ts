// lib/audit/write.ts

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuditAction } from "@/lib/audit/actions";

export async function writeInterpreterAuditEvent(args: {
  userProfileId: string;
  action: AuditAction;
  actor: string;
  note?: string | null;
  meta?: unknown;
}) {
  const { userProfileId, action, actor, note, meta } = args;

  await prisma.auditEvent.create({
    data: {
      userProfileId,
      action,
      actor,
      note: note ?? null,
      meta: meta !== undefined ? (meta as Prisma.InputJsonValue) : undefined,
    },
  });
}

export async function writeAssignmentAuditEvent(args: {
  assignmentId: string;
  action: AuditAction;
  actor: string;
  note?: string | null;
  meta?: unknown;
}) {
  const { assignmentId, action, actor, note, meta } = args;

  await prisma.auditEvent.create({
    data: {
      assignmentId,
      action,
      actor,
      note: note ?? null,
      meta: meta !== undefined ? (meta as Prisma.InputJsonValue) : undefined,
    },
  });
}