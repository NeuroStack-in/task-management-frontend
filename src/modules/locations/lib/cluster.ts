/**
 * Screen-space grouping for the Locations board's map (UX audit 2026-10-16, MON-22).
 *
 * Avatars that land within a few pixels of each other — everyone at the office, say — drew on top of
 * one another, so the map showed one face for a dozen people and the rest could not be reached. The
 * board groups markers that overlap **on screen at the current zoom** into one numbered bubble that
 * zooms in to separate them.
 *
 * Grouped here rather than with MapLibre's GeoJSON clustering: the markers are HTML avatars (photo,
 * online dot, alert ring), which a GeoJSON symbol layer cannot draw, and the board shows at most a
 * few hundred people — a pairwise pass per zoom change is far cheaper than it sounds.
 */

export interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * Greedy grouping: each point not yet taken seeds a group, which takes every later untaken point
 * within `radiusPx` of the seed. Deterministic for a given input order (the board passes its rows in
 * name order), so a re-render never reshuffles who is grouped with whom.
 *
 * Returns groups of **indices** into `points`; every index appears in exactly one group, singletons
 * included, in first-seen order.
 */
export function clusterIndices(points: readonly ScreenPoint[], radiusPx: number): number[][] {
  const taken = new Array<boolean>(points.length).fill(false);
  const r2 = radiusPx * radiusPx;
  const groups: number[][] = [];
  for (let i = 0; i < points.length; i++) {
    if (taken[i]) continue;
    taken[i] = true;
    const group = [i];
    for (let j = i + 1; j < points.length; j++) {
      if (taken[j]) continue;
      const dx = points[j].x - points[i].x;
      const dy = points[j].y - points[i].y;
      if (dx * dx + dy * dy <= r2) {
        taken[j] = true;
        group.push(j);
      }
    }
    groups.push(group);
  }
  return groups;
}

/** "Ana, Ben and 3 others" — who a bubble holds, for its accessible name and tooltip. */
export function clusterNames(names: readonly string[], shown = 3): string {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length <= shown) {
    return `${clean.slice(0, -1).join(", ")} and ${clean[clean.length - 1]}`;
  }
  const rest = clean.length - shown;
  return `${clean.slice(0, shown).join(", ")} and ${rest} ${rest === 1 ? "other" : "others"}`;
}
