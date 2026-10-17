import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';
const fakeDB = { prepare() { throw new Error('DB should not be accessed for unauthenticated request'); } };
async function call(url, options = {}, env = {DB: fakeDB}) {
  const r = await worker.fetch(new Request(url, options), env);
  return { status: r.status, body: await r.json() };
}
test('health is publicly readable without database configured', async () => {
  const r = await call('https://multilingo.example/api/health', {}, {});
  assert.equal(r.status, 200); assert.equal(r.body.ok, true);
});
test('lesson listing requires invitation session', async () => {
  const r = await call('https://multilingo.example/api/lessons');
  assert.equal(r.status, 401);
});
test('lesson content requires invitation session', async () => {
  const r = await call('https://multilingo.example/api/lessons/greetings');
  assert.equal(r.status, 401);
});
test('cross-site mutation is rejected before reading any cookie or database', async () => {
  const r = await call('https://multilingo.example/api/lesson/greetings', {
    method: 'POST', headers: { origin: 'https://attacker.example', 'content-type': 'application/json' }, body: '{}'
  });
  assert.equal(r.status, 403);
});
test('malformed invitation is rejected without database query', async () => {
  const r = await call('https://multilingo.example/api/auth/redeem', {
    method: 'POST', headers: { origin: 'https://multilingo.example', 'content-type': 'application/json' },
    body: JSON.stringify({name:'Alex',invite:'1234'})
  });
  assert.equal(r.status, 400);
});
