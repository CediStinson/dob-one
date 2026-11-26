import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createZip, uniqueNames } from "../src/lib/zip.ts";

const hasPython = (() => {
  try {
    execFileSync("python3", ["--version"]);
    return true;
  } catch {
    return false;
  }
})();

describe("uniqueNames", () => {
  it("hängt bei Dopplungen eine Nummer an", () => {
    expect(uniqueNames(["a.jpg", "a.jpg", "b.png", "a.jpg"])).toEqual([
      "a.jpg",
      "a-2.jpg",
      "b.png",
      "a-3.jpg",
    ]);
  });
});

describe("createZip", () => {
  const entries = [
    { name: "bild-ki-label.jpg", data: new Uint8Array([1, 2, 3, 4]) },
    { name: "größe-ü.png", data: new TextEncoder().encode("hallo welt") },
  ];
  const zip = createZip(entries, new Date(2026, 10, 26, 12, 0, 0));

  it("hat korrekte Signaturen und Eintragszahl", () => {
    const v = new DataView(zip.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    expect(v.getUint32(zip.length - 22, true)).toBe(0x06054b50);
    expect(v.getUint16(zip.length - 12, true)).toBe(2);
  });

  it.runIf(hasPython)("lässt sich mit einem Standard-Entpacker lesen", () => {
    const dir = mkdtempSync(join(tmpdir(), "zip-"));
    const file = join(dir, "t.zip");
    writeFileSync(file, zip);
    const out = execFileSync("python3", [
      "-c",
      "import sys,zipfile,json;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print(json.dumps({i.filename:list(z.read(i)) for i in z.infolist()}))",
      file,
    ]).toString();
    const parsed = JSON.parse(out) as Record<string, number[]>;
    expect(parsed["bild-ki-label.jpg"]).toEqual([1, 2, 3, 4]);
    expect(Buffer.from(parsed["größe-ü.png"]!).toString()).toBe("hallo welt");
    expect(readFileSync(file).length).toBe(zip.length);
  });
});
