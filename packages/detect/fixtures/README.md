# Fixtures

Alle Bilder sind selbst erzeugte Farbflächen (32x32), frei von Rechten. Erzeugt mit
`python3 scripts/make_fixtures.py` (Pillow). Die Metadaten bilden reale Muster nach.

Die C2PA-Manifeste sind strukturell korrekt (JUMBF + CBOR), aber **nicht signiert**.
Echte, signierte C2PA-Beispiele liegen in `c2pa-org/` (CC BY-SA 4.0, Attribution dort), Tests in
`test/c2pa-org.test.ts`. `detect` prüft keine Signaturen: auch ungültige Manifeste ergeben
höchstens `unclear`, nie `ai`.

Kein Fixture gelangt ins Web-Build: `apps/web` importiert nur `packages/detect/src`, ausgeliefert
wird nur `apps/web/dist`.
