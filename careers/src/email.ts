import type { Profile } from './profile.ts';

export type HotJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  score: number;
  method: string;
  url: string;
};

export function digestHtml(profile: Profile, jobs: HotJob[], origin: string): string {
  const rows = jobs
    .map((j) => {
      const badge = j.method === 'needs_you' || j.method === 'unknown' ? 'HELP' : 'READY';
      const apply = `${origin}/apply/${j.id}`;
      return `<li><strong>[${badge}]</strong> ${esc(j.title)} @ ${esc(j.company || '?')} — ${esc(j.location || '')} (${j.score})<br/>
      <a href="${apply}">${apply}</a></li>`;
    })
    .join('\n');
  return `<p>${esc(profile.name)}, ${jobs.length} hot ops. READY = agent can try. HELP = captcha/login — open in order on VNC / Browser Live View.</p>
<ol>${rows}</ol>
<p><a href="${origin}/">Open board</a></p>`;
}

export function digestText(profile: Profile, jobs: HotJob[], origin: string): string {
  const lines = jobs.map((j) => {
    const badge = j.method === 'needs_you' || j.method === 'unknown' ? 'HELP' : 'READY';
    return `[${badge}] ${j.title} @ ${j.company} (${j.score}) ${origin}/apply/${j.id}`;
  });
  return `${profile.name} — ${jobs.length} hot ops\n\n${lines.join('\n')}\n\n${origin}/`;
}

function esc(s: string) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

export function classifyInbound(subject: string, text: string): { status?: string; kind: string } {
  const blob = `${subject} ${text}`.toLowerCase();
  if (/interview|schedule a call|speak with/.test(blob)) return { status: 'interview', kind: 'inbound-interview' };
  if (/offer of employment|we are pleased to offer/.test(blob)) return { status: 'offer', kind: 'inbound-offer' };
  if (/unfortunately|not moving forward|other candidates/.test(blob)) return { status: 'rejected', kind: 'inbound-reject' };
  if (/application (was )?received|thank you for applying|we have received your/.test(blob)) {
    return { status: 'applied', kind: 'inbound-received' };
  }
  return { kind: 'inbound-other' };
}
