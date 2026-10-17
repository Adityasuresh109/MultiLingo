# MultiLingo — Version 1 Product & Learning Specification

Status: **approved requirements, implemented foundation awaiting Cloudflare release** (17 October 2026). Application **name: MultiLingo**. Duolingo is a behavior/UX reference, not the application name or a content source.

## Fixed decisions

- Audience: **adults**.
- Language pair at launch: **English -> Spanish**.
- Distribution: **private invite-only pilot**, fewer than **10** learners initially.
- Cost: **free-first**, GitHub + Cloudflare; no paid API or subscription required for pilot.
- Experience: familiar learning path, short lessons, multiple-choice, typing and listening, immediate feedback, persistent individual progress.
- Educational objective: enable **faster, deeper learning** through targeted feedback, productive recall and delayed review; **do not claim measurable superiority** until evidence supports it.
- Original content and visuals only. Do not copy Duolingo text, audio, artwork, trademarks or code.

## User experience

1. Enter personal learning code (initial invite) and preferred name/nickname. Returning learners use the same code to sign in without losing progress.
2. See personal lesson path, per-lesson best score and locked/unlocked status.
3. Select unlocked lesson; complete 5 short questions.
4. After each response receive correct/incorrect explanation and an appropriate answer.
5. Finish lesson, see percent correct; >=80% unlocks the next lesson.
6. Retry lessons; retain maximum percent and number of attempts independently for each learner.
7. See review reminders once prior material is due.
8. Sign out; personal progress is stored in the Durable Object SQLite database, not browser local storage.

## Content baseline, implemented in the starter

**Unit 1, Lesson 1 — Say hello**

- Competency: recognize greeting and courtesy expressions.
- Target language: hola, gracias, buenos días, adiós, por favor.
- Checks: meaning, Spanish recall with correct accent, device voice comprehension, retrieval.

**Unit 1, Lesson 2 — Introduce yourself**

- Competency: understand ¿Cómo te llamas? and introduce oneself.
- Target language: ¿Cómo te llamas?, me llamo, mucho gusto.
- Checks: question comprehension, completion, short spoken phrase recognition, retrieval.

## Curriculum quality policy

- One communication objective per lesson, with vocabulary and context specified before exercises.
- Recognition questions introduce concepts; typed recall checks independent retrieval.
- Consistent accent and punctuation treatment. Current checker ignores capitalization and extra spaces, but **does not erase accented vowels or ñ**. Later versions will introduce a dedicated typo-vs-error rubric.
- Feedback must explain language, not simply reward correctness.
- Schedule first reviews 1 day after an 80–99% score and 3 days after a 100% score; this is a **simple initial heuristic**, not a deployed FSRS adaptive scheduler.
- Author lesson materials independently and validate against Spanish-language authorities; native-speaker sample audit for a wider launch.
- Adaptivity beyond lesson unlock/review heuristic is a **future v1 completion requirement**; no claim of individualized adaptive scheduling yet.

## Non-goals for first playable pilot

- AI chat, voice recognition or pronunciation scoring.
- Multiplayer, leaderboards, paid subscriptions, children's accounts, social features.
- Full A1 coverage or an official A1 certificate.
- Offline personal data synchronization or native mobile-store deployment.
- Unrestricted public signup.

## Technical architecture

- Zero-build responsive browser client in `public/` (HTML/CSS/vanilla JS).
- Cloudflare Worker in `src/worker.mjs` with static Worker Assets in the same origin.
- A single SQLite-backed Cloudflare Durable Object stores invite-token hashes, learner records, session-token hashes and progress.
- `__Host-ml_session`: Secure, HttpOnly, SameSite=Strict cookie; 30-day expiry.
- Crypto-random 256-bit private learning codes: first use claims the invitation and creates a learner; subsequent uses sign back into that exact learner. No plaintext codes stored.
- The owner can generate learner invitation codes at `/admin.html` after setting a private `MULTILINGO_ADMIN_TOKEN` GitHub Actions secret, which the deployment script installs as a Cloudflare Worker secret.
- REST endpoints: `GET /api/health`, `POST /api/auth/redeem`, `GET /api/me`, `POST /api/auth/logout`, `GET /api/lessons`, `GET /api/lessons/:id`, `POST /api/lessons/:id/check`, `POST /api/lessons/:id/complete`.
- Browser public assets may be visible, but **every lesson and user-specific API endpoint requires a valid session**. This is invitation-based access control, not a claim that a public Worker URL is invisible.
- No direct third-party analytics or learner-tracking SDK in the starter.

## Acceptance requirements

- [x] User-supplied parameters reflected in specification.
- [x] Original two-lesson curriculum and grading unit tests.
- [x] Initial invitation and session implementation with private SQLite-backed Durable Object progress schema.
- [x] Server-only answer keys; public lesson JSON strips answers and explanations.
- [x] Responsive interface with lesson completion and feedback.
- [x] Automated CI workflow and local testing scripts.
- [x] Durable Object SQLite lifecycle tests, invitation administration, authentication and saved progress.
- [ ] SQLite-backed Durable Object configured and tested locally.
- [ ] Cloudflare Worker deployed and real HTTPS URL verified.
- [ ] End-to-end invitation redemption on deployed Worker tested.
- [ ] Real-device checks on iOS and Android, including availability of Spanish voices.
- [ ] Pilot with 3–5 adults completed; measure immediate recall and 7-day delayed recall.
- [ ] More A1 material authored and reviewed before claiming v1 curriculum completeness.

## Evidence-based learning quality targets (to validate, not guaranteed)

- >=80% passing threshold on first two lessons.
- Track first-try accuracy, repeat attempts, 7-day no-hint recall and lesson completion.
- Compare learner baselines and performance after repeated study; do not infer causation or Duolingo superiority from a tiny pilot.

## Reference policy

The user-supplied `Spanish for Beginners Knowledge Bases.docx` provides RAE, Instituto Cervantes, SpanishDict, WordReference, StudySpanish.com, archived BBC Languages, Colby College and Penn State's library guide. Consult as **references** for meaning, grammar, phonology and pedagogy; do not ingest or redistribute third-party protected learning content. CEFR and the Instituto Cervantes Plan Curricular may guide level mapping. Content in this repository is original starter material.
