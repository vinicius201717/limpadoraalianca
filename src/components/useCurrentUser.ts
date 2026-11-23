"use client";

import { useEffect, useState } from "react";

import type { SessionUser } from "@/lib/types";

export function useCurrentUser() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (mounted) setUser(data?.user ?? null);
      })
      .catch(() => {
        if (mounted) setUser(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    function handleUserUpdated(event: Event) {
      const customEvent = event as CustomEvent<{ user?: SessionUser }>;
      if (customEvent.detail?.user) setUser(customEvent.detail.user);
    }

    window.addEventListener("alianca:user-updated", handleUserUpdated);
    return () => window.removeEventListener("alianca:user-updated", handleUserUpdated);
  }, []);

  return { user, loading };
}
