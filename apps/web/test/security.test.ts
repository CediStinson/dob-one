import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe as group, expect, it } from "vitest";
import { detect, detectChatbots, embedXmpJpeg } from "@dob-one/detect";
import { describe } from "../src/lib/label/verdict.ts";
import { labelSnippet } from "../src/lib/check/snippet.ts";
import { displayName, displayPath, safeHref } from "../src/lib/check/summary.ts";

const SRC = fileURLToPath(new URL("../src", import.meta.url));
const fixture = (name: string) =>
  new Uint8Array(
    readFileSync(
      fileURLToPath(new URL(`../../../packages/detect/fixtures/${name}`, import.meta.url)),
    ),
  );

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

const EVIL = `<script>alert(1)</script><img src=x onerror=alert(2)>`;

/** JPEG mit präpariertem XMP: Skript in CreatorTool, daneben ein Generatorname. */
function evilJpeg(): Uint8Array {
  const xmp = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmp:CreatorTool="${EVIL.replace(/</g, "&lt;").replace(/"/g, "&quot;")} Midjourney"/>
</rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
  return embedXmpJpeg(fixture("jpeg-camera.jpg"), xmp);
}

group("Sicherheit (T4e)", () => {
  it("kein innerHTML & Co. im Frontend", () => {
    const banned =
      /\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML|document\.write|set:html|new Function\(|\beval\(/;
    const hits = files(SRC)
      .filter((f) => /\.(ts|astro)$/.test(f))
      .filter((f) => banned.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });

  it("präpariertes Bild: angezeigter Text enthält kein Markup", () => {
    const r = detect(evilJpeg());
    expect(r.verdict).toBe("ai");
    // Generatorname kommt aus unserer Liste, nicht aus der Datei.
    expect(r.generator).toBe("Midjourney");
    const v = describe(r);
    expect(`${v.title} ${v.detail}`).not.toMatch(/[<>]/);
  });

  it("Rohwert bleibt Rohwert (wird nicht angezeigt, aber auch nicht entschärft)", () => {
    const r = detect(evilJpeg());
    expect(r.findings.some((f) => f.value.includes("<script>"))).toBe(true);
  });

  it("Snippet entschärft Bild-URL aus dem Scan", () => {
    const s = labelSnippet({ text: EVIL, src: `https://a.de/x.jpg"><script>alert(3)</script>` });
    expect(s).not.toContain("<script>");
    expect(s).not.toContain("<img src=x");
    expect(s.match(/</g)?.length).toBe(labelSnippet({ text: "a" }).match(/</g)?.length);
  });

  it("Links nur auf http(s), Anzeigenamen sind reiner Text", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,<script>")).toBeNull();
    expect(safeHref(" JAVASCRIPT:alert(1)")).toBeNull();
    expect(safeHref("https://a.de/x.jpg")).toBe("https://a.de/x.jpg");
    expect(displayName("javascript:alert(1)")).not.toMatch(/[<>]/);
    expect(displayPath(EVIL)).toBe(EVIL); // wird per textContent ausgegeben
    expect(detectChatbots(["javascript://code.tidio.co/x.js"])).toEqual([]);
  });
});
