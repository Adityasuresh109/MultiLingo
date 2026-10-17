# MultiLingo — Cloudflare Durable Objects setup

For a small adult-only, invitation-only learning pilot. **No D1 database is required.** One SQLite-backed Durable Object stores invitation hashes, learner profiles, session hashes, and durable per-lesson progress.

## GitHub Actions deployment

1. Open MultiLingo → Settings → Secrets and variables → Actions.
2. Set `CLOUDFLARE_API_TOKEN` (Cloudflare token with **Workers Scripts: Edit** permission for the intended account) and `CLOUDFLARE_ACCOUNT_ID` (matching account).
3. Set `MULTILINGO_ADMIN_TOKEN` to a **unique random value of at least 24 characters**. This token is for MultiLingo invite issuance only. It is not your Cloudflare API token. Keep it private; do not send it in chat or commit it to GitHub. You may set this secret later and rerun deployment. Without it, nobody can issue learning codes.
4. Open Actions → **Deploy MultiLingo to Cloudflare** → Run workflow, or push to main.
5. Inspect the run summary and its live `workers.dev` address. Deployment runs health, homepage, and unauthorized lesson-access smoke tests automatically.
6. Open `https://<your-workers-dev-url>/admin.html`, enter your separate MultiLingo administrator key and create one private learner code per person (up to ten total in this pilot). Share only their own code privately. **Do not share the administrator key**.
7. The learner opens the site, enters a nickname and their code, then can sign in again later using the same code. These codes are personal credentials: whoever has the code can access that learner's progress.

The Worker homepage/admin HTML may be publicly visible. The **API for lessons, profile and progress is invite-gated**. This is suitable for a small personal pilot, not a claim of a private URL or external identity verification.

## Running locally

Requires Node.js 22+, npm and Wrangler. From the project directory:

```sh
npm install
npm run check
npm run dev
```

Wrangler creates a local SQLite-backed Durable Object. To test invitation administration locally, provide a development-only `ADMIN_TOKEN` secret in `.dev.vars` (gitignored), e.g. `ADMIN_TOKEN=your-long-random-local-secret`. Then use the `/admin.html` page to create local test codes. Never place real secrets in `.dev.vars` files you share or commit.

## Security and operational notes

- Real invitation, session, and progress data are stored **inside Cloudflare**, not in GitHub or browser localStorage.
- Worker instances access exactly one Durable Object named `multilingo-pilot-v1`, which persistently owns its SQLite database; keep that name stable when updating code.
- Deployments with the same Durable Object migration retain previous user progress. Do not delete/rename `LearningStore`, its namespace or the object name without a deliberate migration.
- The admin secret is installed via `wrangler secret put ADMIN_TOKEN`, not checked into source control or printed in workflow logs.
- Invitations are created only through the authorized admin endpoint; codes are shown once and only hashes are stored.
- Review session expiry, invitation revocation, data export, and backup plans before growing beyond the family pilot.
- D1 was **not deployed successfully** in the previous setup. If an old D1 database ever contained real learners, it would require explicit export/import before cutover. Based on the previously failed D1 deployment, no production data migration is expected; verify before inviting learners.

## REA research (optional development tool)

REA is not required for runtime. Install locally through the upstream project as appropriate. Limit observation to lawful, authorized app interactions. MultiLingo has its own code, original curriculum and branding, and is not affiliated with Duolingo.
