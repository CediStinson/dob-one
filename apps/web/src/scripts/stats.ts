/**
 * Anonyme Nutzungszähler (T19). Keine Cookies, nichts im Browser gespeichert, keine Kennung.
 * Gesendet wird nur der Pfad und die Domain der Herkunftsseite bzw. der Name einer Aktion.
 */

export type StatsEvent = "label_export" | "webp_export" | "contact_click";

function send(url: string, data: Record<string, unknown>): void {
  try {
    if (navigator.webdriver) return;
    const body = new Blob([JSON.stringify(data)], { type: "text/plain" });
    if (!navigator.sendBeacon?.(url, body)) {
      void fetch(url, { method: "POST", body, keepalive: true }).catch(() => {});
    }
  } catch {
    // Zählen darf nie etwas kaputt machen.
  }
}

/** Nur der Hostname der Herkunft, nie die volle Adresse. */
export function referrerHost(referrer: string, ownHost: string): string | undefined {
  try {
    const host = new URL(referrer).hostname;
    return host && host !== ownHost ? host : undefined;
  } catch {
    return undefined;
  }
}

export function track(event: StatsEvent, n?: number): void {
  send("/api/event", n === undefined ? { e: event } : { e: event, n });
}

export function trackPageview(): void {
  send("/api/hit", { p: location.pathname, r: referrerHost(document.referrer, location.hostname) });
}

export function trackContactClicks(root: Document = document): void {
  root.addEventListener("click", (e) => {
    const a = (e.target as Element | null)?.closest?.("a[href^='mailto:']");
    if (a) track("contact_click");
  });
}
