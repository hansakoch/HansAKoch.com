import { DEFAULT_PROFILE } from './profile.ts';
import { jobId, atsDomain } from './ids.ts';
import { prepareRow, type IncomingJob } from './search/ingest.ts';
import { planSearch, kickSearch } from './search/run.ts';
import { digestHtml, digestText, classifyInbound, sendDigestMail, type HotJob } from './email.ts';
import { remember, reportOral, standingBrief } from './oral.ts';
import { PROBE_PERSONA, suggestMethod } from './apply/atlas.ts';
import { snapshotPacket } from './artifacts.ts';
import { applyPage, boardPage, layout, loginPage, mePage, onboardingPage, reviewPage, searchPage } from './ui.ts';
import { followUpDraft } from './apply/followup.ts';
import { jobsFromRss } from './search/rss.ts';
import { parseJobFromEmail, EMAIL_ARCHIVE_NOTE } from './search/email-ingest.ts';
import { ONBOARDING_ITEMS, ensureOnboardingRows, getOnboardingState, setOnboardingDone } from './onboarding.ts';
import { generateResearch, storeResearch, getResearch, type CompanyResearch } from './research.ts';
import { generatePacket, templatePacket, storePacketVersion, getPacketVersions, getLatestVersion } from './ai-packet.ts';
import { findCareerPage, detectAtsType } from './career-finder.ts';
import { applyViaBrowser, detectAts } from './apply/browser-apply.ts';
import { getAuthUrl, getAccessToken, getProfile, storeToken, getToken, type LinkedInConfig } from './linkedin.ts';

export interface Env {
  DB: D1Database;
  AI?: Ai;
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
  LINKEDIN_CLIENT_ID?: string;
  LINKEDIN_CLIENT_SECRET?: string;
  LINKEDIN_LI_AT?: string;
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

async function upsertJob(env: Env, job: IncomingJob, opts: { statusOverride?: string; skipResearch?: boolean } = {}) {
  const domain = atsDomain(job.url || '');
  const atlas = domain
    ? await env.DB.prepare('SELECT last_good_method, last_result FROM atlas WHERE domain = ?').bind(domain).first<{ last_good_method: string; last_result: string }>()
    : null;
  const row = await prepareRow(job, atlas, { extraDeny: await extraDeny(env) });

  // Manual entries bypass gate filters
  const isManual = job.source === 'manual';
  let verdict = row.decision.verdict;
  let score = row.decision.score;
  let status = row.status;

  if (isManual && verdict === 'reject') {
    verdict = 'maybe';
    score = Math.max(score, 50);
    status = 'hot';
  }

  if (opts.statusOverride) status = opts.statusOverride;
  else if (job.source === 'email' && verdict !== 'reject') status = 'reviewed';
  const now = new Date().toISOString();

  // Auto-research + auto-generate packet for non-rejected jobs (unless bulk import)
  let resume_md = row.resume_md;
  let cover_md = row.cover_md;
  if (verdict !== 'reject' && !opts.skipResearch) {
    try {
      const research = await generateResearch(env, { id: row.id, ...job });
      if (research.company_url && !research.career_page_url) {
        try { research.career_page_url = await findCareerPage(research.company_url); } catch {}
      }
      await storeResearch(env.DB, research);
      const packet = await generatePacket(env, job, research);
      if (packet.resume_md) resume_md = packet.resume_md;
      if (packet.cover_md) cover_md = packet.cover_md;
      // Store as version 1
      await storePacketVersion(env.DB, {
        job_id: row.id,
        version: 1,
        resume_md,
        cover_md,
        comments: '',
        created_at: now,
      });
    } catch {}
  }

  await env.DB.prepare(
    `INSERT INTO jobs (id,url,title,company,location,source,description,gate0,gate1,loc_label,score,verdict,method,status,resume_md,cover_md,packet_notes,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       title=excluded.title, company=excluded.company, location=excluded.location,
       description=excluded.description, gate0=excluded.gate0, gate1=excluded.gate1,
       loc_label=excluded.loc_label, score=excluded.score, verdict=excluded.verdict,
       method=excluded.method, status=CASE WHEN jobs.status IN ('applied','interview','offer','queued') THEN jobs.status ELSE excluded.status END,
       resume_md=COALESCE(excluded.resume_md, jobs.resume_md),
       cover_md=COALESCE(excluded.cover_md, jobs.cover_md),
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
      score,
      verdict,
      row.method,
      status,
      resume_md,
      cover_md,
      row.packet_notes,
      now,
      now,
    )
    .run();
  return { id: row.id, verdict, status, score };
}

function scheduleForBusinessHours(location: string): string {
  // Determine timezone offset based on location
  const loc = (location || '').toLowerCase();
  let utcOffset = -5; // Default: US Eastern

  if (loc.includes('california') || loc.includes('san francisco') || loc.includes('los angeles') || loc.includes('west coast')) {
    utcOffset = -8; // Pacific
  } else if (loc.includes('michigan') || loc.includes('detroit') || loc.includes('east coast')) {
    utcOffset = -5; // Eastern
  } else if (loc.includes('texas') || loc.includes('chicago')) {
    utcOffset = -6; // Central
  } else if (loc.includes('uk') || loc.includes('london') || loc.includes('manchester')) {
    utcOffset = 0; // GMT
  } else if (loc.includes('singapore') || loc.includes('asia') || loc.includes('philippines') || loc.includes('egypt')) {
    utcOffset = 8; // SGT/PH
  } else if (loc.includes('uae') || loc.includes('dubai')) {
    utcOffset = 4; // GST
  } else if (loc.includes('australia') || loc.includes('sydney')) {
    utcOffset = 11; // AEDT
  } else if (loc.includes('italy') || loc.includes('europe')) {
    utcOffset = 1; // CET
  }

  // Calculate next business hour (9 AM - 4 PM) in target timezone
  const now = new Date();
  const targetHour = 9; // 9 AM local
  const target = new Date(now);

  // Convert to target timezone
  const currentUtcHour = now.getUTCHours();
  const targetUtcHour = (targetHour - utcOffset + 24) % 24;

  // If it's already past 4 PM in target timezone, schedule for next day
  const targetEndUtcHour = (16 - utcOffset + 24) % 24;

  if (currentUtcHour >= targetEndUtcHour || currentUtcHour < targetUtcHour) {
    // Schedule for 9 AM tomorrow in target timezone
    target.setUTCDate(target.getUTCDate() + 1);
  }

  target.setUTCHours(targetUtcHour, Math.floor(Math.random() * 60), 0, 0);
  return target.toISOString();
}

function submitWatch(method: string, env: Env): { watch: string; nextStatus: string } {
  if (method === 'cf_browser') {
    return {
      nextStatus: 'queued',
      watch: 'Applying via company career page.',
    };
  }
  if (method === 'vultr_vpn') {
    return {
      nextStatus: 'queued',
      watch: 'Applying via secure browser.',
    };
  }
  if (method === 'manual_packet') {
    return {
      nextStatus: 'manual_packet',
      watch: 'This role requires manual submission.',
    };
  }
  return { nextStatus: 'queued', watch: 'Applying.' };
}

async function hotJobs(env: Env, limit: number) {
  // Deduplicate: max 2 jobs per company, pick highest scored
  const { results } = await env.DB.prepare(
    `SELECT * FROM jobs WHERE verdict IN ('hot','maybe') AND status NOT IN ('dropped','thumbs_down')
     AND title NOT LIKE 'Research:%' AND title NOT LIKE '%Career Page%'
     ORDER BY company, score DESC`
  ).all();

  const companyCount: Record<string, number> = [];
  const deduped: any[] = [];
  for (const job of results || []) {
    const company = (job.company || 'unknown').toLowerCase();
    companyCount[company] = (companyCount[company] || 0) + 1;
    if (companyCount[company] <= 2) {
      deduped.push(job);
    }
  }
  return deduped.slice(0, limit);
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
    let aiStatus = 'not bound';
    if (env.AI) {
      try {
        const test = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
          messages: [{ role: 'user', content: 'Reply with: ok' }],
          max_tokens: 10,
        });
        aiStatus = typeof test === 'object' && 'response' in test ? 'ok' : 'responded';
      } catch (e: any) {
        aiStatus = `error: ${e?.message || 'unknown'}`;
      }
    }
    return json({
      ok: true,
      product: 'open-careers',
      cron: '0 8 * * *',
      ai: aiStatus,
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
    const skipResearch = body.skip_research === true;
    for (const job of incoming) {
      if (!job?.title) continue;
      const r = await upsertJob(env, job, { skipResearch });
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
      const docs = templatePacket(job);
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
      const docs = job.resume_md ? job : { ...job, ...templatePacket(job) };
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
      const scheduledAt = scheduleForBusinessHours(job.location || '');
      const { watch, nextStatus } = submitWatch(method, env);
      await env.DB.prepare('UPDATE jobs SET status=?, scheduled_at=?, updated_at=? WHERE id=?').bind(nextStatus, scheduledAt, now, id).run();
      await event(env, id, 'submit', `${method} scheduled for ${scheduledAt}`);
      await remember(env, `Apply queued ${job.title} @ ${job.company} via ${method} for ${scheduledAt}`);
      if (wantsHtmlRedirect(request)) {
        return Response.redirect(new URL(`/apply/${id}?submitted=1`, url).toString(), 302);
      }
      return json({ success: true, method, status: nextStatus, scheduledAt, watch, packet: { resume_md: job.resume_md, cover_md: job.cover_md, url: job.url } });
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

  // Add a search query
  if (p === '/api/search/add' && method === 'POST') {
    const body = await readBody(request);
    const term = String(body.term || '').trim();
    const location = String(body.location || 'remote').trim();
    if (!term) return json({ success: false, error: 'term required' }, 400);
    // Store in events for now (profile.yaml is read-only in worker)
    await event(env, null, 'search-add', `${term} | ${location}`);
    return Response.redirect(new URL('/search?added=1', url).toString(), 302);
  }

  // Add a job by URL — scrape the page to find real company and job title
  if (p === '/api/ingest/url' && method === 'POST') {
    const body = await readBody(request);
    const jobUrl = String(body.url || '').trim();
    if (!jobUrl) return json({ success: false, error: 'url required' }, 400);

    let parsed;
    try { parsed = new URL(jobUrl); } catch {
      return json({ success: false, error: 'invalid url' }, 400);
    }

    // Scrape the actual page content
    let pageTitle = '';
    let pageContent = '';
    let company = '';
    let jobTitle = '';

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(jobUrl, {
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      clearTimeout(timer);
      if (res.ok) {
        const html = await res.text();
        // Extract title
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        pageTitle = titleMatch ? titleMatch[1].trim() : '';

        // Strip HTML tags for content
        pageContent = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 5000);

        // Try to extract company name from page content
        // Look for "at Company" pattern in title
        const atCompany = pageTitle.match(/(?:at|@)\s+([^-|]+?)(?:\s*[-|]|\s*$)/i);
        if (atCompany) {
          company = atCompany[1].trim();
        }

        // Look for company in meta tags
        if (!company) {
          const ogSite = html.match(/<meta[^>]*property="og:site_name"[^>]*content="([^"]+)"/i);
          if (ogSite) company = ogSite[1].trim();
        }

        // Look for company in JSON-LD
        if (!company) {
          const jsonLd = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
          if (jsonLd) {
            for (const script of jsonLd) {
              const content = script.replace(/<\/?script[^>]*>/gi, '');
              try {
                const data = JSON.parse(content);
                if (data.hiringOrganization?.name) {
                  company = data.hiringOrganization.name;
                  break;
                }
                if (data.name && data['@type'] === 'JobPosting') {
                  // Use the company from the job posting
                  if (data.hiringOrganization?.name) {
                    company = data.hiringOrganization.name;
                    break;
                  }
                }
              } catch {}
            }
          }
        }

        // Try to extract job title from page content
        // Look for common patterns
        const jobTitlePatterns = [
          /<script[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?"title"\s*:\s*"([^"]+)"/i,
          /<h1[^>]*>([^<]+)<\/h1>/i,
          /<h2[^>]*>([^<]+)<\/h2>/i,
          /class="[^"]*title[^"]*"[^>]*>([^<]+)</i,
          /(?:^|\n)\s*((?:seo|aeo|ppc|growth|marketing|digital|webmaster|director|manager|head|lead|specialist|strategist|architect).{5,60}?)(?:\n|$)/i,
        ];

        for (const pattern of jobTitlePatterns) {
          const match = pageContent.match(pattern) || html.match(pattern);
          if (match) {
            jobTitle = match[1].trim();
            break;
          }
        }

        // If still no company, try to find it in the content
        if (!company) {
          const companyPatterns = [
            /(?:about|company|employer):\s*([A-Z][^.]{2,40})/i,
            /(?:at|@)\s+([A-Z][^.]{2,40})(?:\s+is\s|\s+in\s|\s*$)/i,
            /(?:join|work at|work for)\s+([A-Z][^.]{2,40})/i,
          ];
          for (const pattern of companyPatterns) {
            const match = pageContent.match(pattern);
            if (match) {
              company = match[1].trim();
              break;
            }
          }
        }

        // Fallback: extract from URL path (but not for job-boards.greenhouse.io)
        if (!company && !parsed.hostname.includes('job-boards.')) {
          const pathMatch = parsed.pathname.match(/\/([^/]+)\/jobs?\//);
          if (pathMatch) {
            company = pathMatch[1].replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
          }
        }

        // Fallback: use hostname (but not job-boards.greenhouse.io)
        if (!company) {
          let host = parsed.hostname.replace('www.', '');
          if (host.includes('job-boards.greenhouse.io') || host.includes('boards.greenhouse.io')) {
            // Try to extract company from URL path
            const pathMatch = parsed.pathname.match(/^\/([^/]+)/);
            if (pathMatch) {
              company = pathMatch[1].replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
            } else {
              company = 'Unknown';
            }
          } else {
            host = host.replace('job-boards.', '').replace('boards.', '');
            const parts = host.split('.');
            company = parts[0].replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
          }
        }
      }
    } catch {}

    // Use extracted info or fallback
    const finalTitle = jobTitle || pageTitle || 'Position';
    const finalCompany = company || 'Unknown';

    // Create the job entry
    const result = await upsertJob(env, {
      title: finalTitle,
      company: finalCompany,
      url: jobUrl,
      source: 'manual',
      description: `Company: ${finalCompany}\nTitle: ${finalTitle}\nURL: ${jobUrl}\n\nPage content:\n${pageContent.slice(0, 2000)}`,
    });

    await event(env, result.id, 'manual-add', `${finalTitle} @ ${finalCompany}`);

    if (wantsHtmlRedirect(request)) {
      return Response.redirect(new URL(`/apply/${result.id}`, url).toString(), 302);
    }
    return json({ success: true, title: finalTitle, company: finalCompany, ...result });
  }

  // Review: handle form submission with comments
  if (p === '/api/review/approve' && method === 'POST') {
    const body = await readBody(request);
    const approved = Array.isArray(body.approved) ? body.approved : [body.approved].filter(Boolean);
    const comments: Record<string, string> = {};
    for (const [key, value] of Object.entries(body)) {
      if (key.startsWith('comment_') && value) {
        comments[key.replace('comment_', '')] = String(value);
      }
    }
    await event(env, null, 'review-submit', `approved=${approved.length} comments=${Object.keys(comments).length}`);
    return Response.redirect(new URL('/review?submitted=1', url).toString(), 302);
  }

  // Training questions API
  if (p === '/api/training' && method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT * FROM training_questions ORDER BY CASE WHEN answered_at IS NULL THEN 0 ELSE 1 END, created_at DESC LIMIT 50',
    ).all();
    return json({ success: true, questions: results || [] });
  }

  if (p === '/api/training' && method === 'POST') {
    const body = await readBody(request);
    const question = String(body.question || '').trim();
    const context = String(body.context || '').trim();
    const category = String(body.category || 'research').trim();
    if (!question) return json({ success: false, error: 'question required' }, 400);
    const now = new Date().toISOString();
    await env.DB.prepare(
      'INSERT INTO training_questions (question, context, category, created_at) VALUES (?, ?, ?, ?)',
    ).bind(question, context, category, now).run();
    if (wantsHtmlRedirect(request)) {
      return Response.redirect(new URL('/tasks', url).toString(), 302);
    }
    return json({ success: true });
  }

  const trainingAnswerMatch = p.match(/^\/api\/training\/(\d+)\/answer$/);
  if (trainingAnswerMatch && method === 'POST') {
    const id = Number(trainingAnswerMatch[1]);
    const body = await readBody(request);
    const answer = String(body.answer || '').trim();
    const now = new Date().toISOString();
    await env.DB.prepare(
      'UPDATE training_questions SET answer=?, answered_at=? WHERE id=?',
    ).bind(answer, now, id).run();
    await event(env, null, 'training-answer', `Q${id}: ${answer.slice(0, 100)}`);
    if (wantsHtmlRedirect(request)) {
      return Response.redirect(new URL('/tasks', url).toString(), 302);
    }
    return json({ success: true });
  }

  // System-generated training questions (from research engine)
  if (p === '/api/training/ask' && method === 'POST') {
    const body = await readBody(request);
    const questions = Array.isArray(body.questions) ? body.questions : [];
    const now = new Date().toISOString();
    let added = 0;
    for (const q of questions) {
      const question = String(q.question || '').trim();
      const context = String(q.context || '').trim();
      const category = String(q.category || 'research').trim();
      if (!question) continue;
      // Skip if same question already exists
      const existing = await env.DB.prepare('SELECT id FROM training_questions WHERE question = ?').bind(question).first();
      if (existing) continue;
      await env.DB.prepare(
        'INSERT INTO training_questions (question, context, category, created_at) VALUES (?, ?, ?, ?)',
      ).bind(question, context, category, now).run();
      added += 1;
    }
    return json({ success: true, added });
  }

  // LinkedIn OAuth: start auth flow
  if (p === '/api/linkedin/auth' && method === 'GET') {
    if (!env.LINKEDIN_CLIENT_ID) return json({ success: false, error: 'LinkedIn not configured' }, 500);
    const config: LinkedInConfig = {
      clientId: env.LINKEDIN_CLIENT_ID,
      clientSecret: env.LINKEDIN_CLIENT_SECRET || '',
      redirectUri: `${url.origin}/api/linkedin/callback`,
    };
    const state = crypto.randomUUID();
    const authUrl = getAuthUrl(config, state);
    return Response.redirect(authUrl, 302);
  }

  // LinkedIn OAuth: callback
  if (p === '/api/linkedin/callback' && method === 'GET') {
    const code = url.searchParams.get('code');
    if (!code) return json({ success: false, error: 'no code' }, 400);
    if (!env.LINKEDIN_CLIENT_ID || !env.LINKEDIN_CLIENT_SECRET) return json({ success: false, error: 'LinkedIn not configured' }, 500);

    const config: LinkedInConfig = {
      clientId: env.LINKEDIN_CLIENT_ID,
      clientSecret: env.LINKEDIN_CLIENT_SECRET,
      redirectUri: `${url.origin}/api/linkedin/callback`,
    };

    const tokenResult = await getAccessToken(config, code);
    if (!tokenResult) return json({ success: false, error: 'token exchange failed' }, 400);

    const profile = await getProfile(tokenResult.access_token);
    if (!profile) return json({ success: false, error: 'profile fetch failed' }, 400);

    await storeToken(env.DB, profile, tokenResult.access_token, tokenResult.expires_in);
    await event(env, null, 'linkedin-auth', `Connected: ${profile.firstName} ${profile.lastName}`);

    return Response.redirect(new URL('/me?linkedin=connected', url).toString(), 302);
  }

  // LinkedIn: get company data
  if (p === '/api/linkedin/company' && method === 'GET') {
    const token = await getToken(env.DB);
    if (!token) return json({ success: false, error: 'LinkedIn not connected. Visit /api/linkedin/auth' }, 401);
    return json({ success: true, connected: true, expires_at: token.expires_at });
  }

  // LinkedIn: scrape profile page via Browser Run with session cookie
  if (p === '/api/linkedin/scrape' && method === 'POST') {
    if (!env.BROWSER) return json({ success: false, error: 'Browser Run not bound' }, 500);
    if (!env.LINKEDIN_LI_AT) return json({ success: false, error: 'LinkedIn cookie not configured' }, 500);
    try {
      const puppeteer = await import('@cloudflare/puppeteer');
      const browser = await puppeteer.default.launch(env.BROWSER);
      const page = await browser.newPage();

      // Set LinkedIn session cookie
      await page.setCookie({
        name: 'li_at',
        value: env.LINKEDIN_LI_AT,
        domain: '.linkedin.com',
        path: '/',
        httpOnly: true,
        secure: true,
      });

      await page.goto('https://www.linkedin.com/in/hansakochcom/', { waitUntil: 'networkidle0', timeout: 30000 });

      // Extract profile data from the rendered page
      const profileData = await page.evaluate(() => {
        const getText = (selector: string) => {
          const el = document.querySelector(selector);
          return el?.textContent?.trim() || '';
        };
        const getAllText = (selector: string) => {
          return Array.from(document.querySelectorAll(selector)).map(el => el.textContent?.trim() || '').filter(Boolean);
        };

        return {
          headline: getText('.text-heading-xlarge') || getText('[data-generated-suggestion-target]') || '',
          summary: getText('.inline-show-more-text') || '',
          location: getText('.text-body-small.inline.t-black--light') || '',
          positions: getAllText('.display-flex.align-items-center.mr1.t-bold span[aria-hidden="true"]'),
          companies: getAllText('.t-14.t-normal span[aria-hidden="true"]'),
          education: getAllText('.education__list .t-bold span[aria-hidden="true"]'),
          skills: getAllText('.skill-category-entity__name-text'),
        };
      });

      await browser.close();
      return json({ success: true, profile: profileData });
    } catch (e: any) {
      return json({ success: false, error: e.message });
    }
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
    await ensureOnboardingRows(env.DB);
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
    const researching = await env.DB.prepare("SELECT COUNT(*) as n FROM jobs WHERE status='researching'").first<{ n: number }>();
    const ready = await env.DB.prepare("SELECT COUNT(*) as n FROM jobs WHERE status='ready' AND approved=1").first<{ n: number }>();
    const total = await env.DB.prepare("SELECT COUNT(*) as n FROM jobs WHERE verdict != 'reject' AND status NOT IN ('dropped','thumbs_down')").first<{ n: number }>();
    return json({
      success: true,
      total: total?.n || 0,
      hot: hot?.n || 0,
      help: help?.n || 0,
      researching: researching?.n || 0,
      ready: ready?.n || 0,
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

  // Research: generate company research for a job
  const researchMatch = p.match(/^\/api\/jobs\/([^/]+)\/research$/);
  if (researchMatch && method === 'POST') {
    const id = researchMatch[1];
    const job = await env.DB.prepare('SELECT * FROM jobs WHERE id = ?').bind(id).first<any>();
    if (!job) return json({ success: false, error: 'not found' }, 404);
    const research = await generateResearch(env, job);
    // Also discover career page
    if (research.company_url && !research.career_page_url) {
      try {
        research.career_page_url = await findCareerPage(research.company_url);
      } catch {}
    }
    await storeResearch(env.DB, research);
    await event(env, id, 'research', `company=${research.company_url} career=${research.career_page_url}`);
    if (wantsHtmlRedirect(request)) {
      return Response.redirect(new URL(`/apply/${id}?researched=1`, url).toString(), 302);
    }
    return json({ success: true, research });
  }

  // Rewrite: AI rewrites packet with Hans's comments
  const rewriteMatch = p.match(/^\/api\/jobs\/([^/]+)\/rewrite$/);
  if (rewriteMatch && method === 'POST') {
    const id = rewriteMatch[1];
    const job = await env.DB.prepare('SELECT * FROM jobs WHERE id = ?').bind(id).first<any>();
    if (!job) return json({ success: false, error: 'not found' }, 404);
    const body = await readBody(request);
    const comments = String(body.comments || '');
    const research = await getResearch(env.DB, id);
    const prevVersion = job.resume_md || '';
    const nextVersion = (await getLatestVersion(env.DB, id)) + 1;
    const packet = await generatePacket(env, job, research, comments, prevVersion);
    await storePacketVersion(env.DB, {
      job_id: id,
      version: nextVersion,
      resume_md: packet.resume_md,
      cover_md: packet.cover_md,
      comments,
      created_at: new Date().toISOString(),
    });
    await env.DB.prepare('UPDATE jobs SET resume_md=?, cover_md=?, approved=0, updated_at=? WHERE id=?')
      .bind(packet.resume_md, packet.cover_md, new Date().toISOString(), id)
      .run();
    await event(env, id, 'rewrite', `v${nextVersion} comments=${comments.slice(0, 100)}`);
    if (wantsHtmlRedirect(request)) {
      return Response.redirect(new URL(`/apply/${id}?rewritten=1`, url).toString(), 302);
    }
    return json({ success: true, version: nextVersion, ...packet });
  }

  // Save comments without rewriting
  const commentMatch = p.match(/^\/api\/jobs\/([^/]+)\/comment$/);
  if (commentMatch && method === 'POST') {
    const id = commentMatch[1];
    const body = await readBody(request);
    const comments = String(body.comments || '');
    await event(env, id, 'comment', comments.slice(0, 500));
    return json({ success: true, comments });
  }

  // Get packet version history
  const versionsMatch = p.match(/^\/api\/jobs\/([^/]+)\/versions$/);
  if (versionsMatch && method === 'GET') {
    const id = versionsMatch[1];
    const versions = await getPacketVersions(env.DB, id);
    return json({ success: true, versions });
  }

  // Generate initial AI packet for a job
  const generateMatch = p.match(/^\/api\/jobs\/([^/]+)\/generate$/);
  if (generateMatch && method === 'POST') {
    const id = generateMatch[1];
    const job = await env.DB.prepare('SELECT * FROM jobs WHERE id = ?').bind(id).first<any>();
    if (!job) return json({ success: false, error: 'not found' }, 404);
    const research = await getResearch(env.DB, id);
    const packet = await generatePacket(env, job, research);
    const version = (await getLatestVersion(env.DB, id)) + 1;
    await storePacketVersion(env.DB, {
      job_id: id,
      version,
      resume_md: packet.resume_md,
      cover_md: packet.cover_md,
      comments: '',
      created_at: new Date().toISOString(),
    });
    await env.DB.prepare('UPDATE jobs SET resume_md=?, cover_md=?, updated_at=? WHERE id=?')
      .bind(packet.resume_md, packet.cover_md, new Date().toISOString(), id)
      .run();
    await event(env, id, 'generate', `v${version}`);
    if (wantsHtmlRedirect(request)) {
      return Response.redirect(new URL(`/apply/${id}`, url).toString(), 302);
    }
    return json({ success: true, version, ...packet });
  }

  // Browser apply: navigate to career page and submit application
  const browserApplyMatch = p.match(/^\/api\/jobs\/([^/]+)\/apply$/);
  if (browserApplyMatch && method === 'POST') {
    const id = browserApplyMatch[1];
    const job = await env.DB.prepare('SELECT * FROM jobs WHERE id = ?').bind(id).first<any>();
    if (!job) return json({ success: false, error: 'not found' }, 404);
    if (!job.approved) {
      if (wantsHtmlRedirect(request)) {
        return Response.redirect(new URL(`/apply/${id}?error=approve-first`, url).toString(), 302);
      }
      return json({ success: false, error: 'approve packet first' }, 400);
    }

    const research = await getResearch(env.DB, id);
    const careerUrl = research?.career_page_url || job.url || '';

    if (!careerUrl) {
      return json({ success: false, error: 'No career page URL found. Research the company first.' }, 400);
    }

    // Try Browser Run
    const result = await applyViaBrowser(env, job, careerUrl, job.resume_md || '', job.cover_md || '');

    if (result.success) {
      await env.DB.prepare('UPDATE jobs SET status=?, updated_at=? WHERE id=?').bind('applied', new Date().toISOString(), id).run();
      await event(env, id, 'applied', `Browser Run: ${result.pageTitle}`);
    } else {
      // Fall back to queued
      const scheduledAt = scheduleForBusinessHours(job.location || '');
      await env.DB.prepare('UPDATE jobs SET status=?, scheduled_at=?, updated_at=? WHERE id=?').bind('queued', scheduledAt, new Date().toISOString(), id).run();
      await event(env, id, 'apply-fallback', result.error || 'Browser Run failed, queued for retry');
    }

    if (wantsHtmlRedirect(request)) {
      return Response.redirect(new URL(`/apply/${id}?submitted=1`, url).toString(), 302);
    }
    return json({ success: result.success, method: result.method, error: result.error, pageTitle: result.pageTitle });
  }

  return null;
}

async function handlePage(request: Request, env: Env, url: URL): Promise<Response> {
  if (!authed(request, env)) {
    return new Response(loginPage(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  // Count pending tasks for nav badge
  let pendingTasks = 0;
  try {
    const state = await getOnboardingState(env.DB);
    pendingTasks = ONBOARDING_ITEMS.filter((i) => !state[i.key]).length;
    // Also count unanswered training questions
    const unanswered = await env.DB.prepare("SELECT COUNT(*) as n FROM training_questions WHERE answered_at IS NULL").first<{ n: number }>();
    pendingTasks += unanswered?.n || 0;
  } catch {}
  if (url.pathname === '/search') {
    const status = {
      kicked: url.searchParams.get('kicked') || undefined,
      adapter: url.searchParams.get('adapter') || undefined,
      detail: url.searchParams.get('detail') || undefined,
    };
    return new Response(searchPage(DEFAULT_PROFILE.queries, status, pendingTasks), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  if (url.pathname === '/tasks' || url.pathname === '/onboarding') {
    await ensureOnboardingRows(env.DB);
    const state = await getOnboardingState(env.DB);
    const items = ONBOARDING_ITEMS.map((i) => ({ ...i, done: state[i.key] }));
    const { results: trainingQuestions } = await env.DB.prepare(
      'SELECT * FROM training_questions ORDER BY CASE WHEN answered_at IS NULL THEN 0 ELSE 1 END, created_at DESC LIMIT 50',
    ).all();
    return new Response(onboardingPage(items, trainingQuestions || [], pendingTasks), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  if (url.pathname === '/me') {
    const linkedinToken = await getToken(env.DB);
    const linkedinConnected = !!linkedinToken;
    return new Response(mePage(linkedinConnected), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  if (url.pathname === '/review') {
    const reviewItems = [
      {
        id: 'headline',
        section: 'Headline',
        current: 'Agency Search Director @ Iceberg Media | SEO Credentials',
        proposed: 'AI Systems Architect | Director of Agent Optimization | Building Autonomous Systems on Cloudflare',
        approved: true,
      },
      {
        id: 'summary',
        section: 'Summary',
        current: 'Agency Search Director at Iceberg Media. 11 years experience in SEO/PPC.',
        proposed: 'I build agents that don\'t sleep. 27+ years in digital marketing, 14 years as Director & CMO of Iceberg Media. Now architecting autonomous AI systems on Cloudflare infrastructure that run 24/7 across distributed nodes. Early on OpenClaw (Jan 2025 at 18.7K stars, now 388K+). Organizer of OpenClaw Cebu community. Managing 145+ domains, 160 Google Business Profiles, and autonomous agents that research, score, and execute business operations without human intervention. I don\'t sell. I build the machine.',
        approved: true,
      },
      {
        id: 'skills',
        section: 'Skills',
        current: 'GHL, Go HighLevel, SEO (3 skills)',
        proposed: 'Cloudflare Workers, D1, Durable Objects, TypeScript, Python, AI Agents, Autonomous Systems, SEO, AEO, GEO, PPC, ORM, Google Analytics, Google Ads, OpenClaw, Prompt Engineering, LLM Orchestration, GitHub Actions, Team Leadership, Strategic Planning (20+ skills)',
        approved: true,
      },
      {
        id: 'openroyleal',
        section: 'New Role: OpenRoyleAl (Jan 2025 – Present)',
        current: '(not on LinkedIn)',
        proposed: 'AI Systems Architect & Founder\n• Sovereign AI infrastructure on Cloudflare: Workers AI, Agents SDK, AI Gateway, Browser Run\n• Multi-node distributed task orchestration across edge and origin\n• Built Alfred — autonomous AI assistant with persistent memory and voice\n• Built Alfred.report — AI-powered signal processing and growth engine\n• Created ThanksU.org — review generation platform',
        approved: true,
      },
      {
        id: 'iceberg',
        section: 'Update: Iceberg Media Description',
        current: 'Built and manage Agency brands. SEO4Tradesmen, SEO4Instructors, etc.',
        proposed: 'Leading strategic pivot from 14-year SEO agency to AI services company. Transitioned pricing from £300/month retainers to £20K–£35K enterprise AI agent implementation projects. Cloudflare-first architecture across 145+ domains. Managing 160 Google Business Profiles. Teams of 10+ across US, UK, Philippines.',
        approved: true,
      },
      {
        id: 'speaking',
        section: 'Speaking Engagements',
        current: '(not on LinkedIn)',
        proposed: '12+ speaking engagements including:\n• 2011 — 5th SEMCON — "Searching For Deals: How Group Buying Harnesses Search"\n• 2010 — WordCamp Philippines — "WPPlugins Must-Haves"\n• 2009 — SEMCON — "Business Models for Social Network Sites"\n• 2008 — SEMCON Philippines — "Search Arbitrage"\n• 2008 — WordCamp Philippines — "WordPress for Corporate Web Sites"\n• 2006 — National Defense College of the Philippines — 3-day seminar on Web 2.0, SEO, Ruby on Rails',
        approved: true,
      },
    ];

    return new Response(reviewPage(reviewItems), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  const apply = url.pathname.match(/^\/apply\/([^/]+)$/);
  if (apply) {
    const job = await env.DB.prepare('SELECT * FROM jobs WHERE id = ?').bind(apply[1]).first<any>();
    if (!job || job.verdict === 'reject' || job.status === 'dropped') {
      return new Response(layout('Not found', '<p>Job not on the apply board.</p>'), { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    const research = await getResearch(env.DB, apply[1]);
    const versions = await getPacketVersions(env.DB, apply[1]);
    let flash = '';
    if (url.searchParams.get('submitted') === '1') flash = 'Submit queued — follow watch instructions below.';
    else if (url.searchParams.get('probed') === '1') flash = 'Probe recorded with throwaway persona. Hans cookies not used.';
    else if (url.searchParams.get('error') === 'approve-first') flash = 'Approve the packet before submit.';
    else if (url.searchParams.get('researched') === '1') flash = 'Company research complete. Now generate or rewrite the packet.';
    else if (url.searchParams.get('rewritten') === '1') flash = 'Packet rewritten with your feedback. Review and approve.';
    else if (url.searchParams.get('navigated') === '1') flash = 'Career page loaded via CF Browser. Check Live View to complete submission.';
    return new Response(applyPage(job, followUpDraft(job), flash, research, versions, pendingTasks), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  if (url.pathname === '/apply' || url.pathname === '/') {
    const filter = url.searchParams.get('status') || '';
    const sort = url.searchParams.get('sort') || 'score';
    const sortDir = sort === 'score_low' ? 'ASC' : 'DESC';
    const isApplyPage = url.pathname === '/apply';
    let jobs;

    if (isApplyPage) {
      // Apply page: only show approved jobs ready to submit
      const { results } = await env.DB.prepare(
        `SELECT * FROM jobs WHERE approved=1 AND status NOT IN ('applied','queued','interview','offer','rejected','dropped','thumbs_down')
         ORDER BY score ${sortDir}, updated_at DESC LIMIT ?`,
      ).bind(DEFAULT_PROFILE.hot_limit).all();
      jobs = results || [];
    } else if (filter === 'hot') {
      const { results } = await env.DB.prepare(
        `SELECT * FROM jobs WHERE verdict IN ('hot','maybe') AND status = 'hot' AND approved=0 AND status NOT IN ('dropped','thumbs_down')
         ORDER BY score ${sortDir}, updated_at DESC LIMIT ?`,
      ).bind(DEFAULT_PROFILE.hot_limit).all();
      jobs = results || [];
    } else if (filter === 'ready') {
      const { results } = await env.DB.prepare(
        `SELECT * FROM jobs WHERE approved=1 AND status NOT IN ('applied','queued','interview','offer','rejected','dropped','thumbs_down')
         ORDER BY score ${sortDir}, updated_at DESC LIMIT ?`,
      ).bind(DEFAULT_PROFILE.hot_limit).all();
      jobs = results || [];
    } else if (filter === 'applied') {
      const { results } = await env.DB.prepare(
        `SELECT * FROM jobs WHERE status IN ('applied','queued') ORDER BY updated_at DESC LIMIT ?`,
      ).bind(DEFAULT_PROFILE.hot_limit).all();
      jobs = results || [];
    } else if (filter === 'interview') {
      const { results } = await env.DB.prepare(
        `SELECT * FROM jobs WHERE status='interview' ORDER BY updated_at DESC LIMIT ?`,
      ).bind(DEFAULT_PROFILE.hot_limit).all();
      jobs = results || [];
    } else if (filter === 'offer') {
      const { results } = await env.DB.prepare(
        `SELECT * FROM jobs WHERE status='offer' ORDER BY updated_at DESC LIMIT ?`,
      ).bind(DEFAULT_PROFILE.hot_limit).all();
      jobs = results || [];
    } else {
      // Hot page: all non-applied jobs sorted by score, excluding research/job board entries
      const { results } = await env.DB.prepare(
        `SELECT * FROM jobs WHERE verdict IN ('hot','maybe') AND status NOT IN ('applied','queued','dropped','thumbs_down','rejected')
         AND title NOT LIKE 'Research:%' AND title NOT LIKE '%Career Page%'
         ORDER BY score ${sortDir}, updated_at DESC LIMIT ?`,
      ).bind(DEFAULT_PROFILE.hot_limit).all();
      jobs = results || [];
    }

    // Get pipeline stats
    const stats = {
      total: (await env.DB.prepare("SELECT COUNT(*) as n FROM jobs WHERE verdict != 'reject' AND status NOT IN ('dropped','thumbs_down')").first<{ n: number }>())?.n || 0,
      discovered: (await env.DB.prepare("SELECT COUNT(*) as n FROM jobs WHERE status='hot' AND approved=0").first<{ n: number }>())?.n || 0,
      reviewing: (await env.DB.prepare("SELECT COUNT(*) as n FROM jobs WHERE status='hot' AND approved=0 AND resume_md IS NOT NULL AND resume_md != ''").first<{ n: number }>())?.n || 0,
      approved: (await env.DB.prepare("SELECT COUNT(*) as n FROM jobs WHERE approved=1 AND status NOT IN ('applied','queued','interview','offer','rejected')").first<{ n: number }>())?.n || 0,
      applied: (await env.DB.prepare("SELECT COUNT(*) as n FROM jobs WHERE status IN ('applied','queued')").first<{ n: number }>())?.n || 0,
      confirmed: (await env.DB.prepare("SELECT COUNT(*) as n FROM jobs WHERE status='applied'").first<{ n: number }>())?.n || 0,
      interview: (await env.DB.prepare("SELECT COUNT(*) as n FROM jobs WHERE status='interview'").first<{ n: number }>())?.n || 0,
      offer: (await env.DB.prepare("SELECT COUNT(*) as n FROM jobs WHERE status='offer'").first<{ n: number }>())?.n || 0,
      rejected: (await env.DB.prepare("SELECT COUNT(*) as n FROM jobs WHERE status='rejected'").first<{ n: number }>())?.n || 0,
    };
    return new Response(boardPage(jobs, stats, filter, sort, pendingTasks), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
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
        // Process scheduled applications
        const now = new Date().toISOString();
        const { results: dueJobs } = await env.DB.prepare(
          "SELECT * FROM jobs WHERE status = 'queued' AND scheduled_at IS NOT NULL AND scheduled_at <= ? ORDER BY scheduled_at ASC LIMIT 5"
        ).bind(now).all<any>();

        for (const job of dueJobs || []) {
          try {
            const research = await getResearch(env.DB, job.id);
            const careerUrl = research?.career_page_url || job.url || '';
            if (!careerUrl) {
              await env.DB.prepare("UPDATE jobs SET status='needs_you', updated_at=? WHERE id=?").bind(now, job.id).run();
              continue;
            }

            const result = await applyViaBrowser(env, job, careerUrl, job.resume_md || '', job.cover_md || '');
            if (result.success) {
              await env.DB.prepare("UPDATE jobs SET status='applied', updated_at=? WHERE id=?").bind(now, job.id).run();
              await event(env, job.id, 'applied', `Browser Run: ${result.pageTitle}`);
            } else {
              await env.DB.prepare("UPDATE jobs SET status='needs_you', updated_at=? WHERE id=?").bind(now, job.id).run();
              await event(env, job.id, 'apply-failed', result.error || 'unknown');
            }
          } catch (e: any) {
            await env.DB.prepare("UPDATE jobs SET status='needs_you', updated_at=? WHERE id=?").bind(now, job.id).run();
            await event(env, job.id, 'apply-error', e?.message || 'unknown');
          }
        }

        // Also run search
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
      "SELECT id, company, title, score FROM jobs WHERE status NOT IN ('dropped','thumbs_down') ORDER BY updated_at DESC LIMIT 50",
    ).all<{ id: string; company: string; title: string; score: number }>();
    const blob = `${subject} ${text}`.toLowerCase();
    const match = (results || []).find((j) => {
      const c = (j.company || '').toLowerCase();
      const t = (j.title || '').toLowerCase();
      return (c && blob.includes(c)) || (t && blob.includes(t));
    });
    const now = new Date().toISOString();
    if (match && classified.status) {
      // Confirmation received: boost score and update status
      let newScore = match.score;
      if (classified.status === 'applied' || classified.status === 'received') {
        newScore = Math.min(100, match.score + 10);
        await env.DB.prepare('UPDATE jobs SET status=?, score=?, updated_at=? WHERE id=?')
          .bind('applied', newScore, now, match.id).run();
        await event(env, match.id, 'confirmed', `Application confirmed. Score boosted to ${newScore}`);
      } else {
        await env.DB.prepare('UPDATE jobs SET status=?, score=?, updated_at=? WHERE id=?')
          .bind(classified.status, newScore, now, match.id).run();
      }
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
