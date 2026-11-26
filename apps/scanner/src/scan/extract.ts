/**
 * Sammelt beim Streamen einer HTML-Seite Bild-URLs, Links, Skripte und iframes.
 * Arbeitet nur mit Element-Handlern (HTMLRewriter), baut keinen DOM-Baum: wenig CPU.
 */

export interface El {
  tagName: string;
  getAttribute(name: string): string | null;
}

export interface TextChunk {
  text: string;
  lastInTextNode: boolean;
}

export interface ElementHandler {
  element?(el: El): void;
  text?(chunk: TextChunk): void;
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
  /** URLs aus Inline-Skripten (Chat-Snippets laden ihr Widget meist per JS nach). */
  inlineUrls: string[];
  base?: string;
}

/** Grenzen für Inline-Skripte (10 ms CPU im Free-Plan). */
export const INLINE_LIMITS = { bytesPerScript: 16 * 1024, bytesPerPage: 96 * 1024, urls: 40 };

/** Absolute oder protokollrelative URLs in JS-Quelltext. */
const URL_IN_JS = /(?:https?:)?\/\/[a-z0-9][a-z0-9.-]*\.[a-z]{2,24}(?:\/[^\s"'`<>\\)]{0,160})?/gi;

const JS_TYPES = /^(|text\/javascript|application\/javascript|module|text\/ecmascript)$/i;

export function urlsInScript(text: string): string[] {
  return text.match(URL_IN_JS) ?? [];
}

export const SELECTORS = [
  "base[href]",
  "img",
  "source[srcset]",
  "meta[property='og:image']",
  "a[href]",
  "script",
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
  const data: PageData = { images: [], links: [], scripts: [], iframes: [], inlineUrls: [] };
  // Inline-Skript: Text sammeln, bis der Textknoten endet, dann einmal nach URLs suchen.
  let inline: string | null = null;
  let pageBytes = 0;
  const inlineSeen = new Set<string>();
  const handler: ElementHandler = {
    text(chunk) {
      if (inline === null) return;
      if (inline.length < INLINE_LIMITS.bytesPerScript && pageBytes < INLINE_LIMITS.bytesPerPage) {
        const take = chunk.text.slice(0, INLINE_LIMITS.bytesPerScript - inline.length);
        inline += take;
        pageBytes += take.length;
      }
      if (!chunk.lastInTextNode) return;
      for (const u of urlsInScript(inline)) {
        if (inlineSeen.size >= INLINE_LIMITS.urls) break;
        if (!inlineSeen.has(u)) {
          inlineSeen.add(u);
          data.inlineUrls.push(u);
        }
      }
      inline = null;
    },
    element(el) {
      inline = null; // Skript ohne Textknoten: nichts übernehmen
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
          else if (JS_TYPES.test(attr("type") ?? "") && pageBytes < INLINE_LIMITS.bytesPerPage)
            inline = "";
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
