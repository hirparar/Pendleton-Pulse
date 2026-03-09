/**
 * Tests for lib/assignments/interpreter.ts
 * Prisma is fully mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { assignment } = vi.hoisted(() => ({
  assignment: { findMany: vi.fn(), findFirst: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { assignment },
}));

import {
  listAssignmentsForInterpreter,
  getAssignmentForInterpreter,
} from "@/lib/assignments/interpreter";

const USER_ID = "interp-123";

beforeEach(() => vi.clearAllMocks());

// ─── listAssignmentsForInterpreter ────────────────────────────────────────────
describe("listAssignmentsForInterpreter", () => {
  const makeRow = (id: string) => ({
    id,
    title: `Job ${id}`,
    clientName: "Client",
    languagePair: "EN-ES",
    assignmentType: "Medical",
    scheduledStart: new Date("2026-06-15T09:00:00Z"),
    scheduledEnd: new Date("2026-06-15T11:00:00Z"),
    location: "Room 1",
    interpretersNeeded: 1,
    specialNotes: null,
    status: "OPEN",
    visibilityMode: "ALL",
    createdAt: new Date(),
    updatedAt: new Date(),
    interpreters: [],
    _count: { interpreters: 0 },
  });

  it("returns normalized data and no nextCursor when results <= take", async () => {
    assignment.findMany.mockResolvedValue([makeRow("a1"), makeRow("a2")]);
    const result = await listAssignmentsForInterpreter(USER_ID, { take: 30 });
    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).toBeNull();
  });

  it("returns nextCursor and trims data when results > take", async () => {
    // take=2, but 3 rows returned → hasMore=true
    const rows = [makeRow("a1"), makeRow("a2"), makeRow("a3")];
    assignment.findMany.mockResolvedValue(rows);
    const result = await listAssignmentsForInterpreter(USER_ID, { take: 2 });
    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).toBe("a2");
  });

  it("defaults take to 30 and clamps max to 100", async () => {
    assignment.findMany.mockResolvedValue([]);
    await listAssignmentsForInterpreter(USER_ID, { take: 200 });
    const { take } = assignment.findMany.mock.calls[0][0];
    expect(take).toBe(101); // 100+1 for hasMore detection
  });

  it("defaults min take to 1", async () => {
    assignment.findMany.mockResolvedValue([]);
    await listAssignmentsForInterpreter(USER_ID, { take: 0 });
    const { take } = assignment.findMany.mock.calls[0][0];
    expect(take).toBe(2); // 1+1
  });

  it("includes visibility OR clause in where", async () => {
    assignment.findMany.mockResolvedValue([]);
    await listAssignmentsForInterpreter(USER_ID, {});
    const { where } = assignment.findMany.mock.calls[0][0];
    expect(where.OR).toBeDefined();
    expect(where.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ visibilityMode: "ALL" }),
        expect.objectContaining({ visibilityMode: "RESTRICTED" }),
      ])
    );
  });

  it("filters by status when provided", async () => {
    assignment.findMany.mockResolvedValue([]);
    await listAssignmentsForInterpreter(USER_ID, { status: ["OPEN", "ASSIGNED"] });
    const { where } = assignment.findMany.mock.calls[0][0];
    expect(where.status).toEqual({ in: ["OPEN", "ASSIGNED"] });
  });

  it("defaults to OPEN status when no status provided", async () => {
    assignment.findMany.mockResolvedValue([]);
    await listAssignmentsForInterpreter(USER_ID, {});
    const { where } = assignment.findMany.mock.calls[0][0];
    expect(where.status).toEqual({ in: ["OPEN"] });
  });

  it("applies date range filters", async () => {
    assignment.findMany.mockResolvedValue([]);
    const from = new Date("2026-06-01");
    const to = new Date("2026-06-30");
    await listAssignmentsForInterpreter(USER_ID, { from, to });
    const { where } = assignment.findMany.mock.calls[0][0];
    expect(where.scheduledStart).toEqual({ gte: from, lte: to });
  });

  it("normalizes row: sets isAssignedToMe=true when interpreter link present", async () => {
    const row = {
      ...makeRow("a1"),
      interpreters: [{ status: "ASSIGNED", assignedAt: new Date(), removedAt: null }],
      _count: { interpreters: 1 },
    };
    assignment.findMany.mockResolvedValue([row]);
    const result = await listAssignmentsForInterpreter(USER_ID, {});
    expect(result.data[0].isAssignedToMe).toBe(true);
    expect(result.data[0].assignedCount).toBe(1);
  });

  it("normalizes row: sets isAssignedToMe=false when no link", async () => {
    assignment.findMany.mockResolvedValue([makeRow("a1")]);
    const result = await listAssignmentsForInterpreter(USER_ID, {});
    expect(result.data[0].isAssignedToMe).toBe(false);
    expect(result.data[0].myAssignment).toBeNull();
  });

  it("uses cursor for pagination when provided", async () => {
    assignment.findMany.mockResolvedValue([]);
    await listAssignmentsForInterpreter(USER_ID, { cursor: "cursor-id" });
    const call = assignment.findMany.mock.calls[0][0];
    expect(call.cursor).toEqual({ id: "cursor-id" });
    expect(call.skip).toBe(1);
  });
});

// ─── getAssignmentForInterpreter ──────────────────────────────────────────────
describe("getAssignmentForInterpreter", () => {
  const makeFullRow = () => ({
    id: "assign-1",
    title: "Job A",
    clientName: "Client",
    languagePair: "EN-ES",
    assignmentType: "Medical",
    scheduledStart: new Date(),
    scheduledEnd: new Date(),
    location: "Room 1",
    interpretersNeeded: 1,
    specialNotes: null,
    status: "OPEN",
    visibilityMode: "ALL",
    createdAt: new Date(),
    updatedAt: new Date(),
    interpreters: [],
    _count: { interpreters: 0 },
  });

  it("returns null when assignment not found or not visible", async () => {
    assignment.findFirst.mockResolvedValue(null);
    const result = await getAssignmentForInterpreter(USER_ID, "assign-1");
    expect(result).toBeNull();
  });

  it("returns normalized assignment when found", async () => {
    assignment.findFirst.mockResolvedValue(makeFullRow());
    const result = await getAssignmentForInterpreter(USER_ID, "assign-1");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("assign-1");
    expect(result!.isAssignedToMe).toBe(false);
  });

  it("scopes query with visibility OR clause", async () => {
    assignment.findFirst.mockResolvedValue(null);
    await getAssignmentForInterpreter(USER_ID, "assign-1");
    const { where } = assignment.findFirst.mock.calls[0][0];
    expect(where.id).toBe("assign-1");
    expect(where.OR).toBeDefined();
  });
});
