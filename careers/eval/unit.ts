import { classifyInbound } from '../src/email.ts';
import { suggestMethod, PROBE_PERSONA } from '../src/apply/atlas.ts';
import { planSearch } from '../src/search/run.ts';
import { prepareRow } from '../src/search/ingest.ts';
import { DEFAULT_PROFILE } from '../src/profile.ts';
import { atsDomain, classifyAts } from '../src/ids.ts';
import { standingBrief } from '../src/oral.ts';
import { decide } from '../src/gates.ts';
import { detectVideoAsk } from '../src/apply/video.ts';
import { followUpDraft } from '../src/apply/followup.ts';
import { jobsFromRss } from '../src/search/rss.ts';
import { parseRemoteOk, parseRemotive, looksRelevant } from '../src/search/cf-feeds.ts';
import { parseJobFromEmail, EMAIL_ARCHIVE_NOTE } from '../src/search/email-ingest.ts';
import { ONBOARDING_ITEMS } from '../src/onboarding.ts';
import { fillDocs } from '../src/apply/packet.ts';
import { packetRepoName, ARTIFACTS_NAMESPACE, MASTER_REPO } from '../src/artifacts.ts';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(classifyInbound('Thanks for applying', 'We have received your application').status === 'applied', 'received');
assert(classifyInbound('Interview invitation', 'Can we schedule a call?').status === 'interview', 'interview');
assert(classifyInbound('Update', 'Unfortunately we are not moving forward').status === 'rejected', 'reject');
assert(classifyInbound('Offer', 'We are pleased to offer you the role').status === 'offer', 'offer');

assert(PROBE_PERSONA.label === 'probe', 'persona');
assert(PROBE_PERSONA.name === 'Joe Logan', 'probe name Joe Logan');
assert(/joe\.logan/i.test(PROBE_PERSONA.email), 'probe email joe.logan');
assert(!/hans/i.test(PROBE_PERSONA.email), 'probe email must not be Hans');
assert(suggestMethod('https://boards.greenhouse.io/acme/jobs/1') === 'mobile_web', 'greenhouse phone');
assert(suggestMethod('https://www.linkedin.com/jobs/view/1') === 'needs_you', 'linkedin help');
assert(suggestMethod('https://indeed.com/viewjob?jk=1') === 'mobile_web', 'indeed phone core');
assert(
  suggestMethod('https://boards.greenhouse.io/x', { last_good_method: 'vultr_vpn', last_result: 'ok' }) === 'vultr_vpn',
  'atlas wins',
);

assert(classifyAts('jobs.ashbyhq.com') === 'ashby', 'ashby');
assert(atsDomain('https://www.indeed.com/viewjob?jk=1') === 'indeed.com', 'domain');

const vultr = planSearch(DEFAULT_PROFILE, { SEARCH_WEBHOOK_URL: 'https://vultr.example/jobspy' });
assert(vultr.adapter === 'cf_feeds', 'core is always cf_feeds');
assert(vultr.webhook === 'https://vultr.example/jobspy', 'jobspy stays optional');
const cf = planSearch(DEFAULT_PROFILE, { BROWSER: {} });
assert(cf.adapter === 'cf_feeds', 'browser does not replace cf_feeds');
const offline = planSearch(DEFAULT_PROFILE, {});
assert(offline.adapter === 'cf_feeds' && !offline.webhook, 'offline machines still search');

assert(looksRelevant('SEO Director', 'AEO PPC'), 'feed keep seo');
assert(!looksRelevant('Account Executive', 'quota and pipeline'), 'feed drop ae');
const rok = parseRemoteOk([
  { legal: true },
  { position: 'SEO Director', company: 'Acme', url: 'https://remoteok.com/1', description: 'Organic search AEO', tags: ['seo'] },
  { position: 'SDR', company: 'No', url: 'https://remoteok.com/2', description: 'cold calls' },
]);
assert(rok.length === 1 && rok[0].source === 'cf-remoteok', 'remoteok parse');
const rem = parseRemotive({
  jobs: [{ title: 'PPC Director', company_name: 'Y', url: 'https://remotive.com/1', description: 'paid media', category: 'marketing' }],
});
assert(rem[0].source === 'cf-remotive', 'remotive parse');

const dropped = await prepareRow({ title: 'Sales Manager', company: 'X', location: 'MI' });
assert(dropped.status === 'dropped' && dropped.decision.verdict === 'reject', 'ingest drops sales');
const kept = await prepareRow({ title: 'SEO Director', company: 'Y', url: 'https://boards.greenhouse.io/y/jobs/1', location: 'Remote' });
assert(kept.status === 'hot' && kept.decision.verdict === 'hot', 'ingest keeps SEO');

assert(standingBrief({ hot: 20, help: 4, interview: 2, applied: 3 }).includes('careers-loop'), 'oral brief');
assert(decide({ title: 'RN Unit Manager' }).verdict === 'reject', 'rn');
assert(decide({ title: 'Software Engineer' }).verdict === 'reject', 'swe reject');
assert(decide({ title: 'Senior Software Engineer Guest Acquisition' }).verdict === 'reject', 'swe guest');
assert(decide({ title: 'Product Manager' }).verdict === 'reject', 'pm reject');
assert(decide({ title: 'Content Marketing Manager', description: 'Social and brand voice.' }).verdict === 'reject', 'content reject');
assert(decide({ title: 'Communications Director' }).verdict === 'reject', 'comms reject');
assert(decide({ title: 'SEO Software Engineer' }).verdict !== 'reject', 'seo swe rescued');
assert(decide({ title: 'Weird Niche Role' }, { extraDeny: ['weird niche'] }).verdict === 'reject', 'thumbs-down denylist');
assert(decide({ title: 'Менеджер по продажам', description: 'Холодные звонки и план продаж на русском.' }).verdict === 'reject', 'foreign cyrillic reject');
assert(decide({ title: 'SEO Director / SEOディレクター', description: 'Own SEO, AEO, and organic search across JP/EN markets.' }).verdict !== 'reject', 'multilingual english SEO ok');
assert(detectVideoAsk('Please submit a video intro on HireVue'), 'video');
assert(!detectVideoAsk('Write about SEO and AEO'), 'no video');
assert(followUpDraft({ status: 'interview', company: 'Acme', title: 'SEO Director' }).includes('Acme'), 'followup');
const rss = jobsFromRss('<rss><channel><item><title>SEO Director</title><link>https://x.test/1</link><description>AEO and PPC</description></item></channel></rss>');
assert(rss[0].title === 'SEO Director', 'rss');
const videoJob = await prepareRow({
  title: 'SEO Director',
  description: 'Upload a video interview via HireVue',
  url: 'https://boards.greenhouse.io/z/jobs/1',
  location: 'Remote',
});
assert(videoJob.method === 'manual_packet' && videoJob.packet_notes === 'video-required', 'video method');

const emailJob = parseJobFromEmail(
  'Fwd: SEO Director at Acme',
  'Great role. Apply here: https://boards.greenhouse.io/acme/jobs/123\nRemote SEO AEO PPC',
  'jobs@linkedin.com',
);
assert(emailJob?.title && emailJob.source === 'email', 'email parse');
assert(EMAIL_ARCHIVE_NOTE.includes('archive'), 'archive note');
assert(ONBOARDING_ITEMS.length >= 5, 'onboarding items');

const goldHot = {
  title: 'SEO Director',
  company: 'AI SaaS',
  url: 'https://boards.greenhouse.io/acme/jobs/1',
  location: 'Remote',
  description: 'Own SEO, AEO, and organic search. No quota.',
};
const goldDecision = decide(goldHot);
assert(goldDecision.verdict === 'hot', 'gold hot verdict');
const packet = fillDocs(goldHot);
assert(packet.resume_md.includes('SEO Director') && packet.cover_md.includes('Hans'), 'gold packet');

assert(ARTIFACTS_NAMESPACE === 'alfred-command', 'artifacts ns');
assert(MASTER_REPO === 'open-careers', 'artifacts master repo');
assert(packetRepoName('abc-123') === 'careers-abc-123', 'packet repo name');

console.log('Unit checks passed.');
