/**
 * Extra tests for lib/assignments/service.ts
 * Covers: assignInterpreterToJob, removeInterpreterFromJob,
 *         requestAssignment, withdrawFromAssignment, listJobsForInterpreter
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── mock setup ────────────────────────────────────────────────────────────────
const {
  $transaction,
  assignmentModel,
  assignmentInterpreter,
  availabilitySlot,
  auditEvent,
  userProfile,
  interpreterProfile,
} = vi.hoisted(() => ({
  $transaction: vi.fn(),
  assignmentModel: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  assignmentInterpreter: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  availabilitySlot: { findFirst: vi.fn() },
  auditEvent: { create: vi.fn() },
  userProfile: { findFirst: vi.fn(), findUnique: vi.fn() },
  interpreterProfile: { findUnique: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction,
    assignment: assignmentModel,
    assignmentInterpreter,
    availabilitySlot,
    auditEvent,
    userProfile,
    interpreterProfile,
  },
}));

import {
  assignInterpreterToJob,
  removeInterpreterFromJob,
  listJobsForInterpreter,
  withdrawFromAssignment,
  requestAssignment,
} from "@/lib/assignments/service";

// ── shared fixtures ───────────────────────────────────────────────────────────
const ADMIN = { id: "admin-1", email: "admin@example.com", clerkUserId: "clerk-1" };
const INTERP_ID = "interp-1";
const ASSIGN_ID = "assign-1";

const INTERPRETER_USER = {
  id: INTERP_ID,
  email: "interp@example.com",
  role: "INTERPRETER",
  status: "APPROVED",
  isActive: true,
  interpreterProfile: { timezone: "America/New_York", displayName: "Jane Doe" },
};

const OPEN_ASSIGNMENT = {
  id: ASSIGN_ID,
  status: "OPEN",
  interpretersNeeded: 1,
  scheduledStart: new Date("2030-06-15T14:00:00Z"), // 10:00 AM ET
  scheduledEnd: new Date("2030-06-15T16:00:00Z"),   // 12:00 PM ET
  interpreters: [],
  visibility: [],
  title: "Medical Appt",
  visibilityMode: "ALL",
};

// Assignment returned during syncAssignmentStatus — already in desired state (no-op)
const SYNC_ASSIGNMENT = { ...OPEN_ASSIGNMENT, status: "ASSIGNED", interpreters: [{ status: "ASSIGNED" }] };

// A mock tx object
const makeMockTx = () => ({
  assignment: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  assignmentInterpreter: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  availabilitySlot: { findFirst: vi.fn() },
  auditEvent: { create: vi.fn() },
  userProfile: { findUnique: vi.fn() },
  interpreterProfile: { findUnique: vi.fn() },
});

// Helper to build a fresh mockTx and wire up $transaction for it
function setupTx(
  findUniqueResponses: unknown[],
  overrides?: Partial<ReturnType<typeof makeMockTx>>
): ReturnType<typeof makeMockTx> {
  const tx = makeMockTx();
  Object.assign(tx, overrides);
  $transaction.mockImplementation(async (fn: (tx: typeof tx) => Promise<unknown>) => fn(tx));

  let callCount = 0;
  tx.assignment.findUnique.mockImplementation(async () => {
    const val = callCount < findUniqueResponses.length ? findUniqueResponses[callCount] : SYNC_ASSIGNMENT;
    callCount++;
    return val;
  });

  // Sensible defaults for other tx methods
  tx.assignmentInterpreter.findUnique.mockResolvedValue(null);
  tx.availabilitySlot.findFirst.mockResolvedValue({ id: "slot-1" });
  tx.assignment.findFirst.mockResolvedValue(null);
  tx.assignmentInterpreter.upsert.mockResolvedValue({
    assignmentId: ASSIGN_ID, userProfileId: INTERP_ID, status: "ASSIGNED",
  });
  tx.auditEvent.create.mockResolvedValue({});
  tx.assignment.update.mockResolvedValue({});

  return tx;
}

// ── assignInterpreterToJob ────────────────────────────────────────────────────
describe("assignInterpreterToJob", () => {
  let mockTx: ReturnType<typeof makeMockTx>;

  beforeEach(() => {
    vi.clearAllMocks();
    userProfile.findFirst.mockResolvedValue(INTERPRETER_USER);
    mockTx = setupTx([OPEN_ASSIGNMENT, SYNC_ASSIGNMENT]);
  });

  it("returns the upserted link on success", async () => {
    const result = await assignInterpreterToJob(ADMIN, ASSIGN_ID, INTERP_ID);
    expect(result).toMatchObject({ assignmentId: ASSIGN_ID, userProfileId: INTERP_ID, status: "ASSIGNED" });
  });

  it("verifies interpreter eligibility before transaction", async () => {
    userProfile.findFirst.mockResolvedValue(null);
    await expect(assignInterpreterToJob(ADMIN, ASSIGN_ID, INTERP_ID)).rejects.toThrow(
      "Interpreter not found or not eligible"
    );
    expect($transaction).not.toHaveBeenCalled();
  });

  it("throws when assignment not found inside transaction", async () => {
    mockTx = setupTx([null]);
    await expect(assignInterpreterToJob(ADMIN, ASSIGN_ID, INTERP_ID)).rejects.toThrow(
      "Assignment not found"
    );
  });

  it("throws when assignment is COMPLETED", async () => {
    mockTx = setupTx([{ ...OPEN_ASSIGNMENT, status: "COMPLETED" }]);
    await expect(assignInterpreterToJob(ADMIN, ASSIGN_ID, INTERP_ID)).rejects.toThrow(
      "Cannot assign to a completed assignment"
    );
  });

  it("throws when assignment is CANCELLED", async () => {
    mockTx = setupTx([{ ...OPEN_ASSIGNMENT, status: "CANCELLED" }]);
    await expect(assignInterpreterToJob(ADMIN, ASSIGN_ID, INTERP_ID)).rejects.toThrow(
      "Cannot assign to a cancelled assignment"
    );
  });

  it("throws when assignment is fully staffed and interpreter not already assigned", async () => {
    const fullAssignment = { ...OPEN_ASSIGNMENT, interpretersNeeded: 1, interpreters: [{ status: "ASSIGNED" }] };
    mockTx = setupTx([fullAssignment, SYNC_ASSIGNMENT]);
    mockTx.assignmentInterpreter.findUnique.mockResolvedValue(null); // not already assigned
    await expect(assignInterpreterToJob(ADMIN, ASSIGN_ID, INTERP_ID)).rejects.toThrow(
      "fully staffed"
    );
  });

  it("throws when interpreter has no availability for the job time window", async () => {
    mockTx = setupTx([OPEN_ASSIGNMENT, SYNC_ASSIGNMENT]);
    mockTx.availabilitySlot.findFirst.mockResolvedValue(null); // no availability
    await expect(assignInterpreterToJob(ADMIN, ASSIGN_ID, INTERP_ID)).rejects.toThrow(
      "no availability"
    );
  });

  it("throws on double-booking", async () => {
    mockTx = setupTx([OPEN_ASSIGNMENT, SYNC_ASSIGNMENT]);
    mockTx.assignment.findFirst.mockResolvedValue({ title: "Another Job" });
    await expect(assignInterpreterToJob(ADMIN, ASSIGN_ID, INTERP_ID)).rejects.toThrow(
      "Double-booking"
    );
  });

  it("creates audit event with INTERPRETER_ASSIGNED action", async () => {
    await assignInterpreterToJob(ADMIN, ASSIGN_ID, INTERP_ID);
    expect(mockTx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "INTERPRETER_ASSIGNED" }),
      })
    );
  });

  it("upserts the interpreter link with status=ASSIGNED", async () => {
    await assignInterpreterToJob(ADMIN, ASSIGN_ID, INTERP_ID);
    expect(mockTx.assignmentInterpreter.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: "ASSIGNED" }),
        create: expect.objectContaining({ status: "ASSIGNED" }),
      })
    );
  });

  it("passes note to upsert when provided", async () => {
    await assignInterpreterToJob(ADMIN, ASSIGN_ID, INTERP_ID, "Urgent assignment");
    expect(mockTx.assignmentInterpreter.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ note: "Urgent assignment" }),
      })
    );
  });
});

// ── removeInterpreterFromJob ──────────────────────────────────────────────────
describe("removeInterpreterFromJob", () => {
  let mockTx: ReturnType<typeof makeMockTx>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTx = makeMockTx();
    $transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx));

    mockTx.assignmentInterpreter.update.mockResolvedValue({ status: "REMOVED", assignmentId: ASSIGN_ID, userProfileId: INTERP_ID });
    mockTx.auditEvent.create.mockResolvedValue({});
    // syncAssignmentStatus: returns no-op assignment
    mockTx.assignment.findUnique.mockResolvedValue({ ...OPEN_ASSIGNMENT, status: "OPEN", interpreters: [] });
    mockTx.assignment.update.mockResolvedValue({});
  });

  it("returns the updated link with status=REMOVED", async () => {
    const result = await removeInterpreterFromJob(ADMIN, ASSIGN_ID, INTERP_ID);
    expect(result).toMatchObject({ status: "REMOVED" });
  });

  it("updates assignmentInterpreter to REMOVED with removedAt", async () => {
    await removeInterpreterFromJob(ADMIN, ASSIGN_ID, INTERP_ID);
    expect(mockTx.assignmentInterpreter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REMOVED" }),
      })
    );
  });

  it("creates INTERPRETER_REMOVED audit event", async () => {
    await removeInterpreterFromJob(ADMIN, ASSIGN_ID, INTERP_ID);
    expect(mockTx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "INTERPRETER_REMOVED" }),
      })
    );
  });

  it("passes note to audit event", async () => {
    await removeInterpreterFromJob(ADMIN, ASSIGN_ID, INTERP_ID, "Admin removed");
    expect(mockTx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ note: "Admin removed" }),
      })
    );
  });
});

// ── listJobsForInterpreter ────────────────────────────────────────────────────
describe("listJobsForInterpreter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns list of visible open/assigned jobs", async () => {
    const jobs = [{ id: "j1", status: "OPEN" }, { id: "j2", status: "ASSIGNED" }];
    assignmentModel.findMany.mockResolvedValue(jobs);
    const result = await listJobsForInterpreter(INTERP_ID);
    expect(result).toEqual(jobs);
  });

  it("queries with status in [OPEN, ASSIGNED]", async () => {
    assignmentModel.findMany.mockResolvedValue([]);
    await listJobsForInterpreter(INTERP_ID);
    const { where } = assignmentModel.findMany.mock.calls[0][0];
    expect(where.status.in).toContain("OPEN");
    expect(where.status.in).toContain("ASSIGNED");
  });

  it("includes visibilityMode ALL and RESTRICTED in OR clause", async () => {
    assignmentModel.findMany.mockResolvedValue([]);
    await listJobsForInterpreter(INTERP_ID);
    const { where } = assignmentModel.findMany.mock.calls[0][0];
    const modes = where.OR.map((o: { visibilityMode: string }) => o.visibilityMode);
    expect(modes).toContain("ALL");
    expect(modes).toContain("RESTRICTED");
  });

  it("returns empty array when no jobs match", async () => {
    assignmentModel.findMany.mockResolvedValue([]);
    const result = await listJobsForInterpreter(INTERP_ID);
    expect(result).toEqual([]);
  });
});

// ── withdrawFromAssignment ────────────────────────────────────────────────────
describe("withdrawFromAssignment", () => {
  let mockTx: ReturnType<typeof makeMockTx>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTx = makeMockTx();
    $transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx));

    // Assignment not started yet
    assignmentModel.findUnique.mockResolvedValue({
      scheduledStart: new Date("2099-01-01T12:00:00Z"),
      status: "OPEN",
    });
    mockTx.assignmentInterpreter.update.mockResolvedValue({ status: "REMOVED" });
    mockTx.auditEvent.create.mockResolvedValue({});
    mockTx.assignment.findUnique.mockResolvedValue({ ...OPEN_ASSIGNMENT, status: "OPEN", interpreters: [] });
    mockTx.assignment.update.mockResolvedValue({});
  });

  it("succeeds for an assignment in the future", async () => {
    await expect(withdrawFromAssignment(INTERP_ID, ASSIGN_ID)).resolves.not.toThrow();
  });

  it("throws when assignment not found", async () => {
    assignmentModel.findUnique.mockResolvedValue(null);
    await expect(withdrawFromAssignment(INTERP_ID, ASSIGN_ID)).rejects.toThrow(
      "Assignment not found"
    );
  });

  it("throws when assignment is COMPLETED", async () => {
    assignmentModel.findUnique.mockResolvedValue({
      scheduledStart: new Date("2030-01-01T12:00:00Z"),
      status: "COMPLETED",
    });
    await expect(withdrawFromAssignment(INTERP_ID, ASSIGN_ID)).rejects.toThrow(
      "already closed"
    );
  });

  it("throws when assignment has already started", async () => {
    assignmentModel.findUnique.mockResolvedValue({
      scheduledStart: new Date("2000-01-01T12:00:00Z"), // in the past
      status: "OPEN",
    });
    await expect(withdrawFromAssignment(INTERP_ID, ASSIGN_ID)).rejects.toThrow(
      "Cannot withdraw after the assignment has started"
    );
  });

  it("updates link to REMOVED inside transaction", async () => {
    await withdrawFromAssignment(INTERP_ID, ASSIGN_ID);
    expect(mockTx.assignmentInterpreter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REMOVED" }),
      })
    );
  });

  it("creates INTERPRETER_WITHDREW audit event", async () => {
    await withdrawFromAssignment(INTERP_ID, ASSIGN_ID);
    expect(mockTx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "INTERPRETER_WITHDREW" }),
      })
    );
  });
});

// ── requestAssignment ─────────────────────────────────────────────────────────
describe("requestAssignment", () => {
  let mockTx: ReturnType<typeof makeMockTx>;

  const buildRequestTx = (assignmentResponse: unknown) => {
    const tx = makeMockTx();
    $transaction.mockImplementation(async (fn: (tx: typeof tx) => Promise<unknown>) => fn(tx));

    let callCount = 0;
    tx.assignment.findUnique.mockImplementation(async () => {
      const val = callCount === 0 ? assignmentResponse : SYNC_ASSIGNMENT;
      callCount++;
      return val;
    });

    tx.userProfile.findUnique.mockResolvedValue({
      id: INTERP_ID, status: "APPROVED", isActive: true, role: "INTERPRETER",
    });
    tx.assignmentInterpreter.findUnique.mockResolvedValue(null);
    tx.interpreterProfile.findUnique.mockResolvedValue({ timezone: "America/New_York" });
    tx.availabilitySlot.findFirst.mockResolvedValue({ id: "slot-1" });
    tx.assignment.findFirst.mockResolvedValue(null);
    tx.assignmentInterpreter.upsert.mockResolvedValue({
      assignmentId: ASSIGN_ID, userProfileId: INTERP_ID, status: "ASSIGNED",
    });
    tx.auditEvent.create.mockResolvedValue({});
    tx.assignment.update.mockResolvedValue({});

    return tx;
  };

  const OPEN_WITH_VISIBILITY = { ...OPEN_ASSIGNMENT, interpreters: [], visibility: [] };

  beforeEach(() => {
    vi.clearAllMocks();
    mockTx = buildRequestTx(OPEN_WITH_VISIBILITY);
  });

  it("returns the created link on success", async () => {
    const result = await requestAssignment(INTERP_ID, ASSIGN_ID);
    expect(result).toMatchObject({ assignmentId: ASSIGN_ID, status: "ASSIGNED" });
  });

  it("throws when assignment not found", async () => {
    buildRequestTx(null);
    await expect(requestAssignment(INTERP_ID, ASSIGN_ID)).rejects.toThrow("Assignment not found");
  });

  it("throws when assignment is CANCELLED", async () => {
    buildRequestTx({ ...OPEN_WITH_VISIBILITY, status: "CANCELLED" });
    await expect(requestAssignment(INTERP_ID, ASSIGN_ID)).rejects.toThrow("no longer accepting");
  });

  it("throws assignment not visible to RESTRICTED interpreter", async () => {
    buildRequestTx({
      ...OPEN_WITH_VISIBILITY,
      visibilityMode: "RESTRICTED",
      visibility: [{ userProfileId: "other-interp" }],
    });
    await expect(requestAssignment(INTERP_ID, ASSIGN_ID)).rejects.toThrow("not visible");
  });

  it("throws when assignment is fully staffed", async () => {
    buildRequestTx({ ...OPEN_WITH_VISIBILITY, interpretersNeeded: 1, interpreters: [{ status: "ASSIGNED" }] });
    await expect(requestAssignment(INTERP_ID, ASSIGN_ID)).rejects.toThrow("fully staffed");
  });

  it("throws when interpreter is not eligible", async () => {
    mockTx.userProfile.findUnique.mockResolvedValue({ status: "DENIED", isActive: true, role: "INTERPRETER" });
    await expect(requestAssignment(INTERP_ID, ASSIGN_ID)).rejects.toThrow("not eligible");
  });

  it("throws when interpreter already assigned to this job", async () => {
    mockTx.assignmentInterpreter.findUnique.mockResolvedValue({ status: "ASSIGNED" });
    await expect(requestAssignment(INTERP_ID, ASSIGN_ID)).rejects.toThrow("already assigned");
  });

  it("throws when interpreter has no availability", async () => {
    mockTx.availabilitySlot.findFirst.mockResolvedValue(null);
    await expect(requestAssignment(INTERP_ID, ASSIGN_ID)).rejects.toThrow("don't have availability");
  });

  it("throws on double-booking", async () => {
    mockTx.assignment.findFirst.mockResolvedValue({ title: "Another Job" });
    await expect(requestAssignment(INTERP_ID, ASSIGN_ID)).rejects.toThrow("Double-booking");
  });

  it("creates INTERPRETER_SELF_REQUESTED audit event on success", async () => {
    await requestAssignment(INTERP_ID, ASSIGN_ID);
    expect(mockTx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "INTERPRETER_SELF_REQUESTED" }),
      })
    );
  });
});
