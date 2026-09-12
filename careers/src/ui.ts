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
.banner{border-radius:8px;padding:12px 14px;margin:10px 0;border:1px solid #333;font-size:14px}
.banner.ok{background:#14532d;border-color:#4ade80;color:#bbf7d0}
.banner.warn{background:#3a3a1a;border-color:#facc15;color:#fde68a}
.banner.err{background:#3a1a1a;border-color:#f87171;color:#fecaca}
</style></head><body>
<div class="top"><div class="wrap">
<h1>Open Careers</h1>
<p class="muted">${authed ? '<a href="/">Hot board</a> · <a href="/apply">Apply queue</a> · <a href="/search">Search</a>' : 'Private tenant board'}</p>
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
      return `<div class="card ${j.verdict === 'hot' ? 'hot' : ''}">
        <div><span class="badge ${help ? 'help' : 'ready'}">${help ? 'HELP' : 'READY'}</span>
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

export function applyPage(job: any, followUp = '') {
  const help = job.method === 'needs_you' || job.method === 'unknown';
  const video = job.packet_notes === 'video-required' || job.method === 'manual_packet';
  return layout(
    `${job.title} — apply`,
    `<p class="muted"><a href="/">← board</a></p>
    <div class="card hot">
      <span class="badge ${help || video ? 'help' : 'ready'}">${video ? 'VIDEO / PACKET' : help ? 'HELP / captcha' : 'READY'}</span>
      <span class="badge">${esc(job.method)} · ${esc(job.status)} · ${esc(job.score)}</span>
      <h2 style="margin:8px 0;color:#fff">${esc(job.title)}</h2>
      <p class="muted">${esc(job.company)} · ${esc(job.location)}</p>
      ${job.url ? `<p><a href="${esc(job.url)}" target="_blank" rel="noopener">View original →</a></p>` : ''}
      ${video ? '<p class="muted">This listing wants a video or custom essay. Download the packet, record, then the agent continues.</p>' : ''}
      <div class="row">
        <form method="post" action="/api/jobs/${esc(job.id)}/thumb"><button class="btn" name="vote" value="down">Thumbs down (never again)</button></form>
        <form method="post" action="/api/jobs/${esc(job.id)}/probe"><button class="btn">Probe ATS (fake persona)</button></form>
        <form method="post" action="/api/jobs/${esc(job.id)}/approve"><button class="btn">Approve packet</button></form>
        <form method="post" action="/api/jobs/${esc(job.id)}/submit"><button class="btn pri">Submit / open watch</button></form>
      </div>
    </div>
    ${followUp ? `<div class="card"><h3>Follow-up (unsent)</h3><pre>${esc(followUp)}</pre></div>` : ''}
    <div class="card"><h3>Cover</h3><pre>${esc(job.cover_md)}</pre></div>
    <div class="card"><h3>Resume</h3><pre>${esc(job.resume_md)}</pre></div>
    <div class="card"><h3>Listing notes</h3><pre>${esc((job.description || '').slice(0, 2000))}</pre></div>`,
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
