import { Hono, type Context } from "hono";
import { fetchImageHead } from "./img.ts";
import { clientIp, RateLimiter } from "./net/rate-limit.ts";
import type { FetchFn } from "./net/safe-fetch.ts";
import { parseUserUrl } from "./net/url-guard.ts";
import { crawl } from "./scan/crawl.ts";
import { workersParser, type HtmlParser } from "./scan/extract.ts";
import { checkBasicAuth } from "./stats/auth.ts";
import { MAX_BODY, dayOf, isBot, parseEvent, parseHit, type CountRow } from "./stats/input.ts";
import { buildReport, firstDay, renderNotice, renderReport } from "./stats/report.ts";
import { D1Store, type D1Like, type StatsStore } from "./stats/store.ts";

/** Minimales Interface, damit der Code auch ausserhalb von Cloudflare (Node) läuft. */
export interface Env {
  ASSETS?: { fetch(request: Request): Promise<Response> };
  /** D1-Datenbank für die anonymen Tageszähler (T19). Fehlt sie, wird nichts gezählt. */
  DB?: D1Like;
  /** Passwort für /stats (Secret). Fehlt es, ist /stats gesperrt. */
  STATS_PASSWORD?: string;
}

export interface AppDeps {
  fetch: FetchFn;
  parse: HtmlParser;
  scanLimiter: RateLimiter;
  imgLimiter: RateLimiter;
  hitLimiter: RateLimiter;
  authLimiter: RateLimiter;
  /** Liefert den Zähler-Speicher oder null, wenn keine Datenbank angebunden ist. */
  stats: (env: Env | undefined) => StatsStore | null;
  now: () => number;
}

const storeCache = new WeakMap<D1Like, StatsStore>();
function d1Stats(env: Env | undefined): StatsStore | null {
  const db = env?.DB;
  if (!db) return null;
  let s = storeCache.get(db);
  if (!s) storeCache.set(db, (s = new D1Store(db)));
  return s;
}

const MINUTE = 60_000;

export function createApp(overrides: Partial<AppDeps> = {}) {
  const deps: AppDeps = {
    fetch: (input, init) => fetch(input, init),
    parse: workersParser,
    scanLimiter: new RateLimiter(5, 10 * MINUTE),
    imgLimiter: new RateLimiter(400, 10 * MINUTE),
    hitLimiter: new RateLimiter(120, 10 * MINUTE),
    authLimiter: new RateLimiter(10, 10 * MINUTE),
    stats: d1Stats,
    now: Date.now,
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

  // T19: anonyme Zähler. Antwort immer 204, damit nichts über den Filter verraten wird.
  const count = async (
    c: Context<{ Bindings: Env }>,
    parse: (body: string) => CountRow[] | null,
  ): Promise<Response> => {
    const req = c.req.raw;
    const store = deps.stats(c.env);
    // Ohne Längenangabe (Streaming) lesen wir gar nicht erst: sendBeacon schickt sie immer mit.
    const len = Number(req.headers.get("content-length") ?? "NaN");
    if (!store || !(len > 0 && len <= MAX_BODY) || isBot(req.headers.get("user-agent"))) {
      return c.body(null, 204);
    }
    let body: string;
    try {
      body = await req.text();
    } catch {
      return c.body(null, 204);
    }
    const rows = parse(body.slice(0, MAX_BODY + 1));
    if (!rows || !deps.hitLimiter.check(clientIp(req)).ok) return c.body(null, 204);
    const job = store.add(dayOf(deps.now()), rows).catch((e: unknown) => {
      console.error("stats", e);
    });
    try {
      c.executionCtx.waitUntil(job);
    } catch {
      await job; // ausserhalb von Workers (Tests, Node)
    }
    return c.body(null, 204);
  };
  app.post("/api/hit", (c) => count(c, (b) => parseHit(b, new URL(c.req.url).hostname)));
  app.post("/api/event", (c) => count(c, parseEvent));

  app.all("/api/*", (c) => c.json({ error: "not_found" }, 404));

  const statsPage = async (c: Context<{ Bindings: Env }>): Promise<Response> => {
    c.header("x-robots-tag", "noindex, nofollow");
    c.header("cache-control", "no-store");
    c.header(
      "content-security-policy",
      "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
    );
    const password = c.env?.STATS_PASSWORD ?? "";
    const store = deps.stats(c.env);
    if (!password) {
      // Ohne Passwort ist /stats gesperrt. Der Hinweis verrät keine Zahlen, nur den Einrichtungsstand.
      return c.html(
        renderNotice("Statistik noch nicht eingerichtet", [
          "Passwort: fehlt. Bitte im Cloudflare-Dashboard das Secret STATS_PASSWORD setzen.",
          store
            ? "Datenbank: verbunden."
            : "Datenbank: fehlt. Bitte D1-Datenbank anlegen und als Binding DB eintragen.",
        ]),
        503,
      );
    }
    const ip = clientIp(c.req.raw);
    const ok = await checkBasicAuth(c.req.header("authorization"), password);
    if (!ok) {
      if (!deps.authLimiter.check(ip).ok)
        return c.text("Zu viele Versuche. Bitte später erneut.", 429);
      c.header("www-authenticate", 'Basic realm="kenntlich Statistik", charset="UTF-8"');
      return c.text("Anmeldung erforderlich.", 401);
    }
    if (!store) {
      return c.html(
        renderNotice("Statistik noch nicht eingerichtet", [
          "Passwort: gesetzt.",
          "Datenbank: fehlt. Bitte D1-Datenbank anlegen und als Binding DB eintragen. Bis dahin wird nichts gezählt.",
        ]),
        503,
      );
    }
    const now = deps.now();
    try {
      const rows = await store.since(firstDay(now));
      return c.html(renderReport(buildReport(rows, now)));
    } catch (e) {
      console.error("stats", e);
      return c.html(
        renderNotice("Datenbank nicht erreichbar", [
          "Die Statistik konnte gerade nicht gelesen werden. Bitte später erneut versuchen.",
          "Bleibt der Fehler, im Cloudflare-Dashboard prüfen, ob die D1-Datenbank existiert und als Binding DB eingetragen ist.",
        ]),
        503,
      );
    }
  };
  app.get("/stats", statsPage);
  app.get("/stats/", statsPage);

  // Alles andere: statische Assets (Astro-Build).
  app.all("*", async (c) => {
    if (c.env?.ASSETS) return c.env.ASSETS.fetch(c.req.raw);
    return c.text("Not found", 404);
  });

  return app;
}

export const app = createApp();
