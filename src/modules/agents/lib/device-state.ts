/**
 * A device's stored lifecycle (`DeviceView.state`): `active`, or one of the ways it stops being —
 * `deactivated` (its employee left), `released` (IT freed it), `revoked` (its credential was killed).
 *
 * The device page knew only `deactivated`, so a released or revoked device still read "Active" and
 * still offered Release, and pressing it changed nothing visible (QA audit 2026-10-08, WP-066).
 */
export function isLiveDevice(state: string | undefined): boolean {
  return !state || state === "active";
}

export function deviceStateLabel(state: string | undefined): string {
  switch (state) {
    case undefined:
    case "":
    case "active":
      return "Active";
    case "deactivated":
      return "Deactivated";
    case "released":
      return "Released";
    case "revoked":
      return "Revoked";
    default:
      return state.charAt(0).toUpperCase() + state.slice(1);
  }
}
