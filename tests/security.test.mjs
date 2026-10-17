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

test('returning learner can reuse private code to recover their own account', async () => {
  const invite = 'a'.repeat(64);
  const users = [{ id: 'existing-user-id', display_name: 'Maya' }];
  const sessions = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() { if (sql.includes('FROM invites i')) return users[0]; throw new Error('Unexpected query: ' + sql); },
            async run() { if (sql.startsWith('INSERT INTO sessions')) { sessions.push(values); return { success: true }; } throw new Error('Unexpected write'); }
          };
        }
      };
    },
    batch() { throw new Error('Returning user must not attempt to claim the invite again'); }
  };
  const r = await worker.fetch(new Request('https://multilingo.example/api/auth/redeem', {
    method: 'POST', headers: { origin: 'https://multilingo.example', 'content-type': 'application/json' },
    body: JSON.stringify({name: 'New input must not rename the account',invite})
  }), {DB: db});
  assert.equal(r.status, 400, 'Name field must still meet validity limits');
  const valid = await worker.fetch(new Request('https://multilingo.example/api/auth/redeem', {
    method: 'POST', headers: {origin: 'https://multilingo.example', 'content-type': 'application/json'},
    body: JSON.stringify({name:'Maya',invite})
  }),{DB:db});
  assert.equal(valid.status,200);
  assert.equal((await valid.json()).name, 'Maya');
  assert.ok(valid.headers.get('set-cookie')?.includes('HttpOnly'));
  assert.equal(sessions.length,1);
  assert.equal(sessions[0][1], 'existing-user-id');
});
