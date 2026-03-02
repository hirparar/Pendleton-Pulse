"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { setInterpreterActive, updateInterpreterCore } from "./actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function toCsv(arr: string[]) {
  return arr.join(", ");
}

export function InterpreterAdminControls(props: Props) {
  const [isActive, setIsActive] = useState(props.isActive);

  const [languagesCsv, setLanguagesCsv] = useState(toCsv(props.initial.languages ?? []));
  const [certsCsv, setCertsCsv] = useState(toCsv(props.initial.certifications ?? []));
  const [experienceYears, setExperienceYears] = useState<string>(
    props.initial.experienceYears === null || props.initial.experienceYears === undefined
      ? ""
      : String(props.initial.experienceYears)
  );

  const [note, setNote] = useState("");

  // Confirm dialog for deactivation/activation
  const [confirmOpen, setConfirmOpen] = useState(false);
  const nextActive = useMemo(() => !isActive, [isActive]);

  // Split transitions so the UI can show which section is saving
  const [isToggling, startToggle] = useTransition();
  const [isSavingCore, startSaveCore] = useTransition();

  // Client-side sanity check (server still validates)
  const expError = useMemo(() => {
    if (!experienceYears.trim()) return null;
    const n = Number(experienceYears);
    if (!Number.isFinite(n)) return "Experience must be a number.";
    const rounded = Math.round(n);
    if (rounded < 0 || rounded > 60) return "Experience must be between 0 and 60.";
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
          toast.error("Could not update status", { description: "Try again." });
        }
      } catch {
        toast.error("Could not update status", { description: "Try again." });
      }
    });
  }

  async function doSaveCore() {
    if (expError) {
      toast.error("Fix input", { description: expError });
      return;
    }

    startSaveCore(async () => {
      try {
        await updateInterpreterCore({
          userProfileId: props.userProfileId,
          languages: splitCsv(languagesCsv),
          certifications: splitCsv(certsCsv),
          experienceYears,
          note,
        });

        toast.success("Saved", {
          description: "Core interpreter fields updated (languages, certifications, experience).",
        });
        setNote("");
      } catch {
        toast.error("Could not save", { description: "Fix input and try again." });
      }
    });
  }

  const anyPending = isToggling || isSavingCore;

  return (
    <section className="space-y-6">
      {/* Core profile editing FIRST */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-white">
              Core profile fields
            </div>
            {isSavingCore ? (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Saving…</span>
            ) : null}
          </div>
        </div>

        <Separator className="my-4 opacity-60" />

        <div className="grid gap-3 lg:grid-cols-2">
          <Field
            label="Languages (comma separated)"
            value={languagesCsv}
            onChange={setLanguagesCsv}
            placeholder="e.g. English, ASL"
            disabled={anyPending}
          />
          <Field
            label="Certifications (comma separated)"
            value={certsCsv}
            onChange={setCertsCsv}
            placeholder="e.g. RID, NIC"
            disabled={anyPending}
          />
          <Field
            label="Experience years (0–60)"
            value={experienceYears}
            onChange={setExperienceYears}
            placeholder="e.g. 3"
            disabled={anyPending}
            error={expError}
          />

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Rules</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-zinc-600 dark:text-zinc-300">
              <li>Max 25 items per list.</li>
              <li>Duplicates will removed automatically.</li>
              <li>Experience must be a valid number (0–60).</li>
            </ul>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button
            className="h-11 rounded-2xl bg-zinc-950 text-white hover:bg-zinc-900 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
            disabled={anyPending || Boolean(expError)}
            onClick={doSaveCore}
          >
            {isSavingCore ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      {/* Eligibility control LAST (compact) */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-white">
                Eligibility
              </div>
              {isToggling ? (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Saving…</span>
              ) : null}
            </div>

            <div className="text-sm text-zinc-600 dark:text-zinc-300">
              Toggle interpreter eligibility.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              {isActive ? "ACTIVE" : "INACTIVE"}
            </Badge>
            <Badge variant="secondary" className="rounded-full">
              {props.status}
            </Badge>
          </div>
        </div>

        <Separator className="my-4 opacity-60" />

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-1">
            <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Admin note (optional)
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note for audit… (applies to next action)"
              className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-zinc-800 dark:bg-zinc-900"
              disabled={anyPending}
            />
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Stored in audit log. Keep it short and factual.
            </div>
          </div>

          <div className="flex items-center gap-2 sm:justify-end">
            <Button
              className={[
                "h-11 rounded-2xl",
                isActive
                  ? "bg-rose-600 hover:bg-rose-600/90"
                  : "bg-emerald-600 hover:bg-emerald-600/90",
              ].join(" ")}
              disabled={anyPending}
              onClick={() => setConfirmOpen(true)}
            >
              {isToggling ? "Saving…" : isActive ? "Deactivate" : "Activate"}
            </Button>
          </div>
        </div>
      </div>

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="tracking-tight">
              {nextActive ? "Activate interpreter?" : "Deactivate interpreter?"}
            </DialogTitle>
            <DialogDescription>
              {nextActive
                ? "Activating restores eligibility. Approved interpreters regain access immediately."
                : "Deactivating blocks access to interpreter pages and protected APIs immediately."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              className="h-11 rounded-2xl"
              onClick={() => setConfirmOpen(false)}
              disabled={isToggling}
            >
              Cancel
            </Button>

            <Button
              className={[
                "h-11 rounded-2xl",
                nextActive
                  ? "bg-emerald-600 hover:bg-emerald-600/90"
                  : "bg-rose-600 hover:bg-rose-600/90",
              ].join(" ")}
              disabled={isToggling}
              onClick={doToggleActive}
            >
              {isToggling ? "Saving…" : "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{label}</div>
        {error ? <div className="text-[11px] text-rose-600 dark:text-rose-300">{error}</div> : null}
      </div>

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={[
          "mt-2 h-11 w-full rounded-2xl border bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-zinc-950",
          error ? "border-rose-400 dark:border-rose-500" : "border-zinc-200 dark:border-zinc-800",
          disabled ? "opacity-70" : "",
        ].join(" ")}
      />
    </div>
  );
}