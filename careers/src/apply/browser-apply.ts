/** Browser Run — automated form filling and submission via Cloudflare Browser. */

export type ApplyResult = {
  success: boolean;
  method: string;
  error?: string;
  pageTitle?: string;
  screenshot?: string;
  formsFound?: number;
};

/** Hans's profile data for form filling. */
const PROFILE = {
  firstName: 'Hans',
  lastName: 'Koch',
  fullName: 'Hans Al Koch',
  email: 'hans@hansakoch.com',
  phone: '+13135558675',
  location: 'Wayne, MI',
  linkedin: 'https://linkedin.com/in/hansakochcom',
  github: 'https://github.com/hansakoch',
  website: 'https://hansakoch.com',
};

/** Common form field selectors for ATS platforms. */
const SELECTORS: Record<string, Record<string, string>> = {
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
  generic: {
    firstName: 'input[name*="first"], input[name*="First"], input[placeholder*="First"]',
    lastName: 'input[name*="last"], input[name*="Last"], input[placeholder*="Last"]',
    email: 'input[type="email"], input[name*="email"], input[placeholder*="email"]',
    phone: 'input[type="tel"], input[name*="phone"], input[placeholder*="phone"]',
    resume: 'input[type="file"]',
    submit: 'button[type="submit"], input[type="submit"]',
  },
};

/** Detect ATS type from URL. */
export function detectAts(url: string): string {
  const host = url.toLowerCase();
  if (host.includes('greenhouse')) return 'greenhouse';
  if (host.includes('lever')) return 'lever';
  if (host.includes('ashby')) return 'ashby';
  if (host.includes('workday')) return 'workday';
  if (host.includes('smartrecruiters')) return 'smartrecruiters';
  if (host.includes('icims')) return 'icims';
  if (host.includes('bamboohr')) return 'bamboohr';
  if (host.includes('jobvite')) return 'jobvite';
  return 'generic';
}

/** Fill form fields on the page. */
async function fillForm(page: any, atsType: string, resumeText: string, coverText: string): Promise<{ filled: string[]; errors: string[] }> {
  const selectors = SELECTORS[atsType] || SELECTORS.generic;
  const filled: string[] = [];
  const errors: string[] = [];

  // Fill name
  try {
    const firstNameInput = await page.$(selectors.firstName);
    if (firstNameInput) {
      await firstNameInput.click({ clickCount: 3 });
      await firstNameInput.type(PROFILE.firstName, { delay: 50 });
      filled.push('firstName');
    }
  } catch (e: any) { errors.push(`firstName: ${e.message}`); }

  // Fill last name (if separate field)
  if (selectors.lastName) {
    try {
      const lastNameInput = await page.$(selectors.lastName);
      if (lastNameInput) {
        await lastNameInput.click({ clickCount: 3 });
        await lastNameInput.type(PROFILE.lastName, { delay: 50 });
        filled.push('lastName');
      }
    } catch (e: any) { errors.push(`lastName: ${e.message}`); }
  }

  // Fill email
  try {
    const emailInput = await page.$(selectors.email);
    if (emailInput) {
      await emailInput.click({ clickCount: 3 });
      await emailInput.type(PROFILE.email, { delay: 50 });
      filled.push('email');
    }
  } catch (e: any) { errors.push(`email: ${e.message}`); }

  // Fill phone
  try {
    const phoneInput = await page.$(selectors.phone);
    if (phoneInput) {
      await phoneInput.click({ clickCount: 3 });
      await phoneInput.type(PROFILE.phone, { delay: 50 });
      filled.push('phone');
    }
  } catch (e: any) { errors.push(`phone: ${e.message}`); }

  // Fill cover letter
  if (selectors.coverLetter) {
    try {
      const coverInput = await page.$(selectors.coverLetter);
      if (coverInput) {
        await coverInput.click({ clickCount: 3 });
        await coverInput.type(coverText.slice(0, 2000), { delay: 10 });
        filled.push('coverLetter');
      }
    } catch (e: any) { errors.push(`coverLetter: ${e.message}`); }
  }

  return { filled, errors };
}

/** Submit the form. */
async function submitForm(page: any, atsType: string): Promise<{ submitted: boolean; error?: string }> {
  const selectors = SELECTORS[atsType] || SELECTORS.generic;
  try {
    const submitBtn = await page.$(selectors.submit);
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
      return { submitted: true };
    }
    return { submitted: false, error: 'No submit button found' };
  } catch (e: any) {
    return { submitted: false, error: e.message };
  }
}

/** Main apply function — navigates to career page, fills form, submits. */
export async function applyViaBrowser(
  env: { BROWSER?: Fetcher },
  job: { id: string; title: string; company: string; url?: string; location?: string },
  careerUrl: string,
  resumeText: string,
  coverText: string,
): Promise<ApplyResult> {
  if (!env.BROWSER) {
    return { success: false, method: 'cf_browser', error: 'Browser Run not bound' };
  }

  try {
    const puppeteer = await import('@cloudflare/puppeteer');
    const browser = await puppeteer.default.launch(env.BROWSER);
    const page = await browser.newPage();

    // Set realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Navigate to career page
    await page.goto(careerUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    const pageTitle = await page.title();

    // Detect ATS type
    const atsType = detectAts(careerUrl);

    // Try to find and click "Apply" button if we're on a career page (not direct application)
    const applyBtn = await page.$('a[href*="apply"], button:has-text("Apply"), a:has-text("Apply Now"), a:has-text("Apply")');
    if (applyBtn) {
      await applyBtn.click();
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
    }

    // Fill the form
    const { filled, errors } = await fillForm(page, atsType, resumeText, coverText);

    // Submit
    const { submitted, error: submitError } = await submitForm(page, atsType);

    // Get confirmation page
    const confirmTitle = await page.title();
    const confirmUrl = page.url();

    await browser.close();

    return {
      success: submitted && filled.length > 0,
      method: 'cf_browser',
      pageTitle: `${pageTitle} → ${confirmTitle}`,
      formsFound: filled.length,
    };
  } catch (e: any) {
    return { success: false, method: 'cf_browser', error: e.message };
  }
}
