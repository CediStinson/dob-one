import { Budget, readLimited, safeFetch, type FetchFn } from "./net/safe-fetch.ts";
import { guardUrl } from "./net/url-guard.ts";

/** Erste 256 KB reichen für Metadaten (EXIF, XMP, C2PA stehen am Dateianfang). */
export const IMG_MAX_BYTES = 256 * 1024;

export type ImgResult =
  | { ok: true; bytes: Uint8Array; contentType: string; truncated: boolean }
  | { ok: false; status: 400 | 415 | 502; error: string };

/**
 * Lädt den Anfang eines Bildes. Nur http(s), keine privaten Ziele (auch nach Redirects),
 * nur image/*-Antworten. Kein Weiterreichen von Cookies oder Headern des Nutzers.
 */
export async function fetchImageHead(src: string, fetch: FetchFn): Promise<ImgResult> {
  const g = guardUrl(src);
  if (!g.ok) return { ok: false, status: 400, error: g.reason };
  const r = await safeFetch(g.url, {
    fetch,
    budget: new Budget(4), // 1 Abruf + max. 3 Redirects
    headers: { accept: "image/*", range: `bytes=0-${IMG_MAX_BYTES - 1}` },
  });
  if (!r.ok) return { ok: false, status: r.reason === "network" ? 502 : 400, error: r.reason };
  const { res } = r;
  if (!res.ok) {
    await res.body?.cancel();
    return {
      ok: false,
      status: 502,
      error: res.status === 530 ? "unreachable" : `upstream_${res.status}`,
    };
  }
  const contentType = (res.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
  if (!contentType.toLowerCase().startsWith("image/")) {
    await res.body?.cancel();
    return { ok: false, status: 415, error: "not_image" };
  }
  const { bytes, truncated } = await readLimited(res, IMG_MAX_BYTES);
  return { ok: true, bytes, contentType, truncated: truncated || res.status === 206 };
}
