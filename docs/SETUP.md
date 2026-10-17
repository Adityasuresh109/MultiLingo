# MultiLingo — Setup and private deployment

The repository currently contains an implementation foundation and CI. **Do not share a public live URL until the invite-backed API is deployed and tested.**

## Prerequisites

- Node.js 22+ for this codebase (REA has a stricter minimum, see below), npm, a Cloudflare account and Wrangler authentication.
- Cloudflare Workers and D1 free-tier eligibility. Free-tier capacity and limits can change.
- GitHub repository permission to configure deployment credentials if automatic deployment is desired.

## Developer setup

```sh
npm install
npm test
npx wrangler login
npx wrangler d1 create multilingo
```

The `d1 create` command returns a **database_id**. Replace `REPLACE_WITH_D1_DATABASE_ID` in `wrangler.jsonc` with the actual ID. It is an identifier, not a secret.

```sh
npm run db:local
npm run dev
```

Create your own local invite:

```sh
npm run invite
```

The command prints (a) a **private learner access code**, and (b) an SQL `INSERT` command containing only its SHA-256 hash. Execute that SQL against your **local** D1 database, for example:

```sh
npx wrangler d1 execute multilingo --local --command="INSERT INTO invites(token_hash) VALUES ('PASTE_PRINTED_HASH');"
```

Then open the Wrangler localhost URL, enter your nickname and the raw token, and begin the first lesson. Keep tokens out of Git commits, issue descriptions, screenshots, build logs and source files.

## Production setup

1. Confirm Wrangler is authenticated to the intended Cloudflare account and the database ID is correct.
2. Run `npm run db:remote` to apply migrations on the remote D1 database.
3. Run `npm run deploy` to upload Worker code and static assets to Cloudflare.
4. Generate **one unique token per learner** using `npm run invite`, inserting each corresponding SHA-256 hash into remote D1 using `npx wrangler d1 execute multilingo --remote --command="..."`.
5. Privately provide the **raw token** to that specific adult learner; it creates one account on first use, and signs the same person back into that account on future uses. Never use the same token for multiple people.
6. Verify `/api/health`, rejection of unauthenticated `/api/lessons`, redemption and subsequent authenticated lesson progress, and logout on the real HTTPS endpoint.
7. Invite only the selected pilot users. The same code restores the same account after signing out or switching devices; never share it with another learner. For a lost code, create a secure administrator-led reissue mechanism before issuing a replacement; a new invitation alone creates a new learner, not access to the prior progress.

## Important access-control distinction

GitHub code is public, and Cloudflare's static login page is publicly reachable. **Learner identity and lessons/progress are gated at the Worker API**. There is no open registration endpoint, and raw invitation codes are never checked into GitHub. This is appropriate for an under-10 adult pilot; stricter full-site access control can be added later if desired.

## REA research setup (independent from MultiLingo runtime)

REA is a developer investigation tool, not an application runtime dependency. Per the upstream project, REA needs Node **22.19+**, **24.11+**, or **26+**. On the development machine, after upgrading Node if necessary:

```sh
npx rea-agents@latest setup
```

Select Codex, inspect the configuration changes, confirm and restart Codex. Begin with authorized, user-observable app interactions (onboarding, lesson path, immediate feedback, review prompts). Record evidence and uncertainty in `docs/REA_NOTES.md`; avoid privileged endpoints, security bypasses, copyrighted text/audio/assets or attempts to extract others' data.

**REA is not yet confirmed installed/configured on the user's laptop; its setup cannot be performed remotely through the GitHub connector.**

## GitHub Actions: automated Cloudflare deployment

`.github/workflows/deploy.yml` runs after every main-branch push or via **Actions → Deploy MultiLingo to Cloudflare → Run workflow**. Without both repository-level Actions secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`, the workflow **intentionally skips deployment**; it does not expose a broken public learning path. Secrets are specific to each repository: existing credentials in other repositories do not automatically carry over.

Create a Cloudflare API token scoped to the intended account with Cloudflare Workers deployment and D1 read/write access. Add it and the Cloudflare account ID at GitHub **MultiLingo → Settings → Secrets and variables → Actions → New repository secret**. Never paste the token into ChatGPT, source files, issues or logs.

Once authorized, the workflow finds or creates the D1 database named `multilingo`, updates the Wrangler configuration *only inside the temporary CI runner*, applies migrations, deploys the Worker/static assets, then verifies that the homepage and health respond and unauthorized lesson access returns HTTP 401. The resulting `workers.dev` address appears in the Actions run summary. Database IDs are identifiers, not user secrets, and are not hard-coded in the repository.

**Invites still require an administrator.** Generate each learner code privately and store only its hash in production D1. GitHub Actions logs for a public repository must not print private access codes. This release deliberately has no unauthenticated invite-creation API.
