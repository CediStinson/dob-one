import { detect } from "@dob-one/detect";
import { imageHead, type ApiError, type ScanImage } from "./api.ts";
import { runPool } from "./pool.ts";
import type { CheckedImage } from "./summary.ts";

type Fetch = (input: string) => Promise<Response>;

export const IMAGE_CONCURRENCY = 4;

export type ImageOutcome = { image: CheckedImage } | { rateLimited: ApiError };

/**
 * Prüft ein Bild: erst die Original-URL, bei Fehler eine Größenvariante
 * (Original kann z. B. gesperrt sein). Rate-Limit wird nach oben gemeldet.
 */
export async function checkImage(img: ScanImage, fetchFn: Fetch): Promise<ImageOutcome> {
  const candidates = [img.src, ...(img.variants ?? []).slice(0, 1)];
  for (const src of candidates) {
    const r = await imageHead(src, fetchFn);
    if (!r.ok) {
      if (r.error.kind === "rate_limited") return { rateLimited: r.error };
      continue;
    }
    const d = detect(r.value);
    return {
      image: {
        src: img.src,
        pages: img.pages,
        status: d.verdict,
        ...(d.generator ? { generator: d.generator } : {}),
      },
    };
  }
  return { image: { src: img.src, pages: img.pages, status: "error" } };
}

export interface RunImagesResult {
  images: CheckedImage[];
  rateLimited?: ApiError;
}

/** Prüft alle Bilder, meldet Fortschritt. Nach Rate-Limit: Rest als "skipped". */
export async function checkImages(
  list: ScanImage[],
  fetchFn: Fetch,
  onProgress: (done: number, total: number, last: CheckedImage) => void,
  concurrency = IMAGE_CONCURRENCY,
): Promise<RunImagesResult> {
  const results: (CheckedImage | undefined)[] = new Array(list.length);
  let done = 0;
  let rateLimited: ApiError | undefined;
  await runPool(list, concurrency, async (img, i) => {
    const out = await checkImage(img, fetchFn);
    if ("rateLimited" in out) {
      rateLimited = out.rateLimited;
      return "stop";
    }
    results[i] = out.image;
    onProgress(++done, list.length, out.image);
    return "continue";
  });
  const images = list.map(
    (img, i): CheckedImage => results[i] ?? { src: img.src, pages: img.pages, status: "skipped" },
  );
  return rateLimited ? { images, rateLimited } : { images };
}
