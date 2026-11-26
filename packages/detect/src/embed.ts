import { ascii, u32be, u32le } from "./bytes.ts";

/**
 * Bettet einen maschinenlesbaren KI-Hinweis (XMP mit IPTC DigitalSourceType) in JPEG, PNG oder WebP ein.
 * Läuft im Browser und in Node, ohne Abhängigkeiten.
 */

export type EmbedSourceType = "trainedAlgorithmicMedia" | "compositeWithTrainedAlgorithmicMedia";

const IPTC_BASE = "http://cv.iptc.org/newscodes/digitalsourcetype/";
const XMP_JPEG_HEADER = "http://ns.adobe.com/xap/1.0/\0";

const enc = new TextEncoder();
const ascii4 = (b: Uint8Array, o: number) => ascii(b, o, 4);

/** Minimales XMP-Paket mit Iptc4xmpExt:DigitalSourceType. */
export function buildXmp(sourceType: EmbedSourceType): string {
  return [
    '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>',
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">',
    '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
    '<rdf:Description rdf:about=""',
    ' xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/"',
    ` Iptc4xmpExt:DigitalSourceType="${IPTC_BASE}${sourceType}"/>`,
    "</rdf:RDF>",
    "</x:xmpmeta>",
    '<?xpacket end="w"?>',
  ].join("\n");
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const be32 = (n: number) =>
  new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const le32 = (n: number) =>
  new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
const le24 = (n: number) => new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255]);

/** JPEG: APP1-XMP-Segment direkt nach SOI bzw. nach APP0 (JFIF) einfügen. */
export function embedXmpJpeg(bytes: Uint8Array, xmp: string): Uint8Array {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("Kein JPEG");
  const payload = concat(enc.encode(XMP_JPEG_HEADER), enc.encode(xmp));
  const len = payload.length + 2;
  if (len > 0xffff) throw new Error("XMP zu groß für ein JPEG-Segment");
  const segment = concat(new Uint8Array([0xff, 0xe1, len >> 8, len & 255]), payload);
  let at = 2;
  if (bytes[2] === 0xff && bytes[3] === 0xe0) at = 4 + ((bytes[4]! << 8) | bytes[5]!);
  return concat(bytes.subarray(0, at), segment, bytes.subarray(at));
}

let crcTable: Uint32Array | undefined;
/** CRC-32 (IEEE), wie in PNG und ZIP. */
export function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (const byte of data) c = crcTable[(c ^ byte) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** PNG: iTXt-Chunk "XML:com.adobe.xmp" direkt nach IHDR einfügen. */
export function embedXmpPng(bytes: Uint8Array, xmp: string): Uint8Array {
  if (u32be(bytes, 0) !== 0x89504e47 || ascii4(bytes, 12) !== "IHDR") throw new Error("Kein PNG");
  const ihdrEnd = 8 + 12 + u32be(bytes, 8);
  // keyword \0 compressionFlag compressionMethod lang \0 translated \0 text
  const data = concat(
    enc.encode("XML:com.adobe.xmp"),
    new Uint8Array([0, 0, 0, 0, 0]),
    enc.encode(xmp),
  );
  const typeAndData = concat(enc.encode("iTXt"), data);
  const chunk = concat(be32(data.length), typeAndData, be32(crc32(typeAndData)));
  return concat(bytes.subarray(0, ihdrEnd), chunk, bytes.subarray(ihdrEnd));
}

/** WebP: Container auf VP8X erweitern (falls nötig), XMP-Flag setzen, "XMP "-Chunk anhängen. */
export function embedXmpWebp(
  bytes: Uint8Array,
  xmp: string,
  width: number,
  height: number,
): Uint8Array {
  if (ascii4(bytes, 0) !== "RIFF" || ascii4(bytes, 8) !== "WEBP") throw new Error("Kein WebP");
  let body: Uint8Array = bytes.slice(12);
  if (ascii4(body, 0) === "VP8X") {
    body[8] = body[8]! | 0x04;
  } else {
    // Verlustfreies VP8L: Alpha-Bit steht im Bitstream-Header (Bit 28 nach der Signatur 0x2f).
    const lossless = ascii4(body, 0) === "VP8L" && body[8] === 0x2f;
    const flags = lossless && (u32le(body, 9) >>> 28) & 1 ? 0x10 : 0;
    const vp8x = concat(
      enc.encode("VP8X"),
      le32(10),
      new Uint8Array([flags | 0x04, 0, 0, 0]),
      le24(width - 1),
      le24(height - 1),
    );
    body = concat(vp8x, body);
  }
  const x = enc.encode(xmp);
  const xmpChunk = concat(
    enc.encode("XMP "),
    le32(x.length),
    x,
    x.length % 2 ? new Uint8Array([0]) : new Uint8Array(),
  );
  const all = concat(enc.encode("WEBP"), body, xmpChunk);
  return concat(enc.encode("RIFF"), le32(all.length), all);
}
