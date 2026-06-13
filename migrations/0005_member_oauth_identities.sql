CREATE TABLE IF NOT EXISTS member_oauth_identities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  last_login_at TEXT,
  UNIQUE(provider, provider_user_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_member_oauth_user ON member_oauth_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_member_oauth_provider ON member_oauth_identities(provider, provider_user_id);
