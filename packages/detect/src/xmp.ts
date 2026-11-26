/** Felder, die wir aus XMP lesen. Schlüssel: Präfix:Name wie in der Praxis üblich. */
export const XMP_FIELDS = [
  "Iptc4xmpExt:DigitalSourceType",
  "xmp:CreatorTool",
  "tiff:Software",
  "photoshop:Credit",
  "dc:creator",
  "dc:description",
  "plus:DataMining",
] as const;

export type XmpField = (typeof XMP_FIELDS)[number];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const decodeEntities = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");

/**
 * Liest Werte aus einem XMP-Paket. Unterstützt Attribut-Form (ns:Feld="x"),
 * Element-Form (<ns:Feld>x</ns:Feld>), rdf:resource und rdf:Alt/Seq/Bag-Listen.
 * Bewusst ohne XML-Parser: robust gegen abgeschnittene Pakete.
 */
export function parseXmp(xmp: string): Partial<Record<XmpField, string>> {
  const out: Partial<Record<XmpField, string>> = {};
  for (const field of XMP_FIELDS) {
    const f = escapeRe(field);
    const attr = new RegExp(`${f}\\s*=\\s*(["'])([^"']*)\\1`).exec(xmp);
    const elem = new RegExp(`<${f}(\\s[^>]*)?>([\\s\\S]*?)</${f}>`).exec(xmp);
    const res = new RegExp(`<${f}\\s[^>]*rdf:resource\\s*=\\s*(["'])([^"']*)\\1`).exec(xmp);
    let value = attr?.[2] ?? res?.[2];
    if (value === undefined && elem) {
      const inner = elem[2] ?? "";
      const li = /<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/.exec(inner);
      value = (li ? li[1] : inner) ?? "";
    }
    if (value !== undefined) {
      const clean = decodeEntities(value.replace(/<[^>]+>/g, "")).trim();
      if (clean) out[field] = clean;
    }
  }
  return out;
}

/** Findet XMP-Pakete im Rohtext (Fallback für Formate ohne eigenen Container-Parser). */
export function findXmpPackets(text: string): string[] {
  const out: string[] = [];
  const re = /<x:xmpmeta[\s\S]*?(<\/x:xmpmeta>|$)/g;
  for (const m of text.matchAll(re)) out.push(m[0]);
  return out;
}
