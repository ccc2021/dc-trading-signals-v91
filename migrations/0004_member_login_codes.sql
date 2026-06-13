CREATE TABLE IF NOT EXISTS member_login_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_member_login_codes_user ON member_login_codes(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_member_login_codes_expires ON member_login_codes(expires_at);
