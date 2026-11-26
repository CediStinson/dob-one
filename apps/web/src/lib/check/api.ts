/**
 * Client für /api/scan und /api/img. Typen spiegeln apps/scanner (ScanResult),
 * bewusst ohne Import, damit das Frontend nicht vom Worker-Code abhängt.
 */

export interface ScanPage {
  url: string;
  status?: number;
  error?: string;
  images: number;
}

export interface ScanImage {
  src: string;
  pages: string[];
  variants?: string[];
}

export interface ScanResult {
  url: string;
  pages: ScanPage[];
  images: ScanImage[];
  scripts: string[];
  iframes: string[];
  robots: { found: boolean; blocked: number };
  truncated: { pages: boolean; images: boolean; budget: boolean };
  subrequests: number;
}

export type ApiError =
  | { kind: "rate_limited"; retryAfter: number }
  | { kind: "bad_request"; code: string }
  | { kind: "server"; status: number }
  | { kind: "network" };

export type ApiResult<T> = { ok: true; value: T } | { ok: false; error: ApiError };

type Fetch = (input: string) => Promise<Response>;

/** Leerzeichen entfernen; ohne Schema ergänzt der Server https://. */
export function normalizeInput(raw: string): string {
  return raw.trim().replace(/\s+/g, "");
}

async function toError(res: Response): Promise<ApiError> {
  let code = "";
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === "string") code = body.error;
  } catch {
    // kein JSON
  }
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("retry-after"));
    return { kind: "rate_limited", retryAfter: Number.isFinite(retryAfter) ? retryAfter : 0 };
  }
  if (res.status >= 400 && res.status < 500) return { kind: "bad_request", code };
  return { kind: "server", status: res.status };
}

export async function scan(url: string, fetchFn: Fetch): Promise<ApiResult<ScanResult>> {
  let res: Response;
  try {
    res = await fetchFn(`/api/scan?url=${encodeURIComponent(url)}`);
  } catch {
    return { ok: false, error: { kind: "network" } };
  }
  if (!res.ok) return { ok: false, error: await toError(res) };
  try {
    return { ok: true, value: (await res.json()) as ScanResult };
  } catch {
    return { ok: false, error: { kind: "server", status: res.status } };
  }
}

export async function imageHead(src: string, fetchFn: Fetch): Promise<ApiResult<Uint8Array>> {
  let res: Response;
  try {
    res = await fetchFn(`/api/img?src=${encodeURIComponent(src)}`);
  } catch {
    return { ok: false, error: { kind: "network" } };
  }
  if (!res.ok) return { ok: false, error: await toError(res) };
  try {
    return { ok: true, value: new Uint8Array(await res.arrayBuffer()) };
  } catch {
    return { ok: false, error: { kind: "network" } };
  }
}

/** Wartezeit menschenlesbar, z. B. "in etwa 4 Minuten". */
export function waitText(seconds: number): string {
  if (seconds <= 0) return "später";
  if (seconds < 90) return "in etwa einer Minute";
  if (seconds < 3600) return `in etwa ${Math.ceil(seconds / 60)} Minuten`;
  return "morgen";
}

/** Fehlertext für die Startseite des Scans (kein Ergebnis). */
export function scanErrorText(e: ApiError): string {
  switch (e.kind) {
    case "rate_limited":
      return e.retryAfter > 0
        ? `Sie haben gerade mehrere Prüfungen gestartet. Bitte versuchen Sie es ${waitText(e.retryAfter)} erneut.`
        : "Das Tageskontingent ist erreicht. Bitte versuchen Sie es morgen erneut.";
    case "bad_request":
      return BAD_REQUEST[e.code] ?? "Diese Adresse können wir nicht prüfen.";
    case "network":
      return "Keine Verbindung zum Server. Bitte prüfen Sie Ihre Internetverbindung.";
    case "server":
      return "Die Prüfung ist fehlgeschlagen. Bitte versuchen Sie es in ein paar Minuten erneut.";
  }
}

const BAD_REQUEST: Record<string, string> = {
  invalid_url: "Bitte geben Sie eine gültige Adresse ein, z. B. beispiel.de.",
  bad_scheme: "Nur Adressen mit http:// oder https:// sind möglich.",
  credentials: "Bitte geben Sie die Adresse ohne Benutzername und Passwort ein.",
  bad_port: "Adressen mit Portnummer können wir nicht prüfen.",
  private_host: "Interne oder lokale Adressen können wir nicht prüfen.",
};

/** Fehlertext für eine einzelne Seite aus pages[].error. */
export function pageErrorText(code: string): string {
  if (code === "unreachable")
    return "Die Website ist nicht erreichbar. Stimmt die Adresse (Tippfehler)?";
  if (code === "not_html") return "Unter dieser Adresse liegt keine Webseite.";
  if (code === "too_many_redirects") return "Zu viele Weiterleitungen.";
  if (code === "private_host") return "Leitet auf eine interne Adresse weiter.";
  if (code === "network") return "Die Website hat nicht geantwortet.";
  const m = /^http_(\d{3})$/.exec(code);
  if (m) {
    if (m[1] === "403") return "Die Website blockiert automatische Abrufe (HTTP 403).";
    if (m[1] === "404") return "Seite nicht gefunden (HTTP 404).";
    return `Die Website antwortet mit Fehler ${m[1]}.`;
  }
  return "Die Seite konnte nicht gelesen werden.";
}
