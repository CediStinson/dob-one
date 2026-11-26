import { describe, expect, it } from "vitest";
import { classifySourceType, matchGenerator } from "../src/index.ts";
import { parseXmp } from "../src/xmp.ts";

describe("matchGenerator", () => {
  it.each([
    ["Midjourney v7", "Midjourney"],
    ["DALL·E 3", "DALL-E"],
    ["OpenAI-API", "ChatGPT / OpenAI"],
    ["Adobe Firefly", "Adobe Firefly"],
    ["ComfyUI", "ComfyUI"],
    ["FLUX.1 [dev]", "FLUX"],
    ["Made with Google AI", "Google Gemini / Imagen"],
  ])("%s → %s", (input, name) => expect(matchGenerator(input)).toBe(name));

  it.each([
    "Adobe Photoshop 26.0",
    "Adobe Lightroom Classic",
    "GIMP 2.10",
    "Canon EOS R6",
    "Corsair",
  ])("erkennt %s nicht als KI", (input) => expect(matchGenerator(input)).toBeUndefined());
});

describe("classifySourceType", () => {
  it("erkennt URL und Code", () => {
    expect(
      classifySourceType("http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"),
    ).toEqual({ code: "trainedAlgorithmicMedia", meaning: "ai_generated" });
    expect(classifySourceType("algorithmicallyEnhanced").meaning).toBe("ai_edited");
    expect(classifySourceType("digitalCapture").meaning).toBe("not_ai");
  });
});

describe("parseXmp", () => {
  it("liest rdf:Alt-Listen und Entities", () => {
    const x = parseXmp(
      '<dc:description><rdf:Alt><rdf:li xml:lang="x-default">Fuchs &amp; Wald</rdf:li></rdf:Alt></dc:description>',
    );
    expect(x["dc:description"]).toBe("Fuchs & Wald");
  });
});
