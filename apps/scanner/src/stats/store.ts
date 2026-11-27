import type { CountRow } from "./input.ts";

export interface StoredRow extends CountRow {
  day: string;
}

/** Speicher für Tageszähler. D1 in Produktion, Speicher-Variante für Tests. */
export interface StatsStore {
  add(day: string, rows: CountRow[]): Promise<void>;
  since(day: string): Promise<StoredRow[]>;
}

/** Minimaler Ausschnitt aus der D1-API, damit Tests ohne workerd laufen. */
export interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): unknown;
    all<T>(): Promise<{ results: T[] }>;
  };
  batch(statements: unknown[]): Promise<unknown>;
  exec(sql: string): Promise<unknown>;
}

const SCHEMA =
  "CREATE TABLE IF NOT EXISTS daily (day TEXT NOT NULL, kind TEXT NOT NULL, key TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, kind, key))";

const UPSERT =
  "INSERT INTO daily (day, kind, key, n) VALUES (?, ?, ?, ?) ON CONFLICT (day, kind, key) DO UPDATE SET n = n + excluded.n";

export class D1Store implements StatsStore {
  private ready: Promise<unknown> | null = null;

  constructor(private readonly db: D1Like) {}

  /** Tabelle einmal pro Isolate anlegen (keine Migration im Deploy nötig). */
  private ensure(): Promise<unknown> {
    this.ready ??= this.db.exec(SCHEMA).catch((e: unknown) => {
      this.ready = null;
      throw e;
    });
    return this.ready;
  }

  async add(day: string, rows: CountRow[]): Promise<void> {
    if (rows.length === 0) return;
    await this.ensure();
    const stmt = this.db.prepare(UPSERT);
    await this.db.batch(rows.map((r) => stmt.bind(day, r.kind, r.key, r.n)));
  }

  async since(day: string): Promise<StoredRow[]> {
    await this.ensure();
    const res = await (
      this.db
        .prepare("SELECT day, kind, key, n FROM daily WHERE day >= ? ORDER BY day")
        .bind(day) as { all<T>(): Promise<{ results: T[] }> }
    ).all<StoredRow>();
    return res.results;
  }
}

export class MemoryStore implements StatsStore {
  readonly rows = new Map<string, StoredRow>();

  async add(day: string, rows: CountRow[]): Promise<void> {
    for (const r of rows) {
      const id = `${day}|${r.kind}|${r.key}`;
      const e = this.rows.get(id);
      if (e) e.n += r.n;
      else this.rows.set(id, { day, ...r });
    }
  }

  async since(day: string): Promise<StoredRow[]> {
    return [...this.rows.values()]
      .filter((r) => r.day >= day)
      .sort((a, b) => (a.day < b.day ? -1 : 1));
  }
}
