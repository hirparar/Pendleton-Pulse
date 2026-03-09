import { describe, it, expect, vi, beforeEach } from "vitest";

const { jsonMock, requireAdmin, assignInterpreterToJob, removeInterpreterFromJob } = vi.hoisted(() => ({
  jsonMock: vi.fn((data: unknown, init?: ResponseInit) => ({
    _body: data,
    _status: (init as any)?.status ?? 200,
  })),
  requireAdmin: vi.fn(),
  assignInterpreterToJob: vi.fn(),
  removeInterpreterFromJob: vi.fn(),
}));

vi.mock("next/server", () => ({ NextResponse: { json: jsonMock } }));
vi.mock("@/lib/authz", () => ({ requireAdmin }));
vi.mock("@/lib/assignments/service", () => ({
  assignInterpreterToJob,
  removeInterpreterFromJob,
  createAssignment: vi.fn(),
  listAssignmentsAdmin: vi.fn(),
  updateAssignmentDetails: vi.fn(),
  setAssignmentStatus: vi.fn(),
  setAssignmentVisibility: vi.fn(),
  requestAssignment: vi.fn(),
  withdrawFromAssignment: vi.fn(),
}));

import { POST, DELETE } from "@/app/api/admin/assignments/[id]/interpreters/route";

const ADMIN = { id: "admin-1", email: "a@a.com", clerkUserId: "c1", role: "ADMIN" };
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const INTERP_ID = "interp-1";

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue(ADMIN);
});

describe("POST /api/admin/assignments/[id]/interpreters", () => {
  it("returns 200 with link on success", async () => {
    const link = { assignmentId: "a1", userProfileId: INTERP_ID };
    assignInterpreterToJob.mockResolvedValue(link);
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ interpreterProfileId: INTERP_ID }),
    });
    const res = await POST(req, ctx("a1")) as any;
    expect(res._body).toEqual({ ok: true, data: link });
    expect(res._status).toBe(200);
  });

  it("returns 400 when interpreterProfileId is missing", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req, ctx("a1")) as any;
    expect(res._body).toEqual({ ok: false, error: "interpreterProfileId is required" });
    expect(res._status).toBe(400);
    expect(assignInterpreterToJob).not.toHaveBeenCalled();
  });

  it("returns 400 when service throws", async () => {
    assignInterpreterToJob.mockRejectedValue(new Error("Interpreter not eligible"));
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ interpreterProfileId: INTERP_ID }),
    });
    const res = await POST(req, ctx("a1")) as any;
    expect(res._body).toEqual({ ok: false, error: "Interpreter not eligible" });
    expect(res._status).toBe(400);
  });

  it("passes note from body to service", async () => {
    assignInterpreterToJob.mockResolvedValue({});
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ interpreterProfileId: INTERP_ID, note: "Admin assigned" }),
    });
    await POST(req, ctx("a1"));
    expect(assignInterpreterToJob).toHaveBeenCalledWith(ADMIN, "a1", INTERP_ID, "Admin assigned");
  });
});

describe("DELETE /api/admin/assignments/[id]/interpreters", () => {
  it("returns 200 with link on success", async () => {
    removeInterpreterFromJob.mockResolvedValue({ status: "REMOVED" });
    const req = new Request("http://localhost", {
      method: "DELETE",
      body: JSON.stringify({ interpreterProfileId: INTERP_ID }),
    });
    const res = await DELETE(req, ctx("a1")) as any;
    expect(res._body.ok).toBe(true);
    expect(res._status).toBe(200);
  });

  it("returns 400 when interpreterProfileId is missing", async () => {
    const req = new Request("http://localhost", {
      method: "DELETE",
      body: JSON.stringify({}),
    });
    const res = await DELETE(req, ctx("a1")) as any;
    expect(res._body.error).toBe("interpreterProfileId is required");
    expect(res._status).toBe(400);
  });

  it("returns 400 when service throws", async () => {
    removeInterpreterFromJob.mockRejectedValue(new Error("Link not found"));
    const req = new Request("http://localhost", {
      method: "DELETE",
      body: JSON.stringify({ interpreterProfileId: INTERP_ID }),
    });
    const res = await DELETE(req, ctx("a1")) as any;
    expect(res._body).toEqual({ ok: false, error: "Link not found" });
    expect(res._status).toBe(400);
  });
});
