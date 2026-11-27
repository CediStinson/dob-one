import { dayOf } from "./input.ts";
import type { StoredRow } from "./store.ts";

export interface StatsReport {
  from: string;
  to: string;
  days: { day: string; views: number; exports: number }[];
  pages: { key: string; n: number }[];
  refs: { key: string; n: number }[];
  totals: {
    views: number;
    labelExports: number;
    labelImages: number;
    webpExports: number;
    contactClicks: number;
  };
}

const DAY = 86_400_000;

/** Erster Tag des Zeitraums (inklusive), damit die Abfrage nur 30 Tage liest. */
export function firstDay(now: number, days = 30): string {
  return dayOf(now - (days - 1) * DAY);
}

function top(map: Map<string, number>, limit: number): { key: string; n: number }[] {
  return [...map]
    .map(([key, n]) => ({ key, n }))
    .sort((a, b) => b.n - a.n || a.key.localeCompare(b.key))
    .slice(0, limit);
}

export function buildReport(rows: StoredRow[], now: number, days = 30): StatsReport {
  const list: StatsReport["days"] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = dayOf(now - i * DAY);
    if (list.at(-1)?.day !== day) list.push({ day, views: 0, exports: 0 });
  }
  const byDay = new Map(list.map((d) => [d.day, d]));
  const pages = new Map<string, number>();
  const refs = new Map<string, number>();
  const totals = { views: 0, labelExports: 0, labelImages: 0, webpExports: 0, contactClicks: 0 };
  for (const r of rows) {
    const d = byDay.get(r.day);
    if (!d) continue;
    if (r.kind === "page") {
      d.views += r.n;
      totals.views += r.n;
      pages.set(r.key, (pages.get(r.key) ?? 0) + r.n);
    } else if (r.kind === "ref") {
      refs.set(r.key, (refs.get(r.key) ?? 0) + r.n);
    } else if (r.kind === "images") {
      totals.labelImages += r.n;
    } else if (r.kind === "event") {
      if (r.key === "label_export" || r.key === "webp_export") d.exports += r.n;
      if (r.key === "label_export") totals.labelExports += r.n;
      if (r.key === "webp_export") totals.webpExports += r.n;
      if (r.key === "contact_click") totals.contactClicks += r.n;
    }
  }
  return {
    from: list[0]!.day,
    to: list.at(-1)!.day,
    days: list,
    pages: top(pages, 20),
    refs: top(refs, 10),
    totals,
  };
}

const ESC: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
export const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ESC[c]!);

const fmt = (n: number): string => n.toLocaleString("de-DE");
const de = (day: string): string => `${day.slice(8, 10)}.${day.slice(5, 7)}.`;

function table(head: [string, string], rows: { key: string; n: number }[], empty: string): string {
  if (rows.length === 0) return `<p class="muted">${esc(empty)}</p>`;
  const body = rows
    .map((r) => `<tr><td>${esc(r.key)}</td><td class="num">${fmt(r.n)}</td></tr>`)
    .join("");
  return `<table><thead><tr><th>${esc(head[0])}</th><th class="num">${esc(head[1])}</th></tr></thead><tbody>${body}</tbody></table>`;
}

const STYLE = `<style>
body{margin:0;background:#f7f9f9;color:#1f2d3a;font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:860px;margin:0 auto;padding:32px 16px 64px}
h1{font-size:24px;margin:0 0 4px}h2{font-size:17px;margin:32px 0 8px}
.muted{color:#5b6b78}.note{background:#fff;border:1px solid #dfe6e8;border-radius:8px;padding:10px 14px;font-size:14px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-top:20px}
.tile{background:#fff;border:1px solid #dfe6e8;border-radius:8px;padding:14px}
.tile strong{display:block;font-size:24px}.tile span{color:#5b6b78;font-size:13px}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #dfe6e8;border-radius:8px;font-size:14px}
th,td{text-align:left;padding:6px 10px;border-bottom:1px solid #eef2f3}th{font-weight:600}
.num{text-align:right;font-variant-numeric:tabular-nums;width:90px}
td.bar{width:55%}td.bar span{display:block;height:10px;background:#0f8b8d;border-radius:3px;min-width:1px}
</style>`;

/** Serverseitig gerenderte Übersicht. Alle Werte laufen durch esc(). */
export function renderReport(r: StatsReport): string {
  const max = Math.max(1, ...r.days.map((d) => d.views));
  const bars = r.days
    .map(
      (d) =>
        `<tr><td>${de(d.day)}</td><td class="bar"><span style="width:${Math.round((d.views / max) * 100)}%"></span></td><td class="num">${fmt(d.views)}</td><td class="num">${fmt(d.exports)}</td></tr>`,
    )
    .join("");
  const t = r.totals;
  const tiles = [
    ["Seitenaufrufe", t.views],
    ["Label-Exporte", t.labelExports],
    ["Gelabelte Bilder", t.labelImages],
    ["WebP-Exporte", t.webpExports],
    ["Kontakt-Klicks", t.contactClicks],
  ]
    .map(
      ([k, v]) =>
        `<div class="tile"><strong>${fmt(v as number)}</strong><span>${esc(k as string)}</span></div>`,
    )
    .join("");
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Statistik. kenntlich</title>
${STYLE}</head><body><main>
<h1>Statistik</h1>
<p class="muted">${de(r.from)} bis ${de(r.to)} (letzte 30 Tage, deutsche Zeit)</p>
<p class="note">Gezählt werden Aufrufe und Aktionen, keine eindeutigen Besucher. Das ist Absicht: keine Cookies, keine Speicherung im Browser, keine IP-Adressen. Bots werden grob herausgefiltert.</p>
<div class="tiles">${tiles}</div>
<h2>Pro Tag</h2>
<table><thead><tr><th>Tag</th><th>Seitenaufrufe</th><th class="num">Aufrufe</th><th class="num">Exporte</th></tr></thead><tbody>${bars}</tbody></table>
<h2>Seiten</h2>
${table(["Seite", "Aufrufe"], r.pages, "Noch keine Aufrufe.")}
<h2>Herkunft (Top 10)</h2>
${table(["Domain", "Aufrufe"], r.refs, "Noch keine Referrer. Direkte Aufrufe werden nicht als Herkunft gezählt.")}
</main></body></html>`;
}

/** Hinweisseite, z. B. wenn Datenbank oder Passwort noch fehlen. Alle Texte laufen durch esc(). */
export function renderNotice(title: string, lines: string[]): string {
  const items = lines.map((l) => `<li>${esc(l)}</li>`).join("");
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Statistik. kenntlich</title>
${STYLE}</head><body><main>
<h1>${esc(title)}</h1>
<ul class="note">${items}</ul>
<p class="muted">Anleitung: docs/setup-cloudflare.md, Abschnitt B6.</p>
</main></body></html>`;
}
