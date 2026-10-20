/**
 * The sign-up's region defaults, read from the browser (UX audit 2026-10-16, ONB-04).
 *
 * Region used to be a step of its own — country, timezone and currency picked by hand before anyone
 * saw the product. The browser already knows most of it, so the form now starts from what it says
 * and the applicant only corrects what's wrong. Every value stays editable, and nothing here is
 * personal data: it is the organization's locale.
 */
import { COUNTRY_CURRENCY } from "@/modules/auth/components/auth-modals";
import { COUNTRIES as COUNTRY_CODES } from "@/lib/countries";

/**
 * IANA zones that name one country — the browser's timezone is a better sign of where someone is
 * than its language (plenty of browsers in India say `en-US`). Zones shared by several countries are
 * left out on purpose; those fall back to the language's region.
 */
const ZONE_COUNTRY: Record<string, string> = {
  "Asia/Kolkata": "IN",
  "Asia/Calcutta": "IN",
  "Europe/London": "GB",
  "Asia/Singapore": "SG",
  "Asia/Dubai": "AE",
  "Europe/Berlin": "DE",
  "Europe/Paris": "FR",
  "Europe/Madrid": "ES",
  "Europe/Rome": "IT",
  "Europe/Amsterdam": "NL",
  "Europe/Dublin": "IE",
  "Asia/Tokyo": "JP",
  "Asia/Karachi": "PK",
  "Asia/Dhaka": "BD",
  "Asia/Manila": "PH",
  "Asia/Jakarta": "ID",
  "Africa/Lagos": "NG",
  "Africa/Nairobi": "KE",
  "Africa/Johannesburg": "ZA",
  "America/Sao_Paulo": "BR",
  "America/Mexico_City": "MX",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Phoenix": "US",
  "America/Los_Angeles": "US",
  "America/Anchorage": "US",
  "Pacific/Honolulu": "US",
  "Australia/Sydney": "AU",
  "Australia/Melbourne": "AU",
  "Australia/Brisbane": "AU",
  "Australia/Perth": "AU",
  "Australia/Adelaide": "AU",
  "Pacific/Auckland": "NZ",
};

export interface RegionDefaults {
  /** Country display name, as the picker lists it; `""` when the browser gives nothing usable. */
  country: string;
  /** Currency display string (`"INR — Indian Rupee"`), when the country has a known one. */
  currency: string;
  /** The browser's IANA zone, e.g. `Asia/Kolkata`; `""` if it can't say. */
  timezone: string;
}

const nameOf = (iso: string | undefined) =>
  iso ? (COUNTRY_CODES.find((c) => c.iso === iso.toUpperCase())?.name ?? "") : "";

/**
 * Work the defaults out from a timezone and a list of language tags. Pure, so it is testable without
 * a browser; {@link browserRegion} feeds it the real values.
 */
export function regionFrom(timezone: string, languages: readonly string[]): RegionDefaults {
  let country = nameOf(ZONE_COUNTRY[timezone]);
  if (!country) {
    for (const tag of languages) {
      // Only an explicit region (`en-IN`), never a guessed one: a bare `en` says nothing about where.
      const m = /^[a-z]{2,3}(?:-[A-Za-z]{4})?-([A-Za-z]{2})\b/.exec(tag);
      country = nameOf(m?.[1]);
      if (country) break;
    }
  }
  return { country, currency: COUNTRY_CURRENCY[country] ?? "", timezone };
}

/** {@link regionFrom} with this browser's own values. Client-only — call it from an effect. */
export function browserRegion(): RegionDefaults {
  let timezone = "";
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    // Very old engines: no zone, the server's default applies.
  }
  const languages =
    typeof navigator === "undefined"
      ? []
      : navigator.languages?.length
        ? navigator.languages
        : [navigator.language];
  return regionFrom(timezone, languages.filter(Boolean));
}
