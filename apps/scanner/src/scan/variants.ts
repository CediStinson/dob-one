/**
 * Fasst Größenvarianten eines Bildes zusammen (WordPress: bild-300x200.jpg, bild-1024x682.jpg).
 * Bevorzugt das Original ohne Größenzusatz, sonst die größte Variante: Verkleinerungen
 * verlieren oft die Metadaten, und so braucht der Check weniger /img-Abrufe.
 */

export interface ImageEntry {
  src: string;
  pages: string[];
  /** Weitere URLs desselben Bildes in anderen Größen. */
  variants?: string[];
}

const SIZE = /-(\d{2,5})x(\d{2,5})(\.[a-z0-9]{2,5})$/i;

const baseKey = (u: string): { key: string; area: number } => {
  const url = new URL(u);
  const m = SIZE.exec(url.pathname);
  if (!m) return { key: `${url.origin}${url.pathname}`, area: Number.POSITIVE_INFINITY };
  url.pathname = url.pathname.replace(SIZE, "$3");
  return { key: `${url.origin}${url.pathname}`, area: Number(m[1]) * Number(m[2]) };
};

export function groupVariants(images: Map<string, Set<string>>, maxPages: number): ImageEntry[] {
  const groups = new Map<
    string,
    { best: string; area: number; all: string[]; pages: Set<string> }
  >();
  for (const [src, pages] of images) {
    const { key, area } = baseKey(src);
    const g = groups.get(key);
    if (!g) {
      groups.set(key, { best: src, area, all: [src], pages: new Set(pages) });
      continue;
    }
    g.all.push(src);
    for (const p of pages) if (g.pages.size < maxPages) g.pages.add(p);
    if (area > g.area) {
      g.best = src;
      g.area = area;
    }
  }
  return [...groups.values()].map((g) => {
    const variants = g.all.filter((s) => s !== g.best);
    const entry: ImageEntry = { src: g.best, pages: [...g.pages] };
    if (variants.length > 0) entry.variants = variants;
    return entry;
  });
}
