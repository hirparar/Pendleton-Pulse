/**
 * Tests for app/api/interpreter/assignments/route.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { jsonMock, requireInterpreterEligible, listAssignmentsForInterpreter } = vi.hoisted(() => ({
  jsonMock: vi.fn((data: unknown, init?: ResponseInit) => ({
    _body: data,
    _status: (init as any)?.status ?? 200,
  })),
  requireInterpreterEligible: vi.fn(),
  listAssignmentsForInterpreter: vi.fn(),
}));

vi.mock("next/server", () => ({ NextResponse: { json: jsonMock } }));
vi.mock("@/lib/authz", () => ({ requireInterpreterEligible }));
vi.mock("@/lib/assignments/interpreter", () => ({ listAssignmentsForInterpreter }));

import { GET } from "@/app/api/interpreter/assignments/route";

const PROFILE = { id: "interp-1", role: "INTERPRETER", status: "APPROVED" };

beforeEach(() => {
  vi.clearAllMocks();
  requireInterpreterEligible.mockResolvedValue(PROFILE);
});

describe("GET /api/interpreter/assignments", () => {
  const makeReq = (params = "") =>
    new Request(`http://localhost/api/interpreter/assignments${params ? "?" + params : ""}`);

  it("returns 200 with data and nextCursor", async () => {
    listAssignmentsForInterpreter.mockResolvedValue({ data: [{ id: "a1" }], nextCursor: null });
    const res = await GET(makeReq()) as any;
    expect(res._body.ok).toBe(true);
    expect(res._body.data).toEqual([{ id: "a1" }]);
    expect(res._body.nextCursor).toBeNull();
  });

  it("passes status filter when provided", async () => {
    listAssignmentsForInterpreter.mockResolvedValue({ data: [], nextCursor: null });
    await GET(makeReq("status=ASSIGNED&status=OPEN"));
    const [, filters] = listAssignmentsForInterpreter.mock.calls[0];
    expect(filters.status).toEqual(["ASSIGNED", "OPEN"]);
  });

  it("ignores invalid status values", async () => {
    listAssignmentsForInterpreter.mockResolvedValue({ data: [], nextCursor: null });
    await GET(makeReq("status=INVALID&status=OPEN"));
    const [, filters] = listAssignmentsForInterpreter.mock.calls[0];
    expect(filters.status).toEqual(["OPEN"]);
  });

  it("passes no status filter when all values are invalid", async () => {
    listAssignmentsForInterpreter.mockResolvedValue({ data: [], nextCursor: null });
    await GET(makeReq("status=BAD"));
    const [, filters] = listAssignmentsForInterpreter.mock.calls[0];
    expect(filters.status).toBeUndefined();
  });

  it("parses from and to date params", async () => {
    listAssignmentsForInterpreter.mockResolvedValue({ data: [], nextCursor: null });
    await GET(makeReq("from=2026-06-01&to=2026-06-30"));
    const [, filters] = listAssignmentsForInterpreter.mock.calls[0];
    expect(filters.from).toBeInstanceOf(Date);
    expect(filters.to).toBeInstanceOf(Date);
  });

  it("ignores invalid date params (returns undefined)", async () => {
    listAssignmentsForInterpreter.mockResolvedValue({ data: [], nextCursor: null });
    await GET(makeReq("from=not-a-date"));
    const [, filters] = listAssignmentsForInterpreter.mock.calls[0];
    expect(filters.from).toBeUndefined();
  });

  it("passes cursor when provided", async () => {
    listAssignmentsForInterpreter.mockResolvedValue({ data: [], nextCursor: null });
    await GET(makeReq("cursor=abc-123"));
    const [, filters] = listAssignmentsForInterpreter.mock.calls[0];
    expect(filters.cursor).toBe("abc-123");
  });

  it("sets cursor to null when empty", async () => {
    listAssignmentsForInterpreter.mockResolvedValue({ data: [], nextCursor: null });
    await GET(makeReq("cursor="));
    const [, filters] = listAssignmentsForInterpreter.mock.calls[0];
    expect(filters.cursor).toBeNull();
  });

  it("clamps take between 1 and 100", async () => {
    listAssignmentsForInterpreter.mockResolvedValue({ data: [], nextCursor: null });
    await GET(makeReq("take=999"));
    const [, filters] = listAssignmentsForInterpreter.mock.calls[0];
    expect(filters.take).toBe(100);
  });

  it("uses the interpreter's profile id", async () => {
    listAssignmentsForInterpreter.mockResolvedValue({ data: [], nextCursor: null });
    await GET(makeReq());
    const [profileId] = listAssignmentsForInterpreter.mock.calls[0];
    expect(profileId).toBe("interp-1");
  });
});
