# dob-one / kenntlich

KI-Kennzeichnung nach Art. 50 AI Act. Ein Produkt von dobsonstudio.

## Struktur

- `apps/web`: Astro, statische Seiten (Landingpage, Free Tools)
- `apps/scanner`: Hono-Worker, API unter `/api/*`, liefert sonst die Astro-Assets aus
- `packages/detect`: Metadaten-Erkennung (C2PA, IPTC, XMP/EXIF, PNG-Chunks), geteilt

## Befehle

```sh
pnpm install
pnpm test        # Vitest
pnpm typecheck
pnpm build       # baut apps/web nach apps/web/dist
pnpm dev         # Build + wrangler dev
```

Deploy: Push auf `main` → Cloudflare Workers Builds → `npx wrangler deploy`.
Wrangler führt vorher `build.command` aus `wrangler.jsonc` aus (Install + Build).
