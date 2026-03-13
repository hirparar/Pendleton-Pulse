"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Wifi, WifiOff, Loader2 } from "lucide-react";

export function PendingClientWatcher({ initialStatus }: { initialStatus: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [connected, setConnected] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/me/status", { cache: "no-store" });
        if (!res.ok) { setConnected(false); return; }

        setConnected(true);
        setLastChecked(new Date());
        const data = await res.json();
        if (!data?.ok) return;

        if (data.status !== status) {
          setStatus(data.status);
          if (data.status === "APPROVED") {
            toast.success("You've been approved!", {
              description: "Redirecting to your dashboard…",
            });
            router.replace("/interpreter/dashboard");
            router.refresh();
          } else if (data.status === "DENIED") {
            toast.error("Access denied", {
              description: "Your request was not approved.",
            });
            router.replace("/interpreter/denied");
            router.refresh();
          }
        }
      } catch {
        setConnected(false);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [router, status]);

  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-200/80 bg-white px-4 py-3">
      <div className="flex items-center gap-2.5">
        {connected ? (
          <div className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </div>
        ) : (
          <WifiOff className="size-3.5 text-zinc-400" />
        )}
        <span className="text-xs font-medium text-zinc-600">
          {connected ? "Listening for updates" : "Reconnecting…"}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-zinc-400">
        {lastChecked ? (
          <span>
            Last checked {lastChecked.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <Loader2 className="size-3 animate-spin" />
            Checking…
          </span>
        )}
        <Wifi className="size-3 text-zinc-300" />
      </div>
    </div>
  );
}
