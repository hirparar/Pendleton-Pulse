// app/interpreter/availability/ui.tsx
"use client";

import { useMemo, useState, useTransition, useCallback } from "react";
import { toast } from "sonner";
import {
  upsertSlotAction,
  deleteSlotAction,
  clearDayAction,
  applyTemplateAction,
  saveTemplateAction,
  deleteTemplateAction,
  getSlotsForDateAction,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { minToHHMM, HHMMtoMin } from "@/lib/availability/service";
import { Loader2, Plus, X, Clock, Calendar } from "lucide-react";

// ─── types ────────────────────────────────────────────────────────────────────

type Slot = {
  id: string;
  date: string; // YYYY-MM-DD
  startMin: number;
  endMin: number;
  timezone: string;
  note: string | null;
  templateId: string | null;
};

type Template = {
  id: string;
  name: string;
  timezone: string;
  days: { weekday: number; startMin: number; endMin: number }[];
};

type UpcomingJob = {
  id: string;
  title: string;
  clientName: string;
  scheduledStart: string;
  scheduledEnd: string;
  assignmentType: string;
  languagePair: string;
  location: string;
};

type Props = {
  userProfileId: string;
  timezone: string;
  initialSlots: Slot[];
  initialTemplates: Template[];
  upcomingJobs: UpcomingJob[];
};

// ─── constants ────────────────────────────────────────────────────────────────

const WEEKDAYS_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ─── utilities ────────────────────────────────────────────────────────────────

function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYMD(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(0);
  date.setFullYear(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isSameYMD(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function isPast(d: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

function isToday(d: Date): boolean {
  return isSameYMD(d, new Date());
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatJobTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ─── calendar grid helpers ────────────────────────────────────────────────────

/** Returns array of Date objects for a 6-week calendar grid for the given month. */
function getCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay(); // 0=Sun
  const start = addDays(firstDay, -startOffset);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) days.push(addDays(start, i));
  return days;
}

// ─── sub-components ───────────────────────────────────────────────────────────

function SlotPill({
  slot,
  onDelete,
  disabled,
}: {
  slot: Pick<Slot, "id" | "startMin" | "endMin">;
  onDelete: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="group flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 text-xs font-medium text-emerald-800">
      <span>{minToHHMM(slot.startMin)}–{minToHHMM(slot.endMin)}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onDelete(slot.id)}
        className="opacity-0 group-hover:opacity-100 text-emerald-600 hover:text-rose-500 transition-all ml-0.5"
        aria-label="Remove slot"
      >
        ×
      </button>
    </div>
  );
}

function TimeInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
        {label}
      </label>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:ring-2 focus:ring-zinc-950/20 disabled:opacity-50"
      />
    </div>
  );
}

// ─── Day Detail Panel (shown when a day is selected) ─────────────────────────

function DayPanel({
  date,
  dateStr,
  slots,
  timezone,
  onAddSlot,
  onDeleteSlot,
  onClearDay,
  isPending,
}: {
  date: Date;
  dateStr: string;
  slots: Slot[];
  timezone: string;
  onAddSlot: (startMin: number, endMin: number) => void;
  onDeleteSlot: (id: string, dateStr: string) => void;
  onClearDay: () => void;
  isPending: boolean;
}) {
  const [startHHMM, setStartHHMM] = useState("09:00");
  const [endHHMM, setEndHHMM] = useState("17:00");
  const past = isPast(date);

  function handleAdd() {
    try {
      const s = HHMMtoMin(startHHMM);
      const e = HHMMtoMin(endHHMM);
      if (e <= s) { toast.error("End time must be after start time"); return; }
      onAddSlot(s, e);
    } catch {
      toast.error("Invalid time format");
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-base font-semibold text-zinc-950">
            {WEEKDAYS_LONG[date.getDay()]}, {MONTHS[date.getMonth()]} {date.getDate()}
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">{timezone}</div>
        </div>
        {slots.length > 0 && !past && (
          <button
            type="button"
            disabled={isPending}
            onClick={onClearDay}
            className="text-xs text-rose-500 hover:text-rose-600 transition-colors font-medium"
          >
            Clear day
          </button>
        )}
      </div>

      {/* Existing slots */}
      <div className="flex-1 overflow-auto space-y-2 mb-4">
        {slots.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-400">
            {past ? "No availability was set." : "No availability set. Add a time window below."}
          </div>
        ) : (
          slots.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3"
            >
              <span className="text-sm font-medium text-zinc-950">
                {minToHHMM(s.startMin)} – {minToHHMM(s.endMin)}
              </span>
              {!past && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => onDeleteSlot(s.id, dateStr)}
                  className="text-xs text-zinc-400 hover:text-rose-500 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add window */}
      {!past && (
        <div className="border-t border-zinc-100 pt-4 space-y-3">
          <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Add time window
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TimeInput label="From" value={startHHMM} onChange={setStartHHMM} disabled={isPending} />
            <TimeInput label="To" value={endHHMM} onChange={setEndHHMM} disabled={isPending} />
          </div>
          <button
            type="button"
            className="flex w-full h-10 items-center justify-center gap-2 rounded-xl bg-zinc-950 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
            onClick={handleAdd}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {isPending ? "Saving…" : "Add window"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Template Editor Dialog ───────────────────────────────────────────────────

function TemplateEditor({
  initial,
  timezone,
  onSave,
  onClose,
}: {
  initial: Template | null;
  timezone: string;
  onSave: (t: Omit<Template, "id"> & { id?: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [days, setDays] = useState<Template["days"]>(initial?.days ?? []);
  const [selectedDay, setSelectedDay] = useState(1);
  const [startHHMM, setStartHHMM] = useState("09:00");
  const [endHHMM, setEndHHMM] = useState("17:00");
  const [isPending, startTransition] = useTransition();

  function overlaps(a: { startMin: number; endMin: number }, b: { startMin: number; endMin: number }) {
    return a.startMin < b.endMin && b.startMin < a.endMin;
  }

  function addDay() {
    try {
      const s = HHMMtoMin(startHHMM);
      const e = HHMMtoMin(endHHMM);

      if (e <= s) {
        toast.error("End must be after start");
        return;
      }

      const newWindow = { weekday: selectedDay, startMin: s, endMin: e };

      const exactExists = days.some(
        (d) =>
          d.weekday === newWindow.weekday &&
          d.startMin === newWindow.startMin &&
          d.endMin === newWindow.endMin
      );
      if (exactExists) {
        toast.error("That window already exists in this template");
        return;
      }

      const overlapExists = days.some(
        (d) => d.weekday === newWindow.weekday && overlaps(d, newWindow)
      );
      if (overlapExists) {
        toast.error("This window overlaps an existing window for that day");
        return;
      }

      setDays((prev) => [...prev, newWindow]);
    } catch {
      toast.error("Invalid time");
    }
  }

  function removeDayByOriginalIndex(idx: number) {
    setDays((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (days.length === 0) {
      toast.error("Add at least one time window");
      return;
    }

    startTransition(async () => {
      await onSave({ id: initial?.id, name, timezone, days });
    });
  }

  const sortedDays = days
    .map((d, originalIndex) => ({ ...d, originalIndex }))
    .sort((a, b) => a.weekday - b.weekday || a.startMin - b.startMin);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          Template name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Standard Week, Hospital Hours"
          className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-950/20"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          Add window
        </label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {WEEKDAYS_SHORT.map((d, i) => (
            <button
              key={d}
              type="button"
              onClick={() => setSelectedDay(i)}
              className={[
                "h-9 w-10 rounded-lg text-sm font-medium transition-colors",
                selectedDay === i
                  ? "bg-zinc-950 text-white"
                  : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
              ].join(" ")}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-end gap-2">
          <div className="flex-1">
            <TimeInput label="From" value={startHHMM} onChange={setStartHHMM} />
          </div>
          <div className="flex-1">
            <TimeInput label="To" value={endHHMM} onChange={setEndHHMM} />
          </div>
          <Button variant="secondary" className="h-10 rounded-xl" onClick={addDay}>
            Add
          </Button>
        </div>
      </div>

      <div className="space-y-1.5 max-h-48 overflow-auto">
        {sortedDays.length === 0 ? (
          <div className="text-sm text-zinc-400 py-2">No windows yet.</div>
        ) : (
          sortedDays.map((d) => (
            <div
              key={`${d.originalIndex}-${d.weekday}-${d.startMin}-${d.endMin}`}
              className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-2.5"
            >
              <span className="text-sm font-medium text-zinc-950">
                {WEEKDAYS_LONG[d.weekday]} · {minToHHMM(d.startMin)}–{minToHHMM(d.endMin)}
              </span>
              <button
                type="button"
                onClick={() => removeDayByOriginalIndex(d.originalIndex)}
                className="text-xs text-zinc-400 hover:text-rose-500"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2 pt-2 border-t border-zinc-100">
        <Button variant="secondary" className="flex-1 h-11 rounded-xl" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button
          className="flex-1 h-11 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800"
          onClick={handleSave}
          disabled={isPending}
        >
          {isPending ? "Saving…" : "Save template"}
        </Button>
      </div>
    </div>
  );
}

// ─── Apply Template Dialog ────────────────────────────────────────────────────

function ApplyTemplateDialog({
  templates,
  timezone,
  onApply,
  onClose,
}: {
  templates: Template[];
  timezone: string;
  onApply: (id: string, start: string, end: string) => Promise<void>;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? "");
  const today = formatYMD(new Date());
  const twoWeeks = formatYMD(addDays(new Date(), 14));
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(twoWeeks);
  const [isPending, startTransition] = useTransition();

  async function handleApply() {
    if (!selectedId) { toast.error("Select a template"); return; }
    startTransition(async () => {
      await onApply(selectedId, startDate, endDate);
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          Template
        </label>
        <div className="mt-2 space-y-1.5">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedId(t.id)}
              className={[
                "w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors",
                selectedId === t.id
                  ? "border-zinc-950 bg-zinc-950 text-white"
                  : "border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-50",
              ].join(" ")}
            >
              {t.name}
              <span className="ml-2 text-[11px] opacity-60">
                {t.days.length} windows
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Start date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-2 h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-950/20"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">End date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-2 h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-950/20"
          />
        </div>
      </div>

      <p className="text-xs text-zinc-500">
        Slots will be added to each matching weekday in the range. Existing slots are kept.
      </p>

      <div className="flex gap-2 pt-2 border-t border-zinc-100">
        <Button variant="secondary" className="flex-1 h-11 rounded-xl" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button
          className="flex-1 h-11 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800"
          onClick={handleApply}
          disabled={isPending || !selectedId}
        >
          {isPending ? "Applying…" : "Apply template"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AvailabilityManager({
  userProfileId,
  timezone,
  initialSlots,
  initialTemplates,
  upcomingJobs,
}: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);

  // Calendar state
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(today);

  // Dialogs
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [applyTemplateOpen, setApplyTemplateOpen] = useState(false);

  const [isPending, startTransition] = useTransition();

  // Slot lookup by date
  const slotsByDate = useMemo(() => {
    const m: Record<string, Slot[]> = {};
    for (const s of slots) {
      if (!m[s.date]) m[s.date] = [];
      m[s.date].push(s);
    }
    return m;
  }, [slots]);

  const calDays = useMemo(() => getCalendarDays(calYear, calMonth), [calYear, calMonth]);

  const selectedDateStr = selectedDate ? formatYMD(selectedDate) : null;
  const selectedSlots = selectedDateStr ? (slotsByDate[selectedDateStr] ?? []) : [];

  // ── mutations ─────────────────────────────────────────────────────────────

  const handleAddSlot = useCallback(
    (startMin: number, endMin: number) => {
      if (!selectedDate) return;
      const dateStr = formatYMD(selectedDate);
      const existing = slotsByDate[dateStr] ?? [];

      const exactExists = existing.some(
        (s) => s.startMin === startMin && s.endMin === endMin
      );
      if (exactExists) {
        toast.error("That slot already exists");
        return;
      }

      const overlapExists = existing.some(
        (s) => startMin < s.endMin && s.startMin < endMin
      );
      if (overlapExists) {
        toast.error("This window overlaps an existing slot");
        return;
      }

      startTransition(async () => {
        try {
          const res = await upsertSlotAction({ date: dateStr, startMin, endMin, timezone });
          setSlots((prev) => [
            ...prev.filter((s) => s.date !== dateStr),
            ...res.slots,
          ]);
          toast.success("Slot added");
        } catch (e: any) {
          toast.error(e?.message ?? "Failed to add slot");
        }
      });
    },
    [selectedDate, timezone, slotsByDate]
  );

  const handleDeleteSlot = useCallback((slotId: string, dateStr: string) => {
    startTransition(async () => {
      try {
        await deleteSlotAction(slotId);
        // Re-fetch this date from the DB so client state exactly matches reality
        const fresh = await getSlotsForDateAction(dateStr);
        setSlots((prev) => [
          ...prev.filter((s) => s.date !== dateStr),
          ...fresh,
        ]);
        toast.success("Slot removed");
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to remove slot");
      }
    });
  }, []);

  const handleClearDay = useCallback(() => {
    if (!selectedDate) return;
    const dateStr = formatYMD(selectedDate);
    startTransition(async () => {
      try {
        await clearDayAction(dateStr);
        setSlots((prev) => prev.filter((s) => s.date !== dateStr));
        toast.success("Day cleared");
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to clear day");
      }
    });
  }, [selectedDate]);

  const handleSaveTemplate = async (t: Omit<Template, "id"> & { id?: string }) => {
    try {
      const res = await saveTemplateAction(t);
      if (t.id) {
        setTemplates((prev) => prev.map((x) => (x.id === t.id ? { ...x, ...t, id: x.id } : x)));
      } else {
        setTemplates((prev) => [
          { id: res.id, name: t.name, timezone: t.timezone, days: t.days },
          ...prev,
        ]);
      }
      toast.success("Template saved");
      setTemplateEditorOpen(false);
      setEditingTemplate(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save template");
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await deleteTemplateAction(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Template deleted");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete template");
    }
  };

  const handleApplyTemplate = async (templateId: string, startDate: string, endDate: string) => {
    try {
      const res = await applyTemplateAction({ templateId, startDate, endDate, timezone });
      toast.success(`Applied — ${res.created} slots created`);
      setApplyTemplateOpen(false);
      // Reload page to get fresh slots (server revalidates)
      window.location.reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to apply template");
    }
  };

  // ── nav ───────────────────────────────────────────────────────────────────

  function prevMonth() {
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); }
    else setCalMonth((m) => m - 1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); }
    else setCalMonth((m) => m + 1);
  }

  // ── total slots this month for the header badge ────────────────────────────
  const totalThisMonth = useMemo(() => {
    return calDays.filter((d) => d.getMonth() === calMonth).reduce(
      (acc, d) => acc + (slotsByDate[formatYMD(d)]?.length ?? 0), 0
    );
  }, [calDays, calMonth, slotsByDate]);

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* ── Left: Calendar + Templates ──────────────────────────────────────── */}
      <div className="lg:col-span-7 space-y-4">
        {/* Calendar Card */}
        <div className="rounded-3xl border border-zinc-200 bg-white overflow-hidden">
          {/* Month nav */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
            <button
              type="button"
              onClick={prevMonth}
              className="h-8 w-8 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 transition-colors"
            >
              ‹
            </button>
            <div className="text-center">
              <div className="text-base font-semibold text-zinc-950">
                {MONTHS[calMonth]} {calYear}
              </div>
              <div className="text-xs text-zinc-400 mt-0.5">
                {totalThisMonth} slot{totalThisMonth !== 1 ? "s" : ""} this month
              </div>
            </div>
            <button
              type="button"
              onClick={nextMonth}
              className="h-8 w-8 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 transition-colors"
            >
              ›
            </button>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 border-b border-zinc-100">
            {WEEKDAYS_SHORT.map((d) => (
              <div
                key={d}
                className="py-2 text-center text-[11px] font-medium text-zinc-400 uppercase tracking-wider"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7">
            {calDays.map((day, i) => {
              const dateStr = formatYMD(day);
              const daySlots = slotsByDate[dateStr] ?? [];
              const isCurrentMonth = day.getMonth() === calMonth;
              const isSel = selectedDate ? isSameYMD(day, selectedDate) : false;
              const past = isPast(day);
              const todayDay = isToday(day);

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedDate(day)}
                  className={[
                    "relative flex flex-col items-start p-2 min-h-[72px] border-b border-r border-zinc-100 transition-colors text-left",
                    !isCurrentMonth ? "opacity-30" : "",
                    past && isCurrentMonth ? "bg-zinc-50/50" : "",
                    isSel
                      ? "bg-zinc-950"
                      : "hover:bg-zinc-50",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "text-xs font-medium mb-1",
                      isSel
                        ? "text-white"
                        : todayDay
                          ? "text-sky-600 font-bold"
                          : past
                            ? "text-zinc-300"
                            : "text-zinc-700",
                    ].join(" ")}
                  >
                    {day.getDate()}
                  </span>

                  {/* Slot count indicator */}
                  {daySlots.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 mt-auto">
                      {daySlots.slice(0, 3).map((s, si) => (
                        <div
                          key={si}
                          className={[
                            "h-1.5 w-1.5 rounded-full",
                            isSel ? "bg-emerald-400" : "bg-emerald-500",
                          ].join(" ")}
                        />
                      ))}
                      {daySlots.length > 3 && (
                        <span className={`text-[9px] font-bold ${isSel ? "text-emerald-400" : "text-emerald-600"}`}>
                          +{daySlots.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Templates Card */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold text-zinc-950">Weekly templates</div>
              <div className="text-xs text-zinc-500 mt-0.5">
                Save recurring patterns and apply to any date range
              </div>
            </div>
            <div className="flex items-center gap-2">
              {templates.length > 0 && (
                <Button
                  variant="secondary"
                  className="h-9 rounded-xl text-xs"
                  onClick={() => setApplyTemplateOpen(true)}
                >
                  Apply template
                </Button>
              )}
              <Button
                className="h-9 rounded-xl bg-zinc-950 text-white text-xs hover:bg-zinc-800"
                onClick={() => { setEditingTemplate(null); setTemplateEditorOpen(true); }}
              >
                New template
              </Button>
            </div>
          </div>

          {templates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-400">
              No templates yet. Create one to quickly fill your schedule.
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-medium text-zinc-950">{t.name}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      {t.days
                        .slice()
                        .sort((a, b) => a.weekday - b.weekday)
                        .map((d) => WEEKDAYS_SHORT[d.weekday])
                        .join(", ")}{" "}
                      · {t.days.length} window{t.days.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setEditingTemplate(t); setTemplateEditorOpen(true); }}
                      className="text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(t.id)}
                      className="text-xs text-zinc-400 hover:text-rose-500 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Day panel + Upcoming ─────────────────────────────────────── */}
      <div className="lg:col-span-5 space-y-4">
        {/* Day panel */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 min-h-[340px] flex flex-col">
          {selectedDate ? (
            <DayPanel
              date={selectedDate}
              dateStr={selectedDateStr!}
              slots={selectedSlots}
              timezone={timezone}
              onAddSlot={handleAddSlot}
              onDeleteSlot={handleDeleteSlot}
              onClearDay={handleClearDay}
              isPending={isPending}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-zinc-400">
              Select a day on the calendar to manage availability
            </div>
          )}
        </div>

        {/* Upcoming commitments */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold text-zinc-950">Upcoming commitments</div>
            <Badge variant="secondary" className="rounded-full">{upcomingJobs.length}</Badge>
          </div>

          {upcomingJobs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-5 text-center text-sm text-zinc-400">
              No assignments scheduled yet.
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingJobs.map((j) => (
                <div
                  key={j.id}
                  className="rounded-xl border border-zinc-100 bg-zinc-50 p-3"
                >
                  <div className="font-medium text-sm text-zinc-950">{j.title}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {j.languagePair} · {j.assignmentType}
                  </div>
                  <div className="text-xs text-zinc-600 mt-1.5">
                    {formatJobTime(j.scheduledStart)} → {formatJobTime(j.scheduledEnd)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Template editor dialog */}
      <Dialog open={templateEditorOpen} onOpenChange={setTemplateEditorOpen}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit template" : "New weekly template"}</DialogTitle>
            <DialogDescription>
              Define recurring time windows by weekday. Apply the template to any date range.
            </DialogDescription>
          </DialogHeader>
          <TemplateEditor
            initial={editingTemplate}
            timezone={timezone}
            onSave={handleSaveTemplate}
            onClose={() => { setTemplateEditorOpen(false); setEditingTemplate(null); }}
          />
        </DialogContent>
      </Dialog>

      {/* Apply template dialog */}
      <Dialog open={applyTemplateOpen} onOpenChange={setApplyTemplateOpen}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle>Apply template to date range</DialogTitle>
            <DialogDescription>
              Choose a template and a date range. Slots are created additively — existing slots won't be deleted.
            </DialogDescription>
          </DialogHeader>
          <ApplyTemplateDialog
            templates={templates}
            timezone={timezone}
            onApply={handleApplyTemplate}
            onClose={() => setApplyTemplateOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}