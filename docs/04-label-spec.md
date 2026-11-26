# Label-Spezifikation (Referenz für den KI-Label-Generator)

Stand 26.11.2026. Funktionale Vorgaben aus einem früheren, von Benjamin gebauten Labeler. Nur das Verhalten wird übernommen, kein Code. Unser Generator wird eigenständig umgesetzt.

## Label-Varianten (Modus "KI-Label")

Angelehnt an die EU-Icons zur KI-Kennzeichnung (Basic, Generated, Modified).

| Variante | Form                                                  | Inhalt                                                    |
| -------- | ----------------------------------------------------- | --------------------------------------------------------- |
| Kurz     | quadratisches Badge, Eckenradius 16 % der Kantenlänge | "KI", fett                                                |
| GEN      | Pille, Radius = halbe Höhe                            | "KI" fett + "GENERIERT" (halbfett, 86 % der Schriftgröße) |
| MOD      | Pille, Radius = halbe Höhe                            | "KI" fett + "MODIFIZIERT" (halbfett, 86 %)                |

Geometrie (s = kürzere Bildkante):

- Höhe Badge/Pille: `max(32 px, s * Größe%)`, Größe 4 bis 20 %, Standard 8 %
- Abstand zum Rand: `max(4 px, s * 1,2 %)`
- Kurz: Schriftgröße 44 % der Höhe, zentriert
- Pille: Schriftgröße 40 % der Höhe, Innenabstand links/rechts 32 % der Höhe, Abstand zwischen "KI" und Zusatz 18 % der Höhe
- Text optisch mittig: Grundlinie um 4 % der Schriftgröße nach unten versetzt
- Position: vier Ecken, Standard rechts unten

Das Label lautet immer "KI", keine Sprachwahl, damit alle Bilder einheitlich gekennzeichnet sind.

## Farben

| Name         | Hintergrund | Text    | Deckkraft Hintergrund |
| ------------ | ----------- | ------- | --------------------- |
| Schwarz      | #000000     | #FFFFFF | 100 %                 |
| Weiß         | #FFFFFF     | #000000 | 100 %                 |
| Schwarz 50 % | #000000     | #FFFFFF | 50 %                  |
| Weiß 50 %    | #FFFFFF     | #000000 | 50 %                  |

Hinweis im UI bei den halbtransparenten Varianten: Das Label muss klar erkennbar bleiben und darf nicht zum Verstecken genutzt werden (Art. 50 Abs. 5: klar und eindeutig).

## Modus "Eigener Text"

- Vorlage: "Dieses Bild wurde mit Unterstützung von KI erstellt", oder freier Text bis 100 Zeichen
- Graustufe Schwarz bis Weiß, Deckkraft, Schriftgröße in % der kürzeren Kante
- Lesbarkeit: weicher Schatten in Gegenfarbe (Blur 20 % der Schriftgröße, 50 % Deckkraft)
- Randabstand: `max(14 px, s * 2,2 %)`, horizontal × 1,35

## Export

- Formate PNG, JPG, WebP; JPG/WebP mit guter Qualität (ca. 0,9)
- JPG: transparente Bereiche vorher weiß füllen (sonst schwarz in manchen Browsern)
- Einzeln oder alle als ZIP

## KI-Einschätzung

Drei Ergebnisse: **KI-Hinweis gefunden**, **Keine Metadaten**, **Kein KI-Hinweis**. Grundlage: Dateiname, Metadaten (EXIF, XMP, IPTC inkl. `trainedAlgorithmicMedia`), C2PA.

Stichwortliste für Software-/Generator-Felder (Kleinschreibung, Teilstring):
midjourney, stable diffusion, dall-e, dalle, firefly, adobe firefly, imagen, ideogram, flux, leonardo, runway, pika, kling, sora, generative, ai generated, ki generiert, canva ai, getimg, nightcafe, dreamstudio, novelai, comfyui, automatic1111, invoke, diffusers, openai, gemini, gpt-4

Achtung, Fehlalarme: "invoke", "flux", "runway", "generative" kommen auch in harmlosen Kontexten vor. Nur in Software-/Creator-Tool-Feldern prüfen, nicht im Freitext.

Keine visuelle Heuristik im MVP (siehe `02-mvp.md`). Ergebnis ist immer Hinweis, kein Beweis.

## Sicherheit

Metadaten sind Fremdeingaben. Niemals als HTML einfügen, immer als Text (`textContent`) ausgeben. Ein präpariertes Bild darf kein Skript in die Seite bringen.

## Datenschutz

Alles im Browser, keine Uploads, keine externen Bibliotheken von CDNs. Fonts und Libraries selbst ausliefern.
