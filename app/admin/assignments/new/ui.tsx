// app/admin/assignments/new/ui.tsx
"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createAssignmentAction } from "./actions";
import {
  Loader2, Building2, Phone, Tv2, Monitor, Save, ArrowRight,
  User, Languages, Calendar, MapPin, Zap, DollarSign, FileText,
  ShieldCheck,
} from "lucide-react";

const DELIVERY_MODES = [
  { value: "IN_PERSON",    label: "In-person",         desc: "On-site at client location",    icon: Building2 },
  { value: "REMOTE",       label: "Phone / Remote",     desc: "Over-the-phone interpreting",   icon: Phone },
] as const;

const ASSIGNMENT_TYPES = [
  "Medical", "Legal / Court", "Mental health", "Educational",
  "Conference", "Corporate", "Government", "Community", "Other",
];

const COMPENSATION_UNITS = ["per hour", "flat rate", "per day", "per session"];

function nowLocalISO() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function offsetISO(hours: number) {
  const d = new Date(); d.setHours(d.getHours() + hours);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── small UI atoms ───────────────────────────────────────────────────────────

const inp = "block w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100";

function FieldGroup({ title, icon: Icon, children }: { title: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white">
      <div className="flex items-center gap-2 border-b border-zinc-100 px-5 py-4">
        {Icon && (
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-zinc-100 ring-1 ring-zinc-200/60">
            <Icon className="size-3.5 text-zinc-600" />
          </div>
        )}
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function F({ label, hint, required, error, children }: {
  label: string; hint?: string; required?: boolean; error?: string | null; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-600">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {hint && <p className="mb-2 text-[11px] text-zinc-400">{hint}</p>}
      {children}
      {error && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

function TagInput({ tags, onChange, placeholder }: {
  tags: string[]; onChange: (t: string[]) => void; placeholder: string;
}) {
  const [val, setVal] = useState("");
  function add() {
    const v = val.trim(); if (!v || tags.includes(v)) { setVal(""); return; }
    onChange([...tags, v]); setVal("");
  }
  return (
    <div className="space-y-2">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
              {t}
              <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))}
                className="text-zinc-400 hover:text-rose-500 transition-colors">×</button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input value={val} onChange={(e) => setVal(e.target.value)} placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          className={inp} />
        <button type="button" onClick={add}
          className="shrink-0 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors">
          Add
        </button>
      </div>
    </div>
  );
}

// ─── main form ────────────────────────────────────────────────────────────────

export function CreateAssignmentForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Core fields
  const [clientName,        setClientName]        = useState("");
  const [clientOrg,         setClientOrg]         = useState("");
  const [languagePair,      setLanguagePair]      = useState("");
  const [assignmentType,    setAssignmentType]    = useState("");
  const [customType,        setCustomType]        = useState("");
  const [deliveryMode,      setDeliveryMode]      = useState<"IN_PERSON"|"REMOTE">("IN_PERSON");

  // ── Scheduling
  const [scheduledStart,    setScheduledStart]    = useState(nowLocalISO());
  const [scheduledEnd,      setScheduledEnd]      = useState(offsetISO(2));
  const [interpretersNeeded,setInterpretersNeeded]= useState("1");
  const [isUrgent,          setIsUrgent]          = useState(false);

  // ── In-person logistics
  const [location,          setLocation]          = useState("");
  const [address,           setAddress]           = useState("");
  const [roomFloor,         setRoomFloor]         = useState("");
  const [dresscode,         setDresscode]         = useState("");
  const [parkingNotes,      setParkingNotes]      = useState("");
  const [accessInstructions,setAccessInstructions]= useState("");

  // ── Remote logistics
  const [meetingLink,       setMeetingLink]       = useState("");
  const [meetingPassword,   setMeetingPassword]   = useState("");
  const [platformNotes,     setPlatformNotes]     = useState("");

  // ── Requirements
  const [reqLanguage,       setReqLanguage]       = useState("");
  const [reqCerts,          setReqCerts]          = useState<string[]>([]);
  const [reqExpYears,       setReqExpYears]       = useState("");
  const [reqModes,          setReqModes]          = useState<string[]>([]);

  // ── Compensation
  const [compRate,          setCompRate]          = useState("");
  const [compUnit,          setCompUnit]          = useState("per hour");
  const [compNotes,         setCompNotes]         = useState("");
  const [compVisible,       setCompVisible]       = useState(true);

  // ── Notes
  const [specialNotes,      setSpecialNotes]      = useState("");
  const [internalNotes,     setInternalNotes]     = useState("");

  const isRemote = ["REMOTE"].includes(deliveryMode);

  const title = useMemo(() => {
    if (clientName && languagePair) return `${clientName} – ${languagePair}`;
    return clientName || "";
  }, [clientName, languagePair]);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!clientName.trim())    e.clientName    = "Required";
    if (!languagePair.trim())  e.languagePair  = "Required";
    if (!assignmentType && !customType.trim()) e.assignmentType = "Required";
    if (!location.trim())      e.location      = "Required";
    const start = new Date(scheduledStart), end = new Date(scheduledEnd);
    if (isNaN(start.getTime())) e.scheduledStart = "Invalid date";
    if (isNaN(end.getTime()))   e.scheduledEnd   = "Invalid date";
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end <= start)
      e.scheduledEnd = "Must be after start time";
    const n = parseInt(interpretersNeeded);
    if (isNaN(n) || n < 1)    e.interpretersNeeded = "Must be at least 1";
    if (isRemote && meetingLink && !meetingLink.startsWith("http"))
      e.meetingLink = "Must be a valid URL";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit(mode: "save" | "view") {
    if (!validate()) { toast.error("Fix the errors before saving"); return; }

    startTransition(async () => {
      try {
        const finalType = assignmentType === "Other" ? customType : assignmentType;
        const res = await createAssignmentAction({
          title,
          clientName,
          clientOrganization: clientOrg || null,
          languagePair,
          assignmentType: finalType,
          deliveryMode,
          scheduledStart: new Date(scheduledStart).toISOString(),
          scheduledEnd:   new Date(scheduledEnd).toISOString(),
          interpretersNeeded,
          isUrgent,
          // location
          location,
          address: address || null,
          roomFloor: roomFloor || null,
          dresscode: dresscode || null,
          parkingNotes: parkingNotes || null,
          accessInstructions: accessInstructions || null,
          // remote
          meetingLink:     meetingLink     || null,
          meetingPassword: meetingPassword || null,
          platformNotes:   platformNotes   || null,
          // requirements
          requiredLanguagePair:    reqLanguage || null,
          requiredCertifications:  reqCerts,
          requiredExperienceYears: reqExpYears ? parseInt(reqExpYears) : null,
          requiredModes:           reqModes,
          // compensation
          compensationRate:      compRate ? parseFloat(compRate) : null,
          compensationUnit:      compRate ? compUnit : null,
          compensationNotes:     compNotes || null,
          isCompensationVisible: compVisible,
          // notes
          specialNotes:  specialNotes  || null,
          internalNotes: internalNotes || null,
        });

        if (!res?.ok) throw new Error("Failed to create");
        toast.success("Assignment created");
        if (mode === "view") router.push(`/admin/assignments/${res.id}`);
        else router.push("/admin/assignments");
      } catch (e: any) {
        toast.error(e?.message ?? "Could not create assignment");
      }
    });
  }

  return (
    <div className="space-y-5">

      {/* Sticky action bar */}
      <div className="sticky top-3 z-20 flex items-center justify-between rounded-xl border border-zinc-200/80 bg-white/95 px-5 py-3.5 shadow-sm backdrop-blur-xl">
        <div>
          <p className="text-sm font-semibold text-zinc-950">
            {title || <span className="font-normal text-zinc-400">New assignment</span>}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">Fields marked * are required</p>
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={isPending} onClick={() => submit("save")}
            className="flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save
          </button>
          <button type="button" disabled={isPending} onClick={() => submit("view")}
            className="flex h-9 items-center gap-2 rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {isPending ? "Saving…" : "Save & open"}
            {!isPending && <ArrowRight className="size-4" />}
          </button>
        </div>
      </div>

      {/* ── Section 1: Client & job identity ──────────────────────────────── */}
      <FieldGroup title="Client & job" icon={User}>
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Client name" required error={errors.clientName}>
            <input value={clientName} onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. St. Mary Hospital" className={inp} />
          </F>
          <F label="Client organization" hint="Department, division, or sub-org (optional)">
            <input value={clientOrg} onChange={(e) => setClientOrg(e.target.value)}
              placeholder="e.g. Emergency Dept." className={inp} />
          </F>
          <F label="Language pair" required error={errors.languagePair}>
            <input value={languagePair} onChange={(e) => setLanguagePair(e.target.value)}
              placeholder="e.g. ASL-English, Spanish-English" className={inp} />
          </F>
          <F label="Assignment type" required error={errors.assignmentType}>
            <select value={assignmentType} onChange={(e) => setAssignmentType(e.target.value)} className={inp}>
              <option value="">Select type…</option>
              {ASSIGNMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {assignmentType === "Other" && (
              <input value={customType} onChange={(e) => setCustomType(e.target.value)}
                placeholder="Describe the type" className={inp + " mt-2"} />
            )}
          </F>
        </div>
      </FieldGroup>

      {/* ── Section 2: Delivery mode ───────────────────────────────────────── */}
      <FieldGroup title="Delivery mode" icon={Building2}>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {DELIVERY_MODES.map((m) => {
            const active = deliveryMode === m.value;
            const ModeIcon = m.icon;
            return (
              <button key={m.value} type="button" onClick={() => setDeliveryMode(m.value)}
                className={[
                  "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all",
                  active
                    ? "border-zinc-900 bg-zinc-900 shadow-sm"
                    : "border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm",
                ].join(" ")}>
                <ModeIcon className={`size-5 ${active ? "text-zinc-300" : "text-zinc-400"}`} />
                <div>
                  <p className={`text-sm font-semibold ${active ? "text-white" : "text-zinc-900"}`}>{m.label}</p>
                  <p className={`text-[11px] leading-tight ${active ? "text-zinc-400" : "text-zinc-500"}`}>{m.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </FieldGroup>

      {/* ── Section 3: Schedule & staffing ────────────────────────────────── */}
      <FieldGroup title="Schedule & staffing" icon={Calendar}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <F label="Start time" required error={errors.scheduledStart}>
            <input type="datetime-local" value={scheduledStart}
              onChange={(e) => setScheduledStart(e.target.value)} className={inp} />
          </F>
          <F label="End time" required error={errors.scheduledEnd}>
            <input type="datetime-local" value={scheduledEnd}
              onChange={(e) => setScheduledEnd(e.target.value)} className={inp} />
          </F>
          <F label="Interpreters needed" hint="Status auto-sets when filled">
            <input type="number" min="1" max="50" value={interpretersNeeded}
              onChange={(e) => setInterpretersNeeded(e.target.value)} className={inp} />
            {errors.interpretersNeeded && <p className="mt-1 text-xs text-rose-500">{errors.interpretersNeeded}</p>}
          </F>
          <F label="Urgency">
            <button type="button" onClick={() => setIsUrgent((v) => !v)}
              className={[
                "flex items-center gap-3 w-full rounded-xl border px-4 py-3 text-left transition-colors",
                isUrgent
                  ? "border-rose-300 bg-rose-50"
                  : "border-zinc-200 bg-white hover:bg-zinc-50",
              ].join(" ")}>
              <span className={`h-4 w-4 rounded border-2 flex items-center justify-center ${isUrgent ? "border-rose-500 bg-rose-500" : "border-zinc-300"}`}>
                {isUrgent && <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
              </span>
              <span className={`text-sm font-medium ${isUrgent ? "text-rose-700" : "text-zinc-700"}`}>
                Mark as urgent
              </span>
            </button>
          </F>
        </div>
      </FieldGroup>

      {/* ── Section 4: Location / Remote ──────────────────────────────────── */}
      {!isRemote ? (
        <FieldGroup title="Location & access" icon={MapPin}>
          <div className="grid gap-4 sm:grid-cols-2">
            <F label="Location name" required error={errors.location}
              hint="Short name shown in listings (e.g. St. Mary Hospital, Room 4B)">
              <input value={location} onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. St. Mary Hospital" className={inp} />
            </F>
            <F label="Full address">
              <input value={address} onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main St, Toronto, ON M5V 1A1" className={inp} />
            </F>
            <F label="Room / floor">
              <input value={roomFloor} onChange={(e) => setRoomFloor(e.target.value)}
                placeholder="e.g. 3rd Floor, Room 4B" className={inp} />
            </F>
            <F label="Dress code">
              <input value={dresscode} onChange={(e) => setDresscode(e.target.value)}
                placeholder="e.g. Business casual, Scrubs not required" className={inp} />
            </F>
            <F label="Parking" hint="Optional parking notes for the interpreter">
              <input value={parkingNotes} onChange={(e) => setParkingNotes(e.target.value)}
                placeholder="e.g. Free visitor parking in lot B" className={inp} />
            </F>
            <F label="Access instructions">
              <input value={accessInstructions} onChange={(e) => setAccessInstructions(e.target.value)}
                placeholder="e.g. Check in at front desk, ask for Dr. Smith" className={inp} />
            </F>
          </div>
        </FieldGroup>
      ) : (
        <FieldGroup title="Remote details" icon={Phone}>
          <div className="grid gap-4 sm:grid-cols-2">
            <F label="Location / description" required error={errors.location}
              hint="Brief descriptor shown in the feed">
              <input value={location} onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Remote – Zoom" className={inp} />
            </F>
            <F label="Meeting link" error={errors.meetingLink}
              hint="Zoom, Teams, or other video URL. Can leave blank and update later.">
              <input value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)}
                placeholder="https://zoom.us/j/..." className={inp} />
            </F>
            <F label="Meeting password">
              <input value={meetingPassword} onChange={(e) => setMeetingPassword(e.target.value)}
                placeholder="Optional password or PIN" className={inp} />
            </F>
            <F label="Platform notes">
              <input value={platformNotes} onChange={(e) => setPlatformNotes(e.target.value)}
                placeholder="e.g. Use Teams desktop app, not browser" className={inp} />
            </F>
          </div>
        </FieldGroup>
      )}

      {/* ── Section 5: Requirements ────────────────────────────────────────── */}
      <FieldGroup title="Interpreter requirements" icon={ShieldCheck}>
        <p className="text-xs text-zinc-500 mb-5">
          All fields are optional. Interpreters who don't meet requirements will see what's blocking them and won't be able to self-pick.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <F label="Required language pair"
            hint="Leave blank to allow any language. If set, interpreter must have an exact match.">
            <input value={reqLanguage} onChange={(e) => setReqLanguage(e.target.value)}
              placeholder="e.g. ASL-English" className={inp} />
          </F>
          <F label="Minimum experience (years)">
            <input type="number" min="0" max="60" value={reqExpYears}
              onChange={(e) => setReqExpYears(e.target.value)}
              placeholder="e.g. 3" className={inp} />
          </F>
          <div className="sm:col-span-2">
            <F label="Required certifications"
              hint="Interpreter must hold at least one. Add each cert separately.">
              <TagInput tags={reqCerts} onChange={setReqCerts} placeholder="e.g. NIC, CDI, RID" />
            </F>
          </div>
          <div className="sm:col-span-2">
            <F label="Required modalities"
              hint="Interpreter must have at least one selected. Leave empty to allow all.">
              <div className="grid gap-2 sm:grid-cols-4">
                {["IN_PERSON","REMOTE"].map((m) => {
                  const label = { IN_PERSON:"In-person", REMOTE:"Remote" }[m] ?? m;
                  const active = reqModes.includes(m);
                  return (
                    <button key={m} type="button"
                      onClick={() => setReqModes((prev) => active ? prev.filter((x) => x !== m) : [...prev, m])}
                      className={[
                        "flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
                      ].join(" ")}>
                      <span className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${active ? "border-white" : "border-zinc-300"}`}>
                        {active && <span className="block h-1.5 w-1.5 rounded-full bg-white" />}
                      </span>
                      {label}
                    </button>
                  );
                })}
              </div>
            </F>
          </div>
        </div>
      </FieldGroup>

      {/* ── Section 6: Compensation ────────────────────────────────────────── */}
      <FieldGroup title="Compensation" icon={DollarSign}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <F label="Rate" hint="Leave blank if undisclosed">
            <div className="flex">
              <span className="inline-flex items-center rounded-l-xl border border-r-0 border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-500">$</span>
              <input type="number" min="0" step="0.01" value={compRate} onChange={(e) => setCompRate(e.target.value)}
                placeholder="45.00" className={inp + " rounded-l-none"} />
            </div>
          </F>
          <F label="Unit">
            <select value={compUnit} onChange={(e) => setCompUnit(e.target.value)} className={inp}>
              {COMPENSATION_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </F>
          <div className="sm:col-span-2">
            <F label="Compensation notes" hint="e.g. Includes 30-min prep, mileage reimbursed">
              <input value={compNotes} onChange={(e) => setCompNotes(e.target.value)}
                placeholder="Additional compensation details" className={inp} />
            </F>
          </div>
        </div>
        <div className="mt-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={compVisible} onChange={(e) => setCompVisible(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300" />
            <span className="text-sm text-zinc-700">
              Show compensation to interpreters in their job feed
            </span>
          </label>
        </div>
      </FieldGroup>

      {/* ── Section 7: Notes ──────────────────────────────────────────────── */}
      <FieldGroup title="Notes" icon={FileText}>
        <div className="grid gap-4">
          <F label="Special notes" hint="Visible to assigned interpreters — access codes, context, etc.">
            <textarea value={specialNotes} onChange={(e) => setSpecialNotes(e.target.value)}
              rows={3} placeholder="Anything the interpreter needs to know on the day…"
              className={inp + " resize-none"} />
          </F>
          <F label="Internal notes" hint="Admin-only — never shown to interpreters">
            <textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)}
              rows={2} placeholder="Internal context, billing info, etc."
              className={inp + " resize-none"} />
          </F>
        </div>
      </FieldGroup>

    </div>
  );
}