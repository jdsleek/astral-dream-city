# Astral Dream City — BASA 2026

Event site with WhatsApp ordering for the Astral Team. Orders are sent to
WhatsApp number **2349022809119** with a **BASA Order** header.

## Project structure
```
astral-dream-city/
├── public/index.html   # the full site
├── server.js           # tiny static server (binds to Railway's PORT)
├── package.json        # start script + Node engine
├── railway.json        # Railway build/deploy config
└── .gitignore
```

## Run locally
```bash
npm start
# open http://localhost:3000
```

## Deploy to Railway (CLI)
From inside this folder:
```bash
cd astral-dream-city

# 1. log in (skip if already logged in)
railway login

# 2. create a new project (or link an existing one)
railway init

# 3. deploy
railway up

# 4. generate the public URL
railway domain
```

### Setting the basa.up.railway.app domain
Railway domains take the form `<name>.up.railway.app`. To use `basa`:
- Run `railway domain` to generate a domain, **or**
- In the Railway dashboard: open the service → **Settings → Networking →
  Generate Domain**, then edit the subdomain prefix to `basa`.
- If `basa` is already taken globally, try a variant like `basa-2026` or
  `basa-astral`.

## Order emails (Brevo)
When an order is placed, the backend (`POST /api/order`) emails the team via
Brevo, in addition to the WhatsApp message. Configure these Railway variables:

```bash
railway variables --set "BREVO_API_KEY=xkeysib-XXXXXXXX" \
                  --set "BREVO_SENDER=your-verified-sender@example.com"
# optional:
railway variables --set "BREVO_SENDER_NAME=Astral Dream City" \
                  --set "ORDER_RECIPIENTS=jdsleek@gmail.com,adetunji1182@gmail.com"
```
- `BREVO_SENDER` MUST be a sender/domain verified in your Brevo account,
  otherwise Brevo rejects the send.
- If the variables aren't set, the site still works — it just skips the email.
- After setting variables, redeploy with `railway up`.

## Updating the WhatsApp number later
Edit `public/index.html`, line ~508:
```js
const WHATSAPP_NUMBER = '2349022809119';
```
Then re-run `railway up`.
