import { buildXmp, detect, embedXmpWebp, type DetectResult } from "@dob-one/detect";
import {
  clampQuality,
  describeSavings,
  fitSize,
  formatBytes,
  markerFor,
  parseMaxEdge,
  savingsPct,
  webpFileName,
} from "../lib/webp/convert.ts";
import { createZip, uniqueNames } from "../lib/zip.ts";
import { track } from "./stats.ts";

const MAX_FILES = 30;
const MAX_BYTES = 40 * 1024 * 1024;
const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "image/bmp"];

interface Item {
  file: File;
  bitmap: ImageBitmap;
  result: DetectResult | null;
  out: { blob: Blob; w: number; h: number; marked: boolean } | null;
  node: HTMLLIElement;
}

const $ = <T extends Element>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`Element fehlt: ${sel}`);
  return el;
};

const form = $<HTMLFormElement>("#webp-options");
const drop = $<HTMLLabelElement>("#drop");
const input = $<HTMLInputElement>("#files");
const list = $<HTMLUListElement>("#items");
const msg = $<HTMLParagraphElement>("#tool-msg");
const allBtn = $<HTMLButtonElement>("#download-all");
const clearBtn = $<HTMLButtonElement>("#clear-all");
const qualityOut = $<HTMLOutputElement>("#quality-out");
const summary = $<HTMLParagraphElement>("#summary");
const tpl = $<HTMLTemplateElement>("#item-template");

const items: Item[] = [];
let noWebp = false;
let run = 0;

function readOptions() {
  const data = new FormData(form);
  const quality = clampQuality(Number(data.get("quality")));
  qualityOut.value = String(quality);
  return {
    quality,
    maxEdge: parseMaxEdge(data.get("maxEdge")),
    keepMarker: data.get("keepMarker") === "on",
  };
}

async function convert(item: Item, opts: ReturnType<typeof readOptions>): Promise<void> {
  const { w, h } = fitSize(item.bitmap.width, item.bitmap.height, opts.maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nicht verfügbar");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(item.bitmap, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", opts.quality / 100),
  );
  if (!blob) throw new Error("Export fehlgeschlagen");
  if (blob.type !== "image/webp") {
    noWebp = true;
    throw new Error("Browser schreibt kein WebP");
  }
  const marker = opts.keepMarker ? markerFor(item.result) : null;
  if (!marker) {
    item.out = { blob, w, h, marked: false };
    return;
  }
  try {
    const bytes = embedXmpWebp(new Uint8Array(await blob.arrayBuffer()), buildXmp(marker), w, h);
    item.out = {
      blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "image/webp" }),
      w,
      h,
      marked: true,
    };
  } catch {
    item.out = { blob, w, h, marked: false };
  }
}

function showItem(item: Item): void {
  const q = <T extends Element>(sel: string) => item.node.querySelector<T>(sel)!;
  const dl = q<HTMLButtonElement>(".dl");
  if (!item.out) {
    q(".sizes").textContent = noWebp ? "Nicht umgewandelt" : "Wird umgewandelt …";
    q(".detail").textContent = "";
    dl.disabled = true;
    return;
  }
  const before = item.file.size;
  const after = item.out.blob.size;
  q(".sizes").textContent =
    `${formatBytes(before)} → ${formatBytes(after)}, ${describeSavings(before, after)}`;
  const parts = [`${item.out.w} × ${item.out.h} px`];
  if (item.out.marked) parts.push("KI-Hinweis (IPTC) übernommen");
  else if (markerFor(item.result)) parts.push("KI-Hinweis nicht übernommen");
  q(".detail").textContent = parts.join(". ");
  dl.disabled = false;
}

function updateSummary(): void {
  const done = items.filter((i) => i.out);
  allBtn.disabled = done.length === 0;
  allBtn.hidden = items.length < 2;
  clearBtn.disabled = items.length === 0;
  if (noWebp) {
    msg.textContent =
      "Ihr Browser kann keine WebP-Dateien erzeugen (z. B. ältere Safari-Versionen). Bitte nutzen Sie Chrome, Edge oder Firefox.";
  }
  if (done.length < 2) {
    summary.textContent = "";
    return;
  }
  const before = done.reduce((s, i) => s + i.file.size, 0);
  const after = done.reduce((s, i) => s + i.out!.blob.size, 0);
  const p = savingsPct(before, after);
  const diff = p >= 0 ? `${p} % kleiner` : `${-p} % größer`;
  summary.textContent = `Zusammen: ${formatBytes(before)} → ${formatBytes(after)}, ${diff}`;
}

async function convertAll(only?: Item[]): Promise<void> {
  const mine = ++run;
  const opts = readOptions();
  const todo = only ?? [...items];
  for (const item of todo) {
    item.out = null;
    showItem(item);
  }
  updateSummary();
  for (const item of todo) {
    if (mine !== run && !only) return; // neue Einstellungen: alter Durchlauf bricht ab
    try {
      await convert(item, opts);
    } catch {
      item.out = null;
    }
    showItem(item);
    updateSummary();
  }
  updateSummary();
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

function addItemView(item: Item): void {
  const q = <T extends Element>(sel: string) => item.node.querySelector<T>(sel)!;
  q(".name").textContent = item.file.name;
  q<HTMLButtonElement>(".dl").addEventListener("click", () => {
    if (!item.out) return;
    save(item.out.blob, webpFileName(item.file.name));
    track("webp_export");
  });
  q<HTMLButtonElement>(".rm").addEventListener("click", () => {
    items.splice(items.indexOf(item), 1);
    item.bitmap.close();
    item.node.remove();
    updateSummary();
  });
  list.append(item.node);
  showItem(item);
}

async function addFiles(files: FileList | File[]): Promise<void> {
  msg.textContent = "";
  const skipped: string[] = [];
  const added: Item[] = [];
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
      const node = tpl.content.firstElementChild?.cloneNode(true) as HTMLLIElement;
      const item: Item = { file, bitmap, result, out: null, node };
      items.push(item);
      added.push(item);
      addItemView(item);
    } catch {
      skipped.push(`${file.name} (konnte nicht geöffnet werden)`);
    }
  }
  if (skipped.length) msg.textContent = `Nicht übernommen: ${skipped.join(", ")}.`;
  updateSummary();
  await convertAll(added);
}

let timer: ReturnType<typeof setTimeout> | undefined;
form.addEventListener("input", () => {
  readOptions();
  clearTimeout(timer);
  timer = setTimeout(() => void convertAll(), 250);
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
  const done = items.filter((i) => i.out);
  if (done.length === 0) return;
  allBtn.disabled = true;
  msg.textContent = "ZIP wird erstellt …";
  try {
    const names = uniqueNames(done.map((i) => webpFileName(i.file.name)));
    const files = await Promise.all(
      done.map(async (i, k) => ({
        name: names[k]!,
        data: new Uint8Array(await i.out!.blob.arrayBuffer()),
      })),
    );
    save(
      new Blob([createZip(files) as Uint8Array<ArrayBuffer>], { type: "application/zip" }),
      "webp-bilder.zip",
    );
    track("webp_export");
    msg.textContent = "";
  } catch {
    msg.textContent =
      "Das ZIP konnte nicht erstellt werden. Bitte laden Sie die Bilder einzeln herunter.";
  } finally {
    allBtn.disabled = false;
  }
});
clearBtn.addEventListener("click", () => {
  for (const item of items) item.bitmap.close();
  items.length = 0;
  list.replaceChildren();
  msg.textContent = "";
  updateSummary();
});
readOptions();
