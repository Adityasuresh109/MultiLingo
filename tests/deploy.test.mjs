import test from 'node:test';
import assert from 'node:assert/strict';
import { deploymentUrl } from '../scripts/deploy.mjs';
import { readFileSync } from 'node:fs';

test('Worker deployment output returns the correct HTTPS workers.dev URL', () => {
  assert.equal(deploymentUrl('Deployed to https://multilingo.example.workers.dev'), 'https://multilingo.example.workers.dev');
  assert.equal(deploymentUrl('deployment failed'), null);
});
test('Wrangler uses SQLite Durable Objects and no D1 dependency', () => {
  const wrangler = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  assert.deepEqual(wrangler.migrations[0].new_sqlite_classes, ['LearningStore']);
  assert.equal(wrangler.durable_objects.bindings[0].name, 'LEARNING_STORE');
  assert.equal(wrangler.d1_databases, undefined);
});
