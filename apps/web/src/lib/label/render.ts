import { computeLabelBox, fontSizeFor, THEME_COLORS, type LabelOptions } from "./layout.ts";

export const LABEL_FONT = '"Inter Variable", system-ui, sans-serif';

/** Zeichnet Bild und Label in ctx. w/h sind die Zielmaße. */
export function drawLabeled(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  w: number,
  h: number,
  opts: LabelOptions,
): void {
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  const text = opts.text.trim();
  if (!text) return;

  const fontSize = fontSizeFor(w, h, opts.size);
  ctx.font = `600 ${fontSize}px ${LABEL_FONT}`;
  const box = computeLabelBox(w, h, ctx.measureText(text).width, opts);
  const colors = THEME_COLORS[opts.theme];

  ctx.save();
  ctx.globalAlpha = opts.opacity;
  ctx.fillStyle = colors.bg;
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.width, box.height, box.radius);
  ctx.fill();
  ctx.fillStyle = colors.fg;
  ctx.textBaseline = "middle";
  ctx.fillText(text, box.textX, box.textY, box.width - box.paddingX * 2);
  ctx.restore();
}
