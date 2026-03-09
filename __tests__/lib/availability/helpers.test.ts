/**
 * Tests for the pure (non-DB) helper functions exported from
 * lib/availability/service.ts, isolated from Prisma.
 */
import { describe, it, expect, vi } from "vitest";

// Mock prisma so the module can be imported without a real DB
vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

import {
  parseLocalDate,
  formatLocalDate,
  minToHHMM,
  HHMMtoMin,
} from "@/lib/availability/service";

// ─── parseLocalDate ───────────────────────────────────────────────────────────
describe("parseLocalDate", () => {
  it("parses a valid YYYY-MM-DD string to midnight UTC", () => {
    const d = parseLocalDate("2026-03-08");
    expect(d.toISOString()).toBe("2026-03-08T00:00:00.000Z");
  });
  it("parses January 1st correctly", () => {
    const d = parseLocalDate("2026-01-01");
    expect(d.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
  it("parses December 31st correctly", () => {
    const d = parseLocalDate("2025-12-31");
    expect(d.toISOString()).toBe("2025-12-31T00:00:00.000Z");
  });
  it("throws for completely invalid string", () => {
    expect(() => parseLocalDate("not-a-date")).toThrow("Invalid date: not-a-date");
  });
  it("throws for empty string", () => {
    expect(() => parseLocalDate("")).toThrow();
  });
  it("throws for invalid month (month 13)", () => {
    expect(() => parseLocalDate("2026-13-01")).toThrow();
  });
  it("roundtrips with formatLocalDate", () => {
    const s = "2026-06-15";
    expect(formatLocalDate(parseLocalDate(s))).toBe(s);
  });
});

// ─── formatLocalDate ──────────────────────────────────────────────────────────
describe("formatLocalDate", () => {
  it("formats midnight UTC to YYYY-MM-DD", () => {
    const d = new Date("2026-03-08T00:00:00.000Z");
    expect(formatLocalDate(d)).toBe("2026-03-08");
  });
  it("works for first day of year", () => {
    expect(formatLocalDate(new Date("2026-01-01T00:00:00.000Z"))).toBe("2026-01-01");
  });
  it("works for last day of year", () => {
    expect(formatLocalDate(new Date("2025-12-31T00:00:00.000Z"))).toBe("2025-12-31");
  });
  it("extracts only the date portion (ignores time)", () => {
    // A date at midday UTC: slice(0,10) should still return correct date
    expect(formatLocalDate(new Date("2026-06-15T12:30:00.000Z"))).toBe("2026-06-15");
  });
});

// ─── minToHHMM ────────────────────────────────────────────────────────────────
describe("minToHHMM", () => {
  it("converts 0 to '00:00'", () => {
    expect(minToHHMM(0)).toBe("00:00");
  });
  it("converts 60 to '01:00'", () => {
    expect(minToHHMM(60)).toBe("01:00");
  });
  it("converts 90 to '01:30'", () => {
    expect(minToHHMM(90)).toBe("01:30");
  });
  it("converts 570 to '09:30'", () => {
    expect(minToHHMM(570)).toBe("09:30");
  });
  it("converts 1439 to '23:59'", () => {
    expect(minToHHMM(1439)).toBe("23:59");
  });
  it("converts 1440 to '24:00' (edge: full day)", () => {
    expect(minToHHMM(1440)).toBe("24:00");
  });
  it("pads single-digit hours and minutes", () => {
    expect(minToHHMM(65)).toBe("01:05");
  });
});

// ─── HHMMtoMin ────────────────────────────────────────────────────────────────
describe("HHMMtoMin", () => {
  it("converts '00:00' to 0", () => {
    expect(HHMMtoMin("00:00")).toBe(0);
  });
  it("converts '01:00' to 60", () => {
    expect(HHMMtoMin("01:00")).toBe(60);
  });
  it("converts '01:30' to 90", () => {
    expect(HHMMtoMin("01:30")).toBe(90);
  });
  it("converts '23:59' to 1439", () => {
    expect(HHMMtoMin("23:59")).toBe(1439);
  });
  it("throws for non-numeric input", () => {
    expect(() => HHMMtoMin("ab:cd")).toThrow("Invalid time: ab:cd");
  });
  it("throws for missing colon", () => {
    expect(() => HHMMtoMin("0900")).toThrow();
  });
  it("throws for empty string", () => {
    expect(() => HHMMtoMin("")).toThrow();
  });
  it("roundtrips with minToHHMM", () => {
    for (const min of [0, 90, 570, 1439]) {
      expect(HHMMtoMin(minToHHMM(min))).toBe(min);
    }
  });
});
