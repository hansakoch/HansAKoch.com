export function fillDocs(job: {
  title?: string;
  company?: string;
  description?: string;
  location?: string;
}) {
  const title = job.title || 'the role';
  const company = job.company || 'your team';
  const loc = job.location || 'remote';
  const desc = String(job.description || '').slice(0, 900);

  const resume_md = `HANS AL KOCH
Wayne, MI · Cebu, PH · hans@hansakoch.com
linkedin.com/in/hansakochcom

TARGET: ${title} — ${company} (${loc})

Webmaster + Ai / SEO / PPC operator. 27 years digital. 14 years Director & CMO, Iceberg Media (145+ domains). Building autonomous agents on Cloudflare. Not a quota salesperson.

STRENGTH FOR THIS POST
Search, AEO/GEO, paid media, reputation, and shipping agent workflows — not closing a pipeline.

NOTES FROM THE JD
${desc || 'See listing.'}
`;

  const cover_md = `Hi ${company} team —

I'm applying for ${title}. I run websites and growth systems (SEO, AEO, PPC, ORM) and I build Ai agents to do the ops work. Iceberg Media since 2012; OpenRoyleAl / Alfred.report now.

I don't sell. I install the machine that finds customers and keeps the sites honest.

If you want someone who can sit in the CMS, the ads account, and the agent logs, I'm that person.

Hans Al Koch
hans@hansakoch.com · +1 (313) 355-8675
`;

  return { resume_md, cover_md };
}
