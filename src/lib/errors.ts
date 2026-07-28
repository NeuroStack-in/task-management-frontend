/**
 * Turning failures into sentences a person can act on.
 *
 * **Why this is central.** Error text used to be assembled at ~40 call sites, each doing
 * `e instanceof ApiError ? e.message : "<fallback>"`. That reads as careful, but it means whatever
 * the server said goes straight to the user — including `Request failed (500).`, Cognito's
 * `NotAuthorizedException`, and validation text written for API clients rather than people. The
 * fallback, the friendly half, only ran when the error was *unrecognised*.
 *
 * So the mapping lives here and runs at the boundary ({@link lib/api.apiFetch} builds `ApiError`
 * with an already-human message), and callers keep passing the fallback they always did. The raw
 * text is never discarded — it stays on `ApiError.serverMessage` for the console and for support.
 *
 * The rule of thumb when editing this file: say **what happened** and **what to do next**, in that
 * order, without blaming the user and without naming a mechanism they can't see.
 */

/** What we say when we know only that a request failed at a given status. */
const BY_STATUS: Record<number, string> = {
  400: "Some of the details weren't accepted. Check them and try again.",
  401: "Your session has expired. Sign in again to continue.",
  403: "You don't have permission to do this. Ask an admin if you need access.",
  404: "We couldn't find that — it may have been deleted or moved.",
  405: "That action isn't available here.",
  408: "The request took too long. Check your connection and try again.",
  409: "Someone else changed this first. Refresh the page and try again.",
  413: "That file is too large. Try a smaller one.",
  415: "That file type isn't supported.",
  422: "Some of the details weren't accepted. Check them and try again.",
  429: "You're doing that a bit too quickly. Wait a moment and try again.",
  500: "Something went wrong on our side. Try again in a moment.",
  502: "We couldn't reach the server. Try again in a moment.",
  503: "The service is busy right now. Try again in a moment.",
  504: "The server took too long to respond. Try again in a moment.",
};

/** Status 0 is this app's marker for "the request never reached a server". */
export const OFFLINE_MESSAGE =
  "We couldn't reach WorkPulse. Check your internet connection and try again.";

const GENERIC = "Something went wrong. Please try again.";

/**
 * Statuses where the server's own words are usually **better** than ours, because they name the one
 * thing that was wrong ("cannot remove the project manager — transfer management first"). A 403 is
 * excluded on purpose: permission errors read as accusations, and ours is kinder and just as true.
 */
const TRUST_SERVER_TEXT = new Set([400, 409, 422]);

/**
 * Text patterns that mean the message was written for a developer, not a user. A message matching
 * any of these is dropped in favour of the status text — better generic than frightening.
 */
const MACHINE_TEXT = [
  /exception/i,
  /\bpanic|unwrap|nil|null pointer|undefined\b/i,
  /\bstack\b|\bat [A-Za-z]+\.[a-z]+:\d+/i,
  /0x[0-9a-f]{4,}/i,
  /\b(dynamodb|lambda|cognito|serde|aws|sdk|axum|s3|sqs)\b/i,
  /^[A-Z][A-Za-z]*Error\b/,
];

/** Internal spec references that must never reach a user — e.g. "(LLD §4)", "(HLD §3)". */
const SPEC_REF = /\s*\((?:LLD|HLD|SPEC|PRD|TDD)[^)]*\)/g;

/**
 * Is this message fit to show someone? Length matters as much as content: a 400-character wall is a
 * dump, not a sentence, however polite its words.
 */
function looksHuman(msg: string): boolean {
  const t = msg.trim();
  if (t.length < 3 || t.length > 200) return false;
  return !MACHINE_TEXT.some((re) => re.test(t));
}

/**
 * Tidy a server sentence for display: drop internal spec references, turn `snake_case` field names
 * into words ("end_date must be…" → "End date must be…"), capitalise, and end with punctuation.
 */
function polish(msg: string): string {
  let t = msg.replace(SPEC_REF, "").trim();
  t = t.replace(/\b[a-z]+(?:_[a-z0-9]+)+\b/g, (w) => w.replace(/_/g, " "));
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (!/[.!?…]$/.test(t)) t += ".";
  return t;
}

/**
 * The message to put on an `ApiError`, given the status and whatever the server said.
 *
 * Called by `apiFetch` so that **every** `ApiError` in the app already carries display-ready text —
 * the 26 call sites that pass `e.message` through to a toast keep working and become friendly for
 * free.
 */
export function apiErrorMessage(status: number, serverMessage?: string): string {
  if (status === 0) return OFFLINE_MESSAGE;
  const raw = serverMessage?.trim();
  if (raw && TRUST_SERVER_TEXT.has(status) && looksHuman(raw)) return polish(raw);
  return BY_STATUS[status] ?? (status >= 500 ? BY_STATUS[500] : GENERIC);
}

/**
 * Cognito's error codes, in plain language.
 *
 * The SDK reports these as `code`/`name` on a plain `Error`, and its `message` is written for
 * developers ("Incorrect username or password." is fine; `NotAuthorizedException` is not). Sign-in
 * deliberately gives the **same** answer for a wrong password and an unknown account — telling them
 * apart would let anyone test which email addresses have accounts here.
 */
const COGNITO: Record<string, string> = {
  NotAuthorizedException: "That email or password isn't right. Try again.",
  UserNotFoundException: "That email or password isn't right. Try again.",
  UserNotConfirmedException:
    "Your account isn't confirmed yet. Check your email for the confirmation link.",
  PasswordResetRequiredException:
    "Your password needs to be reset before you can sign in.",
  CodeMismatchException: "That code isn't right. Check it and try again.",
  ExpiredCodeException: "That code has expired. Request a new one.",
  EnableSoftwareTokenMFAException:
    "That code isn't right or has expired. Try the current one from your authenticator app.",
  LimitExceededException:
    "Too many attempts. Wait a few minutes before trying again.",
  TooManyRequestsException:
    "Too many attempts. Wait a few minutes before trying again.",
  TooManyFailedAttemptsException:
    "Too many failed attempts. Wait a few minutes before trying again.",
  InvalidPasswordException:
    "That password doesn't meet the requirements: at least 8 characters, with an uppercase letter, a lowercase letter and a number.",
  UsernameExistsException: "An account with that email already exists.",
  InvalidParameterException: "Some of the details weren't accepted. Check them and try again.",
  UserLambdaValidationException:
    "We couldn't complete that. If you were invited, use the email address the invite was sent to.",
};

/** A network failure surfaces as a `TypeError` from `fetch` — "Failed to fetch" and friends. */
function isNetworkFailure(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return (
    e.name === "TypeError" &&
    /fetch|network|load failed|connection/i.test(e.message)
  );
}

/** Anything shaped like an AWS SDK error carries its code on `code` or `name`. */
function codeOf(e: unknown): string | undefined {
  if (typeof e !== "object" || e === null) return undefined;
  const o = e as { code?: unknown; name?: unknown };
  if (typeof o.code === "string") return o.code;
  if (typeof o.name === "string") return o.name;
  return undefined;
}

/**
 * The user-facing message for **any** thrown value.
 *
 * `fallback` is what to say when we can't do better — pass the one that names the action the user
 * was taking ("Couldn't save the role. Try again."), since that is always more useful than a generic
 * apology.
 *
 * `ApiError` instances already hold display-ready text (see {@link apiErrorMessage}), so they pass
 * straight through; everything else is matched against the Cognito table, the network check, and
 * finally the fallback.
 */
export function friendlyError(e: unknown, fallback: string = GENERIC): string {
  if (isNetworkFailure(e)) return OFFLINE_MESSAGE;

  // `ApiError` — built with a human message at the boundary. Duck-typed rather than imported so
  // this module stays dependency-free and `lib/api` can import it without a cycle.
  if (
    e instanceof Error &&
    typeof (e as { status?: unknown }).status === "number"
  ) {
    return e.message || fallback;
  }

  const code = codeOf(e);
  if (code && COGNITO[code]) return COGNITO[code];

  // A hand-written `throw new Error("…")` from our own code is usually already a sentence for the
  // user (form validation, a partial-save warning). Anything machine-looking falls back.
  if (e instanceof Error && e.message && looksHuman(e.message)) {
    return polish(e.message);
  }
  return fallback;
}
