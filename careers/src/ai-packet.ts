/** AI-powered packet generation — tailored resume + cover letter per job. */

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

/** Build the AI prompt for packet generation. */
function packetPrompt(
  job: { title: string; company: string; description?: string; location?: string },
  research: CompanyResearch | null,
  comments: string,
  previousVersion?: string,
): string {
  const resumeText = resumeForPrompt();
  const desc = (job.description || '').slice(0, 3000);

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
HANS'S FEEDBACK ON PREVIOUS VERSION:
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

  return `You are a professional resume and cover letter writer. Generate a tailored packet for this job application.

HANS'S RESUME:
${resumeText}

JOB DETAILS:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'Remote'}
Description: ${desc}
${researchBlock}${commentBlock}${previousBlock}
Generate TWO documents:

1. RESUME — Tailored for this specific role. Emphasize the most relevant experience and skills. Use Hans's actual work history and achievements. Format as clean markdown with headers.

2. COVER LETTER — Personalized to this company and role. Reference their values/culture if known. Be specific about why Hans fits. Keep it to 3-4 paragraphs. Professional but human tone.

Return as JSON:
{
  "resume_md": "...",
  "cover_letter_md": "..."
}

Return ONLY valid JSON, no markdown code blocks.`;
}

/** Generate packet using Workers AI. */
export async function generateAiPacket(
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
        { role: 'system', content: 'You are a professional resume writer. Return only valid JSON.' },
        { role: 'user', content: packetPrompt(job, research, comments, previousVersion) },
      ],
      max_tokens: 4096,
      temperature: 0.7,
    });
    const text = typeof response === 'object' && 'response' in response ? (response as any).response : String(response);
    // Extract JSON from potential markdown wrapping
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
    cover_md: `Hi ${company} team —

I'm applying for ${title}. I run websites and growth systems (SEO, AEO, PPC, ORM) and I build Ai agents to do the ops work. Iceberg Media since 2012; OpenRoyleAl / Alfred.report now.

I don't sell. I install the machine that finds customers and keeps the sites honest.

If you want someone who can sit in the CMS, the ads account, and the agent logs, I'm that person.

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
