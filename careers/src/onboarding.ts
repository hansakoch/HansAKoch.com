export type OnboardingItem = {
  key: string;
  label: string;
  detail: string;
};

/** Only human-facing clicks. Agent/VPN/vault are automatic — never checklist busywork. */
export const ONBOARDING_ITEMS: OnboardingItem[] = [
  {
    key: 'iphone_safari',
    label: '1. iPhone Safari can open listings',
    detail: 'Core apply is this phone. Stay logged into LinkedIn/Indeed in Safari when those sites ask.',
  },
  {
    key: 'friend_easy_apply',
    label: '2. Easy Apply OK for trusted helper',
    detail: 'Friend/partner may click Easy Apply on good-enough fits. Perfect-fit anxiety is optional.',
  },
  {
    key: 'address_notes',
    label: '3. Confirm Wayne MI + Plivo for forms',
    detail: 'If ATS asks address/SMS: Wayne MI + your Plivo number. Tap done if that is still true.',
  },
  {
    key: 'cf_core_enough',
    label: '4. Cloudflare + this phone is enough',
    detail: 'Find, score, write, review, and apply all work on this phone. No VPN or VNC required.',
  },
  {
    key: 'probe_not_hans',
    label: '5. Probe is never Hans',
    detail: 'Joe Logan throwaway only. Real Hans apply after you read the packet out loud and it sounds like you.',
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
