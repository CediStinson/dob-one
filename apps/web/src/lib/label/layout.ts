/**
 * Reine Layout-Logik für das sichtbare KI-Label nach docs/04-label-spec.md.
 * Kein DOM, damit testbar. Textbreiten kommen über eine Messfunktion herein.
 */

export type Position = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type Variant = "short" | "gen" | "mod";
export type ColorPreset = "black" | "white" | "black50" | "white50";
export type ExportFormat = "original" | "png" | "jpg" | "webp";

export interface BadgeOptions {
  mode: "badge";
  variant: Variant;
  color: ColorPreset;
  /** Höhe in % der kürzeren Bildkante, 4 bis 20 */
  sizePct: number;
  position: Position;
}

export interface TextOptions {
  mode: "text";
  text: string;
  /** 0 = Schwarz, 100 = Weiß */
  gray: number;
  /** 0.3 bis 1 */
  opacity: number;
  /** Schriftgröße in % der kürzeren Bildkante, 2 bis 8 */
  sizePct: number;
  position: Position;
}

export type LabelOptions = BadgeOptions | TextOptions;

/** Breite eines Textes in px bei gegebener Schriftstärke und -größe. */
export type Measure = (text: string, weight: number, fontSize: number) => number;

export const BADGE_TEXT = "KI";
export const VARIANT_EXTRA: Record<Variant, string | null> = {
  short: null,
  gen: "GENERIERT",
  mod: "MODIFIZIERT",
};
export const WEIGHT_BOLD = 700;
export const WEIGHT_SEMI = 600;

export const COLOR_PRESETS: Record<ColorPreset, { bg: string; fg: string; alpha: number }> = {
  black: { bg: "#000000", fg: "#FFFFFF", alpha: 1 },
  white: { bg: "#FFFFFF", fg: "#000000", alpha: 1 },
  black50: { bg: "#000000", fg: "#FFFFFF", alpha: 0.5 },
  white50: { bg: "#FFFFFF", fg: "#000000", alpha: 0.5 },
};

/** Vorschläge für Label-Texte (Website-Check-Snippet). */
export const TEMPLATES = [
  "KI-generiert",
  "Mit KI erstellt",
  "KI-bearbeitet",
  "Bild: KI-generiert",
] as const;

export const TEXT_TEMPLATE = "Dieses Bild wurde mit Unterstützung von KI erstellt";
export const MAX_TEXT = 100;
export const MIN_FONT_PX = 11;

export const BADGE_SIZE = { min: 4, max: 20, default: 8 } as const;
export const TEXT_SIZE = { min: 2, max: 8, default: 3.5 } as const;

export const DEFAULT_BADGE: BadgeOptions = {
  mode: "badge",
  variant: "gen",
  color: "black",
  sizePct: BADGE_SIZE.default,
  position: "bottom-right",
};

export const DEFAULT_TEXT: TextOptions = {
  mode: "text",
  text: TEXT_TEMPLATE,
  gray: 100,
  opacity: 0.9,
  sizePct: TEXT_SIZE.default,
  position: "bottom-right",
};

export function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function clampOpacity(value: number): number {
  return clamp(value, 0.3, 1, DEFAULT_TEXT.opacity);
}

export interface BadgeLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  fontSize: number;
  extraFontSize: number;
  /** Grundlinie (textBaseline "middle") inkl. optischem Versatz */
  textY: number;
  /** Linker Rand von "KI" (textAlign "left"); beim Kurz-Badge die Mitte (textAlign "center") */
  kiX: number;
  extraX: number | null;
  extra: string | null;
}

function place(
  w: number,
  h: number,
  boxW: number,
  boxH: number,
  marginX: number,
  marginY: number,
  position: Position,
): { x: number; y: number } {
  const x = position.endsWith("left") ? marginX : w - marginX - boxW;
  const y = position.startsWith("top") ? marginY : h - marginY - boxH;
  return { x: Math.max(0, x), y: Math.max(0, y) };
}

/** Badge (Kurz) oder Pille (GEN/MOD) nach Spec. */
export function computeBadge(
  w: number,
  h: number,
  opts: Pick<BadgeOptions, "variant" | "sizePct" | "position">,
  measure: Measure,
): BadgeLayout {
  const s = Math.min(w, h);
  const pct = clamp(opts.sizePct, BADGE_SIZE.min, BADGE_SIZE.max, BADGE_SIZE.default);
  const height = Math.max(32, (s * pct) / 100);
  const margin = Math.max(4, s * 0.012);
  const extra = VARIANT_EXTRA[opts.variant];

  if (!extra) {
    const fontSize = height * 0.44;
    const { x, y } = place(w, h, height, height, margin, margin, opts.position);
    return {
      x,
      y,
      width: height,
      height,
      radius: height * 0.16,
      fontSize,
      extraFontSize: 0,
      textY: y + height / 2 + fontSize * 0.04,
      kiX: x + height / 2,
      extraX: null,
      extra: null,
    };
  }

  const fontSize = height * 0.4;
  const extraFontSize = fontSize * 0.86;
  const padX = height * 0.32;
  const gap = height * 0.18;
  const kiW = measure(BADGE_TEXT, WEIGHT_BOLD, fontSize);
  const extraW = measure(extra, WEIGHT_SEMI, extraFontSize);
  const width = padX * 2 + kiW + gap + extraW;
  const { x, y } = place(w, h, width, height, margin, margin, opts.position);
  return {
    x,
    y,
    width,
    height,
    radius: height / 2,
    fontSize,
    extraFontSize,
    textY: y + height / 2 + fontSize * 0.04,
    kiX: x + padX,
    extraX: x + padX + kiW + gap,
    extra,
  };
}

/** Bricht Text an Leerzeichen um, damit er in maxWidth passt. Zu lange Wörter bleiben ganz. */
export function wrapLines(text: string, maxWidth: number, width: (t: string) => number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && width(next) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export interface TextLayout {
  fontSize: number;
  lineHeight: number;
  lines: string[];
  /** Ankerpunkt: textAlign links/rechts je nach Position */
  x: number;
  align: "left" | "right";
  /** Grundlinie ("alphabetic") jeder Zeile */
  baselines: number[];
  color: string;
  shadow: string;
  shadowBlur: number;
}

export function grayHex(gray: number): string {
  const v = Math.round((clamp(gray, 0, 100, 100) * 255) / 100);
  const hex = v.toString(16).padStart(2, "0");
  return `#${hex}${hex}${hex}`;
}

/** Eigener Text: Zeilen, Ausrichtung, Farbe und Schatten in Gegenfarbe. */
export function computeText(
  w: number,
  h: number,
  opts: Pick<TextOptions, "text" | "gray" | "sizePct" | "position">,
  measure: Measure,
): TextLayout {
  const s = Math.min(w, h);
  const pct = clamp(opts.sizePct, TEXT_SIZE.min, TEXT_SIZE.max, TEXT_SIZE.default);
  const fontSize = Math.max(MIN_FONT_PX, (s * pct) / 100);
  const marginY = Math.max(14, s * 0.022);
  const marginX = marginY * 1.35;
  const maxWidth = Math.max(1, w - marginX * 2);
  const text = opts.text.slice(0, MAX_TEXT);
  const lines = wrapLines(text, maxWidth, (t) => measure(t, WEIGHT_SEMI, fontSize));
  const lineHeight = fontSize * 1.25;
  const left = opts.position.endsWith("left");
  const top = opts.position.startsWith("top");
  // Grundlinie liegt ca. 0,8 Schriftgrößen unter der Zeilenoberkante.
  const blockH = lineHeight * Math.max(0, lines.length - 1) + fontSize;
  const firstTop = top ? marginY : h - marginY - blockH;
  const baselines = lines.map((_, i) => firstTop + i * lineHeight + fontSize * 0.8);
  const gray = clamp(opts.gray, 0, 100, 100);
  return {
    fontSize,
    lineHeight,
    lines,
    x: left ? marginX : w - marginX,
    align: left ? "left" : "right",
    baselines,
    color: grayHex(gray),
    shadow: gray >= 50 ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)",
    shadowBlur: fontSize * 0.2,
  };
}

/** Dateiname für den Download: name.jpg -> name-ki-label.jpg */
export function labeledFileName(name: string, ext: string): string {
  const base = name.replace(/\.[^./\\]+$/, "") || "bild";
  return `${base}-ki-label.${ext}`;
}

/** Ausgabeformat. "original": JPEG und WebP bleiben, alles andere wird PNG. */
export function outputType(
  mime: string,
  format: ExportFormat = "original",
): { type: string; ext: string } {
  const jpg = { type: "image/jpeg", ext: "jpg" };
  const webp = { type: "image/webp", ext: "webp" };
  const png = { type: "image/png", ext: "png" };
  if (format === "jpg") return jpg;
  if (format === "webp") return webp;
  if (format === "png") return png;
  if (mime === "image/jpeg") return jpg;
  if (mime === "image/webp") return webp;
  return png;
}

export const EXPORT_QUALITY = 0.9;
