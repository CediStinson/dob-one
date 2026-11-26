import type { Verdict } from "@dob-one/detect";

/** Ergebnis pro Bild im Check. "skipped": wegen Kontingent nicht mehr geprüft. */
export type ImageStatus = Verdict | "error" | "skipped";

export interface CheckedImage {
  src: string;
  pages: string[];
  status: ImageStatus;
  generator?: string;
}

export type Counts = Record<ImageStatus, number>;

export function countByStatus(images: Pick<CheckedImage, "status">[]): Counts {
  const c: Counts = { ai: 0, ai_partial: 0, unclear: 0, none: 0, error: 0, skipped: 0 };
  for (const i of images) c[i.status]++;
  return c;
}

/** Reihenfolge in der Ergebnisliste: Wichtiges zuerst. */
const ORDER: ImageStatus[] = ["ai", "ai_partial", "unclear", "error", "skipped", "none"];

export function sortForDisplay<T extends Pick<CheckedImage, "status">>(images: T[]): T[] {
  return [...images].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
}

export interface Advice {
  title: string;
  text: string;
}

/**
 * Handlungsempfehlungen aus dem Ergebnis. Formuliert als Empfehlung, nicht als
 * rechtliche Bewertung (keine Rechtsberatung).
 */
export function adviceFor(c: Counts, scannedPages: number): Advice[] {
  const out: Advice[] = [];
  const flagged = c.ai + c.ai_partial;
  if (flagged > 0) {
    out.push({
      title: `${flagged} ${flagged === 1 ? "Bild" : "Bilder"} mit KI-Hinweis prüfen`,
      text: "Klären Sie, ob diese Bilder mit KI erzeugt oder bearbeitet wurden. Wir empfehlen, solche Bilder sichtbar zu kennzeichnen, etwa mit dem Label-Snippet unten oder dem Label-Generator.",
    });
    out.push({
      title: "Metadaten nicht entfernen",
      text: "Die gefundenen Angaben sind ein maschinenlesbarer Hinweis. Lassen Sie sie beim Optimieren der Bilder stehen (Einstellung in Bild-Plugins oder CDN prüfen).",
    });
  }
  if (c.unclear > 0) {
    out.push({
      title: `${c.unclear} ${c.unclear === 1 ? "Bild" : "Bilder"} mit Herkunftsnachweis`,
      text: "Diese Dateien enthalten einen C2PA-Nachweis ohne lesbare KI-Angabe. Prüfen Sie die Herkunft, z. B. bei der Bildagentur oder im Bildbearbeitungsprogramm.",
    });
  }
  if (c.none > 0 && flagged === 0) {
    out.push({
      title: "Keine KI-Hinweise in den Metadaten gefunden",
      text: "Das ist kein Beweis. Viele Bilder verlieren ihre Metadaten beim Export oder Verkleinern. Wenn Sie wissen, dass ein Bild mit KI erstellt wurde, kennzeichnen Sie es selbst.",
    });
  }
  if (c.error > 0) {
    out.push({
      title: `${c.error} ${c.error === 1 ? "Bild" : "Bilder"} nicht abrufbar`,
      text: "Diese Bilder konnten wir nicht laden, etwa weil der Server sie blockiert. Prüfen Sie sie bei Bedarf mit dem Label-Generator direkt am Original.",
    });
  }
  if (c.skipped > 0) {
    out.push({
      title: `${c.skipped} ${c.skipped === 1 ? "Bild" : "Bilder"} nicht geprüft`,
      text: "Das Prüfkontingent war erreicht. Starten Sie den Check später erneut, um den Rest zu prüfen.",
    });
  }
  if (scannedPages === 0) {
    out.push({
      title: "Keine Seite lesbar",
      text: "Wir konnten keine Seite der Website lesen. Prüfen Sie die Adresse oder ob die Website automatische Abrufe blockiert.",
    });
  }
  return out;
}

/** Dateiname aus einer Bild-URL für die Anzeige. */
export function displayName(src: string): string {
  try {
    const u = new URL(src);
    const last = u.pathname.split("/").filter(Boolean).pop() ?? u.hostname;
    const name = decodeURIComponent(last);
    return name.length > 60 ? `${name.slice(0, 57)}…` : name;
  } catch {
    return src.slice(0, 60);
  }
}

/** Pfad einer Seite für die Anzeige ("/" für die Startseite). */
export function displayPath(page: string): string {
  try {
    const u = new URL(page);
    return `${u.pathname}${u.search}` || "/";
  } catch {
    return page;
  }
}
