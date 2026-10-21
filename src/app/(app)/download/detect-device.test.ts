import { describe, expect, it } from "vitest";
import { detectDevice } from "./detect-device";

const UA = {
  win: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  linux: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  chromeos: "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
};

describe("detectDevice (UX audit SET-22)", () => {
  it("recognizes the three desktop platforms", () => {
    expect(detectDevice({ userAgent: UA.win, platform: "Win32" })).toEqual({ kind: "computer", os: "Windows" });
    expect(detectDevice({ userAgent: UA.mac, platform: "MacIntel", maxTouchPoints: 0 })).toEqual({ kind: "computer", os: "macOS" });
    expect(detectDevice({ userAgent: UA.linux, platform: "Linux x86_64" })).toEqual({ kind: "computer", os: "Linux" });
  });

  it("prefers client hints when the browser sends them", () => {
    expect(detectDevice({ userAgent: "", userAgentData: { platform: "Windows", mobile: false } })).toEqual({ kind: "computer", os: "Windows" });
    expect(detectDevice({ userAgent: UA.linux, userAgentData: { platform: "Android", mobile: true } })).toEqual({ kind: "mobile" });
  });

  it("treats phones and tablets as mobile — even though Android says Linux and iOS says Mac", () => {
    expect(detectDevice({ userAgent: UA.android, platform: "Linux armv81" })).toEqual({ kind: "mobile" });
    expect(detectDevice({ userAgent: UA.iphone, platform: "iPhone" })).toEqual({ kind: "mobile" });
    // iPadOS asks for the desktop site and reports itself as a Mac with a touch screen.
    expect(detectDevice({ userAgent: UA.mac, platform: "MacIntel", maxTouchPoints: 5 })).toEqual({ kind: "mobile" });
  });

  it("says unknown rather than guessing", () => {
    expect(detectDevice({ userAgent: UA.chromeos, platform: "Linux x86_64" })).toEqual({ kind: "unknown" });
    expect(detectDevice({ userAgent: "SomethingElse/1.0", platform: "" })).toEqual({ kind: "unknown" });
    expect(detectDevice(undefined)).toEqual({ kind: "unknown" });
  });
});
