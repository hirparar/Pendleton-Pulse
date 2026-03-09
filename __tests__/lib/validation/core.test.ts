import { describe, it, expect } from "vitest";
import {
  cleanText,
  cleanRequired,
  cleanInt,
  cleanOptionalInt,
  cleanDate,
  cleanDateTime,
  cleanStringArray,
} from "@/lib/validation/core";

// ─── cleanText ────────────────────────────────────────────────────────────────
describe("cleanText", () => {
  it("returns null for undefined", () => {
    expect(cleanText(undefined)).toBeNull();
  });
  it("returns null for null", () => {
    expect(cleanText(null)).toBeNull();
  });
  it("returns null for empty string", () => {
    expect(cleanText("")).toBeNull();
  });
  it("returns null for whitespace-only string", () => {
    expect(cleanText("   ")).toBeNull();
  });
  it("trims and returns non-empty string", () => {
    expect(cleanText("  hello  ")).toBe("hello");
  });
  it("clamps to max length", () => {
    const long = "a".repeat(600);
    expect(cleanText(long, 500)).toHaveLength(500);
  });
  it("respects custom max", () => {
    expect(cleanText("abcdef", 3)).toBe("abc");
  });
  it("coerces number to string", () => {
    expect(cleanText(42)).toBe("42");
  });
});

// ─── cleanRequired ────────────────────────────────────────────────────────────
describe("cleanRequired", () => {
  it("throws for empty string", () => {
    expect(() => cleanRequired("")).toThrow("is required");
  });
  it("throws for whitespace-only string", () => {
    expect(() => cleanRequired("   ", 180, "Name")).toThrow("Name is required");
  });
  it("throws for null", () => {
    expect(() => cleanRequired(null)).toThrow();
  });
  it("throws for undefined", () => {
    expect(() => cleanRequired(undefined)).toThrow();
  });
  it("trims and returns value", () => {
    expect(cleanRequired("  Alice  ")).toBe("Alice");
  });
  it("clamps to max length", () => {
    const long = "b".repeat(300);
    expect(cleanRequired(long, 180)).toHaveLength(180);
  });
  it("uses custom label in error message", () => {
    expect(() => cleanRequired("", 180, "Client name")).toThrow("Client name is required");
  });
});

// ─── cleanInt ─────────────────────────────────────────────────────────────────
describe("cleanInt", () => {
  it("returns integer for valid number", () => {
    expect(cleanInt(5, { min: 1, max: 10, label: "Count" })).toBe(5);
  });
  it("truncates floats (does not round)", () => {
    expect(cleanInt(3.9, { min: 1, max: 10, label: "Count" })).toBe(3);
  });
  it("throws for non-numeric string", () => {
    expect(() => cleanInt("abc", { min: 1, max: 10, label: "Count" })).toThrow(
      "Count must be a number"
    );
  });
  it("throws for NaN", () => {
    expect(() => cleanInt(NaN, { min: 1, max: 10, label: "Count" })).toThrow();
  });
  it("throws when below min", () => {
    expect(() => cleanInt(0, { min: 1, max: 10, label: "Count" })).toThrow(
      "Count must be between 1 and 10"
    );
  });
  it("throws when above max", () => {
    expect(() => cleanInt(11, { min: 1, max: 10, label: "Count" })).toThrow(
      "Count must be between 1 and 10"
    );
  });
  it("accepts boundary min value", () => {
    expect(cleanInt(1, { min: 1, max: 10, label: "Count" })).toBe(1);
  });
  it("accepts boundary max value", () => {
    expect(cleanInt(10, { min: 1, max: 10, label: "Count" })).toBe(10);
  });
  it("accepts numeric string", () => {
    expect(cleanInt("7", { min: 1, max: 10, label: "Count" })).toBe(7);
  });
});

// ─── cleanOptionalInt ─────────────────────────────────────────────────────────
describe("cleanOptionalInt", () => {
  it("returns null for null", () => {
    expect(cleanOptionalInt(null)).toBeNull();
  });
  it("returns null for undefined", () => {
    expect(cleanOptionalInt(undefined)).toBeNull();
  });
  it("returns null for empty string", () => {
    expect(cleanOptionalInt("")).toBeNull();
  });
  it("returns null for invalid string", () => {
    expect(cleanOptionalInt("abc")).toBeNull();
  });
  it("returns null when below min", () => {
    expect(cleanOptionalInt(-1, 0, 60)).toBeNull();
  });
  it("returns null when above max", () => {
    expect(cleanOptionalInt(61, 0, 60)).toBeNull();
  });
  it("rounds floats", () => {
    expect(cleanOptionalInt(3.6, 0, 60)).toBe(4);
  });
  it("returns valid integer", () => {
    expect(cleanOptionalInt(30, 0, 60)).toBe(30);
  });
  it("accepts boundary values", () => {
    expect(cleanOptionalInt(0, 0, 60)).toBe(0);
    expect(cleanOptionalInt(60, 0, 60)).toBe(60);
  });
});

// ─── cleanDate ────────────────────────────────────────────────────────────────
describe("cleanDate", () => {
  it("returns a Date for a valid ISO string", () => {
    const d = cleanDate("2026-03-08", "Start");
    expect(d).toBeInstanceOf(Date);
    expect(isNaN(d.getTime())).toBe(false);
  });
  it("returns a Date for a datetime string", () => {
    const d = cleanDate("2026-03-08T09:00:00Z", "Start");
    expect(d.toISOString()).toBe("2026-03-08T09:00:00.000Z");
  });
  it("throws for invalid date string", () => {
    expect(() => cleanDate("not-a-date", "Start")).toThrow("Start must be a valid date");
  });
  it("throws for empty string", () => {
    expect(() => cleanDate("", "Start")).toThrow("Start must be a valid date");
  });
  it("throws for null", () => {
    expect(() => cleanDate(null, "Start")).toThrow();
  });
});

// ─── cleanDateTime ────────────────────────────────────────────────────────────
describe("cleanDateTime", () => {
  it("returns a Date for a valid datetime string", () => {
    const d = cleanDateTime("2026-06-15T14:30:00Z", "Event");
    expect(d.getUTCHours()).toBe(14);
  });
  it("throws for empty string", () => {
    expect(() => cleanDateTime("", "Event")).toThrow("Event is required");
  });
  it("throws for whitespace-only string", () => {
    expect(() => cleanDateTime("   ", "Event")).toThrow("Event is required");
  });
  it("throws for invalid string", () => {
    expect(() => cleanDateTime("bad", "Event")).toThrow("Event must be a valid datetime");
  });
});

// ─── cleanStringArray ─────────────────────────────────────────────────────────
describe("cleanStringArray", () => {
  it("returns empty array for non-array input", () => {
    expect(cleanStringArray("not-array")).toEqual([]);
    expect(cleanStringArray(null)).toEqual([]);
    expect(cleanStringArray(undefined)).toEqual([]);
    expect(cleanStringArray(42)).toEqual([]);
  });
  it("filters empty strings", () => {
    expect(cleanStringArray(["a", "", "b", "  "])).toEqual(["a", "b"]);
  });
  it("trims whitespace from each item", () => {
    expect(cleanStringArray(["  hello  "])).toEqual(["hello"]);
  });
  it("clamps item length to maxLen", () => {
    const out = cleanStringArray(["abcdef"], 25, 3);
    expect(out[0]).toBe("abc");
  });
  it("deduplicates case-insensitively, keeping first casing", () => {
    expect(cleanStringArray(["Spanish", "SPANISH", "spanish"])).toEqual(["Spanish"]);
  });
  it("preserves order of first occurrences", () => {
    expect(cleanStringArray(["B", "A", "b"])).toEqual(["B", "A"]);
  });
  it("clamps array to maxItems", () => {
    const input = Array.from({ length: 30 }, (_, i) => `item${i}`);
    const out = cleanStringArray(input, 10);
    expect(out).toHaveLength(10);
  });
  it("returns all unique valid items when under limit", () => {
    expect(cleanStringArray(["en", "es", "fr"])).toEqual(["en", "es", "fr"]);
  });
});
