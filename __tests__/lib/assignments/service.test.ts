/**
 * Tier 2 tests for lib/assignments/service.ts
 * Prisma is fully mocked — no real DB connections.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Prisma mock ──────────────────────────────────────────────────────────────
const {
  assignment,
  assignmentInterpreter,
  assignmentVisibility,
  auditEvent,
  userProfile,
  interpreterProfile,
  $transaction,
} = vi.hoisted(() => ({
  assignment: {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  assignmentInterpreter: {
    upsert: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
  },
  assignmentVisibility: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  auditEvent: {
    create: vi.fn(),
  },
  userProfile: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  interpreterProfile: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    assignment,
    assignmentInterpreter,
    assignmentVisibility,
    auditEvent,
    userProfile,
    interpreterProfile,
    $transaction,
  },
}));

import {
  createAssignment,
  updateAssignmentDetails,
  setAssignmentStatus,
  setAssignmentVisibility,
  listAssignmentsAdmin,
  getAssignmentAdmin,
  withdrawFromAssignment,
} from "@/lib/assignments/service";

const ADMIN = { id: "admin-id", email: "admin@example.com", clerkUserId: "clerk-admin" };
const ASSIGNMENT_ID = "assign-123";
const INTERPRETER_ID = "interp-456";

/** Makes $transaction call the callback with the same mock objects as tx */
const mockTx = {
  assignment,
  assignmentInterpreter,
  assignmentVisibility,
  auditEvent,
  userProfile,
  interpreterProfile,
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: $transaction executes the callback
  $transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
    fn(mockTx)
  );
});

// ─── createAssignment ─────────────────────────────────────────────────────────
describe("createAssignment", () => {
  const validBody = {
    clientName: "Acme Corp",
    languagePair: "English-Spanish",
    assignmentType: "Medical",
    location: "Room 3",
    scheduledStart: "2026-06-15T09:00:00Z",
    scheduledEnd: "2026-06-15T11:00:00Z",
    interpretersNeeded: 1,
  };

  it("creates assignment and audit event inside a transaction", async () => {
    const mockRecord = { id: ASSIGNMENT_ID, ...validBody };
    assignment.create.mockResolvedValue(mockRecord);
    auditEvent.create.mockResolvedValue({});

    const result = await createAssignment(ADMIN, validBody);

    expect($transaction).toHaveBeenCalledOnce();
    expect(assignment.create).toHaveBeenCalledOnce();
    expect(auditEvent.create).toHaveBeenCalledOnce();
    expect(result).toEqual(mockRecord);
  });

  it("sets status to OPEN and visibilityMode to ALL by default", async () => {
    assignment.create.mockResolvedValue({ id: ASSIGNMENT_ID });
    auditEvent.create.mockResolvedValue({});
    await createAssignment(ADMIN, validBody);
    const { data } = assignment.create.mock.calls[0][0];
    expect(data.status).toBe("OPEN");
    expect(data.visibilityMode).toBe("ALL");
  });

  it("defaults interpretersNeeded to 1 when not provided", async () => {
    assignment.create.mockResolvedValue({ id: ASSIGNMENT_ID });
    auditEvent.create.mockResolvedValue({});
    const { interpretersNeeded: _, ...bodyWithout } = validBody;
    await createAssignment(ADMIN, bodyWithout);
    const { data } = assignment.create.mock.calls[0][0];
    expect(data.interpretersNeeded).toBe(1);
  });

  it("throws when clientName is missing", async () => {
    await expect(createAssignment(ADMIN, { ...validBody, clientName: "" })).rejects.toThrow(
      "Client name is required"
    );
    expect(assignment.create).not.toHaveBeenCalled();
  });

  it("throws when scheduledEnd is before scheduledStart", async () => {
    await expect(
      createAssignment(ADMIN, {
        ...validBody,
        scheduledStart: "2026-06-15T11:00:00Z",
        scheduledEnd: "2026-06-15T09:00:00Z",
      })
    ).rejects.toThrow("End time must be after start time");
    expect(assignment.create).not.toHaveBeenCalled();
  });

  it("throws when scheduledEnd equals scheduledStart", async () => {
    await expect(
      createAssignment(ADMIN, {
        ...validBody,
        scheduledStart: "2026-06-15T09:00:00Z",
        scheduledEnd: "2026-06-15T09:00:00Z",
      })
    ).rejects.toThrow("End time must be after start time");
  });

  it("throws when location is missing", async () => {
    await expect(createAssignment(ADMIN, { ...validBody, location: "  " })).rejects.toThrow(
      "Location is required"
    );
  });

  it("stores specialNotes as null when omitted", async () => {
    assignment.create.mockResolvedValue({ id: ASSIGNMENT_ID });
    auditEvent.create.mockResolvedValue({});
    const { specialNotes: _, ...bodyWithout } = validBody as typeof validBody & { specialNotes?: string };
    await createAssignment(ADMIN, bodyWithout);
    const { data } = assignment.create.mock.calls[0][0];
    expect(data.specialNotes).toBeNull();
  });
});

// ─── updateAssignmentDetails ──────────────────────────────────────────────────
describe("updateAssignmentDetails", () => {
  it("calls transaction and updates assignment", async () => {
    assignment.update.mockResolvedValue({ id: ASSIGNMENT_ID });
    auditEvent.create.mockResolvedValue({});
    await updateAssignmentDetails(ADMIN, ASSIGNMENT_ID, { clientName: "New Name" });
    expect($transaction).toHaveBeenCalledOnce();
    expect(assignment.update).toHaveBeenCalledOnce();
  });

  it("throws when new end time is before new start time", async () => {
    await expect(
      updateAssignmentDetails(ADMIN, ASSIGNMENT_ID, {
        scheduledStart: "2026-06-15T10:00:00Z",
        scheduledEnd: "2026-06-15T08:00:00Z",
      })
    ).rejects.toThrow("End time must be after start time");
    expect(assignment.update).not.toHaveBeenCalled();
  });

  it("does not include fields absent from body in patch", async () => {
    assignment.update.mockResolvedValue({ id: ASSIGNMENT_ID });
    auditEvent.create.mockResolvedValue({});
    await updateAssignmentDetails(ADMIN, ASSIGNMENT_ID, { clientName: "Only Name" });
    const { data } = assignment.update.mock.calls[0][0];
    expect(data).not.toHaveProperty("languagePair");
    expect(data.clientName).toBe("Only Name");
  });
});

// ─── setAssignmentStatus ──────────────────────────────────────────────────────
describe("setAssignmentStatus", () => {
  const validStatuses = ["OPEN", "ASSIGNED", "COMPLETED", "CANCELLED"] as const;

  for (const status of validStatuses) {
    it(`accepts valid status '${status}'`, async () => {
      assignment.update.mockResolvedValue({ id: ASSIGNMENT_ID });
      auditEvent.create.mockResolvedValue({});
      await expect(setAssignmentStatus(ADMIN, ASSIGNMENT_ID, status)).resolves.not.toThrow();
    });
  }

  it("throws for invalid status string", async () => {
    await expect(setAssignmentStatus(ADMIN, ASSIGNMENT_ID, "INVALID")).rejects.toThrow(
      "Invalid status: INVALID"
    );
    expect($transaction).not.toHaveBeenCalled();
  });

  it("throws for non-string status", async () => {
    await expect(setAssignmentStatus(ADMIN, ASSIGNMENT_ID, null)).rejects.toThrow();
  });

  it("calls transaction with correct status in update", async () => {
    assignment.update.mockResolvedValue({ id: ASSIGNMENT_ID, status: "COMPLETED" });
    auditEvent.create.mockResolvedValue({});
    await setAssignmentStatus(ADMIN, ASSIGNMENT_ID, "COMPLETED");
    const { data } = assignment.update.mock.calls[0][0];
    expect(data.status).toBe("COMPLETED");
  });

  it("uses admin email as actor in audit event", async () => {
    assignment.update.mockResolvedValue({ id: ASSIGNMENT_ID });
    auditEvent.create.mockResolvedValue({});
    await setAssignmentStatus(ADMIN, ASSIGNMENT_ID, "OPEN");
    const { data } = auditEvent.create.mock.calls[0][0];
    expect(data.actor).toBe("admin@example.com");
  });

  it("falls back to clerkUserId when email is null", async () => {
    const adminNoEmail = { ...ADMIN, email: null };
    assignment.update.mockResolvedValue({ id: ASSIGNMENT_ID });
    auditEvent.create.mockResolvedValue({});
    await setAssignmentStatus(adminNoEmail, ASSIGNMENT_ID, "OPEN");
    const { data } = auditEvent.create.mock.calls[0][0];
    expect(data.actor).toBe("clerk-admin");
  });
});

// ─── setAssignmentVisibility ──────────────────────────────────────────────────
describe("setAssignmentVisibility", () => {
  it("throws when RESTRICTED mode has no interpreter IDs", async () => {
    await expect(
      setAssignmentVisibility(ADMIN, ASSIGNMENT_ID, "RESTRICTED", [])
    ).rejects.toThrow("Restricted visibility requires at least one interpreter");
    expect($transaction).not.toHaveBeenCalled();
  });

  it("calls transaction for ALL mode without creating visibility rows", async () => {
    assignment.update.mockResolvedValue({ id: ASSIGNMENT_ID });
    assignmentVisibility.deleteMany.mockResolvedValue({});
    auditEvent.create.mockResolvedValue({});
    await setAssignmentVisibility(ADMIN, ASSIGNMENT_ID, "ALL", []);
    expect($transaction).toHaveBeenCalledOnce();
    expect(assignmentVisibility.createMany).not.toHaveBeenCalled();
  });

  it("creates visibility rows for RESTRICTED mode", async () => {
    assignment.update.mockResolvedValue({ id: ASSIGNMENT_ID });
    assignmentVisibility.deleteMany.mockResolvedValue({});
    assignmentVisibility.createMany.mockResolvedValue({ count: 2 });
    auditEvent.create.mockResolvedValue({});
    await setAssignmentVisibility(ADMIN, ASSIGNMENT_ID, "RESTRICTED", ["interp-1", "interp-2"]);
    expect(assignmentVisibility.createMany).toHaveBeenCalledWith({
      data: [
        { assignmentId: ASSIGNMENT_ID, userProfileId: "interp-1" },
        { assignmentId: ASSIGNMENT_ID, userProfileId: "interp-2" },
      ],
      skipDuplicates: true,
    });
  });

  it("always deletes existing visibility rows before setting new ones", async () => {
    assignment.update.mockResolvedValue({ id: ASSIGNMENT_ID });
    assignmentVisibility.deleteMany.mockResolvedValue({});
    assignmentVisibility.createMany.mockResolvedValue({ count: 1 });
    auditEvent.create.mockResolvedValue({});
    await setAssignmentVisibility(ADMIN, ASSIGNMENT_ID, "RESTRICTED", [INTERPRETER_ID]);
    expect(assignmentVisibility.deleteMany).toHaveBeenCalledWith({ where: { assignmentId: ASSIGNMENT_ID } });
  });
});

// ─── listAssignmentsAdmin ─────────────────────────────────────────────────────
describe("listAssignmentsAdmin", () => {
  it("calls findMany and returns results", async () => {
    const mockData = [{ id: "a1" }, { id: "a2" }];
    assignment.findMany.mockResolvedValue(mockData);
    const result = await listAssignmentsAdmin();
    expect(assignment.findMany).toHaveBeenCalledOnce();
    expect(result).toEqual(mockData);
  });

  it("orders by scheduledStart ascending then createdAt descending", async () => {
    assignment.findMany.mockResolvedValue([]);
    await listAssignmentsAdmin();
    const { orderBy } = assignment.findMany.mock.calls[0][0];
    expect(orderBy).toEqual([{ scheduledStart: "asc" }, { createdAt: "desc" }]);
  });

  it("limits to 500 rows", async () => {
    assignment.findMany.mockResolvedValue([]);
    await listAssignmentsAdmin();
    const { take } = assignment.findMany.mock.calls[0][0];
    expect(take).toBe(500);
  });
});

// ─── getAssignmentAdmin ───────────────────────────────────────────────────────
describe("getAssignmentAdmin", () => {
  it("calls findUnique with the given assignment id", async () => {
    assignment.findUnique.mockResolvedValue({ id: ASSIGNMENT_ID });
    const result = await getAssignmentAdmin(ASSIGNMENT_ID);
    expect(assignment.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ASSIGNMENT_ID } })
    );
    expect(result).toEqual({ id: ASSIGNMENT_ID });
  });
});

// ─── withdrawFromAssignment ───────────────────────────────────────────────────
describe("withdrawFromAssignment", () => {
  it("throws when assignment not found", async () => {
    assignment.findUnique.mockResolvedValue(null);
    await expect(withdrawFromAssignment(INTERPRETER_ID, ASSIGNMENT_ID)).rejects.toThrow(
      "Assignment not found"
    );
    expect($transaction).not.toHaveBeenCalled();
  });

  it("throws when assignment is COMPLETED", async () => {
    assignment.findUnique.mockResolvedValue({
      id: ASSIGNMENT_ID,
      status: "COMPLETED",
      scheduledStart: new Date(Date.now() + 86400000),
    });
    await expect(withdrawFromAssignment(INTERPRETER_ID, ASSIGNMENT_ID)).rejects.toThrow(
      "This assignment is already closed"
    );
  });

  it("throws when assignment is CANCELLED", async () => {
    assignment.findUnique.mockResolvedValue({
      id: ASSIGNMENT_ID,
      status: "CANCELLED",
      scheduledStart: new Date(Date.now() + 86400000),
    });
    await expect(withdrawFromAssignment(INTERPRETER_ID, ASSIGNMENT_ID)).rejects.toThrow(
      "This assignment is already closed"
    );
  });

  it("throws when assignment has already started", async () => {
    assignment.findUnique.mockResolvedValue({
      id: ASSIGNMENT_ID,
      status: "ASSIGNED",
      scheduledStart: new Date(Date.now() - 3600000), // 1 hour ago
    });
    await expect(withdrawFromAssignment(INTERPRETER_ID, ASSIGNMENT_ID)).rejects.toThrow(
      "Cannot withdraw after the assignment has started"
    );
    expect($transaction).not.toHaveBeenCalled();
  });

  it("runs transaction when all checks pass", async () => {
    assignment.findUnique.mockResolvedValue({
      id: ASSIGNMENT_ID,
      status: "OPEN",
      scheduledStart: new Date(Date.now() + 86400000), // tomorrow
    });

    // syncAssignmentStatus calls assignment.findUnique inside tx
    assignment.findUnique.mockResolvedValueOnce({
      id: ASSIGNMENT_ID,
      status: "OPEN",
      scheduledStart: new Date(Date.now() + 86400000),
    }).mockResolvedValueOnce({
      id: ASSIGNMENT_ID,
      status: "ASSIGNED",
      interpretersNeeded: 1,
      interpreters: [],
    });

    assignmentInterpreter.update.mockResolvedValue({});
    auditEvent.create.mockResolvedValue({});

    await withdrawFromAssignment(INTERPRETER_ID, ASSIGNMENT_ID);
    expect($transaction).toHaveBeenCalledOnce();
  });
});
