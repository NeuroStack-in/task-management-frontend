/**
 * Shared input-validation primitives. Reused by Zod form schemas and by the
 * hand-rolled (toast-based) validators across the app so email/domain/IP/file
 * checks are consistent everywhere. Keep format rules here — don't re-implement
 * them per form.
 */
import { z } from "zod";

/* ------------------------------- Zod fields -------------------------------- */

/** Trimmed string with a length range (default 1–200). Rejects whitespace-only. */
export const trimmedText = (min = 1, max = 200, label = "This field") =>
  z
    .string()
    .trim()
    .min(min, min === 1 ? `${label} is required.` : `Use at least ${min} characters.`)
    .max(max, `Keep it under ${max} characters.`);

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

/** IPv4 address or IPv4 CIDR block, e.g. `203.0.113.4` or `203.0.113.0/24`. */
export const IPV4_CIDR_RE =
  /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}(\/(3[0-2]|[12]?\d))?$/;

export function isIpOrCidr(value: string): boolean {
  return IPV4_CIDR_RE.test(value.trim());
}

export function isEmail(value: string): boolean {
  return emailField.safeParse(value).success;
}

/* ------------------------------ File helpers ------------------------------- */

export const MB = 1024 * 1024;

/** True if the file is at or under `maxBytes`. */
export function isWithinSize(file: File, maxBytes: number): boolean {
  return file.size <= maxBytes;
}

/** Human-readable size, e.g. `2 MB`. */
export function formatMaxSize(maxBytes: number): string {
  return `${Math.round(maxBytes / MB)} MB`;
}
