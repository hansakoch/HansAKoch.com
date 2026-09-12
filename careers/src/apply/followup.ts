export function followUpDraft(job: { title?: string; company?: string; status?: string }): string {
  const title = job.title || 'the role';
  const company = job.company || 'the team';
  if (job.status === 'interview') {
    return `Hi ${company} — thanks for the interview slot for ${title}. I'll be there. If you want a walkthrough of how I run SEO/AEO/PPC and the agent stack, say the word.\n\nHans`;
  }
  if (job.status === 'applied' || job.status === 'queued') {
    return `Hi ${company} — checking that my ${title} packet landed. Happy to send the site list or a short loom of the agent board if useful.\n\nHans`;
  }
  if (job.status === 'offer') {
    return `Hi ${company} — received the offer for ${title}. I'll read it today and reply with questions.\n\nHans`;
  }
  return '';
}
