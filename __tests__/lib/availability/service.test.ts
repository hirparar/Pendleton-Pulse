/**
 * Tier 2 tests for lib/availability/service.ts
 * Prisma is fully mocked — no real DB connections.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Prisma mock ──────────────────────────────────────────────────────────────
const { availabilitySlot, availabilityTemplate } = vi.hoisted(() => ({
  availabilitySlot: {
    upsert: vi.fn(),
    findFirst: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  availabilityTemplate: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { availabilitySlot, availabilityTemplate },
}));

import {
  upsertSlot,
  deleteSlot,
  applyTemplate,
  clearDay,
  getSlotsInRange,
  saveTemplate,
  deleteTemplate,
} from "@/lib/availability/service";

const USER_ID = "user-123";
const TEMPLATE_ID = "tmpl-456";
const SLOT_ID = "slot-789";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── upsertSlot ───────────────────────────────────────────────────────────────
describe("upsertSlot", () => {
  const validInput = {
    date: "2026-06-15",
    startMin: 540,  // 9:00
    endMin: 1020,   // 17:00
    timezone: "America/New_York",
  };

  it("calls prisma.availabilitySlot.upsert with correct args", async () => {
    availabilitySlot.upsert.mockResolvedValue({ id: SLOT_ID });
    await upsertSlot(USER_ID, validInput);
    expect(availabilitySlot.upsert).toHaveBeenCalledOnce();
    const call = availabilitySlot.upsert.mock.calls[0][0];
    expect(call.where.userProfileId_date_startMin_endMin.userProfileId).toBe(USER_ID);
    expect(call.where.userProfileId_date_startMin_endMin.startMin).toBe(540);
    expect(call.where.userProfileId_date_startMin_endMin.endMin).toBe(1020);
    expect(call.create.timezone).toBe("America/New_York");
  });

  it("throws when endMin <= startMin", async () => {
    await expect(upsertSlot(USER_ID, { ...validInput, startMin: 600, endMin: 600 })).rejects.toThrow(
      "End time must be after start time"
    );
    await expect(upsertSlot(USER_ID, { ...validInput, startMin: 700, endMin: 600 })).rejects.toThrow(
      "End time must be after start time"
    );
    expect(availabilitySlot.upsert).not.toHaveBeenCalled();
  });

  it("throws when startMin is negative", async () => {
    await expect(upsertSlot(USER_ID, { ...validInput, startMin: -1, endMin: 60 })).rejects.toThrow(
      "Times must be within a single day"
    );
  });

  it("throws when endMin exceeds 1440", async () => {
    await expect(upsertSlot(USER_ID, { ...validInput, startMin: 0, endMin: 1441 })).rejects.toThrow(
      "Times must be within a single day"
    );
  });

  it("accepts boundary values (0 to 1440)", async () => {
    availabilitySlot.upsert.mockResolvedValue({ id: SLOT_ID });
    await expect(upsertSlot(USER_ID, { ...validInput, startMin: 0, endMin: 1440 })).resolves.not.toThrow();
  });

  it("passes optional note and templateId", async () => {
    availabilitySlot.upsert.mockResolvedValue({ id: SLOT_ID });
    await upsertSlot(USER_ID, { ...validInput, note: "Flu clinic", templateId: TEMPLATE_ID });
    const call = availabilitySlot.upsert.mock.calls[0][0];
    expect(call.update.note).toBe("Flu clinic");
    expect(call.update.templateId).toBe(TEMPLATE_ID);
  });

  it("defaults note and templateId to null when omitted", async () => {
    availabilitySlot.upsert.mockResolvedValue({ id: SLOT_ID });
    await upsertSlot(USER_ID, validInput);
    const call = availabilitySlot.upsert.mock.calls[0][0];
    expect(call.create.note).toBeNull();
    expect(call.create.templateId).toBeNull();
  });
});

// ─── deleteSlot ───────────────────────────────────────────────────────────────
describe("deleteSlot", () => {
  it("throws when slot not found for this user", async () => {
    availabilitySlot.findFirst.mockResolvedValue(null);
    await expect(deleteSlot(USER_ID, SLOT_ID)).rejects.toThrow("Slot not found");
    expect(availabilitySlot.delete).not.toHaveBeenCalled();
  });

  it("deletes slot when found", async () => {
    availabilitySlot.findFirst.mockResolvedValue({ id: SLOT_ID, userProfileId: USER_ID });
    availabilitySlot.delete.mockResolvedValue({ id: SLOT_ID });
    await deleteSlot(USER_ID, SLOT_ID);
    expect(availabilitySlot.delete).toHaveBeenCalledWith({ where: { id: SLOT_ID } });
  });

  it("scopes findFirst by both slotId and userProfileId", async () => {
    availabilitySlot.findFirst.mockResolvedValue(null);
    await expect(deleteSlot(USER_ID, SLOT_ID)).rejects.toThrow();
    expect(availabilitySlot.findFirst).toHaveBeenCalledWith({
      where: { id: SLOT_ID, userProfileId: USER_ID },
    });
  });
});

// ─── applyTemplate ────────────────────────────────────────────────────────────
describe("applyTemplate", () => {
  const monFriTemplate = {
    id: TEMPLATE_ID,
    userProfileId: USER_ID,
    // Monday=1, Friday=5, 9:00–17:00
    days: [
      { weekday: 1, startMin: 540, endMin: 1020 },
      { weekday: 5, startMin: 540, endMin: 1020 },
    ],
  };

  it("throws when template not found", async () => {
    availabilityTemplate.findFirst.mockResolvedValue(null);
    await expect(
      applyTemplate(USER_ID, TEMPLATE_ID, "2026-06-15", "2026-06-21", "UTC")
    ).rejects.toThrow("Template not found");
    expect(availabilitySlot.createMany).not.toHaveBeenCalled();
  });

  it("throws when endDate is before startDate", async () => {
    availabilityTemplate.findFirst.mockResolvedValue(monFriTemplate);
    await expect(
      applyTemplate(USER_ID, TEMPLATE_ID, "2026-06-21", "2026-06-15", "UTC")
    ).rejects.toThrow("End date must be ≥ start date");
  });

  it("throws when range exceeds 365 days", async () => {
    availabilityTemplate.findFirst.mockResolvedValue(monFriTemplate);
    await expect(
      applyTemplate(USER_ID, TEMPLATE_ID, "2026-01-01", "2027-01-10", "UTC")
    ).rejects.toThrow("Range too large (max 365 days)");
  });

  it("calls createMany with correct slots for a week range", async () => {
    availabilityTemplate.findFirst.mockResolvedValue(monFriTemplate);
    availabilitySlot.createMany.mockResolvedValue({ count: 2 });

    // 2026-06-15 is a Monday, 2026-06-21 is a Sunday
    const result = await applyTemplate(
      USER_ID, TEMPLATE_ID, "2026-06-15", "2026-06-21", "UTC"
    );

    expect(availabilitySlot.createMany).toHaveBeenCalledOnce();
    const { data } = availabilitySlot.createMany.mock.calls[0][0];
    // Expect slots for Monday (2026-06-15) and Friday (2026-06-19)
    expect(data).toHaveLength(2);
    expect(data[0].startMin).toBe(540);
    expect(data[0].endMin).toBe(1020);
    expect(result).toEqual({ created: 2 });
  });

  it("skips template days where endMin <= startMin", async () => {
    availabilityTemplate.findFirst.mockResolvedValue({
      ...monFriTemplate,
      days: [{ weekday: 1, startMin: 600, endMin: 600 }], // invalid
    });
    availabilitySlot.createMany.mockResolvedValue({ count: 0 });
    // Range with a Monday
    const result = await applyTemplate(USER_ID, TEMPLATE_ID, "2026-06-15", "2026-06-15", "UTC");
    expect(result).toEqual({ created: 0 });
    expect(availabilitySlot.createMany).not.toHaveBeenCalled();
  });

  it("returns { created: 0 } when no days match range", async () => {
    // Template only has Monday, but range is a single Saturday
    availabilityTemplate.findFirst.mockResolvedValue({
      ...monFriTemplate,
      days: [{ weekday: 1, startMin: 540, endMin: 1020 }],
    });
    // 2026-06-20 is a Saturday (weekday=6)
    const result = await applyTemplate(USER_ID, TEMPLATE_ID, "2026-06-20", "2026-06-20", "UTC");
    expect(result).toEqual({ created: 0 });
    expect(availabilitySlot.createMany).not.toHaveBeenCalled();
  });

  it("deduplicates slots with the same date/start/end within the call", async () => {
    // Template has duplicate entries for same weekday/time
    availabilityTemplate.findFirst.mockResolvedValue({
      ...monFriTemplate,
      days: [
        { weekday: 1, startMin: 540, endMin: 1020 },
        { weekday: 1, startMin: 540, endMin: 1020 }, // duplicate
      ],
    });
    availabilitySlot.createMany.mockResolvedValue({ count: 1 });
    const result = await applyTemplate(USER_ID, TEMPLATE_ID, "2026-06-15", "2026-06-15", "UTC");
    const { data } = availabilitySlot.createMany.mock.calls[0][0];
    expect(data).toHaveLength(1);
    expect(result).toEqual({ created: 1 });
  });
});

// ─── clearDay ─────────────────────────────────────────────────────────────────
describe("clearDay", () => {
  it("calls deleteMany with the parsed date and userProfileId", async () => {
    availabilitySlot.deleteMany.mockResolvedValue({ count: 3 });
    await clearDay(USER_ID, "2026-06-15");
    expect(availabilitySlot.deleteMany).toHaveBeenCalledWith({
      where: {
        userProfileId: USER_ID,
        date: new Date("2026-06-15T00:00:00.000Z"),
      },
    });
  });
});

// ─── getSlotsInRange ──────────────────────────────────────────────────────────
describe("getSlotsInRange", () => {
  it("returns empty object when no slots found", async () => {
    availabilitySlot.findMany.mockResolvedValue([]);
    const result = await getSlotsInRange(USER_ID, "2026-06-15", "2026-06-21");
    expect(result).toEqual({});
  });

  it("groups slots by YYYY-MM-DD date string", async () => {
    availabilitySlot.findMany.mockResolvedValue([
      { id: "s1", date: new Date("2026-06-15T00:00:00.000Z"), startMin: 540, endMin: 1020, note: null },
      { id: "s2", date: new Date("2026-06-15T00:00:00.000Z"), startMin: 1020, endMin: 1200, note: "PM" },
      { id: "s3", date: new Date("2026-06-16T00:00:00.000Z"), startMin: 540, endMin: 780, note: null },
    ]);
    const result = await getSlotsInRange(USER_ID, "2026-06-15", "2026-06-16");
    expect(Object.keys(result)).toEqual(["2026-06-15", "2026-06-16"]);
    expect(result["2026-06-15"]).toHaveLength(2);
    expect(result["2026-06-16"]).toHaveLength(1);
    expect(result["2026-06-15"][1].note).toBe("PM");
  });

  it("calls findMany with correct date range and user scope", async () => {
    availabilitySlot.findMany.mockResolvedValue([]);
    await getSlotsInRange(USER_ID, "2026-06-15", "2026-06-21");
    const call = availabilitySlot.findMany.mock.calls[0][0];
    expect(call.where.userProfileId).toBe(USER_ID);
    expect(call.where.date.gte).toEqual(new Date("2026-06-15T00:00:00.000Z"));
    expect(call.where.date.lte).toEqual(new Date("2026-06-21T00:00:00.000Z"));
  });
});

// ─── saveTemplate ─────────────────────────────────────────────────────────────
describe("saveTemplate", () => {
  const validDays = [{ weekday: 1, startMin: 540, endMin: 1020 }];

  it("throws when name is empty", async () => {
    await expect(
      saveTemplate(USER_ID, { name: "", timezone: "UTC", days: validDays })
    ).rejects.toThrow("Template name is required");
  });

  it("throws when name is whitespace-only", async () => {
    await expect(
      saveTemplate(USER_ID, { name: "   ", timezone: "UTC", days: validDays })
    ).rejects.toThrow("Template name is required");
  });

  it("throws when days array is empty", async () => {
    await expect(
      saveTemplate(USER_ID, { name: "Week", timezone: "UTC", days: [] })
    ).rejects.toThrow("At least one day window is required");
  });

  it("throws when a day has invalid weekday", async () => {
    await expect(
      saveTemplate(USER_ID, {
        name: "Week",
        timezone: "UTC",
        days: [{ weekday: 7, startMin: 540, endMin: 1020 }],
      })
    ).rejects.toThrow("Invalid weekday");
  });

  it("throws when a day has endMin <= startMin", async () => {
    await expect(
      saveTemplate(USER_ID, {
        name: "Week",
        timezone: "UTC",
        days: [{ weekday: 1, startMin: 600, endMin: 600 }],
      })
    ).rejects.toThrow("End time must be after start time");
  });

  it("calls create when no id provided", async () => {
    availabilityTemplate.create.mockResolvedValue({ id: TEMPLATE_ID });
    await saveTemplate(USER_ID, { name: "Workweek", timezone: "UTC", days: validDays });
    expect(availabilityTemplate.create).toHaveBeenCalledWith({
      data: {
        userProfileId: USER_ID,
        name: "Workweek",
        timezone: "UTC",
        days: validDays,
      },
    });
    expect(availabilityTemplate.update).not.toHaveBeenCalled();
  });

  it("trims name before creating", async () => {
    availabilityTemplate.create.mockResolvedValue({ id: TEMPLATE_ID });
    await saveTemplate(USER_ID, { name: "  Workweek  ", timezone: "UTC", days: validDays });
    const { data } = availabilityTemplate.create.mock.calls[0][0];
    expect(data.name).toBe("Workweek");
  });

  it("calls update when id is provided and template exists", async () => {
    availabilityTemplate.findFirst.mockResolvedValue({ id: TEMPLATE_ID });
    availabilityTemplate.update.mockResolvedValue({ id: TEMPLATE_ID });
    await saveTemplate(USER_ID, { id: TEMPLATE_ID, name: "Updated", timezone: "UTC", days: validDays });
    expect(availabilityTemplate.update).toHaveBeenCalledWith({
      where: { id: TEMPLATE_ID },
      data: { name: "Updated", timezone: "UTC", days: validDays },
    });
    expect(availabilityTemplate.create).not.toHaveBeenCalled();
  });

  it("throws when updating a template not owned by user", async () => {
    availabilityTemplate.findFirst.mockResolvedValue(null);
    await expect(
      saveTemplate(USER_ID, { id: TEMPLATE_ID, name: "Updated", timezone: "UTC", days: validDays })
    ).rejects.toThrow("Template not found");
  });
});

// ─── deleteTemplate ───────────────────────────────────────────────────────────
describe("deleteTemplate", () => {
  it("throws when template not found for this user", async () => {
    availabilityTemplate.findFirst.mockResolvedValue(null);
    await expect(deleteTemplate(USER_ID, TEMPLATE_ID)).rejects.toThrow("Template not found");
    expect(availabilityTemplate.delete).not.toHaveBeenCalled();
  });

  it("deletes template when found", async () => {
    availabilityTemplate.findFirst.mockResolvedValue({ id: TEMPLATE_ID });
    availabilityTemplate.delete.mockResolvedValue({ id: TEMPLATE_ID });
    await deleteTemplate(USER_ID, TEMPLATE_ID);
    expect(availabilityTemplate.delete).toHaveBeenCalledWith({ where: { id: TEMPLATE_ID } });
  });

  it("scopes findFirst by both templateId and userProfileId", async () => {
    availabilityTemplate.findFirst.mockResolvedValue(null);
    await expect(deleteTemplate(USER_ID, TEMPLATE_ID)).rejects.toThrow();
    expect(availabilityTemplate.findFirst).toHaveBeenCalledWith({
      where: { id: TEMPLATE_ID, userProfileId: USER_ID },
    });
  });
});
