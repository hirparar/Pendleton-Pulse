/**
 * Tests for app/admin/assignments/[id]/actions.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  requireAdmin,
  revalidatePath,
  updateAssignmentDetails,
  setAssignmentStatus,
  setAssignmentVisibility,
  assignInterpreterToJob,
  removeInterpreterFromJob,
} = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  updateAssignmentDetails: vi.fn(),
  setAssignmentStatus: vi.fn(),
  setAssignmentVisibility: vi.fn(),
  assignInterpreterToJob: vi.fn(),
  removeInterpreterFromJob: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({ requireAdmin }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/assignments/service", () => ({
  updateAssignmentDetails,
  setAssignmentStatus,
  setAssignmentVisibility,
  assignInterpreterToJob,
  removeInterpreterFromJob,
  // stubs for other exports
  createAssignment: vi.fn(),
  listAssignmentsAdmin: vi.fn(),
  requestAssignment: vi.fn(),
  withdrawFromAssignment: vi.fn(),
}));

import {
  updateAssignmentAction,
  setStatusAction,
  setVisibilityAction,
  assignInterpreterAction,
  removeInterpreterAction,
} from "@/app/admin/assignments/[id]/actions";

const ADMIN = { id: "admin-1", email: "admin@example.com", clerkUserId: "clerk-1", role: "ADMIN" };
const ASSIGNMENT_ID = "assign-123";
const INTERP_ID = "interp-456";

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue(ADMIN);
  updateAssignmentDetails.mockResolvedValue({});
  setAssignmentStatus.mockResolvedValue({});
  setAssignmentVisibility.mockResolvedValue({});
  assignInterpreterToJob.mockResolvedValue({});
  removeInterpreterFromJob.mockResolvedValue({});
});

// ─── updateAssignmentAction ───────────────────────────────────────────────────
describe("updateAssignmentAction", () => {
  it("returns { ok: true } on success", async () => {
    const result = await updateAssignmentAction(ASSIGNMENT_ID, { clientName: "New" });
    expect(result).toEqual({ ok: true });
  });

  it("calls updateAssignmentDetails with admin and patch", async () => {
    await updateAssignmentAction(ASSIGNMENT_ID, { clientName: "New" });
    expect(updateAssignmentDetails).toHaveBeenCalledWith(ADMIN, ASSIGNMENT_ID, { clientName: "New" });
  });

  it("revalidates assignment paths on success", async () => {
    await updateAssignmentAction(ASSIGNMENT_ID, {});
    expect(revalidatePath).toHaveBeenCalledWith("/admin/assignments");
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/assignments/${ASSIGNMENT_ID}`);
  });

  it("returns { ok: false, error } when service throws", async () => {
    updateAssignmentDetails.mockRejectedValue(new Error("Client name is required"));
    const result = await updateAssignmentAction(ASSIGNMENT_ID, { clientName: "" });
    expect(result).toEqual({ ok: false, error: "Client name is required" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns generic error message for non-Error throws", async () => {
    updateAssignmentDetails.mockRejectedValue("oops");
    const result = await updateAssignmentAction(ASSIGNMENT_ID, {});
    expect(result).toEqual({ ok: false, error: "Failed to update assignment" });
  });
});

// ─── setStatusAction ──────────────────────────────────────────────────────────
describe("setStatusAction", () => {
  it("returns { ok: true } on success", async () => {
    const result = await setStatusAction(ASSIGNMENT_ID, "COMPLETED");
    expect(result).toEqual({ ok: true });
  });

  it("passes status and note to setAssignmentStatus", async () => {
    await setStatusAction(ASSIGNMENT_ID, "CANCELLED", "No longer needed");
    expect(setAssignmentStatus).toHaveBeenCalledWith(
      ADMIN, ASSIGNMENT_ID, "CANCELLED", "No longer needed"
    );
  });

  it("returns { ok: false, error } when service throws", async () => {
    setAssignmentStatus.mockRejectedValue(new Error("Invalid status: BAD"));
    const result = await setStatusAction(ASSIGNMENT_ID, "BAD");
    expect(result).toEqual({ ok: false, error: "Invalid status: BAD" });
  });

  it("revalidates on success", async () => {
    await setStatusAction(ASSIGNMENT_ID, "COMPLETED");
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/assignments/${ASSIGNMENT_ID}`);
  });
});

// ─── setVisibilityAction ──────────────────────────────────────────────────────
describe("setVisibilityAction", () => {
  it("returns { ok: true } for ALL mode", async () => {
    const result = await setVisibilityAction(ASSIGNMENT_ID, "ALL", []);
    expect(result).toEqual({ ok: true });
  });

  it("passes mode and allowedIds to setAssignmentVisibility", async () => {
    await setVisibilityAction(ASSIGNMENT_ID, "RESTRICTED", [INTERP_ID]);
    expect(setAssignmentVisibility).toHaveBeenCalledWith(
      ADMIN, ASSIGNMENT_ID, "RESTRICTED", [INTERP_ID], undefined
    );
  });

  it("returns { ok: false, error } when service throws", async () => {
    setAssignmentVisibility.mockRejectedValue(
      new Error("Restricted visibility requires at least one interpreter")
    );
    const result = await setVisibilityAction(ASSIGNMENT_ID, "RESTRICTED", []);
    expect(result.ok).toBe(false);
    expect((result as any).error).toContain("Restricted");
  });
});

// ─── assignInterpreterAction ──────────────────────────────────────────────────
describe("assignInterpreterAction", () => {
  it("returns { ok: true } on success", async () => {
    const result = await assignInterpreterAction(ASSIGNMENT_ID, INTERP_ID);
    expect(result).toEqual({ ok: true });
  });

  it("delegates to assignInterpreterToJob", async () => {
    await assignInterpreterAction(ASSIGNMENT_ID, INTERP_ID, "Confirmed");
    expect(assignInterpreterToJob).toHaveBeenCalledWith(ADMIN, ASSIGNMENT_ID, INTERP_ID, "Confirmed");
  });

  it("returns { ok: false, error } on failure", async () => {
    assignInterpreterToJob.mockRejectedValue(new Error("Interpreter not eligible"));
    const result = await assignInterpreterAction(ASSIGNMENT_ID, INTERP_ID);
    expect(result).toEqual({ ok: false, error: "Interpreter not eligible" });
  });
});

// ─── removeInterpreterAction ──────────────────────────────────────────────────
describe("removeInterpreterAction", () => {
  it("returns { ok: true } on success", async () => {
    const result = await removeInterpreterAction(ASSIGNMENT_ID, INTERP_ID);
    expect(result).toEqual({ ok: true });
  });

  it("delegates to removeInterpreterFromJob", async () => {
    await removeInterpreterAction(ASSIGNMENT_ID, INTERP_ID, "Back-up needed");
    expect(removeInterpreterFromJob).toHaveBeenCalledWith(
      ADMIN, ASSIGNMENT_ID, INTERP_ID, "Back-up needed"
    );
  });

  it("revalidates on success", async () => {
    await removeInterpreterAction(ASSIGNMENT_ID, INTERP_ID);
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/assignments/${ASSIGNMENT_ID}`);
  });

  it("returns { ok: false, error } on failure", async () => {
    removeInterpreterFromJob.mockRejectedValue(new Error("Link not found"));
    const result = await removeInterpreterAction(ASSIGNMENT_ID, INTERP_ID);
    expect(result).toEqual({ ok: false, error: "Link not found" });
  });
});
