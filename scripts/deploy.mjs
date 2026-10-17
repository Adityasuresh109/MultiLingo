/**
 * Idempotent Cloudflare deployment for GitHub Actions.
 * Never prints credentials or creates raw invitation codes in CI logs.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';

export function databaseIdFromList(rows, name) {
  assert(Array.isArray(rows), 'Expected a database array from Wrangler');
  const found = rows.find(x => x.name === name);
  if (!found) return null;
  const id = found.uuid ?? found.database_id;
  assert.match(id ?? '', /^[0-9a-f-]{36}$/i, 'D1 database UUID was not returned');
  return id;
}
export function configWithDatabase(config, databaseId) {
  assert.match(databaseId, /^[0-9a-f-]{36}$/i);
  assert(config.includes('REPLACE_WITH_D1_DATABASE_ID'), 'Wrangler config must have its original D1 placeholder');
  return config.replace('REPLACE_WITH_D1_DATABASE_ID', databaseId);
}
function run(args) {
  const executable = process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler';
  const local = new URL(`../node_modules/.bin/${executable}`, import.meta.url);
  if (!existsSync(local)) throw new Error('Run npm install before deploying.');
  const result = spawnSync(local.pathname, args, { encoding: 'utf8', env: process.env, maxBuffer: 1024 * 1024 * 8 });
  if (result.status !== 0) throw new Error(`Wrangler ${args[0]} failed: ${result.stderr.slice(-1500)}`);
  return result.stdout;
}
async function main() {
  if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID)
    throw new Error('Cloudflare API token and account ID are required. Set repository Actions secrets.');
  const name = 'multilingo';
  // Use the documented Cloudflare D1 REST API for discovery/provisioning.
  // This also distinguishes Cloudflare permission errors from Wrangler CLI regressions.
  async function d1Request(query, method = 'GET', body) {
    const account = process.env.CLOUDFLARE_ACCOUNT_ID;
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/d1/database${query}`, {
      method,
      headers: {
        authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        ...(body ? { 'content-type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.success !== true) {
      const code = payload?.errors?.[0]?.code ?? 'unknown';
      throw new Error(`D1 API access failed (HTTP ${response.status}, Cloudflare code ${code}). Verify that this GitHub Actions token has Account D1 Read and Write access for the exact CLOUDFLARE_ACCOUNT_ID. If the account and permissions are correct, investigate Cloudflare authentication error 10000.`);
    }
    return payload.result;
  }
  const found = await d1Request('?name=multilingo');
  let id = databaseIdFromList(found, name);
  if (!id) {
    console.log('Creating the MultiLingo D1 database…');
    const created = await d1Request('', 'POST', { name });
    id = databaseIdFromList([created], name);
    if (!id) throw new Error('Cloudflare did not return a D1 UUID for the new database.');
  }
  const file = new URL('../wrangler.jsonc', import.meta.url);
  writeFileSync(file, configWithDatabase(readFileSync(file, 'utf8'), id));
  console.log('D1 binding configured; applying remote migrations…');
  run(['d1', 'migrations', 'apply', name, '--remote']);
  console.log('Deploying the MultiLingo Worker and static assets…');
  const output = run(['deploy']);
  // Avoid logging potentially sensitive command output. Print only the public URL.
  const url = output.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/i)?.[0];
  if (!url) throw new Error('Deployment finished but its workers.dev address was not found in Wrangler output.');
  console.log('Deployment URL:', url);
  const health = await fetch(new URL('/api/health', url));
  if (!health.ok || (await health.json()).ok !== true) throw new Error('Production health check failed');
  const lessons = await fetch(new URL('/api/lessons', url));
  if (lessons.status !== 401) throw new Error('Security check failed: lessons are not invite gated');
  const home = await fetch(url);
  if (!home.ok) throw new Error('Production home page is unavailable');
  console.log('Production smoke checks passed: health, private lesson gate, homepage.');
  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## MultiLingo deployment\n\n- URL: ${url}\n- Health: pass\n- Unauthenticated lessons: 401 (pass)\n- Homepage: pass\n- Pilot invitation codes must be created and inserted into D1 privately.\n`);
  }
}
if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
