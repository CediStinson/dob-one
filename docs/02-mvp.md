# MVP-Spec: kenntlich (Favorit, Domain offen; Tochter von dobsonstudio)

Entschieden am 26.11.2026. Idee 1 aus `01-ideen.md`.

## Ziel des MVP

Ein KMU oder eine Agentur gibt eine URL ein und weiß nach 60 Sekunden:

1. welche Bilder auf der Website erkennbar KI-generiert sind (Metadaten),
2. ob ein Chatbot ohne KI-Hinweis läuft,
3. was konkret zu tun ist, inklusive fertigem Label-Snippet.

Erfolgskriterium MVP: 100 kostenlose Scans, 10 E-Mail-Registrierungen, 1 zahlender Kunde.

## Funnel

1. **Free Tools** (Reichweite, SEO): KI-Label-Generator (Bild-Label im Browser, Port vom bestehenden dobsonstudio.com-Tool), KI-Website-Check (1 Seite, ohne Login).
2. **Free Account**: voller Scan (bis 25 Seiten), Ergebnis speichern, PDF-Report.
3. **Pro 9 €/Monat**: wöchentliches Monitoring, Mail bei neuen ungekennzeichneten KI-Bildern, Label-Snippet mit Verwaltung, Compliance-Log.
4. **Agentur 49 €/Monat**: 20 Domains, White-Label-PDF.

Zahlung kommt erst nach Validierung (Stripe). Bis dahin: Warteliste für Pro.

## Was wir prüfen (v1)

- **Bilder**: C2PA-Manifest, IPTC `DigitalSourceType` (trainedAlgorithmicMedia u. ä.), XMP/EXIF-Software-Tags bekannter Generatoren (Midjourney, DALL-E, Firefly, SD/ComfyUI, Gemini/Nano Banana ...), PNG-Textchunks mit Prompt-Parametern.
- **Chatbots**: bekannte Widget-Skripte (Intercom Fin, Tidio Lyro, Chatbase, Botpress, Voiceflow ...) und ob ein KI-Hinweis im Umfeld existiert.
- **Keine** visuelle "KI-Detektor"-Erkennung im MVP. Ergebnisse sind Hinweise, kein Beweis. Disclaimer wie beim bestehenden Generator.

## Tech-Stack (0 €)

- **Hosting**: Ein Cloudflare Worker mit Static Assets (Cloudflare-Empfehlung für neue Projekte statt Pages). Frontend + API in einem Deployment.
- **Frontend**: Astro + TypeScript, statisch gebaut. Interaktive Teile als Vanilla-TS-Islands.
- **Scanner**: API-Routen im selben Worker (Hono). Der Worker crawlt HTML (HTMLRewriter) und lädt pro Bild nur die ersten ~256 KB. Das Parsen der Metadaten läuft im Browser (exifr + eigener C2PA/PNG-Chunk-Parser), weil der Free-Plan wenig CPU pro Request erlaubt. Limits vor dem Bau verifizieren.
- **Monitoring** (später): GitHub Actions Cron, Parsen serverseitig in Node.
- **Auth + DB**: Supabase Free (Postgres, Magic-Link-Login).
- **Mail**: Resend Free.
- **Analytics**: keine Cookies. Cloudflare Web Analytics.
- Alles DSGVO-freundlich: keine externen CDNs, Fonts selbst gehostet.

## Cloudflare Free-Limits (recherchiert 26.11.2026)

Quellen: [Limits](https://developers.cloudflare.com/workers/platform/limits/) (Stand 19.11.2026), [Static Assets Billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) (Stand 12.11.2026), [Subrequest-Changelog](https://developers.cloudflare.com/changelog/post/2026-02-11-subrequests-limit/) (11.02.2026), [Builds](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/) (Stand 28.10.2026).

| Limit                      | Free                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------- |
| Worker-Requests            | 100.000 pro Tag, Reset 00:00 UTC                                                       |
| Static-Asset-Requests      | kostenlos, unbegrenzt (zählen nicht zum Worker-Limit)                                  |
| CPU pro Request            | 10 ms (Warten auf fetch zählt nicht), sonst Fehler 1102                                |
| Dauer pro Request          | kein Limit solange Client verbunden, `waitUntil` max. 30 s                             |
| Speicher                   | 128 MB pro Isolate                                                                     |
| Subrequests                | 50 extern pro Aufruf, 1.000 an Cloudflare-Dienste (Änderung 02/2026 gilt nur für Paid) |
| Gleichzeitige Verbindungen | 6 (weitere werden gequeued)                                                            |
| Worker-Größe               | 64 MiB unkomprimiert                                                                   |
| Env-Variablen              | 64 pro Worker, je 5 KB                                                                 |
| Assets                     | 20.000 Dateien pro Version, max. 25 MiB pro Datei                                      |
| Cron Triggers              | 5 pro Account                                                                          |
| Workers Builds             | 3.000 Min./Monat, 1 Build gleichzeitig, Timeout 20 Min.                                |

Folgen für uns:

- Über dem Tageslimit liefern `run_worker_first`-Routen (`/api/*`) **429**, die statischen Seiten und der Label-Generator laufen weiter. Die UI muss 429 freundlich abfangen ("Tageskontingent erreicht, morgen wieder").
- **T6 Crawl**: robots.txt + bis 25 Seiten = 26 externe Subrequests, passt unter 50. Redirects zählen einzeln, deshalb max. 3 Redirects pro URL und hartes Abbruchbudget von 45 Subrequests. Max. 6 parallel, also in Batches.
- **10 ms CPU**: HTML nur streamend mit HTMLRewriter verarbeiten (nur `img`, `source`, `script`, `link`), keine DOM-Bäume, kein Regex über ganze Seiten. Metadaten-Parsing bleibt im Browser (wie geplant).
- **T7 `/img`**: ein Aufruf pro Bild, also pro Scan bis zu ~25 Seiten × n Bilder Worker-Requests. Bei 100.000/Tag reicht das für einige hundert volle Scans täglich. Pro Scan Bilder deduplizieren und auf z. B. 150 begrenzen.
- Rate-Limit pro IP ohne KV/DO: zunächst einfach (Cloudflare-Regel oder In-Memory pro Isolate), echte Lösung erst bei Bedarf.

## Scanner-API (T6/T7, Stand 26.11.2026)

Beide Routen liegen unter `/api/*`, weil nur dort der Worker vor den statischen Assets läuft.

- `GET /api/scan?url=example.de`: crawlt bis 25 Seiten der gleichen Website (www. zählt dazu, Redirect der Startseite auf eine andere Domain wird übernommen), respektiert robots.txt (Gruppe `kenntlich-check`, sonst `*`). Max. 45 Subrequests, 6 parallel, 2 MB HTML pro Seite, 150 Bilder. Antwort: `pages`, `images` (`src` + bis zu 5 Fundseiten, Größenvarianten wie `-300x200` zusammengefasst in `variants`, `src` ist das Original bzw. die größte Variante), `scripts`, `iframes`, `inlineUrls` (URLs aus Inline-Skripten, max. 16 KB pro Skript, 96 KB und 40 URLs pro Seite, JSON-LD ignoriert), `robots`, `truncated`, `subrequests`. Rate-Limit 5 Scans / 10 Min. pro IP.
- `GET /api/img?src=…`: erste 256 KB eines Bildes (Range-Header, danach Abbruch). Nur `image/*`, Ausgabe immer als `application/octet-stream` mit `nosniff` und Sandbox-CSP (kein SVG/HTML-Ausführen auf unserer Domain). Header `x-upstream-content-type`, `x-truncated`. Rate-Limit 400 / 10 Min. pro IP.
- SSRF-Schutz bei jedem Abruf und jedem Redirect-Schritt (max. 3): nur http/https, nur Standardports, keine Zugangsdaten, keine privaten/reservierten IPv4/IPv6 (auch Zahlen- und Hex-Schreibweisen, IPv4-gemappt), keine internen Namen (`localhost`, `.local`, `.internal`, einteilige Hosts). DNS wird nicht aufgelöst (Workers erreichen keine privaten Netze).
- Rate-Limit ist pro Isolate im Speicher, also grob. Bei Missbrauch: Cloudflare-Regel oder Durable Object.
- Seitenfehler in `pages[].error`: `unreachable` (Cloudflare 530, meist Domain existiert nicht/Tippfehler), `http_<code>`, `not_html`, `network`, `private_host`, `too_many_redirects`.
- Fehler: 400 (ungültige/private URL), 415 (kein Bild), 429 (Rate-Limit, mit `retry-after`), 502 (Ziel nicht erreichbar).

## Website-Check UI (T8, Stand 26.11.2026)

- Seite `/tools/ki-website-check/`, Vanilla-TS (`apps/web/src/scripts/website-check.ts`), Logik in `apps/web/src/lib/check/` (getestet).
- Ablauf: `/api/scan` → pro Bild `/api/img` (4 parallel, bei Fehler eine Größenvariante) → `detect` im Browser → Kacheln, Empfehlungen, Bildliste, Seitenliste, Label-Snippet.
- 429 beim Scan: Wartezeit aus `retry-after`, ohne Angabe Text "Tageskontingent". 429 während der Bildprüfung: Abbruch, Rest als "nicht geprüft", Ergebnis wird trotzdem gezeigt.
- Entscheidung: Bis Accounts (T10) existieren, zeigt der freie Check den ganzen Scan (bis 25 Seiten) statt nur einer Seite. Begrenzung kommt mit T10.
- `?url=` füllt das Feld vor, startet aber nicht automatisch.

## Chatbot-Erkennung (T9, Stand 26.11.2026)

- Signaturliste in `packages/detect/src/chatbots.ts` (`detectChatbots(urls)`), Vergleich auf `host/pfad` ohne www. und Query. Quelle: `scripts`, `iframes`, `inlineUrls` aus `/api/scan`. Inline-URLs sind nötig, weil Intercom, Crisp, tawk.to, Drift, Voiceflow, LiveChat ihr Widget per JS-Snippet nachladen.
- Zwei Arten: `ai` (KI-Chatbot, z. B. Chatbase, Botpress, Voiceflow, moin.ai, AI Engine für WordPress) und `ai_optional` (Live-Chat mit optionaler KI, z. B. Intercom, Tidio, Zendesk, Userlike, Smartsupp).
- Grenzen: Widgets über Tag Manager oder erst nach Cookie-Zustimmung sehen wir nicht. Ob der Chat bereits einen KI-Hinweis zeigt, prüfen wir nicht (Widget startet erst im Browser). Die UI sagt das offen.
- UI: Kachel "Chatbots", Liste mit Art, Empfehlung, Textvorschlag für die Begrüßung zum Kopieren.

## Design (überarbeitet 26.11.2026)

- **Hell statt dunkel.** Compliance-Produkt für KMU: Vertrauen, Ruhe, Seriosität. Weißer/sehr heller Grund (#FFFFFF / #F7F9F9), dunkles Graublau für Text, Teal als Akzent sparsam (Buttons, Haken, Links). dobsonstudio-Look (dunkel) gilt hier ausdrücklich nicht.
- Inter selbst gehostet, viel Weißraum, klare Tabellen und Häkchen-Listen, echte Screenshots statt Stock-Illustrationen.
- **Trust-Elemente, nur was wahr ist:**
  - "Entwickelt in Deutschland" (stimmt: Rottweil). NICHT "Gehostet in Deutschland" (Cloudflare).
  - "Ohne Cookies, ohne Tracking"
  - "Ihre Bilder verlassen den Browser nicht" (Label-Generator)
  - "Kein Login für den Schnell-Check"
  - "Deutscher Ansprechpartner" + echtes Impressum mit Namen und Adresse, sichtbar verlinkt
  - Rechtsbezug transparent: Art. 50 KI-VO verlinkt (EUR-Lex), Stand-Datum der Inhalte
- **Verboten** (irreführend, UWG-Risiko): erfundene Siegel/Zertifikate ("DSGVO-zertifiziert", "TÜV", "rechtssicher garantiert"), erfundene Kundenlogos, Bewertungen oder Testimonials, Nutzerzahlen, die nicht stimmen.
- Sprache: Deutsch, Sie-Form (B2B, Vertrauen). Keine Gedankenstriche.

## Nicht im MVP

Visuelle KI-Erkennung, Video/Audio, Stripe, Mehrsprachigkeit, WP-Plugin-Anbindung (kommt als Erstes danach: Klarbild-Plugin meldet an die SaaS).

## Wettbewerb (Stand 26.11.2026)

- meetergo bietet einen kostenlosen KI-Kennzeichnungs-Check (C2PA, IPTC, Chatbot, ohne Anmeldung). Der Einmal-Check ist also kein Alleinstellungsmerkmal.
- Unsere Differenzierung: Monitoring, Label-Snippet + Verwaltung, Nachweis-Log, Agentur-Modus, WP-Plugin-Integration (Klarbild).

## Positionierung (entschieden 26.11.2026)

- **Markt: Deutschland zuerst**, danach AT/CH. Deutsch only im MVP. Englisch erst nach Product-Market-Fit (gleiche Domain, `/en`).
- **Vertrauen vor Reichweite**: DSGVO-maximal, keine Cookies, kein Tracking, keine externen Ressourcen, Datensparsamkeit (Scans speichern nur URL + Ergebnis, keine Bilder).
- **Hosting-Ehrlichkeit**: Cloudflare und Supabase sind US-Unternehmen (Nutzung über EU-US Data Privacy Framework, Supabase-Region Frankfurt). Wird "gehostet in Deutschland" zum Verkaufsargument, ziehen wir auf Hetzner um. Deshalb Code portabel halten: Hono läuft auch auf Node, keine Cloudflare-only-Features ohne Not.
- **Domain**: kenntlich.de vergeben, .ai zu teuer. Favorit kenntlich.eu (EU-Recht, später DACH-tauglich), Fallback kenntlich.app.
