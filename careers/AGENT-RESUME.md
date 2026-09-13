# Open Careers — agent resume map

Read this before writing code. Source of truth is **`origin/main`**, not a stale feature branch.

Reviewed **2026-09-13** from Cursor Cloud agent [HansaKoch Automation](https://cursor.com/agents/bc-d20a2595-f801-46d3-8608-425080f383a4) (owner: Hans Al Koch). This file is the map so the next pass — including from the Cursor iPhone app — can keep pushing until Hans can tap **Approve** then **Submit / open watch** on jobs he actually wants.

## What we are building (tandem)

| Surface | Role | Live |
| --- | --- | --- |
| [hansakoch.com](https://hansakoch.com) | Public brand / CV / resume / cover. Astro → Cloudflare Pages. Interview packet humans see. | 200. Title: **AI Systems Architect \| Director of Agent Optimization**. CV `/cv/`, resume `/resume/`, cover `/cover-letter/` all live. |
| [careers.hansakoch.com](https://careers.hansakoch.com) | Private apply machine. Worker `careers-hansakoch` + D1 `careers-hak`. Password wall. | 200. Title **Open Careers**. **Not** the old 6MB 2191-job bake. |
| [jobspy.hansakoch.com](https://jobspy.hansakoch.com) | Vultr JobSpy webhook front. | `{"ok":true,"service":"jobspy-webhook","ingest":"https://careers.hansakoch.com/api/ingest"}` |

They work **in tandem**: public site is the human-voice packet; careers is the gated hunt + watched apply. They are **not** linked yet (no homepage CTA, no publish-to-public-pages). Do **not** edit live resume/CV copy unless Hans reviews it first.

Hans is tenant #1 of a Cloudflare-installable product (`careers/` folder), not a one-off script.

## Live vs git (do not guess)

Public health (no auth):

```json
{"ok":true,"product":"open-careers","cron":"0 8 * * *","search_webhook":{"configured":true,"host":"jobspy.hansakoch.com","destination":"/api/ingest"},"ingest":{"jobspy":"/api/ingest","rss":"/api/ingest/rss","email":"/api/ingest/email"},"d1":true}
```

That JSON shape exists only on **`origin/main`** (`62b40c8` and later). This repo’s old `alfred.report/open-careers-os-83a4` tip (`4eaac8d`) still returns `{ok, product}` only.

**Conclusion:** Cloudflare is serving the **new Open Careers Worker**, and it is **at or after** the main health rewrite (JobSpy webhook + D1 flag). Unauthenticated `/`, `/apply`, `/onboarding`, `/search` all return the same password wall (~3.3KB). `/api/stats`, `/api/digest`, `/api/atlas` return `401 auth` as designed.

What this review **could not** prove without the password or dashboard login:

- Exact Worker deploy SHA vs `62b40c8`
- How many hot jobs are in D1 right now
- Whether cron `0 8 * * *` has fired a real search
- Whether inbound Email Routing is bound
- Whether `CF_MEMORY_TOKEN` / `ORAL_TOKEN` / `MAIL_WEBHOOK_URL` / Artifacts secrets are set
- Any real Hans or probe submit

**First iPhone check:** open [careers.hansakoch.com](https://careers.hansakoch.com), sign in, screenshot `/` + `/apply` + `/onboarding`. If a sales / RN / intern title is on the board, that is a **P0 eval failure** — stop applying and fix gates.

## Where we start (done)

Merged PRs on `hansakoch/HansAKoch.com`:

1. Brand lock + CF Agent Memory card — PR #1
2. Open Careers OS (gates, D1, apply loop, eval CI) — PR #2
3. Phase 1 (tighter gates, onboarding, email ingest) — PR #3

Then on `main` through `62b40c8`:

- JobSpy webhook path + search feedback
- D1 onboarding 1101 fix
- Joe Logan probe persona + foreign-language Gate 0 + vault path UX
- KISS onboarding + `vultr_vpn` watch steps
- Memory namespace **hermes → `alfred-report`**
- Human-only onboarding + Easy Apply **helper** lane (trusted person may click Easy Apply; not spray-apply)

Eval harness exists: `careers/eval/` + `.github/workflows/careers-eval.yml`. Thresholds ≥95% junk reject, ≥80% keep. Treat a sales leak as CI-breaking.

Apply lanes in code:

| Method | Meaning |
| --- | --- |
| `cf_browser` | Greenhouse / Lever / Ashby after probe — CF Browser Live View |
| `vultr_vpn` | Indeed / CF IP blocked — headed Chromium + hide.me, watch VNC. **Not Omarchy / home IP.** |
| `needs_you` | LinkedIn / Workday / captcha — Hans taps, agent continues |
| `manual_packet` | Video / essay — download docs, human uploads |

Probe persona is **never Hans** (Joe Logan / `joe.logan.probe@example.invalid`). Probe cookies must not mix with the Hans lane.

## Where we are going

iPhone 12 loop (the acceptance test):

1. Open `/apply` on the phone
2. See ≤ ~20 **gated** worldwide jobs (webmaster / Ai / SEO / AEO / PPC / ORM — **not** developer, **not** sales)
3. Tap a job → read packet → **Approve packet**
4. Tap **Submit / open watch** (READY) or sit in HELP until Live View / VNC / captcha is solved
5. Inbound ATS mail updates status
6. Interviews use **human-voice** packets from hansakoch.com — no LLM cadence that would embarrass him

Worldwide search. Salary does not matter. Location prior: remote > PH timezone > Michigan > California > Texas > USA > Asia > Italy > elsewhere.

**Probe first.** Fake persona on ~20 hot ops. Some READY, some HELP. Watch one-after-another. Real Hans apply only after a method is proven. Continual hunt after an offer. Open-repo so others install on their Cloudflare account.

## What is not done (do not claim)

1. **Real Cloudflare Artifacts.** `src/artifacts.ts` is an optional REST PUT stub. `wrangler.toml` has **no** `[[artifacts]]` binding. Official product is Git-compatible repos via `env.ARTIFACTS` ([Workers binding](https://developers.cloudflare.com/artifacts/api/workers-binding/)), closed beta. Default namespace in our stub: `alfred-command`. Until the binding exists, **D1 is source of truth** for resume/cover versions.
2. **Browser Run Live View / recordings** — not proven end-to-end. No `browser` binding in `wrangler.toml`.
3. **Watched submit** — code sets status + shows watch text. It does **not** yet drive CDP/VNC for you.
4. **iPhone 12 apply UX** — buttons are 12px; one-job HELP queue is not designed for a thumb. Password wall is usable. Authenticated flow not verified on a phone in this review.
5. **hansakoch.com ↔ careers tandem** — public site has **no** careers link. Tailored packets do not publish to `/resume` or `/cover-letter`.
6. **Apply-loop skill evals** — job-gate gold exists; submit/packet/slop evals do **not**. See [Phil Schmid — testing skills](https://www.philschmid.de/testing-skills): 10–20 outcome-graded prompts, negative tests, graduate to regression.
7. **Official Cloudflare skills are not installed here.** [github.com/cloudflare/skills](https://github.com/cloudflare/skills) (2026-09-13 catalog) has wrangler, workers-best-practices, agents-sdk, durable-objects, sandbox-*, email, cloudflare-one, web-perf, turnstile — **no first-class Artifacts or Browser Run skill**. Install via Cursor Marketplace / Settings → Rules → Remote Rule (`cloudflare/skills`). Do not vendor a stale copy.
8. **No real Hans apply yet.** Do not spray Easy Apply under Hans’s name.
9. **No video masters / talking-head.**
10. **This Cursor environment** only mounts `github.com/hansakoch/HansAKoch.com`. It does **not** contain Vultr `/projects/HansAKoch.com`, `job-hunt`, `command-os`, or `alfred-report`. Those live on other machines.

## Related surfaces (holistic — not this folder)

### Cursor Cloud (this environment)

- Environment: personal, repos = `HansAKoch.com` only. Dashboard: [environment](https://cursor.com/dashboard/cloud-agents/environments/e/a73965bd-a5b8-11f1-a7d1-d6b4613131ce)
- Build this pod booted from: `bld-20260912-505d8336-799b-4ae8-b02c-f8efb904ed7d`
- Sibling agents on this repo: [Careers Phase 1](https://cursor.com/agents/bc-9ed368d6-2346-4a91-bc51-a96904a586ab) (merged), brand/CFA walkthroughs, this run.

### Omarchy / self-hosted Cursor workers (seen 2026-09-13, idle + eligible)

Machine `openroyleal-960`:

- `~/projects/HansAKoch.com`
- `~/projects/HansAKoch.com/careers`

Use these when you need the **local checkout**, vault paths, or headed browser — not this cloud pod.

### Vultr VPN (not mounted here)

Expected from prior doctrine / JobSpy health:

- `/projects/HansAKoch.com` and related `job-hunt` / pipeline folders
- JobSpy cron → `SEARCH_WEBHOOK_URL` → `jobspy.hansakoch.com` → `/api/ingest`
- Headed Chromium + hide.me + VNC for `vultr_vpn`
- **Never** apply from home IP or Omarchy Chrome for Indeed/LinkedIn USA-from-PH

Old `~/projects/job-hunt/pipeline/` leaked MiMo keys in `score-*.py`. **Rotate, do not copy.**

### Cloudflare account (Iceberg)

- Worker: `careers-hansakoch`
- D1: `careers-hak` id `6410cd87-5313-4761-8226-aa3a635e249d`
- Public brand: Pages on hansakoch.com
- Memory: namespace **`alfred-report`**, profile `careers` (HTTP, **not** `cf-memory` MCP)
- ORAL mission: `careers-loop` — operator is Alfred, not a second brain
- Deploy with Alfred admin token from vault (`~/.vault/cloudflare.env` / `ALFRED_ADMIN_TOKEN`), not an expired `CLOUDFLARE_API_TOKEN`
- Account id referenced in prior notes: Iceberg `0870b0bdbc14bcd31f43fe5e82c3ee8e`

### Other GitHub repos (related, not this PR)

- [hansakoch/cf-memory-plugin](https://github.com/hansakoch/cf-memory-plugin) — Agent Memory HTTP
- [hansakoch/omnigent-cloudflare](https://github.com/hansakoch/omnigent-cloudflare) — CF Containers sandboxes
- [hansakoch/cf-ai-gateway-tracker](https://github.com/hansakoch/cf-ai-gateway-tracker)
- Public site also points at [alfred.report](https://alfred.report)

## iPhone resume — how to keep pushing

**From Cursor iPhone app**

1. Open this agent: https://cursor.com/agents/bc-d20a2595-f801-46d3-8608-425080f383a4  
   or start a **new** agent on `hansakoch/HansAKoch.com` and say: *read `careers/AGENT-RESUME.md` and continue from the next clicks below.*
2. Always: `git fetch origin main && git checkout main && git pull`. Do not resume from `alfred.report/open-careers-os-83a4`.
3. Password is `CAREERS_PASSWORD` (Worker secret). Never hardcode it. Never put it in git or client JS.
4. On the phone Safari: login → `/onboarding` (3 human taps) → `/` hot board → one job → Approve → Submit/watch.

**Next clicks (in order — do not skip)**

1. **Hans (human, 2 min):** login on iPhone; mark onboarding if still true (LinkedIn/Indeed session, Easy Apply helper OK, Wayne MI + Plivo).
2. **Agent + Hans:** confirm D1 has gated jobs (`GET /api/jobs` after cookie). If empty, kick JobSpy (`/search` or wait for 08:00 UTC cron). If the board is junk, fix `eval/gold.json` + `gates.ts` first.
3. **Probe only:** pick one READY ATS (Greenhouse/Lever/Ashby). Probe as Joe Logan. Watch. Do **not** submit as Hans.
4. **HELP lane:** one captcha/LinkedIn job. Prove `needs_you` from the phone.
5. **Then** one real Hans apply on a proven method — after Hans says the packet sounds like him.
6. Add Phil-Schmid-style evals for packet voice + “no sales title on board” so this cannot regress.
7. Only after that: Artifacts binding, Browser Run Live View, iPhone tap-target pass, optional public-site CTA.

## Hard rules (interview-safe)

- Identity: webmaster / Ai / SEO / AEO / PPC / ORM / entrepreneur. Capitalize **Ai**. Not a developer. Not sales.
- If a sales title appears on the board, that is P0.
- Probe cookies / IP never mix with Hans.
- No spray Easy Apply under Hans’s name.
- Do not invent resume facts. Packets must be something he can defend in an interview.
- Do not leak vault tokens or the board password.
- KISS. No second commander. No Farmer/Distiller/Curator for this loop.

## Fingerprint commands (next agent)

```bash
curl -sS https://careers.hansakoch.com/api/health
curl -sS https://jobspy.hansakoch.com/
git fetch origin main && git log -1 --oneline origin/main
cd careers && npm test
```

If live health loses `search_webhook` / `d1`, the Worker was rolled back. If `origin/main` moves past `62b40c8`, update the “Live vs git” section in this file in the same PR that ships the change.
