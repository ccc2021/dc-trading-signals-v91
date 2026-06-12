ALTER TABLE signals ADD COLUMN chart_url TEXT;
ALTER TABLE signals ADD COLUMN snapshot_url TEXT;

INSERT INTO symbols (symbol, name, name_zh, category, tick_size, tick_value, is_active, sort_order)
VALUES ('XAUUSD', 'Gold Spot / U.S. Dollar', '黃金現貨', 'metal', 0.01, 1, 1, 11)
ON CONFLICT(symbol) DO UPDATE SET
  name = excluded.name,
  name_zh = excluded.name_zh,
  category = excluded.category,
  tick_size = excluded.tick_size,
  tick_value = excluded.tick_value,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;

UPDATE strategies
SET symbols = '["NQ","ES","GC","USTEC","XAUUSD"]',
    tv_alert_template = '{"strategy":"scalp-core","ticker":"{{ticker}}","action":"{{strategy.order.action}}","price":"{{close}}","time":"{{time}}","interval":"{{interval}}"}',
    updated_at = datetime('now')
WHERE strategy_id = 'scalp-core';

UPDATE strategies
SET symbols = '["NQ","ES","GC","CL","USTEC","XAUUSD"]',
    tv_alert_template = '{"strategy":"swing-trend","ticker":"{{ticker}}","action":"{{strategy.order.action}}","price":"{{close}}","time":"{{time}}","interval":"{{interval}}"}',
    updated_at = datetime('now')
WHERE strategy_id = 'swing-trend';

UPDATE strategies
SET symbols = '["NQ","GC","CL","USTEC","XAUUSD"]',
    tv_alert_template = '{"strategy":"vip-momentum","ticker":"{{ticker}}","action":"{{strategy.order.action}}","price":"{{close}}","time":"{{time}}","interval":"{{interval}}"}',
    updated_at = datetime('now')
WHERE strategy_id = 'vip-momentum';

UPDATE tradingview_sources
SET allowed_symbols = '["NQ","ES","GC","CL","USTEC","XAUUSD"]',
    updated_at = datetime('now')
WHERE source_id = 'default-tv';
