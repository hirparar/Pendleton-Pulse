/**
 * Tests for app/interpreter/(app)/jobs/actions.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  requireInterpreterEligible,
  revalidatePath,
  requestAssignment,
  withdrawFromAssignment,
} = vi.hoisted(() => ({
  requireInterpreterEligible: vi.fn(),
  revalidatePath: vi.fn(),
  requestAssignment: vi.fn(),
  withdrawFromAssignment: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({ requireInterpreterEligible }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/assignments/service", () => ({
  requestAssignment,
  withdrawFromAssignment,
  // stubs
  createAssignment: vi.fn(),
  updateAssignmentDetails: vi.fn(),
  setAssignmentStatus: vi.fn(),
  setAssignmentVisibility: vi.fn(),
  assignInterpreterToJob: vi.fn(),
  removeInterpreterFromJob: vi.fn(),
}));

import {
  requestAssignmentAction,
  withdrawFromAssignmentAction,
} from "@/app/interpreter/(app)/jobs/actions";

const PROFILE = { id: "interp-1", role: "INTERPRETER", status: "APPROVED" };
const ASSIGNMENT_ID = "assign-abc";

beforeEach(() => {
  vi.clearAllMocks();
  requireInterpreterEligible.mockResolvedValue(PROFILE);
  requestAssignment.mockResolvedValue({});
  withdrawFromAssignment.mockResolvedValue({});
});

// ─── requestAssignmentAction ──────────────────────────────────────────────────
describe("requestAssignmentAction", () => {
  it("returns { ok: true } on success", async () => {
    const result = await requestAssignmentAction(ASSIGNMENT_ID);
    expect(result).toEqual({ ok: true });
  });

  it("calls requestAssignment with interpreter id and assignment id", async () => {
    await requestAssignmentAction(ASSIGNMENT_ID);
    expect(requestAssignment).toHaveBeenCalledWith("interp-1", ASSIGNMENT_ID);
  });

  it("revalidates interpreter pages on success", async () => {
    await requestAssignmentAction(ASSIGNMENT_ID);
    expect(revalidatePath).toHaveBeenCalledWith("/interpreter/jobs");
    expect(revalidatePath).toHaveBeenCalledWith("/interpreter/dashboard");
  });

  it("returns { ok: false, error } when requestAssignment throws with Error", async () => {
    requestAssignment.mockRejectedValue(new Error("This assignment is already fully staffed"));
    const result = await requestAssignmentAction(ASSIGNMENT_ID);
    expect(result).toEqual({ ok: false, error: "This assignment is already fully staffed" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns { ok: false, error: 'Failed...' } for non-Error throws", async () => {
    requestAssignment.mockRejectedValue("unknown problem");
    const result = await requestAssignmentAction(ASSIGNMENT_ID);
    expect(result).toEqual({ ok: false, error: "Failed to request assignment" });
  });

  it("throws when auth fails (requireInterpreterEligible is outside try-catch)", async () => {
    requireInterpreterEligible.mockRejectedValue(new Error("Not eligible"));
    await expect(requestAssignmentAction(ASSIGNMENT_ID)).rejects.toThrow("Not eligible");
  });
});

// ─── withdrawFromAssignmentAction ─────────────────────────────────────────────
describe("withdrawFromAssignmentAction", () => {
  it("returns { ok: true } on success", async () => {
    const result = await withdrawFromAssignmentAction(ASSIGNMENT_ID);
    expect(result).toEqual({ ok: true });
  });

  it("calls withdrawFromAssignment with interpreter id and assignment id", async () => {
    await withdrawFromAssignmentAction(ASSIGNMENT_ID);
    expect(withdrawFromAssignment).toHaveBeenCalledWith("interp-1", ASSIGNMENT_ID);
  });

  it("revalidates interpreter pages on success", async () => {
    await withdrawFromAssignmentAction(ASSIGNMENT_ID);
    expect(revalidatePath).toHaveBeenCalledWith("/interpreter/jobs");
    expect(revalidatePath).toHaveBeenCalledWith("/interpreter/dashboard");
  });

  it("returns { ok: false, error } when withdrawFromAssignment throws", async () => {
    withdrawFromAssignment.mockRejectedValue(
      new Error("Cannot withdraw after the assignment has started. Contact an admin.")
    );
    const result = await withdrawFromAssignmentAction(ASSIGNMENT_ID);
    expect(result).toEqual({
      ok: false,
      error: "Cannot withdraw after the assignment has started. Contact an admin.",
    });
  });

  it("returns generic error message for non-Error throws", async () => {
    withdrawFromAssignment.mockRejectedValue(42);
    const result = await withdrawFromAssignmentAction(ASSIGNMENT_ID);
    expect(result).toEqual({ ok: false, error: "Failed to withdraw" });
  });

  it("does not revalidate when service throws", async () => {
    withdrawFromAssignment.mockRejectedValue(new Error("Already closed"));
    await withdrawFromAssignmentAction(ASSIGNMENT_ID);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
