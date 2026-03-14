/**
 * Tests for app/interpreter/(app)/availability/actions.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  requireInterpreterEligible,
  revalidatePath,
  availabilitySlot,
  upsertSlot,
  deleteSlot,
  applyTemplate,
  clearDay,
  saveTemplate,
  deleteTemplate,
  parseLocalDate,
} = vi.hoisted(() => ({
  requireInterpreterEligible: vi.fn(),
  revalidatePath: vi.fn(),
  availabilitySlot: { findMany: vi.fn() },
  upsertSlot: vi.fn(),
  deleteSlot: vi.fn(),
  applyTemplate: vi.fn(),
  clearDay: vi.fn(),
  saveTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  parseLocalDate: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({ requireInterpreterEligible }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/prisma", () => ({ prisma: { availabilitySlot } }));
vi.mock("@/lib/availability/service", () => ({
  upsertSlot,
  deleteSlot,
  applyTemplate,
  clearDay,
  saveTemplate,
  deleteTemplate,
  parseLocalDate,
}));

import {
  upsertSlotAction,
  deleteSlotAction,
  clearDayAction,
  applyTemplateAction,
  saveTemplateAction,
  deleteTemplateAction,
} from "@/app/interpreter/(app)/availability/actions";

const PROFILE = { id: "interp-1", role: "INTERPRETER", status: "APPROVED" };

beforeEach(() => {
  vi.clearAllMocks();
  requireInterpreterEligible.mockResolvedValue(PROFILE);
  parseLocalDate.mockImplementation((date: string) => new Date(`${date}T00:00:00.000Z`));
  availabilitySlot.findMany.mockResolvedValue([]);
  upsertSlot.mockResolvedValue({});
  deleteSlot.mockResolvedValue({});
  applyTemplate.mockResolvedValue({ created: 3 });
  clearDay.mockResolvedValue({});
  saveTemplate.mockResolvedValue({ id: "tmpl-1" });
  deleteTemplate.mockResolvedValue({});
});

// ─── upsertSlotAction ─────────────────────────────────────────────────────────
describe("upsertSlotAction", () => {
  const validInput = { date: "2026-06-15", startMin: 540, endMin: 1020, timezone: "UTC" };

  it("returns { ok: true, slots } on success", async () => {
    const result = await upsertSlotAction(validInput);
    expect(result).toEqual({ ok: true, slots: [] });
  });

  it("calls upsertSlot with the interpreter's own id", async () => {
    await upsertSlotAction(validInput);
    expect(upsertSlot).toHaveBeenCalledWith("interp-1", validInput);
  });

  it("revalidates /interpreter/availability", async () => {
    await upsertSlotAction(validInput);
    expect(revalidatePath).toHaveBeenCalledWith("/interpreter/availability");
  });

  it("revalidates /admin/availability", async () => {
    await upsertSlotAction(validInput);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/availability");
  });

  it("throws when auth fails", async () => {
    requireInterpreterEligible.mockRejectedValue(new Error("Not eligible"));
    await expect(upsertSlotAction(validInput)).rejects.toThrow("Not eligible");
  });

  it("throws when upsertSlot throws", async () => {
    upsertSlot.mockRejectedValue(new Error("End time must be after start time"));
    await expect(upsertSlotAction(validInput)).rejects.toThrow("End time must be after start time");
  });
});

// ─── deleteSlotAction ─────────────────────────────────────────────────────────
describe("deleteSlotAction", () => {
  it("returns { ok: true } on success", async () => {
    const result = await deleteSlotAction("slot-1");
    expect(result).toEqual({ ok: true });
  });

  it("calls deleteSlot with interpreter id and slot id", async () => {
    await deleteSlotAction("slot-1");
    expect(deleteSlot).toHaveBeenCalledWith("interp-1", "slot-1");
  });

  it("throws when deleteSlot throws (slot not found)", async () => {
    deleteSlot.mockRejectedValue(new Error("Slot not found"));
    await expect(deleteSlotAction("bad-id")).rejects.toThrow("Slot not found");
  });
});

// ─── clearDayAction ───────────────────────────────────────────────────────────
describe("clearDayAction", () => {
  it("returns { ok: true } on success", async () => {
    const result = await clearDayAction("2026-06-15");
    expect(result).toEqual({ ok: true });
  });

  it("calls clearDay with interpreter id and date", async () => {
    await clearDayAction("2026-06-15");
    expect(clearDay).toHaveBeenCalledWith("interp-1", "2026-06-15");
  });
});

// ─── applyTemplateAction ──────────────────────────────────────────────────────
describe("applyTemplateAction", () => {
  const input = {
    templateId: "tmpl-1",
    startDate: "2026-06-15",
    endDate: "2026-06-21",
    timezone: "UTC",
  };

  it("returns { ok: true, created: count } on success", async () => {
    const result = await applyTemplateAction(input);
    expect(result).toEqual({ ok: true, created: 3 });
  });

  it("calls applyTemplate with correct args", async () => {
    await applyTemplateAction(input);
    expect(applyTemplate).toHaveBeenCalledWith(
      "interp-1", "tmpl-1", "2026-06-15", "2026-06-21", "UTC"
    );
  });

  it("throws when template not found", async () => {
    applyTemplate.mockRejectedValue(new Error("Template not found"));
    await expect(applyTemplateAction(input)).rejects.toThrow("Template not found");
  });
});

// ─── saveTemplateAction ───────────────────────────────────────────────────────
describe("saveTemplateAction", () => {
  const input = {
    name: "Workweek",
    timezone: "UTC",
    days: [{ weekday: 1, startMin: 540, endMin: 1020 }],
  };

  it("returns { ok: true, id } on success", async () => {
    const result = await saveTemplateAction(input);
    expect(result).toEqual({ ok: true, id: "tmpl-1" });
  });

  it("calls saveTemplate with interpreter id and input", async () => {
    await saveTemplateAction(input);
    expect(saveTemplate).toHaveBeenCalledWith("interp-1", input);
  });

  it("throws when saveTemplate throws (e.g., empty name)", async () => {
    saveTemplate.mockRejectedValue(new Error("Template name is required"));
    await expect(saveTemplateAction({ ...input, name: "" })).rejects.toThrow(
      "Template name is required"
    );
  });
});

// ─── deleteTemplateAction ─────────────────────────────────────────────────────
describe("deleteTemplateAction", () => {
  it("returns { ok: true } on success", async () => {
    const result = await deleteTemplateAction("tmpl-1");
    expect(result).toEqual({ ok: true });
  });

  it("calls deleteTemplate with interpreter id and template id", async () => {
    await deleteTemplateAction("tmpl-1");
    expect(deleteTemplate).toHaveBeenCalledWith("interp-1", "tmpl-1");
  });

  it("throws when template not found", async () => {
    deleteTemplate.mockRejectedValue(new Error("Template not found"));
    await expect(deleteTemplateAction("bad-tmpl")).rejects.toThrow("Template not found");
  });
});
