"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { listFleet, type ApiFleet } from "./services/fleet.service";

export interface FleetState {
  fleet: ApiFleet | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useFleet(): FleetState {
  const [fleet, setFleet] = useState<ApiFleet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    listFleet()
      .then((f) => {
        if (live) setFleet(f);
      })
      .catch((e) => {
        if (live) setError(messageOf(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { fleet, loading, error, reload };
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to the device fleet.";
    return e.message;
  }
  return "Couldn't load the device fleet. Check your connection and retry.";
}
