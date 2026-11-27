# Konzept: Klarbild (WordPress-Plugin)

Stand 27.11.2026 (T18). Entwurf von Claude, Annahmen sind markiert.

## Problem

KMU und Agenturen laden KI-Bilder in die WordPress-Mediathek. Dort passiert heute dreierlei:

1. Niemand merkt sich, welches Bild KI ist. Nach drei Monaten weiß es keiner mehr.
2. Ein sichtbarer Hinweis fehlt oder wird von Hand in Bildunterschriften getippt, uneinheitlich.
3. Maschinenlesbare Herkunftsdaten (IPTC, C2PA) gehen verloren: WordPress erzeugt Bildgrößen neu, Bildoptimierer und WebP-Plugins entfernen Metadaten.

Klarbild löst das dort, wo das Bild in die Website kommt: beim Upload.

## Zielgruppe

- KMU mit WordPress, die KI-Bilder für Blog, Produkte, Social nutzen (Marketing-Verantwortliche, keine Entwickler).
- Agenturen wie dobsonstudio, die viele Kundenseiten betreuen und einen Nachweis brauchen, dass sie gekennzeichnet haben.

## Kernfunktionen

### Beim Upload erkennen

- Hook `wp_generate_attachment_metadata` (bzw. `add_attachment`): Original lesen, KI-Hinweise prüfen wie `packages/detect` (IPTC `DigitalSourceType`, C2PA-Manifest vorhanden, Generator-Tags in XMP/EXIF, PNG-Textchunks von A1111/ComfyUI).
- Port nach PHP, nur Lesen der ersten ~256 KB, keine Bildbearbeitung. Testfälle: dieselben Fixtures wie `packages/detect` (gemeinsame Erwartungsliste als JSON, damit TS und PHP gleich urteilen).
- Ergebnis als Attachment-Meta `_klarbild_status`: `ai`, `ai_partial`, `unclear`, `none`, plus `_klarbild_source` (`detected` / `manual`).

### Markieren und prüfen

- Mediathek: Spalte "KI", Filter "Nur KI-Bilder" / "Unklar", Sammelaktion "Als KI markieren" / "Kein KI-Bild".
- Anhang-Details und Bild-Block im Editor: Schalter "KI-generiert / Mit KI bearbeitet / Kein KI-Bild".
- Hinweis im Upload-Dialog, wenn Metadaten auf KI deuten, aber noch nicht bestätigt ist.

### Sichtbar kennzeichnen (ohne das Original zu verändern)

- Standard: HTML-Overlay. Filter auf `wp_get_attachment_image`, `the_content`/`render_block` (Bild-, Galerie-, Cover-Block) setzt ein kleines Label "KI" in die Bildecke, gestaltet nach `docs/04-label-spec.md`, als echtes HTML mit `aria-label`. Vorteile: Original bleibt unverändert, Label ist auch für Maschinen lesbar, abschaltbar.
- Zusätzlich optional: Text an `alt` oder Bildunterschrift anhängen ("KI-generiert").
- Optional: Label in die erzeugten Bildgrößen einbrennen (für Bilder, die außerhalb von WordPress weiterverwendet werden, z. B. per RSS oder Social-Vorschau). Original bleibt immer erhalten.
- Grenzen offen benennen: Theme-Bilder per CSS-Hintergrund oder Page-Builder mit eigenem Bild-Markup werden vom Overlay ggf. nicht erfasst. Liste getesteter Themes/Builder im Readme.

### Metadaten erhalten

- Nach dem Erzeugen der Bildgrößen (und WebP-Varianten, falls aktiv) schreibt Klarbild den IPTC-Hinweis per XMP neu in jede Variante, wenn das Bild als KI markiert ist. Gleiche Logik wie `packages/detect/src/embed.ts`, nach PHP portiert (JPEG APP1, PNG iTXt, WebP VP8X + XMP).
- Zu prüfen (Annahme): GD verwirft beim Skalieren alle Metadaten; Imagick behält laut WordPress-Kern einige Profile (u. a. IPTC/XMP), das variiert je nach Hoster. Deshalb immer neu schreiben statt auf Erhalt hoffen.
- Kompatibilität zu verbreiteten Optimierern (Smush, ShortPixel, EWWW, Imagify, WebP Express) testen: diese laufen oft später und entfernen Metadaten. Lösung: erneut schreiben nach deren Hook, wo möglich, sonst klarer Hinweis im Readme.

### Kennzeichnungs-Log

- Eigene Tabelle `wp_klarbild_log`: Datum, Anhang-ID, Dateiname, Status alt/neu, Quelle (erkannt/manuell), Benutzer, Art der Kennzeichnung (Overlay, Alt-Text, eingebrannt, IPTC).
- Ansicht unter Medien > Klarbild mit Filter und CSV-Export.

## Free vs. Pro

WordPress.org verbietet Trialware: Funktionen im kostenlosen Plugin dürfen nicht gesperrt sein und erst gegen Bezahlung freigeschaltet werden. SaaS-Anbindung ist erlaubt, wenn der Dienst echte Funktion liefert und im Readme dokumentiert ist. Keine Datenübertragung ohne ausdrückliche Zustimmung. Daraus folgt:

| Klarbild (kostenlos, wordpress.org)            | Pro (über kenntlich-Konto, später)                                    |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| Erkennung beim Upload, Status in der Mediathek | Nachweis-PDF pro Website und Zeitraum (wer, was, wann, wie)           |
| Manuell markieren, Sammelaktionen              | Log zentral gespeichert, auch nach Plugin-Löschung oder Relaunch      |
| HTML-Overlay, Alt-Text-Zusatz                  | Mehrere Websites in einem Dashboard (Agentur-Modus)                   |
| IPTC in alle Bildgrößen schreiben              | Bestehende Mediathek prüfen (Massen-Scan in Etappen, mit Fortschritt) |
| Lokales Log mit CSV-Export                     | Mail bei neuen, unmarkierten KI-Uploads                               |
| Einbrennen in Bildgrößen                       | White-Label-PDF für Agenturen                                         |

Grundsatz: Das kostenlose Plugin ist für eine einzelne Website vollständig nützlich. Pro verkauft das, was über die einzelne Website hinausgeht: Nachweis, Zentrale, Agentur. Das passt zum Ziel "Nebeneinkommen mit wenig Aufwand" und ist mit den Richtlinien vereinbar.

Preis-Hypothese (zu validieren, nicht kommunizieren): Pro 49 € pro Jahr und Website, Agentur 149 € pro Jahr bis 25 Websites. Jahrespreise, weil WordPress-Käufer daran gewöhnt sind und weniger Abrechnungsaufwand entsteht.

Zahlungsbereitschaft testen, bevor Pro gebaut wird: Im Plugin (Einstellungsseite, nicht als Dashboard-Banner) ein Absatz "Nachweis-PDF und Agentur-Modus in Planung" mit Kontakt-Link. Zählung über die eigene Statistik nur auf unserer Website, nicht aus dem Plugin heraus.

## Technik

- PHP 7.4+ (Annahme, an WordPress-Mindestanforderungen orientiert), WordPress 6.2+. Keine Abhängigkeiten außer WordPress, kein Composer im ausgelieferten Plugin.
- Struktur: `klarbild.php`, `src/Detect/` (Parser), `src/Embed/` (XMP schreiben), `src/Admin/` (Mediathek, Einstellungen, Log), `src/Front/` (Overlay), `assets/` (CSS, kleines JS für den Block-Editor).
- Tests: PHPUnit für Parser und Embed mit den Fixtures aus `packages/detect` (PHP ist in der Session-Umgebung vorhanden). Integrationstest gegen WordPress später mit `wp-env` (braucht Docker, offen).
- Lizenz GPLv2 or later (Pflicht für wordpress.org). Gilt nur fürs Plugin, die SaaS bleibt unser Code.
- Ort im Repo: `apps/klarbild/` mit eigenem CI-Job (PHP-Lint + PHPUnit). Kein Einfluss auf den Cloudflare-Deploy.
- Datenschutz: Das Plugin sendet von sich aus nichts. Pro-Anbindung nur nach Eingabe eines API-Schlüssels, im Readme dokumentiert.

## Risiken

- Rechtslage: Art. 50 KI-VO gilt laut Verordnung ab 02.08.2026 (mögliche Übergangsfristen durch das EU-Digital-Omnibus-Paket vor Veröffentlichung prüfen) und betrifft je nach Fall Anbieter und Betreiber unterschiedlich. Klarbild verspricht keine Rechtssicherheit, nur Werkzeuge und Nachweis. Texte dazu vor Veröffentlichung durch Benjamin freigeben.
- Name: "Klarbild" muss im Plugin-Verzeichnis frei sein (Slug `klarbild`) und markenrechtlich passen (B5). Konnte ich nicht prüfen (wordpress.org blockiert automatische Abrufe).
- Review-Dauer im Plugin-Verzeichnis: oft mehrere Wochen (Annahme). Für das Ziel "eingereicht bis 25.12." früh einreichen, Basisversion klein halten.
- Konto bei wordpress.org nötig, das ist ein Account in Benjamins Namen (🧑).
- Konkurrenz: andere KI-Kennzeichnungs-Plugins können entstehen. Vorteil Klarbild: Metadaten-Erhalt, Nachweis-Log, Verbindung zum Label-Generator und deutsche Ausrichtung.

## Vorschlag Tickets

1. **T20** Klarbild-Grundgerüst in `apps/klarbild/` (Plugin-Header, Einstellungsseite, CI-Job PHP-Lint + PHPUnit), ohne Funktion.
2. **T21** PHP-Port der Erkennung (IPTC, C2PA vorhanden, Generator-Tags, PNG-Text) mit gemeinsamen Fixtures, Status beim Upload speichern, Mediathek-Spalte + Filter + Sammelaktion.
3. **T22** IPTC in alle Bildgrößen schreiben (Port von `embed.ts`), Roundtrip-Tests.
4. **T23** HTML-Overlay + Alt-Text-Zusatz, Einstellungen.
5. **T24** Lokales Log + CSV-Export, Readme für wordpress.org (Englisch + Deutsch; Annahme: das Verzeichnis erwartet ein englisches Readme, vor Einreichung prüfen), Screenshots.
6. 🧑 **B7** wordpress.org-Konto anlegen, Slug `klarbild` prüfen, Plugin einreichen (ZIP liefert Claude).
