-- ═══════════════════════════════════════════════════════════════════════════════
-- v9.2.0 升級遷移
-- 用於從 v9.1.x 既有 DB 升級到 v9.2.0
--
-- ⚠️ SQLite 沒有 ADD COLUMN IF NOT EXISTS。若欄位已存在會回 "duplicate column"
--   錯誤，這是【正常的】，可以安全忽略。
--
-- 執行：
--   wrangler d1 execute trading-signals-db --remote --file=migrations.sql
-- 或在 Bot 內以管理員身份執行：
--   /selftest      （會自動補上缺少的欄位，並回報結果）
-- ═══════════════════════════════════════════════════════════════════════════════

-- user_settings 新欄位
ALTER TABLE user_settings ADD COLUMN auto_be          INTEGER DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN daily_loss_limit REAL    DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN max_concurrent   INTEGER DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN use_photo        INTEGER DEFAULT 0;

-- 新增系統設定 (INSERT OR IGNORE 不會覆蓋既有值)
INSERT OR IGNORE INTO system_config (key, value) VALUES
('global_be_on_tp1', '0'),
('pin_channel_id',   ''),
('schema_version',   '9.2.0');

-- 補上 v9.1.1 之後加的索引（idempotent）
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target ON admin_logs(target);
