import { describe, expect, it } from "vitest";
import { parseRobots } from "../src/scan/robots.ts";

describe("robots.txt", () => {
  const txt = `
# Kommentar
User-agent: Googlebot
Disallow: /

User-agent: *
Disallow: /intern/
Disallow: /*.pdf$
Allow: /intern/presse
Disallow: /suche?
`;
  const r = parseRobots(txt);

  it("wendet die *-Gruppe an, nicht fremde Bots", () => {
    expect(r.isAllowed("/")).toBe(true);
    expect(r.isAllowed("/ueber-uns")).toBe(true);
  });

  it("längster Treffer gewinnt, Allow schlägt Disallow", () => {
    expect(r.isAllowed("/intern/team")).toBe(false);
    expect(r.isAllowed("/intern/presse/2026")).toBe(true);
  });

  it("versteht * und $", () => {
    expect(r.isAllowed("/files/a.pdf")).toBe(false);
    expect(r.isAllowed("/files/a.pdf?x")).toBe(true);
    expect(r.isAllowed("/suche?q=ki")).toBe(false);
  });

  it("eigene Gruppe hat Vorrang vor *", () => {
    const own = parseRobots(
      "User-agent: *\nDisallow: /\n\nUser-agent: kenntlich-check\nAllow: /\n",
    );
    expect(own.isAllowed("/x")).toBe(true);
  });

  it("mehrere User-agent-Zeilen teilen eine Gruppe; leeres Disallow erlaubt alles", () => {
    const g = parseRobots("User-agent: a\nUser-agent: *\nDisallow: /x\n");
    expect(g.isAllowed("/x/1")).toBe(false);
    expect(parseRobots("User-agent: *\nDisallow:\n").isAllowed("/alles")).toBe(true);
    expect(parseRobots("").isAllowed("/")).toBe(true);
  });
});
