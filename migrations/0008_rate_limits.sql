CREATE TABLE IF NOT EXISTS rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rate_key TEXT UNIQUE NOT NULL,
  count INTEGER DEFAULT 0,
  reset_at_ms INTEGER NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON rate_limits(reset_at_ms);
