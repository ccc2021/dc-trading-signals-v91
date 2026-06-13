ALTER TABLE users ADD COLUMN telegram_user_id TEXT;
ALTER TABLE users ADD COLUMN telegram_linked_at TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram_user ON users(telegram_user_id);
