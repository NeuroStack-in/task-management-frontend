import { describe, expect, it } from "vitest";

import { labelFromUserAgent } from "./device";

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1",
  iphoneFirefox:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/124.0 Mobile/15E148 Safari/605.1.15",
  ipadDesktopMode:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  macChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  winEdge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
};

describe("labelFromUserAgent", () => {
  it("labels iPhones as iOS, not macOS, whatever the browser", () => {
    expect(labelFromUserAgent(UA.iphoneSafari)).toBe("Safari on iOS");
    expect(labelFromUserAgent(UA.iphoneChrome)).toBe("Chrome on iOS");
    expect(labelFromUserAgent(UA.iphoneFirefox)).toBe("Firefox on iOS");
  });

  it("tells an iPad in desktop mode from a Mac by its touch screen", () => {
    expect(labelFromUserAgent(UA.ipadDesktopMode, 5)).toBe("Safari on iOS");
    expect(labelFromUserAgent(UA.ipadDesktopMode, 0)).toBe("Safari on macOS");
  });

  it("keeps the desktop and Android labels", () => {
    expect(labelFromUserAgent(UA.macChrome)).toBe("Chrome on macOS");
    expect(labelFromUserAgent(UA.winEdge)).toBe("Edge on Windows");
    expect(labelFromUserAgent(UA.androidChrome)).toBe("Chrome on Android");
  });
});
