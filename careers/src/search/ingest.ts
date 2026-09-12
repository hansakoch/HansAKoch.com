import { decide, type DecideOpts } from '../gates.ts';
import { jobId } from '../ids.ts';
import { suggestMethod } from '../apply/atlas.ts';
import { fillDocs } from '../apply/packet.ts';
import { detectVideoAsk } from '../apply/video.ts';

export type IncomingJob = {
  title: string;
  company?: string;
  location?: string;
  url?: string;
  source?: string;
  description?: string;
};

export async function prepareRow(
  job: IncomingJob,
  atlas?: { last_good_method?: string; last_result?: string } | null,
  opts: DecideOpts = {},
) {
  const decision = decide(job, opts);
  const id = await jobId(job);
  const docs = decision.verdict === 'reject' ? { resume_md: '', cover_md: '' } : fillDocs(job);
  let method = suggestMethod(job.url || '', atlas);
  let packet_notes = '';
  if (detectVideoAsk(job.description, job.title)) {
    method = 'manual_packet';
    packet_notes = 'video-required';
  }
  const status = decision.verdict === 'reject' ? 'dropped' : decision.verdict === 'hot' ? 'hot' : 'maybe';
  return { id, decision, method, status, packet_notes, ...docs };
}
