-- AlgoPro / TradingView optional signal confidence or probability.
-- Values are stored as percentage points, e.g. 68.5 means 68.5%.
ALTER TABLE signals ADD COLUMN probability REAL;
