import { describe, it, expect, vi, beforeEach } from "vitest";

const { jsonMock, requireInterpreterEligible, getAssignmentForInterpreter } = vi.hoisted(() => ({
  jsonMock: vi.fn((data: unknown, init?: ResponseInit) => ({
    _body: data,
    _status: (init as any)?.status ?? 200,
  })),
  requireInterpreterEligible: vi.fn(),
  getAssignmentForInterpreter: vi.fn(),
}));

vi.mock("next/server", () => ({ NextResponse: { json: jsonMock } }));
vi.mock("@/lib/authz", () => ({ requireInterpreterEligible }));
vi.mock("@/lib/assignments/interpreter", () => ({ getAssignmentForInterpreter }));

import { GET } from "@/app/api/interpreter/assignments/[id]/route";

const PROFILE = { id: "interp-1", role: "INTERPRETER", status: "APPROVED" };
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  requireInterpreterEligible.mockResolvedValue(PROFILE);
});

describe("GET /api/interpreter/assignments/[id]", () => {
  it("returns 200 with data when assignment is found and visible", async () => {
    const data = { id: "a1", title: "Medical Interpretation" };
    getAssignmentForInterpreter.mockResolvedValue(data);
    const res = await GET(new Request("http://localhost"), ctx("a1")) as any;
    expect(res._body).toEqual({ ok: true, data });
    expect(res._status).toBe(200);
  });

  it("returns 404 when assignment not found or not visible", async () => {
    getAssignmentForInterpreter.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), ctx("missing")) as any;
    expect(res._body).toEqual({ ok: false, error: "Not found" });
    expect(res._status).toBe(404);
  });

  it("queries with interpreter's own profile id", async () => {
    getAssignmentForInterpreter.mockResolvedValue({ id: "a1" });
    await GET(new Request("http://localhost"), ctx("a1"));
    expect(getAssignmentForInterpreter).toHaveBeenCalledWith("interp-1", "a1");
  });

  it("throws when auth fails", async () => {
    requireInterpreterEligible.mockRejectedValue(new Error("INACTIVE"));
    await expect(GET(new Request("http://localhost"), ctx("a1"))).rejects.toThrow("INACTIVE");
  });
});
