import { ascii, latin1, startsWith, u32be, utf8 } from "../bytes.ts";
import { emptyRaw, type RawMetadata } from "./types.ts";

/** Liest tEXt, iTXt, zTXt (nur Keyword), eXIf und caBX (C2PA) aus einem PNG. */
export function parsePng(b: Uint8Array): RawMetadata {
  const raw = emptyRaw();
  let o = 8;
  while (o + 8 <= b.length) {
    const len = u32be(b, o);
    if (len < 0) break;
    const type = ascii(b, o + 4, 4);
    const data = b.subarray(o + 8, Math.min(b.length, o + 8 + len));
    if (type === "tEXt" || type === "zTXt") {
      const nul = data.indexOf(0);
      if (nul > 0) {
        const keyword = latin1(data.subarray(0, nul));
        const compressed = type === "zTXt";
        raw.text.push({
          keyword,
          value: compressed ? "" : latin1(data.subarray(nul + 1)),
          compressed,
        });
      }
    } else if (type === "iTXt") {
      pushItxt(raw, data);
    } else if (type === "eXIf") {
      raw.exif.push(data);
    } else if (type === "caBX") {
      raw.jumbf.push(data);
    } else if (type === "IEND") {
      break;
    }
    o += 12 + len;
  }
  return raw;
}

function pushItxt(raw: RawMetadata, data: Uint8Array): void {
  const nul = data.indexOf(0);
  if (nul <= 0) return;
  const keyword = latin1(data.subarray(0, nul));
  const compressed = data[nul + 1] === 1;
  // Danach: Kompressionsmethode (1), Sprache\0, übersetztes Keyword\0, Text
  let p = nul + 3;
  for (let i = 0; i < 2; i++) {
    const end = data.indexOf(0, p);
    if (end < 0) return;
    p = end + 1;
  }
  const value = compressed ? "" : utf8(data.subarray(p));
  if (keyword === "XML:com.adobe.xmp" && value) raw.xmp.push(value);
  else raw.text.push({ keyword, value, compressed });
}

export const isPng = (b: Uint8Array): boolean => b[0] === 0x89 && startsWith(b, 1, "PNG");
