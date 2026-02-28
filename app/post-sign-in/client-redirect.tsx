"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function PostSignInClientRedirect() {
  const router = useRouter();

  useEffect(() => {
    // If server redirect fails for any reason, refresh forces a real SSR pass.
    // This prevents users ever being stuck on /post-sign-in.
    router.refresh();
  }, [router]);

  return null;
}
