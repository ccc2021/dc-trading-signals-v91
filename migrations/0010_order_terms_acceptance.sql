ALTER TABLE orders ADD COLUMN terms_version TEXT;
ALTER TABLE orders ADD COLUMN terms_accepted_at TEXT;
ALTER TABLE orders ADD COLUMN risk_acknowledged_at TEXT;
ALTER TABLE orders ADD COLUMN terms_client_hash TEXT;
