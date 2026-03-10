"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  updateAssignmentAction,
  setStatusAction,
  setVisibilityAction,
  assignInterpreterAction,
  removeInterpreterAction,
} from "./actions";

// ─── Constants & types ────────────────────────────────────────────────────────

type Status = "OPEN" | "ASSIGNED" | "COMPLETED" | "CANCELLED";
type DeliveryMode = "IN_PERSON" | "REMOTE" | "VIDEO_RELAY" | "VIDEO_REMOTE";

const DELIVERY_LABELS: Record<string, string> = {
  IN_PERSON: "In-person",
  REMOTE: "Remote (phone)",
  VIDEO_RELAY: "Video relay (VRS)",
  VIDEO_REMOTE: "Video remote (VRI)",
};
const DELIVERY_MODES = ["IN_PERSON", "REMOTE", "VIDEO_RELAY", "VIDEO_REMOTE"] as const;

const ASSIGNMENT_TYPES = [
  "Medical", "Legal / Court", "Mental health", "Educational",
  "Conference", "Corporate", "Government", "Community", "Other",
] as const;

const COMP_UNITS = ["per hour", "flat rate", "per day", "per session"] as const;

// Common IANA timezones
const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver",
  "America/Phoenix", "America/Los_Angeles", "America/Anchorage",
  "America/Adak", "Pacific/Honolulu",
  "America/Halifax", "America/Toronto", "America/Winnipeg",
  "America/Edmonton", "America/Vancouver", "America/St_Johns",
  "Europe/London", "Europe/Dublin", "Europe/Lisbon",
  "Europe/Paris", "Europe/Berlin", "Europe/Rome", "Europe/Madrid",
  "Europe/Amsterdam", "Europe/Brussels", "Europe/Stockholm",
  "Europe/Warsaw", "Europe/Prague", "Europe/Vienna",
  "Europe/Helsinki", "Europe/Athens", "Europe/Moscow",
  "Asia/Dubai", "Asia/Kolkata", "Asia/Colombo",
  "Asia/Dhaka", "Asia/Bangkok", "Asia/Singapore",
  "Asia/Hong_Kong", "Asia/Shanghai", "Asia/Tokyo",
  "Asia/Seoul", "Australia/Sydney", "Australia/Melbourne",
  "Australia/Brisbane", "Australia/Perth", "Pacific/Auckland",
  "UTC",
] as const;

type AssignedInterpreter = {
  linkId: string; userProfileId: string; status: "ASSIGNED" | "REMOVED";
  assignedAt: string; removedAt: string | null; note: string | null;
  label: string; email: string | null; location: string | null;
  languages: string[]; certifications: string[]; experienceYears: number | null;
};
type EligibleInterpreter = {
  id: string; label: string; email: string | null; location: string | null;
  languages: string[]; certifications: string[]; experienceYears: number | null;
  preferredModes: string[];
};
type AuditEvent = {
  id: string; action: string; actor: string | null; note: string | null; createdAt: string;
};
type Assignment = {
  id: string; title: string; clientName: string; clientOrganization: string | null;
  languagePair: string; assignmentType: string; deliveryMode: string; location: string;
  address: string | null; roomFloor: string | null; dresscode: string | null;
  parkingNotes: string | null; accessInstructions: string | null; meetingLink: string | null;
  meetingPassword: string | null; platformNotes: string | null;
  scheduledStart: string; scheduledEnd: string; timezone: string;
  interpretersNeeded: number; isUrgent: boolean;
  specialNotes: string | null; internalNotes: string | null;
  requiredLanguagePair: string | null; requiredCertifications: string[];
  requiredExperienceYears: number | null; requiredModes: string[];
  compensationRate: number | null; compensationUnit: string | null;
  compensationNotes: string | null; isCompensationVisible: boolean;
  status: Status; visibilityMode: "ALL" | "RESTRICTED";
  assignedCount: number; visibilityAllowedIds: string[];
  assignedInterpreters: AssignedInterpreter[];
};
type Props = {
  assignment: Assignment;
  eligibleInterpreters: EligibleInterpreter[];
  auditEvents: AuditEvent[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}
function fmtShort(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  });
}
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function dur(start: string, end: string) {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const h = Math.floor(diff / 3600000), m = Math.round((diff % 3600000) / 60000);
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
}
function isValidUrl(s: string) {
  try { new URL(s); return true; } catch { return false; }
}

const STATUS_STYLES: Record<Status, string> = {
  OPEN: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
  ASSIGNED: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  COMPLETED: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  CANCELLED: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
};

// ─── Shared primitives ────────────────────────────────────────────────────────

const CLS_INPUT = "w-full bg-white dark:bg-zinc-900 border border-blue-500 rounded-md px-2.5 py-1.5 text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20";
const CLS_INPUT_ERR = "w-full bg-white dark:bg-zinc-900 border border-rose-500 rounded-md px-2.5 py-1.5 text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/20";
const CLS_BTN_SAVE = "rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50";
const CLS_BTN_CANCEL = "rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50";
const CLS_DISPLAY = "group flex items-start gap-2 rounded-md px-2 py-1.5 -mx-2 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 cursor-pointer transition-colors min-h-[32px]";

function SaveCancelRow({ onSave, onCancel, saving }: { onSave: () => void; onCancel: () => void; saving: boolean }) {
  return (
    <div className="flex gap-1.5 mt-1.5">
      <button onClick={onSave} disabled={saving} className={CLS_BTN_SAVE}>{saving ? "Saving…" : "Save"}</button>
      <button onClick={onCancel} disabled={saving} className={CLS_BTN_CANCEL}>Cancel</button>
    </div>
  );
}
function FieldError({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-rose-500">{msg}</p>;
}
function Pencil() {
  return <span className="opacity-0 group-hover:opacity-100 text-xs text-zinc-400 shrink-0 mt-0.5 transition-opacity">✎</span>;
}

// ─── InlineText ───────────────────────────────────────────────────────────────
// Free-text field. `required` prevents blank saves. `maxLength` enforced client-side.

function InlineText({
  value, onSave, placeholder, multiline, mono, required, maxLength,
}: {
  value: string | null; onSave: (v: string | null) => Promise<void>;
  placeholder?: string; multiline?: boolean; mono?: boolean;
  required?: boolean; maxLength?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const ref = useRef<any>(null);

  useEffect(() => { if (editing) { setDraft(value ?? ""); setError(null); ref.current?.focus(); } }, [editing, value]);

  function validate(s: string): string | null {
    if (required && !s.trim()) return "This field is required";
    if (maxLength && s.length > maxLength) return `Max ${maxLength} characters`;
    return null;
  }

  async function commit() {
    const err = validate(draft);
    if (err) { setError(err); return; }
    const next = draft.trim() || null;
    if (next === (value?.trim() || null)) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(next); setEditing(false); }
    catch (e: any) { toast.error(e?.message ?? "Save failed"); }
    finally { setSaving(false); }
  }

  function cancel() { setDraft(value ?? ""); setError(null); setEditing(false); }

  if (!editing) return (
    <div className={CLS_DISPLAY} onClick={() => setEditing(true)}>
      <span className={`flex-1 text-sm ${mono ? "font-mono" : ""} ${!value ? "text-zinc-400 dark:text-zinc-600 italic" : "text-zinc-900 dark:text-zinc-100"}`}>
        {value || placeholder || "Click to edit…"}
      </span>
      <Pencil />
    </div>
  );

  return (
    <div>
      {multiline
        ? <textarea ref={ref} rows={3} value={draft} onChange={e => { setDraft(e.target.value); setError(null); }}
            onKeyDown={e => e.key === "Escape" && cancel()}
            className={`${error ? CLS_INPUT_ERR : CLS_INPUT} resize-none`} />
        : <input ref={ref} value={draft} onChange={e => { setDraft(e.target.value); setError(null); }}
            onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
            className={error ? CLS_INPUT_ERR : CLS_INPUT} />
      }
      <FieldError msg={error} />
      <SaveCancelRow onSave={commit} onCancel={cancel} saving={saving} />
    </div>
  );
}

// ─── InlineUrl ────────────────────────────────────────────────────────────────
// Like InlineText but validates URL format, renders as a clickable link when set.

function InlineUrl({ value, onSave, placeholder }: {
  value: string | null; onSave: (v: string | null) => Promise<void>; placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) { setDraft(value ?? ""); setError(null); ref.current?.focus(); } }, [editing, value]);

  async function commit() {
    const v = draft.trim();
    if (v && !isValidUrl(v)) { setError("Must be a valid URL — include https://"); return; }
    if ((v || null) === (value || null)) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(v || null); setEditing(false); }
    catch (e: any) { toast.error(e?.message ?? "Save failed"); }
    finally { setSaving(false); }
  }

  function cancel() { setDraft(value ?? ""); setError(null); setEditing(false); }

  if (!editing) return (
    <div className={CLS_DISPLAY} onClick={() => setEditing(true)}>
      {value
        ? <a href={value} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
            className="flex-1 text-sm text-blue-600 dark:text-blue-400 underline underline-offset-2 break-all hover:text-blue-700">
            {value} ↗
          </a>
        : <span className="flex-1 text-sm text-zinc-400 italic">{placeholder ?? "None"}</span>
      }
      <Pencil />
    </div>
  );

  return (
    <div>
      <input ref={ref} type="url" value={draft} placeholder="https://…"
        onChange={e => { setDraft(e.target.value); setError(null); }}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
        className={error ? CLS_INPUT_ERR : CLS_INPUT} />
      <FieldError msg={error} />
      <SaveCancelRow onSave={commit} onCancel={cancel} saving={saving} />
    </div>
  );
}

// ─── InlineNumber ─────────────────────────────────────────────────────────────
// Numeric input with enforced min/max/step. `nullable` allows clearing to null.

function InlineNumber({
  value, onSave, placeholder, min, max, step = 1, prefix, suffix, nullable,
}: {
  value: number | null; onSave: (v: number | null) => Promise<void>;
  placeholder?: string; min?: number; max?: number; step?: number;
  prefix?: string; suffix?: string; nullable?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) { setDraft(value != null ? String(value) : ""); setError(null); ref.current?.focus(); } }, [editing, value]);

  function parse(raw: string): { val: number | null; err: string | null } {
    const s = raw.trim();
    if (!s) return nullable ? { val: null, err: null } : { val: null, err: "This field is required" };
    const n = step < 1 ? parseFloat(s) : parseInt(s, 10);
    if (isNaN(n)) return { val: null, err: "Must be a valid number" };
    if (min != null && n < min) return { val: null, err: `Minimum is ${min}` };
    if (max != null && n > max) return { val: null, err: `Maximum is ${max}` };
    return { val: n, err: null };
  }

  async function commit() {
    const { val, err } = parse(draft);
    if (err) { setError(err); return; }
    if (val === value) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(val); setEditing(false); }
    catch (e: any) { toast.error(e?.message ?? "Save failed"); }
    finally { setSaving(false); }
  }

  function cancel() { setDraft(value != null ? String(value) : ""); setError(null); setEditing(false); }

  const display = value != null
    ? `${prefix ?? ""}${step < 1 ? value.toFixed(2) : value}${suffix ? " " + suffix : ""}`
    : null;

  if (!editing) return (
    <div className={CLS_DISPLAY} onClick={() => setEditing(true)}>
      <span className={`flex-1 text-sm ${!display ? "text-zinc-400 italic" : "text-zinc-900 dark:text-zinc-100"}`}>
        {display ?? placeholder ?? "Click to set…"}
      </span>
      <Pencil />
    </div>
  );

  return (
    <div>
      <div className="flex items-center gap-1.5">
        {prefix && <span className="text-sm text-zinc-500 shrink-0">{prefix}</span>}
        <input ref={ref} type="number" value={draft} min={min} max={max} step={step}
          onChange={e => { setDraft(e.target.value); setError(null); }}
          onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
          className={`flex-1 ${error ? CLS_INPUT_ERR : CLS_INPUT}`} />
        {suffix && <span className="text-sm text-zinc-500 shrink-0">{suffix}</span>}
      </div>
      {(min != null || max != null) && (
        <p className="mt-1 text-[11px] text-zinc-400">
          {min != null && max != null ? `Range: ${min}–${max}` : min != null ? `Min: ${min}` : `Max: ${max}`}
          {nullable ? " — leave blank to unset" : ""}
        </p>
      )}
      <FieldError msg={error} />
      <SaveCancelRow onSave={commit} onCancel={cancel} saving={saving} />
    </div>
  );
}

// ─── InlineSelect ─────────────────────────────────────────────────────────────
// Enum dropdown — only values from the options list are ever submitted.

function InlineSelect({ value, options, onSave }: {
  value: string;
  options: readonly { value: string; label: string }[] | { value: string; label: string }[];
  onSave: (v: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const currentLabel = [...options].find(o => o.value === value)?.label ?? value;

  useEffect(() => { if (editing) setDraft(value); }, [editing, value]);

  async function commit() {
    if (draft === value) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(draft); setEditing(false); }
    catch (e: any) { toast.error(e?.message ?? "Save failed"); }
    finally { setSaving(false); }
  }

  if (!editing) return (
    <div className={CLS_DISPLAY} onClick={() => setEditing(true)}>
      <span className="flex-1 text-sm text-zinc-900 dark:text-zinc-100">{currentLabel}</span>
      <Pencil />
    </div>
  );

  return (
    <div>
      <select value={draft} onChange={e => setDraft(e.target.value)} autoFocus className={CLS_INPUT}>
        {[...options].map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <SaveCancelRow onSave={commit} onCancel={() => { setDraft(value); setEditing(false); }} saving={saving} />
    </div>
  );
}

// ─── InlineTimezone ───────────────────────────────────────────────────────────
// Searchable list of IANA timezones. No free-text — must pick from the known list.

function InlineTimezone({ value, onSave }: {
  value: string; onSave: (v: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (editing) { setDraft(value); setQ(""); } }, [editing, value]);

  const filtered = useMemo(() =>
    TIMEZONES.filter(tz => tz.toLowerCase().replace(/_/g, " ").includes(q.toLowerCase())),
    [q]
  );

  async function commit() {
    if (!TIMEZONES.includes(draft as any)) { toast.error("Please select a timezone from the list"); return; }
    if (draft === value) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(draft); setEditing(false); }
    catch (e: any) { toast.error(e?.message ?? "Save failed"); }
    finally { setSaving(false); }
  }

  if (!editing) return (
    <div className={CLS_DISPLAY} onClick={() => setEditing(true)}>
      <span className="flex-1 text-sm font-mono text-zinc-900 dark:text-zinc-100">{value}</span>
      <Pencil />
    </div>
  );

  return (
    <div className="space-y-1.5">
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search timezone…" autoFocus className={CLS_INPUT} />
      <select size={6} value={draft} onChange={e => setDraft(e.target.value)}
        className="w-full bg-white dark:bg-zinc-900 border border-blue-500 rounded-md px-2.5 py-1 text-sm text-zinc-900 dark:text-white outline-none font-mono">
        {filtered.map(tz => <option key={tz} value={tz}>{tz}</option>)}
        {filtered.length === 0 && <option disabled>No match</option>}
      </select>
      <p className="text-[11px] text-zinc-400">Select from list — free text not accepted</p>
      <SaveCancelRow onSave={commit} onCancel={() => { setDraft(value); setEditing(false); }} saving={saving} />
    </div>
  );
}

// ─── InlineDatetime ───────────────────────────────────────────────────────────
// datetime-local input with optional cross-field validation callback.

function InlineDatetime({ value, onSave, validate }: {
  value: string; onSave: (v: string) => Promise<void>;
  validate?: (iso: string) => string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(toLocalInput(value));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (editing) { setDraft(toLocalInput(value)); setError(null); } }, [editing, value]);

  async function commit() {
    const d = new Date(draft);
    if (isNaN(d.getTime())) { setError("Invalid date/time"); return; }
    const cross = validate?.(d.toISOString());
    if (cross) { setError(cross); return; }
    if (draft === toLocalInput(value)) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(d.toISOString()); setEditing(false); }
    catch (e: any) { toast.error(e?.message ?? "Save failed"); }
    finally { setSaving(false); }
  }

  if (!editing) return (
    <div className={CLS_DISPLAY} onClick={() => setEditing(true)}>
      <span className="flex-1 text-sm text-zinc-900 dark:text-zinc-100">{fmt(value)}</span>
      <Pencil />
    </div>
  );

  return (
    <div>
      <input type="datetime-local" value={draft} autoFocus
        onChange={e => { setDraft(e.target.value); setError(null); }}
        onKeyDown={e => e.key === "Escape" && setEditing(false)}
        className={error ? CLS_INPUT_ERR : CLS_INPUT} />
      <FieldError msg={error} />
      <SaveCancelRow onSave={commit} onCancel={() => { setDraft(toLocalInput(value)); setError(null); setEditing(false); }} saving={saving} />
    </div>
  );
}

// ─── InlineToggle ─────────────────────────────────────────────────────────────
// Instant-save boolean toggle — no Save/Cancel, flips on click.

function InlineToggle({ value, labelOn, labelOff, onSave }: {
  value: boolean; labelOn: string; labelOff: string; onSave: (v: boolean) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  async function toggle() {
    setSaving(true);
    try { await onSave(!value); }
    catch (e: any) { toast.error(e?.message ?? "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <button onClick={toggle} disabled={saving}
      className="flex items-center gap-2.5 rounded-md px-2 py-1.5 -mx-2 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors">
      <div className={`relative w-8 h-4 rounded-full transition-colors shrink-0 ${value ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-600"}`}>
        <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${value ? "translate-x-4" : ""}`} />
      </div>
      <span className="text-sm text-zinc-700 dark:text-zinc-300">{value ? labelOn : labelOff}</span>
      {saving && <span className="text-xs text-zinc-400 ml-1">Saving…</span>}
    </button>
  );
}

// ─── InlineTagText ────────────────────────────────────────────────────────────
// Free-text tag list (for certifications which are user-defined strings).
// Tags are uppercased for consistency.

function InlineTagText({ tags, onSave, placeholder }: {
  tags: string[]; onSave: (t: string[]) => Promise<void>; placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>([...tags]);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (editing) { setDraft([...tags]); setInput(""); } }, [editing]);

  function addTag() {
    const t = input.trim().toUpperCase();
    if (!t || draft.some(x => x.toUpperCase() === t)) { setInput(""); return; }
    setDraft([...draft, t]); setInput("");
  }

  async function commit() {
    setSaving(true);
    try { await onSave(draft); setEditing(false); }
    catch (e: any) { toast.error(e?.message ?? "Save failed"); }
    finally { setSaving(false); }
  }

  if (!editing) return (
    <div className="group flex flex-wrap items-center gap-1.5 rounded-md px-2 py-1.5 -mx-2 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 cursor-pointer transition-colors min-h-[32px]"
      onClick={() => setEditing(true)}>
      {tags.length > 0
        ? tags.map(t => <SmallTag key={t}>{t}</SmallTag>)
        : <span className="text-sm text-zinc-400 italic">{placeholder ?? "None"}</span>}
      <Pencil />
    </div>
  );

  return (
    <div className="space-y-2">
      {draft.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {draft.map(t => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
              {t}
              <button onClick={() => setDraft(draft.filter(x => x !== t))}
                className="text-zinc-400 hover:text-rose-500 leading-none ml-0.5">×</button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } if (e.key === "Escape") { setDraft([...tags]); setEditing(false); } }}
          placeholder="Type abbreviation, press Enter (e.g. NIC, RID)"
          className={CLS_INPUT} />
        <button onClick={addTag}
          className="shrink-0 rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">
          Add
        </button>
      </div>
      <SaveCancelRow onSave={commit} onCancel={() => { setDraft([...tags]); setEditing(false); }} saving={saving} />
    </div>
  );
}

// ─── InlineDeliveryModeMulti ──────────────────────────────────────────────────
// Checkbox button-group strictly from the DeliveryMode enum — no free text.

function InlineDeliveryModeMulti({ value, onSave }: {
  value: string[]; onSave: (v: string[]) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>([...value]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (editing) setDraft([...value]); }, [editing]);

  function toggle(mode: string) {
    setDraft(prev => prev.includes(mode) ? prev.filter(x => x !== mode) : [...prev, mode]);
  }

  async function commit() {
    setSaving(true);
    try { await onSave(draft); setEditing(false); }
    catch (e: any) { toast.error(e?.message ?? "Save failed"); }
    finally { setSaving(false); }
  }

  if (!editing) return (
    <div className="group flex flex-wrap items-center gap-1.5 rounded-md px-2 py-1.5 -mx-2 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 cursor-pointer transition-colors min-h-[32px]"
      onClick={() => setEditing(true)}>
      {value.length > 0
        ? value.map(m => <SmallTag key={m}>{DELIVERY_LABELS[m] ?? m}</SmallTag>)
        : <span className="text-sm text-zinc-400 italic">Any</span>}
      <Pencil />
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {DELIVERY_MODES.map(m => {
          const active = draft.includes(m);
          return (
            <button key={m} type="button" onClick={() => toggle(m)}
              className={`h-8 rounded-lg border px-3 text-xs font-medium transition-colors ${
                active
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}>
              {DELIVERY_LABELS[m]}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-zinc-400">Leave empty to accept any modality. Only these 4 modes are valid.</p>
      <SaveCancelRow onSave={commit} onCancel={() => { setDraft([...value]); setEditing(false); }} saving={saving} />
    </div>
  );
}

// ─── Micro components ─────────────────────────────────────────────────────────

function SmallTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
      {children}
    </span>
  );
}

// ─── Layout: Section + Row ────────────────────────────────────────────────────

function Section({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <button onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-6 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors text-left">
        <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">{title}</span>
        <svg className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-6 pb-5 space-y-0.5">{children}</div>}
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-0.5 min-h-[36px]">
      <div className="w-44 shrink-0 pt-2">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
        {hint && <p className="text-[10px] text-zinc-400 leading-tight mt-0.5">{hint}</p>}
      </div>
      <div className="flex-1 min-w-0 pt-0.5">{children}</div>
    </div>
  );
}

// ─── Title editor ─────────────────────────────────────────────────────────────

function TitleEditor({ value, onSave }: { value: string; onSave: (v: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) { setDraft(value); setError(null); ref.current?.focus(); } }, [editing, value]);

  async function commit() {
    if (!draft.trim()) { setError("Title is required"); return; }
    if (draft.trim().length > 200) { setError("Max 200 characters"); return; }
    if (draft.trim() === value.trim()) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(draft.trim()); setEditing(false); }
    catch (e: any) { toast.error(e?.message ?? "Save failed"); }
    finally { setSaving(false); }
  }

  if (!editing) return (
    <div onClick={() => setEditing(true)}
      className="group flex items-start gap-2 cursor-text rounded-lg px-1 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors -mx-1">
      <h1 className="text-2xl font-bold text-zinc-950 dark:text-white tracking-tight leading-tight">{value}</h1>
      <span className="opacity-0 group-hover:opacity-100 mt-1.5 text-sm text-zinc-400 transition-opacity shrink-0">✎</span>
    </div>
  );

  return (
    <div>
      <input ref={ref} value={draft} maxLength={200}
        onChange={e => { setDraft(e.target.value); setError(null); }}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(value); setError(null); setEditing(false); } }}
        className={`w-full bg-white dark:bg-zinc-900 border rounded-lg px-3 py-2 text-2xl font-bold text-zinc-950 dark:text-white outline-none focus:ring-2 tracking-tight ${error ? "border-rose-500 focus:ring-rose-500/20" : "border-blue-500 focus:ring-blue-500/20"}`} />
      <div className="flex items-center justify-between mt-1">
        <FieldError msg={error} />
        <span className="text-[11px] text-zinc-400">{draft.length}/200</span>
      </div>
      <SaveCancelRow onSave={commit} onCancel={() => { setDraft(value); setError(null); setEditing(false); }} saving={saving} />
    </div>
  );
}

// ─── Staffing section ─────────────────────────────────────────────────────────

function StaffingSection({
  assignment, eligibleInterpreters, links, isClosed, isPending, assignedCount, onAssign, onRemove,
}: {
  assignment: Assignment; eligibleInterpreters: EligibleInterpreter[];
  links: AssignedInterpreter[]; isClosed: boolean; isPending: boolean;
  assignedCount: number; onAssign: (id: string) => void; onRemove: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const active = links.filter(l => l.status === "ASSIGNED");
  const removed = links.filter(l => l.status === "REMOVED");
  const assignedIds = new Set(active.map(l => l.userProfileId));
  const isFull = assignedCount >= assignment.interpretersNeeded;

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return eligibleInterpreters
      .filter(i => !assignedIds.has(i.id))
      .filter(i => !q
        || i.label.toLowerCase().includes(q)
        || i.email?.toLowerCase().includes(q)
        || i.location?.toLowerCase().includes(q)
        || i.certifications.some(c => c.toLowerCase().includes(q))
        || i.languages.some(l => l.toLowerCase().includes(q))
      );
  }, [eligibleInterpreters, assignedIds, search]);

  return (
    <div className="space-y-3">
      {active.length > 0 ? (
        <div className="space-y-2">
          {active.map(link => (
            <div key={link.linkId}
              className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/20 px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-zinc-900 dark:text-white">{link.label}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {[link.email, link.location].filter(Boolean).join(" · ")}
                  {link.certifications.length > 0 && ` · ${link.certifications.join(", ")}`}
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">Assigned {fmtShort(link.assignedAt)}</div>
              </div>
              {!isClosed && (
                <button onClick={() => onRemove(link.userProfileId)} disabled={isPending}
                  className="shrink-0 rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 disabled:opacity-50">
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700 px-4 py-6 text-center text-sm text-zinc-400">
          No interpreters assigned yet
        </div>
      )}

      {!isClosed && (
        isFull ? (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-2.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            ✓ Fully staffed — remove an interpreter to free a slot
          </div>
        ) : !showAdd ? (
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors w-full">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Assign interpreter
          </button>
        ) : (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-900 dark:text-white">Assign interpreter</span>
              <button onClick={() => { setShowAdd(false); setSearch(""); }}
                className="text-zinc-400 hover:text-zinc-600 text-xl leading-none">×</button>
            </div>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email, language, certification…"
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-zinc-900 dark:text-white placeholder:text-zinc-400" />
            <div className="max-h-64 space-y-1.5 overflow-auto">
              {candidates.map(i => (
                <div key={i.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-900 dark:text-white truncate">{i.label}</div>
                    <div className="text-xs text-zinc-500 truncate">
                      {[i.email, i.location].filter(Boolean).join(" · ")}
                      {i.certifications.length > 0 && ` · ${i.certifications.join(", ")}`}
                    </div>
                  </div>
                  <button onClick={() => { onAssign(i.id); setShowAdd(false); setSearch(""); }} disabled={isPending}
                    className="shrink-0 rounded-lg bg-zinc-900 dark:bg-white px-3 py-1.5 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-100 disabled:opacity-50">
                    Assign
                  </button>
                </div>
              ))}
              {candidates.length === 0 && (
                <div className="py-6 text-center text-sm text-zinc-400">No interpreters match</div>
              )}
            </div>
          </div>
        )
      )}

      {removed.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 select-none list-none flex items-center gap-1.5">
            <span>▸</span> {removed.length} removed interpreter{removed.length > 1 ? "s" : ""}
          </summary>
          <div className="mt-2 space-y-1.5">
            {removed.map(link => (
              <div key={link.linkId}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 px-3 py-2.5 opacity-70">
                <div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400 line-through">{link.label}</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">Removed {link.removedAt ? fmtShort(link.removedAt) : ""}</div>
                </div>
                {!isClosed && !isFull && (
                  <button onClick={() => onAssign(link.userProfileId)} disabled={isPending}
                    className="shrink-0 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50">
                    Re-assign
                  </button>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ─── Visibility sidebar card ──────────────────────────────────────────────────

function VisibilitySideCard({
  assignmentId, mode: initialMode, allowedIds: initialAllowed,
  interpreters, isPending, auditNote,
}: {
  assignmentId: string; mode: "ALL" | "RESTRICTED"; allowedIds: string[];
  interpreters: EligibleInterpreter[]; isPending: boolean; auditNote: string;
}) {
  const [mode, setMode] = useState<"ALL" | "RESTRICTED">(initialMode);
  const [allowed, setAllowed] = useState<string[]>(initialAllowed);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return interpreters;
    return interpreters.filter(i =>
      i.label.toLowerCase().includes(query) || i.email?.toLowerCase().includes(query)
    );
  }, [interpreters, q]);

  async function save() {
    if (mode === "RESTRICTED" && allowed.length === 0) {
      toast.error("Select at least one interpreter for restricted visibility");
      return;
    }
    setSaving(true);
    try {
      const res = await setVisibilityAction(
        assignmentId, mode, mode === "RESTRICTED" ? allowed : [], auditNote || undefined
      );
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Visibility updated");
      setDirty(false);
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Visibility</span>
      </div>
      <div className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-1.5">
          {(["ALL", "RESTRICTED"] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setDirty(true); }}
              className={`h-9 rounded-xl text-xs font-semibold border transition-colors ${
                mode === m
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                  : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}>
              {m === "ALL" ? "Public feed" : "Restricted"}
            </button>
          ))}
        </div>

        {mode === "RESTRICTED" && (
          <div className="space-y-2">
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filter interpreters…"
              className="w-full text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500 text-zinc-900 dark:text-white placeholder:text-zinc-400" />
            <div className="max-h-44 space-y-0.5 overflow-auto rounded-lg border border-zinc-100 dark:border-zinc-800 p-1.5">
              {filtered.map(i => (
                <label key={i.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <input type="checkbox" checked={allowed.includes(i.id)}
                    onChange={e => {
                      const next = new Set(allowed);
                      if (e.target.checked) next.add(i.id); else next.delete(i.id);
                      setAllowed(Array.from(next)); setDirty(true);
                    }} className="rounded" />
                  <div className="min-w-0">
                    <div className="text-xs text-zinc-900 dark:text-white truncate">{i.label}</div>
                    {i.email && <div className="text-[11px] text-zinc-400 truncate">{i.email}</div>}
                  </div>
                </label>
              ))}
            </div>
            <div className="text-[11px] text-zinc-400">{allowed.length} interpreter{allowed.length !== 1 ? "s" : ""} selected</div>
          </div>
        )}

        <button onClick={save} disabled={saving || isPending || !dirty}
          className="w-full rounded-xl bg-zinc-900 dark:bg-white py-2 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-100 disabled:opacity-40 transition-colors">
          {saving ? "Saving…" : "Save visibility"}
        </button>
      </div>
    </div>
  );
}

// ─── Audit section ────────────────────────────────────────────────────────────

function AuditSection({ auditEvents }: { auditEvents: AuditEvent[] }) {
  if (auditEvents.length === 0) return (
    <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700 px-4 py-8 text-center text-sm text-zinc-400">
      No audit events yet.
    </div>
  );
  return (
    <div>
      {auditEvents.map(e => (
        <div key={e.id} className="flex gap-3 py-2.5 border-b border-zinc-50 dark:border-zinc-800/60 last:border-0">
          <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300">{e.action}</span>
              <span className="text-[11px] text-zinc-400 shrink-0">{fmtShort(e.createdAt)}</span>
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{e.actor ?? "system"}</div>
            {e.note && <div className="text-xs italic text-zinc-400 mt-0.5">"{e.note}"</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export function AssignmentCommandPanel({ assignment, eligibleInterpreters, auditEvents }: Props) {
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState(assignment);
  const [links, setLinks] = useState<AssignedInterpreter[]>(assignment.assignedInterpreters);
  const [serverStatus, setServerStatus] = useState<Status>(assignment.status);
  const [auditNote, setAuditNote] = useState("");

  const activeAssigned = useMemo(() => links.filter(l => l.status === "ASSIGNED"), [links]);
  const assignedCount = activeAssigned.length;
  const isClosed = serverStatus === "COMPLETED" || serverStatus === "CANCELLED";
  const isRemote = ["REMOTE", "VIDEO_RELAY", "VIDEO_REMOTE"].includes(data.deliveryMode);

  // Generic patch — optimistically updates local data, then calls server
  function patch(fields: Record<string, unknown>): Promise<void> {
    return new Promise((resolve, reject) => {
      startTransition(async () => {
        try {
          const res = await updateAssignmentAction(data.id, { ...fields, note: auditNote || undefined });
          if (!res.ok) { toast.error(res.error); reject(new Error(res.error)); return; }
          setData(prev => ({ ...prev, ...fields as any }));
          toast.success("Saved");
          resolve();
        } catch (e: any) { toast.error(e?.message ?? "Failed"); reject(e); }
      });
    });
  }

  function handleAssign(interpreterId: string) {
    startTransition(async () => {
      const res = await assignInterpreterAction(data.id, interpreterId, auditNote || undefined);
      if (!res.ok) { toast.error(res.error); return; }
      const interp = eligibleInterpreters.find(i => i.id === interpreterId);
      setLinks(prev => {
        const existing = prev.find(l => l.userProfileId === interpreterId);
        if (existing) return prev.map(l => l.userProfileId === interpreterId
          ? { ...l, status: "ASSIGNED" as const, removedAt: null, assignedAt: new Date().toISOString() } : l);
        return [...prev, {
          linkId: `tmp-${interpreterId}`, userProfileId: interpreterId, status: "ASSIGNED" as const,
          assignedAt: new Date().toISOString(), removedAt: null, note: null,
          label: interp?.label ?? interpreterId, email: interp?.email ?? null,
          location: interp?.location ?? null, languages: interp?.languages ?? [],
          certifications: interp?.certifications ?? [], experienceYears: interp?.experienceYears ?? null,
        }];
      });
      toast.success("Interpreter assigned");
      setAuditNote("");
    });
  }

  function handleRemove(interpreterId: string) {
    startTransition(async () => {
      const res = await removeInterpreterAction(data.id, interpreterId, auditNote || undefined);
      if (!res.ok) { toast.error(res.error); return; }
      setLinks(prev => prev.map(l => l.userProfileId === interpreterId
        ? { ...l, status: "REMOVED" as const, removedAt: new Date().toISOString() } : l));
      toast.success("Interpreter removed");
      setAuditNote("");
    });
  }

  function handleStatusChange(s: Status) {
    startTransition(async () => {
      const res = await setStatusAction(data.id, s, auditNote || undefined);
      if (!res.ok) { toast.error(res.error); return; }
      setServerStatus(s);
      setData(prev => ({ ...prev, status: s }));
      toast.success(`Status → ${s}`);
      setAuditNote("");
    });
  }

  return (
    <div className="flex gap-6">

      {/* ── MAIN CONTENT ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">

        {/* Title */}
        <div className="mb-5">
          <TitleEditor value={data.title} onSave={v => patch({ title: v })} />

          {/* Meta badges */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[serverStatus]}`}>
              {serverStatus}
            </span>
            {data.isUrgent && (
              <span className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 px-2 py-0.5 text-xs font-bold text-rose-700 dark:text-rose-300">
                🔴 URGENT
              </span>
            )}
            <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${
              assignedCount >= data.interpretersNeeded
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
            }`}>
              {assignedCount}/{data.interpretersNeeded} filled
            </span>
            <span className="inline-flex items-center rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              {DELIVERY_LABELS[data.deliveryMode] ?? data.deliveryMode}
            </span>
            {data.visibilityMode === "RESTRICTED" && (
              <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                🔒 Restricted
              </span>
            )}
            <span className="text-xs text-zinc-400">{dur(data.scheduledStart, data.scheduledEnd)} · {data.timezone}</span>
          </div>
        </div>

        {/* Detail card */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">

          {/* Details */}
          <Section title="Details">
            <Row label="Client name">
              <InlineText value={data.clientName} required maxLength={200}
                onSave={v => patch({ clientName: v })} />
            </Row>
            <Row label="Organization" hint="Optional">
              <InlineText value={data.clientOrganization} placeholder="None"
                onSave={v => patch({ clientOrganization: v })} />
            </Row>
            <Row label="Language pair" hint="e.g. ASL ↔ English">
              <InlineText value={data.languagePair} required maxLength={200}
                onSave={v => patch({ languagePair: v })} />
            </Row>
            <Row label="Assignment type">
              {/* Enum — InlineSelect, only valid ASSIGNMENT_TYPES values */}
              <InlineSelect
                value={data.assignmentType}
                options={ASSIGNMENT_TYPES.map(t => ({ value: t, label: t }))}
                onSave={v => patch({ assignmentType: v })}
              />
            </Row>
            <Row label="Delivery mode">
              {/* Enum — InlineSelect, only valid DeliveryMode values */}
              <InlineSelect
                value={data.deliveryMode}
                options={DELIVERY_MODES.map(m => ({ value: m, label: DELIVERY_LABELS[m] }))}
                onSave={async v => {
                  await patch({ deliveryMode: v });
                  setData(prev => ({ ...prev, deliveryMode: v }));
                }}
              />
            </Row>
            <Row label="Interpreters needed" hint={`Min ${Math.max(1, assignedCount)}, max 50`}>
              {/* Integer with enforced floor = current assigned count */}
              <InlineNumber
                value={data.interpretersNeeded}
                min={Math.max(1, assignedCount)} max={50}
                suffix="interpreter(s)"
                onSave={v => patch({ interpretersNeeded: v })}
              />
            </Row>
            <Row label="Urgent">
              <InlineToggle value={data.isUrgent} labelOn="Yes — marked urgent" labelOff="No"
                onSave={v => patch({ isUrgent: v })} />
            </Row>
          </Section>

          {/* Schedule */}
          <Section title="Schedule">
            <Row label="Start">
              <InlineDatetime value={data.scheduledStart}
                validate={iso => new Date(iso) >= new Date(data.scheduledEnd) ? "Start must be before end" : null}
                onSave={async v => { await patch({ scheduledStart: v }); setData(p => ({ ...p, scheduledStart: v })); }}
              />
            </Row>
            <Row label="End">
              <InlineDatetime value={data.scheduledEnd}
                validate={iso => new Date(iso) <= new Date(data.scheduledStart) ? "End must be after start" : null}
                onSave={async v => { await patch({ scheduledEnd: v }); setData(p => ({ ...p, scheduledEnd: v })); }}
              />
            </Row>
            <Row label="Duration">
              <div className="px-2 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {dur(data.scheduledStart, data.scheduledEnd)}
              </div>
            </Row>
            <Row label="Timezone" hint="IANA — pick from list">
              {/* Searchable IANA dropdown — no free text accepted */}
              <InlineTimezone value={data.timezone}
                onSave={async v => { await patch({ timezone: v }); setData(p => ({ ...p, timezone: v })); }} />
            </Row>
          </Section>

          {/* Location / Remote */}
          <Section title={isRemote ? "Remote details" : "Location & access"}>
            <Row label="Location" hint={isRemote ? "City / region or 'Remote'" : "Venue / facility name"}>
              <InlineText value={data.location} required maxLength={500}
                onSave={v => patch({ location: v })} />
            </Row>

            {!isRemote ? (<>
              <Row label="Street address">
                <InlineText value={data.address} placeholder="None"
                  onSave={v => patch({ address: v })} />
              </Row>
              <Row label="Room / floor">
                <InlineText value={data.roomFloor} placeholder="None"
                  onSave={v => patch({ roomFloor: v })} />
              </Row>
              <Row label="Dress code">
                <InlineText value={data.dresscode} placeholder="None"
                  onSave={v => patch({ dresscode: v })} />
              </Row>
              <Row label="Parking notes">
                <InlineText value={data.parkingNotes} placeholder="None" multiline
                  onSave={v => patch({ parkingNotes: v })} />
              </Row>
              <Row label="Access instructions">
                <InlineText value={data.accessInstructions} placeholder="None" multiline
                  onSave={v => patch({ accessInstructions: v })} />
              </Row>
            </>) : (<>
              <Row label="Meeting link" hint="Must be a valid URL (https://)">
                {/* URL-validated — will reject invalid URLs before saving */}
                <InlineUrl value={data.meetingLink} placeholder="None"
                  onSave={v => patch({ meetingLink: v })} />
              </Row>
              <Row label="Meeting password">
                <InlineText value={data.meetingPassword} placeholder="None" mono
                  onSave={v => patch({ meetingPassword: v })} />
              </Row>
              <Row label="Platform notes">
                <InlineText value={data.platformNotes} placeholder="None" multiline
                  onSave={v => patch({ platformNotes: v })} />
              </Row>
            </>)}
          </Section>

          {/* Requirements */}
          <Section title="Interpreter requirements" defaultOpen={false}>
            <Row label="Language pair" hint="Override — leave blank to use assignment's">
              <InlineText value={data.requiredLanguagePair} placeholder="Same as assignment"
                onSave={v => patch({ requiredLanguagePair: v })} />
            </Row>
            <Row label="Min experience" hint="Integer, 0–50 years. Leave blank for any.">
              {/* Integer 0–50. nullable = can be cleared. */}
              <InlineNumber value={data.requiredExperienceYears} min={0} max={50} nullable
                suffix="years" placeholder="Any"
                onSave={v => patch({ requiredExperienceYears: v })}
              />
            </Row>
            <Row label="Certifications" hint="e.g. NIC, RID, BEI — at least one required">
              {/* Free-text tags for user-defined cert names */}
              <InlineTagText tags={data.requiredCertifications} placeholder="None required"
                onSave={v => patch({ requiredCertifications: v })} />
            </Row>
            <Row label="Required modalities" hint="Only valid delivery mode enum values">
              {/* Checkbox picker — only valid DeliveryMode enum values */}
              <InlineDeliveryModeMulti value={data.requiredModes}
                onSave={v => patch({ requiredModes: v })} />
            </Row>
          </Section>

          {/* Compensation */}
          <Section title="Compensation" defaultOpen={false}>
            <Row label="Rate" hint="Decimal, min $0.00. Leave blank to unset.">
              {/* Float ≥ 0, nullable */}
              <InlineNumber value={data.compensationRate} min={0} max={9999} step={0.01}
                prefix="$" nullable placeholder="Not set"
                onSave={v => patch({ compensationRate: v })}
              />
            </Row>
            <Row label="Unit">
              {/* Enum dropdown — only COMP_UNITS values */}
              <InlineSelect
                value={data.compensationUnit ?? "per hour"}
                options={COMP_UNITS.map(u => ({ value: u, label: u }))}
                onSave={v => patch({ compensationUnit: v })}
              />
            </Row>
            <Row label="Compensation notes">
              <InlineText value={data.compensationNotes} placeholder="None" multiline
                onSave={v => patch({ compensationNotes: v })} />
            </Row>
            <Row label="Visible to interpreters">
              <InlineToggle value={data.isCompensationVisible}
                labelOn="Yes — interpreters can see rate"
                labelOff="No — hidden from interpreters"
                onSave={v => patch({ isCompensationVisible: v })} />
            </Row>
          </Section>

          {/* Notes */}
          <Section title="Notes">
            <Row label="Special notes" hint="Visible to interpreters">
              <InlineText value={data.specialNotes} placeholder="None" multiline maxLength={5000}
                onSave={v => patch({ specialNotes: v })} />
            </Row>
            <Row label="Internal notes" hint="Admin only — never shown to interpreters">
              <div>
                <InlineText value={data.internalNotes} placeholder="None" multiline maxLength={5000}
                  onSave={v => patch({ internalNotes: v })} />
                {data.internalNotes && (
                  <p className="mt-1 text-[11px] text-amber-500 font-medium px-2">⚠ Not shown to interpreters</p>
                )}
              </div>
            </Row>
          </Section>

          {/* Staffing */}
          <Section title={`Staffing — ${assignedCount} of ${data.interpretersNeeded} assigned`}>
            <StaffingSection
              assignment={data} eligibleInterpreters={eligibleInterpreters}
              links={links} isClosed={isClosed} isPending={isPending}
              assignedCount={assignedCount} onAssign={handleAssign} onRemove={handleRemove}
            />
          </Section>

          {/* Audit */}
          <Section title="Audit history" defaultOpen={false}>
            <AuditSection auditEvents={auditEvents} />
          </Section>

        </div>
      </div>

      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <div className="w-72 shrink-0 xl:sticky xl:top-6 self-start space-y-4">

        {isClosed && (
          <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
            serverStatus === "COMPLETED"
              ? "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
              : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300"
          }`}>
            {serverStatus === "COMPLETED" ? "✓ Completed. Staffing locked." : "✕ Cancelled. Staffing locked."}
          </div>
        )}

        {/* Status picker */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Status</span>
          </div>
          <div className="p-3 space-y-1">
            {(["OPEN", "ASSIGNED", "COMPLETED", "CANCELLED"] as const).map(s => (
              <button key={s} onClick={() => handleStatusChange(s)}
                disabled={isPending || s === serverStatus}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all border ${
                  s === serverStatus
                    ? `${STATUS_STYLES[s]} cursor-default`
                    : "border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700"
                } disabled:opacity-60`}>
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                  s === "OPEN" ? "bg-sky-500" : s === "ASSIGNED" ? "bg-emerald-500"
                  : s === "COMPLETED" ? "bg-zinc-400" : "bg-rose-500"
                }`} />
                {s}
                {s === serverStatus && (
                  <svg className="ml-auto w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Visibility */}
        <VisibilitySideCard
          assignmentId={data.id} mode={data.visibilityMode} allowedIds={data.visibilityAllowedIds}
          interpreters={eligibleInterpreters} isPending={isPending} auditNote={auditNote}
        />

        {/* Audit note */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Audit note</div>
            <p className="text-[11px] text-zinc-400 mt-0.5">Attached to your next action</p>
          </div>
          <div className="p-3">
            <textarea value={auditNote} onChange={e => setAuditNote(e.target.value)} rows={2}
              placeholder="Optional note…"
              className="w-full bg-transparent text-sm text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-400 outline-none resize-none" />
          </div>
        </div>

      </div>
    </div>
  );
}