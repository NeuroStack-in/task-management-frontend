import { describe, expect, it } from "vitest";

import { buildZip, ZIP_MAX_ENTRIES, ZipTooLargeError } from "./zip";

/** jsdom's Blob has no `arrayBuffer()`; FileReader does the same job. */
function bytesOf(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(blob);
  });
}

/** End-of-central-directory fields of a built archive (no comment, so it is the last 22 bytes). */
async function eocd(blob: Blob) {
  const buf = new DataView(await bytesOf(blob));
  const at = buf.byteLength - 22;
  return {
    signature: buf.getUint32(at, true),
    entries: buf.getUint16(at + 10, true),
    cdOffset: buf.getUint32(at + 16, true),
  };
}

describe("buildZip", () => {
  it("writes a readable directory for a small archive", async () => {
    const enc = new TextEncoder();
    const blob = buildZip([
      { name: "a.txt", data: enc.encode("hello") },
      { name: "b/c.json", data: enc.encode("{}") },
    ]);
    const end = await eocd(blob);
    expect(end.signature).toBe(0x06054b50);
    expect(end.entries).toBe(2);
    // Two local headers (30 bytes + name) plus their data precede the central directory.
    expect(end.cdOffset).toBe(30 + 5 + 5 + (30 + 8 + 2));
  });

  /** WP-351: past the 16-bit entry count the header wrapped and the archive was silently corrupt. */
  it("refuses more entries than the format can count", () => {
    const entries = Array.from({ length: ZIP_MAX_ENTRIES + 1 }, (_, i) => ({
      name: `f${i}`,
      data: new Uint8Array(0),
    }));
    expect(() => buildZip(entries)).toThrow(ZipTooLargeError);
  });
});
