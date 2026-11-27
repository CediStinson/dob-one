import {
  buildXmp,
  detect,
  embedXmpJpeg,
  embedXmpPng,
  embedXmpWebp,
  type DetectResult,
  type EmbedSourceType,
} from "@dob-one/detect";
import {
  BADGE_SIZE,
  clamp,
  clampOpacity,
  COLOR_PRESETS,
  DEFAULT_BADGE,
  DEFAULT_TEXT,
  EXPORT_QUALITY,
  labeledFileName,
  MAX_TEXT,
  outputType,
  TEXT_SIZE,
  TEXT_TEMPLATE,
  VARIANT_EXTRA,
  type ColorPreset,
  type ExportFormat,
  type LabelOptions,
  type Position,
  type Variant,
} from "../lib/label/layout.ts";
import { drawLabeled, LABEL_FONT } from "../lib/label/render.ts";
import { describe } from "../lib/label/verdict.ts";
import { createZip, uniqueNames } from "../lib/zip.ts";
import { track } from "./stats.ts";

const MAX_FILES = 20;
const MAX_BYTES = 40 * 1024 * 1024;
const PREVIEW_MAX = 720;
const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/avif"];

interface Item {
  file: File;
  bitmap: ImageBitmap;
  result: DetectResult | null;
  canvas: HTMLCanvasElement;
}

const $ = <T extends Element>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`Element fehlt: ${sel}`);
  return el;
};

const form = $<HTMLFormElement>("#label-options");
const drop = $<HTMLLabelElement>("#drop");
const input = $<HTMLInputElement>("#files");
const list = $<HTMLUListElement>("#items");
const msg = $<HTMLParagraphElement>("#tool-msg");
const allBtn = $<HTMLButtonElement>("#download-all");
const clearBtn = $<HTMLButtonElement>("#clear-all");
const customText = $<HTMLInputElement>("#custom-text");
const opacityOut = $<HTMLOutputElement>("#opacity-out");
const badgeBox = $<HTMLDivElement>("#badge-options");
const textBox = $<HTMLDivElement>("#text-options");
const colorHint = $<HTMLParagraphElement>("#color-hint");
const badgeSizeOut = $<HTMLOutputElement>("#badge-size-out");
const textSizeOut = $<HTMLOutputElement>("#text-size-out");
const grayOut = $<HTMLOutputElement>("#gray-out");
const tpl = $<HTMLTemplateElement>("#item-template");

const items: Item[] = [];

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

const POSITIONS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;
const FORMATS = ["original", "png", "jpg", "webp"] as const;
const pct = (n: number) => `${String(n).replace(".", ",")} %`;

function readOptions(): LabelOptions {
  const data = new FormData(form);
  const mode = data.get("mode") === "text" ? "text" : "badge";
  badgeBox.hidden = mode !== "badge";
  textBox.hidden = mode !== "text";
  const position = pick<Position>(data.get("position"), POSITIONS, DEFAULT_BADGE.position);

  if (mode === "badge") {
    const color = pick<ColorPreset>(
      data.get("color"),
      Object.keys(COLOR_PRESETS) as ColorPreset[],
      DEFAULT_BADGE.color,
    );
    const sizePct = clamp(
      Number(data.get("badgeSize")),
      BADGE_SIZE.min,
      BADGE_SIZE.max,
      BADGE_SIZE.default,
    );
    colorHint.hidden = COLOR_PRESETS[color].alpha === 1;
    badgeSizeOut.value = pct(sizePct);
    return {
      mode,
      variant: pick<Variant>(
        data.get("variant"),
        Object.keys(VARIANT_EXTRA) as Variant[],
        DEFAULT_BADGE.variant,
      ),
      color,
      sizePct,
      position,
    };
  }

  const custom = data.get("textSource") === "custom";
  customText.disabled = !custom;
  const text = custom ? customText.value.slice(0, MAX_TEXT) : TEXT_TEMPLATE;
  const opacity = clampOpacity(Number(data.get("opacity")) / 100);
  const gray = clamp(Number(data.get("gray")), 0, 100, DEFAULT_TEXT.gray);
  const sizePct = clamp(
    Number(data.get("textSize")),
    TEXT_SIZE.min,
    TEXT_SIZE.max,
    TEXT_SIZE.default,
  );
  opacityOut.value = `${Math.round(opacity * 100)} %`;
  grayOut.value = gray === 0 ? "Schwarz" : gray === 100 ? "Weiß" : `${gray} %`;
  textSizeOut.value = pct(sizePct);
  return { mode, text, gray, opacity, sizePct, position };
}

function readFormat(): ExportFormat {
  return pick<ExportFormat>(new FormData(form).get("format"), FORMATS, "original");
}

function renderPreview(item: Item, opts: LabelOptions): void {
  const scale = Math.min(1, PREVIEW_MAX / Math.max(item.bitmap.width, item.bitmap.height));
  const w = Math.max(1, Math.round(item.bitmap.width * scale));
  const h = Math.max(1, Math.round(item.bitmap.height * scale));
  item.canvas.width = w;
  item.canvas.height = h;
  const ctx = item.canvas.getContext("2d");
  if (ctx) drawLabeled(ctx, item.bitmap, w, h, opts);
}

function renderAll(): void {
  const opts = readOptions();
  for (const item of items) renderPreview(item, opts);
  allBtn.disabled = items.length === 0;
  clearBtn.disabled = items.length === 0;
  allBtn.hidden = items.length < 2;
}

async function exportBlob(item: Item): Promise<{ blob: Blob; name: string }> {
  const { width: w, height: h } = item.bitmap;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nicht verfügbar");
  const out = outputType(item.file.type, readFormat());
  // JPG kennt keine Transparenz: vorher weiß füllen, sonst werden transparente Bereiche schwarz.
  drawLabeled(
    ctx,
    item.bitmap,
    w,
    h,
    readOptions(),
    out.type === "image/jpeg" ? "#FFFFFF" : undefined,
  );
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, out.type, out.type === "image/png" ? undefined : EXPORT_QUALITY),
  );
  if (!blob) throw new Error("Export fehlgeschlagen");
  // Manche Browser können kein WebP schreiben und liefern PNG: dann auch als PNG benennen.
  const actual = outputType(blob.type, "original");
  const marked = await embedMarker(blob, actual.type, w, h);
  return { blob: marked, name: labeledFileName(item.file.name, actual.ext) };
}

function readMarker(): EmbedSourceType | null {
  const value = new FormData(form).get("marker");
  return value === "trainedAlgorithmicMedia" || value === "compositeWithTrainedAlgorithmicMedia"
    ? value
    : null;
}

/** Bettet den IPTC-Hinweis ein. Schlägt das fehl, bleibt die Datei ohne Metadaten nutzbar. */
async function embedMarker(blob: Blob, type: string, w: number, h: number): Promise<Blob> {
  const marker = readMarker();
  if (!marker) return blob;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const xmp = buildXmp(marker);
  try {
    const out =
      type === "image/jpeg"
        ? embedXmpJpeg(bytes, xmp)
        : type === "image/webp"
          ? embedXmpWebp(bytes, xmp, w, h)
          : embedXmpPng(bytes, xmp);
    return new Blob([out as Uint8Array<ArrayBuffer>], { type });
  } catch {
    return blob;
  }
}

function save(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function download(item: Item): Promise<void> {
  try {
    const { blob, name } = await exportBlob(item);
    save(blob, name);
    track("label_export", 1);
  } catch {
    msg.textContent = `${item.file.name} konnte nicht exportiert werden.`;
  }
}

function addItemView(item: Item): void {
  const node = tpl.content.firstElementChild?.cloneNode(true) as HTMLLIElement;
  node.querySelector(".preview")?.append(item.canvas);
  node.querySelector(".name")!.textContent = item.file.name;
  const verdict = node.querySelector<HTMLDivElement>(".verdict")!;
  if (item.result) {
    const v = describe(item.result);
    verdict.dataset.tone = v.tone;
    verdict.querySelector("strong")!.textContent = v.title;
    verdict.querySelector("span")!.textContent = v.detail;
  } else {
    verdict.dataset.tone = "unclear";
    verdict.querySelector("strong")!.textContent = "Metadaten nicht lesbar";
    verdict.querySelector("span")!.textContent = "Die Datei konnte nicht ausgewertet werden.";
  }
  node
    .querySelector<HTMLButtonElement>(".dl")!
    .addEventListener("click", () => void download(item));
  node.querySelector<HTMLButtonElement>(".rm")!.addEventListener("click", () => {
    items.splice(items.indexOf(item), 1);
    item.bitmap.close();
    node.remove();
    renderAll();
  });
  list.append(node);
}

async function addFiles(files: FileList | File[]): Promise<void> {
  msg.textContent = "";
  const skipped: string[] = [];
  for (const file of Array.from(files)) {
    if (items.length >= MAX_FILES) {
      skipped.push(`${file.name} (maximal ${MAX_FILES} Bilder)`);
      continue;
    }
    if (!ACCEPT.includes(file.type)) {
      skipped.push(`${file.name} (Format nicht unterstützt)`);
      continue;
    }
    if (file.size > MAX_BYTES) {
      skipped.push(`${file.name} (größer als 40 MB)`);
      continue;
    }
    try {
      const bitmap = await createImageBitmap(file);
      let result: DetectResult | null = null;
      try {
        result = detect(new Uint8Array(await file.arrayBuffer()));
      } catch {
        result = null;
      }
      const canvas = document.createElement("canvas");
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", `Vorschau ${file.name} mit Label`);
      const item: Item = { file, bitmap, result, canvas };
      items.push(item);
      addItemView(item);
    } catch {
      skipped.push(`${file.name} (konnte nicht geöffnet werden)`);
    }
  }
  if (skipped.length) msg.textContent = `Nicht übernommen: ${skipped.join(", ")}.`;
  renderAll();
}

form.addEventListener("input", renderAll);
// Variante GEN/MOD passt zur IPTC-Angabe "KI-generiert" bzw. "Bearbeitung/Montage mit KI".
form.addEventListener("change", (e) => {
  const t = e.target as HTMLInputElement;
  if (t.name !== "variant" || t.value === "short" || readMarker() === null) return;
  const code =
    t.value === "mod" ? "compositeWithTrainedAlgorithmicMedia" : "trainedAlgorithmicMedia";
  const radio = form.querySelector<HTMLInputElement>(`input[name="marker"][value="${code}"]`);
  if (radio) radio.checked = true;
});
form.addEventListener("submit", (e) => e.preventDefault());
input.addEventListener("change", () => {
  if (input.files) void addFiles(input.files);
  input.value = "";
});
for (const type of ["dragenter", "dragover"]) {
  drop.addEventListener(type, (e) => {
    e.preventDefault();
    drop.classList.add("over");
  });
}
for (const type of ["dragleave", "drop"]) {
  drop.addEventListener(type, () => drop.classList.remove("over"));
}
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  if (e.dataTransfer?.files) void addFiles(e.dataTransfer.files);
});
allBtn.addEventListener("click", async () => {
  allBtn.disabled = true;
  msg.textContent = "ZIP wird erstellt …";
  try {
    const files: { name: string; data: Uint8Array }[] = [];
    for (const item of items) {
      const { blob, name } = await exportBlob(item);
      files.push({ name, data: new Uint8Array(await blob.arrayBuffer()) });
    }
    const names = uniqueNames(files.map((f) => f.name));
    const zip = createZip(files.map((f, i) => ({ name: names[i]!, data: f.data })));
    save(
      new Blob([zip as Uint8Array<ArrayBuffer>], { type: "application/zip" }),
      "ki-label-bilder.zip",
    );
    track("label_export", files.length);
    msg.textContent = "";
  } catch {
    msg.textContent =
      "Das ZIP konnte nicht erstellt werden. Bitte laden Sie die Bilder einzeln herunter.";
  } finally {
    allBtn.disabled = items.length === 0;
  }
});
clearBtn.addEventListener("click", () => {
  for (const item of items) item.bitmap.close();
  items.length = 0;
  list.replaceChildren();
  msg.textContent = "";
  renderAll();
});

// Schrift laden, damit Vorschau und Export mit Inter gezeichnet werden.
void Promise.all([
  document.fonts.load(`600 24px ${LABEL_FONT}`),
  document.fonts.load(`700 24px ${LABEL_FONT}`),
]).then(renderAll, renderAll);
renderAll();
