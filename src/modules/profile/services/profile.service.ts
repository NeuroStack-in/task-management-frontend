/**
 * My profile — the real backend (`identity` context, LLD §17).
 *
 * Self-service: `PATCH /v1/me/profile` needs no permission beyond being authenticated — the
 * server edits the caller's own record (the `sub` from the token), never someone else's.
 */
import { ApiError, apiFetch } from "@/lib/api";

/**
 * Mirrors `identity::update_my_profile::dto::UpdateProfileRequest`. **Omitted fields are left
 * unchanged; an empty string clears the field** — send only what actually changed.
 * `avatar_s3_key` expects an already-uploaded S3 key (presigned-upload flow, same pattern as the
 * org logo) — not a data URL.
 */
export interface UpdateMyProfileBody {
  name?: string;
  phone?: string;
  location?: string;
  /** `YYYY-MM-DD`; "" clears. */
  date_of_birth?: string;
  /** `on-site` | `hybrid` | `remote`; "" clears. */
  work_mode?: string;
  avatar_s3_key?: string;
}

/** Mirrors `identity::update_my_profile::dto::ProfileView` — the post-update echo. */
export interface ApiMyProfile {
  user_id: string;
  name: string;
  phone?: string;
  location?: string;
  avatar_s3_key?: string;
}

/** `PATCH /v1/me/profile` — edit the caller's own name / phone / location. Self-service. */
export function updateMyProfile(body: UpdateMyProfileBody): Promise<ApiMyProfile> {
  return apiFetch<ApiMyProfile>("/v1/me/profile", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/**
 * Mirrors `identity::update_my_profile::dto::MyProfileView` — the full identity read, including
 * the admin-fixed facts (emp id, title, department, team) served read-only so the page never has
 * to invent them. Absent field = the org genuinely hasn't recorded it; render "—", never a guess.
 */
export interface ApiMyFullProfile {
  user_id: string;
  name: string;
  email?: string;
  emp_id?: string;
  phone?: string;
  location?: string;
  title?: string;
  department_id?: string;
  team_id?: string;
  /** Department/team **display names**, resolved server-side from the ids — so a self-viewing
   *  Employee sees them without the org-wide `GET /v1/departments`/`/v1/teams` they can't read.
   *  Absent when unassigned. Prefer these over resolving the id client-side. */
  department_name?: string;
  team_name?: string;
  /** Epoch ms the account was created — the honest "member since". */
  created_at?: number;
  /** `YYYY-MM-DD`, self-set. */
  date_of_birth?: string;
  /** `on-site` | `hybrid` | `remote`, self-set. */
  work_mode?: string;
}

/** `GET /v1/me/profile` — the caller's own stored profile. Self-service. */
export function getMyProfile(): Promise<ApiMyFullProfile> {
  return apiFetch<ApiMyFullProfile>("/v1/me/profile");
}

/* ── Avatar (identity::avatar_upload) ─────────────────────────────────────────────────────────── */

/** Mirrors `identity::avatar_upload` — a presigned-PUT ticket for the caller's own avatar. */
export interface AvatarUploadTicket {
  /** Canonical, server-derived key (`avatars/<tenant>/<user>.webp`) — never build it client-side. */
  s3_key: string;
  /** Presigned S3 PUT URL — upload with plain `fetch`, no Authorization header. */
  upload_url: string;
}

/** `POST /v1/me/avatar-upload` — mint a presigned upload for the caller's avatar. No body. */
export function beginAvatarUpload(): Promise<AvatarUploadTicket> {
  return apiFetch<AvatarUploadTicket>("/v1/me/avatar-upload", { method: "POST" });
}

/**
 * `GET /v1/me/avatar` — a **short-lived presigned view URL** for the caller's avatar, or `null`
 * when none has been uploaded (the server's 404 is the empty state, not an error — render
 * initials). Don't cache the URL beyond the session; re-fetch on mount, it expires.
 */
export async function getAvatarUrl(): Promise<string | null> {
  try {
    const { url } = await apiFetch<{ url: string }>("/v1/me/avatar");
    return url;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/** Longest output side of the avatar we upload — the server stores exactly what we PUT. */
const AVATAR_MAX_PX = 512;
const AVATAR_WEBP_QUALITY = 0.85;

/**
 * Center-crop the picked image to a square, downscale to ≤ `AVATAR_MAX_PX`, and encode WebP via
 * canvas (`toBlob`) — the canonical S3 key is `.webp`, so the bytes must be WebP. No dependencies.
 */
async function toSquareWebp(source: File | Blob): Promise<Blob> {
  const objectUrl = URL.createObjectURL(source);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("The file couldn't be read as an image."));
      el.src = objectUrl;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) throw new Error("The image has no pixels.");
    const out = Math.min(side, AVATAR_MAX_PX);
    const canvas = document.createElement("canvas");
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D isn't available in this browser.");
    // Center-crop the largest square, then scale it down in one draw.
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", AVATAR_WEBP_QUALITY),
    );
    if (!blob || blob.type !== "image/webp") {
      throw new Error("This browser can't encode WebP images.");
    }
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * The full avatar flow: resize/encode → `POST /v1/me/avatar-upload` → presigned `PUT` of the WebP
 * bytes → `PATCH /v1/me/profile { avatar_s3_key }` → fresh `GET /v1/me/avatar`.
 *
 * Returns the fresh presigned **view** URL to display (or `null` in the unlikely case the read
 * lags). Throws on any step failing — callers should toast and keep the previous avatar.
 */
export async function uploadAvatar(file: File | Blob): Promise<string | null> {
  const webp = await toSquareWebp(file);
  const { s3_key, upload_url } = await beginAvatarUpload();
  // Presigned PUT: plain fetch, body = the Blob, content-type must match what was signed.
  // NO Authorization header — the signature *is* the auth, and an extra header breaks it.
  const put = await fetch(upload_url, {
    method: "PUT",
    body: webp,
    headers: { "content-type": "image/webp" },
  });
  if (!put.ok) {
    throw new ApiError(`Avatar upload failed (${put.status}).`, put.status);
  }
  await updateMyProfile({ avatar_s3_key: s3_key });
  return getAvatarUrl();
}
