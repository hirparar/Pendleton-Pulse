import { describe, it, expect, vi, beforeEach } from "vitest";

const { jsonMock, requireProfile, noStore } = vi.hoisted(() => ({
  jsonMock: vi.fn((data: unknown, init?: ResponseInit) => ({
    _body: data,
    _status: (init as any)?.status ?? 200,
  })),
  requireProfile: vi.fn(),
  noStore: vi.fn(),
}));

vi.mock("next/server", () => ({ NextResponse: { json: jsonMock } }));
vi.mock("@/lib/authz", () => ({ requireProfile }));
vi.mock("next/cache", () => ({ unstable_noStore: noStore }));

import { GET } from "@/app/api/auth/post-sign-in/route";

const makeProfile = (overrides = {}) => ({
  id: "p-1",
  role: "INTERPRETER",
  status: "APPROVED",
  isActive: true,
  ...overrides,
});

beforeEach(() => vi.clearAllMocks());

describe("GET /api/auth/post-sign-in", () => {
  it("redirects ADMIN to /admin", async () => {
    requireProfile.mockResolvedValue(makeProfile({ role: "ADMIN" }));
    const res = await GET() as any;
    expect(res._body.dest).toBe("/admin");
    expect(res._status).toBe(200);
  });

  it("redirects inactive interpreter to /interpreter/inactive", async () => {
    requireProfile.mockResolvedValue(makeProfile({ role: "INTERPRETER", isActive: false }));
    const res = await GET() as any;
    expect(res._body.dest).toBe("/interpreter/inactive");
  });

  it("redirects APPROVED active interpreter to /interpreter/dashboard", async () => {
    requireProfile.mockResolvedValue(makeProfile({ status: "APPROVED", isActive: true }));
    const res = await GET() as any;
    expect(res._body.dest).toBe("/interpreter/dashboard");
  });

  it("redirects PENDING interpreter to /interpreter/pending", async () => {
    requireProfile.mockResolvedValue(makeProfile({ status: "PENDING" }));
    const res = await GET() as any;
    expect(res._body.dest).toBe("/interpreter/pending");
  });

  it("redirects DENIED interpreter to /interpreter/denied", async () => {
    requireProfile.mockResolvedValue(makeProfile({ status: "DENIED" }));
    const res = await GET() as any;
    expect(res._body.dest).toBe("/interpreter/denied");
  });

  it("defaults to /interpreter/pending for unknown status", async () => {
    requireProfile.mockResolvedValue(makeProfile({ status: "UNKNOWN", isActive: true }));
    const res = await GET() as any;
    expect(res._body.dest).toBe("/interpreter/pending");
  });

  it("calls noStore to disable caching", async () => {
    requireProfile.mockResolvedValue(makeProfile());
    await GET();
    expect(noStore).toHaveBeenCalledOnce();
  });
});
