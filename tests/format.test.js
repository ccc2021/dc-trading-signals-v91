import { describe, it, expect } from 'vitest';
import {
  formatSignalCard, formatExitCard, formatDailyReport, formatWeeklyReport,
  fmtPrice, fmtNum, daysLeft, parseJSON
} from '../worker.js';

const baseSignal = {
  signal_uid: 'TEST123',
  ticker: 'NQ',
  action: 'LONG',
  signal_type: 'scalp',
  entry_price: 21500,
  stop_loss: 21480,
  tp1: 21520,
  tp2: 21540,
  tp3: 21560,
  is_vip_only: 0
};

describe('formatSignalCard', () => {
  it('包含基本欄位', () => {
    const out = formatSignalCard(baseSignal);
    expect(out).toContain('LONG');
    expect(out).toContain('NQ');
    expect(out).toContain('21500');
    expect(out).toContain('21480');
    expect(out).toContain('TP1');
  });

  it('Pro 不顯示 TP3 (isVip=false)', () => {
    const out = formatSignalCard(baseSignal, null, false);
    expect(out).not.toContain('21560');
  });

  it('VIP 顯示 TP3', () => {
    const out = formatSignalCard(baseSignal, null, true);
    expect(out).toContain('21560');
  });

  it('VIP 專屬訊號用雙線框', () => {
    const out = formatSignalCard({ ...baseSignal, is_vip_only: 1 }, null, true);
    expect(out).toContain('VIP 專屬');
  });

  it('帶 user settings 顯示口數建議 (NQ tickValue=5 fallback)', () => {
    const out = formatSignalCard(baseSignal, { capital: 10000, risk_percent: 1 }, false);
    expect(out).toContain('您的交易參考');
    expect(out).toContain('1.00 口');
  });

  it('使用 symbolMeta.tick_value 而非 CONFIG fallback', () => {
    // 自定 tick_value=10 → 100 risk / (20 * 10) = 0.5 口
    const out = formatSignalCard(baseSignal, { capital: 10000, risk_percent: 1 }, false, { tick_value: 10 });
    expect(out).toContain('0.50 口');
  });
});

describe('formatExitCard', () => {
  it('TP1 含獲利符號', () => {
    const out = formatExitCard('TP1', 'NQ', 21520, 20, '');
    expect(out).toContain('TP1');
    expect(out).toContain('NQ');
    expect(out).toContain('+20');
  });

  it('SL 含虧損標記', () => {
    const out = formatExitCard('SL', 'NQ', 21480, -20, '');
    expect(out).toContain('SL');
    expect(out).toContain('-20');
  });
});

describe('formatDailyReport', () => {
  it('零交易顯示 0%', () => {
    const out = formatDailyReport({ total: 0, wins: 0, losses: 0, pnl: 0 });
    expect(out).toContain('總交易  │ 0');
    expect(out).toContain('0.0%');
  });

  it('60% 勝率加火焰', () => {
    const out = formatDailyReport({ total: 10, wins: 6, losses: 4, pnl: 30 });
    expect(out).toContain('60.0%');
    expect(out).toContain('🔥');
  });

  it('低勝率不加火焰', () => {
    const out = formatDailyReport({ total: 10, wins: 4, losses: 6, pnl: -10 });
    expect(out).not.toContain('🔥');
    expect(out).toContain('-10');
  });
});

describe('formatWeeklyReport', () => {
  it('包含週標題', () => {
    const out = formatWeeklyReport({ total: 5, wins: 3, losses: 2, pnl: 12 }, []);
    expect(out).toContain('每週績效報告');
    expect(out).toContain('近 7 日');
  });

  it('per-symbol 區段顯示品種', () => {
    const out = formatWeeklyReport(
      { total: 5, wins: 3, losses: 2, pnl: 12 },
      [{ ticker: 'NQ', total: 3, wins: 2, pnl: 10 }, { ticker: 'ES', total: 2, wins: 1, pnl: 2 }]
    );
    expect(out).toContain('NQ');
    expect(out).toContain('ES');
    expect(out).toContain('各品種');
  });

  it('空 perSymbol 不渲染分區', () => {
    const out = formatWeeklyReport({ total: 0, wins: 0, losses: 0, pnl: 0 }, []);
    expect(out).not.toContain('各品種');
  });
});

describe('fmtPrice / fmtNum', () => {
  it('fmtPrice 兩位小數', () => {
    expect(fmtPrice(21500)).toBe('21500.00');
    expect(fmtPrice(21500.123)).toBe('21500.12');
  });
  it('fmtNum 千分位', () => {
    expect(fmtNum(1234567)).toBe('1,234,567');
  });
  it('fmtPrice null 安全', () => {
    expect(fmtPrice(null)).toBe('0.00');
  });
});

describe('daysLeft', () => {
  it('未來日期回正數', () => {
    const future = new Date(Date.now() + 7 * 86400000).toISOString();
    expect(daysLeft(future)).toBeGreaterThanOrEqual(6);
    expect(daysLeft(future)).toBeLessThanOrEqual(8);
  });
  it('過去日期回 0', () => {
    const past = new Date(Date.now() - 7 * 86400000).toISOString();
    expect(daysLeft(past)).toBe(0);
  });
  it('null 回 0', () => {
    expect(daysLeft(null)).toBe(0);
  });
});

describe('parseJSON', () => {
  it('合法 JSON 解析陣列', () => {
    expect(parseJSON('["NQ","ES"]')).toEqual(['NQ', 'ES']);
  });
  it('非法 JSON 回 default', () => {
    expect(parseJSON('not json', ['fallback'])).toEqual(['fallback']);
  });
  it('預設 fallback 為空陣列', () => {
    expect(parseJSON('not json')).toEqual([]);
  });
});
