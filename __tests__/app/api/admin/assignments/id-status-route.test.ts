import { describe, it, expect, vi, beforeEach } from "vitest";

const { jsonMock, requireAdmin, setAssignmentStatus } = vi.hoisted(() => ({
  jsonMock: vi.fn((data: unknown, init?: ResponseInit) => ({
    _body: data,
    _status: (init as any)?.status ?? 200,
  })),
  requireAdmin: vi.fn(),
  setAssignmentStatus: vi.fn(),
}));

vi.mock("next/server", () => ({ NextResponse: { json: jsonMock } }));
vi.mock("@/lib/authz", () => ({ requireAdmin }));
vi.mock("@/lib/assignments/service", () => ({
  setAssignmentStatus,
  createAssignment: vi.fn(),
  listAssignmentsAdmin: vi.fn(),
  updateAssignmentDetails: vi.fn(),
  setAssignmentVisibility: vi.fn(),
  assignInterpreterToJob: vi.fn(),
  removeInterpreterFromJob: vi.fn(),
  requestAssignment: vi.fn(),
  withdrawFromAssignment: vi.fn(),
}));

import { POST } from "@/app/api/admin/assignments/[id]/status/route";

const ADMIN = { id: "admin-1", email: "a@a.com", clerkUserId: "c1", role: "ADMIN" };
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue(ADMIN);
});

describe("POST /api/admin/assignments/[id]/status", () => {
  it("returns 200 with updated data on success", async () => {
    setAssignmentStatus.mockResolvedValue({ id: "a1", status: "COMPLETED" });
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    const res = await POST(req, ctx("a1")) as any;
    expect(res._body.ok).toBe(true);
    expect(res._body.data.status).toBe("COMPLETED");
    expect(res._status).toBe(200);
  });

  it("passes status and note to service", async () => {
    setAssignmentStatus.mockResolvedValue({});
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ status: "CANCELLED", note: "Client cancelled" }),
    });
    await POST(req, ctx("a1"));
    expect(setAssignmentStatus).toHaveBeenCalledWith(
      ADMIN, "a1", "CANCELLED", "Client cancelled"
    );
  });

  it("returns 400 on invalid status", async () => {
    setAssignmentStatus.mockRejectedValue(new Error("Invalid status: BAD"));
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ status: "BAD" }),
    });
    const res = await POST(req, ctx("a1")) as any;
    expect(res._body.error).toBe("Invalid status: BAD");
    expect(res._status).toBe(400);
  });

  it("returns generic error for non-Error throws", async () => {
    setAssignmentStatus.mockRejectedValue(null);
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    const res = await POST(req, ctx("a1")) as any;
    expect(res._body.error).toBe("Failed");
    expect(res._status).toBe(400);
  });
});
