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
<p class="muted">${authed ? `<a href="/">Hot</a> · <a href="/apply">Apply</a> · <a href="/tasks" ${pendingTasks > 0 ? 'class="flash" style="color:#ff4444;font-weight:700"' : ''}>Tasks${pendingTasks > 0 ? ` (${pendingTasks})` : ''}</a> · <a href="/companies">Companies</a> · <a href="/review">Review</a> · <a href="/search">Search</a> · <a href="/me">Me</a>` : 'Private tenant board'}</p>
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
        <span class="badge">${esc(j.score)} · ${esc(j.loc_label || '')} · ${esc(j.method || 'unknown')}</span>
        ${j.scheduled_at ? `<span class="badge" style="background:#1a1a3a;color:#a78bfa">${new Date(j.scheduled_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>` : ''}
        ${j.updated_at && confirmed ? `<span class="badge" style="background:#0a2a1a;color:#4ade80">${new Date(j.updated_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>` : ''}</div>
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
    <div class="card" style="border-color:${linkedinConnected ? '#4ade80' : '#facc15'}">
      <h3 style="margin-bottom:12px">LinkedIn Integration</h3>
      ${linkedinConnected
        ? '<p style="color:#86efac">✓ Connected — company research and job enrichment active</p>'
        : '<p style="color:#fde68a">Not connected — <a href="/api/linkedin/auth">Connect LinkedIn</a> to enable company research</p>'
      }
    </div>

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
      ${submitted && job.scheduled_at ? `<div class="card" style="border-color:#a78bfa">
        <h3 style="color:#c7d2fe">Scheduled to Apply</h3>
        <p style="font-size:24px;font-weight:700;color:#fff;margin:8px 0" id="countdown"></p>
        <p class="muted">Local time at ${esc(job.company || 'company')}: <span id="company-time"></span></p>
        <p class="muted" style="font-size:12px">Scheduled: ${new Date(job.scheduled_at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}</p>
      </div>
      <script>
        (function(){
          var target = new Date("${job.scheduled_at}").getTime();
          function update(){
            var now = Date.now();
            var diff = target - now;
            if(diff <= 0){
              document.getElementById("countdown").textContent = "APPLYING NOW";
              document.getElementById("company-time").textContent = new Date().toLocaleTimeString();
              return;
            }
            var h = Math.floor(diff/3600000);
            var m = Math.floor((diff%3600000)/60000);
            var s = Math.floor((diff%60000)/1000);
            document.getElementById("countdown").textContent = h+"h "+m+"m "+s+"s";
            document.getElementById("company-time").textContent = new Date().toLocaleTimeString();
            setTimeout(update, 1000);
          }
          update();
        })();
      </script>` : submitted ? `<div class="card" style="border-color:#4ade80"><p style="color:#bbf7d0">Submitted. You will be notified when confirmed.</p></div>` : ''}
      <div class="row">
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
    <div class="card"><h3>Cover Letter</h3><pre>${job.cover_md || '(packet generating...)'}</pre></div>
    <div class="card"><h3>Resume</h3><pre>${job.resume_md || '(packet generating...)'}</pre></div>
    ${versionsBlock}
    <div class="card"><h3>Listing notes</h3><pre>${(job.description || '').slice(0, 2000)}</pre></div>`,
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

const RESUME_MASTER = `Hans Al Koch (HAK)
San Luis Obispo, CA · hans@hansakoch.com · +1 (415) 683-1016
hansakoch.com · linkedin.com/in/hansakochcom · github.com/hansakoch · x.com/hansakoch · cursor.com/@iamhak

SUMMARY
AI Enablement & Automation Architect with 27+ years in digital marketing. Director & CMO of Iceberg Media (14 years). Managing 145+ domains and 160 Google Business Profiles. Building autonomous AI agents on Cloudflare. Early adopter of OpenClaw (Jan 2025, 18.7K to 388K stars).

EXPERIENCE

AI Systems Architect & Founder — OpenRoyleAl.com (Jan 2025 – Present)
• Sovereign AI infrastructure on Cloudflare: Workers AI, Agents SDK, AI Gateway, Browser Run, Artifacts
• Multi-node distributed task orchestration across edge and origin
• Built Alfred — autonomous AI assistant with persistent memory and voice

Agency Director & AI Transition Lead — Iceberg Media (2012 – Present)
• Strategic pivot from SEO agency to AI services
• Pricing transition: £300/month to £20K–£35K enterprise projects
• Cloudflare-first architecture across 145+ domains
• 160 Google Business Profiles managed
• Teams of 10+ across US, UK, Philippines

Head of Digital Strategy — Ajaxx Restoration (2020 – 2024)
• Two US water restoration company contracts
• $800–$3,500/month per client budgets
• Remote team leadership across time zones

President of Search Marketing — Click Eleven (2008 – 2012)
• Multinational revenue across 3 search products: SEO, ORM, PPC
• Google Ads MCC for enterprise clients

BPO Country Manager — Dyomo.com / TrafficSupport.net (2007 – 2011)
• SEO, call center, admin across US/India/Philippines
• 95 staff, 6 sub-brands
• Custom LMS with 300+ hours of training

EDUCATION
San José State University — Business Administration (2002–2004)
De Anza College, Cupertino — Undergraduate (2004–2005)
DeVry University — Computer Science (2001–2003)

SKILLS
SEO, AEO, GEO, PPC, ORM, Growth Marketing, TypeScript, Python, Cloudflare Workers, D1, Durable Objects, Analytics, Team Leadership`;

export function mePage(linkedinConnected = false) {
  return layout(
    'Me — Open Careers',
    `<div class="card" style="border-color:#818cf8">
      <h3 style="color:#c7d2fe;margin-bottom:12px">Profile</h3>
      <div style="display:grid;grid-template-columns:120px 1fr;gap:8px;font-size:14px">
        <span class="muted">Name</span><span style="color:#fff">Hans Al Koch (HAK)</span>
        <span class="muted">Email</span><span style="color:#fff">hans@hansakoch.com</span>
        <span class="muted">Website</span><span style="color:#fff"><a href="https://hansakoch.com" target="_blank">hansakoch.com</a></span>
        <span class="muted">LinkedIn</span><span style="color:#fff"><a href="https://linkedin.com/in/hansakochcom" target="_blank">linkedin.com/in/hansakochcom</a></span>
        <span class="muted">GitHub</span><span style="color:#fff"><a href="https://github.com/hansakoch" target="_blank">github.com/hansakoch</a></span>
        <span class="muted">X / Twitter</span><span style="color:#fff"><a href="https://x.com/hansakoch" target="_blank">x.com/hansakoch</a></span>
        <span class="muted">Cursor</span><span style="color:#fff"><a href="https://cursor.com/@iamhak" target="_blank">cursor.com/@iamhak</a></span>
      </div>
    </div>

    <div class="card" style="border-color:${linkedinConnected ? '#4ade80' : '#facc15'}">
      <h3 style="margin-bottom:12px">LinkedIn Integration</h3>
      ${linkedinConnected
        ? '<p style="color:#86efac">✓ Connected — company research and job enrichment active</p>'
        : '<p style="color:#fde68a">Not connected — <a href="/api/linkedin/auth">Connect LinkedIn</a> to enable company research</p>'
      }
    </div>

    <div class="card">
      <h3 style="margin-bottom:12px">Locations & Phones</h3>
      <div style="display:grid;gap:12px">
        <div style="display:grid;grid-template-columns:1fr auto;gap:8px;padding:8px;border:1px solid #333;border-radius:6px">
          <div><strong style="color:#fff">Wayne, Michigan</strong><br><span class="muted">East Coast / Midwest / US Remote / Canada</span></div>
          <div style="text-align:right"><span style="color:#4ade80">+1 (313) 355-8675</span></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr auto;gap:8px;padding:8px;border:1px solid #333;border-radius:6px">
          <div><strong style="color:#fff">San Luis Obispo, California</strong><br><span class="muted">West Coast / California / Bay Area</span></div>
          <div style="text-align:right"><span style="color:#4ade80">+1 (415) 683-1016</span></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr auto;gap:8px;padding:8px;border:1px solid #333;border-radius:6px">
          <div><strong style="color:#fff">Manchester, UK</strong><br><span class="muted">UK / Europe</span></div>
          <div style="text-align:right"><span style="color:#4ade80">+44 7882 517 454</span></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr auto;gap:8px;padding:8px;border:1px solid #333;border-radius:6px">
          <div><strong style="color:#fff">Cebu, Philippines</strong><br><span class="muted">APAC / Middle East / Remote Anywhere</span></div>
          <div style="text-align:right"><span style="color:#4ade80">+63 976 303 0566</span></div>
        </div>
      </div>
    </div>

    <div class="card">
      <h3 style="margin-bottom:12px">General Resume</h3>
      <pre style="font-size:13px;color:#ccc;max-height:400px;overflow:auto">${RESUME_MASTER}</pre>
    </div>

    <div class="card">
      <h3 style="margin-bottom:12px">Notes for Packets</h3>
      <p class="muted" style="margin-bottom:8px">These notes are included in every packet generation. Use them to ensure accuracy.</p>
      <form method="post" action="/api/me/notes">
        <textarea name="notes" rows="4" placeholder="e.g., 'Use Hans Al Koch (HAK) not HANS AL KOCH', 'Never mention quota or sales', 'Emphasize agent work over SEO'..."></textarea>
        <div class="row" style="margin-top:8px"><button class="btn pri" type="submit">Save notes</button></div>
      </form>
    </div>

    <div class="card">
      <h3 style="margin-bottom:12px">Location Rules</h3>
      <p class="muted">How the system picks your address for each job:</p>
      <ul class="muted" style="margin:8px 0 0 20px;line-height:1.8">
        <li><strong>California / West Coast</strong> → SLO, CA</li>
        <li><strong>Michigan / East Coast / Midwest</strong> → Wayne, MI</li>
        <li><strong>Remote US</strong> → Wayne, MI</li>
        <li><strong>Canada</strong> → Wayne, MI (open to relocation)</li>
        <li><strong>UK / Europe</strong> → Manchester, UK</li>
        <li><strong>APAC / Middle East / Egypt</strong> → Cebu, PH</li>
        <li><strong>Remote Anywhere / Worldwide</strong> → Cebu, PH</li>
        <li><strong>Italy</strong> → Asti, Italy (when number available)</li>
      </ul>
    </div>`,
  );
}

export function searchPage(queries: { term: string; location: string }[], status?: SearchStatus, pendingTasks = 0) {
  const q = queries.map((x) => `<li style="margin:4px 0;display:flex;gap:8px;align-items:center">
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

export function companiesPage(companies: any[], pendingTasks = 0) {
  const cards = companies.map(c => {
    const hasJobs = (c.job_count || 0) > 0;
    const hasCareerPage = !!c.career_page_url;
    const blocked = c.blocked ? 'BLOCKED' : '';
    return `<div class="card" style="border-color:${hasCareerPage ? '#4ade80' : '#333'}">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div>
          <strong style="color:#fff;font-size:15px">${esc(c.company || c.domain || 'Unknown')}</strong>
          ${blocked ? '<span class="badge drop" style="margin-left:8px">BLOCKED</span>' : ''}
          ${hasCareerPage ? '<span class="badge ready" style="margin-left:8px">CAREER PAGE</span>' : ''}
          ${hasJobs ? `<span class="badge" style="background:#1a1a3a;color:#a78bfa;margin-left:8px">${c.job_count} jobs</span>` : ''}
        </div>
        <div class="row" style="margin:0">
          ${c.url ? `<a class="btn" href="${esc(c.url)}" target="_blank" rel="noopener">Website</a>` : ''}
          ${hasCareerPage ? `<a class="btn" href="${esc(c.career_page_url)}" target="_blank" rel="noopener">Careers</a>` : ''}
          <form method="post" action="/api/companies/${esc(c.domain || c.company)}/research" style="display:inline"><button class="btn" type="submit">Research</button></form>
        </div>
      </div>
      ${c.about ? `<p class="muted" style="margin-top:8px">${esc(c.about.slice(0, 200))}</p>` : ''}
      ${c.source ? `<p class="muted" style="font-size:11px;margin-top:4px">Source: ${esc(c.source)}</p>` : ''}
    </div>`;
  }).join('');

  return layout(
    'Companies — Open Careers',
    `<div style="margin-bottom:16px">
      <h2 style="font-size:20px;margin-bottom:8px">Tracked Companies (${companies.length})</h2>
      <p class="muted">Companies discovered from emails, job listings, and research. Click Research to dig deeper.</p>
    </div>
    <div class="card">
      <form method="post" action="/api/companies/add" style="display:flex;gap:8px;flex-wrap:wrap">
        <input type="text" name="company" placeholder="Company name" style="flex:1;min-width:150px" required/>
        <input type="url" name="url" placeholder="https://company.com" style="flex:1;min-width:200px"/>
        <button class="btn pri" type="submit">Add Company</button>
      </form>
    </div>
    ${cards || '<p class="muted">No companies tracked yet. They are discovered from emails, job listings, and manual adds.</p>'}`,
    true,
    pendingTasks,
  );
}

export function reviewPage(items: { id: string; section: string; current: string; proposed: string; approved: boolean }[]) {
  const pending = items.filter(i => !i.approved).length;
  return layout(
    'Review — Open Careers',
    `<div style="margin-bottom:16px">
      <h2 style="font-size:20px;margin-bottom:8px">LinkedIn Profile Updates</h2>
      <p class="muted">Review each section. Add comments to guide me. Check what you approve.</p>
      ${pending > 0 ? `<div class="card flash" style="border-color:#ff4444;background:#3a1a1a"><strong style="color:#f87171">${pending} items need your review</strong></div>` : '<div class="card" style="border-color:#4ade80"><strong style="color:#86efac">All reviewed</strong></div>'}
    </div>
    <form method="post" action="/api/review/approve">
      ${items.map(item => `
        <div class="card" style="border-color:${item.approved ? '#4ade80' : '#333'}">
          <div style="display:flex;align-items:flex-start;gap:12px">
            <input type="checkbox" name="approved" value="${esc(item.id)}" ${item.approved ? 'checked' : ''} style="width:20px;height:20px;margin-top:4px;accent-color:#ff4444"/>
            <div style="flex:1">
              <h3 style="color:#fff;margin-bottom:8px">${esc(item.section)}</h3>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div>
                  <p class="muted" style="font-size:11px;margin-bottom:4px">CURRENT</p>
                  <pre style="font-size:12px;color:#888;max-height:150px;overflow:auto">${esc(item.current)}</pre>
                </div>
                <div>
                  <p class="muted" style="font-size:11px;margin-bottom:4px">PROPOSED</p>
                  <pre style="font-size:12px;color:#4ade80;max-height:150px;overflow:auto">${esc(item.proposed)}</pre>
                </div>
              </div>
              <div style="margin-top:8px">
                <textarea name="comment_${esc(item.id)}" rows="2" placeholder="Add feedback: 'make it shorter', 'add more detail', 'change tone'..." style="width:100%;background:#0a0a0a;border:1px solid #333;color:#fff;padding:8px;border-radius:6px;font-size:13px"></textarea>
              </div>
            </div>
          </div>
        </div>
      `).join('')}
      <div class="row" style="margin-top:16px">
        <button class="btn pri" type="submit" style="font-size:16px;padding:14px 24px">Submit Review</button>
      </div>
    </form>`
  );
}
