# Open Careers

Cloudflare-installable job hunt: search → Gate 0/1/2 → hot board → probe ATS → approve packet → watched apply.

Hans tenant: [careers.hansakoch.com](https://careers.hansakoch.com). Anyone else: copy this folder, set `profile.yaml`, create D1, `wrangler deploy`.

## Why gates exist

The old board scored Michigan + marketing keywords as 100. Sales interns and RN managers leaked. **Nothing is visible** until it survives:

0. Title deny/allow (deterministic) — rejects pure SWE/PM/content/comms unless SEO/search/growth keywords rescue them
1. Profile fit (sales JD dies; SEO/AEO/PPC/AI/webmaster lives)
2. Location prior (remote > PH TZ > MI > CA > TX > USA > Asia > Italy)

Eval: `npm test` (must stay ≥95% junk reject, ≥80% yes-job keep).

Gate 0 also rejects clearly non-English / foreign-only JDs (e.g. Cyrillic-heavy) unless English SEO/AEO allow keywords are present.

## Install on Cloudflare

```bash
cd careers
npm test
cp profile.example.yaml profile.yaml   # edit for your tenant
npx wrangler d1 create careers-hak
# put database_id in wrangler.toml
npx wrangler d1 execute careers-hak --remote --file=./schema.sql
npx wrangler secret put CAREERS_PASSWORD
# optional: CF_MEMORY_TOKEN, ORAL_TOKEN, SEARCH_WEBHOOK_URL, MAIL_WEBHOOK_URL
npx wrangler deploy
```

**Secrets never go in git.** Use `wrangler secret put` for passwords and tokens. Keep `profile.yaml` local (see `.gitignore`).

Point Email Routing at the Worker for ATS confirmations and job-alert forwards. Daily **08:00 UTC** cron queues search + hot digest.

### Onboarding checklist

After deploy, open `/onboarding` and complete:

1. LinkedIn + Indeed logged in (human session on Vultr VNC)
2. 2–3 resume packets in vault paths (SEO/AEO, AI enablement, webmaster)
3. Plivo / Wayne MI address notes from profile
4. USA-from-PH submit lane (Vultr + VPN — not home IP)
5. Probe persona isolated from Hans (Joe Logan throwaway — never Hans cookies)

Progress is stored in D1 (`onboarding` table).

## Apply lanes

| Method | When |
| --- | --- |
| `cf_browser` | Greenhouse/Lever/Ashby after probe |
| `vultr_vpn` | Indeed / CF IP blocked — headed browser + hide.me, watch VNC |
| `needs_you` | LinkedIn/Workday/captcha — you click, agent continues |
| `manual_packet` | Video or essay — download docs, you upload |

**Probe persona is never Hans** (throwaway: **Joe Logan** / `joe.logan.probe@example.invalid`). Probe cookies stay off the Hans lane.

### Phase 1 apply loop (manual watch)

1. Pick a HOT job on `/` → **Open apply**
2. **Probe ATS** (optional) — records throwaway persona; redirects back to apply page
3. **Approve packet** — generates resume_md + cover_md, sets `approved=1`
4. **Submit / open watch** — sets status + shows watch instructions (VNC / Live View / manual packet)

## Vultr JobSpy

POST matches to `/api/ingest`:

```json
{ "password": "…", "jobs": [{ "title": "SEO Director", "company": "X", "url": "https://…", "location": "Remote", "description": "…" }] }
```

Auth: `X-Careers-Password` header, `?password=` query, cookie session, or JSON `password` field.

Set `SEARCH_WEBHOOK_URL` so cron kicks your JobSpy box. On Vultr:

```bash
export CAREERS_INGEST_URL=https://careers.hansakoch.com/api/ingest
export CAREERS_PASSWORD=...
python3 scripts/jobspy-ingest.py
```

Health check: `GET /api/health` reports cron schedule and webhook host.

RSS feeds: `POST /api/ingest/rss` with `{ "xml": "..." }`.

## Email ingest

Forward job-opportunity emails (LinkedIn alerts, recruiter forwards) to your Worker email route (`alfred@` / `hans@` when configured in Cloudflare Email Routing).

The Worker will:

1. **ATS status mail** (applied/interview/offer/reject) → match existing job, update status
2. **New job alert** → parse into ingest with `source=email`, status `reviewed`

Manual API (same auth as ingest):

```bash
curl -X POST https://careers.example.com/api/ingest/email \
  -H "X-Careers-Password: …" \
  -H "Content-Type: application/json" \
  -d '{"subject":"SEO Director at Acme","body":"Apply: https://boards.greenhouse.io/…","from":"jobs@linkedin.com"}'
```

After review on the board, **archive the source email** (e.g. Gmail label `careers/archived`).

Daily digest posts to `MAIL_WEBHOOK_URL` when set (Basin/MailChannels/etc.) and always stores the packet in Agent Memory.

## ORAL

Standing mission name: `careers-loop`. Memory namespace `alfred-report` / profile `careers`. See `ORAL.md`.

## Share this folder

To make the repo public for others:

1. Copy `profile.example.yaml` → `profile.yaml` (local only)
2. Create your own D1 + Worker name in `wrangler.toml`
3. Run eval before deploy: `npm test`
4. Set secrets via dashboard — never commit tokens
