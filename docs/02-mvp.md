# MVP-Spec: Klarbild (Arbeitsname)

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
- **Frontend**: Astro + TypeScript, statisch, auf Cloudflare Pages. Interaktive Teile als Vanilla-TS-Islands.
- **Scanner**: Cloudflare Worker (Hono). Der Worker crawlt HTML (HTMLRewriter) und lädt pro Bild nur die ersten ~256 KB. Das Parsen der Metadaten läuft im Browser (exifr + eigener C2PA/PNG-Chunk-Parser), weil der Free-Plan wenig CPU pro Request erlaubt. Limits vor dem Bau verifizieren.
- **Monitoring** (später): GitHub Actions Cron, Parsen serverseitig in Node.
- **Auth + DB**: Supabase Free (Postgres, Magic-Link-Login).
- **Mail**: Resend Free.
- **Analytics**: keine Cookies. Cloudflare Web Analytics.
- Alles DSGVO-freundlich: keine externen CDNs, Fonts selbst gehostet.

## Design
Dunkel, minimal, Inter, Akzent Teal. Keine Gedankenstriche in Kunden-Copy. Sprache: Deutsch zuerst, Englisch später.

## Nicht im MVP
Visuelle KI-Erkennung, Video/Audio, Stripe, Mehrsprachigkeit, WP-Plugin-Anbindung (kommt als Erstes danach: Klarbild-Plugin meldet an die SaaS).
