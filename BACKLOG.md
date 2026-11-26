# BACKLOG

Regeln: Jede Session nimmt das oberste offene Ticket ohne 🧑 (🧑 = braucht Benjamin). Fertige Tickets nach unten in "Erledigt" mit Datum.

## Offen

### Sprint 1: Fundament + erstes Free Tool

- [ ] **T4** Free Tool 1: KI-Label-Generator nachbauen (Bild im Browser labeln, Vorlagen, Position, Deckkraft, Download, Multi-Upload) plus Anzeige der Metadaten-Einschätzung via `packages/detect`.
- [ ] **T5** Cloudflare-Free-Limits (Workers Static Assets) für Workers recherchieren und in `docs/02-mvp.md` festhalten (CPU, Subrequests, Requests/Tag).
- [ ] 🧑 **B2** Domain kaufen. Favorit: **kenntlich** (kenntlich.de, Alternativ kenntlich.ai / kenntlich.app). Fallbacks: offenbar.ai, kiar.de. Claude kann Verfügbarkeit nicht prüfen (Shell blockiert). Marke: "kenntlich. Ein Produkt von dobsonstudio". Klarbild bleibt Name des WP-Plugins.
- [ ] **T2c** Echte, signierte C2PA-Beispieldateien (Lizenz prüfen) als Fixtures ergänzen; aktuell nur unsignierte, selbst gebaute Manifeste.
- [ ] **T2b** DPMA/EUIPO-Markenrecherche "kenntlich" (Klasse 9/42) dokumentieren in `docs/03-marke.md`.

### Sprint 2: Website-Check

- [ ] **T6** Worker: `/scan?url=` crawlt bis 25 Seiten (gleiche Domain, robots.txt respektieren), sammelt Bild-URLs + Chatbot-Skripte, Rate-Limit pro IP.
- [ ] **T7** Worker: `/img?src=` liefert die ersten 256 KB eines Bildes (SSRF-Schutz: nur http/https, keine privaten IPs).
- [ ] **T8** Web: KI-Website-Check UI mit Fortschritt, Ergebnisliste, Handlungsempfehlungen, Label-Snippet.
- [ ] **T9** Chatbot-Erkennung (Signaturliste in `packages/detect`).
- [ ] 🧑 **B3** Supabase- und Resend-Account anlegen, Keys als Env-Variablen in Cloudflare eintragen.

### Sprint 3: Accounts + Report

- [ ] **T10** Magic-Link-Login (Supabase), Scans speichern.
- [ ] **T11** PDF-Report (im Browser generiert).
- [ ] **T12** Warteliste echt anbinden, Double-Opt-in-Mail.
- [ ] 🧑 **B4** Impressum/Datenschutz freigeben (Betreiber: dobsonstudio?).

## Erledigt

- [x] 2026-11-26 T3 Landingpage (Hero, Problem, Lösung, Free Tools, Warteliste als Mock, Impressum/Datenschutz als Entwurf), Inter selbst gehostet.
- [x] 2026-11-26 T2 `packages/detect`: C2PA, IPTC DigitalSourceType, XMP/EXIF-Generator-Tags, PNG-Textchunks. 13 Fixtures, 42 Tests.
- [x] 2026-11-26 T1 Monorepo (pnpm workspaces, Astro, Hono, Vitest, Prettier), CI-Workflow mit `wrangler deploy --dry-run`.
- [x] 2026-11-26 B1 Cloudflare Worker `dob-one` mit Repo verbunden, Auto-Deploy aus main läuft.
- [x] 2026-11-26 Ideen-Shortlist, Entscheidung für Idee 1, MVP-Spec
