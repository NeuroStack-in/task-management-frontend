/**
 * Rule order for the app/URL classification lists — pure helpers for the rules editor.
 *
 * The agents and the server match a target against these lists **case-insensitively by substring,
 * first match wins, in list order** (`wp-agent-contract` config.rs: "Order is load-bearing"). So
 * where a rule sits decides whether it can ever fire: one placed after a more general rule
 * ("notepad++" after "notepad", "calendar.google.com" after "google.com") never matches anything,
 * while the table still showed it as active (QA audit 2026-10-08, WP-342).
 */

const norm = (s: string) => s.trim().toLowerCase();

/** Add `rule` where it can match: just above the first rule that would catch it first, else last. */
export function insertRule<T>(list: T[], rule: T, matcher: (r: T) => string): T[] {
  const m = norm(matcher(rule));
  const at = list.findIndex((r) => {
    const other = norm(matcher(r));
    return other !== "" && m.includes(other);
  });
  return at < 0 ? [...list, rule] : [...list.slice(0, at), rule, ...list.slice(at)];
}

/**
 * For each rule that an earlier rule always catches first, that earlier rule's matcher — the rule
 * itself can never fire. `null` where the rule is reachable. Index-aligned with `list`.
 */
export function shadowedBy<T>(list: T[], matcher: (r: T) => string): (string | null)[] {
  return list.map((r, i) => {
    const m = norm(matcher(r));
    if (!m) return null;
    for (let j = 0; j < i; j++) {
      const other = norm(matcher(list[j]));
      if (other && m.includes(other)) return matcher(list[j]);
    }
    return null;
  });
}

/** Move the rule at `index` just above the first earlier rule that catches it first. */
export function unshadow<T>(list: T[], index: number, matcher: (r: T) => string): T[] {
  return insertRule(
    list.filter((_, i) => i !== index),
    list[index],
    matcher,
  );
}

/**
 * Would any of these rules match `target` (an app name as the agents report it)? URL rules are
 * tried too, as the server's `classify` does.
 */
export function matchesAnyRule(
  target: string,
  apps: { process_name: string }[],
  urls: { domain: string }[],
): boolean {
  const t = norm(target);
  const hit = (m: string) => {
    const n = norm(m);
    return n !== "" && t.includes(n);
  };
  return urls.some((u) => hit(u.domain)) || apps.some((a) => hit(a.process_name));
}
