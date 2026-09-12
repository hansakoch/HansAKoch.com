# Open Careers

Cloudflare-installable job hunt: search → Gate 0/1/2 → hot board → probe ATS → approve packet → watched apply.

Hans tenant: [careers.hansakoch.com](https://careers.hansakoch.com). Anyone else: copy this folder, set `profile.yaml`, create D1, `wrangler deploy`.

## Why gates exist

The old board scored Michigan + marketing keywords as 100. Sales interns and RN managers leaked. **Nothing is visible** until it survives:

0. Title deny/allow (deterministic)
1. Profile fit (sales JD dies; SEO/AEO/PPC/AI/webmaster lives)
2. Location prior (remote > PH TZ > MI > CA > TX > USA > Asia > Italy)

Eval: `npm test` (must stay ≥95% junk reject, ≥80% yes-job keep).

## Install on Cloudflare

```bash
cd careers
npm test
npx wrangler d1 create careers-hak
# put database_id in wrangler.toml
npx wrangler d1 execute careers-hak --remote --file=./schema.sql
npx wrangler secret put CAREERS_PASSWORD
# optional: CF_MEMORY_TOKEN, ORAL_TOKEN, SEARCH_WEBHOOK_URL
npx wrangler deploy
```

Point Email Routing at the Worker for ATS confirmations. Daily 08:00 UTC cron queues search + hot digest.

## Apply lanes

| Method | When |
| --- | --- |
| `cf_browser` | Greenhouse/Lever/Ashby after probe |
| `vultr_vpn` | Indeed / CF IP blocked — headed browser + hide.me, watch VNC |
| `needs_you` | LinkedIn/Workday/captcha — you click, agent continues |
| `manual_packet` | Video or essay — download docs, you upload |

**Probe persona is never Hans.** Probe cookies stay off the Hans lane.

## Vultr JobSpy

POST matches to `/api/ingest`:

```json
{ "password": "…", "jobs": [{ "title": "SEO Director", "company": "X", "url": "https://…", "location": "Remote", "description": "…" }] }
```

Set `SEARCH_WEBHOOK_URL` so cron kicks your JobSpy box.

## ORAL

Standing mission name: `careers-loop`. Memory namespace `hermes` / profile `careers`. See `ORAL.md`.
