-- 部分止盈狀態：0=未命中、1=TP1 已命中(保本)、2=TP2 已命中、3=TP3 出場
-- TP1/TP2 命中時移動止損保本續抱、不平倉；TP3/SL/CLOSE 才結案
ALTER TABLE signals ADD COLUMN tp_hit_level INTEGER DEFAULT 0;
