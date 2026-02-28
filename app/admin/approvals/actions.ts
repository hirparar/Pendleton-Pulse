"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { cleanText } from "@/lib/validation/core";

function actorFromAdmin(admin: { email: string | null; clerkUserId: string }) {
  return admin.email ?? admin.clerkUserId;
}

function normalizeIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return ids.map((x) => String(x ?? "").trim()).filter(Boolean);
}

async function revalidateAll(userProfileId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/approvals");
  revalidatePath("/admin/interpreters");
  if (userProfileId) revalidatePath(`/admin/interpreters/${userProfileId}`);
}

async function assertPendingInterpreter(userProfileId: string) {
  const u = await prisma.userProfile.findUnique({
    where: { id: userProfileId },
    select: { id: true, role: true, status: true },
  });

  if (!u || u.role !== "INTERPRETER") throw new Error("Interpreter not found");
  if (u.status !== "PENDING") throw new Error("Interpreter is not pending");
  return u;
}

export async function approvePendingInterpreter(args: {
  userProfileId: string;
  note?: string;
}) {
  const admin = await requireAdmin();
  const actor = actorFromAdmin(admin);

  const userProfileId = String(args.userProfileId ?? "").trim();
  const note = cleanText(args.note, 500);

  await assertPendingInterpreter(userProfileId);

  await prisma.$transaction([
    prisma.userProfile.update({
      where: { id: userProfileId },
      data: {
        status: "APPROVED",
        reviewedBy: actor,
        reviewedAt: new Date(),
        reviewNote: note,
      },
    }),
    prisma.auditEvent.create({
      data: {
        userProfileId,
        action: AUDIT_ACTIONS.APPROVED,
        actor,
        note: note ?? null,
        meta: { from: "approvals_tab" } as Prisma.InputJsonValue,
      },
    }),
  ]);

  await revalidateAll(userProfileId);
  return { ok: true };
}

export async function denyPendingInterpreter(args: {
  userProfileId: string;
  note?: string;
}) {
  const admin = await requireAdmin();
  const actor = actorFromAdmin(admin);

  const userProfileId = String(args.userProfileId ?? "").trim();
  const note = cleanText(args.note, 500);

  await assertPendingInterpreter(userProfileId);

  await prisma.$transaction([
    prisma.userProfile.update({
      where: { id: userProfileId },
      data: {
        status: "DENIED",
        reviewedBy: actor,
        reviewedAt: new Date(),
        reviewNote: note,
      },
    }),
    prisma.auditEvent.create({
      data: {
        userProfileId,
        action: AUDIT_ACTIONS.DENIED,
        actor,
        note: note ?? null,
        meta: { from: "approvals_tab" } as Prisma.InputJsonValue,
      },
    }),
  ]);

  await revalidateAll(userProfileId);
  return { ok: true };
}

export async function bulkApprovePending(args: {
  userProfileIds: string[];
  note?: string;
}) {
  const admin = await requireAdmin();
  const actor = actorFromAdmin(admin);

  const ids = normalizeIds(args.userProfileIds);
  const note = cleanText(args.note, 500);

  if (ids.length === 0) throw new Error("No interpreters selected");

  const pending = await prisma.userProfile.findMany({
    where: { id: { in: ids }, role: "INTERPRETER", status: "PENDING" },
    select: { id: true },
  });

  if (pending.length === 0) return { ok: true, updated: 0 };

  const pendingIds = pending.map((p) => p.id);

  await prisma.$transaction([
    prisma.userProfile.updateMany({
      where: { id: { in: pendingIds } },
      data: {
        status: "APPROVED",
        reviewedBy: actor,
        reviewedAt: new Date(),
        reviewNote: note,
      },
    }),
    ...pendingIds.map((userProfileId) =>
      prisma.auditEvent.create({
        data: {
          userProfileId,
          action: AUDIT_ACTIONS.APPROVED,
          actor,
          note: note ?? null,
          meta: { bulk: true, from: "approvals_tab" } as Prisma.InputJsonValue,
        },
      })
    ),
  ]);

  await revalidateAll();
  return { ok: true, updated: pendingIds.length };
}

export async function bulkDenyPending(args: {
  userProfileIds: string[];
  note?: string;
}) {
  const admin = await requireAdmin();
  const actor = actorFromAdmin(admin);

  const ids = normalizeIds(args.userProfileIds);
  const note = cleanText(args.note, 500);

  if (ids.length === 0) throw new Error("No interpreters selected");

  const pending = await prisma.userProfile.findMany({
    where: { id: { in: ids }, role: "INTERPRETER", status: "PENDING" },
    select: { id: true },
  });

  if (pending.length === 0) return { ok: true, updated: 0 };

  const pendingIds = pending.map((p) => p.id);

  await prisma.$transaction([
    prisma.userProfile.updateMany({
      where: { id: { in: pendingIds } },
      data: {
        status: "DENIED",
        reviewedBy: actor,
        reviewedAt: new Date(),
        reviewNote: note,
      },
    }),
    ...pendingIds.map((userProfileId) =>
      prisma.auditEvent.create({
        data: {
          userProfileId,
          action: AUDIT_ACTIONS.DENIED,
          actor,
          note: note ?? null,
          meta: { bulk: true, from: "approvals_tab" } as Prisma.InputJsonValue,
        },
      })
    ),
  ]);

  await revalidateAll();
  return { ok: true, updated: pendingIds.length };
}