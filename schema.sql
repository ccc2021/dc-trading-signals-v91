-- ═══════════════════════════════════════════════════════════════════════════════
-- DC Trading Signals Pro v9.1
-- 用戶自主訂閱系統 - 完整資料庫
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. 用戶表 (users)
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  telegram_user_id TEXT,
  telegram_linked_at TEXT,
  
  -- 會員等級 (free/pro/vip)
  tier TEXT DEFAULT 'free' CHECK(tier IN ('free', 'pro', 'vip')),
  tier_expires_at TEXT,
  
  -- 積分
  points INTEGER DEFAULT 0,
  
  -- 推薦系統
  referral_code TEXT UNIQUE,
  referred_by TEXT,
  referral_count INTEGER DEFAULT 0,
  
  -- 狀態
  is_active INTEGER DEFAULT 1,
  is_banned INTEGER DEFAULT 0,
  
  -- 統計
  total_signals INTEGER DEFAULT 0,
  total_spent REAL DEFAULT 0,
  last_checkin_at TEXT,
  last_active_at TEXT,
  
  -- 管理備註
  admin_note TEXT,
  
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. 用戶設定表 (user_settings) ★新增
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS user_settings;
CREATE TABLE user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT UNIQUE NOT NULL,
  
  -- 資金風險設定
  capital REAL DEFAULT 10000,
  risk_percent REAL DEFAULT 1.0,
  
  -- 訂閱品種 (JSON陣列)
  subscribed_symbols TEXT DEFAULT '["NQ","ES","GC","USTEC","XAUUSD","ETH"]',
  
  -- 訊號類型偏好 (JSON陣列)
  signal_types TEXT DEFAULT '["scalp","swing"]',
  
  -- 通知設定 (JSON物件)
  notify_entry INTEGER DEFAULT 1,
  notify_tp INTEGER DEFAULT 1,
  notify_sl INTEGER DEFAULT 1,
  notify_update INTEGER DEFAULT 1,
  notify_daily_report INTEGER DEFAULT 1,
  notify_weekly_report INTEGER DEFAULT 0,
  notify_announcement INTEGER DEFAULT 1,
  notify_alert INTEGER DEFAULT 1,
  
  -- 安靜時段
  quiet_enabled INTEGER DEFAULT 0,
  quiet_start TEXT DEFAULT '23:00',
  quiet_end TEXT DEFAULT '07:00',
  
  -- 暫停接收
  paused INTEGER DEFAULT 0,
  
  -- 時區與語言
  timezone TEXT DEFAULT 'Asia/Taipei',
  language TEXT DEFAULT 'zh-TW',
  
  updated_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. 用戶執行記錄表 (user_executions) ★新增
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS user_executions;
CREATE TABLE user_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  signal_uid TEXT NOT NULL,
  
  -- 執行狀態
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'executed', 'skipped')),
  
  -- 實際執行資料
  actual_entry REAL,
  actual_contracts REAL,
  actual_exit REAL,
  actual_pnl REAL,
  
  -- 筆記
  notes TEXT,
  
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  UNIQUE(user_id, signal_uid),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (signal_uid) REFERENCES signals(signal_uid)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. 訊號表 (signals)
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS signals;
CREATE TABLE signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  signal_uid TEXT UNIQUE NOT NULL,
  
  -- 訊號內容
  ticker TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('LONG', 'SHORT')),
  signal_type TEXT DEFAULT 'scalp' CHECK(signal_type IN ('scalp', 'swing', 'daytrade')),
  
  entry_price REAL NOT NULL,
  stop_loss REAL NOT NULL,
  tp1 REAL,
  tp2 REAL,
  tp3 REAL,
  
  -- 備註
  note TEXT,
  chart_url TEXT,
  snapshot_url TEXT,
  
  -- 發送目標
  target_group TEXT DEFAULT 'all',
  is_vip_only INTEGER DEFAULT 0,
  
  -- 狀態
  status TEXT DEFAULT 'active' CHECK(status IN ('pending', 'active', 'closed', 'cancelled')),
  
  -- 結果
  exit_price REAL,
  exit_reason TEXT,
  pnl_points REAL,
  result TEXT CHECK(result IN ('win', 'loss', 'breakeven', NULL)),

  -- 部分止盈：0=未命中、1=TP1(保本)、2=TP2、3=TP3 出場
  tp_hit_level INTEGER DEFAULT 0,

  -- 統計
  sent_count INTEGER DEFAULT 0,
  
  created_at TEXT DEFAULT (datetime('now')),
  closed_at TEXT
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. 績效表 (performance)
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS performance;
CREATE TABLE performance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  signal_uid TEXT NOT NULL,
  ticker TEXT NOT NULL,
  direction TEXT NOT NULL,
  signal_type TEXT,
  entry_price REAL NOT NULL,
  exit_price REAL NOT NULL,
  pnl_points REAL,
  result TEXT CHECK(result IN ('win', 'loss', 'breakeven')),
  exit_reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (signal_uid) REFERENCES signals(signal_uid)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. 品種資訊表 (symbols) ★新增
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS symbols;
CREATE TABLE symbols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_zh TEXT,
  category TEXT,
  tick_size REAL DEFAULT 0.25,
  tick_value REAL DEFAULT 5,
  default_stop_points REAL,
  default_tp_spacing REAL,
  default_level_mode TEXT DEFAULT 'auto',
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. 策略表 (strategies)
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS strategies;
CREATE TABLE strategies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  signal_types TEXT DEFAULT '["scalp"]',
  symbols TEXT DEFAULT '[]',
  tier TEXT DEFAULT 'pro' CHECK(tier IN ('free', 'pro', 'vip')),
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  rules_json TEXT DEFAULT '{"riskPoints":30,"targetR":[1,2,3],"entryMode":"close"}',
  tv_alert_template TEXT,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7A. TradingView 來源綁定 (tradingview_sources)
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS tradingview_sources;
CREATE TABLE tradingview_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  webhook_secret TEXT NOT NULL,
  default_strategy_id TEXT,
  allowed_symbols TEXT DEFAULT '[]',
  default_signal_type TEXT DEFAULT 'auto',
  target_group TEXT DEFAULT 'pro',
  auto_send INTEGER DEFAULT 1,
  is_active INTEGER DEFAULT 1,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (default_strategy_id) REFERENCES strategies(strategy_id)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7B. TradingView Alert 日誌 (tv_alert_logs)
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS tv_alert_logs;
CREATE TABLE tv_alert_logs (
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

-- 8b. 經濟事件 / 財經日曆 (economic_events)
-- 真實來源：Forex Factory 每週 JSON，由排程每小時同步並在高影響事件前提醒
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS economic_events;
CREATE TABLE economic_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_uid TEXT UNIQUE NOT NULL,
  event_date TEXT NOT NULL,
  event_time TEXT,
  timezone TEXT DEFAULT 'Asia/Taipei',
  country TEXT,
  currency TEXT,
  title TEXT NOT NULL,
  impact TEXT DEFAULT 'medium',
  actual TEXT,
  forecast TEXT,
  previous TEXT,
  source TEXT DEFAULT 'manual',
  source_url TEXT,
  status TEXT DEFAULT 'scheduled',
  notes TEXT,
  reminded_at TEXT,
  pre_reminded_at TEXT,
  synced_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_economic_events_date ON economic_events(event_date);
CREATE INDEX idx_economic_events_time ON economic_events(event_time);
CREATE INDEX idx_economic_events_impact ON economic_events(impact);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7C. 自動交易指令佇列 (auto_trade_orders)
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS auto_trade_orders;
CREATE TABLE auto_trade_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command_id TEXT UNIQUE NOT NULL,
  signal_uid TEXT NOT NULL,
  ticker TEXT,
  action TEXT,
  broker TEXT DEFAULT 'exness-mt5',
  account TEXT,
  mode TEXT DEFAULT 'paper',
  volume REAL,
  risk_percent REAL,
  entry_price REAL,
  stop_loss REAL,
  tp1 REAL,
  tp2 REAL,
  tp3 REAL,
  status TEXT DEFAULT 'queued',
  attempts INTEGER DEFAULT 0,
  request_payload TEXT,
  response_payload TEXT,
  last_error TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  sent_at TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (signal_uid) REFERENCES signals(signal_uid)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. 自訂群組表 (groups)
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS groups;
CREATE TABLE groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_name TEXT UNIQUE NOT NULL,
  description TEXT,
  member_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 9. 群組成員表 (group_members)
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS group_members;
CREATE TABLE group_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_name TEXT NOT NULL,
  user_id TEXT NOT NULL,
  added_at TEXT DEFAULT (datetime('now')),
  UNIQUE(group_name, user_id),
  FOREIGN KEY (group_name) REFERENCES groups(group_name),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 10. 訂單表 (orders)
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS orders;
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  tier TEXT NOT NULL,
  months INTEGER DEFAULT 1,
  days INTEGER NOT NULL,
  amount REAL NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'confirmed', 'rejected', 'cancelled')),
  payment_method TEXT,
  payment_provider TEXT,
  payment_session_id TEXT,
  payment_url TEXT,
  currency TEXT,
  payment_note TEXT,
  paid_at TEXT,
  refunded_at TEXT,
  refund_amount REAL,
  refund_note TEXT,
  refunded_by TEXT,
  terms_version TEXT,
  terms_accepted_at TEXT,
  risk_acknowledged_at TEXT,
  terms_client_hash TEXT,
  confirmed_by TEXT,
  confirmed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 10a. 訂單事件紀錄 (order_events)
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS order_events;
CREATE TABLE order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  user_id TEXT,
  event_type TEXT NOT NULL,
  actor_id TEXT,
  message TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 10b. 客服工單 (support_tickets)
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS support_tickets;
CREATE TABLE support_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK(status IN ('open', 'pending', 'closed')),
  priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
  last_reply TEXT,
  last_actor_id TEXT,
  closed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

DROP TABLE IF EXISTS support_replies;
CREATE TABLE support_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK(actor_type IN ('user', 'admin', 'system')),
  actor_id TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(ticket_id)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 10c. 會員中心一次性登入碼 (member_login_codes)
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS member_login_codes;
CREATE TABLE member_login_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 10d. 會員中心第三方登入身份 (member_oauth_identities)
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS member_oauth_identities;
CREATE TABLE member_oauth_identities (
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

-- ═══════════════════════════════════════════════════════════════════════════════
-- 10e. 會員中心網站帳號 (member_password_accounts)
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS member_password_accounts;
CREATE TABLE member_password_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  user_id TEXT UNIQUE NOT NULL,
  display_name TEXT,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  iterations INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  last_login_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 11. 積分歷史 (point_history)
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS point_history;
CREATE TABLE point_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 12. 管理日誌 (admin_logs)
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS admin_logs;
CREATE TABLE admin_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  details TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 13. 系統設定 (system_config)
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS system_config;
CREATE TABLE system_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 13a. API 速率限制 (rate_limits)
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS rate_limits;
CREATE TABLE rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rate_key TEXT UNIQUE NOT NULL,
  count INTEGER DEFAULT 0,
  reset_at_ms INTEGER NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 14. 廣播記錄 (broadcasts)
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS broadcasts;
CREATE TABLE broadcasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message TEXT NOT NULL,
  target_group TEXT DEFAULT 'all',
  sent_count INTEGER DEFAULT 0,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 15. 安靜時段待發訊號 (queued_signals) ★新增
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS queued_signals;
CREATE TABLE queued_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  signal_uid TEXT NOT NULL,
  message TEXT NOT NULL,
  photo_url TEXT,
  scheduled_at TEXT NOT NULL,
  sent INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 索引
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX idx_users_tier ON users(tier);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_users_referral ON users(referral_code);
CREATE INDEX idx_users_expires ON users(tier_expires_at);
CREATE UNIQUE INDEX idx_users_telegram_user ON users(telegram_user_id);

CREATE INDEX idx_settings_user ON user_settings(user_id);

CREATE INDEX idx_executions_user ON user_executions(user_id);
CREATE INDEX idx_executions_signal ON user_executions(signal_uid);

CREATE INDEX idx_signals_ticker ON signals(ticker);
CREATE INDEX idx_signals_status ON signals(status);
CREATE INDEX idx_signals_type ON signals(signal_type);
CREATE INDEX idx_signals_created ON signals(created_at);

CREATE INDEX idx_perf_ticker ON performance(ticker);
CREATE INDEX idx_perf_result ON performance(result);
CREATE INDEX idx_perf_created ON performance(created_at);

CREATE INDEX idx_strategies_active ON strategies(is_active);
CREATE INDEX idx_strategies_tier ON strategies(tier);

CREATE INDEX idx_tv_sources_active ON tradingview_sources(is_active);
CREATE INDEX idx_tv_logs_source ON tv_alert_logs(source_id);
CREATE INDEX idx_tv_logs_created ON tv_alert_logs(created_at);
CREATE INDEX idx_auto_trade_signal ON auto_trade_orders(signal_uid);
CREATE INDEX idx_auto_trade_status ON auto_trade_orders(status, created_at);
CREATE INDEX idx_auto_trade_created ON auto_trade_orders(created_at);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_provider ON orders(payment_provider);
CREATE INDEX idx_orders_payment_session ON orders(payment_session_id);
CREATE INDEX idx_order_events_order ON order_events(order_id, created_at);
CREATE INDEX idx_order_events_created ON order_events(created_at);
CREATE INDEX idx_support_tickets_user ON support_tickets(user_id, created_at);
CREATE INDEX idx_support_tickets_status ON support_tickets(status, updated_at);
CREATE INDEX idx_support_replies_ticket ON support_replies(ticket_id, created_at);
CREATE INDEX idx_member_login_codes_user ON member_login_codes(user_id, created_at);
CREATE INDEX idx_member_login_codes_expires ON member_login_codes(expires_at);
CREATE INDEX idx_member_oauth_user ON member_oauth_identities(user_id);
CREATE INDEX idx_member_oauth_provider ON member_oauth_identities(provider, provider_user_id);
CREATE INDEX idx_member_password_email ON member_password_accounts(email);
CREATE INDEX idx_member_password_user ON member_password_accounts(user_id);
CREATE INDEX idx_rate_limits_reset ON rate_limits(reset_at_ms);

CREATE INDEX idx_queued_user ON queued_signals(user_id);
CREATE INDEX idx_queued_scheduled ON queued_signals(scheduled_at);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 預設資料
-- ═══════════════════════════════════════════════════════════════════════════════

-- 品種資料
INSERT INTO symbols (symbol, name, name_zh, category, tick_size, tick_value, sort_order) VALUES
('NQ', 'E-mini NASDAQ-100', '納斯達克100', 'index', 0.25, 5, 1),
('ES', 'E-mini S&P 500', '標普500', 'index', 0.25, 12.5, 2),
('YM', 'E-mini Dow', '道瓊工業', 'index', 1, 5, 3),
('RTY', 'E-mini Russell 2000', '羅素2000', 'index', 0.1, 5, 4),
('GC', 'Gold Futures', '黃金', 'metal', 0.1, 10, 10),
('XAUUSD', 'Gold Spot / U.S. Dollar', '黃金現貨', 'metal', 0.01, 1, 11),
('SI', 'Silver Futures', '白銀', 'metal', 0.005, 25, 12),
('CL', 'Crude Oil', '原油', 'energy', 0.01, 10, 20),
('NG', 'Natural Gas', '天然氣', 'energy', 0.001, 10, 21),
('6E', 'Euro FX', '歐元', 'forex', 0.00005, 6.25, 30),
('6J', 'Japanese Yen', '日圓', 'forex', 0.0000005, 6.25, 31),
('ETH', 'Ethereum CFD', '以太坊', 'crypto', 0.01, 1, 41);

-- 黃金品種預設止損 / 止盈點位（無指標點位時自動套用：止損 20 點、TP 間隔 12 點）
UPDATE symbols SET default_stop_points = 20, default_tp_spacing = 12 WHERE symbol IN ('XAUUSD', 'GC');

-- 預設群組
INSERT INTO groups (group_name, description) VALUES 
('test', '測試用戶組'),
('beta', 'Beta測試組'),
('vvip', '超級VIP');

-- 預設策略
INSERT INTO strategies (strategy_id, name, description, signal_types, symbols, tier, sort_order, rules_json, tv_alert_template) VALUES
('scalp-core', '短線核心策略', '盤中短線訊號，重視進出場速度與風險控制。', '["scalp"]', '["NQ","ES","GC","USTEC","XAUUSD","ETH"]', 'pro', 1, '{"riskPoints":30,"targetR":[1,2,3],"entryMode":"close","timeframes":["1","3","5","15"]}', '{"strategy":"scalp-core","ticker":"{{ticker}}","action":"{{strategy.order.action}}","price":"{{close}}","time":"{{time}}","interval":"{{interval}}"}'),
('algo-pro-v1-4', 'AlgoPro V1.4', '串接 TradingView 既有 AlgoPro 指標，使用 Data Window plot 回傳實際 SL/TP。', '["scalp","daytrade"]', '["USTEC","XAUUSD","NQ","GC","ETH"]', 'pro', 2, '{"riskPoints":30,"targetR":[1,2,3],"entryMode":"tradingview","levelSource":"smart-directional-plot","requiresExplicitLevels":true,"timeframes":["1","3","5","15"]}', '{"secret":"{{secret}}","source_id":"{{source_id}}","strategy":"{{strategy_id}}","event":"entry","ticker":"{{ticker}}","exchange":"{{exchange}}","action":"{{strategy.order.action}}","order_id":"{{strategy.order.id}}","order_comment":"{{strategy.order.comment}}","entry_price":"{{strategy.order.price}}","order_price":"{{strategy.order.price}}","price":"{{strategy.order.price}}","close":"{{close}}","long_stop_loss":"{{plot_10}}","short_stop_loss":"{{plot_11}}","long_tp1":"{{plot_12}}","short_tp1":"{{plot_13}}","long_tp2":"{{plot_14}}","short_tp2":"{{plot_15}}","long_tp3":"{{plot_16}}","short_tp3":"{{plot_17}}","contracts":"{{strategy.order.contracts}}","market_position":"{{strategy.market_position}}","prev_market_position":"{{strategy.prev_market_position}}","time":"{{time}}","interval":"{{interval}}","alert_id":"{{ticker}}-{{time}}-{{strategy_id}}-{{strategy.order.id}}-{{strategy.order.comment}}","mapping_note":"Smart directional template: backend selects long_* or short_* by order action."}'),
('swing-trend', '波段趨勢策略', '順勢波段訊號，適合可持倉數小時到數天的會員。', '["swing"]', '["NQ","ES","GC","CL","USTEC","XAUUSD","ETH"]', 'pro', 2, '{"riskPoints":75,"targetR":[1,2,3],"entryMode":"close","timeframes":["60","120","240","D"]}', '{"strategy":"swing-trend","ticker":"{{ticker}}","action":"{{strategy.order.action}}","price":"{{close}}","time":"{{time}}","interval":"{{interval}}"}'),
('vip-momentum', 'VIP 動能策略', '高動能與關鍵行情提醒，含第三止盈目標。', '["scalp","daytrade"]', '["NQ","GC","CL","USTEC","XAUUSD","ETH"]', 'vip', 3, '{"riskPoints":45,"targetR":[1,2,3.5],"entryMode":"close","timeframes":["5","15","30","60"]}', '{"strategy":"vip-momentum","ticker":"{{ticker}}","action":"{{strategy.order.action}}","price":"{{close}}","time":"{{time}}","interval":"{{interval}}"}'),
('bb-squeeze-breakout', 'BB Squeeze 突破共振', '串接 TradingView BB Squeeze 突破共振系統；目前需 Pine 補 TP hidden plot 才能正式發送。', '["scalp","daytrade"]', '["USTEC","XAUUSD","NQ","GC","ETH"]', 'pro', 4, '{"riskPoints":30,"targetR":[1,2,3],"entryMode":"tradingview","levelSource":"plot","requiresExplicitLevels":true,"needsTpPlots":true}', '{"strategy":"bb-squeeze-breakout","ticker":"{{ticker}}","action":"{{strategy.order.action}}","entry_price":"{{close}}","stop_loss":"{{plot_6_or_7}}","tp1":"ADD_TP1_PLOT_TO_PINE","tp2":"ADD_TP2_PLOT_TO_PINE","tp3":"ADD_TP3_PLOT_TO_PINE","time":"{{time}}","interval":"{{interval}}"}'),
('ict-silver-bullet-2026', 'ICT Silver Bullet 2026', '串接 TradingView ICT Advanced Silver Bullet；需 alert_message 或 hidden plot 回傳 SL/TP。', '["scalp","daytrade"]', '["XAUUSD","GC","USTEC","NQ","ETH"]', 'pro', 5, '{"riskPoints":30,"targetR":[1,2,3],"entryMode":"tradingview","levelSource":"alert_message","requiresExplicitLevels":true,"needsAlertMessage":true}', '{"strategy":"ict-silver-bullet-2026","ticker":"{{ticker}}","action":"{{strategy.order.action}}","entry_price":"{{strategy.order.price}}","stop_loss":"ADD_SL_TO_PINE_ALERT","tp1":"ADD_TP1_TO_PINE_ALERT","tp2":"ADD_TP2_TO_PINE_ALERT","tp3":"ADD_TP3_TO_PINE_ALERT","time":"{{time}}","interval":"{{interval}}"}');

-- 系統設定
INSERT INTO system_config (key, value) VALUES
('pro_price_1m', '299'),
('pro_price_3m', '807'),
('pro_price_12m', '2868'),
('vip_price_1m', '599'),
('vip_price_3m', '1617'),
('vip_price_12m', '5748'),
('trial_days', '7'),
('trial_tier', 'pro'),
('checkin_points', '10'),
('referral_points', '50'),
('referral_paid_points', '100'),
('points_per_day', '100'),
('signals_paused', '0'),
('auto_trade_enabled', '0'),
('auto_trade_mode', 'paper'),
('auto_trade_bridge_url', ''),
('auto_trade_bridge_secret', ''),
('auto_trade_account', ''),
('auto_trade_default_volume', '0.01'),
('auto_trade_risk_percent', '1'),
('auto_trade_max_orders_per_day', '20'),
('auto_trade_allowed_symbols', ''),
('auto_trade_allowed_strategies', ''),
('economic_calendar_source_url', 'https://nfs.faireconomy.media/ff_calendar_thisweek.json'),
('economic_calendar_source_name', 'Forex Factory'),
('economic_calendar_auto_remind', '1'),
('economic_calendar_remind_hour', '8'),
('economic_calendar_target_group', 'paid'),
('economic_calendar_impacts', 'high,medium'),
('economic_calendar_currencies', 'USD,EUR,GBP,JPY,CAD,AUD,CNY'),
('economic_calendar_countries', ''),
('economic_calendar_pre_event_minutes', '30'),
('economic_calendar_lookahead_days', '1'),
('contact_telegram', '@Admin'),
('contact_line', '@dcsignals'),
('public_base_url', 'https://dc-signals-v91.cc559773.workers.dev'),
('payment_manual_enabled', '1'),
('payment_bank', '國泰世華 (013)'),
('payment_bank_branch', ''),
('payment_account', '123-456-789012'),
('payment_name', '王大明'),
('payment_transfer_note', '轉帳後請在訂單填寫後五碼與付款時間，客服確認後會開通會員。'),
('payment_crypto_enabled', '0'),
('payment_crypto_asset', 'USDT'),
('payment_crypto_network', 'TRC20'),
('payment_crypto_wallet', ''),
('payment_crypto_memo', ''),
('payment_crypto_rate_note', '請依付款當下匯率換算，實收以客服確認為準'),
('payment_crypto_note', '請務必確認鏈別正確，鏈別錯誤可能無法追回。'),
('welcome_message', '歡迎使用 DC Trading Signals！');
