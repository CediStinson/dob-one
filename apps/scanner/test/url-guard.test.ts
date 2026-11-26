import { describe, expect, it } from "vitest";
import { guardUrl, isBlockedHost, parseUserUrl, sameSite } from "../src/net/url-guard.ts";

describe("SSRF-Schutz", () => {
  it.each([
    "http://localhost/",
    "http://127.0.0.1/",
    "http://2130706433/", // 127.0.0.1 als Zahl
    "http://0x7f.0.0.1/",
    "http://0177.0.0.1/",
    "http://10.1.2.3/",
    "http://172.20.0.1/",
    "http://192.168.178.1/",
    "http://169.254.169.254/latest/meta-data",
    "http://100.64.0.1/",
    "http://0.0.0.0/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[fd00::1]/",
    "http://[fe80::1]/",
    "http://router/",
    "http://nas.local/",
    "http://db.internal/",
    "http://foo.localhost/",
  ])("blockiert %s", (u) => {
    expect(guardUrl(u)).toEqual({ ok: false, reason: "private_host" });
  });

  it("blockiert andere Schemata, Ports und Zugangsdaten", () => {
    expect(guardUrl("file:///etc/passwd")).toMatchObject({ reason: "bad_scheme" });
    expect(guardUrl("ftp://example.de/")).toMatchObject({ reason: "bad_scheme" });
    expect(guardUrl("gopher://example.de/")).toMatchObject({ reason: "bad_scheme" });
    expect(guardUrl("http://example.de:8080/")).toMatchObject({ reason: "bad_port" });
    expect(guardUrl("http://user:pw@example.de/")).toMatchObject({ reason: "credentials" });
    expect(guardUrl("kaputt")).toMatchObject({ reason: "invalid_url" });
  });

  it("erlaubt öffentliche Ziele und entfernt den Anker", () => {
    const r = guardUrl("https://www.example.de/seite?x=1#oben");
    expect(r.ok && r.url.toString()).toBe("https://www.example.de/seite?x=1");
    expect(guardUrl("http://93.184.215.14/").ok).toBe(true);
    expect(guardUrl("https://example.de:443/").ok).toBe(true); // Standardport wird normalisiert
    expect(isBlockedHost("[2606:4700::1111]")).toBe(false);
  });

  it("ergänzt https:// bei Nutzereingaben", () => {
    const r = parseUserUrl("  example.de ");
    expect(r.ok && r.url.toString()).toBe("https://example.de/");
    expect(parseUserUrl("").ok).toBe(false);
    expect(parseUserUrl("localhost").ok).toBe(false);
  });

  it("behandelt www. als gleiche Website", () => {
    expect(sameSite(new URL("https://www.a.de/x"), new URL("http://a.de/"))).toBe(true);
    expect(sameSite(new URL("https://shop.a.de/"), new URL("https://a.de/"))).toBe(false);
  });
});
