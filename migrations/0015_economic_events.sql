-- 經濟事件 / 財經日曆（真實來源：Forex Factory 每週 JSON）
CREATE TABLE IF NOT EXISTS economic_events (
  event_uid TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  country TEXT,
  impact TEXT,
  forecast TEXT,
  previous TEXT,
  actual TEXT,
  event_at TEXT NOT NULL,
  reminded INTEGER DEFAULT 0,
  analyzed INTEGER DEFAULT 0,
  source TEXT DEFAULT 'forexfactory',
  synced_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_econ_event_at ON economic_events(event_at);
CREATE INDEX IF NOT EXISTS idx_econ_reminded ON economic_events(reminded, event_at);
