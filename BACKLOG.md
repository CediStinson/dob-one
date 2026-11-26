# BACKLOG

Regeln: Jede Session nimmt das oberste offene Ticket ohne 🧑 (🧑 = braucht Benjamin). Fertige Tickets nach unten in "Erledigt" mit Datum.

## Offen

### Sprint 1: Fundament + erstes Free Tool

- [ ] **T1** Monorepo aufsetzen (Root-`wrangler.jsonc` + `placeholder/` ersetzen, Deploy darf nicht brechen): `apps/web` (Astro), `apps/scanner` (Worker/Hono), `packages/detect` (Metadaten-Parser, geteilt). pnpm workspaces, TS strict, Prettier, Vitest.
- [ ] **T2** `packages/detect`: Parser für C2PA, IPTC DigitalSourceType, XMP/EXIF-Generator-Tags, PNG-Textchunks. Testfälle mit echten Beispieldateien (selbst erzeugt oder frei lizenziert), in `fixtures/`.
- [ ] **T3** Landingpage (Astro): Hero, Problem (Art. 50), Lösung, Free Tools, Warteliste-Formular (vorerst Mock), Impressum/Datenschutz als Platzhalter.
- [ ] **T4** Free Tool 1: KI-Label-Generator nachbauen (Bild im Browser labeln, Vorlagen, Position, Deckkraft, Download, Multi-Upload) plus Anzeige der Metadaten-Einschätzung via `packages/detect`.
- [ ] **T5** Cloudflare-Free-Limits (Workers Static Assets) für Workers recherchieren und in `docs/02-mvp.md` festhalten (CPU, Subrequests, Requests/Tag).
- [ ] 🧑 **B2** Domain kaufen. Favorit: **kenntlich** (kenntlich.de, Alternativ kenntlich.ai / kenntlich.app). Fallbacks: offenbar.ai, kiar.de. Claude kann Verfügbarkeit nicht prüfen (Shell blockiert). Marke: "kenntlich. Ein Produkt von dobsonstudio". Klarbild bleibt Name des WP-Plugins.
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

- [x] 2026-11-26 B1 Cloudflare Worker `dob-one` mit Repo verbunden, Auto-Deploy aus main läuft.
- [x] 2026-11-26 Ideen-Shortlist, Entscheidung für Idee 1, MVP-Spec
