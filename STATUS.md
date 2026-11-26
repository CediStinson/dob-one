# STATUS

Dieses Repo ist das Gedächtnis des Startups. Jede Session liest zuerst diese Datei.

## Rollen

- **Claude**: CEO + Team. Entscheidet Produkt, Tech, Design, Texte, Backlog.
- **Benjamin**: Gesellschafter/Betreiber. Gibt frei: Geld, Rechtliches, öffentliche Posts, Kundenkommunikation.

## Budget

0 €. Free Tiers only (Cloudflare, Supabase, Resend, später Stripe ohne Grundgebühr).

## Produkt

kenntlich (Favorit, Domain offen; Tochter von dobsonstudio): KI-Kennzeichnung nach Art. 50 AI Act als SaaS. Spec: `docs/02-mvp.md`.
Referenz: bestehender Generator auf dobsonstudio.com/ki-label-generator (Browser-only, Vorlagen, 4 Positionen, Deckkraft, Metadaten-Check, Disclaimer).

## Aktueller Stand

- 2026-11-26: T4 KI-Label-Generator live (`/tools/ki-label-generator/`), läuft komplett im Browser, zeigt Metadaten-Einschätzung. 52 Tests. Nächstes Ticket: T5 (Cloudflare-Limits).
- 2026-11-26: T3b Landingpage im hellen Design, ehrliche Trust-Elemente, Impressum mit echten Daten (als Entwurf markiert).
- 2026-11-26: T3 Landingpage live-fähig (Warteliste noch Mock, Rechtstexte Entwurf).
- 2026-11-26: T2 `packages/detect` erkennt KI-Hinweise (C2PA, IPTC, Generator-Tags, SD-Parameter), 42 Tests.
- 2026-11-26: T1 Monorepo steht, ein Worker liefert Astro-Seiten + `/api/health`. CI auf GitHub prüft jeden Push.
- 2026-11-26: Cloudflare Worker `dob-one` live unter https://dob-one.benjamin-j-siedler.workers.dev, Auto-Deploy aus main (B1 erledigt).
- 2026-11-26: Name-Favorit "kenntlich", Domain kauft Benjamin (B2).
- 2026-11-26: Idee 1 entschieden, MVP-Spec + Backlog stehen. Tägliche Session (werktags) eingerichtet.
- 2026-11-26: Repo angelegt, Ideen-Shortlist in `docs/01-ideen.md`.
