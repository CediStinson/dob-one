import { detectChatbots, type ChatbotFinding } from "@dob-one/detect";
import {
  normalizeInput,
  pageErrorText,
  scan,
  scanErrorText,
  waitText,
  type ScanResult,
} from "../lib/check/api.ts";
import { checkImages } from "../lib/check/run.ts";
import { labelSnippet } from "../lib/check/snippet.ts";
import {
  adviceFor,
  chatGreeting,
  countByStatus,
  displayName,
  displayPath,
  safeHref,
  sortForDisplay,
  type CheckedImage,
  type ImageStatus,
} from "../lib/check/summary.ts";

const SHOW_FIRST = 30;

const STATUS_TEXT: Record<ImageStatus, string> = {
  ai: "KI-Hinweis",
  ai_partial: "KI-Bearbeitung",
  unclear: "Herkunftsnachweis",
  none: "Kein Hinweis",
  error: "Nicht abrufbar",
  skipped: "Nicht geprüft",
};

const $ = <T extends Element>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`Element fehlt: ${sel}`);
  return el;
};

const form = $<HTMLFormElement>("#check-form");
const input = $<HTMLInputElement>("#check-url");
const startBtn = $<HTMLButtonElement>("#check-start");
const status = $<HTMLDivElement>("#check-status");
const phase = $<HTMLParagraphElement>("#check-phase");
const progress = $<HTMLProgressElement>("#check-progress");
const errorBox = $<HTMLParagraphElement>("#check-error");
const results = $<HTMLElement>("#check-results");
const imgList = $<HTMLUListElement>("#img-list");
const imgMore = $<HTMLButtonElement>("#img-more");
const snipText = $<HTMLSelectElement>("#snip-text");
const snipCode = $<HTMLTextAreaElement>("#snip-code");
const snipCopy = $<HTMLButtonElement>("#snip-copy");
const snipMsg = $<HTMLSpanElement>("#snip-msg");
const greetCode = $<HTMLTextAreaElement>("#greet-code");
const greetMsg = $<HTMLSpanElement>("#greet-msg");

const apiFetch = (u: string) => fetch(u, { headers: { accept: "application/json" } });

let running = false;
let snippetSrc: string | undefined;

function setText(sel: string, text: string | number): void {
  $(sel).textContent = String(text);
}

function showError(text: string): void {
  errorBox.textContent = text;
  errorBox.hidden = false;
}

function externalLink(href: string, text: string): HTMLAnchorElement {
  const a = document.createElement("a");
  const safe = safeHref(href);
  if (safe) a.href = safe;
  a.textContent = text;
  a.target = "_blank";
  a.rel = "noopener noreferrer nofollow";
  return a;
}

function imageRow(img: CheckedImage): HTMLLIElement {
  const li = document.createElement("li");
  const name = document.createElement("span");
  name.className = "name";
  name.append(externalLink(img.src, displayName(img.src)));
  const tag = document.createElement("span");
  tag.className = "tag";
  tag.dataset.s = img.status;
  tag.textContent = img.generator
    ? `${STATUS_TEXT[img.status]}: ${img.generator}`
    : STATUS_TEXT[img.status];
  const where = document.createElement("span");
  where.className = "where";
  const pages = img.pages.map(displayPath);
  where.textContent = pages.length ? `Gefunden auf ${pages.join(", ")}` : "";
  li.append(name, tag, where);
  return li;
}

function renderImages(images: CheckedImage[], all: boolean): void {
  const sorted = sortForDisplay(images);
  const shown = all ? sorted : sorted.slice(0, SHOW_FIRST);
  imgList.replaceChildren(...shown.map(imageRow));
  imgMore.hidden = shown.length >= sorted.length;
  imgMore.textContent = `Alle ${sorted.length} Bilder anzeigen`;
  imgMore.onclick = () => renderImages(images, true);
  $("#img-empty").toggleAttribute("hidden", images.length > 0);
}

function renderPages(scanResult: ScanResult): number {
  const list = $<HTMLUListElement>("#page-list");
  let ok = 0;
  list.replaceChildren(
    ...scanResult.pages.map((p) => {
      const li = document.createElement("li");
      li.append(externalLink(p.url, displayPath(p.url)));
      if (p.error) {
        const err = document.createElement("span");
        err.className = "err";
        err.textContent = ` ${pageErrorText(p.error)}`;
        li.append(err);
      } else {
        ok++;
        li.append(` (${p.images} ${p.images === 1 ? "Bild" : "Bilder"})`);
      }
      return li;
    }),
  );
  setText("#pages-count", scanResult.pages.length);
  return ok;
}

function renderLimits(scanResult: ScanResult): void {
  const notes: string[] = [];
  if (scanResult.truncated.pages || scanResult.truncated.budget)
    notes.push("Die Website hat mehr Seiten, als ein Check liest. Geprüft wurde ein Ausschnitt.");
  if (scanResult.truncated.images) notes.push("Es wurden nur die ersten 150 Bilder geprüft.");
  const blocked = scanResult.robots.blocked;
  if (blocked > 0)
    notes.push(
      blocked === 1
        ? "1 Seite ist per robots.txt gesperrt und wurde nicht gelesen."
        : `${blocked} Seiten sind per robots.txt gesperrt und wurden nicht gelesen.`,
    );
  const el = $<HTMLParagraphElement>("#res-limits");
  el.textContent = notes.join(" ");
  el.hidden = notes.length === 0;
}

const BOT_KIND: Record<ChatbotFinding["kind"], string> = {
  ai: "KI-Chatbot",
  ai_optional: "Live-Chat, KI möglich",
};

function renderBots(bots: ChatbotFinding[], site: string): void {
  $<HTMLUListElement>("#bot-list").replaceChildren(
    ...bots.map((b) => {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = b.name;
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.dataset.s = b.kind === "ai" ? "ai" : "ai_partial";
      tag.textContent = BOT_KIND[b.kind];
      const where = document.createElement("span");
      where.className = "where";
      where.textContent = `Erkannt an ${b.url.slice(0, 120)}`;
      li.append(name, tag, where);
      return li;
    }),
  );
  $("#bot-none").toggleAttribute("hidden", bots.length > 0);
  $("#bot-greeting").toggleAttribute("hidden", bots.length === 0);
  greetCode.value = chatGreeting(site.replace(/^www\./, ""));
  greetMsg.textContent = "";
}

function renderAdvice(images: CheckedImage[], okPages: number, bots: ChatbotFinding[]): void {
  const list = $<HTMLUListElement>("#advice");
  list.replaceChildren(
    ...adviceFor(countByStatus(images), okPages, bots).map((a) => {
      const li = document.createElement("li");
      const t = document.createElement("strong");
      t.textContent = a.title;
      const d = document.createElement("span");
      d.textContent = a.text;
      li.append(t, d);
      return li;
    }),
  );
}

function renderSnippet(): void {
  snipCode.value = labelSnippet({
    text: snipText.value,
    ...(snippetSrc ? { src: snippetSrc } : {}),
  });
  snipMsg.textContent = "";
}

function renderResult(scanResult: ScanResult, images: CheckedImage[]): void {
  let site = scanResult.url;
  try {
    site = new URL(scanResult.url).hostname;
  } catch {
    // Anzeige wie geliefert
  }
  setText("#res-site", site);
  const okPages = renderPages(scanResult);
  const c = countByStatus(images);
  setText("#t-pages", okPages);
  setText("#t-images", images.length - c.skipped - c.error);
  setText("#t-ai", c.ai + c.ai_partial);
  const bots = detectChatbots([
    ...scanResult.scripts,
    ...scanResult.iframes,
    ...(scanResult.inlineUrls ?? []),
  ]);
  setText("#t-bots", bots.length);
  renderBots(bots, site);
  renderLimits(scanResult);
  renderAdvice(images, okPages, bots);
  renderImages(images, false);
  snippetSrc = images.find((i) => i.status === "ai" || i.status === "ai_partial")?.src;
  renderSnippet();
  results.hidden = false;
}

async function run(raw: string): Promise<void> {
  const url = normalizeInput(raw);
  errorBox.hidden = true;
  if (!url) {
    showError("Bitte geben Sie die Adresse Ihrer Website ein, z. B. beispiel.de.");
    input.focus();
    return;
  }
  running = true;
  startBtn.disabled = true;
  results.hidden = true;
  status.hidden = false;
  phase.textContent = "Seiten werden gelesen …";
  progress.removeAttribute("value");

  try {
    const s = await scan(url, apiFetch);
    if (!s.ok) {
      showError(scanErrorText(s.error));
      return;
    }
    const start = s.value.pages[0];
    if (s.value.pages.every((p) => p.error) && start?.error) {
      showError(pageErrorText(start.error));
      return;
    }
    const list = s.value.images;
    progress.max = Math.max(1, list.length);
    progress.value = 0;
    phase.textContent = `Bilder werden geprüft: 0 von ${list.length}`;
    const r = await checkImages(list, apiFetch, (done, total) => {
      progress.value = done;
      phase.textContent = `Bilder werden geprüft: ${done} von ${total}`;
    });
    renderResult(s.value, r.images);
    if (r.rateLimited) {
      const wait = r.rateLimited.kind === "rate_limited" ? r.rateLimited.retryAfter : 0;
      showError(
        wait > 0
          ? `Nicht alle Bilder wurden geprüft, das Prüfkontingent ist erreicht. Bitte versuchen Sie es ${waitText(wait)} erneut.`
          : "Nicht alle Bilder wurden geprüft, das Tageskontingent ist erreicht. Bitte versuchen Sie es morgen erneut.",
      );
    }
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch {
    showError("Die Prüfung ist fehlgeschlagen. Bitte versuchen Sie es in ein paar Minuten erneut.");
  } finally {
    running = false;
    startBtn.disabled = false;
    status.hidden = true;
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!running) void run(input.value);
});

snipText.addEventListener("change", renderSnippet);

async function copy(area: HTMLTextAreaElement, msgEl: HTMLElement): Promise<void> {
  try {
    await navigator.clipboard.writeText(area.value);
    msgEl.textContent = "Kopiert.";
  } catch {
    area.select();
    msgEl.textContent = "Bitte mit Strg+C bzw. Cmd+C kopieren.";
  }
}
$<HTMLButtonElement>("#greet-copy").addEventListener("click", () => void copy(greetCode, greetMsg));
snipCopy.addEventListener("click", () => void copy(snipCode, snipMsg));

// Vorbelegung über ?url=, ohne automatischen Start.
const preset = new URLSearchParams(location.search).get("url");
if (preset) input.value = preset.slice(0, 2048);
renderSnippet();
