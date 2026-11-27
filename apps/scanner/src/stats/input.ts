/**
 * Prüft eingehende Zähler-Daten. Gespeichert wird nur, was hier durchkommt:
 * Pfad, Referrer-Domain, Event-Name, Anzahl. Keine IP, kein User-Agent, keine Kennung.
 */

export const EVENTS = ["label_export", "webp_export", "contact_click"] as const;
export type EventName = (typeof EVENTS)[number];

/** Ein Tageszähler: kind = page | ref | event | images. */
export interface CountRow {
  kind: "page" | "ref" | "event" | "images";
  key: string;
  n: number;
}

export const MAX_BODY = 1024;
const MAX_IMAGES = 20;

const BOT_RE =
  /bot|crawl|spider|slurp|preview|fetch|monitor|headless|lighthouse|pingdom|uptime|curl|wget|python|httpclient|okhttp|java\/|go-http|node-fetch|axios|facebookexternalhit|embedly|whatsapp|telegram/i;

/** true, wenn der Aufruf vermutlich von einem Bot kommt (oder kein User-Agent da ist). */
export function isBot(ua: string | null | undefined): boolean {
  if (!ua || ua.length < 20) return true;
  return BOT_RE.test(ua);
}

/** Normalisiert einen Pfad oder liefert null (Query, Hash, fremde Zeichen fliegen raus). */
export function cleanPath(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.length > 120) return null;
  let p = raw.split(/[?#]/)[0]!.toLowerCase();
  if (!/^[a-z0-9/_.-]+$/.test(p) || p.includes("//") || p.includes("..")) return null;
  if (p.length > 1 && !p.endsWith("/") && !/\.[a-z0-9]+$/.test(p)) p += "/";
  return p;
}

/** Nur der Hostname des Referrers, ohne www., ohne eigene Domain. */
export function cleanRef(raw: unknown, ownHost: string): string | null {
  if (typeof raw !== "string" || raw === "" || raw.length > 100) return null;
  const host = raw.toLowerCase().replace(/^www\./, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return null;
  if (host === ownHost.toLowerCase().replace(/^www\./, "")) return null;
  return host;
}

function parseJson(body: string): Record<string, unknown> | null {
  if (body.length === 0 || body.length > MAX_BODY) return null;
  try {
    const v: unknown = JSON.parse(body);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Seitenaufruf: `{ p: "/pfad/", r?: "google.com" }`. */
export function parseHit(body: string, ownHost: string): CountRow[] | null {
  const o = parseJson(body);
  if (!o) return null;
  const path = cleanPath(o.p);
  if (!path) return null;
  const rows: CountRow[] = [{ kind: "page", key: path, n: 1 }];
  const ref = cleanRef(o.r, ownHost);
  if (ref) rows.push({ kind: "ref", key: ref, n: 1 });
  return rows;
}

/** Tool-Nutzung: `{ e: "label_export", n?: 3 }`. n = Anzahl Bilder (nur label_export). */
export function parseEvent(body: string): CountRow[] | null {
  const o = parseJson(body);
  if (!o || typeof o.e !== "string" || !(EVENTS as readonly string[]).includes(o.e)) return null;
  const rows: CountRow[] = [{ kind: "event", key: o.e, n: 1 }];
  if (o.e === "label_export") {
    const n = typeof o.n === "number" && Number.isInteger(o.n) ? o.n : 1;
    rows.push({ kind: "images", key: "label", n: Math.min(Math.max(n, 1), MAX_IMAGES) });
  }
  return rows;
}

/** Datum in deutscher Zeit als YYYY-MM-DD. */
export function dayOf(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ms);
}
