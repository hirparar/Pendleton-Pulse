// lib/assignments/service.ts

import { prisma } from "@/lib/prisma";
import { Prisma, AssignmentStatus, VisibilityMode } from "@prisma/client";

type AdminActor = { id: string; email: string | null; clerkUserId: string };

function actor(admin: AdminActor) {
  return admin.email ?? admin.clerkUserId;
}

// ─── validation ───────────────────────────────────────────────────────────────

function parseStatus(s: unknown): AssignmentStatus {
  const valid: AssignmentStatus[] = ["OPEN", "ASSIGNED", "COMPLETED", "CANCELLED"];
  if (typeof s === "string" && valid.includes(s as AssignmentStatus))
    return s as AssignmentStatus;
  throw new Error(`Invalid status: ${s}`);
}

function requireString(v: unknown, field: string, max = 500): string {
  if (typeof v !== "string" || !v.trim()) throw new Error(`${field} is required`);
  if (v.length > max) throw new Error(`${field} is too long (max ${max})`);
  return v.trim();
}

function requireDate(v: unknown, field: string): Date {
  const d = new Date(v as string);
  if (isNaN(d.getTime())) throw new Error(`${field} must be a valid date`);
  return d;
}

function optionalString(v: unknown, max = 2000): string | null {
  if (v == null || (typeof v === "string" && !v.trim())) return null;
  if (typeof v !== "string") return null;
  return v.trim().slice(0, max);
}

function requireInt(v: unknown, field: string, min = 1, max = 100): number {
  const n = parseInt(String(v), 10);
  if (isNaN(n) || n < min || n > max)
    throw new Error(`${field} must be between ${min} and ${max}`);
  return n;
}

// ─── auto status logic ────────────────────────────────────────────────────────

/**
 * After any interpreter link change, automatically flip assignment status:
 * - If activeAssigned >= interpretersNeeded → ASSIGNED
 * - If activeAssigned < interpretersNeeded AND status was ASSIGNED → OPEN
 * Does not change COMPLETED or CANCELLED assignments.
 */
async function syncAssignmentStatus(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  assignmentId: string,
  actorName: string
) {
  const assignment = await tx.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      interpreters: { where: { status: "ASSIGNED" } },
    },
  });

  if (!assignment) return;
  if (assignment.status === "COMPLETED" || assignment.status === "CANCELLED") return;

  const activeCount = assignment.interpreters.length;
  const needed = assignment.interpretersNeeded;

  let newStatus: AssignmentStatus | null = null;

  if (activeCount >= needed && assignment.status !== "ASSIGNED") {
    newStatus = "ASSIGNED";
  } else if (activeCount < needed && assignment.status === "ASSIGNED") {
    newStatus = "OPEN";
  }

  if (!newStatus) return;

  await tx.assignment.update({
    where: { id: assignmentId },
    data: { status: newStatus },
  });

  await tx.auditEvent.create({
    data: {
      assignmentId,
      action: "AUTO_STATUS_CHANGED",
      actor: actorName,
      note: `Auto: ${assignment.status} → ${newStatus} (${activeCount}/${needed} assigned)`,
      meta: { from: assignment.status, to: newStatus, activeCount, needed },
    },
  });
}

// ─── create ───────────────────────────────────────────────────────────────────

export async function createAssignment(admin: AdminActor, body: unknown) {
  const b = body as Record<string, unknown>;

  const title = requireString(b.title ?? `${b.clientName} - ${b.languagePair}`, "Title", 200);
  const clientName = requireString(b.clientName, "Client name", 200);
  const languagePair = requireString(b.languagePair, "Language pair", 200);
  const assignmentType = requireString(b.assignmentType, "Assignment type", 200);
  const location = requireString(b.location, "Location", 500);
  const scheduledStart = requireDate(b.scheduledStart, "Start time");
  const scheduledEnd = requireDate(b.scheduledEnd, "End time");
  const interpretersNeeded = requireInt(b.interpretersNeeded ?? 1, "Interpreters needed");
  const specialNotes = optionalString(b.specialNotes);

  if (scheduledEnd <= scheduledStart)
    throw new Error("End time must be after start time");

  const created = await prisma.$transaction(async (tx) => {
    const a = await tx.assignment.create({
      data: {
        createdByUserProfileId: admin.id,
        title,
        clientName,
        languagePair,
        assignmentType,
        location,
        scheduledStart,
        scheduledEnd,
        interpretersNeeded,
        specialNotes,
        status: "OPEN",
        visibilityMode: "ALL",
      },
    });

    await tx.auditEvent.create({
      data: {
        assignmentId: a.id,
        action: "CREATED",
        actor: actor(admin),
        meta: { title, clientName, languagePair, assignmentType },
      },
    });

    return a;
  });

  return created;
}

// ─── update details ───────────────────────────────────────────────────────────

export async function updateAssignmentDetails(
  admin: AdminActor,
  assignmentId: string,
  body: unknown
) {
  const b = body as Record<string, unknown>;

  const patch: Record<string, unknown> = {};

  if (b.title != null) patch.title = requireString(b.title, "Title", 200);
  if (b.clientName != null) patch.clientName = requireString(b.clientName, "Client name", 200);
  if (b.languagePair != null) patch.languagePair = requireString(b.languagePair, "Language pair", 200);
  if (b.assignmentType != null) patch.assignmentType = requireString(b.assignmentType, "Assignment type", 200);
  if (b.location != null) patch.location = requireString(b.location, "Location", 500);
  if (b.scheduledStart != null) patch.scheduledStart = requireDate(b.scheduledStart, "Start time");
  if (b.scheduledEnd != null) patch.scheduledEnd = requireDate(b.scheduledEnd, "End time");
  if (b.interpretersNeeded != null)
    patch.interpretersNeeded = requireInt(b.interpretersNeeded, "Interpreters needed");
  if ("specialNotes" in b) patch.specialNotes = optionalString(b.specialNotes);

  if (patch.scheduledEnd && patch.scheduledStart) {
    if ((patch.scheduledEnd as Date) <= (patch.scheduledStart as Date))
      throw new Error("End time must be after start time");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const a = await tx.assignment.update({
      where: { id: assignmentId },
      data: patch,
    });

    await tx.auditEvent.create({
      data: {
        assignmentId,
        action: "UPDATED",
        actor: actor(admin),
        note: optionalString(b.note),
        meta: { patch } as Prisma.InputJsonValue,
      },
    });

    return a;
  });

  return updated;
}

// ─── status ───────────────────────────────────────────────────────────────────

export async function setAssignmentStatus(
  admin: AdminActor,
  assignmentId: string,
  status: unknown,
  note?: unknown
) {
  const newStatus = parseStatus(status);
  const noteStr = optionalString(note);

  const updated = await prisma.$transaction(async (tx) => {
    const a = await tx.assignment.update({
      where: { id: assignmentId },
      data: { status: newStatus },
    });

    await tx.auditEvent.create({
      data: {
        assignmentId,
        action: "STATUS_CHANGED",
        actor: actor(admin),
        note: noteStr,
        meta: { to: newStatus },
      },
    });

    return a;
  });

  return updated;
}

// ─── interpreter assignment ───────────────────────────────────────────────────

export async function assignInterpreterToJob(
  admin: AdminActor,
  assignmentId: string,
  interpreterProfileId: string,
  note?: unknown
) {
  const noteStr = optionalString(note);

  // Verify interpreter exists and is eligible
  const interpreter = await prisma.userProfile.findFirst({
    where: { id: interpreterProfileId, role: "INTERPRETER", status: "APPROVED", isActive: true },
  });
  if (!interpreter) throw new Error("Interpreter not found or not eligible");

  const result = await prisma.$transaction(async (tx) => {
    // Upsert link (re-assign if previously removed)
    const link = await tx.assignmentInterpreter.upsert({
      where: { assignmentId_userProfileId: { assignmentId, userProfileId: interpreterProfileId } },
      update: { status: "ASSIGNED", removedAt: null, note: noteStr },
      create: {
        assignmentId,
        userProfileId: interpreterProfileId,
        status: "ASSIGNED",
        note: noteStr,
      },
    });

    await tx.auditEvent.create({
      data: {
        assignmentId,
        action: "INTERPRETER_ASSIGNED",
        actor: actor(admin),
        note: noteStr,
        meta: { interpreterProfileId },
      },
    });

    // Auto-update status
    await syncAssignmentStatus(tx, assignmentId, actor(admin));

    return link;
  });

  return result;
}

export async function removeInterpreterFromJob(
  admin: AdminActor,
  assignmentId: string,
  interpreterProfileId: string,
  note?: unknown
) {
  const noteStr = optionalString(note);

  const result = await prisma.$transaction(async (tx) => {
    const link = await tx.assignmentInterpreter.update({
      where: { assignmentId_userProfileId: { assignmentId, userProfileId: interpreterProfileId } },
      data: { status: "REMOVED", removedAt: new Date() },
    });

    await tx.auditEvent.create({
      data: {
        assignmentId,
        action: "INTERPRETER_REMOVED",
        actor: actor(admin),
        note: noteStr,
        meta: { interpreterProfileId },
      },
    });

    // Auto-update status
    await syncAssignmentStatus(tx, assignmentId, actor(admin));

    return link;
  });

  return result;
}

// ─── visibility ───────────────────────────────────────────────────────────────

export async function setAssignmentVisibility(
  admin: AdminActor,
  assignmentId: string,
  mode: "ALL" | "RESTRICTED",
  allowedIds: string[],
  note?: unknown
) {
  const noteStr = optionalString(note);

  if (mode === "RESTRICTED" && allowedIds.length === 0)
    throw new Error("Restricted visibility requires at least one interpreter");

  await prisma.$transaction(async (tx) => {
    await tx.assignment.update({
      where: { id: assignmentId },
      data: { visibilityMode: mode },
    });

    await tx.assignmentVisibility.deleteMany({ where: { assignmentId } });

    if (mode === "RESTRICTED") {
      await tx.assignmentVisibility.createMany({
        data: allowedIds.map((id) => ({ assignmentId, userProfileId: id })),
        skipDuplicates: true,
      });
    }

    await tx.auditEvent.create({
      data: {
        assignmentId,
        action: "VISIBILITY_CHANGED",
        actor: actor(admin),
        note: noteStr,
        meta: { mode, allowedCount: allowedIds.length },
      },
    });
  });
}

// ─── queries ──────────────────────────────────────────────────────────────────

export async function listAssignmentsAdmin() {
  return prisma.assignment.findMany({
    orderBy: [{ scheduledStart: "asc" }, { createdAt: "desc" }],
    take: 500,
    include: {
      interpreters: {
        where: { status: "ASSIGNED" },
        include: { userProfile: { include: { interpreterProfile: true } } },
      },
      _count: { select: { interpreters: { where: { status: "ASSIGNED" } } } },
    },
  });
}

export async function getAssignmentAdmin(assignmentId: string) {
  return prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      interpreters: {
        include: { userProfile: { include: { interpreterProfile: true } } },
      },
      visibility: { include: { userProfile: { include: { interpreterProfile: true } } } },
      auditEvents: { orderBy: { createdAt: "desc" }, take: 50 },
      _count: { select: { interpreters: { where: { status: "ASSIGNED" } } } },
    },
  });
}

/** Jobs visible to an interpreter (handles ALL vs RESTRICTED). */
export async function listJobsForInterpreter(interpreterProfileId: string) {
  return prisma.assignment.findMany({
    where: {
      status: { in: ["OPEN", "ASSIGNED"] },
      OR: [
        { visibilityMode: "ALL" },
        { visibilityMode: "RESTRICTED", visibility: { some: { userProfileId: interpreterProfileId } } },
      ],
    },
    orderBy: { scheduledStart: "asc" },
    take: 200,
    include: {
      _count: { select: { interpreters: { where: { status: "ASSIGNED" } } } },
    },
  });
}

export async function getAssignmentForInterpreter(
  interpreterProfileId: string,
  assignmentId: string
) {
  const a = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      OR: [
        { visibilityMode: "ALL" },
        { visibilityMode: "RESTRICTED", visibility: { some: { userProfileId: interpreterProfileId } } },
      ],
    },
    include: {
      _count: { select: { interpreters: { where: { status: "ASSIGNED" } } } },
    },
  });
  return a;
}