import type { IncomingJob } from './ingest.ts';

const JOB_URL = /https?:\/\/[^\s<>"']+(?:greenhouse|lever|ashby|linkedin|indeed|workday|myworkdayjobs|jobs\.|careers\.)[^\s<>"']*/gi;
const TITLE_PATTERNS = [
  /(?:job|role|position|opening|opportunity)[:\s-]+(.{5,120})/i,
  /(?:hiring|seeking|looking for)[:\s]+(.{5,120})/i,
  /^(.{5,120})\s+(?:at|@)\s+/im,
];

/** Parse a forwarded job-opportunity email into an ingest row. Returns null when not a job mail. */
export function parseJobFromEmail(subject: string, text: string, from = ''): IncomingJob | null {
  const blob = `${subject}\n${text}`.slice(0, 12000);
  const lower = blob.toLowerCase();

  const looksLikeJob =
    /(?:job|role|position|opening|career|hiring|apply|linkedin\.com\/jobs|indeed\.com|greenhouse|lever\.co|ashbyhq)/i.test(blob);
  if (!looksLikeJob) return null;

  let title = '';
  for (const re of TITLE_PATTERNS) {
    const m = blob.match(re);
    if (m?.[1]) {
      title = m[1].replace(/\s+/g, ' ').trim().slice(0, 120);
      break;
    }
  }
  if (!title) {
    const subj = subject.replace(/^(fwd?|re):\s*/gi, '').trim();
    if (subj.length >= 5 && subj.length <= 120) title = subj;
  }
  if (!title) return null;

  const urls = [...blob.matchAll(JOB_URL)].map((m) => m[0].replace(/[.,)]+$/, ''));
  const url = urls[0] || '';

  let company = '';
  const atMatch = blob.match(/(?:at|@)\s+([A-Z][A-Za-z0-9&.\- ]{2,60})/);
  if (atMatch) company = atMatch[1].trim();
  if (!company && from) {
    const domain = from.match(/@([a-z0-9.-]+\.[a-z]{2,})/i)?.[1] || '';
    if (domain && !/(gmail|yahoo|outlook|icloud|proton)/i.test(domain)) {
      company = domain.split('.')[0].replace(/^mail\./, '');
    }
  }

  let location = 'Remote';
  const locMatch = blob.match(/\b(remote|hybrid|on[- ]site|michigan|detroit|wayne|cebu|philippines|usa|united states)\b/i);
  if (locMatch) location = locMatch[0];

  const description = text.slice(0, 4000).trim() || subject;

  return {
    title,
    company,
    location,
    url,
    description,
    source: 'email',
  };
}

export const EMAIL_ARCHIVE_NOTE =
  'After review on the hot board, archive the source email in your mail client (Gmail label: careers/archived).';
