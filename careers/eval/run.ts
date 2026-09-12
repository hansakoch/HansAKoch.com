import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide, visibleOnBoard, type JobInput } from '../src/gates.ts';

const root = dirname(fileURLToPath(import.meta.url));
const gold = JSON.parse(readFileSync(join(root, 'gold.json'), 'utf8')) as {
  reject: JobInput[];
  keep: JobInput[];
};

const REJECT_MIN = 0.95;
const KEEP_MIN = 0.8;

type Row = { job: JobInput; want: 'reject' | 'keep'; ok: boolean; got: string };

function evalSet(jobs: JobInput[], want: 'reject' | 'keep'): Row[] {
  return jobs.map((job) => {
    const d = decide(job);
    const onBoard = visibleOnBoard(d);
    const ok = want === 'reject' ? !onBoard && d.verdict === 'reject' : onBoard;
    return { job, want, ok, got: `${d.verdict}/${d.gate0}/${d.score}` };
  });
}

const rejects = evalSet(gold.reject, 'reject');
const keeps = evalSet(gold.keep, 'keep');
const rejectRate = rejects.filter((r) => r.ok).length / rejects.length;
const keepRate = keeps.filter((r) => r.ok).length / keeps.length;

console.log(`Gate eval  reject ${rejects.filter((r) => r.ok).length}/${rejects.length} (${(rejectRate * 100).toFixed(1)}%)  keep ${keeps.filter((r) => r.ok).length}/${keeps.length} (${(keepRate * 100).toFixed(1)}%)`);

const fails = [...rejects, ...keeps].filter((r) => !r.ok);
for (const f of fails) {
  console.log(`  FAIL want=${f.want} got=${f.got}  ${f.job.title} @ ${f.job.company || ''}`);
}

if (rejectRate < REJECT_MIN || keepRate < KEEP_MIN) {
  console.error(`Eval failed. Need reject>=${REJECT_MIN} keep>=${KEEP_MIN}`);
  process.exit(1);
}

console.log('Eval passed.');
