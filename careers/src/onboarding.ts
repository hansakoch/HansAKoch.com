export type OnboardingItem = {
  key: string;
  label: string;
  detail: string;
};

export const ONBOARDING_ITEMS: OnboardingItem[] = [
  {
    key: 'linkedin_logged_in',
    label: 'LinkedIn + Indeed logged in (human session)',
    detail: 'Log into LinkedIn and Indeed in the headed browser on Vultr VNC. Never reuse Hans cookies for probe runs.',
  },
  {
    key: 'resume_packets',
    label: '2–3 resume packets in vault paths',
    detail: 'Vault: SEO/AEO packet, AI enablement packet, webmaster packet (see profile.yaml resume_vault).',
  },
  {
    key: 'address_notes',
    label: 'Plivo / Wayne MI address on file',
    detail: 'ATS forms use Wayne, MI + Plivo SMS. Cebu PH is home base; USA remote listings use Vultr+VPN at submit time.',
  },
  {
    key: 'vpn_submit',
    label: 'USA-from-PH submit lane ready',
    detail: 'Indeed and geo-blocked ATS: Vultr + hide.me VPN headed browser. Watch VNC during submit — not home IP.',
  },
  {
    key: 'probe_persona',
    label: 'Probe persona isolated from Hans',
    detail: 'Probe ATS uses throwaway persona (Alex Rivera). Hans identity only after approve → watched submit.',
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
