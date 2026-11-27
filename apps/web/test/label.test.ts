import { describe as group, expect, it } from "vitest";
import {
  clampOpacity,
  computeBadge,
  computeText,
  grayHex,
  labeledFileName,
  MIN_FONT_PX,
  outputType,
  wrapLines,
  type Measure,
} from "../src/lib/label/layout.ts";
import { describe } from "../src/lib/label/verdict.ts";

/** Einfache Messung: jedes Zeichen 0,6 Schriftgrößen breit. */
const measure: Measure = (text, _weight, size) => text.length * size * 0.6;

group("computeBadge", () => {
  it("Kurz: quadratisch, Höhe 8 % der kurzen Kante, Radius 16 %", () => {
    const b = computeBadge(
      2000,
      1000,
      { variant: "short", sizePct: 8, position: "bottom-right" },
      measure,
    );
    expect(b.height).toBe(80);
    expect(b.width).toBe(80);
    expect(b.radius).toBeCloseTo(12.8);
    expect(b.fontSize).toBeCloseTo(35.2);
    expect(b.extra).toBeNull();
    // Rand: max(4, 1,2 % von 1000) = 12
    expect(b.x + b.width).toBeCloseTo(2000 - 12);
    expect(b.y + b.height).toBeCloseTo(1000 - 12);
    expect(b.kiX).toBeCloseTo(b.x + 40);
    expect(b.textY).toBeCloseTo(b.y + 40 + 35.2 * 0.04);
  });
  it("GEN: Pille mit Radius halbe Höhe und Zusatztext", () => {
    const b = computeBadge(
      1000,
      1000,
      { variant: "gen", sizePct: 10, position: "top-left" },
      measure,
    );
    expect(b.height).toBe(100);
    expect(b.radius).toBe(50);
    expect(b.fontSize).toBeCloseTo(40);
    expect(b.extraFontSize).toBeCloseTo(34.4);
    expect(b.extra).toBe("GENERIERT");
    expect(b.x).toBeCloseTo(12);
    expect(b.y).toBeCloseTo(12);
    const kiW = 2 * 40 * 0.6;
    const extraW = 9 * 34.4 * 0.6;
    expect(b.width).toBeCloseTo(32 * 2 + kiW + 18 + extraW);
    expect(b.kiX).toBeCloseTo(12 + 32);
    expect(b.extraX).toBeCloseTo(12 + 32 + kiW + 18);
  });
  it("MOD schreibt MODIFIZIERT", () => {
    const b = computeBadge(
      800,
      600,
      { variant: "mod", sizePct: 8, position: "top-right" },
      measure,
    );
    expect(b.extra).toBe("MODIFIZIERT");
  });
  it("hat eine Mindesthöhe von 32 px und begrenzt die Größe auf 4 bis 20 %", () => {
    expect(
      computeBadge(200, 200, { variant: "short", sizePct: 4, position: "top-left" }, measure)
        .height,
    ).toBe(32);
    expect(
      computeBadge(1000, 1000, { variant: "short", sizePct: 50, position: "top-left" }, measure)
        .height,
    ).toBe(200);
    expect(
      computeBadge(
        1000,
        1000,
        { variant: "short", sizePct: Number.NaN, position: "top-left" },
        measure,
      ).height,
    ).toBe(80);
  });
  it("bleibt bei allen Positionen im Bild", () => {
    for (const position of ["top-left", "top-right", "bottom-left", "bottom-right"] as const) {
      const b = computeBadge(640, 360, { variant: "gen", sizePct: 8, position }, measure);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(640);
      expect(b.y + b.height).toBeLessThanOrEqual(360);
    }
  });
});

group("computeText", () => {
  const base = {
    text: "Mit KI erstellt",
    gray: 100,
    sizePct: 4,
    position: "bottom-right" as const,
  };
  it("Schriftgröße in % der kurzen Kante, Rand max(14, 2,2 %), horizontal × 1,35", () => {
    const t = computeText(2000, 1000, base, measure);
    expect(t.fontSize).toBe(40);
    expect(t.align).toBe("right");
    expect(t.x).toBeCloseTo(2000 - 22 * 1.35);
    expect(t.lines).toEqual(["Mit KI erstellt"]);
    expect(t.baselines[0]).toBeCloseTo(1000 - 22 - 40 + 32);
  });
  it("oben links mit Mindestrand", () => {
    const t = computeText(200, 200, { ...base, position: "top-left" }, measure);
    expect(t.fontSize).toBe(MIN_FONT_PX);
    expect(t.x).toBeCloseTo(14 * 1.35);
    expect(t.align).toBe("left");
    expect(t.baselines[0]).toBeCloseTo(14 + MIN_FONT_PX * 0.8);
  });
  it("bricht langen Text um und bleibt im Bild", () => {
    const text = "Dieses Bild wurde mit Unterstützung von KI erstellt";
    const t = computeText(600, 400, { ...base, text, sizePct: 8 }, measure);
    expect(t.lines.length).toBeGreaterThan(1);
    expect(t.lines.join(" ")).toBe(text);
    expect(t.baselines.at(-1)!).toBeLessThanOrEqual(400 - 14);
  });
  it("begrenzt Text auf 100 Zeichen", () => {
    const t = computeText(4000, 4000, { ...base, text: "a".repeat(150) }, measure);
    expect(t.lines.join("").length).toBe(100);
  });
  it("Schatten in Gegenfarbe", () => {
    expect(computeText(800, 800, { ...base, gray: 100 }, measure).shadow).toBe("rgba(0,0,0,0.5)");
    const dark = computeText(800, 800, { ...base, gray: 0 }, measure);
    expect(dark.color).toBe("#000000");
    expect(dark.shadow).toBe("rgba(255,255,255,0.5)");
    expect(dark.shadowBlur).toBeCloseTo(dark.fontSize * 0.2);
  });
});

group("wrapLines und grayHex", () => {
  it("bricht an Leerzeichen um, lange Wörter bleiben ganz", () => {
    const width = (t: string) => t.length;
    expect(wrapLines("aa bb cc", 5, width)).toEqual(["aa bb", "cc"]);
    expect(wrapLines("superlangeswort x", 5, width)).toEqual(["superlangeswort", "x"]);
    expect(wrapLines("   ", 5, width)).toEqual([]);
  });
  it("Graustufen", () => {
    expect(grayHex(0)).toBe("#000000");
    expect(grayHex(100)).toBe("#ffffff");
    expect(grayHex(50)).toBe("#808080");
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
    expect(outputType("image/png", "jpg")).toEqual({ type: "image/jpeg", ext: "jpg" });
    expect(outputType("image/jpeg", "webp").ext).toBe("webp");
    expect(outputType("image/webp", "png").ext).toBe("png");
  });
  it("beschreibt Ergebnisse mit Generator", () => {
    expect(describe({ verdict: "ai", generator: "Midjourney" }).detail).toContain("Midjourney");
    expect(describe({ verdict: "none" }).detail).toContain("kein Beweis");
  });
});
