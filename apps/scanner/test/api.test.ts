import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { IMG_MAX_BYTES } from "../src/img.ts";
import { RateLimiter } from "../src/net/rate-limit.ts";
import { fakeFetch, html, wasmParser } from "./helpers.ts";

const ip = (a: string) => ({ headers: { "cf-connecting-ip": a } });

describe("/api/scan", () => {
  it("scannt eine Website und liefert JSON", async () => {
    const { fn } = fakeFetch({ "https://example.de/": html(`<img src="/a.jpg">`) });
    const app = createApp({ fetch: fn, parse: wasmParser });
    const res = await app.request("/api/scan?url=example.de", ip("1.1.1.1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as { images: { src: string }[] };
    expect(body.images).toEqual([
      { src: "https://example.de/a.jpg", pages: ["https://example.de/"] },
    ]);
  });

  it("lehnt private Ziele mit 400 ab", async () => {
    const { fn, calls } = fakeFetch({});
    const app = createApp({ fetch: fn, parse: wasmParser });
    for (const u of ["http://127.0.0.1/", "localhost", "file:///etc/passwd", ""]) {
      const res = await app.request(`/api/scan?url=${encodeURIComponent(u)}`, ip("1.1.1.1"));
      expect(res.status).toBe(400);
    }
    expect(calls).toEqual([]);
  });

  it("drosselt pro IP mit 429 und Retry-After", async () => {
    const { fn } = fakeFetch({ "https://example.de/": html("") });
    const app = createApp({
      fetch: fn,
      parse: wasmParser,
      scanLimiter: new RateLimiter(2, 60_000),
    });
    const go = (a: string) => app.request("/api/scan?url=example.de", ip(a));
    expect((await go("1.1.1.1")).status).toBe(200);
    expect((await go("1.1.1.1")).status).toBe(200);
    const blocked = await go("1.1.1.1");
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await go("2.2.2.2")).status).toBe(200);
  });
});

describe("/api/img", () => {
  const big = new Uint8Array(IMG_MAX_BYTES + 5000).fill(7);

  it("liefert höchstens 256 KB als Rohbytes, nie als ausführbaren Inhalt", async () => {
    const { fn, calls } = fakeFetch({
      "https://cdn.example.de/a.jpg": { body: big, headers: { "content-type": "image/jpeg" } },
    });
    const app = createApp({ fetch: fn });
    const res = await app.request(
      `/api/img?src=${encodeURIComponent("https://cdn.example.de/a.jpg")}`,
      ip("1.1.1.1"),
    );
    expect(res.status).toBe(200);
    expect((await res.arrayBuffer()).byteLength).toBe(IMG_MAX_BYTES);
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toContain("sandbox");
    expect(res.headers.get("x-upstream-content-type")).toBe("image/jpeg");
    expect(res.headers.get("x-truncated")).toBe("1");
    const h = new Headers(calls[0]?.init?.headers);
    expect(h.get("range")).toBe(`bytes=0-${IMG_MAX_BYTES - 1}`);
    expect(h.get("cookie")).toBeNull();
  });

  it("lehnt Nicht-Bilder (auch HTML) mit 415 ab", async () => {
    const { fn } = fakeFetch({ "https://example.de/x": html("<script>alert(1)</script>") });
    const res = await createApp({ fetch: fn }).request(
      "/api/img?src=https://example.de/x",
      ip("1.1.1.1"),
    );
    expect(res.status).toBe(415);
  });

  it("blockiert private Ziele, auch über Redirects", async () => {
    const { fn, calls } = fakeFetch({
      "https://example.de/r.jpg": { status: 302, headers: { location: "http://10.0.0.1/a.jpg" } },
    });
    const app = createApp({ fetch: fn });
    expect((await app.request("/api/img?src=http://192.168.0.1/a.jpg", ip("1.1.1.1"))).status).toBe(
      400,
    );
    expect((await app.request("/api/img?src=https://example.de/r.jpg", ip("1.1.1.1"))).status).toBe(
      400,
    );
    expect(calls.map((c) => c.url)).toEqual(["https://example.de/r.jpg"]);
  });

  it("meldet Upstream-Fehler als 502 und drosselt mit 429", async () => {
    const { fn } = fakeFetch({});
    const app = createApp({ fetch: fn, imgLimiter: new RateLimiter(1, 60_000) });
    expect(
      (await app.request("/api/img?src=https://example.de/fehlt.jpg", ip("3.3.3.3"))).status,
    ).toBe(502);
    expect(
      (await app.request("/api/img?src=https://example.de/fehlt.jpg", ip("3.3.3.3"))).status,
    ).toBe(429);
  });
});

describe("RateLimiter", () => {
  it("öffnet nach Ablauf des Fensters wieder", () => {
    let t = 0;
    const rl = new RateLimiter(1, 1000, () => t);
    expect(rl.check("a").ok).toBe(true);
    expect(rl.check("a")).toEqual({ ok: false, retryAfter: 1 });
    t = 1000;
    expect(rl.check("a").ok).toBe(true);
  });
});
