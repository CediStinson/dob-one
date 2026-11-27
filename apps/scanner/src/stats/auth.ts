/** Basic Auth: Benutzername egal, Passwort = Secret STATS_PASSWORD. Vergleich über SHA-256 in konstanter Zeit. */
export async function checkBasicAuth(
  header: string | null | undefined,
  password: string,
): Promise<boolean> {
  if (!header?.startsWith("Basic ") || password.length === 0) return false;
  let decoded: string;
  try {
    const bin = atob(header.slice(6).trim());
    decoded = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return false;
  }
  const i = decoded.indexOf(":");
  if (i < 0) return false;
  const [a, b] = await Promise.all([digest(decoded.slice(i + 1)), digest(password)]);
  let diff = 0;
  for (let k = 0; k < a.length; k++) diff |= a[k]! ^ b[k]!;
  return diff === 0;
}

async function digest(s: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}
