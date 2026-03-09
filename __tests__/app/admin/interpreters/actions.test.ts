/**
 * Tests for app/admin/interpreters/actions.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  requireAdmin,
  revalidatePath,
  userProfile,
  setInterpreterActiveCore,
  bulkSetInterpreterActiveCore,
  writeInterpreterAuditEvent,
} = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  userProfile: {
    findUnique: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  setInterpreterActiveCore: vi.fn(),
  bulkSetInterpreterActiveCore: vi.fn(),
  writeInterpreterAuditEvent: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({ requireAdmin }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/prisma", () => ({ prisma: { userProfile } }));
vi.mock("@/lib/admin/interpreters", () => ({
  setInterpreterActiveCore,
  bulkSetInterpreterActiveCore,
  assertInterpreterExists: vi.fn(),
}));
vi.mock("@/lib/audit/write", () => ({ writeInterpreterAuditEvent }));

import {
  approveInterpreterById,
  denyInterpreterById,
  setInterpreterActive,
  bulkSetInterpreterActive,
} from "@/app/admin/interpreters/actions";

const ADMIN = { id: "admin-1", email: "admin@example.com", clerkUserId: "clerk-1", role: "ADMIN" };
const INTERP_ID = "interp-abc";

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue(ADMIN);
  userProfile.update.mockResolvedValue({});
  writeInterpreterAuditEvent.mockResolvedValue({});
  setInterpreterActiveCore.mockResolvedValue({ ok: true, isActive: true });
  bulkSetInterpreterActiveCore.mockResolvedValue({ ok: true, updated: 2, total: 2 });
});

// ─── approveInterpreterById ───────────────────────────────────────────────────
describe("approveInterpreterById", () => {
  it("updates profile status to APPROVED", async () => {

    await approveInterpreterById(INTERP_ID);
    expect(userProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: INTERP_ID },
        data: expect.objectContaining({ status: "APPROVED" }),
      })
    );
  });

  it("writes an audit event with APPROVED action", async () => {
    await approveInterpreterById(INTERP_ID);
    expect(writeInterpreterAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "APPROVED" })
    );
  });

  it("uses admin email as actor", async () => {
    await approveInterpreterById(INTERP_ID);
    expect(writeInterpreterAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actor: "admin@example.com" })
    );
  });

  it("revalidates relevant paths", async () => {
    await approveInterpreterById(INTERP_ID);
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/approvals");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/interpreters");
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/interpreters/${INTERP_ID}`);
  });

  it("cleans the optional note", async () => {
    await approveInterpreterById(INTERP_ID, "  Good applicant  ");
    expect(writeInterpreterAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ note: "Good applicant" })
    );
  });

  it("resolves to undefined (no explicit return)", async () => {
    const result = await approveInterpreterById(INTERP_ID);
    expect(result).toBeUndefined();
  });
});

// ─── denyInterpreterById ─────────────────────────────────────────────────────
describe("denyInterpreterById", () => {
  it("updates profile status to DENIED", async () => {
    await denyInterpreterById(INTERP_ID);
    expect(userProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DENIED" }),
      })
    );
  });

  it("writes an audit event with DENIED action", async () => {
    await denyInterpreterById(INTERP_ID);
    expect(writeInterpreterAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DENIED" })
    );
  });
  it("resolves to undefined", async () => {
    const result = await denyInterpreterById(INTERP_ID);
    expect(result).toBeUndefined();
  });});

// ─── setInterpreterActive ─────────────────────────────────────────────────────
describe("setInterpreterActive", () => {
  it("delegates to setInterpreterActiveCore with cleaned args", async () => {
    const result = await setInterpreterActive({
      userProfileId: INTERP_ID,
      isActive: true,
      note: "  re-activated  ",
    });
    expect(setInterpreterActiveCore).toHaveBeenCalledWith({
      userProfileId: INTERP_ID,
      isActive: true,
      actor: "admin@example.com",
      note: "re-activated",
    });
    expect(result).toEqual({ ok: true, isActive: true });
  });

  it("revalidates paths after update", async () => {
    await setInterpreterActive({ userProfileId: INTERP_ID, isActive: false });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/interpreters");
  });
});

// ─── bulkSetInterpreterActive ─────────────────────────────────────────────────
describe("bulkSetInterpreterActive", () => {
  it("delegates to bulkSetInterpreterActiveCore", async () => {
    const result = await bulkSetInterpreterActive({
      userProfileIds: ["i1", "i2"],
      isActive: true,
    });
    expect(bulkSetInterpreterActiveCore).toHaveBeenCalledWith({
      userProfileIds: ["i1", "i2"],
      isActive: true,
      actor: "admin@example.com",
      note: null,
    });
    expect(result).toEqual({ ok: true, updated: 2, total: 2 });
  });

  it("handles non-array userProfileIds gracefully", async () => {
    bulkSetInterpreterActiveCore.mockResolvedValue({ ok: true, updated: 0, total: 0 });
    await bulkSetInterpreterActive({
      userProfileIds: null as any,
      isActive: true,
    });
    const { userProfileIds } = bulkSetInterpreterActiveCore.mock.calls[0][0];
    expect(Array.isArray(userProfileIds)).toBe(true);
  });

  it("revalidates paths after bulk update", async () => {
    await bulkSetInterpreterActive({ userProfileIds: ["i1"], isActive: true });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/interpreters");
  });
});
