/**
 * Tests for app/interpreter/(app)/profile/actions.ts
 * Actions: saveBasicInfoAction, saveCredentialsAction, savePreferencesAction
 * Each validates with Zod and returns { ok: true, message } or { ok: false, errors, message }.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  requireInterpreterEligible,
  revalidatePath,
  interpreterProfile,
} = vi.hoisted(() => ({
  requireInterpreterEligible: vi.fn(),
  revalidatePath: vi.fn(),
  interpreterProfile: { upsert: vi.fn() },
}));

vi.mock("@/lib/authz", () => ({ requireInterpreterEligible }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/prisma", () => ({
  prisma: { interpreterProfile },
}));

import {
  saveBasicInfoAction,
  saveCredentialsAction,
  savePreferencesAction,
} from "@/app/interpreter/(app)/profile/actions";

const PROFILE = { id: "interp-1", role: "INTERPRETER", status: "APPROVED" };

beforeEach(() => {
  vi.clearAllMocks();
  requireInterpreterEligible.mockResolvedValue(PROFILE);
  interpreterProfile.upsert.mockResolvedValue({});
});

// ─── saveBasicInfoAction ──────────────────────────────────────────────────────
const validBasic = {
  displayName: "Alice Nguyen",
  phone: "555-123-4567",
  location: "Portland, OR",
  bio: "Professional interpreter with extensive experience in medical and legal settings.",
  experienceYears: 10,
  timezone: "America/Los_Angeles" as const,
};

describe("saveBasicInfoAction", () => {
  it("returns { ok: true } with a message on success", async () => {
    const result = await saveBasicInfoAction(validBasic);
    expect(result.ok).toBe(true);
    expect((result as any).message).toBeTruthy();
  });

  it("calls interpreterProfile.upsert with the interpreter's own id", async () => {
    await saveBasicInfoAction(validBasic);
    const [args] = interpreterProfile.upsert.mock.calls[0];
    expect(args.where.userProfileId).toBe("interp-1");
  });

  it("includes validated data in upsert update payload", async () => {
    await saveBasicInfoAction(validBasic);
    const [{ update }] = interpreterProfile.upsert.mock.calls[0];
    expect(update.displayName).toBe("Alice Nguyen");
    expect(update.experienceYears).toBe(10);
    expect(update.timezone).toBe("America/Los_Angeles");
  });

  it("revalidates /interpreter/profile and /interpreter/dashboard", async () => {
    await saveBasicInfoAction(validBasic);
    expect(revalidatePath).toHaveBeenCalledWith("/interpreter/profile");
    expect(revalidatePath).toHaveBeenCalledWith("/interpreter/dashboard");
  });

  it("returns { ok: false, errors } when displayName is too short", async () => {
    const result = await saveBasicInfoAction({ ...validBasic, displayName: "A" });
    expect(result.ok).toBe(false);
    expect((result as any).errors?.displayName).toBeTruthy();
    expect(interpreterProfile.upsert).not.toHaveBeenCalled();
  });

  it("returns { ok: false, errors } when bio is too short", async () => {
    const result = await saveBasicInfoAction({ ...validBasic, bio: "Too short" });
    expect(result.ok).toBe(false);
    expect((result as any).errors?.bio).toBeTruthy();
  });

  it("returns { ok: false, errors } for an invalid timezone", async () => {
    const result = await saveBasicInfoAction({
      ...validBasic,
      timezone: "Invalid/Timezone" as any,
    });
    expect(result.ok).toBe(false);
    expect((result as any).errors?.timezone).toBeTruthy();
  });

  it("returns { ok: false, errors } when experienceYears exceeds 60", async () => {
    const result = await saveBasicInfoAction({ ...validBasic, experienceYears: 61 });
    expect(result.ok).toBe(false);
    expect((result as any).errors?.experienceYears).toBeTruthy();
  });

  it("trims whitespace from displayName before saving", async () => {
    await saveBasicInfoAction({ ...validBasic, displayName: "  Alice Ng  " });
    const [{ update }] = interpreterProfile.upsert.mock.calls[0];
    expect(update.displayName).toBe("Alice Ng");
  });

  it("create payload mirrors update payload + userProfileId", async () => {
    await saveBasicInfoAction(validBasic);
    const [{ update, create }] = interpreterProfile.upsert.mock.calls[0];
    const { userProfileId, ...createRest } = create;
    expect(userProfileId).toBe("interp-1");
    expect(createRest).toEqual(update);
  });

  it("throws when auth fails", async () => {
    requireInterpreterEligible.mockRejectedValue(new Error("Not eligible"));
    await expect(saveBasicInfoAction(validBasic)).rejects.toThrow("Not eligible");
  });
});

// ─── saveCredentialsAction ────────────────────────────────────────────────────
const validCredentials = {
  languages: ["Spanish", "English"],
  certifications: ["ATA Certified"],
};

describe("saveCredentialsAction", () => {
  it("returns { ok: true } with a message on success", async () => {
    const result = await saveCredentialsAction(validCredentials);
    expect(result.ok).toBe(true);
    expect((result as any).message).toBeTruthy();
  });

  it("calls interpreterProfile.upsert with languages and certifications", async () => {
    await saveCredentialsAction(validCredentials);
    const [{ update }] = interpreterProfile.upsert.mock.calls[0];
    expect(update.languages).toEqual(["Spanish", "English"]);
    expect(update.certifications).toEqual(["ATA Certified"]);
  });

  it("revalidates profile and dashboard paths", async () => {
    await saveCredentialsAction(validCredentials);
    expect(revalidatePath).toHaveBeenCalledWith("/interpreter/profile");
    expect(revalidatePath).toHaveBeenCalledWith("/interpreter/dashboard");
  });

  it("returns { ok: false } when a language string is too short (< 2 chars)", async () => {
    const result = await saveCredentialsAction({ ...validCredentials, languages: ["X"] });
    expect(result.ok).toBe(false);
    expect((result as any).errors?.languages).toBeTruthy();
    expect(interpreterProfile.upsert).not.toHaveBeenCalled();
  });

  it("returns { ok: false } when a certification contains invalid characters", async () => {
    const result = await saveCredentialsAction({
      ...validCredentials,
      certifications: ["Bad@Cert!"],
    });
    expect(result.ok).toBe(false);
    expect((result as any).errors?.certifications).toBeTruthy();
  });

  it("deduplicates duplicate entries in languages", async () => {
    await saveCredentialsAction({
      languages: ["Spanish", "Spanish", "English"],
      certifications: ["ATA Certified"],
    });
    const [{ update }] = interpreterProfile.upsert.mock.calls[0];
    expect(update.languages).toEqual(["Spanish", "English"]);
  });

  it("throws when auth fails", async () => {
    requireInterpreterEligible.mockRejectedValue(new Error("Not eligible"));
    await expect(saveCredentialsAction(validCredentials)).rejects.toThrow("Not eligible");
  });
});

// ─── savePreferencesAction ────────────────────────────────────────────────────
const validPreferences = {
  preferredModes: ["IN_PERSON" as const],
};

describe("savePreferencesAction", () => {
  it("returns { ok: true } on success", async () => {
    const result = await savePreferencesAction(validPreferences);
    expect(result.ok).toBe(true);
  });

  it("calls interpreterProfile.upsert with preferredModes", async () => {
    await savePreferencesAction(validPreferences);
    const [{ update }] = interpreterProfile.upsert.mock.calls[0];
    expect(update.preferredModes).toEqual(["IN_PERSON"]);
  });

  it("revalidates profile and dashboard paths", async () => {
    await savePreferencesAction(validPreferences);
    expect(revalidatePath).toHaveBeenCalledWith("/interpreter/profile");
    expect(revalidatePath).toHaveBeenCalledWith("/interpreter/dashboard");
  });

  it("returns { ok: false } for an invalid preferredMode value", async () => {
    const result = await savePreferencesAction({ preferredModes: ["BAD_MODE"] as any });
    expect(result.ok).toBe(false);
    expect((result as any).errors?.preferredModes).toBeTruthy();
    expect(interpreterProfile.upsert).not.toHaveBeenCalled();
  });

  it("accepts all valid mode values at once", async () => {
    const result = await savePreferencesAction({
      preferredModes: ["IN_PERSON", "REMOTE"] as any,
    });
    expect(result.ok).toBe(true);
  });

  it("throws when auth fails", async () => {
    requireInterpreterEligible.mockRejectedValue(new Error("Not eligible"));
    await expect(savePreferencesAction(validPreferences)).rejects.toThrow("Not eligible");
  });
});
