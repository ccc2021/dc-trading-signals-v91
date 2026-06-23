-- 品種預設止損 / 止盈點位（TradingView 沒帶指標點位時自動套用）
ALTER TABLE symbols ADD COLUMN default_stop_points REAL;
ALTER TABLE symbols ADD COLUMN default_tp_spacing REAL;

-- 黃金品種預設：止損 20 點、TP 間隔 12 點
UPDATE symbols SET default_stop_points = 20, default_tp_spacing = 12 WHERE symbol IN ('XAUUSD', 'GC');
