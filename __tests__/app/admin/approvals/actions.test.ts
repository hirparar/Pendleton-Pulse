/**
 * Tests for app/admin/approvals/actions.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  requireAdmin,
  revalidatePath,
  userProfile,
  auditEvent,
  $transaction,
} = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  userProfile: {
    findUnique: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  auditEvent: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({ requireAdmin }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/prisma", () => ({
  prisma: { userProfile, auditEvent, $transaction },
}));

import {
  approvePendingInterpreter,
  denyPendingInterpreter,
  bulkApprovePending,
  bulkDenyPending,
} from "@/app/admin/approvals/actions";

const ADMIN = { id: "admin-1", email: "admin@example.com", clerkUserId: "clerk-1", role: "ADMIN" };
const INTERP_ID = "interp-abc";
const pendingInterpreter = { id: INTERP_ID, role: "INTERPRETER", status: "PENDING" };

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue(ADMIN);
  // $transaction: handle array of promises (Prisma batch)
  $transaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops));
  userProfile.findUnique.mockResolvedValue(pendingInterpreter);
  userProfile.update.mockResolvedValue({});
  auditEvent.create.mockResolvedValue({});
});

// ─── approvePendingInterpreter ────────────────────────────────────────────────
describe("approvePendingInterpreter", () => {
  it("returns { ok: true } on success", async () => {
    const result = await approvePendingInterpreter({ userProfileId: INTERP_ID });
    expect(result).toEqual({ ok: true });
  });

  it("runs a Prisma transaction", async () => {
    await approvePendingInterpreter({ userProfileId: INTERP_ID });
    expect($transaction).toHaveBeenCalledOnce();
  });

  it("sets status to APPROVED in the transaction", async () => {
    await approvePendingInterpreter({ userProfileId: INTERP_ID });
    expect(userProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: INTERP_ID },
        data: expect.objectContaining({ status: "APPROVED" }),
      })
    );
  });

  it("creates an audit event with APPROVED action", async () => {
    await approvePendingInterpreter({ userProfileId: INTERP_ID });
    expect(auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "APPROVED" }),
      })
    );
  });

  it("calls revalidatePath for admin paths", async () => {
    await approvePendingInterpreter({ userProfileId: INTERP_ID });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/approvals");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/interpreters");
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
  });

  it("throws when interpreter is not PENDING", async () => {
    userProfile.findUnique.mockResolvedValue({ ...pendingInterpreter, status: "APPROVED" });
    await expect(
      approvePendingInterpreter({ userProfileId: INTERP_ID })
    ).rejects.toThrow("Interpreter is not pending");
  });

  it("throws when interpreter role is not INTERPRETER", async () => {
    userProfile.findUnique.mockResolvedValue({ id: INTERP_ID, role: "ADMIN", status: "PENDING" });
    await expect(
      approvePendingInterpreter({ userProfileId: INTERP_ID })
    ).rejects.toThrow("Interpreter not found");
  });

  it("throws when interpreter not found", async () => {
    userProfile.findUnique.mockResolvedValue(null);
    await expect(
      approvePendingInterpreter({ userProfileId: INTERP_ID })
    ).rejects.toThrow("Interpreter not found");
  });

  it("stores cleaned note", async () => {
    await approvePendingInterpreter({ userProfileId: INTERP_ID, note: "  Great candidate  " });
    expect(userProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reviewNote: "Great candidate" }),
      })
    );
  });
});

// ─── denyPendingInterpreter ───────────────────────────────────────────────────
describe("denyPendingInterpreter", () => {
  it("returns { ok: true } on success", async () => {
    const result = await denyPendingInterpreter({ userProfileId: INTERP_ID });
    expect(result).toEqual({ ok: true });
  });

  it("sets status to DENIED", async () => {
    await denyPendingInterpreter({ userProfileId: INTERP_ID });
    expect(userProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DENIED" }),
      })
    );
  });

  it("creates an audit event with DENIED action", async () => {
    await denyPendingInterpreter({ userProfileId: INTERP_ID });
    expect(auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "DENIED" }),
      })
    );
  });

  it("throws when interpreter is not PENDING", async () => {
    userProfile.findUnique.mockResolvedValue({ ...pendingInterpreter, status: "DENIED" });
    await expect(
      denyPendingInterpreter({ userProfileId: INTERP_ID })
    ).rejects.toThrow("Interpreter is not pending");
  });
});

// ─── bulkApprovePending ───────────────────────────────────────────────────────
describe("bulkApprovePending", () => {
  beforeEach(() => {
    userProfile.findMany.mockResolvedValue([{ id: "i1" }, { id: "i2" }]);
    userProfile.updateMany.mockResolvedValue({ count: 2 });
  });

  it("returns { ok: true, updated: count } on success", async () => {
    const result = await bulkApprovePending({ userProfileIds: ["i1", "i2"] });
    expect(result).toEqual({ ok: true, updated: 2 });
  });

  it("throws when userProfileIds is empty", async () => {
    await expect(bulkApprovePending({ userProfileIds: [] })).rejects.toThrow(
      "No interpreters selected"
    );
  });

  it("returns { ok: true, updated: 0 } when none are pending", async () => {
    userProfile.findMany.mockResolvedValue([]);
    const result = await bulkApprovePending({ userProfileIds: ["i1", "i2"] });
    expect(result).toEqual({ ok: true, updated: 0 });
    expect($transaction).not.toHaveBeenCalled();
  });

  it("calls $transaction with updateMany and auditEvent.create per id", async () => {
    await bulkApprovePending({ userProfileIds: ["i1", "i2"] });
    expect($transaction).toHaveBeenCalledOnce();
    const ops = $transaction.mock.calls[0][0];
    // 1 updateMany + 2 auditEvent.creates = 3 ops
    expect(Array.isArray(ops)).toBe(true);
    expect(ops.length).toBe(3);
  });

  it("filters out empty string ids", async () => {
    userProfile.findMany.mockResolvedValue([{ id: "i1" }]);
    const result = await bulkApprovePending({ userProfileIds: ["i1", "", "  "] });
    expect(result.updated).toBe(1);
  });
});

// ─── bulkDenyPending ──────────────────────────────────────────────────────────
describe("bulkDenyPending", () => {
  beforeEach(() => {
    userProfile.findMany.mockResolvedValue([{ id: "i1" }, { id: "i2" }]);
    userProfile.updateMany.mockResolvedValue({ count: 2 });
  });

  it("returns { ok: true, updated: count } on success", async () => {
    const result = await bulkDenyPending({ userProfileIds: ["i1", "i2"] });
    expect(result).toEqual({ ok: true, updated: 2 });
  });

  it("throws when userProfileIds is empty", async () => {
    await expect(bulkDenyPending({ userProfileIds: [] })).rejects.toThrow(
      "No interpreters selected"
    );
  });

  it("returns { ok: true, updated: 0 } when none are pending", async () => {
    userProfile.findMany.mockResolvedValue([]);
    const result = await bulkDenyPending({ userProfileIds: ["i1", "i2"] });
    expect(result).toEqual({ ok: true, updated: 0 });
    expect($transaction).not.toHaveBeenCalled();
  });

  it("calls $transaction with updateMany + auditEvent.create per id", async () => {
    await bulkDenyPending({ userProfileIds: ["i1", "i2"] });
    expect($transaction).toHaveBeenCalledOnce();
    const ops = $transaction.mock.calls[0][0];
    expect(Array.isArray(ops)).toBe(true);
    // 1 updateMany + 2 auditEvent.creates
    expect(ops.length).toBe(3);
  });

  it("sets status to DENIED in updateMany", async () => {
    await bulkDenyPending({ userProfileIds: ["i1"] });
    expect(userProfile.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DENIED" }),
      })
    );
  });

  it("creates DENIED audit events with bulk meta", async () => {
    await bulkDenyPending({ userProfileIds: ["i1"] });
    expect(auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "DENIED",
          meta: expect.objectContaining({ bulk: true }),
        }),
      })
    );
  });

  it("revalidates paths after transaction", async () => {
    await bulkDenyPending({ userProfileIds: ["i1"] });
    expect(revalidatePath).toHaveBeenCalled();
  });
});
