/**
 * After navigating to a `path#anchor`, smooth-scroll the matching element into
 * view once the destination section has rendered. No-op when the href has no
 * hash. Retries briefly so it also works across a route change (the target
 * page may not be mounted on the first frame).
 */
export function scrollToHashAfterNav(href: string) {
  const hash = href.split("#")[1];
  if (!hash) return;
  let tries = 0;
  const tick = () => {
    const el = document.getElementById(hash);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (tries++ < 25) {
      setTimeout(tick, 60);
    }
  };
  setTimeout(tick, 60);
}
