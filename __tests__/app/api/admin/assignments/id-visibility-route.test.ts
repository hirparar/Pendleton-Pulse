import { describe, it, expect, vi, beforeEach } from "vitest";

const { jsonMock, requireAdmin, setAssignmentVisibility } = vi.hoisted(() => ({
  jsonMock: vi.fn((data: unknown, init?: ResponseInit) => ({
    _body: data,
    _status: (init as any)?.status ?? 200,
  })),
  requireAdmin: vi.fn(),
  setAssignmentVisibility: vi.fn(),
}));

vi.mock("next/server", () => ({ NextResponse: { json: jsonMock } }));
vi.mock("@/lib/authz", () => ({ requireAdmin }));
vi.mock("@/lib/assignments/service", () => ({
  setAssignmentVisibility,
  createAssignment: vi.fn(),
  listAssignmentsAdmin: vi.fn(),
  updateAssignmentDetails: vi.fn(),
  setAssignmentStatus: vi.fn(),
  assignInterpreterToJob: vi.fn(),
  removeInterpreterFromJob: vi.fn(),
  requestAssignment: vi.fn(),
  withdrawFromAssignment: vi.fn(),
}));

import { POST } from "@/app/api/admin/assignments/[id]/visibility/route";

const ADMIN = { id: "admin-1", email: "a@a.com", clerkUserId: "c1", role: "ADMIN" };
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue(ADMIN);
  setAssignmentVisibility.mockResolvedValue({});
});

describe("POST /api/admin/assignments/[id]/visibility", () => {
  it("returns 200 on success with mode=ALL", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ mode: "ALL", allowedIds: [] }),
    });
    const res = await POST(req, ctx("a1")) as any;
    expect(res._body).toEqual({ ok: true });
    expect(res._status).toBe(200);
  });

  it("returns 200 on success with mode=RESTRICTED", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ mode: "RESTRICTED", allowedIds: ["i1", "i2"] }),
    });
    const res = await POST(req, ctx("a1")) as any;
    expect(res._body).toEqual({ ok: true });
  });

  it("returns 400 for invalid mode", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ mode: "INVALID" }),
    });
    const res = await POST(req, ctx("a1")) as any;
    expect(res._body).toEqual({ ok: false, error: "Invalid mode" });
    expect(res._status).toBe(400);
    expect(setAssignmentVisibility).not.toHaveBeenCalled();
  });

  it("returns 400 when service throws", async () => {
    setAssignmentVisibility.mockRejectedValue(
      new Error("Restricted visibility requires at least one interpreter")
    );
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ mode: "RESTRICTED", allowedIds: [] }),
    });
    const res = await POST(req, ctx("a1")) as any;
    expect(res._body.ok).toBe(false);
    expect(res._status).toBe(400);
  });

  it("passes allowedIds and note to service", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ mode: "RESTRICTED", allowedIds: ["i1"], note: "Selected" }),
    });
    await POST(req, ctx("a1"));
    expect(setAssignmentVisibility).toHaveBeenCalledWith(
      ADMIN, "a1", "RESTRICTED", ["i1"], "Selected"
    );
  });

  it("defaults allowedIds to [] when not provided", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ mode: "ALL" }),
    });
    await POST(req, ctx("a1"));
    expect(setAssignmentVisibility).toHaveBeenCalledWith(ADMIN, "a1", "ALL", [], undefined);
  });
});
