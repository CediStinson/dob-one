import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { detect, type Verdict } from "../src/index.ts";

const fixture = (name: string) =>
  new Uint8Array(readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url))));

const cases: [file: string, verdict: Verdict, generator?: string][] = [
  ["png-a1111.png", "ai", "Stable Diffusion (AUTOMATIC1111/Forge)"],
  ["png-comfyui.png", "ai", "ComfyUI"],
  ["png-plain.png", "none"],
  ["png-xmp-composite.png", "ai_partial"],
  ["jpeg-xmp-google.jpg", "ai", "Google Gemini / Imagen"],
  ["jpeg-xmp-attr.jpg", "ai"],
  ["jpeg-exif-firefly.jpg", "ai", "Adobe Firefly"],
  ["jpeg-camera.jpg", "none"],
  ["jpeg-c2pa-chatgpt.jpg", "ai", "ChatGPT / OpenAI"],
  ["jpeg-c2pa-photoshop.jpg", "ai_partial"],
  ["jpeg-c2pa-camera.jpg", "unclear"],
  ["webp-xmp.webp", "ai"],
  ["webp-exif-midjourney.webp", "ai", "Midjourney"],
];

describe("detect: Fixtures", () => {
  it.each(cases)("%s → %s", (file, verdict, generator) => {
    const r = detect(fixture(file));
    expect(r.verdict).toBe(verdict);
    if (generator) expect(r.generator).toBe(generator);
  });

  it("liest C2PA-Details (ChatGPT)", () => {
    const r = detect(fixture("jpeg-c2pa-chatgpt.jpg"));
    expect(r.has.c2pa).toBe(true);
    expect(r.findings).toContainEqual(
      expect.objectContaining({ source: "c2pa", value: "trainedAlgorithmicMedia" }),
    );
    expect(r.findings).toContainEqual(expect.objectContaining({ value: "ChatGPT" }));
  });

  it("setzt C2PA über mehrere APP11-Segmente zusammen (Photoshop)", () => {
    const r = detect(fixture("jpeg-c2pa-photoshop.jpg"));
    expect(r.findings).toContainEqual(expect.objectContaining({ value: "Adobe Photoshop" }));
    expect(r.findings).toContainEqual(
      expect.objectContaining({
        value: "compositeWithTrainedAlgorithmicMedia",
        meaning: "ai_composite",
      }),
    );
  });

  it("meldet Kamera-Metadaten nicht als KI", () => {
    const r = detect(fixture("jpeg-camera.jpg"));
    expect(r.has.exif).toBe(true);
    expect(r.findings).toEqual([]);
  });
});

describe("detect: Robustheit", () => {
  it("wirft nicht bei leeren oder zufälligen Daten", () => {
    expect(detect(new Uint8Array()).verdict).toBe("none");
    const noise = new Uint8Array(4096).map((_, i) => (i * 2654435761) >>> 24);
    expect(() => detect(noise)).not.toThrow();
  });

  it("wirft nicht bei abgeschnittenen Dateien an jeder Stelle", () => {
    for (const file of cases.map((c) => c[0])) {
      const bytes = fixture(file);
      for (let n = 0; n < bytes.length; n += 7) {
        expect(() => detect(bytes.subarray(0, n))).not.toThrow();
      }
    }
  });

  it("findet XMP auch in unbekannten Formaten (Fallback)", () => {
    const xmp = fixture("jpeg-xmp-attr.jpg");
    const fake = new Uint8Array([0, 0, 0, 0x1c, ...new TextEncoder().encode("ftypheic"), ...xmp]);
    expect(detect(fake).verdict).toBe("ai");
  });
});
