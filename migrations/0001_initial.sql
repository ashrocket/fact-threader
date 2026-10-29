PRAGMA foreign_keys = ON;
CREATE TABLE controls (id INTEGER PRIMARY KEY CHECK (id=1), emergency_stop INTEGER NOT NULL DEFAULT 1);
INSERT INTO controls(id,emergency_stop) VALUES (1,1);
CREATE TABLE accounts (
  id TEXT PRIMARY KEY, threads_id TEXT NOT NULL UNIQUE, username TEXT NOT NULL,
  token_cipher TEXT NOT NULL, token_expires_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'paused' CHECK(status IN ('paused','active','exhausted','attention')),
  cadence_hours INTEGER NOT NULL DEFAULT 24 CHECK(cadence_hours IN (1,6,12,24)),
  approval_id TEXT, next_due_at INTEGER, cursor INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX accounts_due ON accounts(status,next_due_at);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, csrf TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE oauth_states (state_hash TEXT PRIMARY KEY, browser_hash TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE approvals (id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, library_version TEXT NOT NULL, entries_json TEXT NOT NULL, cadence_hours INTEGER NOT NULL, approved_at INTEGER NOT NULL);
CREATE TABLE jobs (
  id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  approval_id TEXT NOT NULL, position INTEGER NOT NULL, post_text TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('claimed','retry','sending','sent','uncertain','cancelled')),
  attempt INTEGER NOT NULL DEFAULT 0, available_at INTEGER NOT NULL, lease_until INTEGER NOT NULL,
  remote_id TEXT, error_code TEXT, created_at INTEGER NOT NULL,
  UNIQUE(account_id,approval_id,position)
);
CREATE INDEX jobs_due ON jobs(status,available_at);
CREATE TABLE audit (id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, event TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX audit_account ON audit(account_id,created_at);
CREATE TABLE rate_limits (bucket TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires_at INTEGER NOT NULL);
