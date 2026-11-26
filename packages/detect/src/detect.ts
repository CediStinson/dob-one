import { latin1 } from "./bytes.ts";
import { isC2pa, parseC2pa } from "./c2pa.ts";
import { parseJpeg } from "./containers/jpeg.ts";
import { parsePng } from "./containers/png.ts";
import { emptyRaw, type RawMetadata } from "./containers/types.ts";
import { parseWebp } from "./containers/webp.ts";
import { parseExif } from "./exif.ts";
import { sniffFormat, type ImageFormat } from "./format.ts";
import { matchGenerator } from "./generators.ts";
import { classifySourceType } from "./iptc.ts";
import { matchPngText } from "./png-text.ts";
import { findXmpPackets, parseXmp } from "./xmp.ts";

export type Meaning = "ai_generated" | "ai_composite" | "ai_edited" | "provenance";

export interface Finding {
  source: "c2pa" | "xmp" | "exif" | "png-text";
  field: string;
  value: string;
  meaning: Meaning;
  /** Erkannter Generator, falls zuordenbar. */
  generator?: string;
}

/**
 * ai: deutlicher Hinweis auf KI-Erzeugung.
 * ai_partial: KI-Anteil (Montage oder KI-Bearbeitung).
 * unclear: Herkunftsdaten (C2PA) vorhanden, aber keine KI-Aussage lesbar.
 * none: keine Hinweise in den Metadaten. Das ist kein Beweis, dass kein KI-Bild vorliegt.
 */
export type Verdict = "ai" | "ai_partial" | "unclear" | "none";

export interface DetectResult {
  format: ImageFormat;
  verdict: Verdict;
  findings: Finding[];
  generator?: string;
  has: { c2pa: boolean; xmp: boolean; exif: boolean };
}

const GENERATOR_FIELDS_EXIF = ["Software", "Make", "Artist"] as const;
const GENERATOR_FIELDS_XMP = ["xmp:CreatorTool", "tiff:Software", "photoshop:Credit"] as const;

function extract(format: ImageFormat, bytes: Uint8Array): RawMetadata {
  const raw =
    format === "jpeg"
      ? parseJpeg(bytes)
      : format === "png"
        ? parsePng(bytes)
        : format === "webp"
          ? parseWebp(bytes)
          : emptyRaw();
  if (raw.xmp.length === 0) raw.xmp.push(...findXmpPackets(latin1(bytes)));
  if (raw.jumbf.length === 0 && format !== "png" && format !== "jpeg" && isC2pa(bytes)) {
    raw.jumbf.push(bytes); // z. B. AVIF/HEIF: C2PA-Box irgendwo in der Datei
  }
  return raw;
}

/**
 * Prüft Bilddaten (auch nur die ersten ~256 KB) auf KI-Hinweise in den Metadaten.
 * Wirft nie; unbekannte oder kaputte Daten ergeben verdict "none".
 */
export function detect(bytes: Uint8Array): DetectResult {
  const format = sniffFormat(bytes);
  const raw = extract(format, bytes);
  const findings: Finding[] = [];
  const c2pa = raw.jumbf.filter(isC2pa);

  for (const j of c2pa) {
    const info = parseC2pa(j);
    for (const code of info.sourceTypes) {
      const { meaning } = classifySourceType(code);
      if (meaning !== "not_ai") {
        findings.push({
          source: "c2pa",
          field: "c2pa.actions.digitalSourceType",
          value: code,
          meaning,
        });
      }
    }
    for (const g of info.generators) {
      const generator = matchGenerator(g);
      findings.push({
        source: "c2pa",
        field: "claim_generator",
        value: g,
        meaning: generator ? "ai_generated" : "provenance",
        ...(generator ? { generator } : {}),
      });
    }
    if (info.generators.length === 0 && info.sourceTypes.length === 0) {
      findings.push({ source: "c2pa", field: "manifest", value: "C2PA", meaning: "provenance" });
    }
  }

  for (const packet of raw.xmp) {
    const x = parseXmp(packet);
    const dst = x["Iptc4xmpExt:DigitalSourceType"];
    if (dst) {
      const { code, meaning } = classifySourceType(dst);
      if (meaning !== "not_ai") {
        findings.push({
          source: "xmp",
          field: "Iptc4xmpExt:DigitalSourceType",
          value: code,
          meaning,
        });
      }
    }
    for (const field of GENERATOR_FIELDS_XMP) pushGenerator(findings, "xmp", field, x[field]);
  }

  for (const tiff of raw.exif) {
    const e = parseExif(tiff);
    for (const field of GENERATOR_FIELDS_EXIF) pushGenerator(findings, "exif", field, e[field]);
  }

  for (const t of raw.text) {
    const generator =
      matchPngText(t) ?? (t.keyword === "Software" ? matchGenerator(t.value) : undefined);
    if (generator) {
      findings.push({
        source: "png-text",
        field: t.keyword,
        value: t.value.slice(0, 200),
        meaning: "ai_generated",
        generator,
      });
    }
  }

  const generator = findings.find((f) => f.generator)?.generator;
  return {
    format,
    verdict: verdictOf(findings),
    findings: dedupe(findings),
    ...(generator ? { generator } : {}),
    has: { c2pa: c2pa.length > 0, xmp: raw.xmp.length > 0, exif: raw.exif.length > 0 },
  };
}

function pushGenerator(
  findings: Finding[],
  source: Finding["source"],
  field: string,
  value?: string,
) {
  if (!value) return;
  const generator = matchGenerator(value);
  if (generator) findings.push({ source, field, value, meaning: "ai_generated", generator });
}

function verdictOf(findings: Finding[]): Verdict {
  const m = new Set(findings.map((f) => f.meaning));
  if (m.has("ai_generated")) return "ai";
  if (m.has("ai_composite") || m.has("ai_edited")) return "ai_partial";
  if (m.has("provenance")) return "unclear";
  return "none";
}

function dedupe(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = `${f.source}|${f.field}|${f.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
