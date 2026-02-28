// app/admin/assignments/[id]/ui.tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  updateAssignmentAction,
  setStatusAction,
  setVisibilityAction,
  assignInterpreterAction,
  removeInterpreterAction,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Status = "OPEN" | "ASSIGNED" | "COMPLETED" | "CANCELLED";

type AssignedInterpreter = {
  linkId: string;
  userProfileId: string;
  status: "ASSIGNED" | "REMOVED";
  assignedAt: string;
  removedAt: string | null;
  label: string;
  email: string | null;
  location: string | null;
};

type EligibleInterpreter = {
  id: string;
  label: string;
  email: string | null;
  location: string | null;
  languages: string[];
};

type AuditEvent = {
  id: string;
  action: string;
  actor: string | null;
  note: string | null;
  createdAt: string;
};

type Props = {
  assignment: {
    id: string;
    title: string;
    clientName: string;
    languagePair: string;
    assignmentType: string;
    location: string;
    scheduledStart: string;
    scheduledEnd: string;
    interpretersNeeded: number;
    specialNotes: string | null;
    status: Status;
    visibilityMode: "ALL" | "RESTRICTED";
    assignedCount: number;
    visibilityAllowedIds: string[];
    assignedInterpreters: AssignedInterpreter[];
  };
  eligibleInterpreters: EligibleInterpreter[];
  auditEvents: AuditEvent[];
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function StatusBadge({ status }: { status: Status }) {
  const cls: Record<Status, string> = {
    OPEN: "bg-sky-500/10 text-sky-700 border-sky-500/20 dark:text-sky-300",
    ASSIGNED: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-300",
    COMPLETED: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-400",
    CANCELLED: "bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-300",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cls[status]}`}>
      {status}
    </span>
  );
}

// ─── Interpreter Selector ─────────────────────────────────────────────────────

function InterpreterSelector({
  interpreters,
  assignedIds,
  onAssign,
  onRemove,
  isPending,
  needed,
  assignedCount,
}: {
  interpreters: EligibleInterpreter[];
  assignedIds: Set<string>;
  onAssign: (id: string) => void;
  onRemove: (id: string) => void;
  isPending: boolean;
  needed: number;
  assignedCount: number;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return interpreters;
    return interpreters.filter(
      (i) =>
        i.label.toLowerCase().includes(query) ||
        i.email?.toLowerCase().includes(query) ||
        i.location?.toLowerCase().includes(query) ||
        i.languages.some((l) => l.toLowerCase().includes(query))
    );
  }, [interpreters, q]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          Interpreters ({assignedCount}/{needed})
        </div>
        {assignedCount >= needed && (
          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            ✓ Fully staffed · status auto-set to ASSIGNED
          </span>
        )}
      </div>

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name, email, location, language…"
        className="h-9 rounded-xl text-xs"
      />

      <div className="max-h-64 overflow-auto space-y-1.5 pr-1">
        {filtered.map((i) => {
          const isAssigned = assignedIds.has(i.id);
          return (
            <div
              key={i.id}
              className={[
                "flex items-center justify-between rounded-xl border px-3 py-2.5 transition-colors",
                isAssigned
                  ? "border-emerald-500/30 bg-emerald-500/5 dark:border-emerald-500/20"
                  : "border-zinc-100 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900",
              ].join(" ")}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-zinc-950 dark:text-white truncate">{i.label}</div>
                <div className="text-xs text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                  {[i.email, i.location].filter(Boolean).join(" · ")}
                </div>
                {i.languages.length > 0 && (
                  <div className="text-[11px] text-zinc-300 dark:text-zinc-600 mt-0.5 truncate">
                    {i.languages.slice(0, 3).join(", ")}
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={isPending}
                onClick={() => isAssigned ? onRemove(i.id) : onAssign(i.id)}
                className={[
                  "ml-3 flex-shrink-0 h-8 rounded-lg px-3 text-xs font-medium transition-colors",
                  isAssigned
                    ? "bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 dark:text-rose-400"
                    : "bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950",
                ].join(" ")}
              >
                {isAssigned ? "Remove" : "Assign"}
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="py-6 text-center text-sm text-zinc-400">No interpreters match.</div>
        )}
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function AssignmentCommandPanel({ assignment, eligibleInterpreters, auditEvents }: Props) {
  const [isPending, startTransition] = useTransition();

  // Status
  const [status, setStatus] = useState<Status>(assignment.status);

  // Visibility
  const [mode, setMode] = useState<"ALL" | "RESTRICTED">(assignment.visibilityMode);
  const [allowed, setAllowed] = useState<string[]>(assignment.visibilityAllowedIds);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [note, setNote] = useState("");

  // Edit fields
  const [editTitle, setEditTitle] = useState(assignment.title);
  const [editClientName, setEditClientName] = useState(assignment.clientName);
  const [editLanguagePair, setEditLanguagePair] = useState(assignment.languagePair);
  const [editAssignmentType, setEditAssignmentType] = useState(assignment.assignmentType);
  const [editLocation, setEditLocation] = useState(assignment.location);
  const [editStart, setEditStart] = useState(toLocalInputValue(assignment.scheduledStart));
  const [editEnd, setEditEnd] = useState(toLocalInputValue(assignment.scheduledEnd));
  const [editNeeded, setEditNeeded] = useState(String(assignment.interpretersNeeded));
  const [editNotes, setEditNotes] = useState(assignment.specialNotes ?? "");

  // Interpreter state (local optimistic)
  const [interpreterLinks, setInterpreterLinks] = useState<AssignedInterpreter[]>(
    assignment.assignedInterpreters
  );

  const activeAssignedIds = useMemo(
    () => new Set(interpreterLinks.filter((l) => l.status === "ASSIGNED").map((l) => l.userProfileId)),
    [interpreterLinks]
  );

  const assignedCount = activeAssignedIds.size;

  function run(fn: () => Promise<void>) {
    startTransition(async () => {
      try {
        await fn();
      } catch (e: any) {
        toast.error(e?.message ?? "Action failed");
      }
    });
  }

  async function handleAssign(interpreterProfileId: string) {
    run(async () => {
      await assignInterpreterAction(assignment.id, interpreterProfileId, note);
      const interp = eligibleInterpreters.find((i) => i.id === interpreterProfileId);
      setInterpreterLinks((prev) => {
        const existing = prev.find((l) => l.userProfileId === interpreterProfileId);
        if (existing) return prev.map((l) => l.userProfileId === interpreterProfileId ? { ...l, status: "ASSIGNED" as const, removedAt: null } : l);
        return [
          ...prev,
          {
            linkId: `tmp-${interpreterProfileId}`,
            userProfileId: interpreterProfileId,
            status: "ASSIGNED" as const,
            assignedAt: new Date().toISOString(),
            removedAt: null,
            label: interp?.label ?? interpreterProfileId,
            email: interp?.email ?? null,
            location: interp?.location ?? null,
          },
        ];
      });
      toast.success("Interpreter assigned");
    });
  }

  async function handleRemove(interpreterProfileId: string) {
    run(async () => {
      await removeInterpreterAction(assignment.id, interpreterProfileId, note);
      setInterpreterLinks((prev) =>
        prev.map((l) => l.userProfileId === interpreterProfileId ? { ...l, status: "REMOVED" as const, removedAt: new Date().toISOString() } : l)
      );
      toast.success("Interpreter removed");
    });
  }

  async function handleStatusUpdate() {
    run(async () => {
      await setStatusAction(assignment.id, status, note);
      toast.success(`Status set to ${status}`);
      setNote("");
    });
  }

  async function handleVisibilitySave() {
    run(async () => {
      await setVisibilityAction(assignment.id, mode, mode === "RESTRICTED" ? allowed : [], note);
      toast.success("Visibility updated");
      setNote("");
    });
  }

  async function handleEditSave() {
    run(async () => {
      await updateAssignmentAction(assignment.id, {
        title: editTitle,
        clientName: editClientName,
        languagePair: editLanguagePair,
        assignmentType: editAssignmentType,
        location: editLocation,
        scheduledStart: new Date(editStart).toISOString(),
        scheduledEnd: new Date(editEnd).toISOString(),
        interpretersNeeded: editNeeded,
        specialNotes: editNotes,
        note,
      });
      toast.success("Assignment updated");
      setEditOpen(false);
      setNote("");
    });
  }

  const statusDirty = status !== assignment.status;

  return (
    <div className="space-y-4">
      {/* ── Interpreter assignment ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-semibold text-zinc-950 dark:text-white">Assign interpreters</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Status auto-updates to ASSIGNED when {assignment.interpretersNeeded} interpreter{assignment.interpretersNeeded !== 1 ? "s are" : " is"} filled
            </div>
          </div>
          {isPending && <span className="text-xs text-zinc-400">Saving…</span>}
        </div>

        {/* Current assigned list */}
        {interpreterLinks.filter((l) => l.status === "ASSIGNED").length > 0 && (
          <div className="mb-4 space-y-1.5">
            <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-2">Currently assigned</div>
            {interpreterLinks
              .filter((l) => l.status === "ASSIGNED")
              .map((l) => (
                <div key={l.linkId} className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
                  <div>
                    <div className="text-sm font-medium text-zinc-950 dark:text-white">{l.label}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">{l.email ?? l.location ?? "—"}</div>
                  </div>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleRemove(l.userProfileId)}
                    className="text-xs text-rose-500 hover:text-rose-600 font-medium transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
          </div>
        )}

        <InterpreterSelector
          interpreters={eligibleInterpreters}
          assignedIds={activeAssignedIds}
          onAssign={handleAssign}
          onRemove={handleRemove}
          isPending={isPending}
          needed={assignment.interpretersNeeded}
          assignedCount={assignedCount}
        />
      </div>

      {/* ── Admin controls row ───────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Status control */}
        <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 p-5">
          <div className="text-sm font-semibold text-zinc-950 dark:text-white mb-1">Status override</div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
            Status auto-managed by interpreter fill. Override manually if needed.
          </div>

          <Select value={status} onValueChange={(v) => setStatus(v as Status)} disabled={isPending}>
            <SelectTrigger className="h-11 rounded-xl bg-white dark:bg-zinc-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="OPEN">OPEN</SelectItem>
              <SelectItem value="ASSIGNED">ASSIGNED</SelectItem>
              <SelectItem value="COMPLETED">COMPLETED</SelectItem>
              <SelectItem value="CANCELLED">CANCELLED</SelectItem>
            </SelectContent>
          </Select>

          <div className="mt-3 flex gap-2">
            <Button
              className="flex-1 h-10 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950"
              disabled={isPending || !statusDirty}
              onClick={handleStatusUpdate}
            >
              Apply status
            </Button>
            <Button
              variant="secondary"
              className="h-10 rounded-xl"
              disabled={isPending}
              onClick={() => setEditOpen(true)}
            >
              Edit details
            </Button>
          </div>
        </div>

        {/* Visibility control */}
        <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 p-5">
          <div className="text-sm font-semibold text-zinc-950 dark:text-white mb-1">Visibility</div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
            Control which interpreters can see this job in their feed.
          </div>

          <div className="flex gap-2 mb-3">
            {(["ALL", "RESTRICTED"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={[
                  "flex-1 h-10 rounded-xl text-sm font-medium border transition-colors",
                  mode === m
                    ? "bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
                ].join(" ")}
              >
                {m === "ALL" ? "Public" : "Restricted"}
              </button>
            ))}
          </div>

          {mode === "RESTRICTED" && (
            <div className="mb-3 max-h-40 overflow-auto space-y-1.5 rounded-xl border border-zinc-100 dark:border-zinc-800 p-2">
              {eligibleInterpreters.map((i) => {
                const checked = allowed.includes(i.id);
                return (
                  <label key={i.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setAllowed((prev) => {
                          const s = new Set(prev);
                          if (e.target.checked) s.add(i.id); else s.delete(i.id);
                          return Array.from(s);
                        });
                      }}
                      className="rounded"
                    />
                    <span className="text-sm text-zinc-950 dark:text-white">{i.label}</span>
                    {i.location && <span className="text-xs text-zinc-400">· {i.location}</span>}
                  </label>
                );
              })}
            </div>
          )}

          <Button
            className="w-full h-10 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950"
            disabled={isPending || (mode === "RESTRICTED" && allowed.length === 0)}
            onClick={handleVisibilitySave}
          >
            Save visibility
          </Button>
        </div>
      </div>

      {/* Shared note field */}
      <div className="rounded-2xl border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50 px-5 py-4">
        <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Audit note (applies to next action)</div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional — stored in audit log"
          className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-950/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
        />
      </div>

      {/* Audit log */}
      <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 p-5">
        <div className="text-sm font-semibold text-zinc-950 dark:text-white mb-4">Audit log</div>
        {auditEvents.length === 0 ? (
          <div className="text-sm text-zinc-400">No events yet.</div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-auto">
            {auditEvents.map((e) => (
              <div key={e.id} className="flex items-start gap-3 rounded-xl border border-zinc-100 dark:border-zinc-800 px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono font-medium text-zinc-700 dark:text-zinc-300">
                    {e.action}
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    {e.actor ?? "system"} · {fmt(e.createdAt)}
                  </div>
                  {e.note && (
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 italic">{e.note}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-3xl max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit assignment details</DialogTitle>
            <DialogDescription>Changes are logged in the audit trail.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 lg:grid-cols-2">
            <EF label="Title" value={editTitle} onChange={setEditTitle} />
            <EF label="Client name" value={editClientName} onChange={setEditClientName} />
            <EF label="Language pair" value={editLanguagePair} onChange={setEditLanguagePair} />
            <EF label="Assignment type" value={editAssignmentType} onChange={setEditAssignmentType} />
            <EF label="Location" value={editLocation} onChange={setEditLocation} />
            <EF label="Interpreters needed" value={editNeeded} onChange={setEditNeeded} type="number" />
            <EF label="Start time *" type="datetime-local" value={editStart} onChange={setEditStart} />
            <EF label="End time *" type="datetime-local" value={editEnd} onChange={setEditEnd} />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Special notes</label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-zinc-950/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1 h-11 rounded-xl" onClick={() => setEditOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              className="flex-1 h-11 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950"
              onClick={handleEditSave}
              disabled={isPending}
            >
              {isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EF({
  label,
  value,
  onChange,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-500 mb-1">{label}</label>
      <input
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-950/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
      />
    </div>
  );
}