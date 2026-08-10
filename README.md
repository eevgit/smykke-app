# HosEjbye

Webapp til bestilling af personlige smykker med backend, login og admin-ordreliste.

## Funktioner
- Kunde-flow:
  - Startside med valg mellem lager, design og keramik.
  - Vælg smykketype: armbånd, halskæde eller nøglering.
  - Vælg ønsket længde.
  - Mix perlestørrelser fra 8 mm til 12 mm.
  - Kan ikke overskride valgt længde, men må gerne være kortere.
  - Læg i kurv, bestil mere eller gå til køb.
- Backend:
  - Gemmer ordrer i `data/orders.json`.
  - Login endpoint til admin.
  - Admin endpoint til at hente og opdatere ordrestatus.
- Admin-flow:
  - Login pa `ejer-login.html`.
  - Se alle ordrer.
  - Aabn `faerdige-ordrer.html` for at se arkiverede/faerdige ordrer.
  - Opdater status: `Ny`, `I gang`, `Sendt`, `Faerdig`.

## Struktur
- `server.js`: backend + API + statisk filserver.
- `data/users.json`: admin-brugere.
- `data/orders.json`: aktive ordrer.
- `data/archived_orders.json`: flyttede/arkiverede ordrer.
- `public/index.html`: startside.
- `public/design.html`: kunde-app til eget design.
- `public/lager.html`: smykker + kurv.
- `public/checkout.html`: checkout med kundedata.
- `public/keramik.html`: keramik-side.
- `public/ejer-login.html`: admin-login og ordrevisning.
- `public/faerdige-ordrer.html`: side med faerdige/arkiverede ordrer.
- `public/admin.html`: offentlig side uden login (ikke tilgaengelig).
- `public/*.js`: frontend logik.
- `public/assets/*`: billeder og grafik.

## Krav
- Node.js 18+ installeret.

## Miljøvariabler
Kopiér `.env.example` til `.env` lokalt og udfyld værdier:

```powershell
Copy-Item .env.example .env
```

Vigtigst før produktion:
- `ADMIN_PASSWORD` skal altid sættes til en stærk kode.
- `NODE_ENV=production` på host.
- Login-rate-limit kan justeres med:
  - `LOGIN_MAX_ATTEMPTS`
  - `LOGIN_BLOCK_MINUTES`

## Kør appen
1. Åbn terminal i mappen `smykke-app`.
2. Kør `npm start`.
3. Åbn `http://localhost:3000`.
4. Vælg derefter om du vil se lager, designe dit eget smykke eller se keramik.

## Admin login
- Første opstart opretter automatisk default admin:
  - Brugernavn: `owner`
  - Password: `admin123`
- Du kan ændre default password ved at sætte miljøvariablen `ADMIN_PASSWORD` før første opstart.
- Login-siden for butiksejer er `ejer-login.html`.

## SMS ved ny bestilling (Twilio)
Hvis du vil have en SMS hver gang der kommer en ordre, kan backend sende via Twilio.

Sæt disse miljøvariabler i PowerShell:

```powershell
$env:TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
$env:TWILIO_AUTH_TOKEN="din_auth_token"
$env:TWILIO_FROM="+45xxxxxxxx"
$env:TWILIO_TO="+45xxxxxxxx"
```

Start derefter serveren i samme terminal:

```powershell
node server.js
```

Bemærk:
- `TWILIO_FROM` skal være et gyldigt Twilio-nummer (eller alfanumerisk sender-id hvor tilladt).
- Hvis variablerne ikke er sat, kører appen stadig, men uden SMS.

## Abonnement og drift af hjemmeside
Hvis du vil have et "abonnement" på selve hjemmesiden (domæne + hosting + sikker drift), kan du sætte det op sådan:

1. Domæne
- Køb domæne hos fx Simply, One.com eller Cloudflare Registrar.
- Forvent typisk årlig betaling.

2. Hosting (månedligt abonnement)
- Vælg en Node.js-venlig host, fx Render eller Railway.
- Kobl dit Git-repository til hosten.
- Sæt build/start:
  - Build: `npm ci`
  - Start: `npm start`
- Hvis du bruger Render, ligger der en `render.yaml` klar i projektet.

3. SSL og DNS
- Peg domænet til hosten via DNS (A-record/CNAME).
- Aktivér gratis SSL-certifikat (normalt automatisk hos host).

4. Betalt kundeabonnement (hvis dine kunder skal betale løbende)
- Brug fx Stripe Subscriptions.
- Opret produkter/priser i Stripe.
- Lav webhook-endpoint i backend til at aktivere/deaktivere abonnementstatus.
- Gem abonnementstatus på kunde i database.

5. Drift
- Daglig backup af `data/` (se script nedenfor).
- Overvågning/uptime-alerts.
- Sæt `ADMIN_PASSWORD` og øvrige secrets som miljøvariabler hos host.

## Drift scripts
- `npm run backup:data`
  - Laver backup af alle filer i `data/` til `backups/data-backup-YYYYMMDD-HHMMSS/`.
- `npm run check:health`
  - Tjekker at API svarer på `/api/health` lokalt.

## Go-live tjekliste
1. Sæt stærk `ADMIN_PASSWORD` i hostens miljøvariabler.
2. Sæt `NODE_ENV=production`.
3. Aktivér automatisk deploy fra `main` branch.
4. Konfigurer domæne + SSL.
5. Test login, ordreoprettelse, status-opdatering, auto-arkivering og restore.
6. Sæt fast backup-rutine for `data/`.
