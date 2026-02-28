// lib/assignments/interpreter.ts

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AssignmentStatus = "OPEN" | "ASSIGNED" | "COMPLETED" | "CANCELLED";

export type InterpreterAssignmentListFilters = {
  status?: AssignmentStatus[];
  from?: Date;
  to?: Date;
  cursor?: string | null;
  take?: number;
};

/**
 * Core visibility rule:
 * - ALL assignments visible to every eligible interpreter
 * - RESTRICTED assignments visible only if AssignmentVisibility has a row for this interpreter
 *
 * Caller must have already enforced requireInterpreterEligible().
 */
function interpreterVisibilityWhere(userProfileId: string) {
  return {
    OR: [
      { visibilityMode: "ALL" as const },
      {
        visibilityMode: "RESTRICTED" as const,
        visibility: { some: { userProfileId } },
      },
    ],
  };
}

/**
 * List assignments visible to a given interpreter.
 * Safe for interpreter-side usage — no other interpreters' info is returned.
 */
export async function listAssignmentsForInterpreter(
  userProfileId: string,
  filters: InterpreterAssignmentListFilters
) {
  const take = Math.min(Math.max(filters.take ?? 30, 1), 100);
  const status = (filters.status?.length ? filters.status : ["OPEN"]) as AssignmentStatus[];

  const where: Prisma.AssignmentWhereInput = {
    ...interpreterVisibilityWhere(userProfileId),
    status: { in: status },
    ...(filters.from || filters.to
      ? {
          scheduledStart: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
  };

  const rows = await prisma.assignment.findMany({
    where,
    orderBy: [{ scheduledStart: "asc" }, { id: "asc" }],
    take: take + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      title: true,
      clientName: true,
      languagePair: true,
      assignmentType: true,
      scheduledStart: true,
      scheduledEnd: true,       // now always present (required field)
      location: true,
      interpretersNeeded: true,
      specialNotes: true,
      status: true,
      visibilityMode: true,
      createdAt: true,
      updatedAt: true,

      // Only this interpreter's own link — no other interpreter data
      interpreters: {
        where: { userProfileId, status: "ASSIGNED" },
        select: {
          status: true,
          assignedAt: true,
          removedAt: true,      // renamed from unassignedAt
        },
      },

      // Count only active (ASSIGNED) interpreter links
      _count: {
        select: {
          interpreters: {
            where: { status: "ASSIGNED" },
          },
        },
      },
    },
  });

  const hasMore = rows.length > take;
  const data = hasMore ? rows.slice(0, take) : rows;
  const nextCursor = hasMore ? (data[data.length - 1]?.id ?? null) : null;

  const normalized = data.map((a) => ({
    id: a.id,
    title: a.title,
    clientName: a.clientName,
    languagePair: a.languagePair,
    assignmentType: a.assignmentType,
    scheduledStart: a.scheduledStart,
    scheduledEnd: a.scheduledEnd,
    location: a.location,
    interpretersNeeded: a.interpretersNeeded,
    specialNotes: a.specialNotes,
    status: a.status,
    visibilityMode: a.visibilityMode,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    isAssignedToMe: a.interpreters.length > 0,
    myAssignment: a.interpreters[0] ?? null,
    assignedCount: a._count.interpreters,
  }));

  return { data: normalized, nextCursor };
}

/**
 * Read one assignment visible to an interpreter.
 * Returns null if the assignment doesn't exist or isn't visible to them.
 */
export async function getAssignmentForInterpreter(
  userProfileId: string,
  assignmentId: string
) {
  const a = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      ...interpreterVisibilityWhere(userProfileId),
    },
    select: {
      id: true,
      title: true,
      clientName: true,
      languagePair: true,
      assignmentType: true,
      scheduledStart: true,
      scheduledEnd: true,
      location: true,
      interpretersNeeded: true,
      specialNotes: true,
      status: true,
      visibilityMode: true,
      createdAt: true,
      updatedAt: true,

      interpreters: {
        where: { userProfileId, status: "ASSIGNED" },
        select: {
          status: true,
          assignedAt: true,
          removedAt: true,
        },
      },

      _count: {
        select: {
          interpreters: {
            where: { status: "ASSIGNED" },
          },
        },
      },
    },
  });

  if (!a) return null;

  return {
    id: a.id,
    title: a.title,
    clientName: a.clientName,
    languagePair: a.languagePair,
    assignmentType: a.assignmentType,
    scheduledStart: a.scheduledStart,
    scheduledEnd: a.scheduledEnd,
    location: a.location,
    interpretersNeeded: a.interpretersNeeded,
    specialNotes: a.specialNotes,
    status: a.status,
    visibilityMode: a.visibilityMode,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    isAssignedToMe: a.interpreters.length > 0,
    myAssignment: a.interpreters[0] ?? null,
    assignedCount: a._count.interpreters,
  };
}