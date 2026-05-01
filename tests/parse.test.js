import { describe, it, expect } from 'vitest';
import { parseTradingViewPayload, genUID, genRef, genOrderId } from '../worker.js';

describe('parseTradingViewPayload', () => {
  const valid = { action: 'long', ticker: 'NQ', entry: 21500, sl: 21480, tp1: 21520 };

  it('合法 payload 解析成功', () => {
    const r = parseTradingViewPayload(valid);
    expect(r.ok).toBe(true);
    expect(r.signal.action).toBe('LONG');
    expect(r.signal.ticker).toBe('NQ');
    expect(r.signal.entry).toBe(21500);
    expect(r.signal.type).toBe('scalp');
    expect(r.signal.target).toBe('all');
    expect(r.signal.isVipOnly).toBe(0);
  });

  it('action 大小寫不敏感', () => {
    expect(parseTradingViewPayload({ ...valid, action: 'SHORT' }).signal.action).toBe('SHORT');
    expect(parseTradingViewPayload({ ...valid, action: 'Long' }).signal.action).toBe('LONG');
  });

  it('非法 action 拒絕', () => {
    const r = parseTradingViewPayload({ ...valid, action: 'flat' });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('invalid_action');
  });

  it('空 body 拒絕', () => {
    expect(parseTradingViewPayload(null).ok).toBe(false);
    expect(parseTradingViewPayload(undefined).ok).toBe(false);
    expect(parseTradingViewPayload('string').ok).toBe(false);
  });

  it('非法 ticker 拒絕（含特殊字元）', () => {
    const r = parseTradingViewPayload({ ...valid, ticker: 'NQ@!' });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('invalid_ticker');
  });

  it('過長 ticker 拒絕', () => {
    expect(parseTradingViewPayload({ ...valid, ticker: 'TOOLONGTICKER' }).ok).toBe(false);
  });

  it('進場非數字拒絕', () => {
    expect(parseTradingViewPayload({ ...valid, entry: 'abc' }).ok).toBe(false);
  });

  it('TP2/TP3 為可選', () => {
    const r = parseTradingViewPayload(valid);
    expect(r.signal.tp1).toBe(21520);
    expect(r.signal.tp2).toBeNull();
    expect(r.signal.tp3).toBeNull();
  });

  it('TP2/TP3 提供時保留', () => {
    const r = parseTradingViewPayload({ ...valid, tp2: 21540, tp3: 21560 });
    expect(r.signal.tp2).toBe(21540);
    expect(r.signal.tp3).toBe(21560);
  });

  it('type 限定列舉外的值忽略並 fallback', () => {
    const r = parseTradingViewPayload({ ...valid, type: 'foobar' });
    expect(r.signal.type).toBe('scalp');
  });

  it('type=daytrade 允許', () => {
    const r = parseTradingViewPayload({ ...valid, type: 'daytrade' });
    expect(r.signal.type).toBe('daytrade');
  });

  it('target=vip 設定 isVipOnly=1', () => {
    const r = parseTradingViewPayload({ ...valid, target: 'VIP' });
    expect(r.signal.target).toBe('vip');
    expect(r.signal.isVipOnly).toBe(1);
  });
});

describe('ID generators', () => {
  it('genUID 產生不同值', () => {
    const a = genUID(), b = genUID();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(5);
  });

  it('genRef 開頭 DC', () => {
    expect(genRef()).toMatch(/^DC[A-Z0-9]+$/);
  });

  it('genOrderId 開頭 ORD', () => {
    expect(genOrderId()).toMatch(/^ORD[A-Z0-9]+$/);
  });
});
