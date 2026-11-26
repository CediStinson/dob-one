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

- 2026-11-26: T2b Markenrecherche dokumentiert (`docs/03-marke.md`). Keine Kollision im Web, Registerabfrage braucht Benjamin (B5). Nächstes Ticket: T6 (Crawler).
- 2026-11-26: T2c echte C2PA-Dateien getestet, `detect` liest sie korrekt (kein Fehlalarm bei kaputten Signaturen). 71 Tests.
- 2026-11-26: T4c Label-Generator lädt mehrere Bilder als ZIP herunter. 64 Tests.
- 2026-11-26: T4b Label-Generator schreibt jetzt auch einen maschinenlesbaren KI-Hinweis (IPTC) in JPEG, PNG und WebP. 61 Tests.
- 2026-11-26: T5 Cloudflare-Limits in `docs/02-mvp.md` (100k Worker-Requests/Tag, 10 ms CPU, 50 Subrequests; Assets unbegrenzt).
- 2026-11-26: T4 KI-Label-Generator live (`/tools/ki-label-generator/`), läuft komplett im Browser, zeigt Metadaten-Einschätzung. 52 Tests.
- 2026-11-26: T3/T3b Landingpage (Warteliste noch Mock) im hellen Design, ehrliche Trust-Elemente, Impressum mit echten Daten (als Entwurf markiert).
- 2026-11-26: T2 `packages/detect` erkennt KI-Hinweise (C2PA, IPTC, Generator-Tags, SD-Parameter), 42 Tests.
- 2026-11-26: Start + T1: Repo, Idee 1 + MVP-Spec, Name-Favorit "kenntlich" (Domain: B2), Monorepo mit einem Worker (Astro + `/api/health`), CI und Auto-Deploy (B1).
