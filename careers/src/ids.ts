export async function jobId(job: { url?: string; title?: string; company?: string; location?: string }): Promise<string> {
  const basis = (job.url || `${job.title || ''}|${job.company || ''}|${job.location || ''}`).toLowerCase();
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(basis));
  return [...new Uint8Array(buf)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function atsDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function classifyAts(domain: string): string {
  const d = domain.toLowerCase();
  if (d.includes('greenhouse')) return 'greenhouse';
  if (d.includes('lever.co')) return 'lever';
  if (d.includes('ashbyhq') || d.includes('ashby')) return 'ashby';
  if (d.includes('myworkday') || d.includes('workday')) return 'workday';
  if (d.includes('indeed')) return 'indeed';
  if (d.includes('linkedin')) return 'linkedin';
  if (d.includes('smartrecruiters')) return 'smartrecruiters';
  return 'company';
}
