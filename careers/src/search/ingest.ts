import { decide } from '../gates.ts';
import { jobId } from '../ids.ts';
import { suggestMethod } from '../apply/atlas.ts';
import { fillDocs } from '../apply/packet.ts';

export type IncomingJob = {
  title: string;
  company?: string;
  location?: string;
  url?: string;
  source?: string;
  description?: string;
};

export async function prepareRow(job: IncomingJob, atlas?: { last_good_method?: string; last_result?: string } | null) {
  const decision = decide(job);
  const id = await jobId(job);
  const docs = decision.verdict === 'reject' ? { resume_md: '', cover_md: '' } : fillDocs(job);
  const method = suggestMethod(job.url || '', atlas);
  const status = decision.verdict === 'reject' ? 'dropped' : decision.verdict === 'hot' ? 'hot' : 'maybe';
  return { id, decision, method, status, ...docs };
}
