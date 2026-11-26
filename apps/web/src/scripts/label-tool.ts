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
  clampOpacity,
  DEFAULT_OPTIONS,
  labeledFileName,
  outputType,
  type LabelOptions,
  type Position,
  type Size,
  type Theme,
} from "../lib/label/layout.ts";
import { drawLabeled, LABEL_FONT } from "../lib/label/render.ts";
import { describe } from "../lib/label/verdict.ts";
import { createZip, uniqueNames } from "../lib/zip.ts";

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
const tpl = $<HTMLTemplateElement>("#item-template");

const items: Item[] = [];

function readOptions(): LabelOptions {
  const data = new FormData(form);
  const template = String(data.get("template") ?? DEFAULT_OPTIONS.text);
  const text = template === "__custom" ? customText.value.slice(0, 60) : template;
  customText.disabled = template !== "__custom";
  const opacity = clampOpacity(Number(data.get("opacity")) / 100);
  opacityOut.value = `${Math.round(opacity * 100)} %`;
  return {
    text,
    position: (data.get("position") as Position) ?? DEFAULT_OPTIONS.position,
    size: (data.get("size") as Size) ?? DEFAULT_OPTIONS.size,
    theme: (data.get("theme") as Theme) ?? DEFAULT_OPTIONS.theme,
    opacity,
  };
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
  drawLabeled(ctx, item.bitmap, w, h, readOptions());
  const out = outputType(item.file.type);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, out.type, out.type === "image/png" ? undefined : 0.92),
  );
  if (!blob) throw new Error("Export fehlgeschlagen");
  const marked = await embedMarker(blob, out.type, w, h);
  return { blob: marked, name: labeledFileName(item.file.name, out.ext) };
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
// "KI-bearbeitet" passt zur IPTC-Angabe "Montage/Bearbeitung mit KI".
form.addEventListener("change", (e) => {
  const t = e.target as HTMLInputElement;
  if (t.name !== "template" || readMarker() === null) return;
  const code =
    t.value === "KI-bearbeitet"
      ? "compositeWithTrainedAlgorithmicMedia"
      : "trainedAlgorithmicMedia";
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
void document.fonts.load(`600 24px ${LABEL_FONT}`).then(renderAll, renderAll);
renderAll();
