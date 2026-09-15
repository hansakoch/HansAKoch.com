/** Career page discovery — finds company career pages from their website. */

const CAREER_PATHS = [
  '/careers', '/jobs', '/join', '/join-us', '/hiring',
  '/work-with-us', '/work-at', '/career', '/employment',
  '/about/careers', '/about/jobs', '/company/careers',
  '/en/careers', '/en/jobs', '/culture', '/life-at',
];

/** Check if a URL returns a 200 with HTML content. */
async function probeUrl(url: string, timeoutMs = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CareerBot/1.0)' },
    });
    clearTimeout(timer);
    if (!res.ok) return false;
    const ct = res.headers.get('content-type') || '';
    return ct.includes('text/html');
  } catch {
    return false;
  }
}

/** Find career page URL from a company website. */
export async function findCareerPage(companyUrl: string): Promise<string> {
  if (!companyUrl) return '';

  const base = companyUrl.replace(/\/+$/, '');

  // Probe common career paths in parallel
  const probes = CAREER_PATHS.map(async (path) => {
    const url = `${base}${path}`;
    const ok = await probeUrl(url);
    return ok ? url : null;
  });

  const results = await Promise.all(probes);
  const found = results.filter(Boolean) as string[];

  // Prefer /careers, then /jobs, then anything
  const preferred = ['/careers', '/jobs', '/join', '/hiring', '/work-with-us'];
  for (const pref of preferred) {
    const match = found.find((u) => u.endsWith(pref) || u.includes(pref + '/'));
    if (match) return match;
  }

  return found[0] || '';
}

/** Detect ATS type from career page URL. */
export function detectAtsType(url: string): string {
  const host = url.toLowerCase();
  if (host.includes('greenhouse')) return 'greenhouse';
  if (host.includes('lever.co')) return 'lever';
  if (host.includes('ashby')) return 'ashby';
  if (host.includes('workday')) return 'workday';
  if (host.includes('smartrecruiters')) return 'smartrecruiters';
  if (host.includes('icims')) return 'icims';
  if (host.includes('bamboohr')) return 'bamboohr';
  if (host.includes('jobvite')) return 'jobvite';
  return 'custom';
}
