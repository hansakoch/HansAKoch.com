#!/usr/bin/env bash
# Push the current careers tree to Cloudflare Artifacts (master).
# GitHub stays origin until you decide the work is public-ready.
set -euo pipefail

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-${CF_ACCOUNT_ID:-0870b0bdbc14bcd31f43fe5e82c3ee8e}}"
NAMESPACE="${CF_ARTIFACTS_NAMESPACE:-alfred-command}"
REPO="${CF_ARTIFACTS_REPO:-open-careers}"
VAULT="${VAULT_FILE:-$HOME/.vault/cloudflare.env}"

if [[ -f "$VAULT" ]]; then
  # shellcheck disable=SC1090
  set -a
  source "$VAULT"
  set +a
fi

TOKEN="${ARTIFACTS_GIT_TOKEN:-${CF_ARTIFACTS_TOKEN:-}}"
if [[ -z "$TOKEN" ]]; then
  if command -v wrangler >/dev/null 2>&1 || command -v npx >/dev/null 2>&1; then
    echo "Issuing a 24h write token via wrangler…" >&2
    TOKEN="$(npx wrangler artifacts repos issue-token "$REPO" --namespace "$NAMESPACE" --scope write --ttl 86400 --json | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("plaintext") or d.get("token") or d.get("result",{}).get("plaintext",""))')"
  fi
fi

if [[ -z "$TOKEN" ]]; then
  echo "No Artifacts git token. Run ./scripts/tokenmaster-mint.sh then:" >&2
  echo "  npx wrangler artifacts repos issue-token $REPO --namespace $NAMESPACE --scope write --ttl 86400 --json" >&2
  exit 2
fi

SECRET="${TOKEN%%\?expires=*}"
REMOTE="https://x:${SECRET}@${ACCOUNT_ID}.artifacts.cloudflare.net/git/${NAMESPACE}/${REPO}.git"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if ! git remote get-url artifacts >/dev/null 2>&1; then
  git remote add artifacts "$REMOTE"
else
  git remote set-url artifacts "$REMOTE"
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
git push artifacts "HEAD:refs/heads/${BRANCH}"
echo "Pushed $BRANCH → artifacts:${NAMESPACE}/${REPO}" >&2
echo "GitHub public push is a separate step when this is tested." >&2
