import { latin1 } from "./bytes.ts";
import { findSourceTypeCodes } from "./iptc.ts";

export interface C2paInfo {
  /** claim_generator bzw. claim_generator_info.name, falls lesbar. */
  generators: string[];
  /** Digital-Source-Type-Codes aus c2pa.actions. */
  sourceTypes: string[];
}

/** Prüft, ob JUMBF-Daten ein C2PA-Manifest enthalten. */
export const isC2pa = (jumbf: Uint8Array): boolean => /jumd[\s\S]{0,40}c2pa/.test(latin1(jumbf));

/**
 * Liest ohne vollständigen CBOR-Parser die Felder, die wir brauchen. Die Werte stehen als
 * CBOR-Textstrings direkt hinter ihrem Schlüssel.
 */
export function parseC2pa(jumbf: Uint8Array): C2paInfo {
  const text = latin1(jumbf);
  const generators = new Set<string>();
  for (const m of text.matchAll(/claim_generator(?!_)/g)) {
    const v = readCborText(jumbf, m.index + m[0].length);
    if (v) generators.add(v);
  }
  for (const m of text.matchAll(/claim_generator_info/g)) {
    const window = text.slice(m.index, m.index + 400);
    const name = /\x64name/.exec(window); // CBOR-Text "name"
    if (name) {
      const v = readCborText(jumbf, m.index + name.index + 5);
      if (v) generators.add(v);
    }
  }
  return { generators: [...generators], sourceTypes: findSourceTypeCodes(text) };
}

/** Liest einen CBOR-Textstring (Major Type 3) an Position pos. */
function readCborText(b: Uint8Array, pos: number): string | undefined {
  const head = b[pos];
  if (head === undefined || head >> 5 !== 3) return undefined;
  const info = head & 0x1f;
  let len: number;
  let start = pos + 1;
  if (info < 24) len = info;
  else if (info === 24) {
    len = b[pos + 1] ?? 0;
    start = pos + 2;
  } else if (info === 25) {
    len = ((b[pos + 1] ?? 0) << 8) | (b[pos + 2] ?? 0);
    start = pos + 3;
  } else return undefined;
  if (start + len > b.length) return undefined;
  return new TextDecoder().decode(b.subarray(start, start + len));
}
