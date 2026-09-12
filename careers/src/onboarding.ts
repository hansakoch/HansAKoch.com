export type OnboardingItem = {
  key: string;
  label: string;
  detail: string;
};

export const ONBOARDING_ITEMS: OnboardingItem[] = [
  {
    key: 'linkedin_logged_in',
    label: '1. LinkedIn + Indeed logged in on Vultr VNC',
    detail: 'Open VNC → Chromium → log in once. Mark done only when both sessions work.',
  },
  {
    key: 'resume_packets',
    label: '2. Resume packets exist on Vultr',
    detail: 'Agent uses the vault. You do not open paths from this page. Mark done if packets already exist.',
  },
  {
    key: 'address_notes',
    label: '3. Wayne MI + Plivo ready for forms',
    detail: 'ATS address = Wayne MI. SMS = Plivo. Mark done when those are set.',
  },
  {
    key: 'vpn_submit',
    label: '4. hide.me VPN works on Vultr',
    detail: 'Indeed/USA submits: VNC + VPN on. Never Cebu home IP. Mark done after one VPN check.',
  },
  {
    key: 'probe_persona',
    label: '5. Probe = Joe Logan (not Hans)',
    detail: 'Probes never use your cookies. Real apply only after Approve packet.',
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
