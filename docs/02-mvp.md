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
