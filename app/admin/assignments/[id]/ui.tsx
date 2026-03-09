// app/admin/assignments/[id]/ui.tsx
"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import {
  updateAssignmentAction, setStatusAction, setVisibilityAction,
  assignInterpreterAction, removeInterpreterAction,
} from "./actions";

type Status = "OPEN" | "ASSIGNED" | "COMPLETED" | "CANCELLED";
type DeliveryMode = "IN_PERSON" | "REMOTE" | "VIDEO_RELAY" | "VIDEO_REMOTE";

const DELIVERY_LABELS: Record<string, string> = {
  IN_PERSON: "In-person", REMOTE: "Remote (phone)",
  VIDEO_RELAY: "Video relay (VRS)", VIDEO_REMOTE: "Video remote (VRI)",
};
const DELIVERY_MODES = ["IN_PERSON","REMOTE","VIDEO_RELAY","VIDEO_REMOTE"] as const;
const ASSIGNMENT_TYPES = ["Medical","Legal / Court","Mental health","Educational","Conference","Corporate","Government","Community","Other"];
const COMP_UNITS = ["per hour","flat rate","per day","per session"];

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── types ────────────────────────────────────────────────────────────────────

type AssignedInterpreter = {
  linkId: string; userProfileId: string;
  status: "ASSIGNED" | "REMOVED";
  assignedAt: string; removedAt: string | null; note: string | null;
  label: string; email: string | null; location: string | null;
  languages: string[]; certifications: string[]; experienceYears: number | null;
};

type EligibleInterpreter = {
  id: string; label: string; email: string | null; location: string | null;
  languages: string[]; certifications: string[];
  experienceYears: number | null; preferredModes: string[];
};

type AuditEvent = { id: string; action: string; actor: string | null; note: string | null; createdAt: string };

type Assignment = {
  id: string; title: string; clientName: string; clientOrganization: string | null;
  languagePair: string; assignmentType: string; deliveryMode: string;
  location: string; address: string | null; roomFloor: string | null;
  dresscode: string | null; parkingNotes: string | null; accessInstructions: string | null;
  meetingLink: string | null; meetingPassword: string | null; platformNotes: string | null;
  scheduledStart: string; scheduledEnd: string; timezone: string;
  interpretersNeeded: number; isUrgent: boolean;
  specialNotes: string | null; internalNotes: string | null;
  requiredLanguagePair: string | null; requiredCertifications: string[];
  requiredExperienceYears: number | null; requiredModes: string[];
  compensationRate: number | null; compensationUnit: string | null;
  compensationNotes: string | null; isCompensationVisible: boolean;
  status: Status; visibilityMode: "ALL" | "RESTRICTED"; assignedCount: number;
  visibilityAllowedIds: string[]; assignedInterpreters: AssignedInterpreter[];
};

type Props = { assignment: Assignment; eligibleInterpreters: EligibleInterpreter[]; auditEvents: AuditEvent[] };

// ─── small atoms ──────────────────────────────────────────────────────────────

const inp = "block w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-800/60";

function FL({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</label>
      {children}
    </div>
  );
}

function TagInput({ tags, onChange, placeholder }: { tags: string[]; onChange: (t: string[]) => void; placeholder: string }) {
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
            <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {t}
              <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} className="text-zinc-400 hover:text-rose-500">×</button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input value={val} onChange={(e) => setVal(e.target.value)} placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          className={inp} />
        <button type="button" onClick={add}
          className="shrink-0 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800">
          Add
        </button>
      </div>
    </div>
  );
}

// ─── eligibility match indicator ─────────────────────────────────────────────

function EligibilityDots({
  interpreter,
  requiredCerts,
  requiredLang,
  requiredExp,
  requiredModes,
}: {
  interpreter: EligibleInterpreter;
  requiredCerts: string[];
  requiredLang: string | null;
  requiredExp: number | null;
  requiredModes: string[];
}) {
  const issues: string[] = [];
  if (requiredLang && !interpreter.languages.some((l) => l.toLowerCase() === requiredLang.toLowerCase()))
    issues.push("Language");
  if (requiredCerts.length > 0 && !requiredCerts.some((req) => interpreter.certifications.some((c) => c.toLowerCase().includes(req.toLowerCase()))))
    issues.push("Cert");
  if (requiredExp != null && (interpreter.experienceYears ?? 0) < requiredExp)
    issues.push("Exp");
  if (requiredModes.length > 0 && !requiredModes.some((m) => interpreter.preferredModes.includes(m)))
    issues.push("Mode");

  if (issues.length === 0) return (
    <span title="Meets all requirements" className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
      Match
    </span>
  );

  return (
    <span title={`Missing: ${issues.join(", ")}`} className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
      {issues.join(", ")}
    </span>
  );
}

// ─── interpreter selector ─────────────────────────────────────────────────────

function InterpreterSelector({
  interpreters, assignedIds, onAssign, isPending, needed, assignedCount,
  requiredCerts, requiredLang, requiredExp, requiredModes,
}: {
  interpreters: EligibleInterpreter[];
  assignedIds: Set<string>;
  onAssign: (id: string) => void;
  isPending: boolean;
  needed: number; assignedCount: number;
  requiredCerts: string[]; requiredLang: string | null;
  requiredExp: number | null; requiredModes: string[];
}) {
  const [q, setQ] = useState("");
  const [showOnlyEligible, setShowOnlyEligible] = useState(false);
  const isFull = assignedCount >= needed;

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = interpreters.filter((i) => !assignedIds.has(i.id));

    if (showOnlyEligible) {
      list = list.filter((i) => {
        if (requiredLang && !i.languages.some((l) => l.toLowerCase() === requiredLang.toLowerCase())) return false;
        if (requiredCerts.length > 0 && !requiredCerts.some((req) => i.certifications.some((c) => c.toLowerCase().includes(req.toLowerCase())))) return false;
        if (requiredExp != null && (i.experienceYears ?? 0) < requiredExp) return false;
        if (requiredModes.length > 0 && !requiredModes.some((m) => i.preferredModes.includes(m))) return false;
        return true;
      });
    }

    if (!query) return list;
    return list.filter((i) =>
      i.label.toLowerCase().includes(query) ||
      i.email?.toLowerCase().includes(query) ||
      i.location?.toLowerCase().includes(query) ||
      i.languages.some((l) => l.toLowerCase().includes(query)) ||
      i.certifications.some((c) => c.toLowerCase().includes(query))
    );
  }, [interpreters, q, assignedIds, showOnlyEligible, requiredCerts, requiredLang, requiredExp, requiredModes]);

  const hasRequirements = requiredLang || requiredCerts.length > 0 || requiredExp != null || requiredModes.length > 0;

  if (isFull) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
        ✓ Fully staffed — {assignedCount}/{needed}. Remove an interpreter to make room.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {needed - assignedCount} spot{needed - assignedCount !== 1 ? "s" : ""} remaining
        </div>
        {hasRequirements && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showOnlyEligible} onChange={(e) => setShowOnlyEligible(e.target.checked)} className="rounded" />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Eligible only</span>
          </label>
        )}
      </div>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, language, cert…"
        className={inp + " h-9 text-xs"} />

      <div className="max-h-72 overflow-auto space-y-1.5 pr-0.5">
        {filtered.map((i) => (
          <div key={i.id} className="flex items-center justify-between rounded-xl border border-zinc-100 bg-white px-3 py-2.5 hover:bg-zinc-50 transition-colors dark:border-zinc-800 dark:bg-zinc-900">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-zinc-900 dark:text-white truncate">{i.label}</span>
                {hasRequirements && (
                  <EligibilityDots interpreter={i} requiredCerts={requiredCerts} requiredLang={requiredLang} requiredExp={requiredExp} requiredModes={requiredModes} />
                )}
              </div>
              <div className="text-xs text-zinc-400 mt-0.5 truncate">
                {[i.email, i.location].filter(Boolean).join(" · ")}
              </div>
              {i.languages.length > 0 && (
                <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                  {i.languages.slice(0, 3).join(", ")}{i.certifications.length > 0 ? ` · ${i.certifications.slice(0,2).join(", ")}` : ""}
                </div>
              )}
            </div>
            <button type="button" disabled={isPending} onClick={() => onAssign(i.id)}
              className="ml-3 shrink-0 h-8 rounded-lg px-3 text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-700 transition-colors disabled:opacity-50 dark:bg-white dark:text-zinc-900">
              Assign
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-8 text-center text-sm text-zinc-400">
            {showOnlyEligible ? "No eligible interpreters match." : "No interpreters match."}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── edit panel (inline, not dialog) ─────────────────────────────────────────

function EditPanel({
  a, onSave, onCancel, isPending, assignedCount,
}: {
  a: Assignment; onSave: (patch: Record<string, unknown>) => void;
  onCancel: () => void; isPending: boolean; assignedCount: number;
}) {
  const [title, setTitle]       = useState(a.title);
  const [client, setClient]     = useState(a.clientName);
  const [org, setOrg]           = useState(a.clientOrganization ?? "");
  const [lang, setLang]         = useState(a.languagePair);
  const [type, setType]         = useState(a.assignmentType);
  const [mode, setMode]         = useState(a.deliveryMode);
  const [start, setStart]       = useState(toLocalInput(a.scheduledStart));
  const [end, setEnd]           = useState(toLocalInput(a.scheduledEnd));
  const [needed, setNeeded]     = useState(String(a.interpretersNeeded));
  const [urgent, setUrgent]     = useState(a.isUrgent);
  const [location, setLocation] = useState(a.location);
  const [address, setAddress]   = useState(a.address ?? "");
  const [room, setRoom]         = useState(a.roomFloor ?? "");
  const [dress, setDress]       = useState(a.dresscode ?? "");
  const [parking, setParking]   = useState(a.parkingNotes ?? "");
  const [access, setAccess]     = useState(a.accessInstructions ?? "");
  const [mlink, setMlink]       = useState(a.meetingLink ?? "");
  const [mpass, setMpass]       = useState(a.meetingPassword ?? "");
  const [platform, setPlatform] = useState(a.platformNotes ?? "");
  const [reqLang, setReqLang]   = useState(a.requiredLanguagePair ?? "");
  const [reqCerts, setReqCerts] = useState<string[]>(a.requiredCertifications);
  const [reqExp, setReqExp]     = useState(a.requiredExperienceYears != null ? String(a.requiredExperienceYears) : "");
  const [reqModes, setReqModes] = useState<string[]>(a.requiredModes);
  const [rate, setRate]         = useState(a.compensationRate != null ? String(a.compensationRate) : "");
  const [unit, setUnit]         = useState(a.compensationUnit ?? "per hour");
  const [compNotes, setCompNotes] = useState(a.compensationNotes ?? "");
  const [compVisible, setCompVisible] = useState(a.isCompensationVisible);
  const [notes, setNotes]       = useState(a.specialNotes ?? "");
  const [intNotes, setIntNotes] = useState(a.internalNotes ?? "");

  const isRemote = ["REMOTE","VIDEO_RELAY","VIDEO_REMOTE"].includes(mode);

  function save() {
    const s = new Date(start), e = new Date(end);
    if (isNaN(s.getTime())) { toast.error("Invalid start time"); return; }
    if (isNaN(e.getTime())) { toast.error("Invalid end time"); return; }
    if (e <= s)             { toast.error("End must be after start"); return; }
    const n = parseInt(needed);
    if (isNaN(n) || n < 1)  { toast.error("Interpreters needed ≥ 1"); return; }
    if (n < assignedCount)  { toast.error(`Can't set to ${n} — ${assignedCount} already assigned`); return; }

    onSave({
      title, clientName: client, clientOrganization: org || null, languagePair: lang,
      assignmentType: type, deliveryMode: mode, scheduledStart: s.toISOString(), scheduledEnd: e.toISOString(),
      interpretersNeeded: needed, isUrgent: urgent, location,
      address: address || null, roomFloor: room || null, dresscode: dress || null,
      parkingNotes: parking || null, accessInstructions: access || null,
      meetingLink: mlink || null, meetingPassword: mpass || null, platformNotes: platform || null,
      requiredLanguagePair: reqLang || null, requiredCertifications: reqCerts,
      requiredExperienceYears: reqExp ? parseInt(reqExp) : null, requiredModes: reqModes,
      compensationRate: rate ? parseFloat(rate) : null,
      compensationUnit: rate ? unit : null, compensationNotes: compNotes || null,
      isCompensationVisible: compVisible, specialNotes: notes || null, internalNotes: intNotes || null,
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Edit assignment</h3>
        <button type="button" onClick={onCancel} className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">✕ Cancel</button>
      </div>

      {/* Core */}
      <div className="space-y-3">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Core info</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <FL label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} className={inp} /></FL>
          <FL label="Client name"><input value={client} onChange={(e) => setClient(e.target.value)} className={inp} /></FL>
          <FL label="Organization"><input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Optional" className={inp} /></FL>
          <FL label="Language pair"><input value={lang} onChange={(e) => setLang(e.target.value)} className={inp} /></FL>
          <FL label="Type">
            <select value={type} onChange={(e) => setType(e.target.value)} className={inp}>
              {ASSIGNMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </FL>
          <FL label="Delivery mode">
            <select value={mode} onChange={(e) => setMode(e.target.value)} className={inp}>
              {DELIVERY_MODES.map((m) => <option key={m} value={m}>{DELIVERY_LABELS[m]}</option>)}
            </select>
          </FL>
          <FL label="Start"><input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={inp} /></FL>
          <FL label="End"><input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className={inp} /></FL>
          <FL label="Interpreters needed">
            <input type="number" min="1" max="50" value={needed} onChange={(e) => setNeeded(e.target.value)} className={inp} />
          </FL>
          <FL label="Urgency">
            <button type="button" onClick={() => setUrgent((v) => !v)}
              className={`flex items-center gap-2.5 w-full rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${urgent ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-300" : "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"}`}>
              <span className={`h-4 w-4 rounded border-2 flex items-center justify-center ${urgent ? "border-rose-500 bg-rose-500" : "border-zinc-300"}`}>
                {urgent && <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
              </span>
              Mark urgent
            </button>
          </FL>
        </div>
      </div>

      {/* Location */}
      <div className="space-y-3 border-t border-zinc-100 dark:border-zinc-800 pt-5">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{isRemote ? "Remote" : "Location & access"}</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <FL label="Location *"><input value={location} onChange={(e) => setLocation(e.target.value)} className={inp} /></FL>
          {!isRemote && (
            <>
              <FL label="Address"><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Optional" className={inp} /></FL>
              <FL label="Room / floor"><input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Optional" className={inp} /></FL>
              <FL label="Dress code"><input value={dress} onChange={(e) => setDress(e.target.value)} placeholder="Optional" className={inp} /></FL>
              <FL label="Parking"><input value={parking} onChange={(e) => setParking(e.target.value)} placeholder="Optional" className={inp} /></FL>
              <FL label="Access"><input value={access} onChange={(e) => setAccess(e.target.value)} placeholder="Optional" className={inp} /></FL>
            </>
          )}
          {isRemote && (
            <>
              <FL label="Meeting link"><input value={mlink} onChange={(e) => setMlink(e.target.value)} placeholder="https://zoom.us/j/…" className={inp} /></FL>
              <FL label="Password"><input value={mpass} onChange={(e) => setMpass(e.target.value)} placeholder="Optional" className={inp} /></FL>
              <div className="sm:col-span-2">
                <FL label="Platform notes"><input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="Optional" className={inp} /></FL>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Requirements */}
      <div className="space-y-3 border-t border-zinc-100 dark:border-zinc-800 pt-5">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Interpreter requirements</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <FL label="Required language"><input value={reqLang} onChange={(e) => setReqLang(e.target.value)} placeholder="e.g. ASL-English" className={inp} /></FL>
          <FL label="Min experience (yrs)"><input type="number" min="0" value={reqExp} onChange={(e) => setReqExp(e.target.value)} placeholder="Optional" className={inp} /></FL>
          <div className="sm:col-span-2">
            <FL label="Required certs"><TagInput tags={reqCerts} onChange={setReqCerts} placeholder="e.g. NIC" /></FL>
          </div>
          <div className="sm:col-span-2">
            <FL label="Required modalities">
              <div className="flex flex-wrap gap-2">
                {DELIVERY_MODES.map((m) => {
                  const active = reqModes.includes(m);
                  return (
                    <button key={m} type="button"
                      onClick={() => setReqModes((prev) => active ? prev.filter((x) => x !== m) : [...prev, m])}
                      className={`h-9 rounded-xl border px-3 text-xs font-medium transition-colors ${active ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"}`}>
                      {DELIVERY_LABELS[m]}
                    </button>
                  );
                })}
              </div>
            </FL>
          </div>
        </div>
      </div>

      {/* Compensation */}
      <div className="space-y-3 border-t border-zinc-100 dark:border-zinc-800 pt-5">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Compensation</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <FL label="Rate">
            <div className="flex">
              <span className="inline-flex items-center rounded-l-xl border border-r-0 border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800">$</span>
              <input type="number" min="0" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="45.00" className={inp + " rounded-l-none"} />
            </div>
          </FL>
          <FL label="Unit">
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inp}>
              {COMP_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </FL>
          <div className="sm:col-span-2">
            <FL label="Comp notes"><input value={compNotes} onChange={(e) => setCompNotes(e.target.value)} placeholder="Optional" className={inp} /></FL>
          </div>
        </div>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={compVisible} onChange={(e) => setCompVisible(e.target.checked)} className="rounded" />
          <span className="text-sm text-zinc-700 dark:text-zinc-300">Show compensation to interpreters</span>
        </label>
      </div>

      {/* Notes */}
      <div className="space-y-3 border-t border-zinc-100 dark:border-zinc-800 pt-5">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Notes</div>
        <FL label="Special notes (visible to interpreters)">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inp + " resize-none"} />
        </FL>
        <FL label="Internal notes (admin only)">
          <textarea value={intNotes} onChange={(e) => setIntNotes(e.target.value)} rows={2} placeholder="Never shown to interpreters" className={inp + " resize-none"} />
        </FL>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onCancel} disabled={isPending}
          className="flex-1 h-11 rounded-xl border border-zinc-200 bg-white text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          Cancel
        </button>
        <button type="button" onClick={save} disabled={isPending}
          className="flex-1 h-11 rounded-xl bg-zinc-900 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100">
          {isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// ─── main command panel ───────────────────────────────────────────────────────

export function AssignmentCommandPanel({ assignment, eligibleInterpreters, auditEvents: initialAudit }: Props) {
  const [isPending, startTransition] = useTransition();
  const [editMode, setEditMode] = useState(false);
  const [serverStatus, setServerStatus] = useState<Status>(assignment.status);
  const [status, setStatus] = useState<Status>(assignment.status);
  const [statusTouched, setStatusTouched] = useState(false);
  const [mode, setMode] = useState<"ALL" | "RESTRICTED">(assignment.visibilityMode);
  const [allowed, setAllowed] = useState<string[]>(assignment.visibilityAllowedIds);
  const [note, setNote] = useState("");
  const [auditOpen, setAuditOpen] = useState(false);
  const [links, setLinks] = useState<AssignedInterpreter[]>(assignment.assignedInterpreters);
  const [visSearchQ, setVisSearchQ] = useState("");

  const activeIds = useMemo(() => new Set(links.filter((l) => l.status === "ASSIGNED").map((l) => l.userProfileId)), [links]);
  const assignedCount = activeIds.size;
  const isClosed = serverStatus === "COMPLETED" || serverStatus === "CANCELLED";
  const statusDirty = status !== serverStatus;

  // Auto-sync status
  useEffect(() => {
    if (statusTouched || isClosed) return;
    const full = assignedCount >= assignment.interpretersNeeded;
    if (full && serverStatus !== "ASSIGNED") { setServerStatus("ASSIGNED"); setStatus("ASSIGNED"); }
    else if (!full && serverStatus === "ASSIGNED") { setServerStatus("OPEN"); setStatus("OPEN"); }
  }, [assignedCount, statusTouched, isClosed, serverStatus, assignment.interpretersNeeded]);

  function run(fn: () => Promise<void>) {
    startTransition(async () => { try { await fn(); } catch (e: any) { toast.error(e?.message ?? "Action failed"); } });
  }

  function handleAssign(interpreterId: string) {
    run(async () => {
      const res = await assignInterpreterAction(assignment.id, interpreterId, note || undefined);
      if (!res.ok) { toast.error(res.error); return; }
      const interp = eligibleInterpreters.find((i) => i.id === interpreterId);
      setLinks((prev) => {
        if (prev.find((l) => l.userProfileId === interpreterId))
          return prev.map((l) => l.userProfileId === interpreterId ? { ...l, status: "ASSIGNED" as const, removedAt: null } : l);
        return [...prev, {
          linkId: `tmp-${interpreterId}`, userProfileId: interpreterId,
          status: "ASSIGNED" as const, assignedAt: new Date().toISOString(), removedAt: null, note: null,
          label: interp?.label ?? interpreterId, email: interp?.email ?? null, location: interp?.location ?? null,
          languages: interp?.languages ?? [], certifications: interp?.certifications ?? [],
          experienceYears: interp?.experienceYears ?? null,
        }];
      });
      toast.success("Interpreter assigned"); setNote("");
    });
  }

  function handleRemove(interpreterId: string) {
    run(async () => {
      const res = await removeInterpreterAction(assignment.id, interpreterId, note || undefined);
      if (!res.ok) { toast.error(res.error); return; }
      setLinks((prev) => prev.map((l) => l.userProfileId === interpreterId ? { ...l, status: "REMOVED" as const, removedAt: new Date().toISOString() } : l));
      toast.success("Interpreter removed"); setNote("");
    });
  }

  function handleStatusUpdate() {
    run(async () => {
      const res = await setStatusAction(assignment.id, status, note || undefined);
      if (!res.ok) { toast.error(res.error); return; }
      setServerStatus(status); setStatusTouched(true);
      toast.success(`Status → ${status}`); setNote("");
    });
  }

  function handleVisibilitySave() {
    if (mode === "RESTRICTED" && allowed.length === 0) { toast.error("Select at least one interpreter"); return; }
    run(async () => {
      const res = await setVisibilityAction(assignment.id, mode, mode === "RESTRICTED" ? allowed : [], note || undefined);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Visibility updated"); setNote("");
    });
  }

  function handleEditSave(patch: Record<string, unknown>) {
    run(async () => {
      const res = await updateAssignmentAction(assignment.id, { ...patch, note: note || undefined });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Assignment updated"); setEditMode(false); setNote("");
    });
  }

  const visFiltered = useMemo(() => {
    const q = visSearchQ.trim().toLowerCase();
    if (!q) return eligibleInterpreters;
    return eligibleInterpreters.filter((i) =>
      i.label.toLowerCase().includes(q) || i.email?.toLowerCase().includes(q) || i.location?.toLowerCase().includes(q)
    );
  }, [eligibleInterpreters, visSearchQ]);

  return (
    <div className="space-y-4">

      {/* Closed banner */}
      {isClosed && (
        <div className={`rounded-2xl border px-5 py-3.5 text-sm font-medium ${serverStatus === "COMPLETED" ? "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400" : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300"}`}>
          {serverStatus === "COMPLETED"
            ? "✓ Marked complete. No further changes to interpreter slots."
            : "✗ Cancelled. No further changes allowed."}
        </div>
      )}

      {/* ── Edit / View toggle ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Assignment details</h2>
          {!editMode && (
            <button type="button" onClick={() => setEditMode(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700/60">
              <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M11 2.5L13.5 5l-8.5 8.5H2.5V11L11 2.5z" />
              </svg>
              Edit
            </button>
          )}
        </div>
        <div className="p-5">
          {editMode ? (
            <EditPanel a={assignment} onSave={handleEditSave} onCancel={() => setEditMode(false)} isPending={isPending} assignedCount={assignedCount} />
          ) : (
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              Use the <span className="font-medium text-zinc-900 dark:text-white">Edit</span> button above to modify any field — title, schedule, location, requirements, compensation, or notes.
            </div>
          )}
        </div>
      </div>

      {/* ── Staffing ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Staffing</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {assignment.interpretersNeeded} needed · {assignedCount} assigned
            </p>
          </div>
          {isPending && <span className="text-xs text-zinc-400 animate-pulse">Saving…</span>}
        </div>
        <div className="p-5 space-y-4">
          {/* Assigned interpreters */}
          {links.filter((l) => l.status === "ASSIGNED").length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-2">Currently assigned</div>
              {links.filter((l) => l.status === "ASSIGNED").map((l) => (
                <div key={l.linkId} className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/60 px-3.5 py-2.5 dark:border-emerald-800 dark:bg-emerald-950/20">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-900 dark:text-white truncate">{l.label}</div>
                    <div className="text-xs text-zinc-400 mt-0.5 truncate">
                      {[l.email, l.location].filter(Boolean).join(" · ")}
                      {l.assignedAt && <span className="text-zinc-300 dark:text-zinc-600"> · assigned {fmt(l.assignedAt)}</span>}
                    </div>
                    {l.languages.length > 0 && (
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        {l.languages.slice(0,3).join(", ")}
                        {l.certifications.length > 0 ? ` · ${l.certifications.slice(0,2).join(", ")}` : ""}
                      </div>
                    )}
                  </div>
                  {!isClosed && (
                    <button type="button" disabled={isPending} onClick={() => handleRemove(l.userProfileId)}
                      className="ml-3 shrink-0 text-xs font-medium text-rose-500 hover:text-rose-700 transition-colors disabled:opacity-50">
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Removed (collapsed) */}
          {links.filter((l) => l.status === "REMOVED").length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 list-none select-none">
                {links.filter((l) => l.status === "REMOVED").length} removed interpreter{links.filter((l) => l.status === "REMOVED").length !== 1 ? "s" : ""} ▸
              </summary>
              <div className="mt-2 space-y-1.5">
                {links.filter((l) => l.status === "REMOVED").map((l) => (
                  <div key={l.linkId} className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50/60 px-3.5 py-2 dark:border-zinc-800 dark:bg-zinc-900/40 opacity-60">
                    <div>
                      <div className="text-sm text-zinc-700 dark:text-zinc-300 line-through">{l.label}</div>
                      {l.removedAt && <div className="text-xs text-zinc-400">Removed {fmt(l.removedAt)}</div>}
                    </div>
                    {!isClosed && (
                      <button type="button" disabled={isPending} onClick={() => handleAssign(l.userProfileId)}
                        className="ml-3 shrink-0 text-xs font-medium text-sky-600 hover:text-sky-800 transition-colors disabled:opacity-50">
                        Re-assign
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}

          {!isClosed && (
            <InterpreterSelector
              interpreters={eligibleInterpreters} assignedIds={activeIds}
              onAssign={handleAssign} isPending={isPending}
              needed={assignment.interpretersNeeded} assignedCount={assignedCount}
              requiredCerts={assignment.requiredCertifications}
              requiredLang={assignment.requiredLanguagePair}
              requiredExp={assignment.requiredExperienceYears}
              requiredModes={assignment.requiredModes}
            />
          )}
        </div>
      </div>

      {/* ── Status override ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-5">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">Status override</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Auto-managed by fill count. Override to mark completed, cancelled, etc.</p>
        <div className="grid grid-cols-2 gap-2 mb-3 sm:grid-cols-4">
          {(["OPEN","ASSIGNED","COMPLETED","CANCELLED"] as const).map((s) => (
            <button key={s} type="button" onClick={() => { setStatus(s); setStatusTouched(true); }}
              className={`h-9 rounded-xl border text-xs font-semibold transition-colors ${status === s ? {
                OPEN: "border-sky-300 bg-sky-600 text-white",
                ASSIGNED: "border-emerald-300 bg-emerald-600 text-white",
                COMPLETED: "border-zinc-400 bg-zinc-600 text-white",
                CANCELLED: "border-rose-300 bg-rose-600 text-white",
              }[s] : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"}`}>
              {s}
            </button>
          ))}
        </div>
        <button type="button" disabled={isPending || !statusDirty} onClick={handleStatusUpdate}
          className="w-full h-10 rounded-xl bg-zinc-900 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100">
          Apply status
        </button>
      </div>

      {/* ── Visibility ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-5">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">Visibility</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Control which interpreters see this in their feed.</p>
        <div className="flex gap-2 mb-4">
          {(["ALL","RESTRICTED"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={`flex-1 h-10 rounded-xl border text-sm font-medium transition-colors ${mode === m ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"}`}>
              {m === "ALL" ? "Public" : "Restricted"}
            </button>
          ))}
        </div>
        {mode === "RESTRICTED" && (
          <div className="mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">{allowed.length} selected</span>
              {allowed.length > 0 && (
                <button type="button" onClick={() => setAllowed([])} className="text-xs text-zinc-400 hover:text-zinc-600">Clear all</button>
              )}
            </div>
            <input value={visSearchQ} onChange={(e) => setVisSearchQ(e.target.value)} placeholder="Search interpreters…"
              className={inp + " h-9 text-xs"} />
            <div className="max-h-48 overflow-auto space-y-1 rounded-xl border border-zinc-100 dark:border-zinc-800 p-2">
              {visFiltered.map((i) => {
                const checked = allowed.includes(i.id);
                return (
                  <label key={i.id} className="flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer">
                    <input type="checkbox" checked={checked}
                      onChange={(e) => setAllowed((prev) => { const s = new Set(prev); e.target.checked ? s.add(i.id) : s.delete(i.id); return Array.from(s); })}
                      className="mt-0.5 rounded" />
                    <div className="min-w-0">
                      <div className="text-sm text-zinc-900 dark:text-white truncate">{i.label}</div>
                      <div className="text-xs text-zinc-400 truncate">{[i.email, i.location].filter(Boolean).join(" · ")}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}
        <button type="button" disabled={isPending || (mode === "RESTRICTED" && allowed.length === 0)} onClick={handleVisibilitySave}
          className="w-full h-10 rounded-xl bg-zinc-900 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100">
          Save visibility
        </button>
      </div>

      {/* ── Audit note + log ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50 px-5 py-4">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-2">Audit note (applies to next action)</div>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note — stored in audit log"
          className={inp + " h-10"} />
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-5">
        <button type="button" onClick={() => setAuditOpen((v) => !v)}
          className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-900 dark:text-white">Audit log</span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{initialAudit.length}</span>
          </div>
          <span className="text-xs text-zinc-400">{auditOpen ? "Collapse ▲" : "Expand ▼"}</span>
        </button>

        {auditOpen && (
          <div className="mt-4 space-y-1.5 max-h-80 overflow-auto">
            {initialAudit.length === 0 ? (
              <p className="text-sm text-zinc-400 py-4 text-center">No events yet.</p>
            ) : (
              initialAudit.map((e) => (
                <div key={e.id} className="flex items-start gap-3 rounded-xl border border-zinc-100 dark:border-zinc-800 px-3.5 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300">{e.action}</div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">{e.actor ?? "system"} · {fmt(e.createdAt)}</div>
                    {e.note && <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 italic">{e.note}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}