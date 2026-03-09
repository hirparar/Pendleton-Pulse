// lib/assignments/service.ts
import { prisma } from "@/lib/prisma";
import { Prisma, AssignmentStatus, VisibilityMode } from "@prisma/client";

type AdminActor = { id: string; email: string | null; clerkUserId: string };
function actor(a: AdminActor) { return a.email ?? a.clerkUserId; }

// ─── validation helpers ────────────────────────────────────────────────────────

function parseStatus(s: unknown): AssignmentStatus {
  const valid: AssignmentStatus[] = ["OPEN","ASSIGNED","COMPLETED","CANCELLED"];
  if (typeof s === "string" && valid.includes(s as AssignmentStatus)) return s as AssignmentStatus;
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
function optionalString(v: unknown, max = 5000): string | null {
  if (v == null || (typeof v === "string" && !v.trim())) return null;
  if (typeof v !== "string") return null;
  return v.trim().slice(0, max);
}
function requireInt(v: unknown, field: string, min = 1, max = 100): number {
  const n = parseInt(String(v), 10);
  if (isNaN(n) || n < min || n > max) throw new Error(`${field} must be between ${min} and ${max}`);
  return n;
}
function optionalFloat(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
}
function optionalInt(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = parseInt(String(v), 10);
  return isNaN(n) ? null : n;
}
function optionalStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim());
}
function parseDeliveryMode(v: unknown): "IN_PERSON" | "REMOTE" | "VIDEO_RELAY" | "VIDEO_REMOTE" {
  const valid = ["IN_PERSON","REMOTE","VIDEO_RELAY","VIDEO_REMOTE"];
  if (typeof v === "string" && valid.includes(v)) return v as any;
  return "IN_PERSON";
}

// ─── auto status sync ─────────────────────────────────────────────────────────

async function syncAssignmentStatus(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  assignmentId: string,
  actorName: string
) {
  const assignment = await tx.assignment.findUnique({
    where: { id: assignmentId },
    include: { interpreters: { where: { status: "ASSIGNED" } } },
  });
  if (!assignment) return;
  if (assignment.status === "COMPLETED" || assignment.status === "CANCELLED") return;

  const active = assignment.interpreters.length;
  const needed = assignment.interpretersNeeded;
  let newStatus: AssignmentStatus | null = null;

  if (active >= needed && assignment.status !== "ASSIGNED") newStatus = "ASSIGNED";
  else if (active < needed && assignment.status === "ASSIGNED") newStatus = "OPEN";
  if (!newStatus) return;

  await tx.assignment.update({ where: { id: assignmentId }, data: { status: newStatus } });
  await tx.auditEvent.create({
    data: {
      assignmentId, action: "AUTO_STATUS_CHANGED", actor: actorName,
      note: `Auto: ${assignment.status} → ${newStatus} (${active}/${needed} assigned)`,
      meta: { from: assignment.status, to: newStatus, active, needed },
    },
  });
}

// ─── create ───────────────────────────────────────────────────────────────────

export async function createAssignment(admin: AdminActor, body: unknown) {
  const b = body as Record<string, unknown>;

  const clientName      = requireString(b.clientName, "Client name", 200);
  const languagePair    = requireString(b.languagePair, "Language pair", 200);
  const assignmentType  = requireString(b.assignmentType, "Assignment type", 200);
  const location        = requireString(b.location, "Location", 500);
  const scheduledStart  = requireDate(b.scheduledStart, "Start time");
  const scheduledEnd    = requireDate(b.scheduledEnd, "End time");
  if (scheduledEnd <= scheduledStart) throw new Error("End time must be after start time");

  const title = optionalString(b.title) ?? `${clientName} – ${languagePair}`;

  const data: Prisma.AssignmentCreateInput = {
    createdBy:         { connect: { id: admin.id } },
    title,
    clientName,
    clientOrganization: optionalString(b.clientOrganization),
    languagePair,
    assignmentType,
    deliveryMode:       parseDeliveryMode(b.deliveryMode),
    scheduledStart,
    scheduledEnd,
    timezone:           optionalString(b.timezone) ?? "America/New_York",
    interpretersNeeded: requireInt(b.interpretersNeeded ?? 1, "Interpreters needed"),
    isUrgent:           b.isUrgent === true,

    // In-person
    location,
    address:            optionalString(b.address),
    roomFloor:          optionalString(b.roomFloor),
    parkingNotes:       optionalString(b.parkingNotes),
    accessInstructions: optionalString(b.accessInstructions),
    dresscode:          optionalString(b.dresscode),

    // Remote
    meetingLink:        optionalString(b.meetingLink),
    meetingPassword:    optionalString(b.meetingPassword),
    platformNotes:      optionalString(b.platformNotes),

    // Requirements
    requiredLanguagePair:    optionalString(b.requiredLanguagePair),
    requiredCertifications:  optionalStringArray(b.requiredCertifications),
    requiredExperienceYears: optionalInt(b.requiredExperienceYears),
    requiredModes:           optionalStringArray(b.requiredModes),

    // Compensation
    compensationRate:      optionalFloat(b.compensationRate),
    compensationUnit:      optionalString(b.compensationUnit),
    compensationNotes:     optionalString(b.compensationNotes),
    isCompensationVisible: b.isCompensationVisible !== false,

    // Notes
    specialNotes:  optionalString(b.specialNotes),
    internalNotes: optionalString(b.internalNotes),

    status: "OPEN",
    visibilityMode: "ALL",
  };

  return prisma.$transaction(async (tx) => {
    const a = await tx.assignment.create({ data });
    await tx.auditEvent.create({
      data: {
        assignmentId: a.id, action: "CREATED", actor: actor(admin),
        meta: { title, clientName, languagePair, assignmentType, deliveryMode: data.deliveryMode },
      },
    });
    return a;
  });
}

// ─── update details ───────────────────────────────────────────────────────────

export async function updateAssignmentDetails(admin: AdminActor, assignmentId: string, body: unknown) {
  const b = body as Record<string, unknown>;
  const patch: Prisma.AssignmentUpdateInput = {};

  if (b.title != null)           patch.title           = requireString(b.title, "Title", 200);
  if (b.clientName != null)      patch.clientName      = requireString(b.clientName, "Client name", 200);
  if ("clientOrganization" in b) patch.clientOrganization = optionalString(b.clientOrganization);
  if (b.languagePair != null)    patch.languagePair    = requireString(b.languagePair, "Language pair", 200);
  if (b.assignmentType != null)  patch.assignmentType  = requireString(b.assignmentType, "Assignment type", 200);
  if (b.deliveryMode != null)    patch.deliveryMode    = parseDeliveryMode(b.deliveryMode);
  if (b.scheduledStart != null)  patch.scheduledStart  = requireDate(b.scheduledStart, "Start time");
  if (b.scheduledEnd != null)    patch.scheduledEnd    = requireDate(b.scheduledEnd, "End time");
  if (b.interpretersNeeded != null) patch.interpretersNeeded = requireInt(b.interpretersNeeded, "Interpreters needed");
  if ("isUrgent" in b)           patch.isUrgent        = b.isUrgent === true;

  if (b.location != null)        patch.location        = requireString(b.location, "Location", 500);
  if ("address" in b)            patch.address         = optionalString(b.address);
  if ("roomFloor" in b)          patch.roomFloor       = optionalString(b.roomFloor);
  if ("parkingNotes" in b)       patch.parkingNotes    = optionalString(b.parkingNotes);
  if ("accessInstructions" in b) patch.accessInstructions = optionalString(b.accessInstructions);
  if ("dresscode" in b)          patch.dresscode       = optionalString(b.dresscode);

  if ("meetingLink" in b)        patch.meetingLink     = optionalString(b.meetingLink);
  if ("meetingPassword" in b)    patch.meetingPassword = optionalString(b.meetingPassword);
  if ("platformNotes" in b)      patch.platformNotes   = optionalString(b.platformNotes);

  if ("requiredLanguagePair" in b)    patch.requiredLanguagePair    = optionalString(b.requiredLanguagePair);
  if ("requiredCertifications" in b)  patch.requiredCertifications  = optionalStringArray(b.requiredCertifications);
  if ("requiredExperienceYears" in b) patch.requiredExperienceYears = optionalInt(b.requiredExperienceYears);
  if ("requiredModes" in b)           patch.requiredModes           = optionalStringArray(b.requiredModes);

  if ("compensationRate" in b)      patch.compensationRate      = optionalFloat(b.compensationRate);
  if ("compensationUnit" in b)      patch.compensationUnit      = optionalString(b.compensationUnit);
  if ("compensationNotes" in b)     patch.compensationNotes     = optionalString(b.compensationNotes);
  if ("isCompensationVisible" in b) patch.isCompensationVisible = b.isCompensationVisible !== false;

  if ("specialNotes" in b)  patch.specialNotes  = optionalString(b.specialNotes);
  if ("internalNotes" in b) patch.internalNotes = optionalString(b.internalNotes);

  if (patch.scheduledStart && patch.scheduledEnd) {
    if ((patch.scheduledEnd as Date) <= (patch.scheduledStart as Date))
      throw new Error("End time must be after start time");
  }

  return prisma.$transaction(async (tx) => {
    const a = await tx.assignment.update({ where: { id: assignmentId }, data: patch });
    await tx.auditEvent.create({
      data: {
        assignmentId, action: "UPDATED", actor: actor(admin),
        note: optionalString(b.note),
        meta: patch as Prisma.InputJsonValue,
      },
    });
    return a;
  });
}

// ─── status ───────────────────────────────────────────────────────────────────

export async function setAssignmentStatus(admin: AdminActor, assignmentId: string, status: unknown, note?: unknown) {
  const newStatus = parseStatus(status);
  return prisma.$transaction(async (tx) => {
    const a = await tx.assignment.update({ where: { id: assignmentId }, data: { status: newStatus } });
    await tx.auditEvent.create({
      data: { assignmentId, action: "STATUS_CHANGED", actor: actor(admin), note: optionalString(note), meta: { to: newStatus } },
    });
    return a;
  });
}

// ─── visibility ───────────────────────────────────────────────────────────────

export async function setAssignmentVisibility(
  admin: AdminActor, assignmentId: string, mode: "ALL" | "RESTRICTED",
  allowedIds: string[], note?: unknown
) {
  if (mode === "RESTRICTED" && allowedIds.length === 0)
    throw new Error("Restricted visibility requires at least one interpreter");

  await prisma.$transaction(async (tx) => {
    await tx.assignment.update({ where: { id: assignmentId }, data: { visibilityMode: mode } });
    await tx.assignmentVisibility.deleteMany({ where: { assignmentId } });
    if (mode === "RESTRICTED") {
      await tx.assignmentVisibility.createMany({
        data: allowedIds.map((id) => ({ assignmentId, userProfileId: id })),
        skipDuplicates: true,
      });
    }
    await tx.auditEvent.create({
      data: {
        assignmentId, action: "VISIBILITY_CHANGED", actor: actor(admin),
        note: optionalString(note), meta: { mode, allowedCount: allowedIds.length },
      },
    });
  });
}

// ─── interpreter assignment (admin) ───────────────────────────────────────────

export async function assignInterpreterToJob(
  admin: AdminActor, assignmentId: string, interpreterProfileId: string, note?: unknown
) {
  const noteStr = optionalString(note);
  const interpreter = await prisma.userProfile.findFirst({
    where: { id: interpreterProfileId, role: "INTERPRETER", status: "APPROVED", isActive: true },
    include: { interpreterProfile: { select: { timezone: true, displayName: true } } },
  });
  if (!interpreter) throw new Error("Interpreter not found or not eligible");

  return prisma.$transaction(async (tx) => {
    const assignment = await tx.assignment.findUnique({
      where: { id: assignmentId },
      include: { interpreters: { where: { status: "ASSIGNED" } } },
    });
    if (!assignment) throw new Error("Assignment not found");
    if (assignment.status === "COMPLETED" || assignment.status === "CANCELLED")
      throw new Error(`Cannot assign to a ${assignment.status.toLowerCase()} assignment`);

    const existingLink = await tx.assignmentInterpreter.findUnique({
      where: { assignmentId_userProfileId: { assignmentId, userProfileId: interpreterProfileId } },
    });
    if (!existingLink?.status === undefined && assignment.interpreters.length >= assignment.interpretersNeeded)
      throw new Error(`Assignment fully staffed (${assignment.interpreters.length}/${assignment.interpretersNeeded})`);

    const alreadyAssigned = existingLink?.status === "ASSIGNED";
    if (!alreadyAssigned && assignment.interpreters.length >= assignment.interpretersNeeded)
      throw new Error(`Assignment fully staffed (${assignment.interpreters.length}/${assignment.interpretersNeeded}). Remove an interpreter first.`);

    // Availability check
    const tz = interpreter.interpreterProfile?.timezone ?? "America/New_York";
    function toLocalParts(date: Date, timezone: string) {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hour12: false,
      }).formatToParts(date);
      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
      const h = parseInt(get("hour"), 10);
      return { dateStr: `${get("year")}-${get("month")}-${get("day")}`, min: (h === 24 ? 0 : h) * 60 + parseInt(get("minute"), 10) };
    }
    const localStart = toLocalParts(assignment.scheduledStart, tz);
    const localEnd   = toLocalParts(assignment.scheduledEnd, tz);
    const jobDate    = new Date(`${localStart.dateStr}T00:00:00.000Z`);
    const dayAfter   = new Date(jobDate); dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);

    const coveringSlot = await tx.availabilitySlot.findFirst({
      where: {
        userProfileId: interpreterProfileId,
        date: { gte: jobDate, lt: dayAfter },
        startMin: { lte: localStart.min },
        endMin:   { gte: localEnd.min },
      },
    });
    if (!coveringSlot) {
      const name = interpreter.interpreterProfile?.displayName ?? interpreter.email ?? "This interpreter";
      throw new Error(`${name} has no availability for this time window.`);
    }

    // Double-booking
    const overlap = await tx.assignment.findFirst({
      where: {
        id: { not: assignmentId },
        interpreters: { some: { userProfileId: interpreterProfileId, status: "ASSIGNED" } },
        scheduledStart: { lt: assignment.scheduledEnd },
        scheduledEnd:   { gt: assignment.scheduledStart },
      },
      select: { title: true },
    });
    if (overlap) throw new Error(`Double-booking: already assigned to "${overlap.title}" which overlaps this time.`);

    const link = await tx.assignmentInterpreter.upsert({
      where: { assignmentId_userProfileId: { assignmentId, userProfileId: interpreterProfileId } },
      update: { status: "ASSIGNED", removedAt: null, note: noteStr },
      create: { assignmentId, userProfileId: interpreterProfileId, status: "ASSIGNED", note: noteStr },
    });

    await tx.auditEvent.create({
      data: {
        assignmentId, action: "INTERPRETER_ASSIGNED", actor: actor(admin),
        note: noteStr, meta: { interpreterProfileId } as Prisma.InputJsonValue,
      },
    });
    await syncAssignmentStatus(tx, assignmentId, actor(admin));
    return link;
  });
}

export async function removeInterpreterFromJob(
  admin: AdminActor, assignmentId: string, interpreterProfileId: string, note?: unknown
) {
  const noteStr = optionalString(note);
  return prisma.$transaction(async (tx) => {
    const link = await tx.assignmentInterpreter.update({
      where: { assignmentId_userProfileId: { assignmentId, userProfileId: interpreterProfileId } },
      data: { status: "REMOVED", removedAt: new Date() },
    });
    await tx.auditEvent.create({
      data: { assignmentId, action: "INTERPRETER_REMOVED", actor: actor(admin), note: noteStr, meta: { interpreterProfileId } },
    });
    await syncAssignmentStatus(tx, assignmentId, actor(admin));
    return link;
  });
}

// ─── queries ──────────────────────────────────────────────────────────────────

export async function listJobsForInterpreter(interpreterProfileId: string) {
  return prisma.assignment.findMany({
    where: {
      status: { in: ["OPEN","ASSIGNED"] },
      OR: [
        { visibilityMode: "ALL" },
        { visibilityMode: "RESTRICTED", visibility: { some: { userProfileId: interpreterProfileId } } },
      ],
    },
    orderBy: { scheduledStart: "asc" },
    take: 200,
    include: {
      _count: { select: { interpreters: { where: { status: "ASSIGNED" } } } },
      interpreters: {
        where: { userProfileId: interpreterProfileId },
        select: { status: true, assignedAt: true },
      },
    },
  });
}

// ─── interpreter self-service ─────────────────────────────────────────────────

export async function requestAssignment(interpreterProfileId: string, assignmentId: string) {
  return prisma.$transaction(async (tx) => {
    const assignment = await tx.assignment.findUnique({
      where: { id: assignmentId },
      include: { interpreters: { where: { status: "ASSIGNED" } }, visibility: true },
    });
    if (!assignment) throw new Error("Assignment not found");
    if (assignment.status === "CANCELLED" || assignment.status === "COMPLETED")
      throw new Error("This assignment is no longer accepting requests");

    const canSee = assignment.visibilityMode === "ALL" ||
      assignment.visibility.some((v: { userProfileId: string }) => v.userProfileId === interpreterProfileId);
    if (!canSee) throw new Error("Assignment not visible to you");

    if (assignment.interpreters.length >= assignment.interpretersNeeded)
      throw new Error("This assignment is already fully staffed");

    const me = await tx.userProfile.findUnique({
      where: { id: interpreterProfileId },
      select: { status: true, isActive: true, role: true },
    });
    if (!me || me.role !== "INTERPRETER" || me.status !== "APPROVED" || !me.isActive)
      throw new Error("You are not eligible to request assignments");

    const existingLink = await tx.assignmentInterpreter.findUnique({
      where: { assignmentId_userProfileId: { assignmentId, userProfileId: interpreterProfileId } },
    });
    if (existingLink?.status === "ASSIGNED") throw new Error("You are already assigned to this job");

    const interpProfile = await tx.interpreterProfile.findUnique({
      where: { userProfileId: interpreterProfileId },
      select: { timezone: true },
    });
    const tz = interpProfile?.timezone ?? "America/New_York";

    function toLocalHHMM(date: Date, timezone: string) {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hour12: false,
      }).formatToParts(date);
      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
      const h = parseInt(get("hour"), 10);
      return { h: h === 24 ? 0 : h, m: parseInt(get("minute"), 10), dateStr: `${get("year")}-${get("month")}-${get("day")}` };
    }
    const localStart = toLocalHHMM(assignment.scheduledStart, tz);
    const localEnd   = toLocalHHMM(assignment.scheduledEnd, tz);
    const jobStartMin = localStart.h * 60 + localStart.m;
    const jobEndMin   = localEnd.h   * 60 + localEnd.m;
    const jobDate  = new Date(`${localStart.dateStr}T00:00:00.000Z`);
    const dayAfter = new Date(jobDate); dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);

    const coveringSlot = await tx.availabilitySlot.findFirst({
      where: {
        userProfileId: interpreterProfileId,
        date: { gte: jobDate, lt: dayAfter },
        startMin: { lte: jobStartMin },
        endMin: { gte: jobEndMin },
      },
    });
    if (!coveringSlot)
      throw new Error("You don't have availability set for this time. Add a slot on the Availability page that covers the full assignment window.");

    const overlap = await tx.assignment.findFirst({
      where: {
        id: { not: assignmentId },
        interpreters: { some: { userProfileId: interpreterProfileId, status: "ASSIGNED" } },
        scheduledStart: { lt: assignment.scheduledEnd },
        scheduledEnd: { gt: assignment.scheduledStart },
      },
      select: { title: true },
    });
    if (overlap) throw new Error(`You already have "${overlap.title}" scheduled during this time. Double-booking is not allowed.`);

    const link = await tx.assignmentInterpreter.upsert({
      where: { assignmentId_userProfileId: { assignmentId, userProfileId: interpreterProfileId } },
      update: { status: "ASSIGNED", removedAt: null, note: null },
      create: { assignmentId, userProfileId: interpreterProfileId, status: "ASSIGNED" },
    });
    await tx.auditEvent.create({
      data: {
        assignmentId, userProfileId: interpreterProfileId,
        action: "INTERPRETER_SELF_REQUESTED", actor: interpreterProfileId,
        note: "Interpreter self-requested",
      },
    });
    await syncAssignmentStatus(tx, assignmentId, interpreterProfileId);
    return link;
  });
}

export async function withdrawFromAssignment(interpreterProfileId: string, assignmentId: string) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { scheduledStart: true, status: true },
  });
  if (!assignment) throw new Error("Assignment not found");
  if (assignment.status === "COMPLETED" || assignment.status === "CANCELLED")
    throw new Error("This assignment is already closed");
  if (new Date() >= assignment.scheduledStart)
    throw new Error("Cannot withdraw after the assignment has started. Contact an admin.");

  await prisma.$transaction(async (tx) => {
    await tx.assignmentInterpreter.update({
      where: { assignmentId_userProfileId: { assignmentId, userProfileId: interpreterProfileId } },
      data: { status: "REMOVED", removedAt: new Date() },
    });
    await tx.auditEvent.create({
      data: {
        assignmentId, userProfileId: interpreterProfileId,
        action: "INTERPRETER_WITHDREW", actor: interpreterProfileId, note: "Interpreter withdrew",
      },
    });
    await syncAssignmentStatus(tx, assignmentId, interpreterProfileId);
  });
}