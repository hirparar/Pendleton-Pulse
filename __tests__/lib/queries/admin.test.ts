/**
 * Tests for lib/queries/admin.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { userProfile } = vi.hoisted(() => ({
  userProfile: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { userProfile },
}));

import { getAdminOverviewMetrics, listInterpreters, getInterpreterProfileById, listPendingApprovals } from "@/lib/queries/admin";

beforeEach(() => vi.clearAllMocks());

// ─── getAdminOverviewMetrics ──────────────────────────────────────────────────
describe("getAdminOverviewMetrics", () => {
  it("returns correct metric keys with values from db counts", async () => {
    userProfile.count
      .mockResolvedValueOnce(10) // totalInterpreters
      .mockResolvedValueOnce(7)  // activeInterpreters
      .mockResolvedValueOnce(3)  // inactiveInterpreters
      .mockResolvedValueOnce(2); // pendingApprovals

    const result = await getAdminOverviewMetrics();
    expect(result).toEqual({
      totalInterpreters: 10,
      activeInterpreters: 7,
      inactiveInterpreters: 3,
      pendingApprovals: 2,
    });
  });

  it("calls count 4 times with correct role filters", async () => {
    userProfile.count.mockResolvedValue(0);
    await getAdminOverviewMetrics();
    expect(userProfile.count).toHaveBeenCalledTimes(4);
    // All calls should scope to INTERPRETER role
    for (const call of userProfile.count.mock.calls) {
      expect(call[0].where.role).toBe("INTERPRETER");
    }
  });

  it("pendingApprovals filters by status PENDING", async () => {
    userProfile.count.mockResolvedValue(0);
    await getAdminOverviewMetrics();
    const pendingCall = userProfile.count.mock.calls.find(
      (c: [{ where: { status?: string } }]) => c[0]?.where?.status === "PENDING"
    );
    expect(pendingCall).toBeDefined();
  });
});

// ─── listInterpreters ─────────────────────────────────────────────────────────
describe("listInterpreters", () => {
  it("returns all interpreters when no filters", async () => {
    userProfile.findMany.mockResolvedValue([{ id: "i1" }, { id: "i2" }]);
    const result = await listInterpreters();
    expect(result).toHaveLength(2);
    const { where } = userProfile.findMany.mock.calls[0][0];
    expect(where.role).toBe("INTERPRETER");
  });

  it("filters by status when provided", async () => {
    userProfile.findMany.mockResolvedValue([]);
    await listInterpreters({ status: "PENDING" });
    const { where } = userProfile.findMany.mock.calls[0][0];
    expect(where.status).toBe("PENDING");
  });

  it("does not include status in where when not provided", async () => {
    userProfile.findMany.mockResolvedValue([]);
    await listInterpreters({});
    const { where } = userProfile.findMany.mock.calls[0][0];
    expect(where).not.toHaveProperty("status");
  });

  it("filters by isActive=true when active='true'", async () => {
    userProfile.findMany.mockResolvedValue([]);
    await listInterpreters({ active: "true" });
    const { where } = userProfile.findMany.mock.calls[0][0];
    expect(where.isActive).toBe(true);
  });

  it("filters by isActive=false when active='false'", async () => {
    userProfile.findMany.mockResolvedValue([]);
    await listInterpreters({ active: "false" });
    const { where } = userProfile.findMany.mock.calls[0][0];
    expect(where.isActive).toBe(false);
  });

  it("includes search query in OR clause when q is provided", async () => {
    userProfile.findMany.mockResolvedValue([]);
    await listInterpreters({ q: "alice" });
    const { where } = userProfile.findMany.mock.calls[0][0];
    expect(where.OR).toBeDefined();
    expect(where.OR.length).toBeGreaterThan(0);
  });
});

// ─── getInterpreterProfileById ──────────────────────────────────────────────────────────
describe("getInterpreterProfileById", () => {
  it("returns profile with interpreterProfile and auditEvents included", async () => {
    const expected = {
      id: "u1",
      interpreterProfile: { id: "ip1" },
      auditEvents: [{ id: "ae1" }],
    };
    userProfile.findUnique.mockResolvedValue(expected);
    const result = await getInterpreterProfileById("u1");
    expect(result).toEqual(expected);
  });

  it("queries by id", async () => {
    userProfile.findUnique.mockResolvedValue(null);
    await getInterpreterProfileById("u-abc");
    expect(userProfile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u-abc" } })
    );
  });

  it("includes interpreterProfile and auditEvents", async () => {
    userProfile.findUnique.mockResolvedValue(null);
    await getInterpreterProfileById("u1");
    const { include } = userProfile.findUnique.mock.calls[0][0];
    expect(include).toHaveProperty("interpreterProfile", true);
    expect(include).toHaveProperty("auditEvents");
  });

  it("returns null when not found", async () => {
    userProfile.findUnique.mockResolvedValue(null);
    const result = await getInterpreterProfileById("missing");
    expect(result).toBeNull();
  });
});

// ─── listPendingApprovals ──────────────────────────────────────────────────────────────
describe("listPendingApprovals", () => {
  it("returns list of pending interpreters", async () => {
    const expected = [{ id: "u1", status: "PENDING" }, { id: "u2", status: "PENDING" }];
    userProfile.findMany.mockResolvedValue(expected);
    const result = await listPendingApprovals();
    expect(result).toEqual(expected);
  });

  it("filters by role=INTERPRETER and status=PENDING", async () => {
    userProfile.findMany.mockResolvedValue([]);
    await listPendingApprovals();
    const { where } = userProfile.findMany.mock.calls[0][0];
    expect(where.role).toBe("INTERPRETER");
    expect(where.status).toBe("PENDING");
  });

  it("returns empty array when no pending interpreters", async () => {
    userProfile.findMany.mockResolvedValue([]);
    const result = await listPendingApprovals();
    expect(result).toEqual([]);
  });
});
