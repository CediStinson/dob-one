import { describe, expect, it } from "vitest";
import { app } from "../src/app.ts";

describe("scanner app", () => {
  it("antwortet auf /api/health", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, service: "kenntlich-scanner" });
  });

  it("liefert 404 für unbekannte API-Routen", async () => {
    const res = await app.request("/api/gibtsnicht");
    expect(res.status).toBe(404);
  });

  it("reicht Nicht-API-Anfragen an ASSETS weiter", async () => {
    const env = { ASSETS: { fetch: async () => new Response("asset") } };
    const res = await app.request("/", {}, env);
    expect(await res.text()).toBe("asset");
  });
});
