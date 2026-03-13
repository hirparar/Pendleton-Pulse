"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { setInterpreterActive, updateInterpreterCore } from "./actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Save, Languages, Star, Clock, ShieldCheck, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  userProfileId: string;
  isActive: boolean;
  status: "PENDING" | "APPROVED" | "DENIED";
  initial: {
    languages: string[];
    certifications: string[];
    experienceYears: number | null;
  };
};

function splitCsv(s: string) {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}
function toCsv(arr: string[]) {
  return arr.join(", ");
}

export function InterpreterAdminControls(props: Props) {
  const [isActive, setIsActive] = useState(props.isActive);
  const [languagesCsv, setLanguagesCsv] = useState(toCsv(props.initial.languages ?? []));
  const [certsCsv, setCertsCsv] = useState(toCsv(props.initial.certifications ?? []));
  const [experienceYears, setExperienceYears] = useState<string>(
    props.initial.experienceYears == null ? "" : String(props.initial.experienceYears)
  );
  const [note, setNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const nextActive = useMemo(() => !isActive, [isActive]);

  const [isToggling, startToggle] = useTransition();
  const [isSavingCore, startSaveCore] = useTransition();

  const expError = useMemo(() => {
    if (!experienceYears.trim()) return null;
    const n = Number(experienceYears);
    if (!Number.isFinite(n)) return "Must be a number.";
    const rounded = Math.round(n);
    if (rounded < 0 || rounded > 60) return "Must be 0–60.";
    return null;
  }, [experienceYears]);

  async function doToggleActive() {
    startToggle(async () => {
      try {
        const res = await setInterpreterActive({
          userProfileId: props.userProfileId,
          isActive: nextActive,
          note,
        });
        if (res?.ok) {
          setIsActive(res.isActive);
          toast.success(res.isActive ? "Activated" : "Deactivated", {
            description: res.isActive
              ? "Interpreter is eligible again (if approved)."
              : "Interpreter is blocked from interpreter pages and protected APIs.",
          });
          setNote("");
          setConfirmOpen(false);
        } else {
          toast.error("Could not update status");
        }
      } catch {
        toast.error("Could not update status");
      }
    });
  }

  async function doSaveCore() {
    if (expError) { toast.error("Fix input", { description: expError }); return; }
    startSaveCore(async () => {
      try {
        await updateInterpreterCore({
          userProfileId: props.userProfileId,
          languages: splitCsv(languagesCsv),
          certifications: splitCsv(certsCsv),
          experienceYears,
          note,
        });
        toast.success("Saved", { description: "Languages, certifications, and experience updated." });
        setNote("");
      } catch {
        toast.error("Could not save");
      }
    });
  }

  const anyPending = isToggling || isSavingCore;

  return (
    <section className="space-y-4">
      {/* Core fields */}
      <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 ring-1 ring-indigo-200/60">
              <Languages className="size-3.5 text-indigo-600" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-950">Core profile fields</h2>
          </div>
          {isSavingCore && (
            <span className="flex items-center gap-1.5 text-xs text-zinc-400">
              <Loader2 className="size-3 animate-spin" />
              Saving…
            </span>
          )}
        </div>

        <div className="p-5">
          <div className="grid gap-3 lg:grid-cols-2">
            <Field
              label="Languages"
              hint="Comma-separated (e.g. English, ASL)"
              icon={Languages}
              value={languagesCsv}
              onChange={setLanguagesCsv}
              placeholder="English, ASL"
              disabled={anyPending}
            />
            <Field
              label="Certifications"
              hint="Comma-separated (e.g. RID, NIC)"
              icon={Star}
              value={certsCsv}
              onChange={setCertsCsv}
              placeholder="RID, NIC"
              disabled={anyPending}
            />
            <Field
              label="Experience years"
              hint="A whole number between 0 and 60"
              icon={Clock}
              value={experienceYears}
              onChange={setExperienceYears}
              placeholder="3"
              disabled={anyPending}
              error={expError}
            />
            <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Rules</p>
              <ul className="mt-2 space-y-1.5 text-xs text-zinc-600">
                <li>• Max 25 items per list.</li>
                <li>• Duplicates removed automatically.</li>
                <li>• Experience must be 0–60 years.</li>
              </ul>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end">
            <button
              type="button"
              disabled={anyPending || Boolean(expError)}
              onClick={doSaveCore}
              className="flex h-9 items-center gap-2 rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
            >
              {isSavingCore ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {isSavingCore ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>

      {/* Eligibility */}
      <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className={cn(
              "grid h-7 w-7 place-items-center rounded-lg ring-1",
              isActive ? "bg-emerald-50 ring-emerald-200/60" : "bg-rose-50 ring-rose-200/60"
            )}>
              <ShieldCheck className={cn("size-3.5", isActive ? "text-emerald-600" : "text-rose-500")} />
            </div>
            <h2 className="text-sm font-semibold text-zinc-950">Eligibility</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={cn(
              "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
              isActive ? "border-sky-200 bg-sky-50 text-sky-700" : "border-zinc-200 bg-zinc-50 text-zinc-500"
            )}>
              {isActive ? "Active" : "Inactive"}
            </span>
            <span className={cn(
              "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
              props.status === "APPROVED" ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : props.status === "PENDING" ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-rose-200 bg-rose-50 text-rose-600"
            )}>
              {props.status}
            </span>
          </div>
        </div>

        <div className="p-5">
          <p className="text-sm text-zinc-600">
            {isActive
              ? "This interpreter is currently eligible to access the job feed (if also approved)."
              : "This interpreter is currently blocked from interpreter pages and protected APIs."}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-600">Admin note (optional)</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Stored in audit log…"
                disabled={anyPending}
                className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 disabled:opacity-50"
              />
            </div>
            <button
              type="button"
              disabled={anyPending}
              onClick={() => setConfirmOpen(true)}
              className={cn(
                "flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition disabled:opacity-50",
                isActive ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"
              )}
            >
              {isToggling ? <Loader2 className="size-4 animate-spin" /> : null}
              {isToggling ? "Saving…" : isActive ? "Deactivate" : "Activate"}
            </button>
          </div>
        </div>
      </div>

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm rounded-xl">
          <DialogHeader>
            <div className={cn(
              "mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full",
              nextActive ? "bg-emerald-100" : "bg-rose-100"
            )}>
              {nextActive
                ? <ShieldCheck className="size-6 text-emerald-600" />
                : <AlertTriangle className="size-6 text-rose-600" />
              }
            </div>
            <DialogTitle className="text-center">
              {nextActive ? "Activate interpreter?" : "Deactivate interpreter?"}
            </DialogTitle>
            <DialogDescription className="text-center">
              {nextActive
                ? "Activating restores eligibility. Approved interpreters regain access immediately."
                : "Deactivating blocks access to interpreter pages and protected APIs immediately."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              disabled={isToggling}
              onClick={() => setConfirmOpen(false)}
              className="h-9 rounded-lg border border-zinc-200 px-4 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isToggling}
              onClick={doToggleActive}
              className={cn(
                "flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition disabled:opacity-50",
                nextActive ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
              )}
            >
              {isToggling ? <Loader2 className="size-4 animate-spin" /> : null}
              {isToggling ? "Saving…" : "Confirm"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Field({
  label, hint, icon: Icon, value, onChange, placeholder, disabled, error,
}: {
  label: string; hint?: string; icon?: React.ElementType;
  value: string; onChange: (v: string) => void;
  placeholder?: string; disabled?: boolean; error?: string | null;
}) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {Icon && <Icon className="size-3.5 text-zinc-400" />}
          <span className="text-xs font-semibold text-zinc-700">{label}</span>
        </div>
        {error && (
          <span className="flex items-center gap-1 text-[11px] text-rose-600">
            <AlertTriangle className="size-2.5" />
            {error}
          </span>
        )}
      </div>
      {hint && <p className="mb-2 text-[11px] text-zinc-400">{hint}</p>}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "h-9 w-full rounded-lg border bg-white px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-zinc-300",
          error ? "border-rose-300" : "border-zinc-200",
          disabled && "opacity-60"
        )}
      />
    </div>
  );
}
