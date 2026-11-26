import { Hono } from "hono";
import { fetchImageHead } from "./img.ts";
import { clientIp, RateLimiter } from "./net/rate-limit.ts";
import type { FetchFn } from "./net/safe-fetch.ts";
import { parseUserUrl } from "./net/url-guard.ts";
import { crawl } from "./scan/crawl.ts";
import { workersParser, type HtmlParser } from "./scan/extract.ts";

/** Minimales Interface, damit der Code auch ausserhalb von Cloudflare (Node) läuft. */
export interface Env {
  ASSETS?: { fetch(request: Request): Promise<Response> };
}

export interface AppDeps {
  fetch: FetchFn;
  parse: HtmlParser;
  scanLimiter: RateLimiter;
  imgLimiter: RateLimiter;
}

const MINUTE = 60_000;

export function createApp(overrides: Partial<AppDeps> = {}) {
  const deps: AppDeps = {
    fetch: (input, init) => fetch(input, init),
    parse: workersParser,
    scanLimiter: new RateLimiter(5, 10 * MINUTE),
    imgLimiter: new RateLimiter(400, 10 * MINUTE),
    ...overrides,
  };
  const app = new Hono<{ Bindings: Env }>();

  app.get("/api/health", (c) => c.json({ ok: true, service: "kenntlich-scanner" }));

  app.get("/api/scan", async (c) => {
    const rl = deps.scanLimiter.check(clientIp(c.req.raw));
    if (!rl.ok) {
      c.header("retry-after", String(rl.retryAfter));
      return c.json({ error: "rate_limited", retryAfter: rl.retryAfter }, 429);
    }
    const target = parseUserUrl(c.req.query("url") ?? "");
    if (!target.ok) return c.json({ error: target.reason }, 400);
    const result = await crawl(target.url, deps);
    c.header("cache-control", "no-store");
    return c.json(result);
  });

  app.get("/api/img", async (c) => {
    const rl = deps.imgLimiter.check(clientIp(c.req.raw));
    if (!rl.ok) {
      c.header("retry-after", String(rl.retryAfter));
      return c.json({ error: "rate_limited", retryAfter: rl.retryAfter }, 429);
    }
    const r = await fetchImageHead(c.req.query("src") ?? "", deps.fetch);
    if (!r.ok) return c.json({ error: r.error }, r.status);
    // Nie als Bild/HTML/SVG auf unserer Domain ausliefern: nur Rohbytes zum Parsen im Browser.
    return new Response(r.bytes, {
      headers: {
        "content-type": "application/octet-stream",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox",
        "content-disposition": "attachment",
        "cache-control": "private, max-age=3600",
        "x-upstream-content-type": r.contentType,
        "x-truncated": r.truncated ? "1" : "0",
      },
    });
  });

  app.all("/api/*", (c) => c.json({ error: "not_found" }, 404));

  // Alles andere: statische Assets (Astro-Build).
  app.all("*", async (c) => {
    if (c.env?.ASSETS) return c.env.ASSETS.fetch(c.req.raw);
    return c.text("Not found", 404);
  });

  return app;
}

export const app = createApp();
