import { describe, expect, it } from "vitest"
import { DEPARTMENTS_HREF, ORG_SECTIONS, sectionFromHash } from "./org-sections"

/**
 * UX audit PEOPLE-22: Departments got a tab of its own, linked from People. The tab's key changed
 * from `structure` to `departments`, so every link already out there must still land on it.
 */
describe("sectionFromHash", () => {
  it("opens each tab by its own key, with or without the #", () => {
    for (const s of ORG_SECTIONS) {
      expect(sectionFromHash(`#${s.key}`)).toBe(s.key)
      expect(sectionFromHash(s.key)).toBe(s.key)
    }
  })

  it("keeps old #structure links and the #teams card anchor on the Departments tab", () => {
    expect(sectionFromHash("#structure")).toBe("departments")
    expect(sectionFromHash("#teams")).toBe("departments")
  })

  it("ignores anything else, including inherited object keys", () => {
    expect(sectionFromHash("")).toBeNull()
    expect(sectionFromHash("#mfa")).toBeNull()
    expect(sectionFromHash("#constructor")).toBeNull()
    expect(sectionFromHash("#toString")).toBeNull()
  })

  it("the link People uses opens the Departments tab", () => {
    expect(sectionFromHash(new URL(DEPARTMENTS_HREF, "https://x.test").hash)).toBe("departments")
    expect(ORG_SECTIONS.find((s) => s.key === "departments")?.label).toBe("Departments")
  })
})
