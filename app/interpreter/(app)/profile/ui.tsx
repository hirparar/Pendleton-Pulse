"use client";

import { useMemo, useState, useTransition, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  saveBasicInfoAction,
  saveCredentialsAction,
  savePreferencesAction,
} from "./actions";
import {
  basicInfoSchema,
  credentialsSchema,
  preferencesSchema,
} from "@/lib/validation/interpreter-profile";
import { Loader2, Pencil } from "lucide-react";

// ─── types ─────────────────────────────────────────────────────────────────────

type ProfileData = {
  displayName: string | null;
  phone: string | null;
  location: string | null;
  bio: string | null;
  languages: string[];
  certifications: string[];
  experienceYears: number | null;
  preferredModes: string[];
  timezone: string;
};

type Props = {
  userProfileId: string;
  email: string | null;
  joinedAt: string | null;
  status: string;
  isActive: boolean;
  initial: ProfileData;
};

// ─── constants ──────────────────────────────────────────────────────────────────

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "America/Phoenix", "America/Anchorage",
  "Pacific/Honolulu", "America/Toronto", "America/Vancouver",
  "Europe/London", "Europe/Paris", "Asia/Tokyo",
] as const;

const MODE_OPTIONS = [
  { value: "IN_PERSON",    label: "In-person",         description: "On-site assignments" },
  { value: "REMOTE",       label: "Phone / Remote",     description: "Over-the-phone interpreting" },
] as const;

const TZ_LABELS: Record<string, string> = {
  "America/New_York":   "Eastern (ET)",
  "America/Chicago":    "Central (CT)",
  "America/Denver":     "Mountain (MT)",
  "America/Los_Angeles":"Pacific (PT)",
  "America/Phoenix":    "Arizona (AZ)",
  "America/Anchorage":  "Alaska (AK)",
  "Pacific/Honolulu":   "Hawaii (HT)",
  "America/Toronto":    "Toronto (ET)",
  "America/Vancouver":  "Vancouver (PT)",
  "Europe/London":      "London (GMT)",
  "Europe/Paris":       "Paris (CET)",
  "Asia/Tokyo":         "Tokyo (JST)",
};

// ─── helpers ────────────────────────────────────────────────────────────────────

function shallowEq(a: string[], b: string[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function completenessScore(
  basic: { displayName: string; phone: string; location: string; bio: string; experienceYears: number },
  creds: { languages: string[]; certifications: string[] },
  prefs: { preferredModes: string[] }
) {
  const checks = [
    basic.displayName.trim().length >= 2,
    basic.phone.trim().length > 0,
    basic.location.trim().length >= 2,
    basic.bio.trim().length >= 20,
    basic.experienceYears >= 0,
    creds.languages.length > 0,
    creds.certifications.length > 0,
    prefs.preferredModes.length > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function avatarInitials(name: string, email: string | null) {
  if (name.trim().length >= 2) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return (email ?? "?").slice(0, 2).toUpperCase();
}

// ─── inline field error ──────────────────────────────────────────────────────────

function FieldError({ msg }: { msg: string | null | undefined }) {
  if (!msg) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-600">
      <svg className="h-3 w-3 flex-shrink-0" viewBox="0 0 12 12" fill="currentColor">
        <circle cx="6" cy="6" r="5.5" fill="currentColor" fillOpacity=".15" />
        <path d="M6 3.5v3M6 8.5v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      {msg}
    </p>
  );
}

// ─── input base class ──────────────────────────────────────────────────────────

const inp = (hasError?: boolean) =>
  [
    "block w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-zinc-900",
    "placeholder-zinc-400 outline-none transition-all",
    "focus:ring-4 focus:ring-offset-0",
    hasError
      ? "border-red-300 focus:border-red-400 focus:ring-red-100"
      : "border-zinc-200 focus:border-zinc-400 focus:ring-zinc-100",
  ].join(" ");

// ─── tag pill editor ──────────────────────────────────────────────────────────

function TagEditor({
  tags,
  onChange,
  placeholder,
  error,
  readOnly,
}: {
  tags: string[];
  onChange: (t: string[]) => void;
  placeholder: string;
  error?: string | null;
  readOnly?: boolean;
}) {
  const [val, setVal] = useState("");

  function add() {
    const v = val.trim();
    if (!v || tags.includes(v)) { setVal(""); return; }
    onChange([...tags, v]);
    setVal("");
  }

  if (readOnly) {
    return tags.length > 0 ? (
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
            {t}
          </span>
        ))}
      </div>
    ) : <span className="text-sm text-zinc-400">None added</span>;
  }

  return (
    <div className="space-y-2.5">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
              {t}
              <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))}
                className="text-zinc-400 hover:text-red-500 transition-colors leading-none">
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input value={val} onChange={(e) => setVal(e.target.value)} placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          className={inp(!!error)} />
        <button type="button" onClick={add}
          className="shrink-0 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors">
          Add
        </button>
      </div>
      <FieldError msg={error} />
    </div>
  );
}

// ─── view row — label / value pair used in read-only view ────────────────────

function ViewRow({ label, value, empty = "Not set" }: { label: string; value?: React.ReactNode; empty?: string }) {
  return (
    <div className="py-3.5 flex items-start gap-4 border-b border-zinc-100 last:border-0">
      <span className="w-36 shrink-0 text-xs font-medium text-zinc-500 pt-0.5">{label}</span>
      <span className="flex-1 text-sm text-zinc-900 leading-relaxed">
        {value || <span className="text-zinc-400 italic">{empty}</span>}
      </span>
    </div>
  );
}

// ─── section shell ─────────────────────────────────────────────────────────────
//
//  Renders as a clean card. Has a header with title + "Edit" button.
//  When editing: shows form fields, Cancel + Save in footer.
//  When not editing: shows read-only content.

type SectionState = "idle" | "editing" | "saving";

function SectionCard({
  title,
  badge,
  viewContent,
  editContent,
  onSave,
  canEdit = true,
}: {
  title: string;
  badge?: React.ReactNode;
  viewContent: React.ReactNode;
  editContent: React.ReactNode;
  onSave: () => Promise<boolean>; // returns true on success
  canEdit?: boolean;
}) {
  const [state, setState] = useState<SectionState>("idle");

  async function handleSave() {
    setState("saving");
    const ok = await onSave();
    if (ok) {
      setState("idle");
    } else {
      setState("editing");
    }
  }

  function handleCancel() {
    setState("idle");
  }

  const isEditing = state === "editing" || state === "saving";

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white">
      {/* card header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
          {badge}
        </div>
        {canEdit && !isEditing && (
          <button
            type="button"
            onClick={() => setState("editing")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 transition-colors"
          >
            <Pencil className="size-3" />
            Edit
          </button>
        )}
      </div>

      {/* card body */}
      <div className="px-6 py-1">
        {isEditing ? editContent : viewContent}
      </div>

      {/* edit footer */}
      {isEditing && (
        <div className="flex items-center justify-end gap-3 border-t border-zinc-100 bg-zinc-50/80 px-6 py-4">
          <button
            type="button"
            onClick={handleCancel}
            disabled={state === "saving"}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={state === "saving"}
            className="flex items-center gap-2 rounded-xl bg-zinc-950 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors disabled:opacity-60"
          >
            {state === "saving" ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {state === "saving" ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── main component ────────────────────────────────────────────────────────────

export function ProfileEditor({ email, joinedAt, status, isActive, initial }: Props) {

  // ── Per-section form state ─────────────────────────────────────────────────
  const [basic, setBasic] = useState({
    displayName:     initial.displayName    ?? "",
    phone:           initial.phone          ?? "",
    location:        initial.location       ?? "",
    bio:             initial.bio            ?? "",
    experienceYears: initial.experienceYears ?? 0,
    timezone:        initial.timezone || "America/Toronto",
  });

  const [creds, setCreds] = useState({
    languages:      initial.languages      ?? [],
    certifications: initial.certifications ?? [],
  });

  const [prefs, setPrefs] = useState({
    preferredModes: initial.preferredModes ?? [],
  });

  // ── Per-section live validation errors ────────────────────────────────────
  const [basicErrors,  setBasicErrors]  = useState<Record<string, string | undefined>>({});
  const [credsErrors,  setCredsErrors]  = useState<Record<string, string | undefined>>({});
  const [prefsErrors,  setPrefsErrors]  = useState<Record<string, string | undefined>>({});

  // ── validate on every keystroke, show errors only after first attempted save ─
  const [basicTouched,  setBasicTouched]  = useState(false);
  const [credsTouched,  setCredsTouched]  = useState(false);
  const [prefsTouched,  setPrefsTouched]  = useState(false);

  // Re-validate basic on every change
  useEffect(() => {
    if (!basicTouched) return;
    const r = basicInfoSchema.safeParse({ ...basic });
    if (!r.success) {
      const fe = r.error.flatten().fieldErrors;
      setBasicErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v?.[0]])));
    } else {
      setBasicErrors({});
    }
  }, [basic, basicTouched]);

  useEffect(() => {
    if (!credsTouched) return;
    const r = credentialsSchema.safeParse(creds);
    if (!r.success) {
      const fe = r.error.flatten().fieldErrors;
      setCredsErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v?.[0]])));
    } else {
      setCredsErrors({});
    }
  }, [creds, credsTouched]);

  useEffect(() => {
    if (!prefsTouched) return;
    const r = preferencesSchema.safeParse(prefs);
    if (!r.success) {
      const fe = r.error.flatten().fieldErrors;
      setPrefsErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v?.[0]])));
    } else {
      setPrefsErrors({});
    }
  }, [prefs, prefsTouched]);

  // ── derived ───────────────────────────────────────────────────────────────
  const pct = completenessScore(basic, creds, prefs);

  const statusLabel = !isActive ? "Inactive"
    : status === "APPROVED" ? "Approved"
    : status === "PENDING"  ? "Pending review"
    : "Denied";

  const statusColor = !isActive
    ? "bg-zinc-100 text-zinc-500"
    : status === "APPROVED"
    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
    : status === "PENDING"
    ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
    : "bg-red-50 text-red-700 ring-1 ring-red-200";

  const initials = avatarInitials(basic.displayName, email);

  // ── save handlers ─────────────────────────────────────────────────────────

  async function handleSaveBasic(): Promise<boolean> {
    setBasicTouched(true);
    const parsed = basicInfoSchema.safeParse({ ...basic });
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors;
      setBasicErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v?.[0]])));
      toast.error("Fix the errors before saving");
      return false;
    }
    setBasicErrors({});
    const res = await saveBasicInfoAction(parsed.data);
    if (!res.ok) {
      if (res.errors) {
        setBasicErrors(Object.fromEntries(Object.entries(res.errors).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
      }
      toast.error(res.message);
      return false;
    }
    toast.success("Basic info saved");
    return true;
  }

  async function handleSaveCreds(): Promise<boolean> {
    setCredsTouched(true);
    const parsed = credentialsSchema.safeParse(creds);
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors;
      setCredsErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v?.[0]])));
      toast.error("Fix the errors before saving");
      return false;
    }
    setCredsErrors({});
    const res = await saveCredentialsAction(parsed.data);
    if (!res.ok) {
      toast.error(res.message);
      return false;
    }
    toast.success("Credentials saved");
    return true;
  }

  async function handleSavePrefs(): Promise<boolean> {
    setPrefsTouched(true);
    const parsed = preferencesSchema.safeParse(prefs);
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors;
      setPrefsErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v?.[0]])));
      toast.error("Fix the errors before saving");
      return false;
    }
    setPrefsErrors({});
    const res = await savePreferencesAction(parsed.data);
    if (!res.ok) {
      toast.error(res.message);
      return false;
    }
    toast.success("Preferences saved");
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Hero identity card ─────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900 text-lg font-bold tracking-tight text-white">
                {initials}
              </div>
              {status === "APPROVED" && isActive && (
                <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white bg-emerald-500" />
              )}
            </div>
            {/* name + meta */}
            <div>
              <h1 className="text-lg font-semibold text-zinc-950 leading-tight">
                {basic.displayName || <span className="text-zinc-400 font-normal">No display name</span>}
              </h1>
              <p className="text-sm text-zinc-500 mt-0.5">{email ?? "—"}</p>
              <div className="flex items-center flex-wrap gap-2 mt-2">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor}`}>
                  {statusLabel}
                </span>
                {basic.location && (
                  <span className="flex items-center gap-1 text-xs text-zinc-400">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M8 1.5C5.515 1.5 3.5 3.515 3.5 6c0 3.75 4.5 8.5 4.5 8.5S12.5 9.75 12.5 6c0-2.485-2.015-4.5-4.5-4.5z"/>
                      <circle cx="8" cy="6" r="1.5"/>
                    </svg>
                    {basic.location}
                  </span>
                )}
                {basic.experienceYears > 0 && (
                  <span className="text-xs text-zinc-400">
                    {basic.experienceYears} yr{basic.experienceYears !== 1 ? "s" : ""} exp.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Completeness + join date */}
          <div className="shrink-0 flex flex-col items-start sm:items-end gap-2">
            <div className="flex items-center gap-3">
              <div className="text-xs font-medium text-zinc-500">Profile strength</div>
              <div className="text-sm font-bold text-zinc-900">{pct}%</div>
            </div>
            <div className="w-40 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
              <div
                className={[
                  "h-full rounded-full transition-all duration-700",
                  pct >= 88 ? "bg-emerald-500" : pct >= 60 ? "bg-sky-500" : pct >= 35 ? "bg-amber-500" : "bg-red-400",
                ].join(" ")}
                style={{ width: `${pct}%` }}
              />
            </div>
            {joinedAt && (
              <div className="text-xs text-zinc-400">
                Member since {new Date(joinedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Basic info ─────────────────────────────────────────────────────── */}
      <SectionCard
        title="Basic information"
        onSave={handleSaveBasic}
        viewContent={
          <div className="py-1">
            <ViewRow label="Display name" value={basic.displayName || undefined} />
            <ViewRow label="Phone" value={basic.phone || undefined} />
            <ViewRow label="Location" value={basic.location || undefined} />
            <ViewRow label="Experience"
              value={basic.experienceYears >= 0 ? `${basic.experienceYears} year${basic.experienceYears !== 1 ? "s" : ""}` : undefined}
            />
            <ViewRow label="Timezone" value={TZ_LABELS[basic.timezone] ?? basic.timezone} />
            <ViewRow
              label="Bio"
              value={basic.bio
                ? <span className="whitespace-pre-wrap text-sm text-zinc-700 leading-relaxed">{basic.bio}</span>
                : undefined}
            />
          </div>
        }
        editContent={
          <div className="py-4 grid gap-4 sm:grid-cols-2">
            {/* Display name */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-600 uppercase tracking-wide">
                Display name <span className="text-red-400">*</span>
              </label>
              <input
                value={basic.displayName}
                onChange={(e) => { setBasic((p) => ({ ...p, displayName: e.target.value })); setBasicTouched(true); }}
                placeholder="Your full name"
                className={inp(!!basicErrors.displayName)}
              />
              <FieldError msg={basicErrors.displayName} />
            </div>

            {/* Phone */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-600 uppercase tracking-wide">
                Phone <span className="text-red-400">*</span>
              </label>
              <input
                type="tel"
                value={basic.phone}
                onChange={(e) => { setBasic((p) => ({ ...p, phone: e.target.value })); setBasicTouched(true); }}
                placeholder="+1 416 555 1234"
                className={inp(!!basicErrors.phone)}
              />
              <FieldError msg={basicErrors.phone} />
            </div>

            {/* Location */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-600 uppercase tracking-wide">
                Location <span className="text-red-400">*</span>
              </label>
              <input
                value={basic.location}
                onChange={(e) => { setBasic((p) => ({ ...p, location: e.target.value })); setBasicTouched(true); }}
                placeholder="Toronto, ON"
                className={inp(!!basicErrors.location)}
              />
              <FieldError msg={basicErrors.location} />
            </div>

            {/* Experience */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-600 uppercase tracking-wide">
                Years of experience
              </label>
              <input
                type="number" min={0} max={60}
                value={String(basic.experienceYears)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setBasic((p) => ({ ...p, experienceYears: isNaN(v) ? 0 : v }));
                  setBasicTouched(true);
                }}
                className={inp(!!basicErrors.experienceYears)}
              />
              <FieldError msg={basicErrors.experienceYears} />
            </div>

            {/* Timezone */}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-zinc-600 uppercase tracking-wide">
                Timezone
              </label>
              <select
                value={basic.timezone}
                onChange={(e) => { setBasic((p) => ({ ...p, timezone: e.target.value })); setBasicTouched(true); }}
                className={inp(!!basicErrors.timezone) + " max-w-xs"}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{TZ_LABELS[tz] ?? tz}</option>
                ))}
              </select>
              <FieldError msg={basicErrors.timezone} />
            </div>

            {/* Bio */}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-zinc-600 uppercase tracking-wide">
                Bio <span className="text-red-400">*</span>
                <span className="ml-2 font-normal normal-case text-zinc-400">(min 20 characters)</span>
              </label>
              <textarea
                value={basic.bio}
                onChange={(e) => { setBasic((p) => ({ ...p, bio: e.target.value })); setBasicTouched(true); }}
                rows={4} maxLength={1000}
                placeholder="A short professional summary of your interpreting background and experience…"
                className={inp(!!basicErrors.bio) + " resize-none"}
              />
              <div className="mt-1 flex items-center justify-between">
                <FieldError msg={basicErrors.bio} />
                <span className="ml-auto text-xs text-zinc-400">{basic.bio.length}/1000</span>
              </div>
            </div>
          </div>
        }
      />

      {/* ── Credentials ───────────────────────────────────────────────────── */}
      <SectionCard
        title="Languages & certifications"
        badge={
          (creds.languages.length > 0 || creds.certifications.length > 0) ? (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
              {creds.languages.length + creds.certifications.length} items
            </span>
          ) : undefined
        }
        onSave={handleSaveCreds}
        viewContent={
          <div className="py-1">
            <ViewRow
              label="Language pairs"
              value={
                creds.languages.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {creds.languages.map((l) => (
                      <span key={l} className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-0.5 text-xs font-medium text-zinc-700">
                        {l}
                      </span>
                    ))}
                  </div>
                ) : undefined
              }
            />
            <ViewRow
              label="Certifications"
              value={
                creds.certifications.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {creds.certifications.map((c) => (
                      <span key={c} className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-0.5 text-xs font-medium text-zinc-700">
                        {c}
                      </span>
                    ))}
                  </div>
                ) : undefined
              }
            />
          </div>
        }
        editContent={
          <div className="py-4 space-y-6">
            <div>
              <label className="mb-2 block text-xs font-semibold text-zinc-600 uppercase tracking-wide">
                Language pairs <span className="text-red-400">*</span>
                <span className="ml-2 font-normal normal-case text-zinc-400">e.g. ASL-English, Spanish-English</span>
              </label>
              <TagEditor
                tags={creds.languages}
                onChange={(languages) => { setCreds((p) => ({ ...p, languages })); setCredsTouched(true); }}
                placeholder='e.g. ASL-English'
                error={credsErrors.languages}
              />
            </div>
            <div className="border-t border-zinc-100 pt-5">
              <label className="mb-2 block text-xs font-semibold text-zinc-600 uppercase tracking-wide">
                Certifications
                <span className="ml-2 font-normal normal-case text-zinc-400">e.g. NIC, CDI, RID, CI/CT</span>
              </label>
              <TagEditor
                tags={creds.certifications}
                onChange={(certifications) => { setCreds((p) => ({ ...p, certifications })); setCredsTouched(true); }}
                placeholder='e.g. NIC'
                error={credsErrors.certifications}
              />
            </div>
          </div>
        }
      />

      {/* ── Work preferences ──────────────────────────────────────────────── */}
      <SectionCard
        title="Work preferences"
        badge={
          prefs.preferredModes.length > 0 ? (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
              {prefs.preferredModes.length} selected
            </span>
          ) : undefined
        }
        onSave={handleSavePrefs}
        viewContent={
          <div className="py-1">
            <ViewRow
              label="Modalities"
              value={
                prefs.preferredModes.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {MODE_OPTIONS.filter((m) => prefs.preferredModes.includes(m.value)).map((m) => (
                      <span key={m.value} className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-0.5 text-xs font-medium text-zinc-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                        {m.label}
                      </span>
                    ))}
                  </div>
                ) : undefined
              }
            />
          </div>
        }
        editContent={
          <div className="py-4">
            <div className="grid gap-2.5 sm:grid-cols-2">
              {MODE_OPTIONS.map((m) => {
                const active = prefs.preferredModes.includes(m.value);
                return (
                  <button key={m.value} type="button"
                    onClick={() => {
                      setPrefs((p) => ({
                        preferredModes: active
                          ? p.preferredModes.filter((x) => x !== m.value)
                          : [...p.preferredModes, m.value],
                      }));
                      setPrefsTouched(true);
                    }}
                    className={[
                      "flex items-start gap-3.5 rounded-xl border p-4 text-left transition-all",
                      active
                        ? "border-zinc-900 bg-zinc-950"
                        : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50",
                    ].join(" ")}
                  >
                    <span className={[
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                      active ? "border-white bg-white" : "border-zinc-300",
                    ].join(" ")}>
                      {active && <span className="block h-1.5 w-1.5 rounded-full bg-zinc-900" />}
                    </span>
                    <div>
                      <div className={`text-sm font-semibold leading-tight ${active ? "text-white" : "text-zinc-900"}`}>
                        {m.label}
                      </div>
                      <div className={`mt-0.5 text-xs leading-relaxed ${active ? "text-zinc-400" : "text-zinc-500"}`}>
                        {m.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <FieldError msg={prefsErrors.preferredModes} />
          </div>
        }
      />

    </div>
  );
}