-- 品種推算模式：auto（有固定點位用固定，否則 R 倍數）/ fixed（固定點位）/ rmultiple（riskPoints × targetR）
ALTER TABLE symbols ADD COLUMN default_level_mode TEXT DEFAULT 'auto';

-- TradingView 來源改為自動發送：抓到進場位即推播（可在後台改回草稿）
UPDATE tradingview_sources SET auto_send = 1 WHERE auto_send = 0;
INSERT OR REPLACE INTO system_config (key, value, updated_at) VALUES ('tv_autosend_migrated', '1', datetime('now'));

-- 註：VIP 事件解讀旗標 economic_events.analyzed 已包含在 0015_economic_events.sql 的建表中。
