/**
 * Tests for lib/audit/write.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { auditEvent } = vi.hoisted(() => ({
  auditEvent: { create: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { auditEvent },
}));

import {
  writeInterpreterAuditEvent,
  writeAssignmentAuditEvent,
} from "@/lib/audit/write";

beforeEach(() => vi.clearAllMocks());

describe("writeInterpreterAuditEvent", () => {
  it("calls prisma.auditEvent.create with correct fields", async () => {
    auditEvent.create.mockResolvedValue({});
    await writeInterpreterAuditEvent({
      userProfileId: "user-1",
      action: "APPROVED",
      actor: "admin@example.com",
      note: "Looks good",
    });

    expect(auditEvent.create).toHaveBeenCalledWith({
      data: {
        userProfileId: "user-1",
        action: "APPROVED",
        actor: "admin@example.com",
        note: "Looks good",
        meta: undefined,
      },
    });
  });

  it("defaults note to null when not provided", async () => {
    auditEvent.create.mockResolvedValue({});
    await writeInterpreterAuditEvent({
      userProfileId: "user-1",
      action: "DENIED",
      actor: "admin@example.com",
    });
    const { data } = auditEvent.create.mock.calls[0][0];
    expect(data.note).toBeNull();
  });

  it("includes meta when provided", async () => {
    auditEvent.create.mockResolvedValue({});
    await writeInterpreterAuditEvent({
      userProfileId: "user-1",
      action: "ACTIVATED",
      actor: "admin@example.com",
      meta: { foo: "bar" },
    });
    const { data } = auditEvent.create.mock.calls[0][0];
    expect(data.meta).toEqual({ foo: "bar" });
  });
});

describe("writeAssignmentAuditEvent", () => {
  it("calls prisma.auditEvent.create with assignmentId", async () => {
    auditEvent.create.mockResolvedValue({});
    await writeAssignmentAuditEvent({
      assignmentId: "assign-1",
      action: "CREATED",
      actor: "admin@example.com",
    });

    expect(auditEvent.create).toHaveBeenCalledWith({
      data: {
        assignmentId: "assign-1",
        action: "CREATED",
        actor: "admin@example.com",
        note: null,
        meta: undefined,
      },
    });
  });

  it("passes note and meta correctly", async () => {
    auditEvent.create.mockResolvedValue({});
    await writeAssignmentAuditEvent({
      assignmentId: "assign-1",
      action: "STATUS_CHANGED",
      actor: "admin@example.com",
      note: "moved to COMPLETED",
      meta: { to: "COMPLETED" },
    });
    const { data } = auditEvent.create.mock.calls[0][0];
    expect(data.note).toBe("moved to COMPLETED");
    expect(data.meta).toEqual({ to: "COMPLETED" });
  });
});
