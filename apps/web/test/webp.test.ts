import { describe, expect, it } from "vitest";
import type { DetectResult } from "@dob-one/detect";
import {
  clampQuality,
  describeSavings,
  fitSize,
  formatBytes,
  markerFor,
  parseMaxEdge,
  savingsPct,
  webpFileName,
} from "../src/lib/webp/convert.ts";

const result = (verdict: DetectResult["verdict"]): DetectResult => ({
  format: "png",
  verdict,
  findings: [],
  has: { c2pa: false, xmp: false, exif: false },
});

describe("webp convert helpers", () => {
  it("begrenzt die Qualität", () => {
    expect(clampQuality(10)).toBe(50);
    expect(clampQuality(120)).toBe(100);
    expect(clampQuality(82.4)).toBe(82);
    expect(clampQuality(Number.NaN)).toBe(82);
  });

  it("verkleinert nur, nie vergrößern", () => {
    expect(fitSize(4000, 3000, 1920)).toEqual({ w: 1920, h: 1440 });
    expect(fitSize(1000, 3000, 1280)).toEqual({ w: 427, h: 1280 });
    expect(fitSize(800, 600, 1920)).toEqual({ w: 800, h: 600 });
    expect(fitSize(4000, 3000, 0)).toEqual({ w: 4000, h: 3000 });
    expect(parseMaxEdge("1920")).toBe(1920);
    expect(parseMaxEdge("999")).toBe(0);
  });

  it("benennt Dateien um", () => {
    expect(webpFileName("Foto Team.final.PNG")).toBe("Foto Team.final.webp");
    expect(webpFileName(".png")).toBe("bild.webp");
    expect(webpFileName("ohne-endung")).toBe("ohne-endung.webp");
  });

  it("formatiert Größen und Ersparnis", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(820 * 1024)).toBe("820 KB");
    expect(formatBytes(1.45 * 1024 * 1024)).toBe("1,4 MB");
    expect(savingsPct(1000, 250)).toBe(75);
    expect(describeSavings(1000, 250)).toBe("75 % kleiner");
    expect(describeSavings(1000, 1000)).toBe("gleich groß");
    expect(describeSavings(1000, 1200)).toMatch(/^20 % größer/);
    expect(savingsPct(0, 10)).toBe(0);
  });

  it("übernimmt erkannte KI-Hinweise", () => {
    expect(markerFor(result("ai"))).toBe("trainedAlgorithmicMedia");
    expect(markerFor(result("ai_partial"))).toBe("compositeWithTrainedAlgorithmicMedia");
    expect(markerFor(result("unclear"))).toBeNull();
    expect(markerFor(result("none"))).toBeNull();
    expect(markerFor(null)).toBeNull();
  });
});
