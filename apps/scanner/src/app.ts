import { Hono } from "hono";

/** Minimales Interface, damit der Code auch ausserhalb von Cloudflare (Node) läuft. */
export interface Env {
  ASSETS?: { fetch(request: Request): Promise<Response> };
}

export const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true, service: "kenntlich-scanner" }));

app.all("/api/*", (c) => c.json({ error: "not_found" }, 404));

// Alles andere: statische Assets (Astro-Build).
app.all("*", async (c) => {
  if (c.env?.ASSETS) return c.env.ASSETS.fetch(c.req.raw);
  return c.text("Not found", 404);
});
