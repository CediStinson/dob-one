import { describe, expect, it } from "vitest";
import { sniffFormat } from "../src/index.ts";

const b = (...xs: number[]) => new Uint8Array(xs);
const s = (str: string) => new TextEncoder().encode(str);

describe("sniffFormat", () => {
  it("erkennt JPEG", () => expect(sniffFormat(b(0xff, 0xd8, 0xff, 0xe0))).toBe("jpeg"));
  it("erkennt PNG", () =>
    expect(sniffFormat(b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("png"));
  it("erkennt WebP", () => expect(sniffFormat(s("RIFF\0\0\0\0WEBPVP8 "))).toBe("webp"));
  it("erkennt GIF", () => expect(sniffFormat(s("GIF89a"))).toBe("gif"));
  it("erkennt AVIF", () => expect(sniffFormat(s("\0\0\0\x1cftypavif"))).toBe("avif"));
  it("liefert unknown bei Müll und leeren Daten", () => {
    expect(sniffFormat(b())).toBe("unknown");
    expect(sniffFormat(s("hello world!"))).toBe("unknown");
  });
});
