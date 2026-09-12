import { classifyInbound } from '../src/email.ts';
import { suggestMethod, PROBE_PERSONA } from '../src/apply/atlas.ts';
import { planSearch } from '../src/search/run.ts';
import { prepareRow } from '../src/search/ingest.ts';
import { DEFAULT_PROFILE } from '../src/profile.ts';
import { atsDomain, classifyAts } from '../src/ids.ts';
import { standingBrief } from '../src/oral.ts';
import { decide } from '../src/gates.ts';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(classifyInbound('Thanks for applying', 'We have received your application').status === 'applied', 'received');
assert(classifyInbound('Interview invitation', 'Can we schedule a call?').status === 'interview', 'interview');
assert(classifyInbound('Update', 'Unfortunately we are not moving forward').status === 'rejected', 'reject');
assert(classifyInbound('Offer', 'We are pleased to offer you the role').status === 'offer', 'offer');

assert(PROBE_PERSONA.label === 'probe', 'persona');
assert(!/hans/i.test(PROBE_PERSONA.email), 'probe email must not be Hans');
assert(suggestMethod('https://boards.greenhouse.io/acme/jobs/1') === 'cf_browser', 'greenhouse');
assert(suggestMethod('https://www.linkedin.com/jobs/view/1') === 'needs_you', 'linkedin help');
assert(suggestMethod('https://indeed.com/viewjob?jk=1') === 'vultr_vpn', 'indeed vpn');
assert(
  suggestMethod('https://boards.greenhouse.io/x', { last_good_method: 'vultr_vpn', last_result: 'ok' }) === 'vultr_vpn',
  'atlas wins',
);

assert(classifyAts('jobs.ashbyhq.com') === 'ashby', 'ashby');
assert(atsDomain('https://www.indeed.com/viewjob?jk=1') === 'indeed.com', 'domain');

const vultr = planSearch(DEFAULT_PROFILE, { SEARCH_WEBHOOK_URL: 'https://vultr.example/jobspy' });
assert(vultr.adapter === 'vultr_jobspy', 'vultr adapter');
const cf = planSearch(DEFAULT_PROFILE, { BROWSER: {} });
assert(cf.adapter === 'cf_browser', 'cf adapter');

const dropped = await prepareRow({ title: 'Sales Manager', company: 'X', location: 'MI' });
assert(dropped.status === 'dropped' && dropped.decision.verdict === 'reject', 'ingest drops sales');
const kept = await prepareRow({ title: 'SEO Director', company: 'Y', url: 'https://boards.greenhouse.io/y/jobs/1', location: 'Remote' });
assert(kept.status === 'hot' && kept.decision.verdict === 'hot', 'ingest keeps SEO');

assert(standingBrief({ hot: 20, help: 4, interview: 2, applied: 3 }).includes('careers-loop'), 'oral brief');
assert(decide({ title: 'RN Unit Manager' }).verdict === 'reject', 'rn');

console.log('Unit checks passed.');
