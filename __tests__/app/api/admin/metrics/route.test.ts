import { describe, it, expect, vi, beforeEach } from "vitest";

const { jsonMock, requireAdmin, userProfile } = vi.hoisted(() => ({
  jsonMock: vi.fn((data: unknown, init?: ResponseInit) => ({
    _body: data,
    _status: (init as any)?.status ?? 200,
  })),
  requireAdmin: vi.fn(),
  userProfile: { count: vi.fn() },
}));

vi.mock("next/server", () => ({ NextResponse: { json: jsonMock } }));
vi.mock("@/lib/authz", () => ({ requireAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: { userProfile } }));

import { GET } from "@/app/api/admin/metrics/route";

const ADMIN = { id: "admin-1", email: "a@a.com", clerkUserId: "c1", role: "ADMIN" };

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue(ADMIN);
});

describe("GET /api/admin/metrics", () => {
  it("returns 200 with all four metric counts", async () => {
    userProfile.count
      .mockResolvedValueOnce(10) // totalInterpreters
      .mockResolvedValueOnce(7)  // activeInterpreters
      .mockResolvedValueOnce(3)  // inactiveInterpreters
      .mockResolvedValueOnce(2); // pendingApprovals

    const res = await GET() as any;
    expect(res._body).toEqual({
      totalInterpreters: 10,
      activeInterpreters: 7,
      inactiveInterpreters: 3,
      pendingApprovals: 2,
    });
    expect(res._status).toBe(200);
  });

  it("calls userProfile.count four times with correct where clauses", async () => {
    userProfile.count.mockResolvedValue(0);
    await GET();
    expect(userProfile.count).toHaveBeenCalledTimes(4);
    expect(userProfile.count).toHaveBeenCalledWith({ where: { role: "INTERPRETER" } });
    expect(userProfile.count).toHaveBeenCalledWith({ where: { role: "INTERPRETER", isActive: true } });
    expect(userProfile.count).toHaveBeenCalledWith({ where: { role: "INTERPRETER", isActive: false } });
    expect(userProfile.count).toHaveBeenCalledWith({ where: { role: "INTERPRETER", status: "PENDING" } });
  });

  it("returns 500 with error message when DB throws", async () => {
    userProfile.count.mockRejectedValue(new Error("DB error"));
    const res = await GET() as any;
    expect(res._body).toEqual({ error: "Metrics failed to load." });
    expect(res._status).toBe(500);
  });

  it("calls requireAdmin before fetching metrics", async () => {
    userProfile.count.mockResolvedValue(0);
    await GET();
    expect(requireAdmin).toHaveBeenCalledOnce();
  });

  it("propagates auth errors (requireAdmin throws before try-catch)", async () => {
    requireAdmin.mockRejectedValue(new Error("Unauthorized"));
    await expect(GET()).rejects.toThrow("Unauthorized");
  });
});
