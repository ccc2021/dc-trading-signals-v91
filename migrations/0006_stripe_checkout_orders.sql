ALTER TABLE orders ADD COLUMN payment_provider TEXT;
ALTER TABLE orders ADD COLUMN payment_session_id TEXT;
ALTER TABLE orders ADD COLUMN payment_url TEXT;
ALTER TABLE orders ADD COLUMN currency TEXT;
ALTER TABLE orders ADD COLUMN paid_at TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_payment_provider ON orders(payment_provider);
CREATE INDEX IF NOT EXISTS idx_orders_payment_session ON orders(payment_session_id);
