# Artifacts is master. GitHub is the public square.

Same law as [alfred.report](https://github.com/OpenRoyleAl/Alfred.report):

```
Cloudflare Artifacts (alfred-command / open-careers)  →  git source of truth
        ↓  wrangler deploy
Worker careers-hansakoch                              →  live board
        ↓  only after tested
GitHub hansakoch/HansAKoch.com                        →  public give-back
```

Iceberg Media account (`0870b0bdbc14bcd31f43fe5e82c3ee8e`) is on the Artifacts closed beta. Host:

`https://0870b0bdbc14bcd31f43fe5e82c3ee8e.artifacts.cloudflare.net/`

Namespace: **`alfred-command`** (already used by alfred.report).  
Master repo: **`open-careers`**.  
Do not treat GitHub as backup or deploy source.

## TokenMaster

Mint Cloudflare API tokens on Omarchy (vault), not in git:

```bash
# On openroyleal-960
source ~/.vault/cloudflare.env
cd ~/projects/HansAKoch.com/careers
./scripts/tokenmaster-mint.sh
```

The script uses `tokenmaster` if it is on `PATH`, else the official [Create tokens via API](https://developers.cloudflare.com/fundamentals/api/how-to/create-via-api/) call with `ALFRED_ADMIN_TOKEN` (must be allowed to create account tokens). It prints a **new** scoped token once. Put it in the vault. Never commit it.

Needed permissions on the minted token:

- Workers Scripts — Edit (deploy `careers-hansakoch`)
- D1 — Edit
- Artifacts — Edit (namespaces + repos + git tokens)
- Account Settings — Read (account id)

## First push to Artifacts

```bash
source ~/.vault/cloudflare.env
cd careers
npx wrangler artifacts namespaces list --json
npx wrangler artifacts repos create open-careers --namespace alfred-command --default-branch main --description "Open Careers OS master"
npx wrangler artifacts repos issue-token open-careers --namespace alfred-command --scope write --ttl 86400 --json
# then:
./scripts/artifacts-push.sh
```

After the Worker is deployed with the `[[artifacts]]` binding, an authed `GET /api/artifacts` also ensures the master repo exists.

## GitHub (later)

When the phone loop is trustworthy:

```bash
git push origin <branch>   # PR / public square only
```

Never push vault files, TokenMaster output, or packet tokens.
