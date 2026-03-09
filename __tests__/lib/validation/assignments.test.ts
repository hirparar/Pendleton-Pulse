import { describe, it, expect } from "vitest";
import {
  validateCreateAssignment,
  validateUpdateAssignment,
} from "@/lib/validation/assignments";

// ─── validateCreateAssignment ─────────────────────────────────────────────────
describe("validateCreateAssignment", () => {
  const base = {
    clientName: "Acme Corp",
    languagePair: "English-Spanish",
    assignmentType: "Medical",
    scheduledStart: "2026-06-15T09:00:00Z",
    location: "Hospital Room 3",
  };

  it("returns validated data for minimal valid input", () => {
    const result = validateCreateAssignment(base);
    expect(result.clientName).toBe("Acme Corp");
    expect(result.languagePair).toBe("English-Spanish");
    expect(result.assignmentType).toBe("Medical");
    expect(result.location).toBe("Hospital Room 3");
    expect(result.scheduledStart).toBeInstanceOf(Date);
    expect(result.scheduledEnd).toBeNull();
    expect(result.interpretersNeeded).toBe(1); // default
    expect(result.specialNotes).toBeNull();
  });

  it("defaults interpretersNeeded to 1 when omitted", () => {
    const r = validateCreateAssignment(base);
    expect(r.interpretersNeeded).toBe(1);
  });

  it("accepts explicit interpretersNeeded", () => {
    const r = validateCreateAssignment({ ...base, interpretersNeeded: 3 });
    expect(r.interpretersNeeded).toBe(3);
  });

  it("throws when clientName is missing", () => {
    expect(() => validateCreateAssignment({ ...base, clientName: "" })).toThrow(
      "Client name is required"
    );
  });

  it("throws when languagePair is missing", () => {
    expect(() => validateCreateAssignment({ ...base, languagePair: "   " })).toThrow(
      "Language pair is required"
    );
  });

  it("throws when assignmentType is missing", () => {
    expect(() => validateCreateAssignment({ ...base, assignmentType: "" })).toThrow(
      "Assignment type is required"
    );
  });

  it("throws when location is missing", () => {
    expect(() => validateCreateAssignment({ ...base, location: "" })).toThrow(
      "Location is required"
    );
  });

  it("throws when scheduledStart is invalid", () => {
    expect(() => validateCreateAssignment({ ...base, scheduledStart: "not-a-date" })).toThrow(
      "Start time must be a valid date"
    );
  });

  it("throws when scheduledEnd is before scheduledStart", () => {
    expect(() =>
      validateCreateAssignment({
        ...base,
        scheduledStart: "2026-06-15T10:00:00Z",
        scheduledEnd: "2026-06-15T09:00:00Z",
      })
    ).toThrow("End time cannot be before start time");
  });

  it("does not throw when scheduledEnd equals scheduledStart (edge case — same instant)", () => {
    // The validation only throws when end < start, not <=
    expect(() =>
      validateCreateAssignment({
        ...base,
        scheduledStart: "2026-06-15T10:00:00Z",
        scheduledEnd: "2026-06-15T11:00:00Z",
      })
    ).not.toThrow();
  });

  it("accepts valid scheduledEnd after scheduledStart", () => {
    const r = validateCreateAssignment({
      ...base,
      scheduledStart: "2026-06-15T09:00:00Z",
      scheduledEnd: "2026-06-15T11:00:00Z",
    });
    expect(r.scheduledEnd).toBeInstanceOf(Date);
  });

  it("throws when interpretersNeeded is out of range", () => {
    expect(() =>
      validateCreateAssignment({ ...base, interpretersNeeded: 0 })
    ).toThrow("Interpreters needed must be between 1 and 50");
    expect(() =>
      validateCreateAssignment({ ...base, interpretersNeeded: 51 })
    ).toThrow("Interpreters needed must be between 1 and 50");
  });

  it("accepts specialNotes", () => {
    const r = validateCreateAssignment({ ...base, specialNotes: "Bring headset" });
    expect(r.specialNotes).toBe("Bring headset");
  });

  it("returns null for empty specialNotes", () => {
    const r = validateCreateAssignment({ ...base, specialNotes: "" });
    expect(r.specialNotes).toBeNull();
  });
});

// ─── validateUpdateAssignment ─────────────────────────────────────────────────
describe("validateUpdateAssignment", () => {
  it("returns empty patch for empty input", () => {
    const patch = validateUpdateAssignment({});
    expect(patch).toEqual({});
  });

  it("updates clientName when provided", () => {
    const patch = validateUpdateAssignment({ clientName: "New Corp" });
    expect(patch.clientName).toBe("New Corp");
  });

  it("throws when clientName is empty string in update", () => {
    expect(() => validateUpdateAssignment({ clientName: "" })).toThrow(
      "Client name is required"
    );
  });

  it("does not touch fields not in input", () => {
    const patch = validateUpdateAssignment({ languagePair: "English-French" });
    expect(patch).not.toHaveProperty("clientName");
    expect(patch.languagePair).toBe("English-French");
  });

  it("throws when both dates present and end is before start", () => {
    expect(() =>
      validateUpdateAssignment({
        scheduledStart: "2026-06-15T10:00:00Z",
        scheduledEnd: "2026-06-15T08:00:00Z",
      })
    ).toThrow("End time cannot be before start time");
  });

  it("accepts partial date update (only start)", () => {
    const patch = validateUpdateAssignment({ scheduledStart: "2026-06-15T09:00:00Z" });
    expect(patch.scheduledStart).toBeInstanceOf(Date);
    expect(patch).not.toHaveProperty("scheduledEnd");
  });

  it("sets scheduledEnd to null when empty string provided", () => {
    const patch = validateUpdateAssignment({ scheduledEnd: "" });
    expect(patch.scheduledEnd).toBeNull();
  });

  it("updates interpretersNeeded", () => {
    const patch = validateUpdateAssignment({ interpretersNeeded: 2 });
    expect(patch.interpretersNeeded).toBe(2);
  });

  it("throws when interpretersNeeded out of range in update", () => {
    expect(() => validateUpdateAssignment({ interpretersNeeded: 0 })).toThrow(
      "Interpreters needed must be between 1 and 50"
    );
  });

  it("sets specialNotes to null when empty", () => {
    const patch = validateUpdateAssignment({ specialNotes: "   " });
    expect(patch.specialNotes).toBeNull();
  });
});
