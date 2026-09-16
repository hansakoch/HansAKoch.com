export type OnboardingItem = {
  key: string;
  label: string;
  detail: string;
};

/** Only human-facing clicks. Agent/VPN/vault are automatic — never checklist busywork. */
export const ONBOARDING_ITEMS: OnboardingItem[] = [
  {
    key: 'cf_browser_enabled',
    label: '1. Browser Run binding configured',
    detail: 'Browser Run is enabled via wrangler.toml browser binding — no dashboard toggle needed. Free plan: 10 min/day, 3 concurrent. Paid plan: 10 hours/month, 10 concurrent.',
  },
  {
    key: 'proxy_rotation',
    label: '2. Proxy rotation configured (if needed)',
    detail: 'Browser Run exits via Cloudflare IPs — no built-in proxy rotation. For rotating exit IPs, configure a third-party proxy service and pass it to browser sessions via Puppeteer proxy settings. hide.me VPN (third-party) or similar services can provide this.',
  },
  {
    key: 'address_notes',
    label: '3. Confirm Wayne MI + Plivo for forms',
    detail: 'If ATS asks address/SMS: Wayne MI + your Plivo number. Tap done if that is still true.',
  },
  {
    key: 'review_packets',
    label: '4. Review packets on phone',
    detail: 'Open a job op, read the packet, add notes, click Rewrite until happy, then Approve.',
  },
  {
    key: 'approve_and_apply',
    label: '5. Approve + Apply workflow',
    detail: 'After approving, click Submit. Agent navigates company career page via Browser and fills the form.',
  },
];

export async function getOnboardingState(db: D1Database): Promise<Record<string, boolean>> {
  const { results } = await db.prepare('SELECT key, done FROM onboarding').all<{ key: string; done: number }>();
  const state: Record<string, boolean> = {};
  for (const item of ONBOARDING_ITEMS) state[item.key] = false;
  for (const row of results || []) state[row.key] = !!row.done;
  return state;
}

export async function setOnboardingDone(db: D1Database, key: string, done: boolean) {
  const valid = ONBOARDING_ITEMS.some((i) => i.key === key);
  if (!valid) return false;
  const now = new Date().toISOString();
  await db
    .prepare('INSERT INTO onboarding (key, done, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET done=excluded.done, updated_at=excluded.updated_at')
    .bind(key, done ? 1 : 0, now)
    .run();
  return true;
}

export async function ensureOnboardingRows(db: D1Database) {
  const now = new Date().toISOString();
  for (const item of ONBOARDING_ITEMS) {
    await db
      .prepare('INSERT OR IGNORE INTO onboarding (key, done, updated_at) VALUES (?, 0, ?)')
      .bind(item.key, now)
      .run();
  }
}
