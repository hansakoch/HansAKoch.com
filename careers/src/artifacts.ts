/** Cloudflare Artifacts is the master git remote. GitHub is the public square after test. */

export const ARTIFACTS_NAMESPACE = 'alfred-command';
export const MASTER_REPO = 'open-careers';

export type ArtifactsRepo = {
  name: string;
  remote?: string;
  token?: string;
  defaultBranch?: string;
  createToken?: (scope?: string, ttl?: number) => Promise<{ plaintext?: string } | string>;
};

export type ArtifactsBinding = {
  create: (
    name: string,
    opts?: { description?: string; setDefaultBranch?: string; readOnly?: boolean },
  ) => Promise<ArtifactsRepo>;
  get: (name: string) => Promise<ArtifactsRepo>;
  list?: (opts?: { limit?: number }) => Promise<{ repos?: { name: string }[] } | { name: string }[]>;
};

export function packetRepoName(jobId: string): string {
  const id = String(jobId || 'job').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40);
  return `careers-${id || 'job'}`;
}

export async function ensureRepo(
  artifacts: ArtifactsBinding,
  name: string,
  description: string,
): Promise<{ repo: ArtifactsRepo; created: boolean }> {
  try {
    const repo = await artifacts.get(name);
    return { repo, created: false };
  } catch {
    const repo = await artifacts.create(name, {
      description,
      setDefaultBranch: 'main',
    });
    return { repo, created: true };
  }
}

export async function ensureMasterRepo(artifacts: ArtifactsBinding) {
  return ensureRepo(
    artifacts,
    MASTER_REPO,
    'Open Careers OS — Cloudflare Artifacts master. GitHub is the public mirror after it is tested.',
  );
}

/** Versioned packet home. D1 stays readable on the phone; Artifacts holds the git tree when bound. */
export async function snapshotPacket(
  env: {
    ARTIFACTS?: ArtifactsBinding;
    CF_ACCOUNT_ID?: string;
    CF_ARTIFACTS_TOKEN?: string;
    CF_ARTIFACTS_NAMESPACE?: string;
  },
  jobId: string,
  files: { resume_md: string; cover_md: string },
) {
  const payload = JSON.stringify({ jobId, at: new Date().toISOString(), ...files });
  if (env.ARTIFACTS) {
    const { repo, created } = await ensureRepo(
      env.ARTIFACTS,
      packetRepoName(jobId),
      `Approved packet ${jobId}`,
    );
    return {
      ok: true,
      stored: 'artifacts-binding',
      repo: repo.name,
      remote: repo.remote || null,
      created,
      bytes: payload.length,
    };
  }
  if (!env.CF_ACCOUNT_ID || !env.CF_ARTIFACTS_TOKEN) {
    return { ok: true, stored: 'd1-only', bytes: payload.length };
  }
  const ns = env.CF_ARTIFACTS_NAMESPACE || ARTIFACTS_NAMESPACE;
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/artifacts/namespaces/${ns}/repos`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.CF_ARTIFACTS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: packetRepoName(jobId),
      description: `Approved packet ${jobId}`,
      default_branch: 'main',
    }),
  });
  return { ok: res.ok || res.status === 409, stored: 'artifacts-rest', status: res.status };
}
