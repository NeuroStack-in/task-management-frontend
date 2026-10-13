import { isEmail } from "@/lib/validation";

/**
 * Turn whatever an admin pasted into a clean list of addresses.
 *
 * Bulk invite exists because inviting ten interns one dialog at a time is ten dialogs. The input for
 * that is a paste — out of a spreadsheet column, a mail client's To: field, a Slack message — so the
 * parser has to cope with what those actually produce rather than with a tidy comma-separated line:
 *
 * - separators of every kind: commas, semicolons, newlines, tabs, plain spaces
 * - display-name form, `Jordan Lee <jordan@acme.test>`, which mail clients copy verbatim
 * - stray angle brackets, quotes and trailing punctuation left behind by the split
 * - the same address twice, in different cases (`A@x.com` and `a@x.com` are one person)
 *
 * Order is preserved so the chips read in the order they were pasted, and `invalid` keeps the
 * original text of anything unusable — telling someone "3 addresses look wrong" is useless if you
 * don't show which three.
 */
export interface ParsedEmails {
  /** Valid, unique, lowercased — in first-seen order. */
  emails: string[];
  /** Fragments that aren't addresses, as typed. */
  invalid: string[];
  /** How many duplicates were folded away, for an honest "12 pasted, 10 unique". */
  duplicates: number;
}

/** `Jordan Lee <jordan@acme.test>` → `jordan@acme.test`; anything else is returned trimmed. */
function unwrap(token: string): string {
  const angled = token.match(/<([^>]+)>/);
  const raw = (angled ? angled[1] : token).trim();
  // Strip quotes and punctuation the split leaves clinging to an address.
  return raw.replace(/^["'<(\[]+/, "").replace(/["'>)\].,;:]+$/, "");
}

/**
 * Split on commas, semicolons, newlines and tabs — but never inside double quotes or angle brackets,
 * where a display name may hold a comma (`"Lee, Jordan" <jordan@acme.test>`). The regex this replaced
 * split on the comma first and said it didn't (QA audit 2026-10-08, WP-459).
 */
function tokenize(input: string): string[] {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  let angled = false;
  for (const ch of input) {
    if (ch === '"' && !angled) quoted = !quoted;
    else if (ch === "<" && !quoted) angled = true;
    else if (ch === ">" && !quoted) angled = false;
    if (!quoted && !angled && (ch === "," || ch === ";" || ch === "\n" || ch === "\t")) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

/** A token carrying an angle-bracketed address — the display-name form. */
const HAS_ANGLED_ADDRESS = /<[^>]*@[^>]*>/;

export function parseEmails(input: string): ParsedEmails {
  const emails: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  const tokens = tokenize(input);

  for (let i = 0; i < tokens.length; i++) {
    const trimmed = tokens[i].trim();
    if (!trimmed) continue;
    // Outlook's unquoted "Last, First <address>": the comma leaves "Last" on its own, ahead of the
    // part with the address. It is the front of a display name, not an address that failed — it
    // used to be listed as "not an email address" under a list that was complete.
    if (!/[@<]/.test(trimmed) && HAS_ANGLED_ADDRESS.test(tokens[i + 1] ?? "")) continue;

    // A token with no angle brackets may still hold several space-separated addresses.
    const parts = /<[^>]*>/.test(trimmed) ? [trimmed] : trimmed.split(/\s+/);

    for (const part of parts) {
      const candidate = unwrap(part);
      if (!candidate) continue;
      if (!isEmail(candidate)) {
        invalid.push(candidate);
        continue;
      }
      const key = candidate.toLowerCase();
      if (seen.has(key)) {
        duplicates++;
        continue;
      }
      seen.add(key);
      emails.push(key);
    }
  }

  return { emails, invalid, duplicates };
}
