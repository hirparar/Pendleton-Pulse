// app/admin/assignments/new/ui.tsx
"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createAssignmentAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

function nowLocalISO() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function oneHourLater() {
  const d = new Date();
  d.setHours(d.getHours() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CreateAssignmentForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [clientName, setClientName] = useState("");
  const [languagePair, setLanguagePair] = useState("");
  const [assignmentType, setAssignmentType] = useState("");
  const [location, setLocation] = useState("");
  const [scheduledStart, setScheduledStart] = useState(nowLocalISO());
  const [scheduledEnd, setScheduledEnd] = useState(oneHourLater());
  const [interpretersNeeded, setInterpretersNeeded] = useState("1");
  const [specialNotes, setSpecialNotes] = useState("");

  const title = useMemo(() => {
    if (clientName && languagePair) return `${clientName} – ${languagePair}`;
    return clientName || "";
  }, [clientName, languagePair]);

  const isValid = useMemo(
    () => clientName.trim() && languagePair.trim() && assignmentType.trim() && location.trim() && scheduledStart && scheduledEnd,
    [clientName, languagePair, assignmentType, location, scheduledStart, scheduledEnd]
  );

  function toISO(dtLocal: string) { return new Date(dtLocal).toISOString(); }

  function submit(mode: "save" | "view") {
    if (!isValid) {
      toast.error("Fill in all required fields");
      return;
    }
    startTransition(async () => {
      try {
        const res = await createAssignmentAction({
          title,
          clientName,
          languagePair,
          assignmentType,
          location,
          scheduledStart: toISO(scheduledStart),
          scheduledEnd: toISO(scheduledEnd),
          interpretersNeeded,
          specialNotes,
        });
        if (!res?.ok) throw new Error("Failed");
        toast.success("Assignment created");
        if (mode === "view") router.push(`/admin/assignments/${res.id}`);
        else router.push("/admin/assignments");
      } catch (e: any) {
        toast.error(e?.message ?? "Could not create assignment");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="sticky top-3 z-20 flex items-center justify-between rounded-2xl border border-zinc-200 bg-white/90 px-5 py-3.5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
        <div>
          <div className="text-sm font-semibold text-zinc-950 dark:text-white">
            {title || "New assignment"}
          </div>
          <div className="text-xs text-zinc-400 mt-0.5">All fields marked * are required</div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="h-10 rounded-xl" disabled={isPending} onClick={() => submit("save")}>
            {isPending ? "Saving…" : "Save"}
          </Button>
          <Button
            className="h-10 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950"
            disabled={isPending || !isValid}
            onClick={() => submit("view")}
          >
            {isPending ? "Saving…" : "Save & open"}
          </Button>
        </div>
      </div>

      {/* Fields */}
      <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 p-5">
        <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-4">Client & job info</div>
        <div className="grid gap-4 lg:grid-cols-2">
          <F label="Client name *" value={clientName} onChange={setClientName} placeholder="e.g. St. Mary Hospital" />
          <F label="Language pair *" value={languagePair} onChange={setLanguagePair} placeholder="e.g. English → ASL" />
          <F label="Assignment type *" value={assignmentType} onChange={setAssignmentType} placeholder="e.g. Medical, Legal, Conference" />
          <F label="Location *" value={location} onChange={setLocation} placeholder="e.g. Toronto (in-person) / Remote" />
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 p-5">
        <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-4">Schedule & staffing</div>
        <div className="grid gap-4 lg:grid-cols-3">
          <F label="Start time *" type="datetime-local" value={scheduledStart} onChange={setScheduledStart} />
          <F label="End time *" type="datetime-local" value={scheduledEnd} onChange={setScheduledEnd} />
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Interpreters needed
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={interpretersNeeded}
              onChange={(e) => setInterpretersNeeded(e.target.value)}
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-950/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            />
            <p className="mt-1.5 text-[11px] text-zinc-400">Status auto-sets to ASSIGNED when filled</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 p-5">
        <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Special notes (optional)</div>
        <textarea
          value={specialNotes}
          onChange={(e) => setSpecialNotes(e.target.value)}
          rows={4}
          placeholder="Access instructions, dress code, context, etc. Visible to assigned interpreters."
          className="w-full resize-none rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-zinc-950/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
        />
      </div>
    </div>
  );
}

function F({
  label,
  value,
  onChange,
  placeholder,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">{label}</label>
      <input
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-950/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
      />
    </div>
  );
}