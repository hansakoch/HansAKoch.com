export async function remember(env: {
  CF_ACCOUNT_ID?: string;
  CF_MEMORY_TOKEN?: string;
  CF_MEMORY_NAMESPACE?: string;
  CF_MEMORY_PROFILE?: string;
}, content: string) {
  if (!env.CF_ACCOUNT_ID || !env.CF_MEMORY_TOKEN) return { ok: false, skipped: true };
  const ns = env.CF_MEMORY_NAMESPACE || 'hermes';
  const profile = env.CF_MEMORY_PROFILE || 'careers';
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/agent-memory/namespaces/${ns}/profiles/${profile}/remember`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.CF_MEMORY_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });
  return { ok: res.ok, status: res.status };
}

export async function reportOral(env: { ORAL_URL?: string; ORAL_TOKEN?: string }, text: string) {
  if (!env.ORAL_URL || !env.ORAL_TOKEN) return { ok: false, skipped: true };
  const res = await fetch(`${env.ORAL_URL.replace(/\/$/, '')}/api/command/act`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.ORAL_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'CommandOS/1.0',
    },
    body: JSON.stringify({
      mission: 'careers-loop',
      text,
    }),
  });
  return { ok: res.ok, status: res.status };
}

export function standingBrief(stats: { hot: number; help: number; interview: number; applied: number }) {
  return `careers-loop: ${stats.hot} hot, ${stats.help} need captcha/help, ${stats.interview} interviews, ${stats.applied} applied. Board careers.hansakoch.com/apply`;
}
