import { ascii, u32le, utf8 } from "../bytes.ts";
import { emptyRaw, type RawMetadata } from "./types.ts";

/** Liest die RIFF-Chunks "EXIF", "XMP " und "C2PA" aus einem WebP. */
export function parseWebp(b: Uint8Array): RawMetadata {
  const raw = emptyRaw();
  let o = 12;
  while (o + 8 <= b.length) {
    const type = ascii(b, o, 4);
    const len = u32le(b, o + 4);
    if (len < 0) break;
    const data = b.subarray(o + 8, Math.min(b.length, o + 8 + len));
    if (type === "EXIF") raw.exif.push(stripExifHeader(data));
    else if (type === "XMP ") raw.xmp.push(utf8(data));
    else if (type === "C2PA") raw.jumbf.push(data);
    o += 8 + len + (len % 2);
  }
  return raw;
}

const stripExifHeader = (d: Uint8Array): Uint8Array =>
  ascii(d, 0, 6) === "Exif\0\0" ? d.subarray(6) : d;
