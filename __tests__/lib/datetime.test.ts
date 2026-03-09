import { describe, it, expect } from "vitest";
import {
  formatDateISO,
  formatDateTimeISO,
  clamp,
  toMin,
  fromMin,
} from "@/lib/datetime";

// ─── formatDateISO ────────────────────────────────────────────────────────────
describe("formatDateISO", () => {
  it("formats a standard date", () => {
    expect(formatDateISO(new Date(2026, 2, 8))).toBe("2026-03-08"); // month is 0-based
  });
  it("pads single-digit month and day", () => {
    expect(formatDateISO(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
  it("handles December 31", () => {
    expect(formatDateISO(new Date(2025, 11, 31))).toBe("2025-12-31");
  });
  it("uses local time (not UTC)", () => {
    // Verifies that getFullYear/getMonth/getDate are used (local), not UTC methods
    const d = new Date(2026, 5, 15);
    expect(formatDateISO(d)).toBe("2026-06-15");
  });
});

// ─── formatDateTimeISO ────────────────────────────────────────────────────────
describe("formatDateTimeISO", () => {
  it("formats date and time with correct separators", () => {
    const d = new Date(2026, 2, 8, 14, 30);
    expect(formatDateTimeISO(d)).toBe("2026-03-08 14:30");
  });
  it("pads single-digit hour and minute", () => {
    const d = new Date(2026, 0, 5, 9, 5);
    expect(formatDateTimeISO(d)).toBe("2026-01-05 09:05");
  });
  it("handles midnight", () => {
    const d = new Date(2026, 0, 1, 0, 0);
    expect(formatDateTimeISO(d)).toBe("2026-01-01 00:00");
  });
  it("handles end of day", () => {
    const d = new Date(2026, 11, 31, 23, 59);
    expect(formatDateTimeISO(d)).toBe("2026-12-31 23:59");
  });
});

// ─── clamp ────────────────────────────────────────────────────────────────────
describe("clamp", () => {
  it("returns value when within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it("returns min when below range", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });
  it("returns max when above range", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
  it("returns min when value equals min", () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });
  it("returns max when value equals max", () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });
  it("handles negative ranges", () => {
    expect(clamp(-3, -10, -1)).toBe(-3);
    expect(clamp(0, -10, -1)).toBe(-1);
  });
});

// ─── toMin ────────────────────────────────────────────────────────────────────
describe("toMin", () => {
  it("converts '00:00' to 0", () => {
    expect(toMin("00:00")).toBe(0);
  });
  it("converts '01:00' to 60", () => {
    expect(toMin("01:00")).toBe(60);
  });
  it("converts '09:30' to 570", () => {
    expect(toMin("09:30")).toBe(570);
  });
  it("converts '23:59' to 1439", () => {
    expect(toMin("23:59")).toBe(1439);
  });
  it("returns null for invalid format (missing colon)", () => {
    expect(toMin("0900")).toBeNull();
  });
  it("returns null for non-numeric parts", () => {
    expect(toMin("ab:cd")).toBeNull();
  });
  it("returns null for hour out-of-range (> 23)", () => {
    expect(toMin("24:00")).toBeNull();
  });
  it("returns null for minute out-of-range (> 59)", () => {
    expect(toMin("12:60")).toBeNull();
  });
  it("returns null for negative hour", () => {
    expect(toMin("-1:00")).toBeNull();
  });
  it("returns null for empty string", () => {
    // "".split(":") gives [""] which maps to [NaN]
    expect(toMin("")).toBeNull();
  });
});

// ─── fromMin ──────────────────────────────────────────────────────────────────
describe("fromMin", () => {
  it("converts 0 to '00:00'", () => {
    expect(fromMin(0)).toBe("00:00");
  });
  it("converts 60 to '01:00'", () => {
    expect(fromMin(60)).toBe("01:00");
  });
  it("converts 570 to '09:30'", () => {
    expect(fromMin(570)).toBe("09:30");
  });
  it("converts 1439 to '23:59'", () => {
    expect(fromMin(1439)).toBe("23:59");
  });
  it("pads single-digit hours and minutes", () => {
    expect(fromMin(65)).toBe("01:05");
  });
  it("roundtrips with toMin for valid values", () => {
    const values = [0, 60, 90, 570, 1439];
    for (const v of values) {
      expect(toMin(fromMin(v))).toBe(v);
    }
  });
});
