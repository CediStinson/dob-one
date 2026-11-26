# BACKLOG

Regeln: Jede Session nimmt das oberste offene Ticket ohne 🧑 (🧑 = braucht Benjamin). Fertige Tickets nach unten in "Erledigt" mit Datum.

## Offen

### Sprint 1: Fundament + erstes Free Tool

- [ ] 🧑 **B2** Domain kaufen. kenntlich.de vergeben, .ai zu teuer. **kenntlich.eu** kaufen (Fallback kenntlich.app via Cloudflare). Heute Abend. Claude kann Verfügbarkeit nicht prüfen (Shell blockiert). Marke: "kenntlich. Ein Produkt von dobsonstudio". Klarbild bleibt Name des WP-Plugins.
- [ ] 🧑 **B5** Registerabfrage "kenntlich" und "klarbild" in TMview/DPMAregister (10 Min., kostenlos, Anleitung in `docs/03-marke.md`), Treffer dort eintragen.

### Sprint 2: Website-Check

- [ ] **T4d** Label-Generator an `docs/04-label-spec.md` angleichen: Varianten Kurz/GEN/MOD im EU-Icon-Muster, 4 Farben inkl. 50 %, Größe 4 bis 20 %, Eigener-Text-Modus mit Vorlage, Export PNG/JPG/WebP. Geometrie wie spezifiziert. In unserer Schrift (Inter).
- [ ] **T4e** Sicherheitscheck Label-Generator + Website-Check: Metadaten und gescannte Inhalte nur per `textContent` ausgeben, nie `innerHTML`. Test mit präpariertem Bild (Skript im XMP).
- [ ] **T13** Free Tool 2 (SEO): PNG/JPG in WebP umwandeln, im Browser, Pixelmaße bleiben gleich, Qualitätsregler, ZIP. Eigene Landingpage "PNG in WebP umwandeln" mit Hinweis auf KI-Label-Generator.
- [ ] **T8** Web: KI-Website-Check UI (nutzt `/api/scan` + `/api/img`, 429 freundlich abfangen) mit Fortschritt, Ergebnisliste, Handlungsempfehlungen, Label-Snippet.
- [ ] **T9** Chatbot-Erkennung (Signaturliste in `packages/detect`).
- [ ] 🧑 **B3** Supabase- und Resend-Account anlegen, Keys als Env-Variablen in Cloudflare eintragen.

### Sprint 3: Accounts + Report

- [ ] **T10** Magic-Link-Login (Supabase), Scans speichern.
- [ ] **T11** PDF-Report (im Browser generiert).
- [ ] **T12** Warteliste echt anbinden, Double-Opt-in-Mail.
- [ ] 🧑 **B4** Impressum/Datenschutz freigeben (Betreiber: dobsonstudio?).

## Erledigt

- [x] 2026-11-26 T7 `/api/img?src=`: erste 256 KB (Range + Abbruch), nur image/*, Ausgabe als octet-stream mit nosniff/Sandbox-CSP, SSRF-Schutz auch über Redirects, Rate-Limit.
- [x] 2026-11-26 T6 `/api/scan?url=`: Crawler bis 25 Seiten mit HTMLRewriter, robots.txt, Budget 45 Subrequests, 6 parallel, 150 Bilder, Skripte/iframes für T9, SSRF-Schutz, Rate-Limit pro IP. 44 neue Tests (lol-html als WASM), Produktionsparser in workerd geprüft.
- [x] 2026-11-26 T2b Markenrecherche `docs/03-marke.md`: Websuche ohne Kollision, Register selbst nicht abfragbar (→ B5), Hauptrisiko: "kenntlich" ist beschreibend, eher Wort-Bild-Marke.
- [x] 2026-11-26 T2c Tests für 5 echte C2PA-Dateien (c2pa-org): A → none, C/CA/XCA/E-sig → unclear mit claim_generator, Erkennung auch mit nur 64 KB Anfang, Robustheit bei Abschneiden. Lizenz/Attribution liegt bei, Fixtures nicht im Web-Build (geprüft). 7 Tests.
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
