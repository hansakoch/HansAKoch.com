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
  let headerLocation = '';

  if (loc.includes('california') || loc.includes('san francisco') || loc.includes('los angeles') || loc.includes('san luis') || loc.includes('santa clara') || loc.includes('bay area') || loc.includes('west coast')) {
    locationContext = 'Based in San Luis Obispo, California. Available immediately.';
    headerLocation = 'San Luis Obispo, CA';
  } else if (loc.includes('michigan') || loc.includes('detroit') || loc.includes('wayne') || loc.includes('ann arbor') || loc.includes('midwest') || loc.includes('east coast') || loc.includes('chicago')) {
    locationContext = 'Based in Wayne, Michigan. Available immediately.';
    headerLocation = 'Wayne, MI';
  } else if (loc.includes('remote') && (loc.includes('anywhere') || loc.includes('worldwide') || loc.includes('global') || loc.includes('international'))) {
    locationContext = 'Based in Cebu, Philippines. Available for any timezone. US citizen.';
    headerLocation = 'Cebu, PH';
  } else if (loc.includes('remote') || loc.includes('anywhere')) {
    // Default US remote — use Michigan
    locationContext = 'Based in Wayne, Michigan. Remote US. Available immediately.';
    headerLocation = 'Wayne, MI';
  } else if (loc.includes('texas') || loc.includes('austin') || loc.includes('dallas') || loc.includes('houston')) {
    locationContext = 'Based in Wayne, Michigan. Open to relocation or remote.';
    headerLocation = 'Wayne, MI';
  } else if (loc.includes('philippines') || loc.includes('cebu') || loc.includes('asia') || loc.includes('singapore') || loc.includes('india') || loc.includes('egypt')) {
    locationContext = 'Based in Cebu, Philippines. Available for any timezone.';
    headerLocation = 'Cebu, PH';
  } else if (loc.includes('uk') || loc.includes('london') || loc.includes('manchester') || loc.includes('united kingdom') || loc.includes('england')) {
    locationContext = 'Based in Manchester, UK. Available immediately.';
    headerLocation = 'Manchester, UK';
  } else if (loc.includes('italy') || loc.includes('milan') || loc.includes('rome') || loc.includes('asti')) {
    locationContext = 'Based in Asti, Italy. Available immediately. EU work authorization.';
    headerLocation = 'Asti, Italy';
  } else {
    // Unknown location — use Michigan as default
    locationContext = 'US-based. Wayne, Michigan. Remote capable.';
    headerLocation = 'Wayne, MI';
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
- NEVER use placeholders like [X], [specific area], [company name], [years]. Use actual data from Hans's background.
- In the resume header, use ONLY this location: ${headerLocation}. Do NOT list all three locations.
- Phone numbers by location: Wayne MI → +1 (313) 355-8675, SLO CA → +1 (415) 683-1016, Manchester UK → +44 7882 517 454, Cebu PH → +1 (313) 355-8675
- Resume must be COMPREHENSIVE (15-20+ lines). Include: Professional Summary, Target Role, Relevant Skills, Experience (3-4 roles with bullet points), Education, Projects.
- Cover letter must be 3-4 paragraphs, tailored to the specific company and role. Reference their values/culture if known.
- NEVER write "NOTES FROM THE JD: See listing" — that's garbage. If you have the job description, reference specific requirements.

HANS'S CAREER TIMELINE (use these EXACTLY, do not combine):
- 27+ years in digital marketing (since 1999)
- 14 years as Director/CMO of Iceberg Media (2012-present)
- Building autonomous AI agents on Cloudflare since January 2025
- Early adopter of OpenClaw (started Jan 2025 at 18.7K stars, now 388K+)

These are SEPARATE facts. Do NOT write "14 years building AI agents since 2025" — that's wrong.

HANS'S BACKGROUND:
${resumeText}

JOB:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'Remote'}
Description: ${desc}
Resume header location: ${headerLocation}
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

/** Template fallback — used when AI is unavailable. */
export function templatePacket(job: { title: string; company: string; description?: string; location?: string }) {
  const title = job.title || 'the role';
  const company = job.company || 'your team';
  const loc = job.location || 'remote';
  const desc = String(job.description || '').slice(0, 1500);

  // Determine location and phone
  const locLower = loc.toLowerCase();
  let address = 'Wayne, MI';
  let phone = '+1 (313) 355-8675';

  if (locLower.includes('california') || locLower.includes('san francisco') || locLower.includes('los angeles') || locLower.includes('santa clara') || locLower.includes('west coast')) {
    address = 'San Luis Obispo, CA';
    phone = '+1 (415) 683-1016';
  } else if (locLower.includes('uk') || locLower.includes('london') || locLower.includes('manchester') || locLower.includes('united kingdom')) {
    address = 'Manchester, UK';
    phone = '+44 7882 517 454';
  } else if (locLower.includes('italy') || locLower.includes('milan') || locLower.includes('rome') || locLower.includes('asti')) {
    address = 'Asti, Italy';
    phone = ''; // Will add when Italian number is set up
  } else if (locLower.includes('remote') && (locLower.includes('anywhere') || locLower.includes('worldwide') || locLower.includes('global'))) {
    address = 'Cebu, Philippines';
    phone = '+1 (313) 355-8675';
  }

  // Extract key requirements from description
  const requirements = [];
  if (/seo/i.test(desc)) requirements.push('SEO');
  if (/aeo|answer engine/i.test(desc)) requirements.push('AEO');
  if (/ppc|paid media|paid search/i.test(desc)) requirements.push('PPC/Paid Media');
  if (/content/i.test(desc)) requirements.push('Content Strategy');
  if (/analytics|ga4|google analytics/i.test(desc)) requirements.push('Analytics');
  if (/ai|artificial intelligence|machine learning/i.test(desc)) requirements.push('AI/ML');
  if (/growth/i.test(desc)) requirements.push('Growth Marketing');
  if (/technical seo/i.test(desc)) requirements.push('Technical SEO');
  if (/local seo/i.test(desc)) requirements.push('Local SEO');
  if (/link building/i.test(desc)) requirements.push('Link Building');
  const reqText = requirements.length > 0 ? requirements.join(', ') : 'Digital Marketing, SEO, Growth';

  return {
    resume_md: `HANS AL KOCH
${address} · hans@hansakoch.com · ${phone}
linkedin.com/in/hansakochcom · github.com/hansakoch

PROFESSIONAL SUMMARY
AI Enablement & Automation Architect with 27+ years building and scaling digital businesses. Director & CMO of Iceberg Media (14 years), managing 145+ domains and 160 Google Business Profiles. Now building autonomous AI agents on Cloudflare-first architecture. Early adopter of OpenClaw (Jan 2025, 18.7K → 388K stars).

TARGET ROLE
${title} — ${company} (${loc})

RELEVANT SKILLS
${reqText}

EXPERIENCE

AI Systems Architect & Founder — OpenRoyleAl.com (Jan 2025 – Present)
• Architected sovereign AI infrastructure using Cloudflare Workers, D1, Durable Objects
• Built multi-node distributed task execution with 6-second average latency
• Managing 63+ API keys and secrets in D1 with secure tool-based access
• Built Alfred — sovereign AI assistant with persistent memory

Agency Director & AI Transition Lead — Iceberg Media (2012 – Present)
• Led strategic pivot from traditional SEO agency to AI services company
• Transitioned pricing from £300/month retainers to £20K–£35K enterprise projects
• Designed Cloudflare-first architecture across 145+ domains
• Managing 160 Google Business Profiles
• Built and managed teams of 10+ across US, UK, Philippines

Head of Digital Strategy — Ajaxx Restoration (2020 – 2024)
• Secured two US water restoration company contracts
• Managed $800–$3,500/month per client budgets
• Remote team leadership across international time zones

EDUCATION
San José State University — Business Administration (2002–2004)
DeVry University — Computer Science (2001–2003)
`,

    cover_md: `Dear ${company} Hiring Team,

I am writing to express my interest in the ${title} position. With 27 years in digital marketing and 14 years as Director and CMO of Iceberg Media, I bring a unique combination of hands-on SEO expertise and modern AI automation capabilities.

At Iceberg Media, I have managed 145+ domains and 160 Google Business Profiles, directing SEO and PPC campaigns for high-value local service sectors across the UK and USA. My team of 10+ spans the US, UK, and Philippines, giving me deep experience in remote collaboration and international operations.

More recently, I have been building autonomous AI agents on Cloudflare infrastructure, creating systems that can research, score, and manage business processes at scale. This is not theoretical work. These agents run 24/7, handling real tasks for real businesses.

What sets me apart is that I do not just talk about SEO and growth. I build the systems that make them happen. I sit in the CMS, the ads account, and the agent logs. I have been doing this since 1999, and I am still shipping.

I would welcome the opportunity to discuss how my experience aligns with your needs.

Hans Al Koch
hans@hansakoch.com · ${phone}
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
