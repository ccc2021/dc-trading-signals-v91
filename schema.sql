-- ═══════════════════════════════════════════════════════════════════════════════
-- DC Trading Signals Pro v9.1
-- 用戶自主訂閱系統 - 完整資料庫
--
-- ⚠️ 此檔案為「冪等」(idempotent) - 重複執行不會刪除資料
--   - 第一次部署：建立全部資料表 + 預設資料
--   - 後續執行：略過已存在的表/索引/種子，不會洗掉用戶
--
-- 若要從乾淨狀態重建，請先手動 DROP TABLE 或刪除 D1 重新建立。
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. 用戶表 (users)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,

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
-- 2. 用戶設定表 (user_settings)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT UNIQUE NOT NULL,

  -- 資金風險設定
  capital REAL DEFAULT 10000,
  risk_percent REAL DEFAULT 1.0,

  -- 訂閱品種 (JSON陣列)
  subscribed_symbols TEXT DEFAULT '["NQ","ES","GC"]',

  -- 訊號類型偏好 (JSON陣列)
  signal_types TEXT DEFAULT '["scalp","swing"]',

  -- 通知設定
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

  -- v9.2 新增
  auto_be INTEGER DEFAULT 0,                -- TP1 達成自動建議移動止損到成本
  daily_loss_limit REAL DEFAULT 0,          -- 每日虧損上限 (點數)，0 = 不限
  max_concurrent INTEGER DEFAULT 0,         -- 同品種最大同時持倉提醒，0 = 不限
  use_photo INTEGER DEFAULT 0,              -- 收訊號圖片版本

  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. 訊號表 (signals)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS signals (
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

  -- 統計
  sent_count INTEGER DEFAULT 0,

  created_at TEXT DEFAULT (datetime('now')),
  closed_at TEXT
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. 用戶執行記錄表 (user_executions)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_executions (
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
-- 5. 績效表 (performance)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS performance (
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
-- 6. 品種資訊表 (symbols)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS symbols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_zh TEXT,
  category TEXT,
  tick_size REAL DEFAULT 0.25,
  tick_value REAL DEFAULT 5,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. 自訂群組表 (groups)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_name TEXT UNIQUE NOT NULL,
  description TEXT,
  member_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. 群組成員表 (group_members)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS group_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_name TEXT NOT NULL,
  user_id TEXT NOT NULL,
  added_at TEXT DEFAULT (datetime('now')),
  UNIQUE(group_name, user_id),
  FOREIGN KEY (group_name) REFERENCES groups(group_name),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 9. 訂單表 (orders)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  tier TEXT NOT NULL,
  months INTEGER DEFAULT 1,
  days INTEGER NOT NULL,
  amount REAL NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'confirmed', 'rejected', 'cancelled')),
  payment_method TEXT,
  payment_note TEXT,
  confirmed_by TEXT,
  confirmed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 10. 積分歷史 (point_history)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS point_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 11. 管理日誌 (admin_logs)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS admin_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  details TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 12. 系統設定 (system_config)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS system_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 13. 廣播記錄 (broadcasts)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broadcasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message TEXT NOT NULL,
  target_group TEXT DEFAULT 'all',
  sent_count INTEGER DEFAULT 0,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 14. 安靜時段待發訊號 (queued_signals)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS queued_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  signal_uid TEXT NOT NULL,
  message TEXT NOT NULL,
  scheduled_at TEXT NOT NULL,
  sent INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 索引 (CREATE INDEX IF NOT EXISTS 是 SQLite 內建支援)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_users_tier      ON users(tier);
CREATE INDEX IF NOT EXISTS idx_users_active    ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_referral  ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_expires   ON users(tier_expires_at);

CREATE INDEX IF NOT EXISTS idx_settings_user   ON user_settings(user_id);

CREATE INDEX IF NOT EXISTS idx_executions_user   ON user_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_executions_signal ON user_executions(signal_uid);

CREATE INDEX IF NOT EXISTS idx_signals_ticker  ON signals(ticker);
CREATE INDEX IF NOT EXISTS idx_signals_status  ON signals(status);
CREATE INDEX IF NOT EXISTS idx_signals_type    ON signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_signals_created ON signals(created_at);

CREATE INDEX IF NOT EXISTS idx_perf_ticker     ON performance(ticker);
CREATE INDEX IF NOT EXISTS idx_perf_result     ON performance(result);
CREATE INDEX IF NOT EXISTS idx_perf_created    ON performance(created_at);

CREATE INDEX IF NOT EXISTS idx_orders_user     ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status   ON orders(status);

CREATE INDEX IF NOT EXISTS idx_queued_user      ON queued_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_queued_scheduled ON queued_signals(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target ON admin_logs(target);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 預設資料 (用 INSERT OR IGNORE 避免重複插入造成衝突)
-- ═══════════════════════════════════════════════════════════════════════════════

-- 品種資料
INSERT OR IGNORE INTO symbols (symbol, name, name_zh, category, tick_size, tick_value, sort_order) VALUES
('NQ',  'E-mini NASDAQ-100',   '納斯達克100',  'index',  0.25,    5,    1),
('ES',  'E-mini S&P 500',      '標普500',      'index',  0.25,    12.5, 2),
('YM',  'E-mini Dow',          '道瓊工業',     'index',  1,       5,    3),
('RTY', 'E-mini Russell 2000', '羅素2000',     'index',  0.1,     5,    4),
('GC',  'Gold Futures',        '黃金',         'metal',  0.1,     10,   10),
('SI',  'Silver Futures',      '白銀',         'metal',  0.005,   25,   11),
('CL',  'Crude Oil',           '原油',         'energy', 0.01,    10,   20),
('NG',  'Natural Gas',         '天然氣',       'energy', 0.001,   10,   21),
('6E',  'Euro FX',             '歐元',         'forex',  0.00005, 6.25, 30),
('6J',  'Japanese Yen',        '日圓',         'forex',  0.0000005, 6.25, 31);

-- 預設群組
INSERT OR IGNORE INTO groups (group_name, description) VALUES
('test', '測試用戶組'),
('beta', 'Beta測試組'),
('vvip', '超級VIP');

-- 系統設定
INSERT OR IGNORE INTO system_config (key, value) VALUES
('pro_price_1m',         '299'),
('pro_price_3m',         '807'),
('pro_price_12m',        '2868'),
('vip_price_1m',         '599'),
('vip_price_3m',         '1617'),
('vip_price_12m',        '5748'),
('trial_days',           '7'),
('trial_tier',           'pro'),
('checkin_points',       '10'),
('referral_points',      '50'),
('referral_paid_points', '100'),
('points_per_day',       '100'),
('signals_paused',       '0'),
('contact_telegram',     '@Admin'),
('contact_line',         '@dcsignals'),
('payment_bank',         '國泰世華 (013)'),
('payment_account',      '123-456-789012'),
('payment_name',         '王大明'),
('welcome_message',      '歡迎使用 DC Trading Signals！'),
-- v9.2 新增系統設定
('global_be_on_tp1',     '0'),         -- TP1 達成時自動發 BE 訊息
('pin_channel_id',       ''),          -- 訊號自動 pin 的頻道 ID (空字串=不啟用)
('schema_version',       '9.2.0');
