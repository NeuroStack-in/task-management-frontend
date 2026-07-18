"use client";

/**
 * Org meta state for the Organization settings pane (`PATCH /v1/org`).
 *
 * ## Why this hook is not `{data, loading, error, reload}`
 *
 * Every other hook here loads from a `GET` and can therefore reload. **There is no `GET /v1/org`** —
 * see the header of `services/org.service.ts`. The org's `name` / `timezone` / `website` /
 * `emp_id_prefix` / `slug` / `version` can only be *written*; the sole way to observe them is the
 * `OrgView` a successful `PATCH` returns.
 *
 * So there is nothing to load and nothing to reload: `org` is `null` until this session saves once,
 * and after that it holds the server's authoritative post-write view. A `loading`/`reload` pair here
 * would be theatre. When a read route lands, this hook grows a real load and the form can prefill.
 *
 * ## Optimistic locking
 *
 * `version` is unknown before the first save, so the first `PATCH` omits it and the server accepts
 * the current version. Afterwards we send the version from the last `OrgView`; a competing edit
 * comes back as `409 { code: "version_mismatch" }`, which the caller surfaces verbatim.
 */
import { useCallback, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  markOnboardingStep as markStep,
  updateOrg,
  type ApiOrgView,
  type ApiUpdateOrgRequest,
  type OnboardingState,
  type OnboardingStep,
} from "./services/org.service";

/**
 * A write's outcome. Returned (rather than only stored in `error`) so the caller can toast the
 * server's own words in the same tick, without racing the state update.
 */
export type OrgSaveResult =
  | { ok: true; org: ApiOrgView }
  | { ok: false; message: string };

export interface OrgState {
  /** The last `OrgView` the server returned — `null` until a save succeeds (no read route). */
  org: ApiOrgView | null;
  saving: boolean;
  /** Last write error, already unwrapped to `ApiError.message`. */
  error: string | null;
  /** `true` once a save has succeeded, i.e. once `org` reflects real server state. */
  known: boolean;
  /** Sends the patch (adding the known `version`) and stores the resulting view. */
  save: (patch: ApiUpdateOrgRequest) => Promise<OrgSaveResult>;
  /** Marks one onboarding-wizard step via the same route. */
  markOnboardingStep: (
    step: OnboardingStep,
    state: OnboardingState,
  ) => Promise<OrgSaveResult>;
}

function messageOf(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) {
      return "You need the Manage Settings permission to change organization details.";
    }
    if (err.status === 409) {
      return "Someone else changed these settings. Save again to apply your edits on top.";
    }
    return err.message;
  }
  return err instanceof Error ? err.message : "Couldn't save organization settings.";
}

export function useOrg(): OrgState {
  const [org, setOrg] = useState<ApiOrgView | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(
    async (patch: ApiUpdateOrgRequest): Promise<OrgSaveResult> => {
      setSaving(true);
      setError(null);
      try {
        // Only send a version once we've actually seen one; omitting it means "accept current".
        const view = await updateOrg(
          org ? { version: org.version, ...patch } : patch,
        );
        setOrg(view);
        return { ok: true, org: view };
      } catch (err) {
        const message = messageOf(err);
        setError(message);
        return { ok: false, message };
      } finally {
        setSaving(false);
      }
    },
    [org],
  );

  const markOnboardingStep = useCallback(
    async (
      step: OnboardingStep,
      state: OnboardingState,
    ): Promise<OrgSaveResult> => {
      setError(null);
      try {
        const view = await markStep(step, state);
        setOrg(view);
        return { ok: true, org: view };
      } catch (err) {
        const message = messageOf(err);
        setError(message);
        return { ok: false, message };
      }
    },
    [],
  );

  return { org, saving, error, known: org !== null, save, markOnboardingStep };
}
