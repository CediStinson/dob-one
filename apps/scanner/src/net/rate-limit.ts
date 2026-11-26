/**
 * Einfaches Rate-Limit pro IP im Speicher des Isolates (festes Zeitfenster).
 * Ohne KV/Durable Objects zählt jedes Isolate getrennt: ein Schutz gegen grobe Last,
 * keine harte Garantie. Siehe docs/02-mvp.md.
 */
export class RateLimiter {
  private hits = new Map<string, { start: number; count: number }>();

  constructor(
    readonly limit: number,
    readonly windowMs: number,
    private readonly now: () => number = Date.now,
    private readonly maxKeys = 10_000,
  ) {}

  /** true = erlaubt. retryAfter in Sekunden, wenn gesperrt. */
  check(key: string): { ok: true } | { ok: false; retryAfter: number } {
    const t = this.now();
    const e = this.hits.get(key);
    if (!e || t - e.start >= this.windowMs) {
      if (this.hits.size >= this.maxKeys) this.prune(t);
      this.hits.set(key, { start: t, count: 1 });
      return { ok: true };
    }
    if (e.count >= this.limit) {
      return {
        ok: false,
        retryAfter: Math.max(1, Math.ceil((e.start + this.windowMs - t) / 1000)),
      };
    }
    e.count++;
    return { ok: true };
  }

  private prune(t: number): void {
    for (const [k, e] of this.hits) if (t - e.start >= this.windowMs) this.hits.delete(k);
    if (this.hits.size >= this.maxKeys) this.hits.clear();
  }
}

export const clientIp = (req: Request): string =>
  req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? "unknown";
