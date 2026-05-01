import { describe, it, expect } from 'vitest';
import { calculateRR, calculateSize, tickValueOf } from '../worker.js';

describe('calculateRR', () => {
  it('1:1 報酬風險比', () => {
    expect(calculateRR(100, 90, 110)).toBeCloseTo(1.0, 5);
  });

  it('1:2 報酬風險比', () => {
    expect(calculateRR(100, 90, 120)).toBeCloseTo(2.0, 5);
  });

  it('做空也成立 (絕對值)', () => {
    expect(calculateRR(100, 110, 80)).toBeCloseTo(2.0, 5);
  });

  it('止損與進場相同回 null', () => {
    expect(calculateRR(100, 100, 110)).toBeNull();
  });

  it('字串輸入也接受', () => {
    expect(calculateRR('100', '90', '120')).toBeCloseTo(2.0, 5);
  });

  it('非數字回 null', () => {
    expect(calculateRR('abc', 90, 120)).toBeNull();
    expect(calculateRR(100, NaN, 120)).toBeNull();
  });
});

describe('calculateSize', () => {
  it('NQ 標準算例：資金 10000、風險 1%、止損 20 點、tickValue 5 → 1 口', () => {
    const r = calculateSize(10000, 1, 21500, 21480, 5);
    expect(r.contracts).toBeCloseTo(1.0, 5);
    expect(r.riskAmount).toBeCloseTo(100, 5);
    expect(r.riskPoints).toBeCloseTo(20, 5);
    expect(r.perContractRisk).toBeCloseTo(100, 5);
  });

  it('ES 風險 12.5：資金 50000、風險 1%、止損 4 點 → 10 口', () => {
    const r = calculateSize(50000, 1, 5800, 5804, 12.5);
    expect(r.contracts).toBeCloseTo(10.0, 5);
  });

  it('止損為零回 null', () => {
    expect(calculateSize(10000, 1, 100, 100, 5)).toBeNull();
  });

  it('資金為零回 null', () => {
    expect(calculateSize(0, 1, 100, 90, 5)).toBeNull();
  });

  it('風險為負回 null', () => {
    expect(calculateSize(10000, -1, 100, 90, 5)).toBeNull();
  });

  it('tick value 為零回 null', () => {
    expect(calculateSize(10000, 1, 100, 90, 0)).toBeNull();
  });
});

describe('tickValueOf', () => {
  it('優先取 symbolMeta.tick_value', () => {
    expect(tickValueOf('NQ', { tick_value: 99 })).toBe(99);
  });

  it('symbolMeta 缺則回退到 CONFIG 預設', () => {
    expect(tickValueOf('NQ', null)).toBe(5);
    expect(tickValueOf('ES', null)).toBe(12.5);
    expect(tickValueOf('GC', null)).toBe(10);
  });

  it('完全未知品種回退到 5', () => {
    expect(tickValueOf('XXXX', null)).toBe(5);
  });
});
