import { describe, expect, it } from "vitest";
import { referrerHost } from "../src/scripts/stats.ts";

describe("referrerHost", () => {
  it("liefert nur den Hostnamen fremder Seiten", () => {
    expect(referrerHost("https://www.google.de/search?q=ki+label", "kenntlich.eu")).toBe(
      "www.google.de",
    );
    expect(referrerHost("https://kenntlich.eu/impressum/", "kenntlich.eu")).toBeUndefined();
    expect(referrerHost("", "kenntlich.eu")).toBeUndefined();
    expect(referrerHost("kaputt", "kenntlich.eu")).toBeUndefined();
  });
});
