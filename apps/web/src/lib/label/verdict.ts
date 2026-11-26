import type { DetectResult, Verdict } from "@dob-one/detect";

export interface VerdictText {
  tone: "ai" | "partial" | "unclear" | "none";
  title: string;
  detail: string;
}

const TEXTS: Record<Verdict, VerdictText> = {
  ai: {
    tone: "ai",
    title: "KI-Hinweis in den Metadaten",
    detail: "Die Datei enthält Angaben, die auf eine Erzeugung mit KI hindeuten.",
  },
  ai_partial: {
    tone: "partial",
    title: "Hinweis auf KI-Bearbeitung",
    detail: "Die Metadaten deuten auf eine Montage oder Bearbeitung mit KI hin.",
  },
  unclear: {
    tone: "unclear",
    title: "Herkunftsdaten ohne KI-Angabe",
    detail: "Ein C2PA-Nachweis ist vorhanden, eine KI-Angabe ist darin nicht lesbar.",
  },
  none: {
    tone: "none",
    title: "Keine KI-Hinweise in den Metadaten",
    detail: "Das ist kein Beweis. Metadaten fehlen oft, etwa nach Screenshots oder Export.",
  },
};

export function describe(result: Pick<DetectResult, "verdict" | "generator">): VerdictText {
  const base = TEXTS[result.verdict];
  if (result.generator && (result.verdict === "ai" || result.verdict === "ai_partial")) {
    return { ...base, detail: `${base.detail} Erkannt: ${result.generator}.` };
  }
  return base;
}
