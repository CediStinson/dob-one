# BACKLOG

Regeln: Jede Session nimmt das oberste offene Ticket ohne 🧑 (🧑 = braucht Benjamin). Fertige Tickets nach unten in "Erledigt" mit Datum.

## Offen

### Fokus ab 26.11. nachmittags (Entscheidung nach Test durch Benjamin)

Website-Check ist geparkt: listet Logos, Teamfotos usw., erkennt eingebrannte Labels nicht, der Nutzer muss alles selbst beurteilen. Kein echter Nutzen. Wert liegt dort, wo das Bild entsteht und gekennzeichnet wird.

- [ ] **T22** IPTC in alle Bildgrößen schreiben (Port von `embed.ts`), Roundtrip-Tests.
- [ ] **T23** HTML-Overlay "KI" nach Label-Spec + Alt-Text-Zusatz, Einstellungen.
- [ ] **T24** Lokales Kennzeichnungs-Log + CSV-Export, Readme für wordpress.org, Screenshots, Plugin-ZIP.
- [ ] 🧑 **B7** (nach T24) wordpress.org-Konto anlegen, Slug `klarbild` prüfen (Claude kommt nicht an wordpress.org), Plugin einreichen.

### Sprint 1: Fundament + erstes Free Tool

- [ ] 🧑 **B6** Statistik einschalten (5 Min., kostenlos): D1-Datenbank `dob-one-stats` anlegen, Database ID hier eintragen, Secret `STATS_PASSWORD` setzen. Anleitung: `docs/setup-cloudflare.md` > B6. Danach trägt Claude das Binding ein (nächster Lauf prüft das Feld).
  - Database ID: `afdd8083-64e1-452c-8ccc-502318326625` (27.11., in `wrangler.jsonc` eingetragen). Offen: Secret `STATS_PASSWORD`, falls noch nicht gesetzt.

- [ ] 🧑 **B2** Domain kaufen. kenntlich.de vergeben, .ai zu teuer. **kenntlich.eu** kaufen (Fallback kenntlich.app via Cloudflare). Benjamin: Abend 27.11. oder 28.11. Claude kann Verfügbarkeit nicht prüfen (Shell blockiert). Marke: "kenntlich. Ein Produkt von dobsonstudio". Klarbild bleibt Name des WP-Plugins.
- [ ] 🧑 **B5** Registerabfrage "kenntlich" und "klarbild" in TMview/DPMAregister (10 Min., kostenlos, Anleitung in `docs/03-marke.md`), Treffer dort eintragen.

### Sprint 2: Website-Check

- [ ] 🧑 **B3** (zurückgestellt) Supabase- und Resend-Account, erst wenn Login/Warteliste gebraucht werden.

### Sprint 3: Accounts + Report

- [ ] **T10** Magic-Link-Login (Supabase), Scans speichern.
- [ ] **T11** PDF-Report (im Browser generiert).
- [ ] **T12** (zurückgestellt) Warteliste mit Double-Opt-in, erst wenn Traffic da ist und Pro kurz vor Start steht.
- [ ] 🧑 **B4** Impressum/Datenschutz freigeben (Betreiber: dobsonstudio?).

### Geparkt

- [ ] (geparkt) **T6b** (DRINGEND) Crawl clientseitig steuern: Free-Plan erlaubt 10 ms CPU pro Request, ein Request für alle Seiten sprengt das (Error 1102 am 26.11.). Neuer Endpunkt `/api/page?url=` verarbeitet genau EINE Seite (Bilder, Skripte, Links, Inline nur Startseite), Browser führt die Warteschlange (bis 25 Seiten, robots.txt einmal via `/api/robots`). Rate-Limit auf Seiten statt Scans umstellen. Hotfix bis dahin: max. 10 Seiten, 512 KB HTML pro Seite, Inline-Skripte nur Startseite.
- [ ] (geparkt) **T14** Website-Check neu ausrichten (Entscheidung 26.11.): vom "KI-Detektor" zum Kennzeichnungs-Check. Pro Bild drei Spalten: (1) Herkunftsdaten (C2PA/IPTC/EXIF: KI-Hinweis / keine KI-Angabe / Metadaten entfernt), (2) Sichtbare Kennzeichnung erkannt? (3) Ihre Einschätzung: Nutzer markiert per Klick "KI-Bild ja/nein". Ergebnis: Liste "KI-Bild ohne sichtbares Label → kennzeichnen". Seitenweiter Hinweis, wenn kaum ein Bild Metadaten hat ("Ihr CMS entfernt Herkunftsdaten, maschinenlesbare Kennzeichnung geht verloren").
- [ ] (geparkt) **T15** Sichtbare Kennzeichnung im HTML erkennen: alt, title, figcaption, aria-label, Text im Umfeld des Bildes ("KI-generiert", "KI-Bild", "AI-generated", "mit KI erstellt" ...), EU-Icon-Bilder, unser eigenes Snippet. Signaturen in packages/detect mit Tests.
- [ ] (geparkt) **T16** (später) Eingebrannte Labels erkennen: OCR nur auf die 4 Bildecken, im Browser, selbst gehostet. Erst prüfen, ob Aufwand/Größe vertretbar ist.

## Erledigt

- [x] 2026-11-28 T21 Klarbild erkennt KI-Bilder beim Upload: PHP-Port von `packages/detect` (`src/Detect/`), gemeinsame Erwartungsliste `packages/detect/fixtures/expected.json` + `expected-fields.json` (304 Datei-/Anfangsfälle, alle 23 Generatoren, Source Types), PHP liefert exakt das gleiche Ergebnis wie TS. Status als Post-Meta, manueller Status hat Vorrang. Mediathek: Spalte, Filter, 4 Sammelaktionen mit Rechteprüfung, Auswahl in den Anhang-Details (auch Rasteransicht). 41 PHP-Tests. Noch nicht gegen echtes WordPress getestet (nur Stubs).

- [x] 2026-11-28 T20 Klarbild-Grundgerüst `apps/klarbild/`: Plugin-Header (GPL, PHP 7.4+, WP 6.2+), Autoloader, Einstellungsseite (Overlay + Ecke, Alt-Text-Zusatz, IPTC schreiben) mit Whitelist-Sanitizer und Escaping, `uninstall.php`, Platzhalter-Readme. 21 PHP-Tests mit WP-Stubs (u. a. Escaping per Mutationsprobe geprüft), lokal `pnpm test:klarbild`, CI-Job PHP 7.4/8.3 mit Lint + PHPUnit 9.6.

- [x] 2026-11-27 T18 Konzept `docs/05-plugin.md`: Erkennung beim Upload, HTML-Overlay statt Bildveränderung, IPTC in alle Bildgrößen, lokales Log. Free vollständig (wordpress.org verbietet Trialware), Pro über kenntlich-Konto (Nachweis-PDF, zentrales Log, Agentur-Dashboard, Massen-Scan). Preis-Hypothese 49 €/Jahr bzw. 149 €/Jahr Agentur. Tickets T20 bis T24 + B7 angelegt.

- [x] 2026-11-27 T13 Free Tool 2 unter `/tools/bild-in-webp-umwandeln/`: PNG/JPG/WebP/AVIF/GIF/BMP in WebP, komplett im Browser, Qualität 50 bis 100 (Standard 82), optional max. Kantenlänge 2560/1920/1280, Vorher/Nachher-Größe pro Bild und gesamt, ehrlicher Hinweis wenn WebP größer wird, ZIP für alle, erkannter KI-Hinweis wird als IPTC in die WebP übernommen. Klare Meldung, wenn der Browser kein WebP schreibt. Verlinkt auf Startseite und im Footer, zählt `webp_export`. 5 Tests, Playwright-Durchlauf.

- [x] 2026-11-27 T19 Anonyme Statistik: `POST /api/hit` und `/api/event` per `sendBeacon` (Pfad, Referrer-Domain, `label_export` mit Bildanzahl, `contact_click`, `webp_export` vorbereitet), strenge Prüfung, Bot-Filter, Rate-Limit, keine IP/kein User-Agent gespeichert. Tageszähler in D1 (Tabelle legt der Worker selbst an), `/stats` mit Basic Auth (`STATS_PASSWORD`), `noindex`, Hinweis "keine eindeutigen Besucher". Auto-Provisioning bewusst nicht genutzt: Builds-Token hat kein D1-Recht, Deploy würde brechen (→ B6). Datenschutz-Entwurf und Footer ("ohne Tracking von Personen") angepasst. Nachbesserung (2. Lauf 27.11.): Hinweisseiten statt Fehler bei fehlendem Passwort/DB/D1-Ausfall, kein Lesen ohne `content-length`, D1Store-Tests, Ende-zu-Ende mit echtem Browser (sendBeacon, keine Cookies, kein Storage), Schritt-für-Schritt-Anleitung B6. 23 Tests.

- [x] 2026-11-27 T4d Label-Generator nach `docs/04-label-spec.md`: Modus "KI-Label" (Kurz/GEN/MOD, Geometrie nach Spec, 4 Farben inkl. 50 % mit Erkennbarkeits-Hinweis, Größe 4 bis 20 %) und "Eigener Text" (Vorlage oder bis 100 Zeichen, Graustufe, Deckkraft, Schriftgröße, Schatten in Gegenfarbe, Zeilenumbruch). Export wählbar (Original/PNG/JPG/WebP, Qualität 0,9, JPG weiß hinterlegt, Fallback wenn Browser kein WebP schreibt). GEN/MOD setzt passende IPTC-Angabe. 14 neue Tests, Playwright-Durchlauf.
- [x] 2026-11-27 T3c Warteliste entfernt, ersetzt durch Kontakt-Hinweis (mailto:info@dobsonstudio.com), Datenschutz-Entwurf angepasst. Es wird nichts gespeichert.
- [x] 2026-11-27 T17 Startseite neu auf den Label-Generator ("KI-Bilder in 10 Sekunden richtig kennzeichnen"), Website-Check aus Navigation und Startseite entfernt (Seite erreichbar, `noindex` auch nach dem Start über `Base`-Prop).
- [x] 2026-11-26 T4e Sicherheitscheck: kein `innerHTML`/`set:html`/`eval` im Frontend (als Test festgeschrieben), Links nur http(s) (`safeHref`), präpariertes JPEG mit Skript im XMP zeigt nur unseren Generatornamen. Playwright-Durchlauf mit bösartigen Scan-Daten und Bild: kein Dialog, kein eingeschleustes Element. 5 Tests.
- [x] 2026-11-26 T9 Chatbot-Erkennung: 36 Signaturen in `packages/detect/src/chatbots.ts` (KI-Bots und Live-Chats mit optionaler KI), Scanner liefert zusätzlich `inlineUrls` aus Inline-Skripten (begrenzt), Website-Check zeigt Chatbots, Empfehlung und Begrüßungstext. Echttest des Crawlers gegen pypi.org (9 Seiten, 61 Bilder). 16 neue Tests.
- [x] 2026-11-26 T8 KI-Website-Check unter `/tools/ki-website-check/`: Scan + Bildprüfung im Browser (4 parallel, Fallback auf Größenvariante), Fortschritt, Kacheln, Empfehlungen, Bildliste (KI-Funde oben), Seitenliste mit Fehlertexten, Label-Snippet mit Kopieren, 429 freundlich (auch mitten in der Bildprüfung, Rest "nicht geprüft"). Scan-Inhalte nur per `textContent`. Fix: `[hidden]` wurde von `.btn` überschrieben. 22 Tests, Playwright-Durchlauf mit Mock-API.
- [x] 2026-11-26 T7 `/api/img?src=`: erste 256 KB (Range + Abbruch), nur image/\*, Ausgabe als octet-stream mit nosniff/Sandbox-CSP, SSRF-Schutz auch über Redirects, Rate-Limit.
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
