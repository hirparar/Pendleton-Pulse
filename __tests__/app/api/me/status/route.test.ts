/**
 * Tests for app/api/me/status/route.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { jsonMock, auth, userProfile } = vi.hoisted(() => ({
  jsonMock: vi.fn((data: unknown, init?: ResponseInit) => ({
    _body: data,
    _status: (init as any)?.status ?? 200,
  })),
  auth: vi.fn(),
  userProfile: { findUnique: vi.fn() },
}));

vi.mock("next/server", () => ({ NextResponse: { json: jsonMock } }));
vi.mock("@clerk/nextjs/server", () => ({ auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { userProfile } }));

import { GET } from "@/app/api/me/status/route";

beforeEach(() => vi.clearAllMocks());

describe("GET /api/me/status", () => {
  it("returns 401 when not authenticated", async () => {
    auth.mockResolvedValue({ userId: null });
    const res = await GET() as any;
    expect(res._body).toEqual({ ok: false });
    expect(res._status).toBe(401);
  });

  it("returns 404 when no profile found in DB", async () => {
    auth.mockResolvedValue({ userId: "clerk-123" });
    userProfile.findUnique.mockResolvedValue(null);
    const res = await GET() as any;
    expect(res._body).toEqual({ ok: false });
    expect(res._status).toBe(404);
  });

  it("returns 200 with role and status when profile found", async () => {
    auth.mockResolvedValue({ userId: "clerk-123" });
    userProfile.findUnique.mockResolvedValue({ role: "INTERPRETER", status: "APPROVED" });
    const res = await GET() as any;
    expect(res._body).toEqual({ ok: true, role: "INTERPRETER", status: "APPROVED" });
    expect(res._status).toBe(200);
  });

  it("queries userProfile by clerkUserId", async () => {
    auth.mockResolvedValue({ userId: "clerk-abc" });
    userProfile.findUnique.mockResolvedValue(null);
    await GET();
    expect(userProfile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clerkUserId: "clerk-abc" } })
    );
  });
});
