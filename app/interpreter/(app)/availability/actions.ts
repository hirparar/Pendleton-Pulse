// app/interpreter/availability/actions.ts
"use server";

import { requireInterpreterEligible } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  upsertSlot,
  deleteSlot,
  applyTemplate,
  clearDay,
  saveTemplate,
  deleteTemplate,
  formatLocalDate,
  parseLocalDate,
} from "@/lib/availability/service";

/**
 * Fetch the real slots for a single date straight from the DB.
 * Called after every mutation to replace optimistic client state with ground
 * truth — this is what prevents ghost slots (slots deleted client-side but
 * still alive in the DB with a different id) from accumulating.
 */
export async function getSlotsForDateAction(dateStr: string) {
  const me = await requireInterpreterEligible();
  const date = parseLocalDate(dateStr);
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);

  const rows = await prisma.availabilitySlot.findMany({
    where: { userProfileId: me.id, date: { gte: date, lt: next } },
    orderBy: { startMin: "asc" },
  });

  return rows.map((s) => ({
    id: s.id,
    date: dateStr,
    startMin: s.startMin,
    endMin: s.endMin,
    timezone: s.timezone,
    note: s.note,
    templateId: s.templateId,
  }));
}

export async function upsertSlotAction(input: {
  date: string;
  startMin: number;
  endMin: number;
  timezone: string;
  note?: string | null;
  templateId?: string | null;
}) {
  const me = await requireInterpreterEligible();
  await upsertSlot(me.id, input);
  revalidatePath("/interpreter/availability");
  revalidatePath("/admin/availability");
  // Return all slots for this date from the DB — not just the upserted one.
  // This is the single source of truth the client replaces its local state with.
  return { ok: true, slots: await getSlotsForDateAction(input.date) };
}

export async function deleteSlotAction(slotId: string) {
  const me = await requireInterpreterEligible();
  const slot = await deleteSlot(me.id, slotId);
  revalidatePath("/interpreter/availability");
  revalidatePath("/admin/availability");
  return { ok: true };
}

export async function clearDayAction(date: string) {
  const me = await requireInterpreterEligible();
  await clearDay(me.id, date);
  revalidatePath("/interpreter/availability");
  revalidatePath("/admin/availability");
  return { ok: true };
}

export async function applyTemplateAction(input: {
  templateId: string;
  startDate: string;
  endDate: string;
  timezone: string;
}) {
  const me = await requireInterpreterEligible();
  const result = await applyTemplate(
    me.id,
    input.templateId,
    input.startDate,
    input.endDate,
    input.timezone
  );
  revalidatePath("/interpreter/availability");
  revalidatePath("/admin/availability");
  return { ok: true, created: result.created };
}

export async function saveTemplateAction(input: {
  id?: string | null;
  name: string;
  timezone: string;
  days: { weekday: number; startMin: number; endMin: number }[];
}) {
  const me = await requireInterpreterEligible();
  const t = await saveTemplate(me.id, input);
  revalidatePath("/interpreter/availability");
  return { ok: true, id: t.id };
}

export async function deleteTemplateAction(templateId: string) {
  const me = await requireInterpreterEligible();
  await deleteTemplate(me.id, templateId);
  revalidatePath("/interpreter/availability");
  return { ok: true };
}