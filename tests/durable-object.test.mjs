import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import worker, { LearningStore } from '../src/worker.mjs';
import { lessons as curriculumLessons } from '../src/lessons.mjs';

function harness() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON;');
  const sql = {
    exec(query, ...args) {
      if (args.length === 0 && query.includes(';') && query.trim().split(';').length > 2) {
        db.exec(query);
        return { toArray: () => [] };
      }
      const stmt = db.prepare(query);
      const columns = stmt.columns();
      const rows = columns.length ? stmt.all(...args) : (stmt.run(...args), []);
      return { toArray: () => rows };
    }
  };
  const ctx = {storage:{sql,transactionSync(fn){
    db.exec('BEGIN');
    try {const result=fn();db.exec('COMMIT');return result;}
    catch(e){db.exec('ROLLBACK');throw e;}
  }}};
  const store = new LearningStore(ctx,{ADMIN_TOKEN:'pilot-admin-secret-of-at-least-24-characters'});
  const env={LEARNING_STORE:{idFromName(s){assert.equal(s,'multilingo-pilot-v1');return s;},get(){return store;}}};
  async function call(path,{method='GET',body,cookie,admin,origin='https://multilingo.example'}={}) {
    const headers={};
    if(body!==undefined)headers['content-type']='application/json';
    if(cookie)headers.cookie=cookie;
    if(admin)headers.authorization='Bearer '+admin;
    if(method!=='GET')headers.origin=origin;
    const result=await worker.fetch(new Request('https://multilingo.example'+path,{method,headers,body:body!==undefined?JSON.stringify(body):undefined}),env);
    return {status:result.status,headers:result.headers,body:await result.json()};
  }
  return {call,db};
}

test('real SQLite DO supports private invitation, account recovery and lesson mastery',async()=>{
  const {call,db}=harness();
  const health=await call('/api/health');
  assert.equal(health.status,200);
  assert.equal(health.body.storage,'durable-objects-sqlite');
  assert.equal((await call('/api/lessons')).status,401);
  assert.equal((await call('/api/admin/invites',{method:'POST',body:{}})).status,403);
  assert.equal((await call('/api/admin/invites',{method:'POST',body:{},admin:'wrong-admin-secret'})).status,403);
  const created=await call('/api/admin/invites',{method:'POST',body:{},admin:'pilot-admin-secret-of-at-least-24-characters'});
  assert.equal(created.status,201);
  assert.match(created.body.invite,/^[a-f0-9]{64}$/);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM invites').get().c,1);
  const enrolled=await call('/api/auth/redeem',{method:'POST',body:{name:'Alex',invite:created.body.invite}});
  assert.equal(enrolled.status,200);
  assert.equal(enrolled.body.name,'Alex');
  const session=enrolled.headers.get('set-cookie').split(';')[0];
  assert.ok(session.startsWith('__Host-ml_session='));
  let lessons=await call('/api/lessons',{cookie:session});
  assert.equal(lessons.status,200);
  assert.equal(lessons.body.lessons[0].unlocked,true);
  assert.equal(lessons.body.lessons[1].unlocked,false);
  const first=lessons.body.lessons[0].id;
  const lesson=await call('/api/lessons/'+first,{cookie:session});
  assert.equal(lesson.status,200);
  const question=lesson.body.lesson.questions[0];
  assert.equal(question.answer,undefined);
  const graded=await call('/api/lessons/'+first+'/check',{method:'POST',cookie:session,body:{questionId:question.id,answer:'incorrect'}});
  assert.equal(graded.status,200);
  const all=lesson.body.lesson.questions;
  const answers=Object.fromEntries(curriculumLessons[0].questions.map(q=>[q.id,q.answer]));
  const completion=await call('/api/lessons/'+first+'/complete',{method:'POST',cookie:session,body:{answers}});
  assert.equal(completion.status,200);
  assert.equal(completion.body.passed, true);
  assert.equal(completion.body.percent, 100);
  assert.equal(db.prepare('SELECT attempts FROM progress').get().attempts,1);
  lessons=await call('/api/lessons',{cookie:session});
  assert.equal(lessons.body.lessons[1].unlocked,true);
  const signOut=await call('/api/auth/logout',{method:'POST',cookie:session,body:{}});
  assert.equal(signOut.status,200);
  assert.equal((await call('/api/lessons',{cookie:session})).status,401);
  const recovered=await call('/api/auth/redeem',{method:'POST',body:{name:'Alex',invite:created.body.invite}});
  assert.equal(recovered.status,200);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM users').get().c,1);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM sessions').get().c,1);
  assert.equal((await call('/api/lessons',{cookie:recovered.headers.get('set-cookie').split(';')[0]})).status,200);
});

test('unauthorized admin, wrong origins and exhaustion do not create invitations',async()=>{
  const {call,db}=harness();
  const wrong=await call('/api/admin/invites',{method:'POST',body:{},admin:'pilot-admin-secret-of-at-least-24-characters',origin:'https://evil.example'});
  assert.equal(wrong.status,403);
  for(let n=0;n<10;n++) {
    const issued=await call('/api/admin/invites',{method:'POST',body:{},admin:'pilot-admin-secret-of-at-least-24-characters'});
    assert.equal(issued.status,201);
  }
  assert.equal((await call('/api/admin/invites',{method:'POST',body:{},admin:'pilot-admin-secret-of-at-least-24-characters'})).status,409);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM invites').get().c,10);
});
