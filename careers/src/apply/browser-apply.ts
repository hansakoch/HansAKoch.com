/** Browser-based application — fills forms and submits via CF Browser or Browser Use Cloud. */

import { RESUME } from '../resume-data.ts';

export type ApplyResult = {
  success: boolean;
  method: string;
  screenshot?: string;
  error?: string;
  confirmationId?: string;
};

/** Hans's profile data for form filling. */
const PROFILE = {
  firstName: 'Hans',
  lastName: 'Koch',
  fullName: 'Hans Al Koch',
  email: 'hans@hansakoch.com',
  phone: '+13135558675',
  altPhone: '+14156831016',
  location: 'Wayne, MI',
  linkedin: 'https://linkedin.com/in/hansakochcom',
  github: 'https://github.com/hansakoch',
  website: 'https://hansakoch.com',
  summary: RESUME.basics.summary,
};

/** Common form field selectors for ATS platforms. */
const FORM_SELECTORS: Record<string, Record<string, string>> = {
  greenhouse: {
    firstName: 'input[name="job_application[first_name]"], #first_name',
    lastName: 'input[name="job_application[last_name]"], #last_name',
    email: 'input[name="job_application[email]"], #email',
    phone: 'input[name="job_application[phone]"], #phone',
    resume: 'input[type="file"][name*="resume"], input[type="file"][name*="Resume"]',
    coverLetter: 'textarea[name*="cover_letter"], textarea[name*="Cover"]',
    submit: 'input[type="submit"], button[type="submit"]',
  },
  lever: {
    firstName: 'input[name="name"]',
    email: 'input[name="email"]',
    phone: 'input[name="phone"]',
    resume: 'input[type="file"][name="resume"]',
    coverLetter: 'textarea[name="comments"]',
    submit: 'button[data-qa="btn-submit"], button[type="submit"]',
  },
  ashby: {
    firstName: 'input[name="name"], input[aria-label="Full name"]',
    email: 'input[name="email"], input[aria-label="Email"]',
    phone: 'input[name="phone"], input[aria-label="Phone"]',
    resume: 'input[type="file"]',
    submit: 'button[type="submit"]',
  },
  custom: {
    // Generic selectors for custom career pages
    firstName: 'input[name*="first"], input[name*="First"], input[placeholder*="First"]',
    lastName: 'input[name*="last"], input[name*="Last"], input[placeholder*="Last"]',
    email: 'input[type="email"], input[name*="email"], input[placeholder*="email"]',
    phone: 'input[type="tel"], input[name*="phone"], input[placeholder*="phone"]',
    resume: 'input[type="file"]',
    submit: 'button[type="submit"], input[type="submit"]',
  },
};

/** Build a research summary for the cover letter. */
export function buildResearchContext(research: { company_about?: string; company_values?: string; culture_notes?: string } | null): string {
  if (!research) return '';
  const parts: string[] = [];
  if (research.company_about) parts.push(`About: ${research.company_about}`);
  if (research.company_values) parts.push(`Values: ${research.company_values}`);
  if (research.culture_notes) parts.push(`Culture: ${research.culture_notes}`);
  return parts.join('\n');
}

/** Generate answers for custom application questions using AI. */
export async function generateAnswer(
  env: { AI?: Ai },
  question: string,
  jobContext: string,
): Promise<string> {
  if (!env.AI) return '';

  try {
    const response = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
      messages: [
        {
          role: 'system',
          content: `You are helping Hans Al Koch answer job application questions. Be concise, professional, and specific. Hans is an AI Enablement & Automation Architect with 27+ years in digital marketing, 14 years as Director/CMO of Iceberg Media, and builds autonomous AI agents on Cloudflare.`,
        },
        {
          role: 'user',
          content: `Job context: ${jobContext.slice(0, 1000)}\n\nQuestion: ${question}\n\nAnswer in 2-3 sentences:`,
        },
      ],
      max_tokens: 256,
      temperature: 0.5,
    });
    const text = typeof response === 'object' && 'response' in response ? (response as any).response : String(response);
    return text.trim();
  } catch {
    return '';
  }
}

export { PROFILE, FORM_SELECTORS };
