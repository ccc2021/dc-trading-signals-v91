-- Add manual refund tracking for paid/confirmed orders.
ALTER TABLE orders ADD COLUMN refunded_at TEXT;
ALTER TABLE orders ADD COLUMN refund_amount REAL;
ALTER TABLE orders ADD COLUMN refund_note TEXT;
ALTER TABLE orders ADD COLUMN refunded_by TEXT;
