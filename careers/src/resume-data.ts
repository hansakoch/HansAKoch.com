/** Embedded resume data from resume.yaml — source of truth for packet generation. */
export const RESUME = {
  basics: {
    name: 'Hans Al Koch (HAK)',
    label: 'AI Enablement & Automation Architect',
    email: 'hans@hansakoch.com',
    phone: '+1 (313) 355-8675',
    altPhone: '+1 (415) 683-1016',
    url: 'https://hansakoch.com',
    location: 'Wayne, MI / Cebu, PH',
    linkedin: 'linkedin.com/in/hansakochcom',
    github: 'github.com/hansakoch',
    summary:
      'AI Enablement & Automation Architect with 27+ years of digital technology experience. Director & CMO of Iceberg Media (14 years), now building sovereign Ai infrastructure on Cloudflare-first architecture. Early adopter of OpenClaw (Jan 2025, 18.7K → 388K ⭐), organizer of OpenClaw Cebu community. Managing 145+ domains, 160 Google Business Profiles, and autonomous Ai agents running 24/7 across distributed nodes.',
    locations: {
      east_coast: { city: 'Wayne', state: 'MI', label: 'Michigan (East Coast ops)' },
      west_coast: { city: 'San Luis Obispo', state: 'CA', label: 'SLO, California (West Coast ops)' },
      remote: { city: 'Cebu', state: 'Philippines', label: 'Cebu, PH (Remote ops & abroad)' },
    },
  },

  work: [
    {
      company: 'OpenRoyleAl.com',
      title: 'AI Systems Architect & Founder',
      period: 'Jan 2025 – Present',
      location: 'Wayne, MI',
      highlights: [
        'Architected sovereign Ai infrastructure using Cloudflare Workers, D1, Vectorize, and Durable Objects',
        'Built multi-node distributed task execution with 6-second average latency',
        'Managing 63+ API keys and secrets in D1 with secure tool-based access',
        'Running 24/7 infrastructure across Surface laptop, Android device, and Cloudflare Workers',
        'Built Alfred — sovereign Ai assistant with persistent memory, file processing, voice input',
        'Built Alfred.report — Ai-powered signal processing and growth engine',
        'Created ThanksU.org — review generation platform serving SMB clients at £39-£119/month',
      ],
    },
    {
      company: 'Iceberg Media',
      title: 'Agency Search Director & AI Transition Lead',
      period: 'Aug 2022 – Present',
      location: 'Wayne, MI / Remote',
      highlights: [
        'Leading strategic pivot from 14-year SEO agency to Ai services company',
        'Transitioned pricing from £300/month SEO retainers to enterprise Ai agent implementation',
        'Designed Cloudflare-first architecture: Workers, Pages, DNS, security across 145+ domains',
        'Managing 160 Google Business Profiles and approximately 145+ domains',
        'Built and managed teams of 10+ across development, virtual support, and sales',
        'Built IcebergSites — automated local SEO site deployment per client on Cloudflare Workers',
      ],
    },
    {
      company: 'Iceberg Media',
      title: 'Director of Search Marketing',
      period: 'Nov 2012 – Aug 2022',
      location: 'Remote',
      highlights: [
        'Directed SEO and PPC campaigns for high-value local service sectors across UK and USA',
        'Keynote speaker at international conferences in USA, UK, and Philippines',
        'Built company from startup to 15 staff across development, support, and sales',
        'Managed £10K+/month average client budgets, with enterprise clients at £25K+/month',
        'Served thousands of small businesses across medical, financial, legal, restoration industries',
      ],
    },
    {
      company: 'Ajaxx Restoration / First Response Restoration',
      title: 'Head of Digital Strategy (Consulting)',
      period: 'May 2020 – June 2024',
      location: 'Remote (US)',
      highlights: [
        'Secured two US water restoration company contracts for SEO and digital marketing',
        'Managed $800-$3,500/month per client depending on locations, ad spend, and season',
        'Remote team leadership across international time zones (US/UK/PH)',
      ],
    },
    {
      company: 'Click Eleven',
      title: 'President of Search Marketing',
      period: 'Sep 2008 – Feb 2012',
      location: 'San Jose, CA',
      highlights: [
        'Generated multinational revenue across 3 search products: SEO, ORM, and PPC',
        'Managed Google Ads MCC account for enterprise clients',
        'Speaking engagements: WordCamp Philippines 2010, SEMCON Philippines 2008',
      ],
    },
    {
      company: 'Dyomo.com / TrafficSupport.net',
      title: 'BPO Country Manager — Philippines',
      period: 'May 2007 – Aug 2011',
      location: 'Philippines',
      highlights: [
        'Managed SEO, call center, and admin operations across US/India/Philippines',
        'Oversaw 6 sub-brands with 95 staff across development, support, and sales',
        'Built custom LMS delivering 300+ hours of online OJT training',
      ],
    },
    {
      company: 'syndeo::media',
      title: 'Co-Founder & Search Architect',
      period: 'Sep 2006 – Sep 2008',
      location: 'Philippines',
      highlights: [
        'Managed SEO, ORM, and PPC campaigns for clients including Nike Women PH',
        'Invited by National Defense College of Philippines to teach 3-day seminar on Web 2.0, SEO, Ruby on Rails',
      ],
    },
    {
      company: 'WhosClickingWho.com',
      title: 'PPC Product Marketing Manager',
      period: 'Feb 2005 – Oct 2006',
      location: 'US',
      highlights: [
        'Click fraud detection product rollout — PPC Auditor',
        'Work mentioned in Wired Magazine and BBC',
      ],
    },
    {
      company: 'MadTown Design',
      title: 'Owner',
      period: '1997 – 2001',
      location: 'US',
      highlights: [
        'First web design company. Built websites for local businesses',
        'Early outsourcing to Ukraine and India',
        'Won design award for agency website in 1999',
      ],
    },
  ],

  skills: {
    aiAgents: ['OpenClaw', 'Claude Code', 'OpenAI', 'DeepSeek', 'Grok', 'GitHub Copilot', 'Microsoft Copilot', 'prompt engineering', 'autonomous agent architecture', 'LLM orchestration'],
    cloud: ['Cloudflare Workers', 'D1', 'KV', 'Durable Objects', 'Pages', 'DNS', 'Zero Trust Access', 'R2'],
    languages: ['TypeScript', 'JavaScript', 'Python', 'Bash', 'HTML/CSS'],
    devops: ['GitHub Actions', 'wrangler CLI', 'systemd', 'Linux', 'cron automation'],
    marketing: ['Google Analytics', 'Google Ads', 'Microsoft Advertising', 'Facebook Ads', 'SEO', 'Google Business Profile'],
    business: ['Stripe', 'Wise', 'Highrise CRM', 'GoHighLevel', 'Zapier', 'Xero'],
  },

  projects: [
    { name: 'OpenRoyleAl.com', desc: 'Ai project umbrella: sovereign infrastructure, multi-node agents, autonomous operations' },
    { name: 'Messagewith.me', desc: 'Open-source form submission platform on Cloudflare stack' },
    { name: 'FansFollow.me', desc: 'Creator platform embedding OpenClaw' },
    { name: 'DiningHaul.app', desc: 'Food delivery discovery platform for university students' },
    { name: 'ThanksU.org', desc: 'Review generation platform. £39-£119/month' },
    { name: 'Alfred.report', desc: 'Ai-powered signal processing and growth engine' },
    { name: 'Rosari.org', desc: 'Traditional Catholic prayer and devotional platform' },
    { name: 'IcebergSites', desc: 'Automated local SEO site deployment per client on Cloudflare Workers' },
  ],

  education: [
    { school: 'San José State University', area: 'Business Administration', years: '2002–2004' },
    { school: 'De Anza College', years: '2004–2005' },
    { school: 'DeVry University', area: 'Computer Science', years: '2001–2003' },
  ],

  speaking: [
    '2011 — 5th SEMCON — "Searching For Deals: How Group Buying Harnesses Search"',
    '2010 — WordCamp Philippines — "WPPlugins Must-Haves"',
    '2009 — SEMCON — "Business Models for Social Network Sites" + "E-Commerce in a Social Network"',
    '2008 — SEMCON Philippines — "Search Arbitrage Monetizing Tier 2 PPC Search Traffic"',
    '2008 — WordCamp Philippines — "WordPress for Corporate Web Sites" + "WordPress and SEO"',
    '2008 — Social Networking & eBusiness Conference — "Marketing through Social Networks"',
    '2007 — SEMCON Philippines — "Pitfalls of Pay-Per-Click (PPC)"',
    '2006 — National Defense College of the Philippines — 3-day seminar on Web 2.0, SEO, Ruby on Rails',
  ],
} as const;

/** Build a condensed resume text for AI prompts. */
export function resumeForPrompt(): string {
  const r = RESUME;
  const lines: string[] = [];
  lines.push(`${r.basics.name} — ${r.basics.label}`);
  lines.push(`${r.basics.location} · ${r.basics.email} · ${r.basics.phone}`);
  lines.push(r.basics.linkedin + ' · ' + r.basics.github);
  lines.push('');
  lines.push('SUMMARY: ' + r.basics.summary);
  lines.push('');
  lines.push('EXPERIENCE:');
  for (const w of r.work) {
    lines.push(`  ${w.title} @ ${w.company} (${w.period})`);
    for (const h of w.highlights) lines.push(`    • ${h}`);
  }
  lines.push('');
  lines.push('SKILLS: ' + [...r.skills.aiAgents, ...r.skills.cloud, ...r.skills.languages, ...r.skills.marketing].join(', '));
  lines.push('');
  lines.push('PROJECTS: ' + r.projects.map((p) => `${p.name} — ${p.desc}`).join('; '));
  return lines.join('\n');
}
