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
.vault-note{margin-top:8px;font-size:12px;color:#888}
.banner{border-radius:8px;padding:12px 14px;margin:10px 0;border:1px solid #333;font-size:14px}
.banner.ok{background:#14532d;border-color:#4ade80;color:#bbf7d0}
.banner.warn{background:#3a3a1a;border-color:#facc15;color:#fde68a}
.banner.err{background:#3a1a1a;border-color:#f87171;color:#fecaca}
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

export function boardPage(jobs: any[], stats: any = {}) {
  const s = {
    total: 0, discovered: 0, reviewing: 0, approved: 0,
    applied: 0, confirmed: 0, interview: 0, offer: 0, rejected: 0, ...stats,
  };

  const pipeline = `
    <div class="card" style="border-color:#333">
      <h2 style="margin-bottom:12px;font-size:18px">Pipeline</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px;text-align:center">
        <div><div style="font-size:28px;font-weight:700;color:#fff">${s.total}</div><div class="muted">Total ops</div></div>
        <div><div style="font-size:28px;font-weight:700;color:#facc15">${s.discovered}</div><div class="muted">New</div></div>
        <div><div style="font-size:28px;font-weight:700;color:#818cf8">${s.reviewing}</div><div class="muted">Packet ready</div></div>
        <div><div style="font-size:28px;font-weight:700;color:#4ade80">${s.approved}</div><div class="muted">Approved</div></div>
        <div><div style="font-size:28px;font-weight:700;color:#38bdf8">${s.applied}</div><div class="muted">Applied</div></div>
        <div><div style="font-size:28px;font-weight:700;color:#22d3ee">${s.confirmed}</div><div class="muted">Confirmed</div></div>
        <div><div style="font-size:28px;font-weight:700;color:#a78bfa">${s.interview}</div><div class="muted">Interviews</div></div>
        <div><div style="font-size:28px;font-weight:700;color:#fbbf24">${s.offer}</div><div class="muted">Offers</div></div>
      </div>
    </div>`;

  const cards = jobs
    .map((j) => {
      const help = j.method === 'needs_you' || j.method === 'unknown' || !j.method;
      const emailReview = j.status === 'reviewed';
      const confirmed = j.status === 'applied';
      return `<div class="card ${j.verdict === 'hot' ? 'hot' : ''}">
        <div><span class="badge ${confirmed ? 'ready' : help ? 'help' : 'ready'}">${confirmed ? 'CONFIRMED' : help ? 'NEEDS YOU' : 'READY'}</span>
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
  );
}

export function applyPage(job: any, followUp = '', flash = '', research: any = null, versions: any[] = []) {
  const help = job.method === 'needs_you' || job.method === 'unknown';
  const video = job.packet_notes === 'video-required' || job.method === 'manual_packet';
  const approved = !!job.approved;
  const submitted = ['queued', 'needs_you', 'manual_packet', 'applied'].includes(job.status);
  const watch = watchInstructions(job);

  const researchBlock = research ? `
    <div class="card" style="border-color:#818cf8">
      <h3 style="color:#c7d2fe">Company Research</h3>
      <p class="muted"><strong>About:</strong> ${esc(research.company_about)}</p>
      ${research.company_values ? `<p class="muted"><strong>Values:</strong> ${esc(research.company_values)}</p>` : ''}
      ${research.team_info ? `<p class="muted"><strong>Team:</strong> ${esc(research.team_info)}</p>` : ''}
      ${research.culture_notes ? `<p class="muted"><strong>Culture:</strong> ${esc(research.culture_notes)}</p>` : ''}
      ${research.career_page_url ? `<p><a href="${esc(research.career_page_url)}" target="_blank" rel="noopener">Career page →</a></p>` : ''}
    </div>` : '';

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
    `<p class="muted"><a href="/">← board</a> · <a href="/onboarding">Onboarding checklist</a></p>
    ${flash ? `<div class="card" style="border-color:#4ade80"><p>${esc(flash)}</p></div>` : ''}
    <div class="card" style="border-color:#38bdf8"><p><strong>Which browser?</strong> ${job.method === 'vultr_vpn' ? 'Vultr VNC + VPN Chromium only (not Omarchy / home IP).' : job.method === 'cf_browser' ? 'CF Browser Live View.' : 'See watch box after Submit.'}</p></div>
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
        <form method="post" action="/api/jobs/${esc(job.id)}/thumb"><button class="btn" name="vote" value="down">Thumbs down</button></form>
        <form method="post" action="/api/jobs/${esc(job.id)}/probe"><button class="btn">Probe ATS</button></form>
        ${!research ? `<form method="post" action="/api/jobs/${esc(job.id)}/research"><button class="btn" style="border-color:#818cf8;color:#c7d2fe">Research</button></form>` : ''}
        <form method="post" action="/api/jobs/${esc(job.id)}/approve"><button class="btn">${approved ? 'Re-approve' : 'Approve packet'}</button></form>
        ${approved && research?.career_page_url ? `<form method="post" action="/api/jobs/${esc(job.id)}/apply"><button class="btn pri">Apply via company site</button></form>` : ''}
        ${approved && !research?.career_page_url ? `<form method="post" action="/api/jobs/${esc(job.id)}/submit"><button class="btn pri">Submit</button></form>` : ''}
        ${!approved ? `<form method="post" action="/api/jobs/${esc(job.id)}/submit"><button class="btn pri" disabled title="Approve packet first">Submit</button></form>` : ''}
      </div>
      ${!approved ? '<p class="muted" style="margin-top:8px">Approve the resume/cover packet before submit.</p>' : ''}
    </div>
    ${researchBlock}
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
    return 'DO THIS ON VULTR VNC (not Omarchy Chrome, not home IP):\n1) Open VNC → Chromium\n2) Turn on hide.me VPN\n3) Use logged-in Indeed/LinkedIn\n4) Submit this packet\n5) Close Chromium when done (save RAM)\nApply queue = same job; VNC is only the browser that must click Submit.';
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
    `<p class="muted">${doneCount}/${items.length} — mark each only when that step is true. Skip vault paths.</p>
    ${rows}
    <div class="card"><p class="muted">You approve packets here. Agents handle VPN, probes, vault. CF Secrets Store = master keys (next).</p></div>`,
  );
}

export type SearchStatus = {
  kicked?: string;
  adapter?: string;
  detail?: string;
};

export function searchPage(queries: { term: string; location: string }[], status?: SearchStatus) {
  const q = queries.map((x) => `<li>${esc(x.term)} · ${esc(x.location)}</li>`).join('');
  let banner = '';
  if (status && (status.kicked !== undefined || status.adapter || status.detail)) {
    const kicked = status.kicked === '1' || status.kicked === 'true';
    const cls = kicked ? 'ok' : status.adapter === 'manual' ? 'warn' : 'err';
    const title = kicked
      ? 'Search kicked — JobSpy webhook accepted the run.'
      : status.adapter === 'manual'
        ? 'Search not kicked — no SEARCH_WEBHOOK_URL (manual mode).'
        : 'Search not kicked — adapter did not start a scrape.';
    banner = `<div class="banner ${cls}" role="status">
      <strong>${esc(title)}</strong>
      <p class="muted" style="margin-top:6px;color:inherit;opacity:.9">adapter=<code>${esc(status.adapter || 'unknown')}</code> · kicked=<code>${esc(status.kicked ?? '0')}</code>
      ${status.detail ? ` · ${esc(status.detail)}` : ''}</p>
      ${!kicked && status.adapter === 'manual' ? '<p style="margin-top:8px">Jobs still land via cron / <code>scripts/jobspy-ingest.py</code> → <code>/api/ingest</code>. Set Worker secret SEARCH_WEBHOOK_URL to make this button fire JobSpy.</p>' : ''}
    </div>`;
  }
  return layout(
    'Search — Open Careers',
    `${banner}
    <div class="card">
      <p class="muted">Worldwide queries (Gate 0 drops junk before D1 visible rows). Vultr JobSpy posts to <code>/api/ingest</code>. Cron hits SEARCH_WEBHOOK_URL when set; else Browser Run fallback is marked needs_you.</p>
      <ol class="muted">${q}</ol>
      <form method="post" action="/api/search/run" class="row"><button class="btn pri">Queue search run</button></form>
    </div>`,
  );
}
