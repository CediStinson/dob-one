import { describe as group, expect, it } from "vitest";
import {
  clampOpacity,
  computeLabelBox,
  fontSizeFor,
  labeledFileName,
  MIN_FONT_PX,
  outputType,
} from "../src/lib/label/layout.ts";
import { describe } from "../src/lib/label/verdict.ts";

group("fontSizeFor", () => {
  it("skaliert mit der kurzen Bildseite", () => {
    expect(fontSizeFor(2000, 1000, "m")).toBe(38);
    expect(fontSizeFor(1000, 2000, "l")).toBe(52);
  });
  it("hat eine Mindestgröße", () => {
    expect(fontSizeFor(100, 100, "s")).toBe(MIN_FONT_PX);
  });
});

group("computeLabelBox", () => {
  it("setzt das Label unten rechts mit Rand", () => {
    const b = computeLabelBox(1000, 800, 100, { position: "bottom-right", size: "m" });
    expect(b.x + b.width).toBe(1000 - 20);
    expect(b.y + b.height).toBe(800 - 20);
  });
  it("setzt das Label oben links mit Rand", () => {
    const b = computeLabelBox(1000, 800, 100, { position: "top-left", size: "m" });
    expect(b.x).toBe(20);
    expect(b.y).toBe(20);
    expect(b.textX).toBe(b.x + b.paddingX);
  });
  it("wird nie breiter als das Bild", () => {
    const b = computeLabelBox(200, 200, 5000, { position: "top-right", size: "l" });
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(200);
  });
  it("bleibt bei allen Positionen im Bild", () => {
    for (const position of ["top-left", "top-right", "bottom-left", "bottom-right"] as const) {
      const b = computeLabelBox(640, 360, 120, { position, size: "s" });
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(640);
      expect(b.y + b.height).toBeLessThanOrEqual(360);
    }
  });
});

group("Hilfsfunktionen", () => {
  it("begrenzt die Deckkraft", () => {
    expect(clampOpacity(0)).toBe(0.3);
    expect(clampOpacity(2)).toBe(1);
    expect(clampOpacity(Number.NaN)).toBe(0.9);
  });
  it("baut Dateinamen", () => {
    expect(labeledFileName("foto.final.JPG", "jpg")).toBe("foto.final-ki-label.jpg");
    expect(labeledFileName("ohne", "png")).toBe("ohne-ki-label.png");
  });
  it("wählt das Ausgabeformat", () => {
    expect(outputType("image/jpeg").ext).toBe("jpg");
    expect(outputType("image/avif")).toEqual({ type: "image/png", ext: "png" });
  });
  it("beschreibt Ergebnisse mit Generator", () => {
    expect(describe({ verdict: "ai", generator: "Midjourney" }).detail).toContain("Midjourney");
    expect(describe({ verdict: "none" }).detail).toContain("kein Beweis");
  });
});
