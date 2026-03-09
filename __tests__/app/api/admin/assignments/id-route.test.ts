import { describe, it, expect, vi, beforeEach } from "vitest";

const { jsonMock, requireAdmin, getAssignmentAdmin, updateAssignmentDetails } = vi.hoisted(() => ({
  jsonMock: vi.fn((data: unknown, init?: ResponseInit) => ({
    _body: data,
    _status: (init as any)?.status ?? 200,
  })),
  requireAdmin: vi.fn(),
  getAssignmentAdmin: vi.fn(),
  updateAssignmentDetails: vi.fn(),
}));

vi.mock("next/server", () => ({ NextResponse: { json: jsonMock } }));
vi.mock("@/lib/authz", () => ({ requireAdmin }));
vi.mock("@/lib/assignments/service", () => ({
  getAssignmentAdmin,
  updateAssignmentDetails,
  createAssignment: vi.fn(),
  listAssignmentsAdmin: vi.fn(),
  setAssignmentStatus: vi.fn(),
  setAssignmentVisibility: vi.fn(),
  assignInterpreterToJob: vi.fn(),
  removeInterpreterFromJob: vi.fn(),
  requestAssignment: vi.fn(),
  withdrawFromAssignment: vi.fn(),
}));

import { GET, PATCH } from "@/app/api/admin/assignments/[id]/route";

const ADMIN = { id: "admin-1", email: "admin@example.com", clerkUserId: "c1", role: "ADMIN" };
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue(ADMIN);
});

describe("GET /api/admin/assignments/[id]", () => {
  it("returns 200 with data when found", async () => {
    const data = { id: "a1", title: "Test" };
    getAssignmentAdmin.mockResolvedValue(data);
    const res = await GET(new Request("http://localhost"), ctx("a1")) as any;
    expect(res._body).toEqual({ ok: true, data });
    expect(res._status).toBe(200);
  });

  it("returns 404 when assignment not found", async () => {
    getAssignmentAdmin.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), ctx("missing")) as any;
    expect(res._body).toEqual({ ok: false, error: "Not found" });
    expect(res._status).toBe(404);
  });

  it("calls requireAdmin", async () => {
    getAssignmentAdmin.mockResolvedValue({ id: "a1" });
    await GET(new Request("http://localhost"), ctx("a1"));
    expect(requireAdmin).toHaveBeenCalledOnce();
  });
});

describe("PATCH /api/admin/assignments/[id]", () => {
  it("returns 200 with updated data on success", async () => {
    updateAssignmentDetails.mockResolvedValue({ id: "a1", clientName: "Updated" });
    const req = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ clientName: "Updated" }),
    });
    const res = await PATCH(req, ctx("a1")) as any;
    expect(res._body.ok).toBe(true);
    expect(res._body.data.clientName).toBe("Updated");
    expect(res._status).toBe(200);
  });

  it("returns 400 on service error", async () => {
    updateAssignmentDetails.mockRejectedValue(new Error("Client name is required"));
    const req = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({}),
    });
    const res = await PATCH(req, ctx("a1")) as any;
    expect(res._body).toEqual({ ok: false, error: "Client name is required" });
    expect(res._status).toBe(400);
  });

  it("returns generic error message for non-Error throws", async () => {
    updateAssignmentDetails.mockRejectedValue("bad");
    const req = new Request("http://localhost", { method: "PATCH", body: JSON.stringify({}) });
    const res = await PATCH(req, ctx("a1")) as any;
    expect(res._body.error).toBe("Failed");
    expect(res._status).toBe(400);
  });
});
