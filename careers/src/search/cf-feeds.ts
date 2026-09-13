import type { IncomingJob } from './ingest.ts';
import { jobsFromRss } from './rss.ts';

/** Cheap prefilter so public dumps do not burn Worker CPU. Gates still decide the board. */
export const FEED_KEEP =
  /seo|aeo|geo\b|ppc|sem\b|paid media|webmaster|organic search|growth marketing|orm\b|reputation|ai enablement|agent optimization|programmatic seo|search director|search marketing|head of search|head of organic|generative engine/i;

export const CF_FEED_UA = 'OpenCareers/1.0 (+https://careers.hansakoch.com)';

const FEEDS = {
  remoteok: 'https://remoteok.com/api',
  remotive: 'https://remotive.com/api/remote-jobs?search=seo',
  arbeitnow: 'https://www.arbeitnow.com/api/job-board-api',
  wwr: 'https://weworkremotely.com/categories/remote-marketing-and-sales-jobs.rss',
};

export function looksRelevant(title: string, description = '', tags: string[] = []): boolean {
  const blob = `${title} ${description} ${tags.join(' ')}`;
  return FEED_KEEP.test(blob);
}

export function parseRemoteOk(data: unknown): IncomingJob[] {
  if (!Array.isArray(data)) return [];
  const jobs: IncomingJob[] = [];
  for (const row of data) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    if (r.legal) continue;
    const title = String(r.position || r.title || '');
    if (!title) continue;
    const tags = Array.isArray(r.tags) ? r.tags.map(String) : [];
    const description = String(r.description || '');
    if (!looksRelevant(title, description, tags)) continue;
    jobs.push({
      title,
      company: String(r.company || ''),
      location: String(r.location || 'Remote'),
      url: String(r.url || r.apply_url || ''),
      description,
      source: 'cf-remoteok',
    });
  }
  return jobs;
}

export function parseRemotive(data: unknown): IncomingJob[] {
  const jobsIn = data && typeof data === 'object' ? (data as { jobs?: unknown }).jobs : null;
  if (!Array.isArray(jobsIn)) return [];
  const jobs: IncomingJob[] = [];
  for (const row of jobsIn) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const title = String(r.title || '');
    if (!title) continue;
    const description = String(r.description || '');
    if (!looksRelevant(title, description, [String(r.category || '')])) continue;
    jobs.push({
      title,
      company: String(r.company_name || r.company || ''),
      location: String(r.candidate_required_location || 'Remote'),
      url: String(r.url || r.job_type || ''),
      description,
      source: 'cf-remotive',
    });
  }
  return jobs;
}

export function parseArbeitnow(data: unknown): IncomingJob[] {
  const rows = data && typeof data === 'object' ? (data as { data?: unknown }).data : data;
  if (!Array.isArray(rows)) return [];
  const jobs: IncomingJob[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const title = String(r.title || '');
    if (!title) continue;
    const description = String(r.description || '');
    const tags = Array.isArray(r.tags) ? r.tags.map(String) : [];
    if (!looksRelevant(title, description, tags)) continue;
    jobs.push({
      title,
      company: String(r.company_name || r.company || ''),
      location: String(r.location || 'Remote'),
      url: String(r.url || ''),
      description,
      source: 'cf-arbeitnow',
    });
  }
  return jobs;
}

async function getJson(url: string, timeoutMs = 8000): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': CF_FEED_UA },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function getText(url: string, timeoutMs = 8000): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/rss+xml, application/xml, text/xml', 'User-Agent': CF_FEED_UA },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  }
}

export type CfSearchResult = {
  adapter: 'cf_feeds';
  fetched: number;
  sources: Record<string, number>;
  jobs: IncomingJob[];
  errors: string[];
};

/** Public boards only. No Vultr, no Omarchy, no JobSpy. */
export async function collectCfJobs(): Promise<CfSearchResult> {
  const errors: string[] = [];
  const sources: Record<string, number> = {};
  const [remoteok, remotive, arbeitnow, wwr] = await Promise.all([
    getJson(FEEDS.remoteok),
    getJson(FEEDS.remotive),
    getJson(FEEDS.arbeitnow),
    getText(FEEDS.wwr),
  ]);

  const jobs: IncomingJob[] = [];
  if (remoteok) {
    const parsed = parseRemoteOk(remoteok);
    sources.remoteok = parsed.length;
    jobs.push(...parsed);
  } else {
    errors.push('remoteok');
  }
  if (remotive) {
    const parsed = parseRemotive(remotive);
    sources.remotive = parsed.length;
    jobs.push(...parsed);
  } else {
    errors.push('remotive');
  }
  if (arbeitnow) {
    const parsed = parseArbeitnow(arbeitnow);
    sources.arbeitnow = parsed.length;
    jobs.push(...parsed);
  } else {
    errors.push('arbeitnow');
  }
  if (wwr) {
    const parsed = jobsFromRss(wwr, 'cf-wwr').filter((j) => looksRelevant(j.title, j.description));
    sources.wwr = parsed.length;
    jobs.push(...parsed);
  } else {
    errors.push('wwr');
  }

  return { adapter: 'cf_feeds', fetched: jobs.length, sources, jobs: jobs.slice(0, 250), errors };
}
