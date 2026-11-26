import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { crc32 } from "node:zlib";
import { describe, expect, it } from "vitest";
import { buildXmp, detect, embedXmpJpeg, embedXmpPng, embedXmpWebp } from "../src/index.ts";

const fixture = (name: string) =>
  new Uint8Array(readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url))));

const ascii = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));
const u32le = (b: Uint8Array, o: number) =>
  (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;
const u32be = (b: Uint8Array, o: number) =>
  ((b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!) >>> 0;

/** Minimales WebP mit einem Chunk (Inhalt wird von detect nicht dekodiert). */
function webp(chunk: "VP8 " | "VP8L", payload: number[]): Uint8Array {
  const data = Uint8Array.from(payload);
  const pad = data.length % 2;
  const size = 4 + 8 + data.length + pad;
  const out = new Uint8Array(8 + size);
  out.set(
    [..."RIFF"].map((c) => c.charCodeAt(0)),
    0,
  );
  new DataView(out.buffer).setUint32(4, size, true);
  out.set(
    [..."WEBP"].map((c) => c.charCodeAt(0)),
    8,
  );
  out.set(
    [...chunk].map((c) => c.charCodeAt(0)),
    12,
  );
  new DataView(out.buffer).setUint32(16, data.length, true);
  out.set(data, 20);
  return out;
}

const gen = buildXmp("trainedAlgorithmicMedia");
const comp = buildXmp("compositeWithTrainedAlgorithmicMedia");

describe("buildXmp", () => {
  it("enthält den IPTC-Code als URL", () => {
    expect(gen).toContain(
      'Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"',
    );
  });
});

describe("embedXmpJpeg", () => {
  it("macht aus einem Kamerabild ein erkanntes KI-Bild", () => {
    const src = fixture("jpeg-camera.jpg");
    expect(detect(src).verdict).toBe("none");
    const out = embedXmpJpeg(src, gen);
    expect(detect(out).verdict).toBe("ai");
    expect(out[0]).toBe(0xff);
    expect(out[1]).toBe(0xd8);
    expect(out.length).toBeGreaterThan(src.length);
  });
  it("kennzeichnet Montagen als KI-Anteil", () => {
    expect(detect(embedXmpJpeg(fixture("jpeg-camera.jpg"), comp)).verdict).toBe("ai_partial");
  });
  it("setzt das Segment hinter APP0 (JFIF)", () => {
    const jfif = Uint8Array.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0, 0, 1, 0, 1,
      0, 0, 0xff, 0xd9,
    ]);
    const out = embedXmpJpeg(jfif, gen);
    expect([out[2], out[3]]).toEqual([0xff, 0xe0]);
    expect([out[20], out[21]]).toEqual([0xff, 0xe1]);
    expect(detect(out).verdict).toBe("ai");
  });
  it("lehnt andere Formate ab", () => {
    expect(() => embedXmpJpeg(fixture("png-plain.png"), gen)).toThrow();
  });
});

describe("embedXmpPng", () => {
  it("fügt einen gültigen iTXt-Chunk nach IHDR ein", () => {
    const src = fixture("png-plain.png");
    const out = embedXmpPng(src, gen);
    expect(detect(out).verdict).toBe("ai");
    expect(ascii(out, 37, 4)).toBe("iTXt");
    const len = u32be(out, 33);
    const crc = u32be(out, 41 + len);
    expect(crc).toBe(crc32(out.subarray(37, 41 + len)));
  });
});

describe("embedXmpWebp", () => {
  it("erweitert einfaches VP8 um VP8X mit XMP-Flag", () => {
    const out = embedXmpWebp(webp("VP8 ", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), gen, 640, 480);
    expect(ascii(out, 12, 4)).toBe("VP8X");
    expect(out[20]! & 0x04).toBe(0x04);
    expect(out[20]! & 0x10).toBe(0);
    expect(out[24]! | (out[25]! << 8) | (out[26]! << 16)).toBe(639);
    expect(out[27]! | (out[28]! << 8) | (out[29]! << 16)).toBe(479);
    expect(u32le(out, 4)).toBe(out.length - 8);
    expect(detect(out).verdict).toBe("ai");
  });
  it("setzt das Alpha-Flag bei verlustfreiem WebP mit Alpha", () => {
    // Signatur 0x2f, dann 32 Bit: Breite-1 (14), Höhe-1 (14), Alpha (1), Version (3)
    const bits = (1 << 28) >>> 0;
    const out = embedXmpWebp(
      webp("VP8L", [0x2f, bits & 255, (bits >> 8) & 255, (bits >> 16) & 255, bits >>> 24]),
      gen,
      1,
      1,
    );
    expect(out[20]! & 0x10).toBe(0x10);
    expect(detect(out).verdict).toBe("ai");
  });
  it("ergänzt vorhandenes VP8X nur um Flag und Chunk", () => {
    const first = embedXmpWebp(webp("VP8 ", [0, 0]), gen, 10, 10);
    const second = embedXmpWebp(first, comp, 10, 10);
    expect(ascii(second, 12, 4)).toBe("VP8X");
    expect(second.length).toBeGreaterThan(first.length);
    expect(u32le(second, 4)).toBe(second.length - 8);
  });
});
