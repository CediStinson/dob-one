import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { RateLimiter } from "../src/net/rate-limit.ts";
import { checkBasicAuth } from "../src/stats/auth.ts";
import { cleanPath, cleanRef, dayOf, isBot, parseEvent, parseHit } from "../src/stats/input.ts";
import { buildReport, esc, renderReport } from "../src/stats/report.ts";
import { MemoryStore } from "../src/stats/store.ts";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36";
const NOW = Date.UTC(2026, 10, 27, 12);

function setup(opts: { store?: MemoryStore | null; limit?: number } = {}) {
  const store = opts.store === undefined ? new MemoryStore() : opts.store;
  const app = createApp({
    stats: () => store,
    now: () => NOW,
    hitLimiter: new RateLimiter(opts.limit ?? 100, 60_000),
    authLimiter: new RateLimiter(3, 60_000),
  });
  return { app, store };
}

const post = (path: string, body: string, ua = UA) =>
  new Request(`https://kenntlich.eu${path}`, {
    method: "POST",
    body,
    headers: { "user-agent": ua, "content-type": "text/plain", "cf-connecting-ip": "1.2.3.4" },
  });

const basic = (pw: string) => `Basic ${btoa(`x:${pw}`)}`;

describe("stats input", () => {
  it("normalisiert Pfade und verwirft Fremdes", () => {
    expect(cleanPath("/tools/ki-label-generator")).toBe("/tools/ki-label-generator/");
    expect(cleanPath("/Impressum/?utm=1#x")).toBe("/impressum/");
    expect(cleanPath("/")).toBe("/");
    expect(cleanPath("/favicon.svg")).toBe("/favicon.svg");
    expect(cleanPath("/<script>/")).toBeNull();
    expect(cleanPath("/a/../b")).toBeNull();
    expect(cleanPath("https://x.de/")).toBeNull();
    expect(cleanPath("/" + "a".repeat(200))).toBeNull();
    expect(cleanPath(5)).toBeNull();
  });

  it("nimmt nur Referrer-Domains, nicht die eigene", () => {
    expect(cleanRef("www.Google.de", "kenntlich.eu")).toBe("google.de");
    expect(cleanRef("kenntlich.eu", "www.kenntlich.eu")).toBeNull();
    expect(cleanRef("https://google.de/search?q=x", "kenntlich.eu")).toBeNull();
    expect(cleanRef("localhost", "kenntlich.eu")).toBeNull();
    expect(cleanRef("", "kenntlich.eu")).toBeNull();
  });

  it("erkennt Bots und fehlende User-Agents", () => {
    expect(isBot(UA)).toBe(false);
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(
      true,
    );
    expect(isBot("curl/8.4.0")).toBe(true);
    expect(isBot(null)).toBe(true);
  });

  it("prüft Events und begrenzt die Bildanzahl", () => {
    expect(parseEvent('{"e":"label_export","n":3}')).toEqual([
      { kind: "event", key: "label_export", n: 1 },
      { kind: "images", key: "label", n: 3 },
    ]);
    expect(parseEvent('{"e":"label_export","n":9999}')![1]!.n).toBe(20);
    expect(parseEvent('{"e":"label_export","n":-4}')![1]!.n).toBe(1);
    expect(parseEvent('{"e":"contact_click"}')).toEqual([
      { kind: "event", key: "contact_click", n: 1 },
    ]);
    expect(parseEvent('{"e":"drop_table"}')).toBeNull();
    expect(parseEvent("kein json")).toBeNull();
    expect(parseEvent("[1]")).toBeNull();
  });

  it("liest Seitenaufrufe mit Referrer", () => {
    expect(parseHit('{"p":"/","r":"bing.com"}', "kenntlich.eu")).toEqual([
      { kind: "page", key: "/", n: 1 },
      { kind: "ref", key: "bing.com", n: 1 },
    ]);
    expect(parseHit('{"p":"/","ip":"1.2.3.4"}', "kenntlich.eu")).toEqual([
      { kind: "page", key: "/", n: 1 },
    ]);
    expect(parseHit("{}", "kenntlich.eu")).toBeNull();
  });

  it("rechnet den Tag in deutscher Zeit", () => {
    expect(dayOf(Date.UTC(2026, 10, 27, 23, 30))).toBe("2026-11-28");
    expect(dayOf(Date.UTC(2026, 6, 1, 21, 59))).toBe("2026-07-01");
  });
});

describe("POST /api/hit und /api/event", () => {
  it("zählt Aufrufe und Events, speichert keine IP", async () => {
    const { app, store } = setup();
    expect((await app.request(post("/api/hit", '{"p":"/","r":"google.de"}'))).status).toBe(204);
    await app.request(post("/api/hit", '{"p":"/"}'));
    await app.request(post("/api/event", '{"e":"label_export","n":4}'));
    const rows = await store!.since("2026-11-01");
    expect(rows).toEqual(
      expect.arrayContaining([
        { day: "2026-11-27", kind: "page", key: "/", n: 2 },
        { day: "2026-11-27", kind: "ref", key: "google.de", n: 1 },
        { day: "2026-11-27", kind: "event", key: "label_export", n: 1 },
        { day: "2026-11-27", kind: "images", key: "label", n: 4 },
      ]),
    );
    expect(JSON.stringify(rows)).not.toContain("1.2.3.4");
  });

  it("ignoriert Bots, Müll, zu große Bodies und Rate-Limit still mit 204", async () => {
    const { app, store } = setup({ limit: 1 });
    expect((await app.request(post("/api/hit", '{"p":"/"}', "Googlebot/2.1"))).status).toBe(204);
    expect((await app.request(post("/api/hit", "x".repeat(2000)))).status).toBe(204);
    expect((await app.request(post("/api/hit", '{"p":"/a/"}'))).status).toBe(204);
    expect((await app.request(post("/api/hit", '{"p":"/b/"}'))).status).toBe(204);
    const keys = (await store!.since("2026-01-01")).map((r) => r.key);
    expect(keys).toEqual(["/a/"]);
  });

  it("antwortet 204 auch ohne Datenbank", async () => {
    const { app } = setup({ store: null });
    expect((await app.request(post("/api/hit", '{"p":"/"}'))).status).toBe(204);
  });

  it("GET auf /api/hit ist 404", async () => {
    const { app } = setup();
    expect((await app.request("/api/hit")).status).toBe(404);
  });
});

describe("/stats", () => {
  const env = { STATS_PASSWORD: "geheim-ü" };

  it("ist ohne Passwort-Secret gesperrt", async () => {
    const { app } = setup();
    const res = await app.request("/stats", {}, {});
    expect(res.status).toBe(503);
  });

  it("verlangt Basic Auth und begrenzt Fehlversuche", async () => {
    const { app } = setup();
    const res = await app.request("/stats", {}, env);
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("Basic");
    expect(res.headers.get("x-robots-tag")).toContain("noindex");
    await app.request("/stats", { headers: { authorization: basic("falsch") } }, env);
    await app.request("/stats", { headers: { authorization: basic("falsch") } }, env);
    const blocked = await app.request(
      "/stats",
      { headers: { authorization: basic("falsch") } },
      env,
    );
    expect(blocked.status).toBe(429);
  });

  it("zeigt die Übersicht mit richtigem Passwort (auch mit Umlaut und Schrägstrich)", async () => {
    const { app } = setup();
    await app.request(post("/api/hit", '{"p":"/tools/ki-label-generator/","r":"google.de"}'));
    await app.request(post("/api/event", '{"e":"contact_click"}'));
    const auth = `Basic ${btoa(String.fromCharCode(...new TextEncoder().encode("x:geheim-ü")))}`;
    for (const path of ["/stats", "/stats/"]) {
      const res = await app.request(path, { headers: { authorization: auth } }, env);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("/tools/ki-label-generator/");
      expect(html).toContain("google.de");
      expect(html).toContain("keine eindeutigen Besucher");
      expect(html).toContain('content="noindex,nofollow"');
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
  });
});

describe("report", () => {
  it("füllt 30 Tage, summiert und sortiert", () => {
    const r = buildReport(
      [
        { day: "2026-11-27", kind: "page", key: "/", n: 5 },
        { day: "2026-11-26", kind: "page", key: "/impressum/", n: 7 },
        { day: "2026-11-26", kind: "event", key: "label_export", n: 2 },
        { day: "2026-11-26", kind: "images", key: "label", n: 9 },
        { day: "2026-11-26", kind: "event", key: "webp_export", n: 1 },
        { day: "2026-10-01", kind: "page", key: "/alt/", n: 99 },
      ],
      NOW,
    );
    expect(r.days).toHaveLength(30);
    expect(r.to).toBe("2026-11-27");
    expect(r.from).toBe("2026-10-29");
    expect(r.totals).toEqual({
      views: 12,
      labelExports: 2,
      labelImages: 9,
      webpExports: 1,
      contactClicks: 0,
    });
    expect(r.pages.map((p) => p.key)).toEqual(["/impressum/", "/"]);
    expect(r.days.at(-2)).toEqual({ day: "2026-11-26", views: 7, exports: 3 });
  });

  it("escaped alle Werte im HTML", () => {
    expect(esc(`<a href="x">'&`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;");
    const r = buildReport(
      [{ day: "2026-11-27", kind: "ref", key: "<img src=x onerror=1>", n: 1 }],
      NOW,
    );
    expect(renderReport(r)).not.toContain("<img");
  });
});

describe("checkBasicAuth", () => {
  it("lehnt Kaputtes ab", async () => {
    expect(await checkBasicAuth(null, "pw")).toBe(false);
    expect(await checkBasicAuth("Basic !!!", "pw")).toBe(false);
    expect(await checkBasicAuth(`Basic ${btoa("ohne-doppelpunkt")}`, "pw")).toBe(false);
    expect(await checkBasicAuth(basic("pw"), "")).toBe(false);
    expect(await checkBasicAuth(basic("pw:mit:doppelpunkt"), "pw:mit:doppelpunkt")).toBe(true);
  });
});
