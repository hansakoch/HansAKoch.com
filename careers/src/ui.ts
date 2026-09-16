function esc(s: unknown) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

export function layout(title: string, body: string, authed = true, pendingTasks = 0) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#0a0a0a;color:#e0e0e0;font-size:16px}
a{color:#ff4444} .wrap{max-width:980px;margin:0 auto;padding:16px}
.top{background:#111;border-bottom:1px solid #222;padding:12px 16px}
h1{font-size:20px;color:#fff} .muted{color:#888;font-size:13px}
.card{background:#141414;border:1px solid #222;border-radius:8px;padding:12px;margin:8px 0}
.card.hot{border-color:#4ade80} .badge{font-size:10px;padding:2px 8px;border-radius:10px;margin-right:4px;display:inline-block}
.ready{background:#14532d;color:#86efac} .help{background:#3a3a1a;color:#facc15} .drop{background:#3a1a1a;color:#f87171}
.btn{background:#1a1a1a;border:1px solid #333;color:#ccc;padding:10px 14px;border-radius:6px;cursor:pointer;font-size:14px;min-height:44px;touch-action:manipulation}
.btn.pri{background:#ff4444;border-color:#ff4444;color:#fff;font-weight:600}
input,textarea{width:100%;background:#0a0a0a;border:1px solid #333;color:#fff;padding:12px;border-radius:6px;font-size:16px}
textarea{resize:vertical;min-height:80px}
.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
pre{white-space:pre-wrap;font-size:12px;color:#ccc;max-height:280px;overflow:auto}
code.path,.path{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;color:#bbf7d0;user-select:all;-webkit-user-select:all;background:#0a0a0a;padding:3px 8px;border-radius:4px;border:1px solid #333;display:inline-block;margin:3px 0;cursor:text}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.flash{animation:pulse 1.5s infinite}
details summary{cursor:pointer;padding:8px 0;color:#fff;font-weight:600}
details summary:hover{color:#ff4444}
details[open] summary{margin-bottom:8px}
details .detail{padding:8px 12px;border-left:3px solid #333;margin:4px 0}
</style></head><body>
<div class="top"><div class="wrap">
<h1>Open Careers</h1>
<p class="muted">${authed ? `<a href="/">Hot</a> · <a href="/apply">Apply</a> · <a href="/tasks" ${pendingTasks > 0 ? 'class="flash" style="color:#ff4444;font-weight:700"' : ''}>Tasks${pendingTasks > 0 ? ` (${pendingTasks})` : ''}</a> · <a href="/search">Search</a>` : 'Private tenant board'}</p>
</div></div>
<div class="wrap">${body}</div>
</body></html>`;
}

export function loginPage() {
  return layout(
    'Open Careers',
    `<div class="card">
      <p class="muted">Password</p>
      <form method="post" action="/api/auth" style="margin-top:12px">
        <input type="password" name="password" autofocus/>
        <div class="row"><button class="btn pri" type="submit">Access</button></div>
      </form>
    </div>`,
    false,
  );
}

export function boardPage(jobs: any[], stats: any = {}, filter = '', sort = 'score', pendingTasks = 0) {
  const s = {
    total: 0, discovered: 0, reviewing: 0, approved: 0,
    applied: 0, confirmed: 0, interview: 0, offer: 0, rejected: 0, ...stats,
  };

  const activeFilter = filter || 'all';
  const sortLow = sort === 'score_low';

  const pipeline = `
    <div class="card" style="border-color:#333">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:6px;text-align:center">
        <a href="/" style="text-decoration:none;${activeFilter === 'all' ? 'border-bottom:2px solid #fff;padding-bottom:4px' : ''}"><div style="font-size:24px;font-weight:700;color:#fff">${s.total}</div><div class="muted">All</div></a>
        <a href="/?status=hot" style="text-decoration:none;${activeFilter === 'hot' ? 'border-bottom:2px solid #facc15;padding-bottom:4px' : ''}"><div style="font-size:24px;font-weight:700;color:#facc15">${s.discovered}</div><div class="muted">New</div></a>
        <a href="/?status=ready" style="text-decoration:none;${activeFilter === 'ready' ? 'border-bottom:2px solid #4ade80;padding-bottom:4px' : ''}"><div style="font-size:24px;font-weight:700;color:#4ade80">${s.approved}</div><div class="muted">Approved</div></a>
        <a href="/?status=applied" style="text-decoration:none;${activeFilter === 'applied' ? 'border-bottom:2px solid #38bdf8;padding-bottom:4px' : ''}"><div style="font-size:24px;font-weight:700;color:#38bdf8">${s.applied}</div><div class="muted">Applied</div></a>
        <a href="/?status=interview" style="text-decoration:none;${activeFilter === 'interview' ? 'border-bottom:2px solid #a78bfa;padding-bottom:4px' : ''}"><div style="font-size:24px;font-weight:700;color:#a78bfa">${s.interview}</div><div class="muted">Interviews</div></a>
        <a href="/?status=offer" style="text-decoration:none;${activeFilter === 'offer' ? 'border-bottom:2px solid #fbbf24;padding-bottom:4px' : ''}"><div style="font-size:24px;font-weight:700;color:#fbbf24">${s.offer}</div><div class="muted">Offers</div></a>
      </div>
      <div style="margin-top:8px;text-align:right">
        <a class="btn" href="/?status=${activeFilter}&sort=score" style="font-size:12px;${!sortLow ? 'border-color:#ff4444;color:#ff4444' : ''}">High → Low</a>
        <a class="btn" href="/?status=${activeFilter}&sort=score_low" style="font-size:12px;${sortLow ? 'border-color:#ff4444;color:#ff4444' : ''}">Low → High</a>
      </div>
    </div>`;

  const cards = jobs
    .map((j) => {
      const help = j.method === 'needs_you' || j.method === 'unknown' || !j.method;
      const emailReview = j.status === 'reviewed';
      const confirmed = j.status === 'applied';
      const isCareerDirect = (j.title || '').includes('Career Direct') || (j.title || '').includes('Research:');
      return `<div class="card ${j.verdict === 'hot' ? 'hot' : ''}">
        <div><span class="badge ${confirmed ? 'ready' : help ? 'help' : 'ready'}">${confirmed ? 'CONFIRMED' : help ? 'NEEDS YOU' : 'READY'}</span>
        ${isCareerDirect ? '<span class="badge" style="background:#3a3a1a;color:#facc15">CAREER DIRECT</span>' : ''}
        ${emailReview ? '<span class="badge help">EMAIL</span>' : ''}
        <span class="badge">${esc(j.score)} · ${esc(j.loc_label || '')} · ${esc(j.method || 'unknown')}</span></div>
        <p style="margin:8px 0 4px;color:#fff;font-weight:600">${esc(j.title)}</p>
        <p class="muted">${esc(j.company || 'Unknown')} · ${esc(j.location || '')}</p>
        <div class="row">
          <a class="btn pri" href="/apply/${esc(j.id)}">Open</a>
          ${j.url ? `<a class="btn" href="${esc(j.url)}" target="_blank" rel="noopener">Listing</a>` : ''}
        </div>
      </div>`;
    })
    .join('');

  return layout(
    'Open Careers',
    `${pipeline}
     <p class="muted">${jobs.length} job ops sorted by score. Tap Open to review the packet and apply.</p>
     ${cards || '<p class="muted">No job ops yet. Search runs at 08:00, 14:00, 20:00 UTC.</p>'}`,
    true,
    pendingTasks,
  );
}

export function applyPage(job: any, followUp = '', flash = '', research: any = null, versions: any[] = [], pendingTasks = 0) {
  const help = job.method === 'needs_you' || job.method === 'unknown';
  const video = job.packet_notes === 'video-required' || job.method === 'manual_packet';
  const approved = !!job.approved;
  const submitted = ['queued', 'needs_you', 'manual_packet', 'applied'].includes(job.status);
  const watch = watchInstructions(job);

  const researchBlock = research ? `
    <div class="card" style="border-color:#818cf8">
      <h3 style="color:#c7d2fe">Company Research</h3>
      ${research.opportunity_type === 'career_direct' ? '<p style="color:#facc15;font-weight:600;margin-bottom:8px">CAREER DIRECT — No current listing, but worth approaching directly.</p>' : ''}
      ${research.opportunity_title && research.opportunity_title !== job.title ? `<p style="color:#fff;font-weight:600;margin-bottom:8px">Opportunity: ${esc(research.opportunity_title)}</p>` : ''}
      <p class="muted"><strong>About:</strong> ${esc(research.company_about)}</p>
      ${research.company_values ? `<p class="muted"><strong>Values:</strong> ${esc(research.company_values)}</p>` : ''}
      ${research.team_info ? `<p class="muted"><strong>Team:</strong> ${esc(research.team_info)}</p>` : ''}
      ${research.culture_notes ? `<p class="muted"><strong>Culture:</strong> ${esc(research.culture_notes)}</p>` : ''}
      ${research.score_rationale ? `<p style="color:#4ade80;margin-top:8px"><strong>Why this score:</strong> ${esc(research.score_rationale)}</p>` : ''}
      ${research.career_page_url ? `<p><a href="${esc(research.career_page_url)}" target="_blank" rel="noopener">Career page →</a></p>` : ''}
    </div>` : '';

  let questionsBlock = '';
  if (research?.application_questions) {
    try {
      const questions = JSON.parse(research.application_questions);
      if (Array.isArray(questions) && questions.length > 0) {
        questionsBlock = `
          <div class="card" style="border-color:#facc15">
            <h3 style="color:#fde68a">Expected Application Questions</h3>
            ${questions.map((q: any, i: number) => `
              <div style="margin:10px 0;padding:8px;border-left:3px solid #333">
                <p style="color:#fff;font-weight:600;margin-bottom:4px">${esc(q.question)}</p>
                <pre style="color:#ccc;font-size:13px">${esc(q.answer)}</pre>
              </div>
            `).join('')}
            <p class="muted" style="margin-top:8px">Edit answers by clicking Rewrite with your notes.</p>
          </div>`;
      }
    } catch {}
  }

  const versionsBlock = versions.length > 1 ? `
    <div class="card">
      <h3>Version History (${versions.length} versions)</h3>
      ${versions.map((v: any) => `<div style="margin:6px 0;padding:6px;border-left:3px solid ${v.version === versions.length ? '#4ade80' : '#333'}">
        <span class="badge ${v.version === versions.length ? 'ready' : ''}">v${v.version}</span>
        <span class="muted">${new Date(v.created_at).toLocaleString()}</span>
        ${v.comments ? `<p class="muted" style="margin-top:4px;font-size:11px">"${esc(v.comments.slice(0, 120))}"</p>` : ''}
      </div>`).join('')}
    </div>` : '';

  return layout(
    `${job.title} — apply`,
    `<p class="muted"><a href="/">← board</a> · <a href="/onboarding">Onboarding</a></p>
    ${flash ? `<div class="card" style="border-color:#4ade80"><p>${esc(flash)}</p></div>` : ''}
    <div class="card hot">
      <span class="badge ${help || video ? 'help' : 'ready'}">${video ? 'VIDEO / PACKET' : help ? 'HELP / captcha' : 'READY'}</span>
      <span class="badge ${approved ? 'ready' : 'drop'}">${approved ? 'APPROVED' : 'DRAFT'}</span>
      <span class="badge">${esc(job.method)} · ${esc(job.status)} · ${esc(job.score)}</span>
      <h2 style="margin:8px 0;color:#fff">${esc(job.title)}</h2>
      <p class="muted">${esc(job.company)} · ${esc(job.location)}</p>
      ${job.url ? `<p><a href="${esc(job.url)}" target="_blank" rel="noopener">View original →</a></p>` : ''}
      ${video ? '<p class="muted">This listing wants a video or custom essay. Download the packet, record, then the agent continues.</p>' : ''}
      ${submitted ? `<div class="card" style="border-color:#4ade80"><p style="color:#bbf7d0">Submitted. You will be notified when the application is confirmed.</p></div>` : ''}
      <div class="row">
        ${!research ? `<form method="post" action="/api/jobs/${esc(job.id)}/research"><button class="btn" style="border-color:#818cf8;color:#c7d2fe">Research</button></form>` : ''}
        <form method="post" action="/api/jobs/${esc(job.id)}/approve"><button class="btn">${approved ? 'Re-approve' : 'Approve packet'}</button></form>
        ${approved && research?.career_page_url ? `<form method="post" action="/api/jobs/${esc(job.id)}/apply"><button class="btn pri">Apply via company site</button></form>` : ''}
        ${approved && !research?.career_page_url ? `<form method="post" action="/api/jobs/${esc(job.id)}/submit"><button class="btn pri">Submit</button></form>` : ''}
        ${!approved ? `<form method="post" action="/api/jobs/${esc(job.id)}/submit"><button class="btn pri" disabled title="Approve packet first">Submit</button></form>` : ''}
      </div>
      ${!approved ? '<p class="muted" style="margin-top:8px">Approve the resume/cover packet before submit.</p>' : ''}
    </div>
    ${researchBlock}
    ${questionsBlock}
    <div class="card">
      <h3>Rewrite</h3>
      <form method="post" action="/api/jobs/${esc(job.id)}/rewrite">
        <textarea name="comments" rows="3" placeholder="Notes: 'emphasize the agent work', 'mention startup experience', 'tone down the jargon'..."></textarea>
        <div class="row" style="margin-top:8px">
          <button class="btn pri" type="submit">Rewrite</button>
          <span class="muted" style="font-size:11px;align-self:center">Your notes + company research shape the new version</span>
        </div>
      </form>
    </div>
    ${followUp ? `<div class="card"><h3>Follow-up (unsent)</h3><pre>${esc(followUp)}</pre></div>` : ''}
    <div class="card"><h3>Cover Letter</h3><pre>${esc(job.cover_md || '(packet generating...)')}</pre></div>
    <div class="card"><h3>Resume</h3><pre>${esc(job.resume_md || '(packet generating...)')}</pre></div>
    ${versionsBlock}
    <div class="card"><h3>Listing notes</h3><pre>${esc((job.description || '').slice(0, 2000))}</pre></div>`,
    true,
    pendingTasks,
  );
}

function watchInstructions(job: any): string {
  const method = job.method || 'needs_you';
  if (method === 'cf_browser') {
    return 'Applying via company career page. You will be notified when complete.';
  }
  if (method === 'vultr_vpn') {
    return 'Applying via secure browser. You will be notified when complete.';
  }
  if (method === 'manual_packet') {
    return 'This role requires a video or custom submission. Download the packet and submit manually.';
  }
  return 'Applying. You will be notified when complete.';
}

export function onboardingPage(
  items: { key: string; label: string; detail: string; done: boolean }[],
  trainingQuestions: any[] = [],
  pendingTasks = 0,
) {
  const doneCount = items.filter((i) => i.done).length;
  const allDone = doneCount === items.length;
  const pendingCount = items.length - doneCount;
  const unansweredQs = trainingQuestions.filter((q) => !q.answered_at);
  const answeredQs = trainingQuestions.filter((q) => q.answered_at);

  const flashBanner = !allDone ? `
    <div class="card flash" style="border-color:#ff4444;background:#3a1a1a">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <strong style="color:#f87171;font-size:18px">${pendingCount} task${pendingCount > 1 ? 's' : ''} remaining</strong>
          <p class="muted" style="margin-top:4px">Complete all tasks before applying for jobs.</p>
        </div>
      </div>
    </div>` : `
    <div class="card" style="border-color:#4ade80">
      <strong style="color:#86efac;font-size:18px">All tasks complete</strong>
      <p class="muted" style="margin-top:4px">You are ready to apply for jobs.</p>
    </div>`;

  const taskRows = items
    .map(
      (i) => `<details ${!i.done ? 'open' : ''} style="margin:8px 0;border:1px solid ${i.done ? '#222' : '#ff4444'};border-radius:8px;padding:8px 12px;background:#141414">
        <summary style="display:flex;gap:12px;align-items:center">
          <form method="post" action="/api/onboarding/${esc(i.key)}" style="flex-shrink:0">
            <input type="hidden" name="done" value="${i.done ? '0' : '1'}"/>
            <button class="btn ${i.done ? '' : 'pri'}" type="submit" style="min-width:44px;padding:8px">${i.done ? '✓' : '!'}</button>
          </form>
          <span style="${i.done ? 'color:#888;text-decoration:line-through' : 'color:#fff;font-weight:600'}">${esc(i.label)}</span>
          ${!i.done ? '<span class="badge drop" style="margin-left:auto">TODO</span>' : '<span class="badge ready" style="margin-left:auto">DONE</span>'}
        </summary>
        <div class="detail" style="margin-top:8px;color:#ccc;font-size:14px">
          ${esc(i.detail)}
        </div>
      </details>`,
    )
    .join('');

  // Training questions section
  const trainingSection = `
    <div style="margin-top:24px">
      <h2 style="margin-bottom:12px">Research Training</h2>
      <p class="muted" style="margin-bottom:16px">Answer these questions to help me research and score opportunities better. Your answers shape how I find and filter jobs.</p>

      ${unansweredQs.length > 0 ? `
        <div class="card flash" style="border-color:#facc15;background:#3a3a1a">
          <strong style="color:#fde68a;font-size:16px">${unansweredQs.length} question${unansweredQs.length > 1 ? 's' : ''} need your answer</strong>
        </div>
        ${unansweredQs.map((q) => `
          <div class="card" style="border-color:#facc15">
            <p style="color:#fff;font-weight:600;margin-bottom:8px">${esc(q.question)}</p>
            ${q.context ? `<p class="muted" style="margin-bottom:8px;font-size:12px">${esc(q.context)}</p>` : ''}
            <form method="post" action="/api/training/${q.id}/answer">
              <textarea name="answer" rows="2" placeholder="Your answer or guidance..."></textarea>
              <div class="row" style="margin-top:8px">
                <button class="btn pri" type="submit">Answer</button>
                <button class="btn" type="submit" name="answer" value="skip">Skip</button>
              </div>
            </form>
          </div>
        `).join('')}
      ` : `
        <div class="card" style="border-color:#4ade80">
          <p style="color:#86efac">No pending questions. Check back after the next research scan.</p>
        </div>
      `}

      ${answeredQs.length > 0 ? `
        <details style="margin-top:16px">
          <summary style="color:#888;cursor:pointer">Previous answers (${answeredQs.length})</summary>
          ${answeredQs.slice(0, 10).map((q) => `
            <div class="card" style="border-color:#222;margin-top:8px">
              <p style="color:#ccc;font-size:13px">${esc(q.question)}</p>
              <p style="color:#4ade80;font-size:13px;margin-top:4px">→ ${esc(q.answer)}</p>
            </div>
          `).join('')}
        </details>
      ` : ''}

      <div class="card" style="margin-top:16px;border-color:#333">
        <h3 style="margin-bottom:8px">Ask me anything</h3>
        <form method="post" action="/api/training">
          <input type="hidden" name="category" value="user"/>
          <textarea name="question" rows="2" placeholder="Tell me how to research better: 'always check career pages for invoices', 'this company is gold', 'skip newsletters from X'..."></textarea>
          <div class="row" style="margin-top:8px">
            <button class="btn pri" type="submit">Send guidance</button>
          </div>
        </form>
      </div>
    </div>`;

  return layout(
    'Tasks — Open Careers',
    `${flashBanner}
    ${taskRows}
    ${trainingSection}`,
    true,
    pendingTasks,
  );
}

export type SearchStatus = {
  kicked?: string;
  adapter?: string;
  detail?: string;
};

export function searchPage(queries: { term: string; location: string }[], status?: SearchStatus, pendingTasks = 0) {
  const q = queries.map((x, i) => `<li style="margin:4px 0;display:flex;gap:8px;align-items:center">
    <span style="color:#ccc;flex:1">${esc(x.term)} · ${esc(x.location)}</span>
  </li>`).join('');
  let banner = '';
  if (status && (status.kicked !== undefined || status.adapter || status.detail)) {
    const kicked = status.kicked === '1' || status.kicked === 'true';
    const cls = kicked ? 'ok' : status.adapter === 'manual' ? 'warn' : 'err';
    const title = kicked
      ? 'Search kicked.'
      : status.adapter === 'manual'
        ? 'No webhook configured. Manual mode.'
        : 'Search did not start.';
    banner = `<div class="card" style="border-color:${kicked ? '#4ade80' : '#facc15'}">
      <strong>${esc(title)}</strong>
      <p class="muted" style="margin-top:4px">adapter=${esc(status.adapter || 'unknown')} · kicked=${esc(status.kicked ?? '0')}</p>
    </div>`;
  }
  return layout(
    'Search — Open Careers',
    `${banner}
    <div class="card">
      <h3>Search Queries (${queries.length})</h3>
      <ol class="muted" style="margin:8px 0 16px 20px">${q}</ol>
      <form method="post" action="/api/search/run" class="row"><button class="btn pri">Run search now</button></form>
    </div>
    <div class="card">
      <h3>Add Search Query</h3>
      <form method="post" action="/api/search/add" style="margin-top:8px">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input type="text" name="term" placeholder="Job title or keyword" style="flex:2;min-width:200px" required/>
          <input type="text" name="location" placeholder="Location (remote, Michigan, etc.)" style="flex:1;min-width:150px" required/>
          <button class="btn pri" type="submit">Add</button>
        </div>
      </form>
    </div>
    <div class="card">
      <h3>Add Job URL Directly</h3>
      <p class="muted" style="margin-bottom:8px">Paste a job listing URL to add it to the board.</p>
      <form method="post" action="/api/ingest/url" style="margin-top:8px">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input type="url" name="url" placeholder="https://boards.greenhouse.io/company/jobs/12345" style="flex:1;min-width:200px" required/>
          <button class="btn pri" type="submit">Add job</button>
        </div>
      </form>
    </div>
    <div class="card">
      <h3>Job Sites</h3>
      <p class="muted">Jobs are sourced from:</p>
      <ul class="muted" style="margin:8px 0 0 20px">
        <li>LinkedIn (via JobSpy)</li>
        <li>Indeed (via JobSpy)</li>
        <li>Email alerts (auto-parsed)</li>
        <li>Direct URLs (added above)</li>
        <li>RSS feeds</li>
      </ul>
    </div>`,
    true,
    pendingTasks,
  );
}
