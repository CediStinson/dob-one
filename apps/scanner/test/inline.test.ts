import { describe, expect, it } from "vitest";
import { crawl } from "../src/scan/crawl.ts";
import { extractPage, INLINE_LIMITS, urlsInScript } from "../src/scan/extract.ts";
import { fakeFetch, html, wasmParser } from "./helpers.ts";

const S = "https://example.de";

const stream = (s: string) => new Response(`<!doctype html><html><body>${s}</body></html>`).body!;

describe("Inline-Skripte", () => {
  it("findet URLs in Chat-Snippets (Intercom, Crisp, tawk.to)", async () => {
    const d = await extractPage(
      stream(`
      <script>(function(){var s=d.createElement('script');s.src='https://widget.intercom.io/widget/' + APP_ID;})();</script>
      <script type="text/javascript">window.$crisp=[];d=document;s=d.createElement("script");s.src="https://client.crisp.chat/l.js";</script>
      <script>s1.src='//embed.tawk.to/abc/default';</script>
      <a href="/x">https://nicht-aus-skript.example/</a>`),
      wasmParser,
    );
    expect(d.inlineUrls).toEqual([
      "https://widget.intercom.io/widget/",
      "https://client.crisp.chat/l.js",
      "//embed.tawk.to/abc/default",
    ]);
  });

  it("ignoriert JSON-LD und Skripte mit src", async () => {
    const d = await extractPage(
      stream(`
      <script type="application/ld+json">{"url":"https://schema.example/"}</script>
      <script src="/a.js"></script><p>https://text.example/</p>`),
      wasmParser,
    );
    expect(d.inlineUrls).toEqual([]);
    expect(d.scripts).toEqual(["/a.js"]);
  });

  it("leeres Skript nimmt keinen folgenden Text mit", async () => {
    const d = await extractPage(
      stream(`<script></script><a href="/x">//fremd.example/pfad</a>`),
      wasmParser,
    );
    expect(d.inlineUrls).toEqual([]);
  });

  it("begrenzt Bytes pro Skript", async () => {
    const pad = "x".repeat(INLINE_LIMITS.bytesPerScript);
    const d = await extractPage(
      stream(
        `<script>var a="https://vorne.example/a";${pad}var b="https://hinten.example/b";</script>`,
      ),
      wasmParser,
    );
    expect(d.inlineUrls).toEqual(["https://vorne.example/a"]);
  });

  it("urlsInScript", () => {
    expect(urlsInScript(`a="https://cdn.voiceflow.com/widget-next/bundle.mjs";b=1/2;`)).toEqual([
      "https://cdn.voiceflow.com/widget-next/bundle.mjs",
    ]);
  });

  it("crawl liefert absolute inlineUrls", async () => {
    const { fn } = fakeFetch({
      [`${S}/`]: html(`<script>s.src='//code.tidio.co/abc.js'</script>`),
    });
    const r = await crawl(new URL(`${S}/`), { fetch: fn, parse: wasmParser });
    expect(r.inlineUrls).toEqual(["https://code.tidio.co/abc.js"]);
  });
});
