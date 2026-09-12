import { DEFAULT_PROFILE } from './profile.ts';
import { jobId, atsDomain } from './ids.ts';
import { prepareRow, type IncomingJob } from './search/ingest.ts';
import { planSearch, kickSearch } from './search/run.ts';
import { digestHtml, digestText, classifyInbound, sendDigestMail, type HotJob } from './email.ts';
import { remember, reportOral, standingBrief } from './oral.ts';
import { PROBE_PERSONA, suggestMethod } from './apply/atlas.ts';
import { fillDocs } from './apply/packet.ts';
import { snapshotPacket } from './artifacts.ts';
import { applyPage, boardPage, layout, loginPage, onboardingPage, searchPage } from './ui.ts';
import { followUpDraft } from './apply/followup.ts';
import { jobsFromRss } from './search/rss.ts';
import { parseJobFromEmail, EMAIL_ARCHIVE_NOTE } from './search/email-ingest.ts';
import { ONBOARDING_ITEMS, ensureOnboardingRows, getOnboardingState, setOnboardingDone } from './onboarding.ts';

export interface Env {
  DB: D1Database;
  CAREERS_PASSWORD?: string;
  SEARCH_WEBHOOK_URL?: string;
  NOTIFY_EMAIL?: string;
  CF_ACCOUNT_ID?: string;
  CF_MEMORY_TOKEN?: string;
  CF_MEMORY_NAMESPACE?: string;
  CF_MEMORY_PROFILE?: string;
  ORAL_URL?: string;
  ORAL_TOKEN?: string;
  CF_ARTIFACTS_TOKEN?: string;
  CF_ARTIFACTS_NAMESPACE?: string;
  BROWSER?: Fetcher;
  ASSETS?: Fetcher;
  MAIL_WEBHOOK_URL?: string;
}

const COOKIE = 'oc_auth';

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function deny() {
  return json({ success: false, error: 'auth' }, 401);
}

function authed(request: Request, env: Env, bodyPassword?: string): boolean {
  const want = env.CAREERS_PASSWORD || '';
  if (!want) return true;
  const cookie = request.headers.get('Cookie') || '';
  if (cookie.includes(`${COOKIE}=1`)) return true;
  const header = request.headers.get('X-Careers-Password') || '';
  if (header === want) return true;
  const url = new URL(request.url);
  if (url.searchParams.get('password') === want) return true;
  if (bodyPassword && bodyPassword === want) return true;
  return false;
}

function wantsHtmlRedirect(request: Request): boolean {
  const ct = request.headers.get('Content-Type') || '';
  const accept = request.headers.get('Accept') || '';
  return ct.includes('form') || accept.includes('text/html');
}

async function readBody(request: Request): Promise<any> {
  const ct = request.headers.get('Content-Type') || '';
  if (ct.includes('application/json')) return request.json();
  if (ct.includes('form')) {
    const fd = await request.formData();
    const o: Record<string, string> = {};
    fd.forEach((v, k) => {
      o[k] = String(v);
    });
    return o;
  }
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function event(env: Env, jobIdValue: string | null, kind: string, detail: string) {
  await env.DB.prepare('INSERT INTO events (job_id, kind, detail, created_at) VALUES (?, ?, ?, ?)')
    .bind(jobIdValue, kind, detail, new Date().toISOString())
    .run();
}

async function extraDeny(env: Env): Promise<string[]> {
  const { results } = await env.DB.prepare('SELECT pattern FROM denylist').all<{ pattern: string }>();
  return (results || []).map((r) => r.pattern).filter(Boolean);
}

async function upsertJob(env: Env, job: IncomingJob, opts: { statusOverride?: string } = {}) {
  const domain = atsDomain(job.url || '');
  const atlas = domain
    ? await env.DB.prepare('SELECT last_good_method, last_result FROM atlas WHERE domain = ?').bind(domain).first<{ last_good_method: string; last_result: string }>()
    : null;
  const row = await prepareRow(job, atlas, { extraDeny: await extraDeny(env) });
  let status = row.status;
  if (opts.statusOverride) status = opts.statusOverride;
  else if (job.source === 'email' && row.decision.verdict !== 'reject') status = 'reviewed';
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO jobs (id,url,title,company,location,source,description,gate0,gate1,loc_label,score,verdict,method,status,resume_md,cover_md,packet_notes,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       title=excluded.title, company=excluded.company, location=excluded.location,
       description=excluded.description, gate0=excluded.gate0, gate1=excluded.gate1,
       loc_label=excluded.loc_label, score=excluded.score, verdict=excluded.verdict,
       method=excluded.method, status=CASE WHEN jobs.status IN ('applied','interview','offer','queued') THEN jobs.status ELSE excluded.status END,
       resume_md=COALESCE(jobs.resume_md, excluded.resume_md),
       cover_md=COALESCE(jobs.cover_md, excluded.cover_md),
       packet_notes=excluded.packet_notes,
       updated_at=excluded.updated_at`,
  )
    .bind(
      row.id,
      job.url || '',
      job.title,
      job.company || '',
      job.location || '',
      job.source || '',
      job.description || '',
      row.decision.gate0,
      row.decision.gate1,
      row.decision.locLabel,
      row.decision.score,
      row.decision.verdict,
      row.method,
      status,
      row.resume_md,
      row.cover_md,
      row.packet_notes,
      now,
      now,
    )
    .run();
  return { id: row.id, verdict: row.decision.verdict, status, score: row.decision.score };
}

function submitWatch(method: string, env: Env): { watch: string; nextStatus: string } {
  if (method === 'needs_you' || method === 'unknown') {
    return {
      nextStatus: 'needs_you',
      watch: 'Open this listing on VNC / Omarchy / Browser Live View. Agent continues after captcha.',
    };
  }
  if (method === 'cf_browser') {
    return {
      nextStatus: 'queued',
      watch: env.BROWSER
        ? 'CF Browser Run session — watch Live View. Hans lane only after probe atlas.'
        : 'CF Browser not bound; falling back to Vultr VNC watch.',
    };
  }
  if (method === 'vultr_vpn') {
    return {
      nextStatus: 'queued',
      watch: 'Vultr + hide.me/VPN headed browser. Watch VNC. Do not use home IP.',
    };
  }
  if (method === 'manual_packet') {
    return {
      nextStatus: 'manual_packet',
      watch: 'Download resume/cover from this page and submit yourself. Agent will parse inbound mail.',
    };
  }
  return { nextStatus: 'queued', watch: 'Watch the apply session and confirm submission.' };
}

async function hotJobs(env: Env, limit: number) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM jobs WHERE verdict IN ('hot','maybe') AND status NOT IN ('dropped','thumbs_down')
     ORDER BY CASE verdict WHEN 'hot' THEN 0 ELSE 1 END, score DESC, updated_at DESC LIMIT ?`,
  )
    .bind(limit)
    .all();
  return results || [];
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response | null> {
  const p = url.pathname;
  const method = request.method;

  if (p === '/api/auth' && method === 'POST') {
    const body = await readBody(request);
    if (env.CAREERS_PASSWORD && body.password !== env.CAREERS_PASSWORD) return deny();
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/',
        'Set-Cookie': `${COOKIE}=1; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`,
      },
    });
  }

  if (p === '/api/health') {
    const webhook = env.SEARCH_WEBHOOK_URL || '';
    let webhookHost = '';
    try {
      webhookHost = webhook ? new URL(webhook).host : '';
    } catch {
      webhookHost = 'invalid-url';
    }
    return json({
      ok: true,
      product: 'open-careers',
      cron: '0 8 * * *',
      search_webhook: {
        configured: !!webhook,
        host: webhookHost || null,
        destination: '/api/ingest',
      },
      ingest: {
        jobspy: '/api/ingest',
        rss: '/api/ingest/rss',
        email: '/api/ingest/email',
      },
      d1: !!env.DB,
    });
  }

  if (p === '/api/ingest' && method === 'POST') {
    const body = await readBody(request);
    if (!authed(request, env, String(body.password || ''))) return deny();
    const incoming: IncomingJob[] = Array.isArray(body.jobs) ? body.jobs : [];
    let kept = 0;
    let dropped = 0;
    const ids: string[] = [];
    for (const job of incoming) {
      if (!job?.title) continue;
      const r = await upsertJob(env, job);
      ids.push(r.id);
      if (r.verdict === 'reject') dropped += 1;
      else kept += 1;
    }
    await event(env, null, 'ingest', `kept=${kept} dropped=${dropped}`);
    return json({ success: true, kept, dropped, ids });
  }

  if (p === '/api/ingest/email' && method === 'POST') {
    const body = await readBody(request);
    if (!authed(request, env, String(body.password || ''))) return deny();
    const subject = String(body.subject || '');
    const text = String(body.body || body.text || '');
    const from = String(body.from || '');
    const parsed = parseJobFromEmail(subject, text, from);
    if (!parsed) return json({ success: false, error: 'not a job email', archive: EMAIL_ARCHIVE_NOTE }, 422);
    const final = await upsertJob(env, parsed);
    await event(env, final.id, 'ingest-email', subject.slice(0, 200));
    return json({
      success: true,
      id: final.id,
      verdict: final.verdict,
      status: final.status,
      archive: EMAIL_ARCHIVE_NOTE,
      job: parsed,
    });
  }

  if (!authed(request, env) && p.startsWith('/api/')) return deny();

  if (p === '/api/ingest/rss' && method === 'POST') {
    const body = await readBody(request);
    const xml = String(body.xml || body.rss || '');
    const incoming = jobsFromRss(xml, body.source || 'rss');
    let kept = 0;
    let dropped = 0;
    for (const job of incoming) {
      const r = await upsertJob(env, job);
      if (r.verdict === 'reject') dropped += 1;
      else kept += 1;
    }
    return json({ success: true, kept, dropped, total: incoming.length });
  }

  if (p === '/api/jobs' && method === 'GET') {
    const jobs = await hotJobs(env, Number(url.searchParams.get('limit') || 20));
    return json({ success: true, jobs });
  }

  const jobMatch = p.match(/^\/api\/jobs\/([^/]+)\/(thumb|probe|approve|submit|prepare)$/);
  if (jobMatch && method === 'POST') {
    const id = jobMatch[1];
    const action = jobMatch[2];
    const job = await env.DB.prepare('SELECT * FROM jobs WHERE id = ?').bind(id).first<any>();
    if (!job) return json({ success: false, error: 'not found' }, 404);
    const now = new Date().toISOString();

    if (action === 'thumb') {
      const pattern = (job.title || '').toLowerCase().slice(0, 80);
      await env.DB.prepare('INSERT OR REPLACE INTO denylist (pattern, reason, created_at) VALUES (?, ?, ?)')
        .bind(pattern, 'thumbs-down', now)
        .run();
      await env.DB.prepare("UPDATE jobs SET status='thumbs_down', updated_at=? WHERE id=?").bind(now, id).run();
      await event(env, id, 'thumbs-down', job.title);
      return Response.redirect(new URL('/', url).toString(), 302);
    }

    if (action === 'prepare') {
      const docs = fillDocs(job);
      await env.DB.prepare('UPDATE jobs SET resume_md=?, cover_md=?, updated_at=? WHERE id=?')
        .bind(docs.resume_md, docs.cover_md, now, id)
        .run();
      return json({ success: true, ...docs });
    }

    if (action === 'probe') {
      const domain = atsDomain(job.url || '');
      const probeId = await jobId({ url: `${job.url}|probe|${now}` });
      let result = 'blocked';
      let method = 'cf_browser';
      let notes = `${PROBE_PERSONA.note} persona=${PROBE_PERSONA.email}`;
      if (env.BROWSER) {
        notes += ' Browser binding present — session must stay on probe profile.';
        result = 'needs_session';
      } else {
        method = 'vultr_vpn';
        notes += ' No CF Browser binding. Probe on Vultr+VPN VNC, not Hans cookies.';
        result = 'queued-vultr';
      }
      await env.DB.prepare(
        'INSERT INTO probes (id, job_id, domain, persona, method, result, notes, created_at) VALUES (?,?,?,?,?,?,?,?)',
      )
        .bind(probeId, id, domain, 'probe', method, result, notes, now)
        .run();
      await env.DB.prepare(
        'INSERT INTO atlas (domain, last_good_method, last_result, notes, updated_at) VALUES (?,?,?,?,?) ON CONFLICT(domain) DO UPDATE SET notes=excluded.notes, updated_at=excluded.updated_at',
      )
        .bind(domain, method, result, notes, now)
        .run();
      await env.DB.prepare('UPDATE jobs SET method=?, status=?, updated_at=? WHERE id=?')
        .bind(suggestMethod(job.url || '', { last_good_method: method, last_result: result }), 'probing', now, id)
        .run();
      await event(env, id, 'probe', notes);
      const payload = {
        success: true,
        persona: PROBE_PERSONA,
        domain,
        method,
        result,
        hansIdentityUsed: false,
      };
      if (wantsHtmlRedirect(request)) {
        return Response.redirect(new URL(`/apply/${id}?probed=1`, url).toString(), 302);
      }
      return json(payload);
    }

    if (action === 'approve') {
      const docs = job.resume_md ? job : { ...job, ...fillDocs(job) };
      await env.DB.prepare('UPDATE jobs SET approved=1, resume_md=?, cover_md=?, status=?, updated_at=? WHERE id=?')
        .bind(docs.resume_md, docs.cover_md, 'ready', now, id)
        .run();
      await snapshotPacket(env, id, { resume_md: docs.resume_md, cover_md: docs.cover_md });
      await event(env, id, 'approve', 'packet approved');
      return Response.redirect(new URL(`/apply/${id}`, url).toString(), 302);
    }

    if (action === 'submit') {
      if (!job.approved) {
        if (wantsHtmlRedirect(request)) {
          return Response.redirect(new URL(`/apply/${id}?error=approve-first`, url).toString(), 302);
        }
        return json({ success: false, error: 'approve packet first' }, 400);
      }
      const method = job.method || 'needs_you';
      const { watch, nextStatus } = submitWatch(method, env);
      await env.DB.prepare('UPDATE jobs SET status=?, updated_at=? WHERE id=?').bind(nextStatus, now, id).run();
      await event(env, id, 'submit', `${method} ${watch}`);
      await remember(env, `Apply queued ${job.title} @ ${job.company} via ${method}`);
      if (wantsHtmlRedirect(request)) {
        return Response.redirect(new URL(`/apply/${id}?submitted=1`, url).toString(), 302);
      }
      return json({ success: true, method, status: nextStatus, watch, packet: { resume_md: job.resume_md, cover_md: job.cover_md, url: job.url } });
    }
  }

  if (p === '/api/search/run' && method === 'POST') {
    const profile = DEFAULT_PROFILE;
    const plan = planSearch(profile, env);
    const kicked = await kickSearch(plan);
    await event(env, null, 'search-run', JSON.stringify(kicked));
    await reportOral(env, `Search queued via ${kicked.adapter}: ${kicked.detail}`);
    if ((request.headers.get('Content-Type') || '').includes('form')) {
      const dest = new URL('/search', url);
      dest.searchParams.set('kicked', kicked.kicked ? '1' : '0');
      dest.searchParams.set('adapter', kicked.adapter || '');
      dest.searchParams.set('detail', kicked.detail || '');
      return Response.redirect(dest.toString(), 302);
    }
    return json({ success: true, plan, kicked });
  }

  if (p === '/api/digest' && method === 'GET') {
    const profile = DEFAULT_PROFILE;
    const jobs = (await hotJobs(env, profile.hot_limit)) as HotJob[];
    const origin = url.origin;
    return json({
      success: true,
      to: env.NOTIFY_EMAIL || profile.notify_email,
      text: digestText(profile, jobs, origin),
      html: digestHtml(profile, jobs, origin),
    });
  }

  if (p === '/api/atlas' && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM atlas ORDER BY updated_at DESC').all();
    return json({ success: true, atlas: results || [] });
  }

  const onboardingMatch = p.match(/^\/api\/onboarding(?:\/([^/]+))?$/);
  if (onboardingMatch && method === 'GET' && !onboardingMatch[1]) {
    await ensureOnboardingRows(env);
    const state = await getOnboardingState(env.DB);
    return json({ success: true, items: ONBOARDING_ITEMS.map((i) => ({ ...i, done: state[i.key] })) });
  }
  if (onboardingMatch?.[1] && method === 'POST') {
    const body = await readBody(request);
    const done = String(body.done ?? '1') === '1';
    const ok = await setOnboardingDone(env.DB, onboardingMatch[1], done);
    if (!ok) return json({ success: false, error: 'unknown key' }, 404);
    if (wantsHtmlRedirect(request)) {
      return Response.redirect(new URL('/onboarding', url).toString(), 302);
    }
    return json({ success: true, key: onboardingMatch[1], done });
  }

  if (p === '/api/stats' && method === 'GET') {
    const hot = await env.DB.prepare("SELECT COUNT(*) as n FROM jobs WHERE verdict='hot' AND status NOT IN ('dropped','thumbs_down')").first<{ n: number }>();
    const help = await env.DB.prepare("SELECT COUNT(*) as n FROM jobs WHERE method IN ('needs_you','unknown') AND verdict!='reject' AND status NOT IN ('dropped','thumbs_down')").first<{ n: number }>();
    const interview = await env.DB.prepare("SELECT COUNT(*) as n FROM jobs WHERE status='interview'").first<{ n: number }>();
    const applied = await env.DB.prepare("SELECT COUNT(*) as n FROM jobs WHERE status IN ('applied','queued')").first<{ n: number }>();
    return json({
      success: true,
      hot: hot?.n || 0,
      help: help?.n || 0,
      interview: interview?.n || 0,
      applied: applied?.n || 0,
      brief: standingBrief({
        hot: hot?.n || 0,
        help: help?.n || 0,
        interview: interview?.n || 0,
        applied: applied?.n || 0,
      }),
    });
  }

  return null;
}

async function handlePage(request: Request, env: Env, url: URL): Promise<Response> {
  if (!authed(request, env)) {
    return new Response(loginPage(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  if (url.pathname === '/search') {
    const status = {
      kicked: url.searchParams.get('kicked') || undefined,
      adapter: url.searchParams.get('adapter') || undefined,
      detail: url.searchParams.get('detail') || undefined,
    };
    return new Response(searchPage(DEFAULT_PROFILE.queries, status), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  if (url.pathname === '/onboarding') {
    await ensureOnboardingRows(env);
    const state = await getOnboardingState(env.DB);
    const items = ONBOARDING_ITEMS.map((i) => ({ ...i, done: state[i.key] }));
    return new Response(onboardingPage(items), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  if (url.pathname === '/onboarding') {
    await ensureOnboardingRows(env);
    const state = await getOnboardingState(env.DB);
    const items = ONBOARDING_ITEMS.map((i) => ({ ...i, done: state[i.key] }));
    return new Response(onboardingPage(items), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  const apply = url.pathname.match(/^\/apply\/([^/]+)$/);
  if (apply) {
    const job = await env.DB.prepare('SELECT * FROM jobs WHERE id = ?').bind(apply[1]).first<any>();
    if (!job || job.verdict === 'reject' || job.status === 'dropped') {
      return new Response(layout('Not found', '<p>Job not on the apply board.</p>'), { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    let flash = '';
    if (url.searchParams.get('submitted') === '1') flash = 'Submit queued — follow watch instructions below.';
    else if (url.searchParams.get('probed') === '1') flash = 'Probe recorded with throwaway persona. Hans cookies not used.';
    else if (url.searchParams.get('error') === 'approve-first') flash = 'Approve the packet before submit.';
    return new Response(applyPage(job, followUpDraft(job), flash), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  if (url.pathname === '/apply' || url.pathname === '/') {
    const jobs = await hotJobs(env, DEFAULT_PROFILE.hot_limit);
    return new Response(boardPage(jobs), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  return new Response('Not found', { status: 404 });
}

async function sendDigest(env: Env, origin: string) {
  const profile = DEFAULT_PROFILE;
  const jobs = (await hotJobs(env, profile.hot_limit)) as HotJob[];
  const text = digestText(profile, jobs, origin);
  const html = digestHtml(profile, jobs, origin);
  const to = env.NOTIFY_EMAIL || profile.notify_email;
  const mailed = await sendDigestMail(env, { to, subject: `Open Careers — ${jobs.length} hot ops`, text, html });
  await remember(env, text);
  await reportOral(
    env,
    standingBrief({
      hot: jobs.filter((j) => j.method && j.method !== 'needs_you' && j.method !== 'unknown').length,
      help: jobs.filter((j) => j.method === 'needs_you' || j.method === 'unknown').length,
      interview: 0,
      applied: 0,
    }),
  );
  await event(env, null, 'digest', `${jobs.length} jobs sent=${mailed.sent} via=${mailed.via}`);
  return { to, text, count: jobs.length, mailed };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const api = await handleApi(request, env, url);
      if (api) return api;
      return json({ success: false, error: 'not found' }, 404);
    }
    return handlePage(request, env, url);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        const plan = planSearch(DEFAULT_PROFILE, env);
        await kickSearch(plan);
        await sendDigest(env, 'https://careers.hansakoch.com');
      })(),
    );
  },

  async email(message: ForwardableEmailMessage, env: Env) {
    const subject = message.headers.get('subject') || '';
    const from = message.headers.get('from') || '';
    let text = '';
    try {
      text = await new Response(message.raw).text();
    } catch {
      text = '';
    }
    const classified = classifyInbound(subject, text.slice(0, 4000));
    const { results } = await env.DB.prepare(
      "SELECT id, company, title FROM jobs WHERE status NOT IN ('dropped','thumbs_down') ORDER BY updated_at DESC LIMIT 50",
    ).all<{ id: string; company: string; title: string }>();
    const blob = `${subject} ${text}`.toLowerCase();
    const match = (results || []).find((j) => {
      const c = (j.company || '').toLowerCase();
      const t = (j.title || '').toLowerCase();
      return (c && blob.includes(c)) || (t && blob.includes(t));
    });
    const now = new Date().toISOString();
    if (match && classified.status) {
      await env.DB.prepare('UPDATE jobs SET status=?, updated_at=? WHERE id=?').bind(classified.status, now, match.id).run();
    } else if (!match && classified.kind === 'inbound-other') {
      const parsed = parseJobFromEmail(subject, text, from);
      if (parsed) {
        const ingested = await upsertJob(env, parsed);
        await event(env, ingested.id, 'ingest-email-inbound', `${subject.slice(0, 120)} | ${EMAIL_ARCHIVE_NOTE}`);
        await remember(env, `Email job ingested: ${parsed.title} @ ${parsed.company} (${ingested.verdict})`);
      }
    }
    await event(env, match?.id || null, classified.kind, subject.slice(0, 200));
    await remember(env, `Inbound mail: ${subject} → ${classified.kind} ${match?.title || ''}`);
  },
};
