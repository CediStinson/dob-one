import {
  BADGE_TEXT,
  COLOR_PRESETS,
  computeBadge,
  computeText,
  WEIGHT_BOLD,
  WEIGHT_SEMI,
  type BadgeOptions,
  type LabelOptions,
  type Measure,
  type TextOptions,
} from "./layout.ts";

export const LABEL_FONT = '"Inter Variable", system-ui, sans-serif';

const font = (weight: number, size: number) => `${weight} ${size}px ${LABEL_FONT}`;

function measurer(ctx: CanvasRenderingContext2D): Measure {
  return (text, weight, size) => {
    ctx.font = font(weight, size);
    return ctx.measureText(text).width;
  };
}

/**
 * Zeichnet Bild und Label in ctx. w/h sind die Zielmaße.
 * background füllt vorher die Fläche (JPG: transparente Bereiche weiß statt schwarz).
 */
export function drawLabeled(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  w: number,
  h: number,
  opts: LabelOptions,
  background?: string,
): void {
  ctx.clearRect(0, 0, w, h);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(source, 0, 0, w, h);
  if (opts.mode === "badge") drawBadge(ctx, w, h, opts);
  else drawText(ctx, w, h, opts);
}

function drawBadge(ctx: CanvasRenderingContext2D, w: number, h: number, opts: BadgeOptions): void {
  const b = computeBadge(w, h, opts, measurer(ctx));
  const c = COLOR_PRESETS[opts.color];
  ctx.save();
  ctx.globalAlpha = c.alpha;
  ctx.fillStyle = c.bg;
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.width, b.height, b.radius);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = c.fg;
  ctx.textBaseline = "middle";
  ctx.font = font(WEIGHT_BOLD, b.fontSize);
  ctx.textAlign = b.extra ? "left" : "center";
  ctx.fillText(BADGE_TEXT, b.kiX, b.textY);
  if (b.extra && b.extraX !== null) {
    ctx.font = font(WEIGHT_SEMI, b.extraFontSize);
    ctx.fillText(b.extra, b.extraX, b.textY);
  }
  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, w: number, h: number, opts: TextOptions): void {
  const t = computeText(w, h, opts, measurer(ctx));
  if (t.lines.length === 0) return;
  ctx.save();
  ctx.globalAlpha = opts.opacity;
  ctx.font = font(WEIGHT_SEMI, t.fontSize);
  ctx.textAlign = t.align;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = t.color;
  ctx.shadowColor = t.shadow;
  ctx.shadowBlur = t.shadowBlur;
  t.lines.forEach((line, i) => ctx.fillText(line, t.x, t.baselines[i]!));
  ctx.restore();
}
