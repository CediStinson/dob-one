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
