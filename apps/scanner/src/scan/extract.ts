/**
 * Sammelt beim Streamen einer HTML-Seite Bild-URLs, Links, Skripte und iframes.
 * Arbeitet nur mit Element-Handlern (HTMLRewriter), baut keinen DOM-Baum: wenig CPU.
 */

export interface El {
  tagName: string;
  getAttribute(name: string): string | null;
}

export interface ElementHandler {
  element(el: El): void;
}

/** Minimal-Schnittstelle: Workers-HTMLRewriter in Produktion, WASM-Variante in Tests. */
export type HtmlParser = (
  body: ReadableStream<Uint8Array>,
  handlers: [selector: string, handler: ElementHandler][],
) => Promise<void>;

export interface PageData {
  images: string[];
  links: string[];
  scripts: string[];
  iframes: string[];
  base?: string;
}

export const SELECTORS = [
  "base[href]",
  "img",
  "source[srcset]",
  "meta[property='og:image']",
  "a[href]",
  "script[src]",
  "iframe[src]",
] as const;

/** Liefert URLs aus srcset ("a.jpg 1x, b.jpg 2x"), Tokenizer nach HTML-Spec vereinfacht. */
export function parseSrcset(srcset: string): string[] {
  const out: string[] = [];
  let i = 0;
  const n = srcset.length;
  while (i < n) {
    while (i < n && /[\s,]/.test(srcset[i] ?? "")) i++;
    const start = i;
    while (i < n && !/\s/.test(srcset[i] ?? "")) i++;
    let url = srcset.slice(start, i);
    if (url.endsWith(",")) url = url.replace(/,+$/, "");
    else {
      // Deskriptoren ("2x", "640w") bis zum nächsten Komma überspringen.
      while (i < n && srcset[i] !== ",") i++;
    }
    if (url !== "" && !url.startsWith("data:")) out.push(url);
  }
  return out;
}

export function createCollector(): { data: PageData; handler: ElementHandler } {
  const data: PageData = { images: [], links: [], scripts: [], iframes: [] };
  const handler: ElementHandler = {
    element(el) {
      const tag = el.tagName.toLowerCase();
      const attr = (n: string) => el.getAttribute(n)?.trim() || undefined;
      switch (tag) {
        case "base": {
          const h = attr("href");
          if (h && data.base === undefined) data.base = h;
          break;
        }
        case "img": {
          // Lazy-Loading-Plugins legen die echte URL oft in data-src ab.
          for (const n of ["src", "data-src", "data-lazy-src"]) {
            const v = attr(n);
            if (v && !v.startsWith("data:")) data.images.push(v);
          }
          for (const n of ["srcset", "data-srcset"]) {
            const v = attr(n);
            if (v) data.images.push(...parseSrcset(v));
          }
          break;
        }
        case "source": {
          const v = attr("srcset");
          const type = attr("type") ?? "";
          if (v && (type === "" || type.startsWith("image/"))) data.images.push(...parseSrcset(v));
          break;
        }
        case "meta": {
          const v = attr("content");
          if (v) data.images.push(v);
          break;
        }
        case "a": {
          const v = attr("href");
          if (v && !/^(mailto|tel|javascript|data):/i.test(v) && !v.startsWith("#"))
            data.links.push(v);
          break;
        }
        case "script": {
          const v = attr("src");
          if (v) data.scripts.push(v);
          break;
        }
        case "iframe": {
          const v = attr("src");
          if (v && !v.startsWith("about:")) data.iframes.push(v);
          break;
        }
      }
    },
  };
  return { data, handler };
}

export async function extractPage(
  body: ReadableStream<Uint8Array>,
  parse: HtmlParser,
): Promise<PageData> {
  const { data, handler } = createCollector();
  await parse(
    body,
    SELECTORS.map((s) => [s, handler]),
  );
  return data;
}

/** Produktions-Parser auf Basis des HTMLRewriter der Workers-Runtime. */
export const workersParser: HtmlParser = async (body, handlers) => {
  let rw = new HTMLRewriter();
  for (const [sel, h] of handlers)
    rw = rw.on(sel, h as unknown as HTMLRewriterElementContentHandlers);
  const out = rw.transform(new Response(body));
  await out.body?.pipeTo(new WritableStream());
};

/** Begrenzt einen Stream auf maxBytes (Rest wird abgebrochen). */
export function limitStream(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
): ReadableStream<Uint8Array> {
  let seen = 0;
  const reader = body.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(ctrl) {
      const { done, value } = await reader.read();
      if (done) return ctrl.close();
      const room = maxBytes - seen;
      if (value.length >= room) {
        if (room > 0) ctrl.enqueue(value.subarray(0, room));
        seen = maxBytes;
        await reader.cancel().catch(() => {});
        return ctrl.close();
      }
      seen += value.length;
      ctrl.enqueue(value);
    },
    cancel: (r) => reader.cancel(r),
  });
}
