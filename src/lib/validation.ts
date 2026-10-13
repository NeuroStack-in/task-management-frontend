/**
 * Shared input-validation primitives. Reused by Zod form schemas and by the
 * hand-rolled (toast-based) validators across the app so email/domain/file
 * checks are consistent everywhere. Keep format rules here — don't re-implement
 * them per form.
 */
import { z } from "zod";

/* ------------------------------- Zod fields -------------------------------- */

/** Email — trimmed, required, format-checked. */
export const emailField = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .email("Enter a valid email address.");

/* ----------------------------- Format helpers ------------------------------ */

/** Hostname/domain like `example.com` or `sub.example.co.uk` — no scheme/path/port. */
export const DOMAIN_RE =
  /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export function isDomain(value: string): boolean {
  return DOMAIN_RE.test(value.trim());
}

export function isEmail(value: string): boolean {
  return emailField.safeParse(value).success;
}

/**
 * A typed web address as an absolute `http(s)` link, or `null` when it isn't one.
 *
 * `acme.com` becomes `https://acme.com`: stored as typed, a scheme-less value was rendered as a
 * relative `href` and opened `/settings/acme.com` inside the app (QA audit 2026-10-08, WP-356).
 * Without a scheme the host must look like a domain (so plain words never become links); with an
 * explicit `http(s)://` any host is accepted (an intranet name, say). Every other scheme — including
 * `javascript:` — is refused. Also the guard for rendering a stored value as a link.
 */
export function toWebUrl(value: string): string | null {
  const v = value.trim();
  if (!v || /\s/.test(v)) return null;
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(v);
  const candidate = hasScheme ? v : `https://${v}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname) return null;
  if (!hasScheme && !DOMAIN_RE.test(url.hostname)) return null;
  return candidate;
}

/* ------------------------------ File helpers ------------------------------- */

export const MB = 1024 * 1024;

/** True if the file is at or under `maxBytes`. */
export function isWithinSize(file: File, maxBytes: number): boolean {
  return file.size <= maxBytes;
}
