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

Der Code für die anonyme Statistik ist live, zählt aber erst, wenn eine D1-Datenbank angebunden ist. Automatisch anlegen beim Deploy geht nicht: der Build-Token von Workers Builds hat standardmäßig kein D1-Recht, ein Versuch würde den Deploy brechen.

1. dash.cloudflare.com > Storage & Databases > D1 SQL Database > "Create Database".
2. Name: `dob-one-stats`, Region: Automatisch (oder Western Europe). "Create". Free Plan, keine Kosten (5 GB, 100.000 Schreibvorgänge pro Tag).
3. Die angezeigte **Database ID** (UUID) kopieren und mir in den Chat oder als Zeile in `BACKLOG.md` bei B6 schreiben. Die ID ist kein Geheimnis.
4. Passwort für `/stats` setzen: Workers & Pages > dob-one > Settings > Variables and Secrets > "Add" > Typ **Secret**, Name `STATS_PASSWORD`, Wert: ein langes Passwort (z. B. aus deinem Passwortmanager). "Deploy". Secrets bleiben bei späteren Deploys erhalten.
5. Ich trage die Datenbank in `wrangler.jsonc` ein. Die Tabelle legt der Worker beim ersten Aufruf selbst an.
6. Danach: `https://<domain>/stats` aufrufen, Benutzername beliebig, Passwort wie in Schritt 4.

Falls der Deploy danach mit einem D1-Berechtigungsfehler scheitert: My Profile > API Tokens > Token "Workers Builds" bearbeiten > Berechtigung "Account > D1 > Edit" ergänzen, Deploy erneut starten.

Ohne Datenbank oder ohne Passwort antwortet `/stats` mit 503 ("noch nicht eingerichtet"), die Zähler-Endpunkte nehmen Daten an und verwerfen sie.
