/**
 * SSRF-Schutz: nur öffentliche http(s)-Ziele auf Standardports, keine IP-Adressen aus privaten,
 * lokalen oder reservierten Netzen, keine internen Hostnamen, keine Zugangsdaten in der URL.
 *
 * Grenze: DNS wird nicht aufgelöst. Ein öffentlicher Name, der auf eine private IP zeigt, wird
 * nicht erkannt. Cloudflare Workers erreichen keine privaten Netze, das Risiko ist dort gering.
 */

export type GuardResult = { ok: true; url: URL } | { ok: false; reason: GuardReason };
export type GuardReason =
  "invalid_url" | "bad_scheme" | "credentials" | "bad_port" | "private_host";

const BLOCKED_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".intranet",
  ".lan",
  ".home",
  ".corp",
  ".arpa",
];

export function guardUrl(input: string | URL, base?: URL): GuardResult {
  let url: URL;
  try {
    url = new URL(input, base);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    return { ok: false, reason: "bad_scheme" };
  if (url.username || url.password) return { ok: false, reason: "credentials" };
  if (url.port !== "") return { ok: false, reason: "bad_port" }; // nur 80/443 (Standard)
  if (isBlockedHost(url.hostname)) return { ok: false, reason: "private_host" };
  url.hash = "";
  return { ok: true, url };
}

/** Nimmt Nutzereingaben wie "example.de" an und ergänzt https://. */
export function parseUserUrl(raw: string): GuardResult {
  const t = raw.trim();
  if (t === "" || t.length > 2048) return { ok: false, reason: "invalid_url" };
  return guardUrl(/^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`);
}

export function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (h === "" || h === "localhost") return true;
  if (h.startsWith("[")) return isBlockedIpv6(h.slice(1, -1));
  const v4 = parseIpv4(h);
  if (v4) return isBlockedIpv4(v4);
  if (/^[0-9.]+$/.test(h)) return true; // Zahlenform, die keine gültige IPv4 ist
  if (!h.includes(".")) return true; // einteilige Namen sind intern
  return BLOCKED_SUFFIXES.some((s) => h.endsWith(s));
}

function parseIpv4(h: string): number[] | undefined {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return undefined;
  const parts = m.slice(1).map(Number);
  return parts.every((p) => p <= 255) ? parts : undefined;
}

function isBlockedIpv4([a = 0, b = 0, c = 0]: number[]): boolean {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // Link-local, Cloud-Metadaten
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224 // Multicast, reserviert, Broadcast
  );
}

function isBlockedIpv6(h: string): boolean {
  const s = h.toLowerCase();
  if (s === "::" || s === "::1") return true;
  // IPv4-gemappt/-kompatibel (::ffff:a.b.c.d oder ::ffff:7f00:1 nach URL-Normalisierung)
  const mapped = /^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(s);
  if (mapped) {
    const hi = parseInt(mapped[1] ?? "0", 16);
    const lo = parseInt(mapped[2] ?? "0", 16);
    return isBlockedIpv4([hi >> 8, hi & 255, lo >> 8, lo & 255]);
  }
  if (s.startsWith("::ffff:") || s.startsWith("64:ff9b:")) return true;
  const [g0 = "0", g1 = "0"] = s.split(":");
  const first = parseInt(g0 || "0", 16);
  const second = parseInt(g1 || "0", 16);
  return (
    (first & 0xfe00) === 0xfc00 || // fc00::/7 ULA
    (first & 0xffc0) === 0xfe80 || // fe80::/10 Link-local
    (first & 0xff00) === 0xff00 || // Multicast
    (first === 0x2001 && (second === 0 || second === 0xdb8)) || // Teredo, Doku-Netz
    first === 0x2002 // 6to4, kann IPv4-Ziele einbetten
  );
}

/** Gleiche Website: Host gleich, "www." wird ignoriert. */
export const sameSite = (a: URL, b: URL): boolean =>
  a.hostname.replace(/^www\./, "") === b.hostname.replace(/^www\./, "");
