# Ideen-Shortlist (26.11.2026)

Kriterien: 0 € Start, Benjamin hat Zugang zur Zielgruppe, rechtlicher oder wirtschaftlicher Druck beim Kunden, MVP in 2 bis 4 Wochen baubar.

## 1. KI-Kennzeichnung als SaaS (Empfehlung)

**Problem:** Seit 2. August 2026 gelten die Transparenzpflichten aus Art. 50 AI Act. Betreiber, also normale Unternehmen, müssen Deepfakes und KI-Interaktionen (Chatbots) kennzeichnen. Bußgelder bis 15 Mio. € bzw. 3 %. Die meisten KMU wissen nicht, welche Bilder auf ihrer Website KI-generiert sind.

**Produkt:**
- URL eingeben, Scanner crawlt die Website
- Findet KI-Bilder über Metadaten (C2PA, IPTC DigitalSourceType, Generator-Spuren in EXIF/XMP), findet Chatbot-Widgets ohne KI-Hinweis
- Liefert ein Label-Snippet (1 Zeile JS), das auf jedem CMS läuft, nicht nur WordPress
- Compliance-Log und Nachweis-PDF ("wann wurde was gekennzeichnet")

**Markt:** Jung. OMR Reviews listet in der Kategorie KI-Kennzeichnung (Stand Okt. 2026) 8 Tools, keines mit Bewertungen.

**Vorteil für uns:** Klarbild (WP-Plugin) existiert schon, Logik und Design sind wiederverwendbar. Das WP-Plugin wird zum kostenlosen Lead-Kanal für die SaaS.

**Preis-Idee:** Free Scan, 9 €/Monat (1 Domain + Monitoring), 49 €/Monat Agentur (20 Domains, White-Label-PDF).

**Risiken:** Erkennung ohne Metadaten ist unzuverlässig, daher keine "KI-Detektor"-Versprechen, sondern Metadaten + manuelle Markierung. Rechtliche Einordnung ("ist das ein Deepfake?") bleibt beim Kunden.

## 2. Compliance-Monitor für Web-Agenturen (DACH)

**Produkt:** Ein wöchentlicher Scan pro Kundenwebsite: Impressum, externe Ressourcen ohne Consent (Google Fonts etc.), BFSG-Basics (axe-core), KI-Kennzeichnung. White-Label-Report für Wartungsverträge.

**Markt:** Voll. iubenda, Usercentrics, Indie-Tools (z. B. DSGVO Guard mit 19 €/49 €), WP-Plugins mit Scannern über 14 Gesetze. Differenzierung nur über Agentur-Fokus.

**Vorteil:** dobsonstudio ist selbst Kunde (Dogfooding), Überschneidung mit dobsonstudio-dashboard.

**Einschätzung:** Gute Ausbaustufe von Idee 1, als Start zu austauschbar.

## 3. AI-Creator-Ops (Lina als Testfeld)

**Produkt:** Content-Kalender, Persona-Konsistenz-Check, Caption-Generator und Art.-50-Kennzeichnung für AI-Influencer-Accounts.

**Markt:** Voll und laut (Sozee, Pykaso, Glambase, Influverse ...). B2C-artige Kunden mit hoher Churn. Instagram-Publishing braucht Meta App Review.

**Vorteil:** @linajaxn als echter Use Case und Reichweite.

**Einschätzung:** Spaßig, aber schwächstes Geschäftsmodell. Lina eher als Marketing-Kanal für Idee 1 nutzen ("so kennzeichnet eine KI-Influencerin richtig").

## Empfehlung

Idee 1 bauen, Architektur so anlegen, dass Idee 2 später als Erweiterung (weitere Checks) dazukommt.
