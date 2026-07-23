/**
 * Minimal ZIP archive builder — STORE only (no compression), enough for "download all" bundles of
 * files that are already compressed (WebP screenshots) or tiny (JSONL). Deliberately dependency-free
 * per house style (same reason the avatar flow does canvas WebP by hand): the classic ZIP layout is
 * ~three record types, and STORE needs no deflate.
 *
 * Layout written: [local header + data]* → [central directory]* → end-of-central-directory. No
 * Zip64, so keep archives < 4 GB and < 65k entries — orders of magnitude above what an org export
 * bundle is.
 */

/** CRC-32 (IEEE 802.3), table-driven — the checksum ZIP requires per entry. */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** MS-DOS date/time pair (what ZIP headers carry), from a JS Date. */
function dosDateTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

export interface ZipEntry {
  /** Forward-slash path inside the archive (e.g. `screenshots/u1/a.webp`). */
  name: string;
  data: Uint8Array;
}

/** Build a STORE-only ZIP from `entries`. Returns a Blob ready for a download link. */
export function buildZip(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime(new Date());
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    // Local file header. Flag bit 11 = the name is UTF-8.
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0x0800, true); // flags: UTF-8 names
    local.setUint16(8, 0, true); // method: STORE
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true); // compressed == uncompressed (STORE)
    local.setUint32(22, size, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true); // extra length
    parts.push(new Uint8Array(local.buffer), name, entry.data);

    // Matching central-directory record, pointing back at the local header's offset.
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true); // version made by
    cd.setUint16(6, 20, true); // version needed
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, time, true);
    cd.setUint16(14, date, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, size, true);
    cd.setUint32(24, size, true);
    cd.setUint16(28, name.length, true);
    // extra/comment/disk/attrs all zero (30..38)
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), name);

    offset += 30 + name.length + size;
  }

  const centralSize = central.reduce((n, p) => n + p.length, 0);
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(8, entries.length, true); // entries on this disk
  eocd.setUint16(10, entries.length, true); // entries total
  eocd.setUint32(12, centralSize, true);
  eocd.setUint32(16, offset, true); // central directory starts where the data ended
  eocd.setUint16(20, 0, true); // comment length

  // One contiguous buffer (also sidesteps TS 5.7's Uint8Array<ArrayBufferLike> vs BlobPart nit).
  const all = [...parts, ...central, new Uint8Array(eocd.buffer)];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let pos = 0;
  for (const p of all) {
    out.set(p, pos);
    pos += p.length;
  }
  return new Blob([out.buffer], { type: "application/zip" });
}
