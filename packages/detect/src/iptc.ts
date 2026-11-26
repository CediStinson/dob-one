/**
 * IPTC Digital Source Type (https://cv.iptc.org/newscodes/digitalsourcetype/).
 * Nur die Werte, die auf KI hinweisen, bekommen eine Bedeutung.
 */
export type SourceMeaning = "ai_generated" | "ai_composite" | "ai_edited" | "not_ai";

const AI_CODES: Record<string, SourceMeaning> = {
  trainedalgorithmicmedia: "ai_generated",
  compositewithtrainedalgorithmicmedia: "ai_composite",
  algorithmicallyenhanced: "ai_edited",
};

/** Nimmt eine URL oder einen Code ("trainedAlgorithmicMedia") und gibt Code + Bedeutung zurück. */
export function classifySourceType(value: string): { code: string; meaning: SourceMeaning } {
  const code = value.trim().split(/[/#]/).filter(Boolean).pop() ?? value;
  return { code, meaning: AI_CODES[code.toLowerCase()] ?? "not_ai" };
}

/** Findet alle Digital-Source-Type-Codes in einem Text (z. B. C2PA-Manifest). */
export function findSourceTypeCodes(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/digitalsourcetype\/([A-Za-z]+)/gi)) if (m[1]) out.add(m[1]);
  return [...out];
}
