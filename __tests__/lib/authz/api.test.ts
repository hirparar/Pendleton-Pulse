import { describe, it, expect, vi, beforeEach } from "vitest";

const { ensureUserProfile } = vi.hoisted(() => ({
  ensureUserProfile: vi.fn(),
}));

vi.mock("@/lib/ensure-profile", () => ({ ensureUserProfile }));

import {
  requireProfileApi,
  requireAdminApi,
  requireInterpreterApi,
  requireInterpreterEligibleApi,
} from "@/lib/authz/api";
import { AuthzError } from "@/lib/authz/errors";

const makeProfile = (overrides = {}) => ({
  id: "p-1",
  clerkUserId: "clerk-1",
  email: "user@example.com",
  role: "INTERPRETER",
  status: "APPROVED",
  isActive: true,
  ...overrides,
});

beforeEach(() => vi.clearAllMocks());

// ─── requireProfileApi ────────────────────────────────────────────────────────
describe("requireProfileApi", () => {
  it("returns profile when signed in", async () => {
    const profile = makeProfile();
    ensureUserProfile.mockResolvedValue(profile);
    await expect(requireProfileApi()).resolves.toEqual(profile);
  });

  it("throws AuthzError UNAUTHENTICATED when no profile (null)", async () => {
    ensureUserProfile.mockResolvedValue(null);
    await expect(requireProfileApi()).rejects.toThrow(AuthzError);
    await expect(requireProfileApi()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
});

// ─── requireAdminApi ──────────────────────────────────────────────────────────
describe("requireAdminApi", () => {
  it("returns profile when role is ADMIN", async () => {
    ensureUserProfile.mockResolvedValue(makeProfile({ role: "ADMIN" }));
    const result = await requireAdminApi();
    expect(result.role).toBe("ADMIN");
  });

  it("throws AuthzError FORBIDDEN when role is INTERPRETER", async () => {
    ensureUserProfile.mockResolvedValue(makeProfile({ role: "INTERPRETER" }));
    await expect(requireAdminApi()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws with status 403 for FORBIDDEN", async () => {
    ensureUserProfile.mockResolvedValue(makeProfile({ role: "INTERPRETER" }));
    try {
      await requireAdminApi();
    } catch (e: any) {
      expect(e.status).toBe(403);
    }
  });
});

// ─── requireInterpreterApi ────────────────────────────────────────────────────
describe("requireInterpreterApi", () => {
  it("returns profile for INTERPRETER role", async () => {
    ensureUserProfile.mockResolvedValue(makeProfile({ role: "INTERPRETER" }));
    const result = await requireInterpreterApi();
    expect(result.role).toBe("INTERPRETER");
  });

  it("throws FORBIDDEN for ADMIN role", async () => {
    ensureUserProfile.mockResolvedValue(makeProfile({ role: "ADMIN" }));
    await expect(requireInterpreterApi()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ─── requireInterpreterEligibleApi ───────────────────────────────────────────
describe("requireInterpreterEligibleApi", () => {
  it("returns profile when APPROVED + active", async () => {
    ensureUserProfile.mockResolvedValue(
      makeProfile({ role: "INTERPRETER", status: "APPROVED", isActive: true })
    );
    const result = await requireInterpreterEligibleApi();
    expect(result.status).toBe("APPROVED");
  });

  it("throws INACTIVE when isActive is false", async () => {
    ensureUserProfile.mockResolvedValue(
      makeProfile({ status: "APPROVED", isActive: false })
    );
    await expect(requireInterpreterEligibleApi()).rejects.toMatchObject({ code: "INACTIVE" });
  });

  it("throws PENDING when status is PENDING", async () => {
    ensureUserProfile.mockResolvedValue(makeProfile({ status: "PENDING" }));
    await expect(requireInterpreterEligibleApi()).rejects.toMatchObject({ code: "PENDING" });
  });

  it("throws DENIED when status is DENIED", async () => {
    ensureUserProfile.mockResolvedValue(makeProfile({ status: "DENIED" }));
    await expect(requireInterpreterEligibleApi()).rejects.toMatchObject({ code: "DENIED" });
  });

  it("throws UNKNOWN_STATUS for unrecognised status", async () => {
    ensureUserProfile.mockResolvedValue(makeProfile({ status: "SOMETHING_ELSE" }));
    await expect(requireInterpreterEligibleApi()).rejects.toMatchObject({
      code: "UNKNOWN_STATUS",
    });
  });

  it("has status 403 on all eligibility failures", async () => {
    ensureUserProfile.mockResolvedValue(makeProfile({ status: "DENIED" }));
    try {
      await requireInterpreterEligibleApi();
    } catch (e: any) {
      expect(e.status).toBe(403);
    }
  });
});
