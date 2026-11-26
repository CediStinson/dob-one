import { guardUrl, type GuardReason } from "./url-guard.ts";

export type FetchFn = (input: Request | string | URL, init?: RequestInit) => Promise<Response>;

export const USER_AGENT = "Mozilla/5.0 (compatible; kenntlich-check/0.1; +KI-Kennzeichnung-Check)";
export const MAX_REDIRECTS = 3;

/** Zählt externe Subrequests pro Worker-Aufruf (Free-Plan: 50, wir brechen bei 45 ab). */
export class Budget {
  used = 0;
  constructor(readonly max: number) {}
  get left(): number {
    return this.max - this.used;
  }
  take(): boolean {
    if (this.used >= this.max) return false;
    this.used++;
    return true;
  }
}

export type SafeFetchResult =
  | { ok: true; res: Response; url: URL }
  | { ok: false; reason: GuardReason | "budget" | "too_many_redirects" | "network" };

interface Options {
  fetch: FetchFn;
  budget: Budget;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

/**
 * fetch mit SSRF-Prüfung bei jedem Redirect-Schritt, max. 3 Redirects, Timeout und Budget.
 * Schickt keine Cookies oder Zugangsdaten mit.
 */
export async function safeFetch(start: URL, opts: Options): Promise<SafeFetchResult> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const g = guardUrl(url);
    if (!g.ok) return { ok: false, reason: g.reason };
    if (!opts.budget.take()) return { ok: false, reason: "budget" };
    let res: Response;
    try {
      res = await opts.fetch(g.url.toString(), {
        redirect: "manual",
        headers: { "user-agent": USER_AGENT, ...opts.headers },
        signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
      });
    } catch {
      return { ok: false, reason: "network" };
    }
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      await res.body?.cancel();
      try {
        url = new URL(loc, g.url);
      } catch {
        return { ok: false, reason: "invalid_url" };
      }
      continue;
    }
    return { ok: true, res, url: g.url };
  }
  return { ok: false, reason: "too_many_redirects" };
}

/** Liest höchstens maxBytes vom Body und bricht den Rest ab. */
export async function readLimited(
  res: Response,
  maxBytes: number,
): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  if (!res.body) return { bytes: new Uint8Array(), truncated: false };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const room = maxBytes - size;
    if (value.length >= room) {
      chunks.push(value.subarray(0, room));
      size += room;
      truncated = value.length > room;
      if (!truncated) {
        // Genau voll: prüfen, ob noch etwas kommt.
        const next = await reader.read();
        truncated = !next.done;
      }
      await reader.cancel().catch(() => {});
      break;
    }
    chunks.push(value);
    size += value.length;
  }
  const bytes = new Uint8Array(size);
  let o = 0;
  for (const c of chunks) {
    bytes.set(c, o);
    o += c.length;
  }
  return { bytes, truncated };
}
