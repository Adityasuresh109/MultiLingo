import { lessons, findLesson, gradeQuestion, gradeLesson, publicLesson, isUnlocked } from './lessons.mjs';

const COOKIE = '__Host-ml_session';
const SESSION_SECONDS = 30 * 24 * 60 * 60;
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers }
});
const err = (message, status = 400) => json({ error: message }, status);
const rand = () => crypto.randomUUID();
const hex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
async function hash(text) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))); }
function token() { const bytes = new Uint8Array(32); crypto.getRandomValues(bytes); return Array.from(bytes, x => x.toString(16).padStart(2, '0')).join(''); }
function cookieValue(request) {
  const cookies = request.headers.get('cookie') ?? '';
  return cookies.split(';').map(s => s.trim()).find(s => s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) ?? '';
}
const sessionCookie = value => `${COOKIE}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}`;
const clearCookie = () => `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
async function getUser(request, env) {
  const raw = cookieValue(request);
  if (!/^[a-f0-9]{64}$/.test(raw)) return null;
  return env.DB.prepare(`SELECT u.id, u.display_name FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?`).bind(await hash(raw), Math.floor(Date.now() / 1000)).first();
}
async function readBody(request) {
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) return null;
  const size = Number(request.headers.get('content-length') ?? 0);
  if (size > 12000) return null;
  try { return await request.json(); } catch { return null; }
}
async function progress(env, userId) {
  const data = await env.DB.prepare('SELECT lesson_id, best_percent, attempts, review_due_at FROM progress WHERE user_id = ?').bind(userId).all();
  return data.results ?? [];
}
function sameOrigin(request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}
async function route(request, env) {
  const url = new URL(request.url);
  const method = request.method;
  if (!url.pathname.startsWith('/api/')) return err('Not found', 404);
  if (method !== 'GET' && method !== 'HEAD' && !sameOrigin(request)) return err('Cross-origin request rejected', 403);
  if (url.pathname === '/api/health' && method === 'GET') return json({ ok: true, app: 'MultiLingo' });
  if (!env.DB) return err('Database not configured', 503);

  if (url.pathname === '/api/auth/redeem' && method === 'POST') {
    const body = await readBody(request);
    const invite = String(body?.invite ?? '').trim().toLowerCase();
    const name = String(body?.name ?? '').trim().replace(/\s+/g, ' ');
    if (!/^[a-f0-9]{64}$/.test(invite) || name.length < 2 || name.length > 32) return err('Enter your name and a valid invitation code');
    const userId = rand();
    const session = token();
    const inviteHash = await hash(invite);
    const sessionHash = await hash(session);
    const now = Math.floor(Date.now() / 1000);
    const results = await env.DB.batch([
      env.DB.prepare('UPDATE invites SET claimed_by = ?, claimed_at = datetime(\'now\') WHERE token_hash = ? AND claimed_by IS NULL RETURNING token_hash').bind(userId, inviteHash),
      env.DB.prepare('INSERT INTO users(id, display_name) SELECT ?, ? WHERE EXISTS(SELECT 1 FROM invites WHERE token_hash = ? AND claimed_by = ?)').bind(userId, name, inviteHash, userId),
      env.DB.prepare('INSERT INTO sessions(token_hash, user_id, expires_at) SELECT ?, id, ? FROM users WHERE id = ?').bind(sessionHash, now + SESSION_SECONDS, userId)
    ]);
    if ((results?.[0]?.results?.length ?? 0) !== 1) return err('That invitation is invalid or has already been used', 403);
    return json({ ok: true, name }, 200, { 'set-cookie': sessionCookie(session) });
  }

  if (url.pathname === '/api/me' && method === 'GET') {
    const user = await getUser(request, env);
    return json({ signedIn: !!user, user: user ? { id: user.id, name: user.display_name } : null });
  }
  const user = await getUser(request, env);
  if (!user) return err('Invitation required', 401);
  if (url.pathname === '/api/auth/logout' && method === 'POST') {
    const current = cookieValue(request);
    if (current) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await hash(current)).run();
    return json({ ok: true }, 200, { 'set-cookie': clearCookie() });
  }
  if (url.pathname === '/api/lessons' && method === 'GET') {
    const rows = await progress(env, user.id);
    return json({ name: user.display_name, lessons: lessons.map(l => {
      const p = rows.find(row => row.lesson_id === l.id);
      return { id: l.id, unit: l.unit, title: l.title, subtitle: l.subtitle, goal: l.goal,
        unlocked: isUnlocked(l.id, rows), bestPercent: p?.best_percent ?? 0,
        attempts: p?.attempts ?? 0, reviewDue: p?.review_due_at ? p.review_due_at <= Math.floor(Date.now() / 1000) : false };
    }) });
  }
  const match = url.pathname.match(/^\/api\/lessons\/([a-z-]+)(?:\/(check|complete))?$/);
  if (!match) return err('Not found', 404);
  const lesson = findLesson(match[1]);
  if (!lesson) return err('Lesson not found', 404);
  const rows = await progress(env, user.id);
  if (!isUnlocked(lesson.id, rows)) return err('Complete the preceding lesson first', 403);
  if (!match[2] && method === 'GET') return json({ lesson: publicLesson(lesson) });
  if (match[2] === 'check' && method === 'POST') {
    const body = await readBody(request);
    const q = lesson.questions.find(x => x.id === body?.questionId);
    if (!q || typeof body?.answer !== 'string' || body.answer.length > 200) return err('Invalid answer');
    return json({ feedback: gradeQuestion(q, body.answer) });
  }
  if (match[2] === 'complete' && method === 'POST') {
    const body = await readBody(request);
    if (!body || typeof body.answers !== 'object' || !body.answers || Array.isArray(body.answers)) return err('Invalid submission');
    if (JSON.stringify(body.answers).length > 3000) return err('Submission too long');
    const results = gradeLesson(lesson, body.answers);
    const seconds = Math.floor(Date.now() / 1000);
    const review = seconds + (results.passed ? (results.percent === 100 ? 3 : 1) : 0) * 86400;
    await env.DB.prepare(`INSERT INTO progress(user_id, lesson_id, best_percent, attempts, review_due_at, updated_at)
      VALUES (?, ?, ?, 1, ?, datetime('now')) ON CONFLICT(user_id,lesson_id)
      DO UPDATE SET best_percent=MAX(best_percent,excluded.best_percent), attempts=attempts+1,
      review_due_at=excluded.review_due_at, updated_at=datetime('now')`)
      .bind(user.id, lesson.id, results.percent, review).run();
    return json({ ...results, reviewDueAt: review });
  }
  return err('Method not allowed', 405);
}
export default {
  async fetch(request, env) {
    try { return await route(request, env); }
    catch (error) { console.error('MultiLingo API error', error?.name ?? 'Error'); return err('Something went wrong. Please try again.', 500); }
  }
};
