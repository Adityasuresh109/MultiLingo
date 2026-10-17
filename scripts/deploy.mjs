/** Deploy Worker + SQLite-backed Durable Object. Never print credentials or invite codes. */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

export function deploymentUrl(output) {
  return output.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/i)?.[0] ?? null;
}

function wrangler(args, input) {
  const executable = process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler';
  const path = new URL(`../node_modules/.bin/${executable}`, import.meta.url).pathname;
  if (!existsSync(path)) throw new Error('Run npm install before deploying.');
  const result = spawnSync(path, args, {
    encoding: 'utf8', env: process.env, input, maxBuffer: 1024 * 1024 * 8
  });
  if (result.status !== 0) {
    // Log only the final sanitized error class to avoid exposing any secret.
    const safeError = (result.stderr || '').match(/(?:Authentication error|Permission denied|Unauthorized|Error 1\d{3,5}|code:\s*\d{4,5})/i)?.[0];
    throw new Error(`Wrangler ${args.join(' ')} failed${safeError ? ': ' + safeError : ''}. Check Cloudflare Worker access and account ID in GitHub Actions.`);
  }
  return result.stdout;
}

async function main() {
  if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID)
    throw new Error('Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID Actions secret.');
  console.log('Deploying MultiLingo Worker with SQLite-backed Durable Object…');
  const url = deploymentUrl(wrangler(['deploy']));
  if (!url) throw new Error('Wrangler deploy completed but did not report a workers.dev URL.');
  console.log('Cloudflare reported Worker URL:', url);

  if (process.env.MULTILINGO_ADMIN_TOKEN) {
    if (process.env.MULTILINGO_ADMIN_TOKEN.length < 24)
      throw new Error('MULTILINGO_ADMIN_TOKEN must be a random value of at least 24 characters.');
    wrangler(['secret', 'put', 'ADMIN_TOKEN', '--name', 'multilingo'], process.env.MULTILINGO_ADMIN_TOKEN + '\n');
    console.log('Private invitation-admin secret installed.');
  } else console.log('No invite-admin secret provided; deploy is usable only after configuring MULTILINGO_ADMIN_TOKEN.');

  // Newly provisioned workers.dev hostnames can take time to propagate.
  // Log only a short sample of a public HTTP response for safe debugging.
  async function getWithRetry(path, passes, label) {
    let status = 'network error', sample = '';
    for (let attempt = 0; attempt < 7; attempt++) {
      try {
        const response = await fetch(new URL(path, url), { cache: 'no-store', signal: AbortSignal.timeout(8000) });
        status = String(response.status);
        const payload = await response.text();
        sample = payload.slice(0, 160).replace(/\\s+/g, ' ');
        if (passes(response, payload)) return;
      } catch (error) {
        status = error?.name || 'network error';
        sample = '';
      }
      if (attempt < 6) await new Promise(resolve => setTimeout(resolve, 1500));
    }
    throw new Error(`${label} failed (HTTP/status ${status}; sample: ${sample}). URL: ${url}`);
  }
  await getWithRetry('/api/health', (response, body) => {
    if (!response.ok) return false;
    try { return JSON.parse(body).storage === 'durable-objects-sqlite'; } catch { return false; }
  }, 'Live health check');
  await getWithRetry('/api/lessons', response => response.status === 401, 'Private lesson gate');
  await getWithRetry('/', response => response.ok, 'Homepage');
  console.log('Production smoke checks passed. URL:', url);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `## MultiLingo private pilot\n\n- **URL:** ${url}\n- SQLite Durable Object: configured\n- Home: pass\n- Health: pass\n- Lessons without invitation: HTTP 401 (pass)\n- Invite-admin configured: ${Boolean(process.env.MULTILINGO_ADMIN_TOKEN)}\n`);
  }
}
if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
