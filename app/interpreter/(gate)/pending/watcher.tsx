"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function PendingClientWatcher({ initialStatus }: { initialStatus: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/me/status", { cache: "no-store" });
        if (!res.ok) return;

        const data = await res.json();
        if (!data?.ok) return;

        if (data.status !== status) {
          setStatus(data.status);

          if (data.status === "APPROVED") {
            toast.success("Approved", { description: "You now have access to the job feed." });
            router.replace("/interpreter/dashboard");
            router.refresh();
          } else if (data.status === "DENIED") {
            toast.error("Denied", { description: "Your access request was denied." });
            router.replace("/interpreter/denied");
            router.refresh();
          }
        }
      } catch {
        // silent fail, keep polling
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [router, status]);

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-sm font-semibold tracking-tight">Live status</div>
      <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
        Current: <span className="font-medium text-zinc-900 dark:text-white">{status}</span>
      </div>
      <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        We check periodically. If you’re approved, you’ll be redirected automatically.
      </div>
    </div>
  );
}
