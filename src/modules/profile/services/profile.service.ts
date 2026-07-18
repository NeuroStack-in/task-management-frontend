/**
 * Your own profile — the real backend (`identity` context, LLD §17).
 *
 * `PATCH /v1/me/profile` is self-scoped (no permission bit) and accepts exactly four fields:
 * name, phone, location, avatar_s3_key. Empty string clears a field; an omitted key leaves it
 * unchanged. Everything else on the profile screen is admin-owned and edited elsewhere —
 * job title / department / team via `PATCH /v1/employees/{id}` (`employees:manage`), role via
 * `PUT /v1/users/{id}/role`, and email not at all (it's the Cognito login).
 *
 * ⚠️ There is **no `GET /v1/me/profile`**. The only route that returns your phone/location is
 * `GET /v1/employees/{id}`, which is gated on `employees:read` — a bit the Employee system role does
 * not hold. So a plain employee can write these fields but cannot read them back. `useMyProfile`
 * handles that by treating a 403 as "unknown", never as an error.
 *
 * Avatar upload is not wired: it needs a presigned-PUT route (the org-logo pattern) that does not
 * exist yet, so `avatar_s3_key` is deliberately not sent from here.
 */
import { apiFetch } from "@/lib/api";

/** Mirrors `identity::features::update_my_profile::dto::ProfileView`. */
export interface ApiMyProfile {
  user_id: string;
  name: string;
  phone?: string;
  location?: string;
  avatar_s3_key?: string;
}

/** Mirrors `UpdateProfileRequest`. Omit a key to leave it alone; "" clears it. */
export interface UpdateMyProfileBody {
  name?: string;
  phone?: string;
  location?: string;
}

export function updateMyProfile(body: UpdateMyProfileBody): Promise<ApiMyProfile> {
  return apiFetch<ApiMyProfile>("/v1/me/profile", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
