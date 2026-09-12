import type { IncomingJob } from './ingest.ts';

export function jobsFromRss(xml: string, source = 'rss'): IncomingJob[] {
  const items = xml.split(/<item[\s>]/i).slice(1);
  const jobs: IncomingJob[] = [];
  for (const raw of items) {
    const title = tag(raw, 'title');
    if (!title) continue;
    jobs.push({
      title: decode(title),
      company: decode(tag(raw, 'source') || tag(raw, 'dc:creator') || ''),
      url: decode(tag(raw, 'link') || ''),
      description: decode(tag(raw, 'description') || ''),
      location: '',
      source,
    });
  }
  return jobs;
}

function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
}

function decode(s: string) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}
