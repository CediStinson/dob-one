import { ascii, latin1 } from "./bytes.ts";

/** Relevante ASCII-Tags aus IFD0. */
const TAGS: Record<number, string> = {
  0x010e: "ImageDescription",
  0x010f: "Make",
  0x0110: "Model",
  0x0131: "Software",
  0x013b: "Artist",
  0x8298: "Copyright",
};

/** Liest ASCII-Tags aus IFD0 einer TIFF-Struktur. Gibt bei Fehlern ein leeres Objekt zurück. */
export function parseExif(tiff: Uint8Array): Record<string, string> {
  const out: Record<string, string> = {};
  const order = ascii(tiff, 0, 2);
  if (order !== "II" && order !== "MM") return out;
  const le = order === "II";
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const u16 = (o: number) => (o >= 0 && o + 2 <= tiff.length ? view.getUint16(o, le) : -1);
  const u32 = (o: number) => (o >= 0 && o + 4 <= tiff.length ? view.getUint32(o, le) : -1);

  const ifd = u32(4);
  const count = u16(ifd);
  if (ifd < 8 || count < 0) return out;
  for (let i = 0; i < count && i < 512; i++) {
    const entry = ifd + 2 + i * 12;
    const tag = u16(entry);
    const type = u16(entry + 2);
    const n = u32(entry + 4);
    const name = TAGS[tag];
    if (tag < 0 || !name || type !== 2 || n <= 0) continue; // nur ASCII
    const valueOffset = n <= 4 ? entry + 8 : u32(entry + 8);
    if (valueOffset < 0 || valueOffset >= tiff.length) continue;
    const value = latin1(tiff.subarray(valueOffset, Math.min(tiff.length, valueOffset + n)))
      .replace(/\0+$/, "")
      .trim();
    if (value) out[name] = value;
  }
  return out;
}
