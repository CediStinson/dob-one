import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { classifySourceType, detect, matchGenerator } from "../src/index.ts";

/**
 * Gemeinsame Erwartungsliste für TypeScript und PHP (Klarbild, apps/klarbild/tests/ParityTest.php).
 * Beide Implementierungen müssen für jede Datei und jeden Anfang das gleiche Ergebnis liefern.
 * Neu schreiben nach Änderungen an der Erkennung: UPDATE_EXPECTED=1 pnpm test
 */
const FIXTURES = [
  "jpeg-c2pa-camera.jpg",
  "jpeg-c2pa-chatgpt.jpg",
  "jpeg-c2pa-photoshop.jpg",
  "jpeg-camera.jpg",
  "jpeg-exif-firefly.jpg",
  "jpeg-xmp-attr.jpg",
  "jpeg-xmp-google.jpg",
  "png-a1111.png",
  "png-comfyui.png",
  "png-plain.png",
  "png-xmp-composite.png",
  "webp-exif-midjourney.webp",
  "webp-xmp.webp",
];
const REAL = [
  "c2pa-org/adobe-20220124-A.jpg",
  "c2pa-org/adobe-20220124-C.jpg",
  "c2pa-org/adobe-20220124-CA.jpg",
  "c2pa-org/adobe-20220124-E-sig-CA.jpg",
  "c2pa-org/adobe-20220124-XCA.jpg",
];

const path = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
const read = (name: string) => new Uint8Array(readFileSync(path(name)));
const EXPECTED = path("expected.json");
const EXPECTED_FIELDS = path("expected-fields.json");

/** Feldwerte für jeden Generator und jeden Source Type, auch solche ohne eigenes Fixture. */
const GENERATOR_SAMPLES = [
  "Midjourney v6",
  "DALL·E 3",
  "DALL-E",
  "dall e",
  "OpenAI API",
  "ChatGPT",
  "GPT-4o",
  "gpt-image-1",
  "Sora",
  "Adobe Firefly",
  "Stable Diffusion XL",
  "stable-diffusion",
  "SDXL 1.0",
  "Stability.ai",
  "ComfyUI",
  "AUTOMATIC1111",
  "a1111",
  "InvokeAI 3.0",
  "Invoke AI",
  "Fooocus 2.1",
  "NovelAI",
  "Leonardo.Ai",
  "Ideogram 2.0",
  "FLUX.1 [dev]",
  "flux.2",
  "Black Forest Labs",
  "Google Gemini",
  "Imagen 3",
  "Nano Banana",
  "Made with Google AI",
  "Bing Image Creator",
  "Microsoft Designer",
  "Copilot Designer",
  "Meta AI",
  "Imagine with Meta",
  "Grok 2",
  "RunwayML",
  "Runway Gen-3",
  "Krea.ai",
  "Playground v2.5",
  "Playground AI",
  "DreamStudio",
  "Recraft V3",
  "Freepik AI",
  "Freepik Pikaso",
  "Freepik Mystic",
  "Adobe Photoshop 25.0",
  "Canon EOS R5",
  "GIMP 2.10",
  "influx",
  "groking",
  "sorait",
  "",
];
const SOURCE_TYPE_SAMPLES = [
  "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia",
  "https://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia",
  "algorithmicallyEnhanced",
  "  TRAINEDALGORITHMICMEDIA  ",
  "http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture",
  "http://example.com/#trainedAlgorithmicMedia",
  "///",
  "",
];

const buildFields = () => ({
  generators: GENERATOR_SAMPLES.map((value) => ({
    value,
    generator: matchGenerator(value) ?? null,
  })),
  sourceTypes: SOURCE_TYPE_SAMPLES.map((value) => ({ value, ...classifySourceType(value) })),
});

interface Case {
  file: string;
  /** Anzahl Bytes vom Anfang; null = ganze Datei. */
  length: number | null;
  result: ReturnType<typeof detect>;
}

function build(): Case[] {
  const cases: Case[] = [];
  for (const file of FIXTURES) {
    const bytes = read(file);
    cases.push({ file, length: null, result: detect(bytes) });
    // Abgeschnittene Anfänge: so liest auch das Plugin (erste 256 KB) und der Scanner.
    for (let n = 0; n < bytes.length; n += 37) {
      cases.push({ file, length: n, result: detect(bytes.subarray(0, n)) });
    }
  }
  for (const file of REAL) {
    const bytes = read(file);
    cases.push({ file, length: null, result: detect(bytes) });
    for (const n of [65536, 8192, 1024]) {
      cases.push({ file, length: n, result: detect(bytes.subarray(0, n)) });
    }
  }
  return cases;
}

const serialize = (cases: Case[]) =>
  "[\n" + cases.map((c) => JSON.stringify(c)).join(",\n") + "\n]\n";

describe("detect: gemeinsame Erwartungsliste (TS = PHP)", () => {
  it("fixtures/expected.json passt zur aktuellen Erkennung", () => {
    const cases = build();
    if (process.env.UPDATE_EXPECTED === "1") writeFileSync(EXPECTED, serialize(cases));
    const stored = JSON.parse(readFileSync(EXPECTED, "utf8")) as Case[];
    expect(stored).toEqual(JSON.parse(JSON.stringify(cases)));
    // Die Liste deckt alle Urteile ab.
    const verdicts = new Set(cases.map((c) => c.result.verdict));
    expect([...verdicts].sort()).toEqual(["ai", "ai_partial", "none", "unclear"]);
  });

  it("fixtures/expected-fields.json passt (Generatoren, Source Types)", () => {
    const fields = buildFields();
    if (process.env.UPDATE_EXPECTED === "1") {
      writeFileSync(EXPECTED_FIELDS, JSON.stringify(fields, null, 2) + "\n");
    }
    expect(JSON.parse(readFileSync(EXPECTED_FIELDS, "utf8"))).toEqual(fields);
    // Jeder bekannte Generator kommt in den Beispielen vor.
    const names = new Set(fields.generators.map((g) => g.generator).filter(Boolean));
    expect(names.size).toBe(23);
  });
});
