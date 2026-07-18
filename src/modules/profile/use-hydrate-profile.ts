"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { getEmployeeProfile } from "@/modules/employees/services/employees.service";

/**
 * The ID token carries no display name (Cognito isn't given one at signup), so `auth.service`
 * derives a placeholder from the email local-part — which is why a fresh owner shows as
 * "Giricoder Dev" instead of their real name. Once authenticated, fetch the caller's own profile
 * (`GET /v1/employees/{sub}`) and patch the store with the real name/title, so the greeting, nav,
 * and profile page all show what the user actually entered.
 *
 * Best-effort and once per mount: a failure (e.g. a member without self-read) just leaves the
 * email-derived name in place. Mounted from the app shell so it runs on every authenticated page.
 */
export function useHydrateProfile(): void {
  const userId = useAuthStore((s) => s.user?.id);
  const updateUser = useAuthStore((s) => s.updateUser);
  const done = useRef(false);

  useEffect(() => {
    if (!userId || done.current) return;
    done.current = true;
    getEmployeeProfile(userId)
      .then((p) => {
        const patch: { name?: string; jobTitle?: string } = {};
        if (p.name?.trim()) patch.name = p.name.trim();
        if (p.title?.trim()) patch.jobTitle = p.title.trim();
        if (Object.keys(patch).length) updateUser(patch);
      })
      .catch(() => {
        /* keep the email-derived name — best-effort */
      });
  }, [userId, updateUser]);
}
