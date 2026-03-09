/**
 * Tests for lib/admin/interpreters.ts
 * Prisma is fully mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { userProfile, auditEvent, $transaction } = vi.hoisted(() => ({
  userProfile: {
    findUnique: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  auditEvent: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { userProfile, auditEvent, $transaction },
}));

import {
  assertInterpreterExists,
  setInterpreterActiveCore,
  bulkSetInterpreterActiveCore,
} from "@/lib/admin/interpreters";

const INTERP_ID = "interp-abc";
const ACTOR = "admin@example.com";

beforeEach(() => {
  vi.clearAllMocks();
  $transaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops));
});

// ─── assertInterpreterExists ──────────────────────────────────────────────────
describe("assertInterpreterExists", () => {
  it("returns the interpreter when found with INTERPRETER role", async () => {
    const record = { id: INTERP_ID, role: "INTERPRETER", isActive: true, status: "APPROVED" };
    userProfile.findUnique.mockResolvedValue(record);
    const result = await assertInterpreterExists(INTERP_ID);
    expect(result).toEqual(record);
  });

  it("throws when userProfile not found", async () => {
    userProfile.findUnique.mockResolvedValue(null);
    await expect(assertInterpreterExists(INTERP_ID)).rejects.toThrow("Interpreter not found");
  });

  it("throws when role is not INTERPRETER", async () => {
    userProfile.findUnique.mockResolvedValue({
      id: INTERP_ID,
      role: "ADMIN",
      isActive: true,
      status: "APPROVED",
    });
    await expect(assertInterpreterExists(INTERP_ID)).rejects.toThrow("Interpreter not found");
  });

  it("queries by the provided id", async () => {
    userProfile.findUnique.mockResolvedValue(null);
    await expect(assertInterpreterExists(INTERP_ID)).rejects.toThrow();
    expect(userProfile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: INTERP_ID } })
    );
  });
});

// ─── setInterpreterActiveCore ─────────────────────────────────────────────────
describe("setInterpreterActiveCore", () => {
  const baseInterpreter = { id: INTERP_ID, role: "INTERPRETER", isActive: false, status: "APPROVED" };

  it("returns early without updating when isActive is already the target value", async () => {
    userProfile.findUnique.mockResolvedValue({ ...baseInterpreter, isActive: true });
    const result = await setInterpreterActiveCore({
      userProfileId: INTERP_ID,
      isActive: true,
      actor: ACTOR,
    });
    expect(result).toEqual({ ok: true, isActive: true });
    expect(userProfile.update).not.toHaveBeenCalled();
    expect(auditEvent.create).not.toHaveBeenCalled();
  });

  it("updates isActive and creates audit event when value changes", async () => {
    userProfile.findUnique.mockResolvedValue(baseInterpreter);
    userProfile.update.mockResolvedValue({});
    auditEvent.create.mockResolvedValue({});

    const result = await setInterpreterActiveCore({
      userProfileId: INTERP_ID,
      isActive: true,
      actor: ACTOR,
    });

    expect(result).toEqual({ ok: true, isActive: true });
    expect(userProfile.update).toHaveBeenCalledWith({
      where: { id: INTERP_ID },
      data: { isActive: true },
    });
    expect(auditEvent.create).toHaveBeenCalledOnce();
  });

  it("uses ACTIVATED action when enabling", async () => {
    userProfile.findUnique.mockResolvedValue({ ...baseInterpreter, isActive: false });
    userProfile.update.mockResolvedValue({});
    auditEvent.create.mockResolvedValue({});

    await setInterpreterActiveCore({ userProfileId: INTERP_ID, isActive: true, actor: ACTOR });
    const { data } = auditEvent.create.mock.calls[0][0];
    expect(data.action).toBe("ACTIVATED");
  });

  it("uses DEACTIVATED action when disabling", async () => {
    userProfile.findUnique.mockResolvedValue({ ...baseInterpreter, isActive: true });
    userProfile.update.mockResolvedValue({});
    auditEvent.create.mockResolvedValue({});

    await setInterpreterActiveCore({ userProfileId: INTERP_ID, isActive: false, actor: ACTOR });
    const { data } = auditEvent.create.mock.calls[0][0];
    expect(data.action).toBe("DEACTIVATED");
  });

  it("throws when interpreter not found", async () => {
    userProfile.findUnique.mockResolvedValue(null);
    await expect(
      setInterpreterActiveCore({ userProfileId: "bad-id", isActive: true, actor: ACTOR })
    ).rejects.toThrow("Interpreter not found");
  });
});

// ─── bulkSetInterpreterActiveCore ─────────────────────────────────────────────
describe("bulkSetInterpreterActiveCore", () => {
  it("throws when userProfileIds is empty", async () => {
    await expect(
      bulkSetInterpreterActiveCore({ userProfileIds: [], isActive: true, actor: ACTOR })
    ).rejects.toThrow("No interpreters selected");
  });

  it("returns { updated: 0 } when all targets already have the desired isActive value", async () => {
    userProfile.findMany.mockResolvedValue([
      { id: "i1", isActive: true, status: "APPROVED" },
      { id: "i2", isActive: true, status: "APPROVED" },
    ]);
    const result = await bulkSetInterpreterActiveCore({
      userProfileIds: ["i1", "i2"],
      isActive: true,
      actor: ACTOR,
    });
    expect(result).toEqual({ ok: true, updated: 0, total: 2 });
    expect($transaction).not.toHaveBeenCalled();
  });

  it("runs transaction and returns correct updated count", async () => {
    userProfile.findMany.mockResolvedValue([
      { id: "i1", isActive: false, status: "APPROVED" },
      { id: "i2", isActive: true, status: "APPROVED" }, // already active — skipped
    ]);
    userProfile.updateMany.mockResolvedValue({ count: 1 });
    auditEvent.create.mockResolvedValue({});

    const result = await bulkSetInterpreterActiveCore({
      userProfileIds: ["i1", "i2"],
      isActive: true,
      actor: ACTOR,
    });

    expect(result).toEqual({ ok: true, updated: 1, total: 2 });
    expect($transaction).toHaveBeenCalledOnce();
  });

  it("only queries for INTERPRETER role", async () => {
    userProfile.findMany.mockResolvedValue([]);
    await bulkSetInterpreterActiveCore({ userProfileIds: ["i1"], isActive: true, actor: ACTOR });
    const { where } = userProfile.findMany.mock.calls[0][0];
    expect(where.role).toBe("INTERPRETER");
  });
});
