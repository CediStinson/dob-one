/** Kleine, fehlertolerante Byte-Helfer. Lesen nie über das Ende hinaus. */

export const ascii = (bytes: Uint8Array, start: number, length: number): string => {
  let out = "";
  const end = Math.min(bytes.length, start + length);
  for (let i = Math.max(0, start); i < end; i++) out += String.fromCharCode(bytes[i] ?? 0);
  return out;
};

/** Latin-1-Dekodierung: jedes Byte wird genau ein Zeichen (Index bleibt gleich). */
export const latin1 = (bytes: Uint8Array): string => new TextDecoder("latin1").decode(bytes);

export const utf8 = (bytes: Uint8Array): string => new TextDecoder("utf-8").decode(bytes);

export const u16be = (b: Uint8Array, o: number): number =>
  o + 1 < b.length ? ((b[o] ?? 0) << 8) | (b[o + 1] ?? 0) : -1;

export const u32be = (b: Uint8Array, o: number): number =>
  o + 3 < b.length
    ? (((b[o] ?? 0) << 24) | ((b[o + 1] ?? 0) << 16) | ((b[o + 2] ?? 0) << 8) | (b[o + 3] ?? 0)) >>>
      0
    : -1;

export const u32le = (b: Uint8Array, o: number): number =>
  o + 3 < b.length
    ? ((b[o] ?? 0) | ((b[o + 1] ?? 0) << 8) | ((b[o + 2] ?? 0) << 16) | ((b[o + 3] ?? 0) << 24)) >>>
      0
    : -1;

export const startsWith = (b: Uint8Array, offset: number, text: string): boolean =>
  ascii(b, offset, text.length) === text;

export function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}
