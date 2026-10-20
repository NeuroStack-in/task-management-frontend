import { describe, expect, it } from "vitest";
import { regionFrom } from "./signup-region";

/** ONB-04: the region step is gone — its values start from the browser. */
describe("regionFrom", () => {
  it("prefers the timezone's country over the language's", () => {
    expect(regionFrom("Asia/Kolkata", ["en-US"])).toEqual({
      country: "India",
      currency: "INR — Indian Rupee",
      timezone: "Asia/Kolkata",
    });
  });

  it("falls back to the language's explicit region", () => {
    expect(regionFrom("Europe/Vienna", ["de-AT", "en"])).toEqual({
      country: "Austria",
      // No currency mapped for Austria in the picker's short list — left for the applicant.
      currency: "",
      timezone: "Europe/Vienna",
    });
    expect(regionFrom("", ["en-GB"]).country).toBe("United Kingdom");
    expect(regionFrom("", ["zh-Hant-TW"]).country).toBe("Taiwan");
  });

  it("never guesses a country from a bare language", () => {
    expect(regionFrom("UTC", ["en", "fr"])).toEqual({ country: "", currency: "", timezone: "UTC" });
  });
});
