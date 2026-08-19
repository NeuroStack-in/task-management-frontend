import { describe, expect, it } from "vitest";
import { isUuid, personName, REMOVED_PERSON } from "./format";

/**
 * `format.ts` states the rule: "Opaque UUIDs are never shown in the UI." `personName` is where that
 * is enforced for people, after several call sites wrote `directory.find(...)?.name ?? id` and
 * rendered a bare Cognito `sub` — most visibly as two selectable "people" in the project-lead picker.
 */
describe("personName", () => {
  it("returns a real name unchanged", () => {
    expect(personName("Arshiya Sayyed")).toBe("Arshiya Sayyed");
  });

  it("trims, because a padded name is still a name", () => {
    expect(personName("  Balaji P  ")).toBe("Balaji P");
  });

  it("never renders a raw id when the directory has no record", () => {
    for (const missing of [undefined, null, "", "   "]) {
      expect(personName(missing)).toBe(REMOVED_PERSON);
    }
  });

  it("refuses a UUID even when handed one AS the name", () => {
    // Belt-and-braces: a server that ever echoes the id into the name field must not defeat this.
    const sub = "31539d4a-f011-707f-b79b-0c26b3e13abc";
    expect(isUuid(sub)).toBe(true);
    expect(personName(sub)).toBe(REMOVED_PERSON);
  });

  it("honours a caller's own fallback, for surfaces where absence means something else", () => {
    // A scope-limited directory (screenshots) means "not visible to you", not "deleted".
    expect(personName(undefined, "Outside your directory")).toBe(
      "Outside your directory",
    );
  });
});
