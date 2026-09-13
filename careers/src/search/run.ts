import type { Profile } from '../profile.ts';
import { collectCfJobs, type CfSearchResult } from './cf-feeds.ts';

export type SearchPlan = {
  adapter: 'cf_feeds';
  webhook?: string;
  queries: { term: string; location: string }[];
};

/** Core search is always Cloudflare public feeds. JobSpy webhook is optional bonus. */
export function planSearch(profile: Profile, env: { SEARCH_WEBHOOK_URL?: string; BROWSER?: unknown }): SearchPlan {
  return {
    adapter: 'cf_feeds',
    webhook: env.SEARCH_WEBHOOK_URL || undefined,
    queries: profile.queries,
  };
}

export async function pingOptionalJobspy(webhook?: string): Promise<{ kicked: boolean; detail: string }> {
  if (!webhook) return { kicked: false, detail: 'JobSpy not configured (optional)' };
  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries: [], destination: '/api/ingest', optional: true }),
      signal: AbortSignal.timeout(3000),
    });
    return { kicked: res.ok, detail: `jobspy ${res.status}` };
  } catch {
    return { kicked: false, detail: 'jobspy unreachable (ok — CF feeds still run)' };
  }
}

export async function kickSearch(plan: SearchPlan): Promise<{
  kicked: boolean;
  adapter: string;
  detail: string;
  feeds?: CfSearchResult;
  jobspy?: { kicked: boolean; detail: string };
}> {
  const feeds = await collectCfJobs();
  const jobspy = await pingOptionalJobspy(plan.webhook);
  const detail = `cf_feeds fetched=${feeds.fetched} sources=${JSON.stringify(feeds.sources)}${
    feeds.errors.length ? ` miss=${feeds.errors.join(',')}` : ''
  } · ${jobspy.detail}`;
  return {
    kicked: feeds.fetched > 0,
    adapter: 'cf_feeds',
    detail,
    feeds,
    jobspy,
  };
}
