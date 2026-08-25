"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { getAvatarUrl } from "@/modules/profile/services/profile.service";

/**
 * Fetch the signed-in user's avatar once per session and publish it to the auth store.
 *
 * **Why this is not in the profile page.** The sidebar, navbar and every other `<AvatarImage>`
 * read `user.avatarUrl` from the auth store — but the only thing that ever *populated* it was a
 * `useEffect` inside `profile-view.tsx`. So the avatar appeared only after you had visited
 * Settings → Profile in that session, and a fresh sign-in showed initials everywhere until you
 * happened to open one specific page. Uploading a photo and then seeing your own initials in the
 * sidebar reads as the upload having failed.
 *
 * Mounted here, it runs once for anyone signed in, on any route.
 *
 * **Presigned URLs expire**, so this deliberately does not persist: it re-fetches per session and
 * per sign-in rather than trusting a stored URL, which is the same reasoning the profile page
 * already carried.
 *
 * **Best-effort.** A failure leaves `avatarUrl` unset and every avatar falls back to initials —
 * exactly the pre-upload state, never an error surface. A 404 is the documented "no avatar"
 * answer, not a fault.
 *
 * Scope note: this covers the caller's **own** avatar only. Other people's photos (the employee
 * directory, project members, timesheet rows) still render initials, because the backend exposes
 * no route that returns another user's avatar — `GET /v1/me/avatar` is self-scoped and the
 * directory DTO carries no avatar field. That needs a server change, not a client one.
 */
export function AvatarSync() {
  const userId = useAuthStore((s) => s.user?.id);
  const updateUser = useAuthStore((s) => s.updateUser);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    getAvatarUrl()
      .then((url) => {
        if (alive) updateUser({ avatarUrl: url ?? undefined });
      })
      .catch(() => {
        /* transient or unauthenticated — initials are a correct fallback */
      });
    return () => {
      alive = false;
    };
    // Keyed on the user id so a sign-out/sign-in as someone else re-fetches rather than leaving
    // the previous person's photo on screen.
  }, [userId, updateUser]);

  return null;
}
