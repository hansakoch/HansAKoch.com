/** Packet generation — tailored resume + cover letter per job. */

import { RESUME, resumeForPrompt } from './resume-data.ts';
import type { CompanyResearch } from './research.ts';

export type PacketVersion = {
  id?: number;
  job_id: string;
  version: number;
  resume_md: string;
  cover_md: string;
  comments: string;
  created_at: string;
};

/** Build the prompt for packet generation. */
function packetPrompt(
  job: { title: string; company: string; description?: string; location?: string },
  research: CompanyResearch | null,
  comments: string,
  previousVersion?: string,
): string {
  const resumeText = resumeForPrompt();
  const desc = (job.description || '').slice(0, 3000);

  // Determine best location based on job
  const loc = (job.location || '').toLowerCase();
  let locationContext = '';
  if (loc.includes('michigan') || loc.includes('detroit') || loc.includes('wayne') || loc.includes('east coast')) {
    locationContext = 'Based in Wayne, Michigan (East Coast).';
  } else if (loc.includes('california') || loc.includes('san luis') || loc.includes('slo') || loc.includes('west coast') || loc.includes('san francisco')) {
    locationContext = 'Based in San Luis Obispo, California (West Coast).';
  } else if (loc.includes('philippines') || loc.includes('cebu') || loc.includes('remote') || loc.includes('asia') || loc.includes('international')) {
    locationContext = 'Based in Cebu, Philippines (Remote). Available for US hours.';
  } else {
    locationContext = 'US-based with remote capability. Michigan (East Coast), California (West Coast), and Cebu, Philippines.';
  }

  let researchBlock = '';
  if (research) {
    researchBlock = `
COMPANY RESEARCH:
About: ${research.company_about}
Values: ${research.company_values}
Team: ${research.team_info}
Culture: ${research.culture_notes}
Career page: ${research.career_page_url}
`;
  }

  let commentBlock = '';
  if (comments) {
    commentBlock = `
FEEDBACK ON PREVIOUS VERSION:
${comments}
`;
  }

  let previousBlock = '';
  if (previousVersion) {
    previousBlock = `
PREVIOUS VERSION (rewrite this incorporating feedback):
${previousVersion}
`;
  }

  return `You are writing a resume and cover letter for a real person applying to a job. Write like a human, not a machine.

Rules:
- No em dashes. Use commas, periods, or parentheses instead.
- No "vibrant", "tapestry", "pivotal", "crucial", "fostering", "showcasing", "underscore", "testament", "delve".
- No "I'm excited to apply". Start with why you fit.
- No bullet-point laundry lists. Write in connected prose.
- Vary sentence length. Short ones. Longer ones that take their time.
- Sound like someone who has actually done this work for 27 years, not someone describing it.
- Be specific. Name the tools, the numbers, the outcomes.
- If the cover letter is 4 paragraphs, that's fine. If it's 3, also fine. Don't pad.

HANS'S BACKGROUND:
${resumeText}

JOB:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'Remote'}
Description: ${desc}
Hans's Location: ${locationContext}
${researchBlock}${commentBlock}${previousBlock}
Write two documents:

1. RESUME — Tailored for this role. Pull the most relevant experience. Use Hans's actual work history. Clean markdown.

2. COVER LETTER — Addressed to the hiring team. Reference what you know about the company. Be direct about why this person fits. 3-4 paragraphs max. Sound like a real person wrote it at their kitchen table.

Return as JSON:
{
  "resume_md": "...",
  "cover_letter_md": "..."
}

Return ONLY valid JSON.`;
}

/** Generate packet using Workers AI. */
export async function generatePacket(
  env: { AI?: Ai },
  job: { title: string; company: string; description?: string; location?: string },
  research: CompanyResearch | null,
  comments = '',
  previousVersion?: string,
): Promise<{ resume_md: string; cover_md: string }> {
  if (!env.AI) {
    return templatePacket(job);
  }

  try {
    const response = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
      messages: [
        { role: 'system', content: 'You write like a real person, not a machine. No AI patterns. Return only valid JSON.' },
        { role: 'user', content: packetPrompt(job, research, comments, previousVersion) },
      ],
      max_tokens: 4096,
      temperature: 0.8,
    });
    const text = typeof response === 'object' && 'response' in response ? (response as any).response : String(response);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      resume_md: parsed.resume_md || '',
      cover_md: parsed.cover_letter_md || '',
    };
  } catch {
    return templatePacket(job);
  }
}

/** Template fallback. */
export function templatePacket(job: { title: string; company: string; description?: string; location?: string }) {
  const title = job.title || 'the role';
  const company = job.company || 'your team';
  const loc = job.location || 'remote';
  const desc = String(job.description || '').slice(0, 900);

  return {
    resume_md: `HANS AL KOCH
Wayne, MI · Cebu, PH · hans@hansakoch.com
linkedin.com/in/hansakochcom

TARGET: ${title} — ${company} (${loc})

${RESUME.basics.summary}

NOTES FROM THE JD
${desc || 'See listing.'}
`,
    cover_md: `Hi ${company} team,

I'm writing about ${title}. I run websites and growth systems (SEO, AEO, PPC, ORM) and I build autonomous agents to handle the ops work. Been at Iceberg Media since 2012; now running OpenRoyleAl and Alfred.report on Cloudflare.

I don't do sales. I build the machine that finds customers and keeps the sites honest.

If you need someone who can sit in the CMS, the ads account, and the agent logs, that's me.

Hans Al Koch
hans@hansakoch.com · +1 (313) 355-8675
`,
  };
}

/** Store a packet version in D1. */
export async function storePacketVersion(db: D1Database, v: PacketVersion): Promise<void> {
  await db.prepare(
    `INSERT INTO packet_versions (job_id, version, resume_md, cover_md, comments, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(v.job_id, v.version, v.resume_md, v.cover_md, v.comments, v.created_at)
    .run();
}

/** Get all versions for a job. */
export async function getPacketVersions(db: D1Database, jobId: string): Promise<PacketVersion[]> {
  const { results } = await db.prepare('SELECT * FROM packet_versions WHERE job_id = ? ORDER BY version ASC').bind(jobId).all<PacketVersion>();
  return results || [];
}

/** Get the latest version number for a job. */
export async function getLatestVersion(db: D1Database, jobId: string): Promise<number> {
  const row = await db.prepare('SELECT MAX(version) as v FROM packet_versions WHERE job_id = ?').bind(jobId).first<{ v: number }>();
  return row?.v || 0;
}
