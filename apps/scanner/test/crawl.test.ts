import { describe, expect, it } from "vitest";
import { crawl, LIMITS } from "../src/scan/crawl.ts";
import { parseSrcset } from "../src/scan/extract.ts";
import { fakeFetch, html, wasmParser } from "./helpers.ts";

const S = "https://example.de";

describe("crawl", () => {
  it("sammelt Bilder, Skripte, iframes über mehrere Seiten der gleichen Domain", async () => {
    const { fn, calls } = fakeFetch({
      [`${S}/robots.txt`]: {
        body: "User-agent: *\nDisallow: /intern/",
        headers: { "content-type": "text/plain" },
      },
      [`${S}/`]: html(`
        <img src="/a.jpg" alt="A"><img data-src="lazy.webp" src="data:image/gif;base64,R0">
        <picture><source srcset="/b.avif 1x, /b2.avif 2x" type="image/avif"><img src="/b.jpg"></picture>
        <script src="https://widget.chatbot.example/w.js"></script>
        <iframe src="https://maps.example/embed"></iframe>
        <a href="/kontakt">K</a><a href="https://www.example.de/team#x">T</a>
        <a href="/intern/geheim">I</a><a href="/datei.pdf">P</a><a href="https://andere.de/">X</a>
        <a href="mailto:a@b.de">M</a><a href="#oben">O</a>`),
      [`${S}/kontakt`]: html(`<img src="/a.jpg"><img srcset="https://cdn.example.net/c.png 600w">`),
      ["https://www.example.de/team"]: html(
        `<meta property="og:image" content="/og.jpg"><a href="/">Home</a>`,
      ),
    });
    const r = await crawl(new URL(`${S}/`), { fetch: fn, parse: wasmParser });

    expect(r.pages.map((p) => p.url)).toEqual([
      `${S}/`,
      `${S}/kontakt`,
      "https://www.example.de/team",
    ]);
    expect(r.images.map((i) => i.src).sort()).toEqual(
      [
        `${S}/a.jpg`,
        `${S}/lazy.webp`,
        `${S}/b.avif`,
        `${S}/b2.avif`,
        `${S}/b.jpg`,
        "https://cdn.example.net/c.png",
        "https://www.example.de/og.jpg",
      ].sort(),
    );
    expect(r.images.find((i) => i.src === `${S}/a.jpg`)?.pages).toEqual([`${S}/`, `${S}/kontakt`]);
    expect(r.scripts).toEqual(["https://widget.chatbot.example/w.js"]);
    expect(r.iframes).toEqual(["https://maps.example/embed"]);
    expect(r.robots).toEqual({ found: true, blocked: 1 });
    expect(
      calls.some(
        (c) => c.url.includes("intern") || c.url.includes("andere.de") || c.url.endsWith(".pdf"),
      ),
    ).toBe(false);
    expect(r.subrequests).toBe(4);
  });

  it("hält Seiten- und Subrequest-Limits ein", async () => {
    const links = Array.from({ length: 60 }, (_, i) => `<a href="/s${i}">s</a>`).join("");
    const routes: Record<string, ReturnType<typeof html>> = { [`${S}/`]: html(links) };
    for (let i = 0; i < 60; i++) routes[`${S}/s${i}`] = html(`<img src="/i${i}.jpg">${links}`);
    const { fn, calls } = fakeFetch(routes);
    const r = await crawl(new URL(`${S}/`), { fetch: fn, parse: wasmParser });
    expect(r.pages.length).toBe(LIMITS.maxPages);
    expect(r.truncated.pages).toBe(true);
    expect(calls.length).toBeLessThanOrEqual(LIMITS.subrequestBudget);
    expect(r.robots.found).toBe(false);
  });

  it("begrenzt Bilder auf 150", async () => {
    const imgs = Array.from({ length: 200 }, (_, i) => `<img src="/i${i}.jpg">`).join("");
    const { fn } = fakeFetch({ [`${S}/`]: html(imgs) });
    const r = await crawl(new URL(`${S}/`), { fetch: fn, parse: wasmParser });
    expect(r.images.length).toBe(LIMITS.maxImages);
    expect(r.truncated.images).toBe(true);
  });

  it("folgt Redirects höchstens 3-mal und nie in private Netze", async () => {
    const { fn, calls } = fakeFetch({
      [`${S}/`]: { status: 301, headers: { location: "/a" } },
      [`${S}/a`]: { status: 302, headers: { location: "http://169.254.169.254/" } },
    });
    const r = await crawl(new URL(`${S}/`), { fetch: fn, parse: wasmParser });
    expect(r.pages[0]?.error).toBe("private_host");
    expect(calls.some((c) => c.url.includes("169.254"))).toBe(false);
    expect(calls.every((c) => c.init?.redirect === "manual")).toBe(true);

    const loop = fakeFetch({
      [`${S}/`]: { status: 301, headers: { location: "/1" } },
      [`${S}/1`]: { status: 301, headers: { location: "/2" } },
      [`${S}/2`]: { status: 301, headers: { location: "/3" } },
      [`${S}/3`]: { status: 301, headers: { location: "/4" } },
    });
    const r2 = await crawl(new URL(`${S}/`), { fetch: loop.fn, parse: wasmParser });
    expect(r2.pages[0]?.error).toBe("too_many_redirects");
  });

  it("übernimmt die Zieldomain, wenn die Startseite umleitet", async () => {
    const { fn } = fakeFetch({
      [`${S}/`]: { status: 301, headers: { location: "https://example.com/" } },
      ["https://example.com/robots.txt"]: {
        body: "User-agent: *\nDisallow: /x",
        headers: { "content-type": "text/plain" },
      },
      ["https://example.com/"]: html(`<a href="/x">x</a><a href="/y">y</a>`),
      ["https://example.com/y"]: html(""),
    });
    const r = await crawl(new URL(`${S}/`), { fetch: fn, parse: wasmParser });
    expect(r.url).toBe("https://example.com/");
    expect(r.pages.map((p) => p.url)).toEqual(["https://example.com/", "https://example.com/y"]);
    expect(r.robots.blocked).toBe(1);
  });

  it("respektiert robots.txt auch für die Startseite", async () => {
    const { fn, calls } = fakeFetch({
      [`${S}/robots.txt`]: {
        body: "User-agent: *\nDisallow: /",
        headers: { "content-type": "text/plain" },
      },
      [`${S}/`]: html(""),
    });
    const r = await crawl(new URL(`${S}/`), { fetch: fn, parse: wasmParser });
    expect(r.pages).toEqual([]);
    expect(r.robots.blocked).toBe(1);
    expect(calls.length).toBe(1);
  });

  it("überspringt Nicht-HTML und wirft nicht bei Netzfehlern", async () => {
    const { fn } = fakeFetch({
      [`${S}/`]: { body: "{}", headers: { "content-type": "application/json" } },
    });
    const r = await crawl(new URL(`${S}/`), { fetch: fn, parse: wasmParser });
    expect(r.pages[0]).toMatchObject({ status: 200, error: "not_html" });
    const broken = await crawl(new URL(`${S}/`), {
      fetch: async () => {
        throw new Error("dns");
      },
      parse: wasmParser,
    });
    expect(broken.pages[0]?.error).toBe("network");
  });

  it("meldet nicht auflösbare Domains (Cloudflare 530) und HTTP-Fehler verständlich", async () => {
    const dns = fakeFetch({ [`${S}/`]: { status: 530, body: "error code: 1016" } });
    const r = await crawl(new URL(`${S}/`), { fetch: dns.fn, parse: wasmParser });
    expect(r.pages[0]).toMatchObject({ status: 530, error: "unreachable" });
    const gone = fakeFetch({ [`${S}/`]: { status: 503 } });
    const r2 = await crawl(new URL(`${S}/`), { fetch: gone.fn, parse: wasmParser });
    expect(r2.pages[0]?.error).toBe("http_503");
  });

  it("liest srcset", () => {
    expect(parseSrcset("a.jpg 1x, b.jpg 2x,c.jpg")).toEqual(["a.jpg", "b.jpg", "c.jpg"]);
    expect(parseSrcset("/w_100,h_50/x.jpg 1x, y.jpg")).toEqual(["/w_100,h_50/x.jpg", "y.jpg"]);
    expect(parseSrcset("a.jpg, b.jpg")).toEqual(["a.jpg", "b.jpg"]);
    expect(parseSrcset("data:x 1x, /d.jpg 640w")).toEqual(["/d.jpg"]);
  });
});
