/**
 * Tests for app/admin/interpreters/[id]/actions.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  requireAdmin,
  revalidatePath,
  userProfile,
  interpreterProfile,
  setInterpreterActiveCore,
  writeInterpreterAuditEvent,
} = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  userProfile: { findUnique: vi.fn() },
  interpreterProfile: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  setInterpreterActiveCore: vi.fn(),
  writeInterpreterAuditEvent: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({ requireAdmin }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/prisma", () => ({
  prisma: { userProfile, interpreterProfile },
}));
vi.mock("@/lib/admin/interpreters", () => ({
  setInterpreterActiveCore,
  assertInterpreterExists: vi.fn(),
  bulkSetInterpreterActiveCore: vi.fn(),
}));
vi.mock("@/lib/audit/write", () => ({ writeInterpreterAuditEvent }));

import {
  setInterpreterActive,
  updateInterpreterCore,
} from "@/app/admin/interpreters/[id]/actions";

const ADMIN = { id: "admin-1", email: "admin@example.com", clerkUserId: "clerk-1", role: "ADMIN" };
const INTERP_ID = "interp-xyz";

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue(ADMIN);
  setInterpreterActiveCore.mockResolvedValue({ ok: true, isActive: true });
  writeInterpreterAuditEvent.mockResolvedValue({});
  userProfile.findUnique.mockResolvedValue({ id: INTERP_ID, role: "INTERPRETER" });
  interpreterProfile.findUnique.mockResolvedValue(null);
  interpreterProfile.create.mockResolvedValue({});
  interpreterProfile.update.mockResolvedValue({});
});

// ─── setInterpreterActive ─────────────────────────────────────────────────────
describe("setInterpreterActive (from [id] actions)", () => {
  it("returns result from setInterpreterActiveCore", async () => {
    setInterpreterActiveCore.mockResolvedValue({ ok: true, isActive: false });
    const result = await setInterpreterActive({ userProfileId: INTERP_ID, isActive: false });
    expect(result).toEqual({ ok: true, isActive: false });
  });

  it("delegates to setInterpreterActiveCore with actor", async () => {
    await setInterpreterActive({ userProfileId: INTERP_ID, isActive: true, note: "Reinstated" });
    expect(setInterpreterActiveCore).toHaveBeenCalledWith({
      userProfileId: INTERP_ID,
      isActive: true,
      actor: "admin@example.com",
      note: "Reinstated",
    });
  });

  it("revalidates /admin, /admin/interpreters, and /admin/interpreters/:id", async () => {
    await setInterpreterActive({ userProfileId: INTERP_ID, isActive: true });
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/interpreters");
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/interpreters/${INTERP_ID}`);
  });

  it("trims and cleans the note", async () => {
    await setInterpreterActive({ userProfileId: INTERP_ID, isActive: true, note: "  note  " });
    expect(setInterpreterActiveCore).toHaveBeenCalledWith(
      expect.objectContaining({ note: "note" })
    );
  });
});

// ─── updateInterpreterCore ────────────────────────────────────────────────────
describe("updateInterpreterCore", () => {
  const validInput = {
    userProfileId: INTERP_ID,
    languages: ["Spanish", "English"],
    certifications: ["ATA"],
    experienceYears: 5,
    note: "Admin update",
  };

  it("returns { ok: true } on success (no existing profile → creates)", async () => {
    interpreterProfile.findUnique.mockResolvedValue(null);
    const result = await updateInterpreterCore(validInput);
    expect(result).toEqual({ ok: true });
    expect(interpreterProfile.create).toHaveBeenCalledOnce();
  });

  it("updates when interpreterProfile already exists", async () => {
    interpreterProfile.findUnique.mockResolvedValue({
      languages: ["French"],
      certifications: [],
      experienceYears: 3,
    });
    const result = await updateInterpreterCore(validInput);
    expect(result).toEqual({ ok: true });
    expect(interpreterProfile.update).toHaveBeenCalledOnce();
    expect(interpreterProfile.create).not.toHaveBeenCalled();
  });

  it("throws 'Missing userProfileId' for empty userProfileId", async () => {
    await expect(
      updateInterpreterCore({ ...validInput, userProfileId: "  " })
    ).rejects.toThrow("Missing userProfileId");
  });

  it("throws 'Interpreter not found' for unknown id", async () => {
    userProfile.findUnique.mockResolvedValue(null);
    await expect(updateInterpreterCore(validInput)).rejects.toThrow("Interpreter not found");
  });

  it("throws 'Interpreter not found' when role is not INTERPRETER", async () => {
    userProfile.findUnique.mockResolvedValue({ id: INTERP_ID, role: "ADMIN" });
    await expect(updateInterpreterCore(validInput)).rejects.toThrow("Interpreter not found");
  });

  it("calls writeInterpreterAuditEvent with PROFILE_CORE_UPDATED action", async () => {
    await updateInterpreterCore(validInput);
    expect(writeInterpreterAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PROFILE_CORE_UPDATED" })
    );
  });

  it("filters empty strings from languages array", async () => {
    await updateInterpreterCore({ ...validInput, languages: ["Spanish", "", "English"] });
    expect(interpreterProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ languages: ["Spanish", "English"] }),
      })
    );
  });

  it("revalidates /admin/interpreters and /admin/interpreters/:id", async () => {
    await updateInterpreterCore(validInput);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/interpreters");
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/interpreters/${INTERP_ID}`);
  });
});
