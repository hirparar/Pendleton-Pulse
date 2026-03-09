/**
 * Tests for app/api/admin/assignments/route.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { jsonMock, requireAdmin, listAssignmentsAdmin, createAssignment } = vi.hoisted(() => ({
  jsonMock: vi.fn((data: unknown, init?: ResponseInit) => ({
    _body: data,
    _status: (init as any)?.status ?? 200,
  })),
  requireAdmin: vi.fn(),
  listAssignmentsAdmin: vi.fn(),
  createAssignment: vi.fn(),
}));

vi.mock("next/server", () => ({ NextResponse: { json: jsonMock } }));
vi.mock("@/lib/authz", () => ({ requireAdmin }));
vi.mock("@/lib/assignments/service", () => ({
  listAssignmentsAdmin,
  createAssignment,
  updateAssignmentDetails: vi.fn(),
  setAssignmentStatus: vi.fn(),
  setAssignmentVisibility: vi.fn(),
  assignInterpreterToJob: vi.fn(),
  removeInterpreterFromJob: vi.fn(),
  requestAssignment: vi.fn(),
  withdrawFromAssignment: vi.fn(),
}));

import { GET, POST } from "@/app/api/admin/assignments/route";

const ADMIN = { id: "admin-1", email: "admin@example.com", clerkUserId: "clerk-1", role: "ADMIN" };

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue(ADMIN);
});

describe("GET /api/admin/assignments", () => {
  it("returns 200 with assignment data", async () => {
    const mockData = [{ id: "a1" }];
    listAssignmentsAdmin.mockResolvedValue(mockData);

    const res = await GET() as any;

    expect(requireAdmin).toHaveBeenCalledOnce();
    expect(listAssignmentsAdmin).toHaveBeenCalledOnce();
    expect(res._body).toEqual({ ok: true, data: mockData });
    expect(res._status).toBe(200);
  });

  it("propagates auth errors (requireAdmin throws)", async () => {
    requireAdmin.mockRejectedValue(new Error("Unauthorized"));
    await expect(GET()).rejects.toThrow("Unauthorized");
  });
});

describe("POST /api/admin/assignments", () => {
  const validBody = {
    clientName: "Acme",
    languagePair: "EN-ES",
    assignmentType: "Medical",
    location: "Room 1",
    scheduledStart: "2026-06-15T09:00:00Z",
    scheduledEnd: "2026-06-15T11:00:00Z",
    interpretersNeeded: 1,
  };

  it("returns 201 with created assignment data on success", async () => {
    const created = { id: "new-1", ...validBody };
    createAssignment.mockResolvedValue(created);

    const req = new Request("http://localhost/api/admin/assignments", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req) as any;
    expect(res._body).toEqual({ ok: true, data: created });
    expect(res._status).toBe(201);
  });

  it("returns 400 when createAssignment throws a validation error", async () => {
    createAssignment.mockRejectedValue(new Error("Client name is required"));

    const req = new Request("http://localhost/api/admin/assignments", {
      method: "POST",
      body: JSON.stringify({ ...validBody, clientName: "" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req) as any;
    expect(res._body.ok).toBe(false);
    expect(res._body.error).toBe("Client name is required");
    expect(res._status).toBe(400);
  });

  it("returns 400 with generic message when non-Error is thrown", async () => {
    createAssignment.mockRejectedValue("some string error");

    const req = new Request("http://localhost/api/admin/assignments", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req) as any;
    expect(res._body.ok).toBe(false);
    expect(res._body.error).toBe("Failed");
    expect(res._status).toBe(400);
  });

  it("calls createAssignment with admin actor and parsed body", async () => {
    createAssignment.mockResolvedValue({ id: "new-1" });

    const req = new Request("http://localhost/api/admin/assignments", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "Content-Type": "application/json" },
    });

    await POST(req);
    expect(createAssignment).toHaveBeenCalledWith(ADMIN, validBody);
  });
});
