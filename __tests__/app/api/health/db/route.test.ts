/**
 * Tests for app/api/health/db/route.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { jsonMock, userProfile } = vi.hoisted(() => ({
  jsonMock: vi.fn((data: unknown, init?: ResponseInit) => ({
    _body: data,
    _status: (init as any)?.status ?? 200,
  })),
  userProfile: { count: vi.fn() },
}));

vi.mock("next/server", () => ({ NextResponse: { json: jsonMock } }));
vi.mock("@/lib/prisma", () => ({ prisma: { userProfile } }));

import { GET } from "@/app/api/health/db/route";

beforeEach(() => vi.clearAllMocks());

describe("GET /api/health/db", () => {
  it("returns 200 with userProfiles count when DB is healthy", async () => {
    userProfile.count.mockResolvedValue(42);
    const res = await GET() as any;
    expect(res._body).toEqual({ ok: true, userProfiles: 42 });
    expect(res._status).toBe(200);
  });

  it("calls userProfile.count with no filters (counts all)", async () => {
    userProfile.count.mockResolvedValue(0);
    await GET();
    expect(userProfile.count).toHaveBeenCalledWith();
  });
});
