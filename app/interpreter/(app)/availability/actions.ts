// app/interpreter/availability/actions.ts
"use server";

import { requireInterpreterEligible } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import {
  upsertSlot,
  deleteSlot,
  applyTemplate,
  clearDay,
  saveTemplate,
  deleteTemplate,
} from "@/lib/availability/service";

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
  return { ok: true };
}

export async function deleteSlotAction(slotId: string) {
  const me = await requireInterpreterEligible();
  await deleteSlot(me.id, slotId);
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