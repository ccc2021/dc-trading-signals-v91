CREATE TABLE IF NOT EXISTS strategies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  signal_types TEXT DEFAULT '["scalp"]',
  symbols TEXT DEFAULT '[]',
  tier TEXT DEFAULT 'pro' CHECK(tier IN ('free', 'pro', 'vip')),
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_strategies_active ON strategies(is_active);
CREATE INDEX IF NOT EXISTS idx_strategies_tier ON strategies(tier);

INSERT OR IGNORE INTO strategies (strategy_id, name, description, signal_types, symbols, tier, sort_order) VALUES
('scalp-core', '短線核心策略', '盤中短線訊號，重視進出場速度與風險控制。', '["scalp"]', '["NQ","ES","GC"]', 'pro', 1),
('swing-trend', '波段趨勢策略', '順勢波段訊號，適合可持倉數小時到數天的會員。', '["swing"]', '["NQ","ES","GC","CL"]', 'pro', 2),
('vip-momentum', 'VIP 動能策略', '高動能與關鍵行情提醒，含第三止盈目標。', '["scalp","daytrade"]', '["NQ","GC","CL"]', 'vip', 3);
