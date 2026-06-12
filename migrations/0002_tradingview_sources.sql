ALTER TABLE strategies ADD COLUMN rules_json TEXT DEFAULT '{"riskPoints":30,"targetR":[1,2,3],"entryMode":"close"}';
ALTER TABLE strategies ADD COLUMN tv_alert_template TEXT;

ALTER TABLE signals ADD COLUMN source TEXT;
ALTER TABLE signals ADD COLUMN strategy_id TEXT;
ALTER TABLE signals ADD COLUMN tv_alert_uid TEXT;

CREATE TABLE IF NOT EXISTS tradingview_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  webhook_secret TEXT NOT NULL,
  default_strategy_id TEXT,
  allowed_symbols TEXT DEFAULT '[]',
  default_signal_type TEXT DEFAULT 'auto',
  target_group TEXT DEFAULT 'pro',
  auto_send INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (default_strategy_id) REFERENCES strategies(strategy_id)
);

CREATE TABLE IF NOT EXISTS tv_alert_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_uid TEXT NOT NULL,
  source_id TEXT NOT NULL,
  strategy_id TEXT,
  ticker TEXT,
  action TEXT,
  payload TEXT,
  signal_uid TEXT,
  status TEXT DEFAULT 'received',
  error TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(source_id, alert_uid)
);

CREATE INDEX IF NOT EXISTS idx_tv_sources_active ON tradingview_sources(is_active);
CREATE INDEX IF NOT EXISTS idx_tv_logs_source ON tv_alert_logs(source_id);
CREATE INDEX IF NOT EXISTS idx_tv_logs_created ON tv_alert_logs(created_at);

UPDATE strategies
SET rules_json = '{"riskPoints":30,"targetR":[1,2,3],"entryMode":"close","timeframes":["1","3","5","15"]}',
    tv_alert_template = '{"secret":"{{secret}}","strategy":"scalp-core","ticker":"{{ticker}}","action":"{{strategy.order.action}}","price":"{{close}}","time":"{{time}}","interval":"{{interval}}"}'
WHERE strategy_id = 'scalp-core';

UPDATE strategies
SET rules_json = '{"riskPoints":75,"targetR":[1,2,3],"entryMode":"close","timeframes":["60","120","240","D"]}',
    tv_alert_template = '{"secret":"{{secret}}","strategy":"swing-trend","ticker":"{{ticker}}","action":"{{strategy.order.action}}","price":"{{close}}","time":"{{time}}","interval":"{{interval}}"}'
WHERE strategy_id = 'swing-trend';

UPDATE strategies
SET rules_json = '{"riskPoints":45,"targetR":[1,2,3.5],"entryMode":"close","timeframes":["5","15","30","60"]}',
    tv_alert_template = '{"secret":"{{secret}}","strategy":"vip-momentum","ticker":"{{ticker}}","action":"{{strategy.order.action}}","price":"{{close}}","time":"{{time}}","interval":"{{interval}}"}'
WHERE strategy_id = 'vip-momentum';
