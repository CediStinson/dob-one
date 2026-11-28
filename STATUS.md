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

- 2026-11-28: T21 Klarbild erkennt KI-Bilder beim Upload (PHP-Port, urteilt nachweislich wie TS), Mediathek-Spalte, Filter, Sammelaktionen, Auswahl in Anhang-Details. 197 TS-Tests + 41 PHP-Tests. Nächstes Ticket: T22 (IPTC in alle Bildgrößen).
- 2026-11-28: T20 Klarbild-Grundgerüst (`apps/klarbild/`, Einstellungsseite, CI-Job PHP 7.4/8.3). 195 TS-Tests + 21 PHP-Tests. Nächstes Ticket: T21 (PHP-Port der Erkennung).
- 2026-11-27: T19 nachgeschärft: ausfallsicher ohne DB/Passwort (Hinweisseite statt Fehler), Ende-zu-Ende mit echtem Browser geprüft, Anleitung B6 Schritt für Schritt. 195 Tests. Wartet auf B6 (Benjamin). Nächstes Ticket: T20.
- 2026-11-27: T18 Konzept Klarbild-Plugin (`docs/05-plugin.md`), Tickets T20 bis T24 angelegt. Nächstes Ticket: T20 (Plugin-Grundgerüst).
- 2026-11-27: T13 WebP-Tool live (`/tools/bild-in-webp-umwandeln/`), übernimmt KI-Hinweise als IPTC. 189 Tests. Nächstes Ticket: T18 (Konzept Klarbild-Plugin).
- 2026-11-27: T19 anonyme Statistik gebaut (`/api/hit`, `/api/event`, `/stats` mit Passwort), in workerd mit lokaler D1 geprüft. Zählt erst nach B6 (D1 anlegen + `STATS_PASSWORD`, Benjamin). 184 Tests.
- 2026-11-27: T17 + T3c + T4d: Startseite auf Label-Generator ausgerichtet, Website-Check aus der Navigation (noindex), Warteliste durch Kontakt-Hinweis ersetzt. Label-Generator nach Spec (EU-Icon-Varianten KI/GEN/MOD, 4 Farben, Eigener Text, Formatwahl). 167 Tests. Nächstes Ticket: T13 (PNG/JPG in WebP).
- 2026-11-26: T4e Sicherheitscheck Label-Generator + Website-Check bestanden (nur `textContent`, nur http(s)-Links, XSS-Test mit präpariertem Bild). 160 Tests. Nächstes Ticket: T3c.
- 2026-11-26: T9 Chatbot-Erkennung im Website-Check (Skripte, iframes und Inline-Snippets gegen 36 Anbieter-Signaturen). Der Check ist damit komplett: Bilder, Chatbots, Empfehlungen, Label-Snippet. 155 Tests.
- 2026-11-26: T8 KI-Website-Check live (`/tools/ki-website-check/`), verlinkt in Navigation und Startseite. Bis Accounts (T10) existieren, zeigt der freie Check den ganzen Scan (bis 25 Seiten). 139 Tests. Nächstes Ticket: T4d (Label-Generator nach Spec).
- 2026-11-26: T5 Cloudflare-Limits, T2b Markenrecherche (B5 offen), T2c C2PA-Tests, T4b/T4c IPTC-Einbettung + ZIP, T6/T7 Scanner-API (dobsonstudio.com: 7 Seiten, 8 Subrequests).
- 2026-11-26: Start bis T9/T4e: Repo, Spec, Monorepo mit Worker + Auto-Deploy, `packages/detect` (C2PA, IPTC, Generator-Tags), Landingpage hell, Label-Generator v1 (IPTC-Einbettung, ZIP), Scanner-API + Website-Check mit Chatbot-Erkennung (inzwischen geparkt), Markenrecherche (B5 offen), Sicherheitscheck.
