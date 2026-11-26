import { concat, startsWith, u16be, u32be, utf8 } from "../bytes.ts";
import { emptyRaw, type RawMetadata } from "./types.ts";

const XMP_HEADER = "http://ns.adobe.com/xap/1.0/\0";

/** Liest APP1 (EXIF, XMP) und APP11 (JUMBF/C2PA) aus einem JPEG. Toleriert abgeschnittene Daten. */
export function parseJpeg(b: Uint8Array): RawMetadata {
  const raw = emptyRaw();
  const jumbfParts = new Map<number, Uint8Array[]>();
  let o = 2;
  while (o + 4 <= b.length) {
    if (b[o] !== 0xff) break;
    const marker = b[o + 1] ?? 0;
    if (marker === 0xff) {
      o++;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break; // EOI oder Start of Scan: keine Metadaten mehr
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      o += 2;
      continue;
    }
    const len = u16be(b, o + 2);
    if (len < 2) break;
    const start = o + 4;
    const payload = b.subarray(start, Math.min(b.length, o + 2 + len));
    if (marker === 0xe1) {
      if (startsWith(payload, 0, "Exif\0\0")) raw.exif.push(payload.subarray(6));
      else if (startsWith(payload, 0, XMP_HEADER)) {
        raw.xmp.push(utf8(payload.subarray(XMP_HEADER.length)));
      }
    } else if (marker === 0xeb && startsWith(payload, 0, "JP")) {
      // JPEG XT: "JP", Box-Instanz (2), Paketnummer (4), dann JUMBF. Folgesegmente wiederholen LBox/TBox.
      const instance = u16be(payload, 2);
      const seq = u32be(payload, 4);
      const parts = jumbfParts.get(instance) ?? [];
      parts.push(payload.subarray(seq <= 1 || parts.length === 0 ? 8 : 16));
      jumbfParts.set(instance, parts);
    }
    o += 2 + len;
  }
  for (const parts of jumbfParts.values()) raw.jumbf.push(concat(parts));
  return raw;
}
