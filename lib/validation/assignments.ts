import { cleanDate, cleanInt, cleanRequired, cleanText } from "./core";

export type CreateAssignmentInput = {
  clientName: unknown;
  languagePair: unknown;
  assignmentType: unknown;
  scheduledStart: unknown;
  scheduledEnd?: unknown;
  location: unknown;
  interpretersNeeded?: unknown;
  specialNotes?: unknown;
};

export function validateCreateAssignment(input: CreateAssignmentInput) {
  const clientName = cleanRequired(input.clientName, 160, "Client name");
  const languagePair = cleanRequired(input.languagePair, 80, "Language pair");
  const assignmentType = cleanRequired(input.assignmentType, 80, "Assignment type");
  const location = cleanRequired(input.location, 180, "Location");

  const scheduledStart = cleanDate(input.scheduledStart, "Start time");
  const scheduledEnd = input.scheduledEnd ? cleanDate(input.scheduledEnd, "End time") : null;

  if (scheduledEnd && scheduledEnd.getTime() < scheduledStart.getTime()) {
    throw new Error("End time cannot be before start time");
  }

  // Phase 5 will do stricter "no past times". Foundation can still enforce sane input:
  const interpretersNeeded = input.interpretersNeeded === undefined
    ? 1
    : cleanInt(input.interpretersNeeded, { min: 1, max: 50, label: "Interpreters needed" });

  const specialNotes = cleanText(input.specialNotes, 2000);

  return {
    clientName,
    languagePair,
    assignmentType,
    location,
    scheduledStart,
    scheduledEnd,
    interpretersNeeded,
    specialNotes,
  };
}

export type UpdateAssignmentInput = Partial<{
  clientName: unknown;
  languagePair: unknown;
  assignmentType: unknown;
  scheduledStart: unknown;
  scheduledEnd: unknown;
  location: unknown;
  interpretersNeeded: unknown;
  specialNotes: unknown;
}>;

export function validateUpdateAssignment(input: UpdateAssignmentInput) {
  const patch: Record<string, any> = {};

  if ("clientName" in input) patch.clientName = cleanRequired(input.clientName, 160, "Client name");
  if ("languagePair" in input) patch.languagePair = cleanRequired(input.languagePair, 80, "Language pair");
  if ("assignmentType" in input) patch.assignmentType = cleanRequired(input.assignmentType, 80, "Assignment type");
  if ("location" in input) patch.location = cleanRequired(input.location, 180, "Location");

  if ("scheduledStart" in input) patch.scheduledStart = cleanDate(input.scheduledStart, "Start time");
  if ("scheduledEnd" in input) patch.scheduledEnd = input.scheduledEnd ? cleanDate(input.scheduledEnd, "End time") : null;

  if ("interpretersNeeded" in input) {
    patch.interpretersNeeded = cleanInt(input.interpretersNeeded, { min: 1, max: 50, label: "Interpreters needed" });
  }

  if ("specialNotes" in input) patch.specialNotes = cleanText(input.specialNotes, 2000);

  // If both are present, enforce ordering
  if (patch.scheduledStart && patch.scheduledEnd && patch.scheduledEnd.getTime() < patch.scheduledStart.getTime()) {
    throw new Error("End time cannot be before start time");
  }

  return patch;
}
