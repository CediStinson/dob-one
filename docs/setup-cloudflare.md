# Setup: Cloudflare + Domain (B1 + B2)

Cloudflare empfiehlt für neue Projekte Workers mit Static Assets statt Pages. Wir nutzen das.
Cloudflare Registrar kann keine .de-Domains registrieren. Die .de kaufst du also bei einem anderen Registrar und stellst nur die Nameserver auf Cloudflare um.

## B1: Cloudflare-Account + Deployment

1. Account auf dash.cloudflare.com anlegen (Free Plan), 2FA aktivieren.
2. Links "Workers & Pages" > "Create" > "Import a repository" (Workers, nicht Pages).
3. GitHub verbinden, nur Repo `CediStinson/dob-one` freigeben.
4. Einstellungen: Projektname `dob-one`, Production Branch `main`, Build-Command leer, Deploy-Command `npx wrangler deploy`, Root `/`.
5. Deploy. Ergebnis: `kenntlich.<dein-subdomain>.workers.dev` zeigt die Platzhalterseite.
6. Mir die workers.dev-URL schicken.

## B2: Domain

1. Verfügbarkeit prüfen: kenntlich.de > kenntlich.ai > kenntlich.app. Fallbacks: offenbar.ai, kiar.de.
2. .de kaufen bei Hetzner (hast du schon) oder INWX. Kein Hosting/E-Mail-Paket dazu.
   .ai/.app gehen auch direkt über Cloudflare Registrar (Selbstkostenpreis).
3. In Cloudflare: "Add a domain" > Domain eintragen > Free Plan > Cloudflare zeigt 2 Nameserver.
4. Beim Registrar die Nameserver auf diese 2 umstellen. Dauert Minuten bis wenige Stunden.
5. Wenn Cloudflare "Active" zeigt: Workers & Pages > dob-one > Settings > Domains & Routes > "Add custom domain" > `kenntlich.de` und `www.kenntlich.de`.
6. SSL/TLS auf "Full (strict)". Fertig.

## Später (B3, nicht jetzt)

Supabase + Resend. Kommt mit Sprint 2.

## Build (seit T1)

Kein Build-Command im Dashboard nötig. `wrangler.jsonc` enthält `build.command` (`pnpm install --frozen-lockfile && pnpm build`), das `wrangler deploy` vor dem Upload ausführt. Falls ein Deploy scheitert: im Dashboard unter Workers & Pages > dob-one > Deployments > Build-Log prüfen.

## B6: Statistik einschalten (T19, ca. 5 Min., kostenlos)

Der Code für die anonyme Statistik ist live, zählt aber erst, wenn eine D1-Datenbank angebunden ist. Automatisch anlegen beim Deploy geht nicht: der Build-Token von Workers Builds hat standardmäßig kein D1-Recht, ein Versuch würde den Deploy brechen. Solange etwas fehlt, läuft die Website normal weiter, die Zähler verwerfen still und `/stats` zeigt, was fehlt.

**Teil 1: Datenbank anlegen**

1. dash.cloudflare.com öffnen, Account wählen.
2. Links im Menü "Storage & databases" > "D1 SQL database" > Button "Create Database".
3. Name: `dob-one-stats`. Location: "Automatic" lassen (oder "Western Europe"). "Create". Free Plan, keine Kosten.
4. Auf der Seite der neuen Datenbank steht oben die **Database ID** (lange Zeichenkette mit Bindestrichen, z. B. `a1b2c3d4-...`). Kopieren.
5. Die ID in `BACKLOG.md` bei B6 eintragen (oder mir schreiben). Sie ist kein Geheimnis. Den Rest (Eintrag in `wrangler.jsonc`, Tabelle) mache ich.

**Teil 2: Passwort für /stats setzen**

6. Links "Workers & Pages" > Worker `dob-one` anklicken > Reiter "Settings".
7. Abschnitt "Variables and Secrets" > "+ Add".
8. Type: **Secret** (wichtig: nicht "Text", sonst überschreibt der nächste Deploy den Wert). Variable name: `STATS_PASSWORD`. Value: ein langes, zufälliges Passwort aus deinem Passwortmanager.
9. "Deploy" klicken. Das Secret bleibt bei allen späteren Deploys aus GitHub erhalten.

**Teil 3: Öffnen**

10. Sobald ich die Datenbank eingetragen habe (nächster Lauf nach deinem Eintrag): `https://dob-one.<dein-subdomain>.workers.dev/stats` aufrufen (später `https://kenntlich.eu/stats`).
11. Der Browser fragt nach Benutzername und Passwort: Benutzername beliebig (z. B. `benjamin`), Passwort aus Schritt 8.

Was `/stats` zeigt, solange etwas fehlt:

- Kein Passwort gesetzt: Hinweisseite "Statistik noch nicht eingerichtet" mit Stand von Passwort und Datenbank. Keine Zahlen.
- Passwort gesetzt, Datenbank fehlt: nach der Anmeldung Hinweis "Datenbank: fehlt".
- Datenbank zeitweise nicht erreichbar: Hinweis "Datenbank nicht erreichbar", kein Fehler 500.
- Nach 10 falschen Passwörtern in 10 Minuten: kurze Sperre.

Falls der Deploy nach dem Eintragen der Datenbank mit einem D1-Berechtigungsfehler scheitert (die Live-Seite bleibt dann auf dem alten Stand): My Profile > API Tokens > Token für Workers Builds bearbeiten > Berechtigung "Account > D1 > Edit" ergänzen > speichern, dann unter Workers & Pages > dob-one > Deployments den letzten Build neu starten.
