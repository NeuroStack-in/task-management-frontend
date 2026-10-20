import { describe, expect, it } from "vitest"
import {
  captureLock,
  capturing,
  RETENTION_PRESETS,
  retentionLabel,
  retentionOptions,
} from "./monitoring-capture"

const on = { screenshotsOn: true, screenshotsInPlan: true }

/** SET-03: the page read only the Activity switch, and blamed it for the Screenshots switch. */
describe("captureLock", () => {
  it("is open when both switches are on", () => {
    expect(captureLock(on)).toBeNull()
    expect(capturing(null)).toBe(true)
  })

  it("names the Screenshots switch when it is off — and nothing is captured", () => {
    const lock = captureLock({ ...on, screenshotsOn: false })
    expect(lock).toEqual({ kind: "screenshots-off" })
    expect(capturing(lock)).toBe(false)
  })

  it("names the plan when screenshots aren't in it", () => {
    expect(captureLock({ ...on, screenshotsOn: false, screenshotsInPlan: false })).toEqual({
      kind: "screenshots-not-in-plan",
    })
  })

})

/** SET-04: presets instead of a one-day stepper, without losing a stored odd value. */
describe("retentionOptions", () => {
  it("offers the presets", () => {
    expect(retentionOptions(90)).toEqual([...RETENTION_PRESETS])
  })

  it("keeps a stored value that isn't a preset, in order", () => {
    expect(retentionOptions(45)).toEqual([7, 30, 45, 90, 180, 365])
    expect(retentionOptions(1)).toEqual([1, 7, 30, 90, 180, 365])
  })

  it("ignores nonsense", () => {
    expect(retentionOptions(0)).toEqual([...RETENTION_PRESETS])
    expect(retentionOptions(Number.NaN)).toEqual([...RETENTION_PRESETS])
  })

  it("labels the server default and a year", () => {
    expect(retentionLabel(90)).toBe("90 days (default)")
    expect(retentionLabel(365)).toBe("1 year")
    expect(retentionLabel(1)).toBe("1 day")
  })
})
