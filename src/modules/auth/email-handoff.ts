/**
 * Carry an email address from one sign-in page to the next without putting it in the URL.
 *
 * `/reset-password?email=…` and `/login?email=…` wrote the address into browser history, synced
 * history and every access log on the way (QA audit 2026-10-08, WP-390). `sessionStorage` belongs to
 * the one tab and ends with it, and the receiving page removes the value as it reads it.
 */
const KEY = "wp-email-handoff";

export function handOffEmail(email: string): void {
  try {
    sessionStorage.setItem(KEY, email);
  } catch {
    // Storage blocked: the next page's field simply starts empty.
  }
}

/** The handed-off address, once — `""` when there is none. Call from an effect, not during render. */
export function takeHandedOffEmail(): string {
  try {
    const email = sessionStorage.getItem(KEY) ?? "";
    sessionStorage.removeItem(KEY);
    return email;
  } catch {
    return "";
  }
}
