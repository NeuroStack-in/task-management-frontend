/**
 * Reads that several Organization-page cards make at the same moment, shared while in flight.
 *
 * The page mounts Departments and Teams together, and Working days and Working hours together, and
 * each card used to issue its own copy of the same read: two full directory walks (each listing the
 * departments again) and two schedule reads on every visit, alongside a dozen other requests — the
 * burst shape that trips the API's 503/429 throttle (QA audit 2026-10-08, WP-539). A card that asks
 * while the same read is pending joins it; any later call (a Retry, a refresh after a save) starts
 * a fresh one, so nothing here is a cache.
 */
import { readRoster } from "@/modules/employees/services/employees.service";
import { getWorkingHours } from "../services/org.service";

export function sharedWhileInflight<T>(read: () => Promise<T>): () => Promise<T> {
  let inflight: Promise<T> | null = null;
  return () => {
    if (!inflight) {
      inflight = read().finally(() => {
        inflight = null;
      });
    }
    return inflight;
  };
}

/** The whole roster plus the departments it walked, and whether any of it went unread. */
export const readRosterShared = sharedWhileInflight(readRoster);

/** `GET /v1/org/working-hours`, shared by the Working days and Working hours cards. */
export const getWorkingHoursShared = sharedWhileInflight(getWorkingHours);
