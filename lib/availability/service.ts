// lib/availability/service.ts
import { prisma } from "@/lib/prisma";

export type TemplateDay = {
  weekday: number;
  startMin: number;
  endMin: number;
};

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

export function parseLocalDate(s: string): Date {
  const d = new Date(`${s}T00:00:00.000Z`);
  if (isNaN(d.getTime())) throw new Error(`Invalid date: ${s}`);
  return d;
}

export function formatLocalDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function minToHHMM(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function HHMMtoMin(s: string): number {
  const [h, m] = s.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) throw new Error(`Invalid time: ${s}`);
  return h * 60 + m;
}

function rangesOverlap(
  a: { startMin: number; endMin: number },
  b: { startMin: number; endMin: number }
) {
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

export async function upsertSlot(
  userProfileId: string,
  input: {
    date: string;
    startMin: number;
    endMin: number;
    timezone: string;
    note?: string | null;
    templateId?: string | null;
  }
) {
  const date = parseLocalDate(input.date);

  if (input.endMin <= input.startMin) {
    throw new Error("End time must be after start time");
  }
  if (input.startMin < 0 || input.endMin > 1440) {
    throw new Error("Times must be within a single day");
  }

  const exact = await prisma.availabilitySlot.findFirst({
    where: {
      userProfileId,
      date,
      startMin: input.startMin,
      endMin: input.endMin,
    },
  });

  if (exact) {
    return prisma.availabilitySlot.update({
      where: { id: exact.id },
      data: {
        timezone: input.timezone,
        note: input.note ?? null,
        templateId: input.templateId ?? null,
      },
    });
  }

  const overlapping = await prisma.availabilitySlot.findFirst({
    where: {
      userProfileId,
      date,
      startMin: { lt: input.endMin },
      endMin: { gt: input.startMin },
    },
  });

  if (overlapping) {
    throw new Error(
      `This window overlaps an existing slot (${minToHHMM(overlapping.startMin)}–${minToHHMM(overlapping.endMin)})`
    );
  }

  return prisma.availabilitySlot.create({
    data: {
      userProfileId,
      date,
      startMin: input.startMin,
      endMin: input.endMin,
      timezone: input.timezone,
      note: input.note ?? null,
      templateId: input.templateId ?? null,
    },
  });
}

export async function deleteSlot(userProfileId: string, slotId: string) {
  const existing = await prisma.availabilitySlot.findFirst({
    where: { id: slotId, userProfileId },
  });
  if (!existing) throw new Error("Slot not found");
  await prisma.availabilitySlot.delete({ where: { id: slotId } });
}

export async function applyTemplate(
  userProfileId: string,
  templateId: string,
  startDate: string,
  endDate: string,
  timezone: string
) {
  const template = await prisma.availabilityTemplate.findFirst({
    where: { id: templateId, userProfileId },
  });
  if (!template) throw new Error("Template not found");

  const days = template.days as TemplateDay[];
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);

  if (end < start) throw new Error("End date must be ≥ start date");

  const dayMs = 24 * 60 * 60 * 1000;
  const totalDays = Math.round((end.getTime() - start.getTime()) / dayMs) + 1;
  if (totalDays > 365) throw new Error("Range too large (max 365 days)");

  type SlotCreateInput = {
    userProfileId: string;
    date: Date;
    startMin: number;
    endMin: number;
    timezone: string;
    templateId: string;
  };

  const toCreate: SlotCreateInput[] = [];
  const slotSet = new Set<string>();

  for (let i = 0; i < totalDays; i++) {
    const current = addDays(start, i);
    const weekday = current.getUTCDay();
    const dateStr = formatLocalDate(current);

    for (const d of days) {
      if (d.weekday !== weekday) continue;
      if (d.endMin <= d.startMin) continue;

      const key = `${dateStr}:${d.startMin}:${d.endMin}`;
      if (slotSet.has(key)) continue;
      slotSet.add(key);

      toCreate.push({
        userProfileId,
        date: current,
        startMin: d.startMin,
        endMin: d.endMin,
        timezone,
        templateId,
      });
    }
  }

  if (toCreate.length === 0) return { created: 0 };

  const existing = await prisma.availabilitySlot.findMany({
    where: {
      userProfileId,
      date: { gte: start, lte: end },
    },
    select: { date: true, startMin: true, endMin: true },
  });

  const filtered = toCreate.filter((candidate) => {
    return !existing.some((slot) => {
      const sameDate = formatLocalDate(slot.date) === formatLocalDate(candidate.date);
      if (!sameDate) return false;

      const exact = slot.startMin === candidate.startMin && slot.endMin === candidate.endMin;
      if (exact) return true;

      return rangesOverlap(
        { startMin: slot.startMin, endMin: slot.endMin },
        { startMin: candidate.startMin, endMin: candidate.endMin }
      );
    });
  });

  if (filtered.length === 0) return { created: 0 };

  const result = await prisma.availabilitySlot.createMany({
    data: filtered,
    skipDuplicates: true,
  });

  return { created: result.count };
}

export async function clearDay(userProfileId: string, date: string) {
  const d = parseLocalDate(date);
  await prisma.availabilitySlot.deleteMany({
    where: { userProfileId, date: d },
  });
}

export async function getSlotsInRange(
  userProfileId: string,
  startDate: string,
  endDate: string
): Promise<Record<string, { id: string; startMin: number; endMin: number; note: string | null }[]>> {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);

  const slots = await prisma.availabilitySlot.findMany({
    where: {
      userProfileId,
      date: { gte: start, lte: end },
    },
    orderBy: [{ date: "asc" }, { startMin: "asc" }],
  });

  const grouped: Record<string, { id: string; startMin: number; endMin: number; note: string | null }[]> = {};
  for (const s of slots) {
    const key = formatLocalDate(s.date);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({ id: s.id, startMin: s.startMin, endMin: s.endMin, note: s.note });
  }
  return grouped;
}

export async function saveTemplate(
  userProfileId: string,
  input: {
    id?: string | null;
    name: string;
    timezone: string;
    days: TemplateDay[];
  }
) {
  if (!input.name?.trim()) throw new Error("Template name is required");
  if (!Array.isArray(input.days) || input.days.length === 0) {
    throw new Error("At least one day window is required");
  }

  for (const d of input.days) {
    if (d.weekday < 0 || d.weekday > 6) throw new Error("Invalid weekday");
    if (d.endMin <= d.startMin) throw new Error("End time must be after start time");
  }

  const byWeekday = new Map<number, TemplateDay[]>();
  for (const d of input.days) {
    const arr = byWeekday.get(d.weekday) ?? [];
    arr.push(d);
    byWeekday.set(d.weekday, arr);
  }

  for (const [, arr] of byWeekday) {
    const sorted = arr.slice().sort((a, b) => a.startMin - b.startMin);
    for (let i = 1; i < sorted.length; i++) {
      if (rangesOverlap(sorted[i - 1], sorted[i])) {
        throw new Error(
          `Template contains overlapping windows (${minToHHMM(sorted[i - 1].startMin)}–${minToHHMM(sorted[i - 1].endMin)} and ${minToHHMM(sorted[i].startMin)}–${minToHHMM(sorted[i].endMin)})`
        );
      }
    }
  }

  if (input.id) {
    const existing = await prisma.availabilityTemplate.findFirst({
      where: { id: input.id, userProfileId },
    });
    if (!existing) throw new Error("Template not found");

    return prisma.availabilityTemplate.update({
      where: { id: input.id },
      data: {
        name: input.name.trim(),
        timezone: input.timezone,
        days: input.days,
      },
    });
  }

  return prisma.availabilityTemplate.create({
    data: {
      userProfileId,
      name: input.name.trim(),
      timezone: input.timezone,
      days: input.days,
    },
  });
}

export async function deleteTemplate(userProfileId: string, templateId: string) {
  const existing = await prisma.availabilityTemplate.findFirst({
    where: { id: templateId, userProfileId },
  });
  if (!existing) throw new Error("Template not found");
  await prisma.availabilityTemplate.delete({ where: { id: templateId } });
}