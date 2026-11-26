import { Budget, readLimited, safeFetch, type FetchFn } from "../net/safe-fetch.ts";
import { guardUrl, sameSite } from "../net/url-guard.ts";
import { extractPage, limitStream, type HtmlParser } from "./extract.ts";
import { allowAll, parseRobots, type Robots } from "./robots.ts";

/** Werte aus docs/02-mvp.md (Cloudflare Free: 50 Subrequests, 6 Verbindungen). */
export const LIMITS = {
  maxPages: 25,
  subrequestBudget: 45,
  concurrency: 6,
  maxImages: 150,
  maxScripts: 100,
  maxPagesPerImage: 5,
  htmlBytes: 2 * 1024 * 1024,
  robotsBytes: 256 * 1024,
} as const;

export interface PageResult {
  url: string;
  status?: number;
  error?: string;
  images: number;
}

export interface ScanResult {
  url: string;
  pages: PageResult[];
  images: { src: string; pages: string[] }[];
  scripts: string[];
  iframes: string[];
  robots: { found: boolean; blocked: number };
  truncated: { pages: boolean; images: boolean; budget: boolean };
  subrequests: number;
}

export interface CrawlDeps {
  fetch: FetchFn;
  parse: HtmlParser;
}

const NON_HTML =
  /\.(jpe?g|png|gif|webp|avif|heic|svg|ico|bmp|tiff?|pdf|zip|gz|rar|7z|mp[34]|m4a|mov|avi|webm|wav|ogg|docx?|xlsx?|pptx?|odt|csv|txt|css|js|mjs|json|xml|rss|atom|woff2?|ttf|eot|exe|dmg|apk)$/i;

const pageKey = (u: URL) => `${u.hostname.replace(/^www\./, "")}${u.pathname}${u.search}`;

export async function crawl(start: URL, deps: CrawlDeps): Promise<ScanResult> {
  const budget = new Budget(LIMITS.subrequestBudget);
  let site = start;
  let robots = await loadRobots(start, deps.fetch, budget);
  let robotsHost = start.hostname;

  const pages: PageResult[] = [];
  const images = new Map<string, Set<string>>();
  const scripts = new Set<string>();
  const iframes = new Set<string>();
  const truncated = { pages: false, images: false, budget: false };
  let blocked = 0;

  const queue: URL[] = [start];
  const seen = new Set([pageKey(start)]);

  const enqueue = (u: URL) => {
    const key = pageKey(u);
    if (seen.has(key)) return;
    seen.add(key);
    if (!robots.allowed(u)) {
      blocked++;
      return;
    }
    queue.push(u);
  };

  if (!robots.allowed(start)) {
    blocked++;
    queue.length = 0;
  }

  while (queue.length > 0) {
    const room = LIMITS.maxPages - pages.length;
    if (room <= 0) {
      truncated.pages = true;
      break;
    }
    if (budget.left <= 0) {
      truncated.budget = true;
      break;
    }
    const batch = queue.splice(0, Math.min(LIMITS.concurrency, room, budget.left));
    const first = pages.length === 0;
    const results = await Promise.all(batch.map((u) => fetchPage(u, site, deps, budget, first)));

    for (const r of results) {
      if (first && r.final && !sameSite(r.final, site)) {
        // Startseite leitet auf eine andere Domain um (z. B. .de → .com): diese gilt dann.
        site = r.final;
        if (r.final.hostname !== robotsHost) {
          robots = await loadRobots(r.final, deps.fetch, budget);
          robotsHost = r.final.hostname;
        }
      }
      const { __data, ...page } = r.page;
      pages.push(page);
      const data = __data;
      if (!data) continue;
      page.images = data.images.length;
      const base = r.base ?? r.final ?? new URL(page.url);
      for (const src of data.images) {
        const g = guardUrl(src, base);
        if (!g.ok) continue;
        const key = g.url.toString();
        let set = images.get(key);
        if (!set) {
          if (images.size >= LIMITS.maxImages) {
            truncated.images = true;
            continue;
          }
          set = new Set();
          images.set(key, set);
        }
        if (set.size < LIMITS.maxPagesPerImage) set.add(page.url);
      }
      for (const [list, target] of [
        [data.scripts, scripts],
        [data.iframes, iframes],
      ] as const) {
        for (const s of list) {
          if (target.size >= LIMITS.maxScripts) break;
          try {
            target.add(new URL(s, base).toString());
          } catch {
            /* ungültige URL ignorieren */
          }
        }
      }
      for (const href of data.links) {
        const g = guardUrl(href, base);
        if (!g.ok || !sameSite(g.url, site) || NON_HTML.test(g.url.pathname)) continue;
        enqueue(g.url);
      }
    }
  }
  if (queue.length > 0 && pages.length >= LIMITS.maxPages) truncated.pages = true;
  if (queue.length > 0 && budget.left <= 0) truncated.budget = true;

  return {
    url: site.toString(),
    pages,
    images: [...images].map(([src, p]) => ({ src, pages: [...p] })),
    scripts: [...scripts],
    iframes: [...iframes],
    robots: { found: robots.found, blocked },
    truncated,
    subrequests: budget.used,
  };
}

type PageWithData = PageResult & { __data?: Awaited<ReturnType<typeof extractPage>> };
interface FetchedPage {
  page: PageWithData;
  final?: URL;
  base?: URL;
}

async function fetchPage(
  url: URL,
  site: URL,
  deps: CrawlDeps,
  budget: Budget,
  allowOffsite: boolean,
): Promise<FetchedPage> {
  const r = await safeFetch(url, {
    fetch: deps.fetch,
    budget,
    headers: { accept: "text/html,application/xhtml+xml" },
  });
  if (!r.ok) return { page: { url: url.toString(), error: r.reason, images: 0 } };
  const { res, url: final } = r;
  const page: PageWithData = { url: final.toString(), status: res.status, images: 0 };
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !/html/i.test(type) || !res.body) {
    await res.body?.cancel();
    if (res.ok && !/html/i.test(type)) page.error = "not_html";
    return { page, final };
  }
  if (!allowOffsite && !sameSite(final, site)) {
    await res.body.cancel();
    page.error = "offsite_redirect";
    return { page, final };
  }
  const data = await extractPage(limitStream(res.body, LIMITS.htmlBytes), deps.parse);
  page.__data = data;
  let base: URL | undefined;
  if (data.base) {
    try {
      base = new URL(data.base, final);
    } catch {
      /* kaputtes base-Tag ignorieren */
    }
  }
  return base ? { page, final, base } : { page, final };
}

interface LoadedRobots {
  found: boolean;
  allowed(u: URL): boolean;
}

async function loadRobots(site: URL, fetch: FetchFn, budget: Budget): Promise<LoadedRobots> {
  const wrap = (r: Robots, found: boolean): LoadedRobots => ({
    found,
    allowed: (u) => r.isAllowed(u.pathname + u.search),
  });
  const r = await safeFetch(new URL("/robots.txt", site), { fetch, budget });
  if (!r.ok) return wrap(allowAll, false);
  if (!r.res.ok) {
    await r.res.body?.cancel();
    return wrap(allowAll, false);
  }
  const { bytes } = await readLimited(r.res, LIMITS.robotsBytes);
  return wrap(parseRobots(new TextDecoder().decode(bytes)), true);
}
