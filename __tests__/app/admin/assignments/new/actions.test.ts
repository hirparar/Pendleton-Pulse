import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAdmin, revalidatePath, createAssignment } = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  createAssignment: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({ requireAdmin }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/assignments/service", () => ({
  createAssignment,
  updateAssignmentDetails: vi.fn(),
  setAssignmentStatus: vi.fn(),
  setAssignmentVisibility: vi.fn(),
  assignInterpreterToJob: vi.fn(),
  removeInterpreterFromJob: vi.fn(),
  requestAssignment: vi.fn(),
  withdrawFromAssignment: vi.fn(),
  listAssignmentsAdmin: vi.fn(),
  getAssignmentAdmin: vi.fn(),
}));

import { createAssignmentAction } from "@/app/admin/assignments/new/actions";

const ADMIN = { id: "admin-1", email: "admin@example.com", clerkUserId: "clerk-1", role: "ADMIN" };

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue(ADMIN);
});

describe("createAssignmentAction", () => {
  const body = {
    clientName: "Acme Corp",
    languagePair: "EN-ES",
    assignmentType: "Medical",
    location: "Room 1",
    scheduledStart: "2026-06-15T09:00:00Z",
    scheduledEnd: "2026-06-15T11:00:00Z",
    interpretersNeeded: 1,
  };

  it("returns { ok: true, id } on success", async () => {
    createAssignment.mockResolvedValue({ id: "assign-1" });
    const result = await createAssignmentAction(body);
    expect(result).toEqual({ ok: true, id: "assign-1" });
  });

  it("calls requireAdmin", async () => {
    createAssignment.mockResolvedValue({ id: "x" });
    await createAssignmentAction(body);
    expect(requireAdmin).toHaveBeenCalledOnce();
  });

  it("calls createAssignment with admin and body", async () => {
    createAssignment.mockResolvedValue({ id: "x" });
    await createAssignmentAction(body);
    expect(createAssignment).toHaveBeenCalledWith(ADMIN, body);
  });

  it("revalidates /admin/assignments on success", async () => {
    createAssignment.mockResolvedValue({ id: "x" });
    await createAssignmentAction(body);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/assignments");
  });

  it("propagates errors from createAssignment (no try-catch)", async () => {
    createAssignment.mockRejectedValue(new Error("End time must be after start time"));
    await expect(createAssignmentAction(body)).rejects.toThrow("End time must be after start time");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
