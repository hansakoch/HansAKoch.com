/** Versioned resume/cover snapshot. Uses CF Artifacts REST when configured; otherwise D1 is source of truth. */
export async function snapshotPacket(
  env: { CF_ACCOUNT_ID?: string; CF_ARTIFACTS_TOKEN?: string; CF_ARTIFACTS_NAMESPACE?: string },
  jobId: string,
  files: { resume_md: string; cover_md: string },
) {
  const payload = JSON.stringify({ jobId, at: new Date().toISOString(), ...files });
  if (!env.CF_ACCOUNT_ID || !env.CF_ARTIFACTS_TOKEN) {
    return { ok: true, stored: 'd1-only', bytes: payload.length };
  }
  const ns = env.CF_ARTIFACTS_NAMESPACE || 'alfred-command';
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/artifacts/namespaces/${ns}/repos/careers-${jobId}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${env.CF_ARTIFACTS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: payload,
  });
  return { ok: res.ok, stored: 'artifacts', status: res.status };
}
