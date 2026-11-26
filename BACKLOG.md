# BACKLOG

Regeln: Jede Session nimmt das oberste offene Ticket ohne 🧑 (🧑 = braucht Benjamin). Fertige Tickets nach unten in "Erledigt" mit Datum.

## Offen

### Sprint 1: Fundament + erstes Free Tool

- [ ] 🧑 **B2** Domain kaufen. kenntlich.de vergeben, .ai zu teuer. **kenntlich.eu** kaufen (Fallback kenntlich.app via Cloudflare). Heute Abend. Claude kann Verfügbarkeit nicht prüfen (Shell blockiert). Marke: "kenntlich. Ein Produkt von dobsonstudio". Klarbild bleibt Name des WP-Plugins.
- [ ] 🧑 **T2c** Echte, signierte C2PA-Beispieldateien als Fixtures. Vorarbeit 26.11.: Quelle `c2pa-org/public-testfiles` (GitHub, Ordner `2.2/`, Lizenz CC BY-SA 4.0, Namensnennung nötig; Fehlerfälle erkennbar an `E-sig-`, `E-dat-`, `E-uri-` im Dateinamen). Claude kann die Dateien nicht laden (Abruf aus der Session gesperrt). **Benjamin:** 3 bis 4 kleine JPEGs (eine KI-generiert, eine Kamera/bearbeitet, eine mit `E-sig-`) und eine PNG herunterladen und nach `packages/detect/fixtures/c2pa-org/` legen (oder per Chat anhängen). Danach baut Claude Tests und den Lizenzhinweis.
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

- [x] 2026-11-26 T4c "Alle herunterladen" als ZIP (eigener ZIP-Writer ohne Kompression, UTF-8-Namen, Dopplungen nummeriert). 3 Tests, Python-zipfile als Gegenprobe.
- [x] 2026-11-26 T4b Label-Generator bettet beim Export XMP mit IPTC `DigitalSourceType` ein (JPEG APP1, PNG iTXt, WebP VP8X + XMP), Auswahl KI-generiert / Montage / nicht einbetten. Modul `packages/detect/src/embed.ts`, 9 Roundtrip-Tests.
- [x] 2026-11-26 T5 Cloudflare-Free-Limits recherchiert und mit Folgen für T6/T7 in `docs/02-mvp.md` dokumentiert.
- [x] 2026-11-26 T4 KI-Label-Generator unter `/tools/ki-label-generator/`: 4 Vorlagen + eigener Text, 4 Positionen, 3 Größen, Hell/Dunkel, Deckkraft, bis 20 Bilder, Download einzeln/alle, Metadaten-Einschätzung via `packages/detect` im Browser. 10 neue Tests (apps/web).
- [x] 2026-11-26 T3b Landingpage hell (Weiß/#F7F9F9, Teal sparsam), Trust-Leiste nur mit wahren Aussagen, Rechtsbezug mit EUR-Lex-Link + Stand-Datum, Impressum/Datenschutz mit Entwurfsdaten (Freigabe B4 offen).
- [x] 2026-11-26 T3 Landingpage (Hero, Problem, Lösung, Free Tools, Warteliste als Mock, Impressum/Datenschutz als Entwurf), Inter selbst gehostet.
- [x] 2026-11-26 T2 `packages/detect`: C2PA, IPTC DigitalSourceType, XMP/EXIF-Generator-Tags, PNG-Textchunks. 13 Fixtures, 42 Tests.
- [x] 2026-11-26 T1 Monorepo (pnpm workspaces, Astro, Hono, Vitest, Prettier), CI-Workflow mit `wrangler deploy --dry-run`.
- [x] 2026-11-26 B1 Cloudflare Worker `dob-one` mit Repo verbunden, Auto-Deploy aus main läuft.
- [x] 2026-11-26 Ideen-Shortlist, Entscheidung für Idee 1, MVP-Spec
