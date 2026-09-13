function esc(s: unknown) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

export function layout(title: string, body: string, authed = true) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<meta name="apple-mobile-web-app-capable" content="yes"/>
<title>${esc(title)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#0a0a0a;color:#e0e0e0;-webkit-text-size-adjust:100%}
a{color:#ff4444} .wrap{max-width:980px;margin:0 auto;padding:16px}
.top{background:#111;border-bottom:1px solid #222;padding:14px 16px}
h1{font-size:20px;color:#fff} .muted{color:#888;font-size:14px}
.card{background:#141414;border:1px solid #222;border-radius:10px;padding:16px;margin:12px 0}
.card.hot{border-color:#4ade80} .badge{font-size:11px;padding:3px 8px;border-radius:10px;margin-right:6px;display:inline-block}
.ready{background:#14532d;color:#86efac} .help{background:#3a3a1a;color:#facc15} .drop{background:#3a1a1a;color:#f87171}
.btn{background:#1a1a1a;border:1px solid #333;color:#ccc;padding:12px 16px;border-radius:10px;cursor:pointer;font-size:16px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;line-height:1.2}
.btn.pri{background:#ff4444;border-color:#ff4444;color:#fff}
.btn:disabled{opacity:.45}
input,textarea{width:100%;background:#0a0a0a;border:1px solid #333;color:#fff;padding:12px;border-radius:10px;font-size:16px;margin-top:8px}
.row{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
.row .btn{flex:1 1 140px}
pre{white-space:pre-wrap;font-size:14px;color:#ccc;max-height:320px;overflow:auto;-webkit-user-select:all;user-select:all}
code.path,.path{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;color:#bbf7d0;user-select:all;-webkit-user-select:all;background:#0a0a0a;padding:3px 8px;border-radius:4px;border:1px solid #333;display:inline-block;margin:3px 0}
.banner{border-radius:10px;padding:12px 14px;margin:10px 0;border:1px solid #333;font-size:15px}
.banner.ok{background:#14532d;border-color:#4ade80;color:#bbf7d0}
.banner.warn{background:#3a3a1a;border-color:#facc15;color:#fde68a}
.banner.err{background:#3a1a1a;border-color:#f87171;color:#fecaca}
.nav a{margin-right:10px}
label{display:block;margin-top:10px;color:#aaa;font-size:13px}
</style></head><body>
<div class="top"><div class="wrap">
<h1>Open Careers</h1>
<p class="muted nav">${authed ? '<a href="/">Hot board</a> · <a href="/apply">Apply</a> · <a href="/onboarding">Onboarding</a> · <a href="/search">Search</a>' : 'Private tenant board'}</p>
</div></div>
<div class="wrap">${body}</div>
<script>
document.querySelectorAll('[data-copy]').forEach(function(btn){
  btn.addEventListener('click', async function(){
    var el = document.getElementById(btn.getAttribute('data-copy'));
    if (!el) return;
    try { await navigator.clipboard.writeText(el.innerText); btn.textContent = 'Copied'; }
    catch (e) { btn.textContent = 'Select text'; }
  });
});
</script>
</body></html>`;
}

export function loginPage() {
  return layout(
    'Open Careers',
    `<div class="card">
      <p class="muted">Password — works on this iPhone. Cloudflare is the core; Vultr/Omarchy optional.</p>
      <form method="post" action="/api/auth" style="margin-top:12px">
        <input type="password" name="password" autofocus autocomplete="current-password"/>
        <div class="row"><button class="btn pri" type="submit">Access</button></div>
      </form>
    </div>`,
    false,
  );
}

function pasteJobForm() {
  return `<div class="card">
    <p style="color:#fff;font-weight:600">Paste a job (phone)</p>
    <p class="muted">Score + write a packet without Vultr. Gates still drop sales/junk.</p>
    <form method="post" action="/api/jobs/add">
      <label>Title</label><input name="title" required placeholder="SEO Director"/>
      <label>Company</label><input name="company" placeholder="Acme"/>
      <label>URL</label><input name="url" inputmode="url" placeholder="https://boards.greenhouse.io/…"/>
      <label>Location</label><input name="location" placeholder="Remote"/>
      <label>Notes / JD</label><textarea name="description" rows="4" placeholder="Paste the listing text"></textarea>
      <div class="row"><button class="btn pri" type="submit">Score this job</button></div>
    </form>
  </div>`;
}

export function boardPage(jobs: any[], extra = '') {
  const cards = jobs
    .map((j) => {
      const help = j.method === 'needs_you' || j.method === 'unknown' || !j.method;
      const emailReview = j.status === 'reviewed';
      return `<div class="card ${j.verdict === 'hot' ? 'hot' : ''}">
        <div><span class="badge ${help ? 'help' : 'ready'}">${help ? 'HELP' : 'READY'}</span>
        ${emailReview ? '<span class="badge help">EMAIL</span>' : ''}
        <span class="badge">${esc(j.score)} · ${esc(j.loc_label || '')} · ${esc(j.method || 'mobile_web')}</span></div>
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
    `<p class="muted">Cloudflare core: find → score → write → review → apply on this phone. Omarchy/Vultr offline is fine.</p>
     ${extra}
     ${cards || '<p class="muted">No hot jobs yet. Tap Search, or paste a listing below.</p>'}
     ${pasteJobForm()}`,
  );
}

export function applyPage(job: any, followUp = '', flash = '') {
  const help = job.method === 'needs_you' || job.method === 'unknown';
  const video = job.packet_notes === 'video-required' || job.method === 'manual_packet';
  const approved = !!job.approved;
  const submitted = ['queued', 'needs_you', 'manual_packet', 'applied'].includes(job.status);
  const applied = job.status === 'applied';
  const watch = watchInstructions(job);
  return layout(
    `${job.title} — apply`,
    `<p class="muted"><a href="/">← board</a> · <a href="/onboarding">Onboarding</a></p>
    ${flash ? `<div class="banner ok">${esc(flash)}</div>` : ''}
    <div class="banner warn">Apply on this iPhone. Copy the packet, open the listing, paste, then Mark applied. Vultr/Omarchy not required.</div>
    <div class="card hot">
      <span class="badge ${help || video ? 'help' : 'ready'}">${video ? 'VIDEO / PACKET' : help ? 'HELP / captcha' : 'READY'}</span>
      <span class="badge ${approved ? 'ready' : 'drop'}">${approved ? 'APPROVED' : 'DRAFT'}</span>
      ${applied ? '<span class="badge ready">APPLIED</span>' : ''}
      <span class="badge">${esc(job.method)} · ${esc(job.status)} · ${esc(job.score)}</span>
      <h2 style="margin:8px 0;color:#fff">${esc(job.title)}</h2>
      <p class="muted">${esc(job.company)} · ${esc(job.location)}</p>
      ${job.url ? `<div class="row"><a class="btn pri" href="${esc(job.url)}" target="_blank" rel="noopener">Open listing</a></div>` : ''}
      ${video ? '<p class="muted">Video or essay listing. Copy the packet, record, upload, then Mark applied.</p>' : ''}
      ${submitted && watch ? `<div class="card" style="border-color:#facc15;margin-top:12px"><h3>On this phone</h3><pre>${esc(watch)}</pre></div>` : ''}
      <div class="row">
        <form method="post" action="/api/jobs/${esc(job.id)}/approve"><button class="btn pri" type="submit">${approved ? 'Re-write packet' : 'Write + approve packet'}</button></form>
        <form method="post" action="/api/jobs/${esc(job.id)}/submit"><button class="btn" type="submit" ${approved ? '' : 'disabled title="Approve packet first"'}>Ready to apply</button></form>
        <form method="post" action="/api/jobs/${esc(job.id)}/applied"><button class="btn" type="submit" ${approved ? '' : 'disabled'}>Mark applied</button></form>
      </div>
      <div class="row">
        <form method="post" action="/api/jobs/${esc(job.id)}/thumb"><button class="btn" name="vote" value="down">Thumbs down</button></form>
        <form method="post" action="/api/jobs/${esc(job.id)}/probe"><button class="btn">Probe note (not Hans)</button></form>
      </div>
      ${!approved ? '<p class="muted" style="margin-top:8px">Write + approve first. Then open the listing and paste.</p>' : ''}
    </div>
    ${followUp ? `<div class="card"><h3>Follow-up (unsent)</h3><pre>${esc(followUp)}</pre></div>` : ''}
    <div class="card">
      <div class="row"><h3 style="flex:1">Cover</h3><button type="button" class="btn" data-copy="cover">Copy cover</button></div>
      <pre id="cover">${esc(job.cover_md || '(approve to generate)')}</pre>
    </div>
    <div class="card">
      <div class="row"><h3 style="flex:1">Resume</h3><button type="button" class="btn" data-copy="resume">Copy resume</button></div>
      <pre id="resume">${esc(job.resume_md || '(approve to generate)')}</pre>
    </div>
    <div class="card"><h3>Listing notes</h3><pre>${esc((job.description || '').slice(0, 2000))}</pre></div>`,
  );
}

function watchInstructions(job: any): string {
  const method = job.method || 'mobile_web';
  if (method === 'manual_packet') {
    return 'Copy cover + resume. Open the listing on this phone. Upload the packet / video. Tap Mark applied.';
  }
  if (method === 'needs_you') {
    return 'Open the listing in Safari. Finish login/captcha. Paste the packet. Tap Mark applied.';
  }
  if (method === 'vultr_vpn') {
    return 'Prefer this phone. If Vultr VNC is up later you can use it — do not wait on it.';
  }
  return 'Copy cover + resume → Open listing → paste into the ATS → Mark applied.';
}

export function onboardingPage(items: { key: string; label: string; detail: string; done: boolean }[]) {
  const doneCount = items.filter((i) => i.done).length;
  const rows = items
    .map(
      (i) => `<div class="card" style="${i.done ? 'border-color:#4ade80' : ''}">
      <form method="post" action="/api/onboarding/${esc(i.key)}">
        <input type="hidden" name="done" value="${i.done ? '0' : '1'}"/>
        <p style="color:#fff;font-weight:600">${esc(i.label)}</p>
        <p class="muted">${esc(i.detail)}</p>
        <div class="row"><button class="btn" type="submit">${i.done ? 'Undo ✓' : 'Mark done'}</button></div>
      </form>
    </div>`,
    )
    .join('');
  return layout(
    'Onboarding — Open Careers',
    `<p class="muted">${doneCount}/${items.length} — Cloudflare + this phone is the core.</p>
    ${rows}`,
  );
}

export type SearchStatus = {
  kicked?: string;
  adapter?: string;
  detail?: string;
  kept?: string;
  dropped?: string;
};

export function searchPage(queries: { term: string; location: string }[], status?: SearchStatus) {
  const q = queries.map((x) => `<li>${esc(x.term)} · ${esc(x.location)}</li>`).join('');
  let banner = '';
  if (status && (status.kicked !== undefined || status.adapter || status.detail)) {
    const kicked = status.kicked === '1' || status.kicked === 'true';
    const cls = kicked ? 'ok' : 'warn';
    const kept = status.kept ? ` kept=${status.kept}` : '';
    const dropped = status.dropped ? ` dropped=${status.dropped}` : '';
    const title = kicked
      ? `Cloudflare search finished.${kept}${dropped}`
      : 'Cloudflare feeds returned nothing this run. Paste a job on the board instead.';
    banner = `<div class="banner ${cls}" role="status">
      <strong>${esc(title)}</strong>
      <p class="muted" style="margin-top:6px;color:inherit;opacity:.9">adapter=<code>${esc(status.adapter || 'cf_feeds')}</code>
      ${status.detail ? ` · ${esc(status.detail)}` : ''}</p>
    </div>`;
  }
  return layout(
    'Search — Open Careers',
    `${banner}
    <div class="card">
      <p class="muted">Runs on Cloudflare (RemoteOK, Remotive, Arbeitnow, WWR). JobSpy/Vultr is optional and ignored if offline.</p>
      <ol class="muted">${q}</ol>
      <form method="post" action="/api/search/run" class="row"><button class="btn pri">Find jobs on Cloudflare</button></form>
    </div>
    ${pasteJobForm()}`,
  );
}
