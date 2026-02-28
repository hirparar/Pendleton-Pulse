"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

export default function PostSignInPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();

  const [msg, setMsg] = useState("Finalizing sign-in…");

  useEffect(() => {
    if (!isLoaded) return;

    // If Clerk says you're not signed in, go to sign-in.
    if (!isSignedIn) {
      router.replace("/sign-in");
      return;
    }

    // Fetch destination from server (no-store) and redirect.
    (async () => {
      try {
        setMsg("Loading your workspace…");

        const res = await fetch("/api/auth/post-sign-in", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to resolve destination");

        const json = (await res.json()) as { dest: string };
        router.replace(json.dest);
      } catch {
        // fallback: hard refresh to allow server session cookies to settle
        setMsg("Almost there…");
        window.location.href = "/post-sign-in";
      }
    })();
  }, [isLoaded, isSignedIn, router]);

  return (
    <div className="min-h-[60vh] w-full">
      <div className="mx-auto max-w-xl pt-16">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-white">
            Redirecting
          </div>
          <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{msg}</div>

          <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-zinc-900 dark:bg-white" />
          </div>

          <div className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
            If this takes more than a moment, your session is still syncing.
          </div>
        </div>
      </div>
    </div>
  );
}
