import type { Profile } from '../profile.ts';

export type SearchPlan = {
  adapter: 'vultr_jobspy' | 'cf_browser' | 'manual';
  webhook?: string;
  queries: { term: string; location: string }[];
};

export function planSearch(profile: Profile, env: { SEARCH_WEBHOOK_URL?: string; BROWSER?: unknown }): SearchPlan {
  if (env.SEARCH_WEBHOOK_URL) {
    return { adapter: 'vultr_jobspy', webhook: env.SEARCH_WEBHOOK_URL, queries: profile.queries };
  }
  if (env.BROWSER) {
    return { adapter: 'cf_browser', queries: profile.queries };
  }
  return { adapter: 'manual', queries: profile.queries };
}

export async function kickSearch(plan: SearchPlan): Promise<{ kicked: boolean; adapter: string; detail: string }> {
  if (plan.adapter === 'vultr_jobspy' && plan.webhook) {
    const res = await fetch(plan.webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries: plan.queries, destination: '/api/ingest' }),
    });
    return { kicked: res.ok, adapter: plan.adapter, detail: `webhook ${res.status}` };
  }
  if (plan.adapter === 'cf_browser') {
    return {
      kicked: false,
      adapter: plan.adapter,
      detail: 'Browser Run listed queries; sites that block CF IPs must fall back to Vultr+VPN.',
    };
  }
  return {
    kicked: false,
    adapter: plan.adapter,
    detail: 'Set SEARCH_WEBHOOK_URL (Vultr JobSpy) or a Browser binding. POST jobs to /api/ingest.',
  };
}
