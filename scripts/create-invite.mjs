/** Generates ONE high-entropy, single-use invitation. Does not contact Cloudflare. */
import { randomBytes, createHash } from 'node:crypto';
const invite = randomBytes(32).toString('hex');
const hash = createHash('sha256').update(invite).digest('hex');
console.log('ONE-TIME INVITATION (share privately with one learner):');
console.log(invite);
console.log('\nRun this SQL in the Cloudflare D1 console or via wrangler:');
console.log(`INSERT INTO invites(token_hash) VALUES ('${hash}');`);
console.log('\nNever commit the invitation token to GitHub.');
