/** Company research via AI — extracts company info for packet tailoring. */

export type CompanyResearch = {
  job_id: string;
  company_url: string;
  career_page_url: string;
  company_about: string;
  company_values: string;
  team_info: string;
  hiring_manager: string;
  culture_notes: string;
  application_questions: string;
  researched_at: string;
  opportunity_type: string;  // 'job_listing' | 'career_direct'
  opportunity_title: string; // Actual job title or "Career Direct"
  score_rationale: string;   // Why this score
};

/** Try to find the company's main website from a job URL or company name. */
export function guessCompanyUrl(job: { url?: string; company?: string }): string {
  if (job.url) {
    try {
      const u = new URL(job.url);
      const host = u.hostname.toLowerCase();
      if (host.includes('greenhouse') || host.includes('lever') || host.includes('ashby') || host.includes('workday') || host.includes('indeed') || host.includes('linkedin')) {
        return '';
      }
      return `${u.protocol}//${u.hostname}`;
    } catch {}
  }
  return '';
}

/** Common career page paths to probe. */
export const CAREER_PATHS = [
  '/careers', '/jobs', '/join', '/join-us', '/hiring',
  '/work-with-us', '/work-at', '/career', '/employment',
  '/about/careers', '/about/jobs', '/company/careers', '/en/careers',
];

/** Build research prompt for AI. */
export function researchPrompt(job: { title: string; company: string; description?: string; url?: string }): string {
  const desc = (job.description || '').slice(0, 800);
  return `Job: ${job.title} at ${job.company}. ${desc}

Hans: 27yr digital marketing, 14yr CMO Iceberg Media, AI agents since 2025, SEO/AEO/PPC.

JSON: {"company_about":"...","score_rationale":"...","opportunity_title":"...","application_questions":[{"question":"...","answer":"..."}]}`;
}

/** Store research in D1. */
export async function storeResearch(db: D1Database, r: CompanyResearch): Promise<void> {
  await db.prepare(
    `INSERT INTO research (job_id, company_url, career_page_url, company_about, company_values, team_info, hiring_manager, culture_notes, application_questions, opportunity_type, opportunity_title, score_rationale, researched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(job_id) DO UPDATE SET
       company_url=excluded.company_url, career_page_url=excluded.career_page_url,
       company_about=excluded.company_about, company_values=excluded.company_values,
       team_info=excluded.team_info, hiring_manager=excluded.hiring_manager,
       culture_notes=excluded.culture_notes, application_questions=excluded.application_questions,
       opportunity_type=excluded.opportunity_type, opportunity_title=excluded.opportunity_title,
       score_rationale=excluded.score_rationale, researched_at=excluded.researched_at`,
  )
    .bind(r.job_id, r.company_url, r.career_page_url, r.company_about, r.company_values, r.team_info, r.hiring_manager, r.culture_notes, r.application_questions, r.opportunity_type, r.opportunity_title, r.score_rationale, r.researched_at)
    .run();
}

/** Get research from D1. */
export async function getResearch(db: D1Database, jobId: string): Promise<CompanyResearch | null> {
  return db.prepare('SELECT * FROM research WHERE job_id = ?').bind(jobId).first<CompanyResearch>();
}

/** Generate research using Workers AI. Falls back to basic extraction if AI unavailable. */
export async function generateResearch(
  env: { AI?: Ai },
  job: { id: string; title: string; company: string; description?: string; url?: string },
): Promise<CompanyResearch> {
  const now = new Date().toISOString();

  if (env.AI) {
    try {
      const response = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
        messages: [
          { role: 'system', content: 'You are a company research assistant. Return only valid JSON. Use Hans\'s actual data precisely:\n- 27+ years in digital marketing (since 1999)\n- 14 years as Director/CMO of Iceberg Media (2012-present)\n- Building AI agents on Cloudflare since January 2025\n- These are SEPARATE facts. Do NOT combine them into one sentence like "14 years building AI agents since 2025".' },
          { role: 'user', content: researchPrompt(job) },
        ],
        max_tokens: 1024,
        temperature: 0.3,
      });
      const text = typeof response === 'object' && 'response' in response ? (response as any).response : String(response);
      // Extract JSON from potential markdown wrapping
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        job_id: job.id,
        company_url: parsed.company_url || guessCompanyUrl(job),
        career_page_url: parsed.career_page_url || '',
        company_about: parsed.company_about || '',
        company_values: parsed.company_values || '',
        team_info: parsed.team_info || '',
        hiring_manager: parsed.hiring_manager || 'Not found',
        culture_notes: parsed.culture_notes || '',
        application_questions: JSON.stringify(parsed.application_questions || []),
        opportunity_type: parsed.opportunity_type || 'job_listing',
        opportunity_title: parsed.opportunity_title || job.title,
        score_rationale: parsed.score_rationale || '',
        researched_at: now,
      };
    } catch (e: any) {
      console.error('AI research error:', e?.message || String(e));
      // Fall through to template
    }
  }

  const desc = job.description || '';
  return {
    job_id: job.id,
    company_url: guessCompanyUrl(job),
    career_page_url: '',
    company_about: desc.slice(0, 300),
    company_values: '',
    team_info: '',
    hiring_manager: 'Not found',
    culture_notes: '',
    application_questions: '[]',
    opportunity_type: 'job_listing',
    opportunity_title: job.title,
    score_rationale: '',
    researched_at: now,
  };
}
