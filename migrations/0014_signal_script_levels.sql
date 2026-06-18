-- 訊號要記錄「是哪個 TradingView 腳本發出的」以及止盈止損點位的來源
-- （腳本提供 vs 後台估算）。worker.js 的 ensureAdminSchema 會在執行期自動補上
-- 這些欄位，這個 migration 提供給手動套用或全新部署使用。
ALTER TABLE signals ADD COLUMN strategy_label TEXT;
ALTER TABLE signals ADD COLUMN levels_source TEXT DEFAULT 'system';
