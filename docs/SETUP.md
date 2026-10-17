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

The command prints (a) a **one-time invitation token**, and (b) an SQL `INSERT` command containing only its SHA-256 hash. Execute that SQL against your **local** D1 database, for example:

```sh
npx wrangler d1 execute multilingo --local --command="INSERT INTO invites(token_hash) VALUES ('PASTE_PRINTED_HASH');"
```

Then open the Wrangler localhost URL, enter your nickname and the raw token, and begin the first lesson. Keep tokens out of Git commits, issue descriptions, screenshots, build logs and source files.

## Production setup

1. Confirm Wrangler is authenticated to the intended Cloudflare account and the database ID is correct.
2. Run `npm run db:remote` to apply migrations on the remote D1 database.
3. Run `npm run deploy` to upload Worker code and static assets to Cloudflare.
4. Generate **one unique token per learner** using `npm run invite`, inserting each corresponding SHA-256 hash into remote D1 using `npx wrangler d1 execute multilingo --remote --command="..."`.
5. Privately provide the **raw token** to that specific adult learner; it can be redeemed once. Never use the same token for multiple people.
6. Verify `/api/health`, rejection of unauthenticated `/api/lessons`, redemption and subsequent authenticated lesson progress, and logout on the real HTTPS endpoint.
7. Invite only the selected pilot users. For a forgotten device, add a new admin-managed session-reset/reissue protocol instead of reusing a redeemed code.

## Important access-control distinction

GitHub code is public, and Cloudflare's static login page is publicly reachable. **Learner identity and lessons/progress are gated at the Worker API**. There is no open registration endpoint, and raw invitation codes are never checked into GitHub. This is appropriate for an under-10 adult pilot; stricter full-site access control can be added later if desired.

## REA research setup (independent from MultiLingo runtime)

REA is a developer investigation tool, not an application runtime dependency. Per the upstream project, REA needs Node **22.19+**, **24.11+**, or **26+**. On the development machine, after upgrading Node if necessary:

```sh
npx rea-agents@latest setup
```

Select Codex, inspect the configuration changes, confirm and restart Codex. Begin with authorized, user-observable app interactions (onboarding, lesson path, immediate feedback, review prompts). Record evidence and uncertainty in `docs/REA_NOTES.md`; avoid privileged endpoints, security bypasses, copyrighted text/audio/assets or attempts to extract others' data.

**REA is not yet confirmed installed/configured on the user's laptop; its setup cannot be performed remotely through the GitHub connector.**
