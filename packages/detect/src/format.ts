export type ImageFormat = "jpeg" | "png" | "webp" | "gif" | "avif" | "unknown";

const ascii = (bytes: Uint8Array, start: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(start, start + length));

/** Erkennt das Bildformat anhand der Magic Bytes. */
export function sniffFormat(bytes: Uint8Array): ImageFormat {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  if (bytes.length >= 8 && ascii(bytes, 1, 3) === "PNG" && bytes[0] === 0x89) return "png";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return "webp";
  }
  if (bytes.length >= 6 && ascii(bytes, 0, 3) === "GIF") return "gif";
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4);
    if (brand === "avif" || brand === "avis") return "avif";
  }
  return "unknown";
}
