#!/usr/bin/env bash
# Mint a scoped Cloudflare token for Open Careers + Artifacts.
# Prefers TokenMaster on PATH. Falls back to ALFRED_ADMIN_TOKEN + CF tokens API.
# Prints the new token once. Do not commit the output.
set -euo pipefail

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-${CF_ACCOUNT_ID:-0870b0bdbc14bcd31f43fe5e82c3ee8e}}"
VAULT="${VAULT_FILE:-$HOME/.vault/cloudflare.env}"
NAME="${TOKEN_NAME:-open-careers-artifacts-$(date -u +%Y%m%d)}"

if [[ -f "$VAULT" ]]; then
  # shellcheck disable=SC1090
  set -a
  source "$VAULT"
  set +a
fi

PARENT="${ALFRED_ADMIN_TOKEN:-${CLOUDFLARE_API_TOKEN:-}}"

if command -v tokenmaster >/dev/null 2>&1; then
  echo "Using TokenMaster on PATH: $(command -v tokenmaster)" >&2
  exec tokenmaster mint \
    --name "$NAME" \
    --account "$ACCOUNT_ID" \
    --purpose open-careers \
    --workers-edit \
    --d1-edit \
    --artifacts-edit
fi

if [[ -z "$PARENT" ]]; then
  echo "TokenMaster not on PATH and no ALFRED_ADMIN_TOKEN / CLOUDFLARE_API_TOKEN." >&2
  echo "On Omarchy: source ~/.vault/cloudflare.env and rerun." >&2
  exit 2
fi

echo "TokenMaster CLI missing — minting via Cloudflare account tokens API (ALFRED_ADMIN_TOKEN)." >&2

GROUPS_JSON="$(curl -sS "https://api.cloudflare.com/client/v4/user/tokens/permission_groups" \
  -H "Authorization: Bearer $PARENT")"

pick_id() {
  local needle="$1"
  python3 - "$GROUPS_JSON" "$needle" <<'PY'
import json, sys
data = json.loads(sys.argv[1])
needle = sys.argv[2].lower()
for g in data.get("result") or []:
    name = (g.get("name") or "").lower()
    if needle in name:
        print(g["id"])
        raise SystemExit(0)
raise SystemExit(1)
PY
}

ids=()
for n in "artifacts" "workers scripts write" "workers scripts edit" "d1 edit" "d1 write" "account settings read"; do
  if id="$(pick_id "$n" 2>/dev/null)"; then
    ids+=("$id:$n")
  fi
done

if [[ ${#ids[@]} -eq 0 ]]; then
  echo "Could not resolve permission group ids. Parent token may lack API Tokens Read." >&2
  echo "$GROUPS_JSON" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("errors") or d.get("success"))' >&2
  exit 1
fi

echo "Permission groups matched:" >&2
printf '  %s\n' "${ids[@]}" >&2

POLICY=$(python3 - "$ACCOUNT_ID" "${ids[@]}" <<'PY'
import json, sys
account = sys.argv[1]
groups = []
seen = set()
for item in sys.argv[2:]:
    gid, _name = item.split(":", 1)
    if gid in seen:
        continue
    seen.add(gid)
    groups.append({"id": gid})
print(json.dumps({
    "name": "open-careers-artifacts",
    "policies": [{
        "effect": "allow",
        "resources": {f"com.cloudflare.api.account.{account}": "*"},
        "permission_groups": groups,
    }],
}))
PY
)

# Prefer account-owned tokens; fall back to user tokens.
RESP="$(curl -sS -X POST "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/tokens" \
  -H "Authorization: Bearer $PARENT" \
  -H "Content-Type: application/json" \
  --data "$POLICY")"

if ! python3 -c 'import json,sys; d=json.load(sys.stdin); raise SystemExit(0 if d.get("success") else 1)' <<<"$RESP"; then
  RESP="$(curl -sS -X POST "https://api.cloudflare.com/client/v4/user/tokens" \
    -H "Authorization: Bearer $PARENT" \
    -H "Content-Type: application/json" \
    --data "$POLICY")"
fi

python3 - <<'PY' <<<"$RESP"
import json, sys
d = json.loads(sys.stdin.read())
if not d.get("success"):
    print("Mint failed:", d.get("errors"), file=sys.stderr)
    sys.exit(1)
val = (d.get("result") or {}).get("value")
if not val:
    print("Mint succeeded but no token value (already shown once?).", file=sys.stderr)
    sys.exit(1)
print(val)
PY
