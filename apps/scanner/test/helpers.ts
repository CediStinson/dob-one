import { HTMLRewriter } from "html-rewriter-wasm";
import type { FetchFn } from "../src/net/safe-fetch.ts";
import type { HtmlParser } from "../src/scan/extract.ts";

/** Gleicher Parser wie in Workers (lol-html), als WASM für Node-Tests. */
export const wasmParser: HtmlParser = async (body, handlers) => {
  const rw = new HTMLRewriter(() => {});
  for (const [sel, h] of handlers) rw.on(sel, h);
  try {
    const reader = body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      await rw.write(value);
    }
    await rw.end();
  } finally {
    rw.free();
  }
};

type Route = { status?: number; body?: string | Uint8Array; headers?: Record<string, string> };

/** Fake-Fetch: URL → Antwort. Protokolliert alle Abrufe. */
export function fakeFetch(routes: Record<string, Route>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn: FetchFn = async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push({ url, ...(init ? { init } : {}) });
    const r = routes[url];
    if (!r) return new Response("nope", { status: 404, headers: { "content-type": "text/plain" } });
    return new Response(r.body ?? "", {
      status: r.status ?? 200,
      headers: { "content-type": "text/html; charset=utf-8", ...r.headers },
    });
  };
  return { fn, calls };
}

export const html = (body: string): Route => ({
  body: `<!doctype html><html><body>${body}</body></html>`,
});
