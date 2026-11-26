/** Reine Layout-Logik für das sichtbare KI-Label. Kein DOM, damit testbar. */

export type Position = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type Size = "s" | "m" | "l";
export type Theme = "light" | "dark";

export interface LabelOptions {
  text: string;
  position: Position;
  size: Size;
  theme: Theme;
  /** 0.3 bis 1 */
  opacity: number;
}

export interface LabelBox {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  fontSize: number;
  paddingX: number;
  /** Grundlinie des Textes */
  textX: number;
  textY: number;
}

const SIZE_FACTOR: Record<Size, number> = { s: 0.028, m: 0.038, l: 0.052 };
export const MIN_FONT_PX = 11;

export const TEMPLATES = [
  "KI-generiert",
  "Mit KI erstellt",
  "KI-bearbeitet",
  "Bild: KI-generiert",
] as const;

export const DEFAULT_OPTIONS: LabelOptions = {
  text: TEMPLATES[0],
  position: "bottom-right",
  size: "m",
  theme: "light",
  opacity: 0.9,
};

export const THEME_COLORS: Record<Theme, { bg: string; fg: string }> = {
  light: { bg: "#ffffff", fg: "#1b2a33" },
  dark: { bg: "#1b2a33", fg: "#ffffff" },
};

export function fontSizeFor(imgW: number, imgH: number, size: Size): number {
  const short = Math.min(imgW, imgH);
  return Math.max(MIN_FONT_PX, Math.round(short * SIZE_FACTOR[size]));
}

/**
 * Berechnet Box und Textposition. textWidth ist die gemessene Breite des Textes
 * bei der von fontSizeFor gelieferten Schriftgröße.
 */
export function computeLabelBox(
  imgW: number,
  imgH: number,
  textWidth: number,
  opts: Pick<LabelOptions, "position" | "size">,
): LabelBox {
  const fontSize = fontSizeFor(imgW, imgH, opts.size);
  const paddingX = Math.round(fontSize * 0.6);
  const paddingY = Math.round(fontSize * 0.4);
  const margin = Math.max(4, Math.round(Math.min(imgW, imgH) * 0.025));
  const height = Math.round(fontSize * 1.2) + paddingY * 2;
  const width = Math.min(Math.ceil(textWidth) + paddingX * 2, imgW - margin * 2);
  const left = opts.position.endsWith("left");
  const top = opts.position.startsWith("top");
  const x = left ? margin : imgW - margin - width;
  const y = top ? margin : imgH - margin - height;
  return {
    x,
    y,
    width,
    height,
    radius: Math.round(fontSize * 0.35),
    fontSize,
    paddingX,
    textX: x + paddingX,
    textY: y + height / 2,
  };
}

export function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_OPTIONS.opacity;
  return Math.min(1, Math.max(0.3, value));
}

/** Dateiname für den Download: name.jpg -> name-ki-label.jpg */
export function labeledFileName(name: string, ext: string): string {
  const base = name.replace(/\.[^./\\]+$/, "") || "bild";
  return `${base}-ki-label.${ext}`;
}

/** Ausgabeformat: JPEG und WebP bleiben, alles andere wird PNG. */
export function outputType(mime: string): { type: string; ext: string } {
  if (mime === "image/jpeg") return { type: "image/jpeg", ext: "jpg" };
  if (mime === "image/webp") return { type: "image/webp", ext: "webp" };
  return { type: "image/png", ext: "png" };
}
