# MultiLingo 🌱

**Private Spanish learning for friends and family.** A simple, familiar, mobile-friendly language-learning app with stronger focus on recall, explanation and retention.

> **Status: starter implementation committed; not yet deployed.** Requires a Worker deployment plus a separate invitation-admin secret before pilot use.

## Requirements

- Adults, English → Spanish, invitations only, <10 initial users.
- Free-first GitHub + Cloudflare architecture.
- Original curriculum. Duolingo is only a reference for high-level UX patterns.

## Implemented

- Responsive, original learning-path interface, two 5-question Spanish lessons, choice/typing/listening activities.
- Immediate answer feedback, 80% unlock gate, best score, attempts and simple review reminders.
- 256-bit private invite/account codes (reusable by the same learner), 30-day secure cookie sessions, individual SQLite-backed Durable Object progress.
- No external AI API, no personal email collection, no ad or tracking SDK.
- Owner-only invitation screen (`/admin.html`), protected by a separate administrator secret.
- Node standard-library tests and GitHub Actions checks.

## Quick check

```sh
npm test
npm run check
```

See [v1 spec](docs/V1_SPEC.md) and [setup and deployment](docs/SETUP.md). REA observation checklist: [docs/REA_NOTES.md](docs/REA_NOTES.md).

## Architecture

`public/` — original mobile web UI · `src/lessons.mjs` — curriculum/grading · `src/worker.mjs` — gated API · `src/storage.mjs` — durable SQLite tables · `public/admin.html` — private invitation issuance · `tests/` — learning/security regression tests.

## Security

This repository may be public; **no learner profiles or raw invite/session tokens belong here**. The login shell is public, but all actual lesson and personal progress APIs require a valid session. Private access codes are random and stored only as hashes in Durable Object SQLite. Returning learners reuse their code to recover the same profile.

## Learning attribution

Content is original; authoritative vocabulary and grammar references include RAE and Instituto Cervantes alongside other user-provided learning sites. Their protected content is not incorporated into the source code. MultiLingo is independent of Duolingo.
