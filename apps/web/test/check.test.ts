import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  normalizeInput,
  pageErrorText,
  scan,
  scanErrorText,
  waitText,
  type ScanImage,
} from "../src/lib/check/api.ts";
import { runPool } from "../src/lib/check/pool.ts";
import { checkImage, checkImages } from "../src/lib/check/run.ts";
import { escapeHtml, labelSnippet } from "../src/lib/check/snippet.ts";
import {
  adviceFor,
  countByStatus,
  displayName,
  displayPath,
  sortForDisplay,
} from "../src/lib/check/summary.ts";

const fixture = (name: string) =>
  readFileSync(
    fileURLToPath(new URL(`../../../packages/detect/fixtures/${name}`, import.meta.url)),
  );

const FILES: Record<string, string> = {
  "https://a.de/ki.jpg": "jpeg-exif-firefly.jpg",
  "https://a.de/foto.jpg": "jpeg-camera.jpg",
  "https://a.de/c2pa.jpg": "jpeg-c2pa-camera.jpg",
  "https://a.de/variante-300x200.png": "png-comfyui.png",
};

/** Fake für /api/img und /api/scan. */
function fakeFetch(opts: { limitAfter?: number } = {}) {
  const calls: string[] = [];
  const fn = async (input: string): Promise<Response> => {
    calls.push(input);
    const u = new URL(input, "https://kenntlich.test");
    if (opts.limitAfter !== undefined && calls.length > opts.limitAfter) {
      return Response.json(
        { error: "rate_limited" },
        { status: 429, headers: { "retry-after": "240" } },
      );
    }
    if (u.pathname === "/api/img") {
      const name = FILES[u.searchParams.get("src") ?? ""];
      if (!name) return Response.json({ error: "upstream_404" }, { status: 502 });
      return new Response(fixture(name));
    }
    return Response.json({ error: "not_found" }, { status: 404 });
  };
  return { fn, calls };
}

const img = (src: string, variants?: string[]): ScanImage => ({
  src,
  pages: ["https://a.de/"],
  ...(variants ? { variants } : {}),
});

describe("api", () => {
  it("normalisiert Eingaben", () => {
    expect(normalizeInput("  beispiel .de ")).toBe("beispiel.de");
  });

  it("meldet 429 mit Wartezeit", async () => {
    const res = await scan("a.de", async () =>
      Response.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": "300" } }),
    );
    expect(res).toEqual({ ok: false, error: { kind: "rate_limited", retryAfter: 300 } });
    if (!res.ok) expect(scanErrorText(res.error)).toContain("in etwa 5 Minuten");
  });

  it("429 ohne retry-after gilt als Tageskontingent", async () => {
    const res = await scan("a.de", async () => new Response("", { status: 429 }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(scanErrorText(res.error)).toContain("Tageskontingent");
  });

  it("übersetzt 400-Codes", async () => {
    const res = await scan("localhost", async () =>
      Response.json({ error: "private_host" }, { status: 400 }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(scanErrorText(res.error)).toContain("Interne");
  });

  it("Netzwerkfehler", async () => {
    const res = await scan("a.de", async () => {
      throw new TypeError("offline");
    });
    expect(res).toEqual({ ok: false, error: { kind: "network" } });
  });

  it("kodiert die URL im Query", async () => {
    const seen: string[] = [];
    await scan("a.de/?x=1&y=2", async (u) => {
      seen.push(u);
      return Response.json({ pages: [] });
    });
    expect(seen[0]).toBe("/api/scan?url=a.de%2F%3Fx%3D1%26y%3D2");
  });

  it("Seitenfehler und Wartezeit lesbar", () => {
    expect(pageErrorText("unreachable")).toContain("Tippfehler");
    expect(pageErrorText("http_403")).toContain("403");
    expect(pageErrorText("http_500")).toContain("500");
    expect(pageErrorText("xyz")).toBe("Die Seite konnte nicht gelesen werden.");
    expect(waitText(30)).toBe("in etwa einer Minute");
    expect(waitText(7200)).toBe("morgen");
  });
});

describe("checkImage", () => {
  it("erkennt KI-Bild über /api/img", async () => {
    const { fn } = fakeFetch();
    const out = await checkImage(img("https://a.de/ki.jpg"), fn);
    expect(out).toEqual({
      image: expect.objectContaining({ status: "ai", generator: "Adobe Firefly" }),
    });
  });

  it("nimmt bei Fehler eine Größenvariante", async () => {
    const { fn, calls } = fakeFetch();
    const out = await checkImage(
      img("https://a.de/variante.png", ["https://a.de/variante-300x200.png"]),
      fn,
    );
    expect(calls).toHaveLength(2);
    expect(out).toEqual({
      image: expect.objectContaining({ src: "https://a.de/variante.png", status: "ai" }),
    });
  });

  it("nicht abrufbar ergibt error", async () => {
    const { fn } = fakeFetch();
    const out = await checkImage(img("https://a.de/fehlt.jpg"), fn);
    expect(out).toEqual({ image: expect.objectContaining({ status: "error" }) });
  });
});

describe("checkImages", () => {
  it("prüft alle Bilder in Eingabereihenfolge", async () => {
    const { fn } = fakeFetch();
    const progress: number[] = [];
    const r = await checkImages(
      ["ki", "foto", "c2pa"].map((n) => img(`https://a.de/${n}.jpg`)),
      fn,
      (done) => progress.push(done),
    );
    expect(r.images.map((i) => i.status)).toEqual(["ai", "none", "unclear"]);
    expect(progress).toEqual([1, 2, 3]);
    expect(r.rateLimited).toBeUndefined();
  });

  it("stoppt bei Rate-Limit, Rest ist skipped", async () => {
    const { fn, calls } = fakeFetch({ limitAfter: 2 });
    const list = Array.from({ length: 10 }, () => img("https://a.de/foto.jpg"));
    const r = await checkImages(list, fn, () => {}, 1);
    expect(calls).toHaveLength(3);
    expect(r.rateLimited).toEqual({ kind: "rate_limited", retryAfter: 240 });
    expect(countByStatus(r.images)).toMatchObject({ none: 2, skipped: 8 });
  });
});

describe("runPool", () => {
  it("hält die Parallelität ein", async () => {
    let active = 0;
    let max = 0;
    await runPool([1, 2, 3, 4, 5, 6, 7], 3, async () => {
      active++;
      max = Math.max(max, active);
      await new Promise((r) => setTimeout(r, 2));
      active--;
      return "continue";
    });
    expect(max).toBe(3);
  });
  it("leere Liste", async () => {
    expect(await runPool([], 4, async () => "continue")).toEqual({ started: 0, stopped: false });
  });
});

describe("summary", () => {
  it("sortiert KI-Funde nach oben", () => {
    const s = sortForDisplay([{ status: "none" }, { status: "error" }, { status: "ai" }]);
    expect(s.map((x) => x.status)).toEqual(["ai", "error", "none"]);
  });

  it("Empfehlungen bei KI-Fund", () => {
    const a = adviceFor(countByStatus([{ status: "ai" }, { status: "ai_partial" }]), 3);
    expect(a[0]?.title).toBe("2 Bilder mit KI-Hinweis prüfen");
    expect(a.some((x) => x.title === "Keine KI-Hinweise in den Metadaten gefunden")).toBe(false);
  });

  it("ohne Fund: Hinweis, dass das kein Beweis ist", () => {
    const a = adviceFor(countByStatus([{ status: "none" }]), 1);
    expect(a).toHaveLength(1);
    expect(a[0]?.text).toContain("kein Beweis");
  });

  it("keine Seite lesbar", () => {
    expect(adviceFor(countByStatus([]), 0).map((x) => x.title)).toEqual(["Keine Seite lesbar"]);
  });

  it("keine Gedankenstriche in Kunden-Texten", () => {
    const all = adviceFor(
      countByStatus((["ai", "unclear", "error", "skipped"] as const).map((status) => ({ status }))),
      0,
    );
    for (const a of all) expect(`${a.title} ${a.text}`).not.toMatch(/[–—]/);
  });

  it("Anzeigenamen", () => {
    expect(displayName("https://a.de/wp/uploads/Bild%20eins.jpg?x=1")).toBe("Bild eins.jpg");
    expect(displayName("https://a.de/")).toBe("a.de");
    expect(displayPath("https://a.de/")).toBe("/");
    expect(displayPath("https://a.de/team?x=1")).toBe("/team?x=1");
  });
});

describe("snippet", () => {
  it("escaped Text und URL", () => {
    const s = labelSnippet({ text: '<b>"KI"</b>', src: 'x.jpg" onerror="alert(1)' });
    expect(s).toContain("&lt;b&gt;&quot;KI&quot;&lt;/b&gt;");
    expect(s).not.toContain('onerror="');
    expect(escapeHtml("a&b")).toBe("a&amp;b");
  });
  it("Platzhalter und Standardtext", () => {
    const s = labelSnippet({ text: "  " });
    expect(s).toContain('src="IHR-BILD.jpg"');
    expect(s).toContain("<figcaption>KI-generiert</figcaption>");
    expect(s).not.toMatch(/https?:\/\//);
  });
});
