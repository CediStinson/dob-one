import type { DetectResult, EmbedSourceType } from "@dob-one/detect";

/** Reine Hilfsfunktionen für das WebP-Tool (T13), ohne DOM, getestet. */

export const QUALITY = { min: 50, max: 100, default: 82 } as const;
export const MAX_EDGES = [0, 2560, 1920, 1280] as const;
export type MaxEdge = (typeof MAX_EDGES)[number];

export function clampQuality(raw: number): number {
  if (!Number.isFinite(raw)) return QUALITY.default;
  return Math.min(QUALITY.max, Math.max(QUALITY.min, Math.round(raw)));
}

export function parseMaxEdge(raw: unknown): MaxEdge {
  const n = Number(raw);
  return (MAX_EDGES as readonly number[]).includes(n) ? (n as MaxEdge) : 0;
}

/** Zielgröße: längste Kante auf maxEdge verkleinern, nie vergrößern. 0 = Originalgröße. */
export function fitSize(w: number, h: number, maxEdge: number): { w: number; h: number } {
  const long = Math.max(w, h);
  if (maxEdge <= 0 || long <= maxEdge) return { w, h };
  const s = maxEdge / long;
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

export function webpFileName(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, "") || "bild";
  return `${base}.webp`;
}

/** "1,4 MB", "820 KB", "512 B" (1 KB = 1024 B). */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/** Ersparnis in Prozent (negativ = größer geworden). */
export function savingsPct(before: number, after: number): number {
  if (before <= 0) return 0;
  return Math.round((1 - after / before) * 100);
}

export function describeSavings(before: number, after: number): string {
  const p = savingsPct(before, after);
  if (p > 0) return `${p} % kleiner`;
  if (p === 0) return "gleich groß";
  return `${-p} % größer. Das Original ist hier schon gut komprimiert.`;
}

/**
 * Welcher KI-Hinweis in die WebP-Datei übernommen wird. Canvas verliert alle Metadaten,
 * deshalb schreiben wir einen erkannten KI-Hinweis als IPTC-Angabe neu.
 */
export function markerFor(result: DetectResult | null): EmbedSourceType | null {
  if (!result) return null;
  if (result.verdict === "ai") return "trainedAlgorithmicMedia";
  if (result.verdict === "ai_partial") return "compositeWithTrainedAlgorithmicMedia";
  return null;
}
