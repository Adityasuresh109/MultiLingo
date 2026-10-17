import test from 'node:test';
import assert from 'node:assert/strict';
import { databaseIdFromList, configWithDatabase } from '../scripts/deploy.mjs';
const id = 'a821740f-3447-48e3-a2b7-500f99c9089a';
test('select existing D1 database without creating duplicate',()=>{
  assert.equal(databaseIdFromList([{name:'other',uuid:id},{name:'multilingo',uuid:id}],'multilingo'),id);
  assert.equal(databaseIdFromList([],'multilingo'),null);
});
test('replace database ID placeholder in Wrangler config',()=>{
  assert.match(configWithDatabase('{"database_id":"REPLACE_WITH_D1_DATABASE_ID"}',id),new RegExp(id));
  assert.throws(()=>configWithDatabase('{"database_id":"x"}',id));
});
