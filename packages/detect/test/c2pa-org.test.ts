import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { detect } from "../src/index.ts";

/** Echte, signierte C2PA-Dateien aus c2pa-org/public-testfiles (CC BY-SA 4.0, siehe README dort). */
const real = (name: string) =>
  new Uint8Array(
    readFileSync(fileURLToPath(new URL(`../fixtures/c2pa-org/${name}`, import.meta.url))),
  );

const GENERATOR = "make_test_images/0.16.1 c2pa-rs/0.16.1";

describe("detect: echte C2PA-Dateien (c2pa-org)", () => {
  it("A: ohne Content Credentials → none", () => {
    const r = detect(real("adobe-20220124-A.jpg"));
    expect(r.format).toBe("jpeg");
    expect(r.has.c2pa).toBe(false);
    expect(r.verdict).toBe("none");
    expect(r.findings).toEqual([]);
  });

  it.each(["adobe-20220124-C.jpg", "adobe-20220124-CA.jpg", "adobe-20220124-XCA.jpg"])(
    "%s: Manifest erkannt, keine KI-Aussage → unclear",
    (file) => {
      const r = detect(real(file));
      expect(r.has.c2pa).toBe(true);
      expect(r.verdict).toBe("unclear");
      expect(r.findings).toEqual([
        { source: "c2pa", field: "claim_generator", value: GENERATOR, meaning: "provenance" },
      ]);
    },
  );

  it("E-sig-CA: manipuliertes Manifest wird trotzdem als Herkunftsangabe gelesen", () => {
    // Wir prüfen keine Signaturen. Ein kaputtes Manifest darf daher nie "ai" auslösen,
    // wird aber als vorhanden gemeldet.
    const r = detect(real("adobe-20220124-E-sig-CA.jpg"));
    expect(r.has.c2pa).toBe(true);
    expect(r.verdict).toBe("unclear");
    expect(r.findings.every((f) => f.meaning === "provenance")).toBe(true);
  });

  it("erkennt C2PA auch, wenn nur der Anfang geladen ist (wie /img mit 256 KB)", () => {
    const bytes = real("adobe-20220124-CA.jpg");
    expect(bytes.length).toBeGreaterThan(64 * 1024);
    expect(detect(bytes.subarray(0, 64 * 1024)).has.c2pa).toBe(true);
  });

  it("wirft nicht bei abgeschnittenen echten Dateien", () => {
    for (const file of ["adobe-20220124-CA.jpg", "adobe-20220124-XCA.jpg"]) {
      const bytes = real(file);
      for (let n = 0; n < bytes.length; n += 997) {
        expect(() => detect(bytes.subarray(0, n))).not.toThrow();
      }
    }
  });
});
