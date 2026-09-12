function esc(s: unknown) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

export function layout(title: string, body: string, authed = true) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#0a0a0a;color:#e0e0e0}
a{color:#ff4444} .wrap{max-width:980px;margin:0 auto;padding:24px}
.top{background:#111;border-bottom:1px solid #222;padding:16px 24px}
h1{font-size:22px;color:#fff} .muted{color:#888;font-size:13px}
.card{background:#141414;border:1px solid #222;border-radius:8px;padding:14px;margin:10px 0}
.card.hot{border-color:#4ade80} .badge{font-size:10px;padding:2px 8px;border-radius:10px;margin-right:6px}
.ready{background:#14532d;color:#86efac} .help{background:#3a3a1a;color:#facc15} .drop{background:#3a1a1a;color:#f87171}
.btn{background:#1a1a1a;border:1px solid #333;color:#ccc;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:12px}
.btn.pri{background:#ff4444;border-color:#ff4444;color:#fff}
input,textarea{width:100%;background:#0a0a0a;border:1px solid #333;color:#fff;padding:10px;border-radius:6px}
.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
pre{white-space:pre-wrap;font-size:12px;color:#ccc;max-height:280px;overflow:auto}
</style></head><body>
<div class="top"><div class="wrap">
<h1>Open Careers</h1>
<p class="muted">${authed ? '<a href="/">Hot board</a> · <a href="/apply">Apply queue</a> · <a href="/onboarding">Onboarding</a> · <a href="/search">Search</a>' : 'Private tenant board'}</p>
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

export function boardPage(jobs: any[], extra = '') {
  const cards = jobs
    .map((j) => {
      const help = j.method === 'needs_you' || j.method === 'unknown' || !j.method;
      const emailReview = j.status === 'reviewed';
      return `<div class="card ${j.verdict === 'hot' ? 'hot' : ''}">
        <div><span class="badge ${help ? 'help' : 'ready'}">${help ? 'HELP' : 'READY'}</span>
        ${emailReview ? '<span class="badge help">EMAIL</span>' : ''}
        <span class="badge">${esc(j.score)} · ${esc(j.loc_label || '')} · ${esc(j.method || 'unknown')}</span></div>
        <p style="margin:8px 0 4px;color:#fff;font-weight:600">${esc(j.title)}</p>
        <p class="muted">${esc(j.company || 'Unknown')} · ${esc(j.location || '')}</p>
        <div class="row">
          <a class="btn pri" href="/apply/${esc(j.id)}">Open apply</a>
          ${j.url ? `<a class="btn" href="${esc(j.url)}" target="_blank" rel="noopener">View original</a>` : ''}
        </div>
      </div>`;
    })
    .join('');
  return layout(
    'Hot ops — Open Careers',
    `<p class="muted">Only jobs that passed Gate 0 + Gate 1. Junk titles never land here.</p>
     ${extra}
     ${cards || '<p class="muted">No hot jobs yet. Run search ingest.</p>'}`,
  );
}

export function applyPage(job: any, followUp = '', flash = '') {
  const help = job.method === 'needs_you' || job.method === 'unknown';
  const video = job.packet_notes === 'video-required' || job.method === 'manual_packet';
  const approved = !!job.approved;
  const submitted = ['queued', 'needs_you', 'manual_packet', 'applied'].includes(job.status);
  const watch = watchInstructions(job);
  return layout(
    `${job.title} — apply`,
    `<p class="muted"><a href="/">← board</a> · <a href="/onboarding">Onboarding checklist</a></p>
    ${flash ? `<div class="card" style="border-color:#4ade80"><p>${esc(flash)}</p></div>` : ''}
    <div class="card hot">
      <span class="badge ${help || video ? 'help' : 'ready'}">${video ? 'VIDEO / PACKET' : help ? 'HELP / captcha' : 'READY'}</span>
      <span class="badge ${approved ? 'ready' : 'drop'}">${approved ? 'APPROVED' : 'DRAFT'}</span>
      <span class="badge">${esc(job.method)} · ${esc(job.status)} · ${esc(job.score)}</span>
      <h2 style="margin:8px 0;color:#fff">${esc(job.title)}</h2>
      <p class="muted">${esc(job.company)} · ${esc(job.location)}</p>
      ${job.url ? `<p><a href="${esc(job.url)}" target="_blank" rel="noopener">View original →</a></p>` : ''}
      ${video ? '<p class="muted">This listing wants a video or custom essay. Download the packet, record, then the agent continues.</p>' : ''}
      ${submitted && watch ? `<div class="card" style="border-color:#facc15;margin-top:12px"><h3>Watch instructions</h3><pre>${esc(watch)}</pre></div>` : ''}
      <div class="row">
        <form method="post" action="/api/jobs/${esc(job.id)}/thumb"><button class="btn" name="vote" value="down">Thumbs down (never again)</button></form>
        <form method="post" action="/api/jobs/${esc(job.id)}/probe"><button class="btn">Probe ATS (fake persona)</button></form>
        <form method="post" action="/api/jobs/${esc(job.id)}/approve"><button class="btn">${approved ? 'Re-approve packet' : 'Approve packet'}</button></form>
        <form method="post" action="/api/jobs/${esc(job.id)}/submit"><button class="btn pri" ${approved ? '' : 'disabled title="Approve packet first"'}>Submit / open watch</button></form>
      </div>
      ${!approved ? '<p class="muted" style="margin-top:8px">Approve the resume/cover packet before submit.</p>' : ''}
    </div>
    ${followUp ? `<div class="card"><h3>Follow-up (unsent)</h3><pre>${esc(followUp)}</pre></div>` : ''}
    <div class="card"><h3>Cover</h3><pre>${esc(job.cover_md || '(generate on approve)')}</pre></div>
    <div class="card"><h3>Resume</h3><pre>${esc(job.resume_md || '(generate on approve)')}</pre></div>
    <div class="card"><h3>Listing notes</h3><pre>${esc((job.description || '').slice(0, 2000))}</pre></div>`,
  );
}

function watchInstructions(job: any): string {
  const method = job.method || 'needs_you';
  if (method === 'needs_you' || method === 'unknown') {
    return 'Open this listing on VNC / Omarchy / Browser Live View. You handle captcha/login; agent continues after.';
  }
  if (method === 'cf_browser') {
    return 'CF Browser Run session — watch Live View. Hans lane only after probe atlas confirms method.';
  }
  if (method === 'vultr_vpn') {
    return 'Vultr + hide.me/VPN headed browser. Watch VNC. Do not use home IP (Cebu). Logged-in Indeed/LinkedIn session required.';
  }
  if (method === 'manual_packet') {
    return 'Download resume/cover from this page and submit yourself (HireVue/video/essay). Agent parses inbound mail for status.';
  }
  return '';
}

export function onboardingPage(items: { key: string; label: string; detail: string; done: boolean }[]) {
  const doneCount = items.filter((i) => i.done).length;
  const rows = items
    .map(
      (i) => `<div class="card" style="${i.done ? 'border-color:#4ade80' : ''}">
      <form method="post" action="/api/onboarding/${esc(i.key)}" style="display:flex;gap:12px;align-items:flex-start">
        <input type="hidden" name="done" value="${i.done ? '0' : '1'}"/>
        <button class="btn" type="submit" style="min-width:90px">${i.done ? 'Undo ✓' : 'Mark done'}</button>
        <div><p style="color:#fff;font-weight:600">${esc(i.label)}</p><p class="muted">${esc(i.detail)}</p></div>
      </form>
    </div>`,
    )
    .join('');
  return layout(
    'Onboarding — Open Careers',
    `<p class="muted">${doneCount}/${items.length} complete. Finish before your first watched submit.</p>
    ${rows}
    <div class="card"><h3>Vault paths (Hans tenant)</h3>
    <pre class="muted">resume_vault/seo-aeo.md
resume_vault/ai-enablement.md
resume_vault/webmaster.md</pre></div>`,
  );
}

export function searchPage(queries: { term: string; location: string }[]) {
  const q = queries.map((x) => `<li>${esc(x.term)} · ${esc(x.location)}</li>`).join('');
  return layout(
    'Search — Open Careers',
    `<div class="card">
      <p class="muted">Worldwide queries (Gate 0 drops junk before D1 visible rows). Vultr JobSpy posts to <code>/api/ingest</code>. Cron hits SEARCH_WEBHOOK_URL when set; else Browser Run fallback is marked needs_you.</p>
      <ol class="muted">${q}</ol>
      <form method="post" action="/api/search/run" class="row"><button class="btn pri">Queue search run</button></form>
    </div>`,
  );
}
