/** SQLite-backed Durable Object storage, deliberately single instance for the <10-user pilot.
 * Keep the database contract used by the existing lesson API without requiring D1.
 */
export const INIT_SQL = `
CREATE TABLE IF NOT EXISTS invites (
  token_hash TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  claimed_by TEXT UNIQUE,
  claimed_at TEXT
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL,
  best_percent INTEGER NOT NULL DEFAULT 0 CHECK (best_percent BETWEEN 0 AND 100),
  attempts INTEGER NOT NULL DEFAULT 0,
  review_due_at INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, lesson_id)
);
`;

export function initializeStorage(sql) {
  // Initialization in a SQLite-backed DO constructor is synchronous; safe on restarts.
  sql.exec(INIT_SQL);
}

/** Bridges the old parameterized D1 query style to synchronous DO SqlStorage.
 * Consumes every cursor immediately, avoiding cross-await cursor instability.
 */
export function sqliteAdapter(ctx) {
  const sql = ctx.storage.sql;
  const execute = (query, values = []) => sql.exec(query, ...values).toArray();
  return {
    prepare(query) {
      return {
        bind(...values) {
          return {
            first: async () => execute(query, values)[0] ?? null,
            all: async () => ({results: execute(query, values)}),
            run: async () => ({results: execute(query, values)})
          };
        }
      };
    }
  };
}

/** Our own synchronous query representation for correctly atomic multi-statement writes. */
export function atomicClaim(ctx, { inviteHash, userId, displayName, sessionHash, expiresAt }) {
  const sql = ctx.storage.sql;
  return ctx.storage.transactionSync(() => {
    const updated = sql.exec('UPDATE invites SET claimed_by = ?, claimed_at = datetime(\'now\') WHERE token_hash = ? AND claimed_by IS NULL RETURNING token_hash', userId, inviteHash).toArray();
    if (updated.length !== 1) return false;
    sql.exec('INSERT INTO users(id, display_name) VALUES (?, ?)', userId, displayName).toArray();
    sql.exec('INSERT INTO sessions(token_hash, user_id, expires_at) VALUES (?, ?, ?)', sessionHash, userId, expiresAt).toArray();
    return true;
  });
}
