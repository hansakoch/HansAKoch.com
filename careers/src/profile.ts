export type SearchQuery = { term: string; location: string };

export type Profile = {
  name: string;
  email: string;
  notify_email: string;
  hot_limit: number;
  queries: SearchQuery[];
  deny_extra: string[];
};

export const DEFAULT_PROFILE: Profile = {
  name: 'Hans Al Koch',
  email: 'hans@hansakoch.com',
  notify_email: 'hans@hansakoch.com',
  hot_limit: 45,
  queries: [
    { term: 'SEO director', location: 'remote' },
    { term: 'SEO director', location: 'Michigan' },
    { term: 'SEO director', location: 'California' },
    { term: 'SEO director', location: 'Texas' },
    { term: 'SEO director', location: 'Singapore' },
    { term: 'SEO director', location: 'Italy' },
    { term: 'AEO', location: 'remote' },
    { term: 'GEO AI search', location: 'remote' },
    { term: 'AI enablement lead', location: 'remote' },
    { term: 'AI enablement', location: 'Michigan' },
    { term: 'PPC director', location: 'remote' },
    { term: 'paid media director', location: 'remote' },
    { term: 'ORM reputation manager', location: 'remote' },
    { term: 'webmaster', location: 'remote' },
    { term: 'webmaster', location: 'Philippines' },
    { term: 'head of organic search', location: 'remote' },
    { term: 'programmatic SEO', location: 'remote' },
    { term: 'growth marketing SEO', location: 'remote' },
    { term: 'AI systems architect', location: 'remote' },
    { term: 'director of agent optimization', location: 'remote' },
    { term: 'crypto SEO', location: 'remote' },
    { term: 'search marketing director', location: 'United Kingdom' },
    { term: 'SEO director', location: 'Asia' },
  ],
  deny_extra: [],
};

export function parseProfileYaml(raw: string): Profile {
  const out: Profile = { ...DEFAULT_PROFILE, queries: [...DEFAULT_PROFILE.queries] };
  const name = raw.match(/^name:\s*(.+)$/m);
  const email = raw.match(/^email:\s*(.+)$/m);
  const notify = raw.match(/^notify_email:\s*(.+)$/m);
  const limit = raw.match(/^hot_limit:\s*(\d+)/m);
  if (name) out.name = name[1].trim();
  if (email) out.email = email[1].trim();
  if (notify) out.notify_email = notify[1].trim();
  if (limit) out.hot_limit = Number(limit[1]);

  const queries: SearchQuery[] = [];
  for (const line of raw.split('\n')) {
    const m = line.match(/term:\s*"([^"]+)"\s*,\s*location:\s*"([^"]+)"/);
    if (m) queries.push({ term: m[1], location: m[2] });
  }
  if (queries.length) out.queries = queries;
  return out;
}
