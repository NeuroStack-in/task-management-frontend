"use client";

/**
 * The signed-in user's own editable profile fields, read where the backend permits it.
 *
 * The read goes through `GET /v1/employees/{id}` because no `GET /v1/me/profile` exists. That route
 * needs `employees:read`, which the Employee system role does not hold — so a **403 is expected and
 * is not an error**: it means "we can't read these back", and the fields show as unset until saved.
 * Anything else (network, 5xx) is surfaced.
 *
 * `known` distinguishes "we read the server and the field is empty" from "we were not allowed to
 * look", so the UI can avoid claiming a blank is the stored value.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { getEmployeeProfile } from "@/modules/employees/services/employees.service";
import { updateMyProfile, type UpdateMyProfileBody } from "./services/profile.service";

export interface MyProfile {
  phone: string;
  location: string;
  empId: string;
  title: string;
  joinedAt: number | null;
}

export interface MyProfileState extends MyProfile {
  /** True when the server told us these values; false when the read was forbidden. */
  known: boolean;
  loading: boolean;
  error: string | null;
  reload: () => void;
  save: (body: UpdateMyProfileBody) => Promise<void>;
}

const BLANK: MyProfile = { phone: "", location: "", empId: "", title: "", joinedAt: null };

export function useMyProfile(): MyProfileState {
  const userId = useAuthStore((s) => s.user?.id);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [profile, setProfile] = useState<MyProfile>(BLANK);
  const [known, setKnown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const p = await getEmployeeProfile(userId);
        if (!live) return;
        setProfile({
          phone: p.phone ?? "",
          location: p.location ?? "",
          empId: p.emp_id ?? "",
          title: p.title ?? "",
          joinedAt: p.joined_at ?? null,
        });
        setKnown(true);
      } catch (e) {
        if (!live) return;
        // Expected for the Employee role — not a failure, just an unreadable profile.
        if (e instanceof ApiError && e.status === 403) {
          setProfile(BLANK);
          setKnown(false);
        } else {
          setError(messageOf(e));
        }
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [userId, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const save = useCallback(
    async (body: UpdateMyProfileBody) => {
      const saved = await updateMyProfile(body);
      // The PATCH response is authoritative for what it echoes back.
      setProfile((p) => ({
        ...p,
        phone: saved.phone ?? "",
        location: saved.location ?? "",
      }));
      setKnown(true);
      if (saved.name) updateUser({ name: saved.name });
    },
    [updateUser],
  );

  return { ...profile, known, loading, error, reload, save };
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    return e.message;
  }
  return "Couldn't load your profile. Check your connection and retry.";
}
