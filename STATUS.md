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

- 2026-11-28: T20 bis T22 Klarbild: Grundgerüst mit Einstellungen und CI (PHP 7.4/8.3), Erkennung beim Upload (PHP urteilt nachweislich wie TS), Mediathek-Spalte/Filter/Sammelaktionen, KI-Hinweis (IPTC) in alle Bildgrößen. 197 TS-Tests + 52 PHP-Tests. Noch nicht gegen echtes WordPress getestet. Nächstes Ticket: T23 (HTML-Overlay).
- 2026-11-27: T19 nachgeschärft: ausfallsicher ohne DB/Passwort (Hinweisseite statt Fehler), Ende-zu-Ende mit echtem Browser geprüft, Anleitung B6 Schritt für Schritt. 195 Tests. Wartet auf B6 (Benjamin). Nächstes Ticket: T20.
- 2026-11-27: T18 Konzept Klarbild-Plugin (`docs/05-plugin.md`), Tickets T20 bis T24 angelegt. Nächstes Ticket: T20 (Plugin-Grundgerüst).
- 2026-11-27: T13 WebP-Tool live (`/tools/bild-in-webp-umwandeln/`), übernimmt KI-Hinweise als IPTC. 189 Tests. Nächstes Ticket: T18 (Konzept Klarbild-Plugin).
- 2026-11-27: T19 anonyme Statistik gebaut (`/api/hit`, `/api/event`, `/stats` mit Passwort), in workerd mit lokaler D1 geprüft. Zählt erst nach B6 (D1 anlegen + `STATS_PASSWORD`, Benjamin). 184 Tests.
- 2026-11-27: T17 + T3c + T4d: Startseite auf Label-Generator ausgerichtet, Website-Check aus der Navigation (noindex), Warteliste durch Kontakt-Hinweis ersetzt. Label-Generator nach Spec (EU-Icon-Varianten KI/GEN/MOD, 4 Farben, Eigener Text, Formatwahl). 167 Tests. Nächstes Ticket: T13 (PNG/JPG in WebP).
- 2026-11-26: Start: Repo, Spec, Monorepo + Auto-Deploy, `packages/detect` (C2PA, IPTC, Generator-Tags, C2PA-Tests), Landingpage hell, Label-Generator mit IPTC-Einbettung + ZIP, Cloudflare-Limits, Scanner-API + Website-Check mit Chatbot-Erkennung (inzwischen geparkt), Markenrecherche (B5 offen), Sicherheitscheck.
