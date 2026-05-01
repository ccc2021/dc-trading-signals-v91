import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isInQuietHours, localDateString } from '../worker.js';

// 凍結時間到一個確定的台北時刻
function freeze(iso) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}

afterEach(() => vi.useRealTimers());

describe('isInQuietHours', () => {
  it('未啟用直接 false', async () => {
    expect(await isInQuietHours({ quiet_enabled: 0, quiet_start: '23:00', quiet_end: '07:00' })).toBe(false);
  });

  it('跨午夜：23:30 在 23:00–07:00 內', async () => {
    // 2026-01-15 23:30 台北
    freeze('2026-01-15T15:30:00.000Z');
    expect(await isInQuietHours({
      quiet_enabled: 1, quiet_start: '23:00', quiet_end: '07:00',
      timezone: 'Asia/Taipei'
    })).toBe(true);
  });

  it('跨午夜：03:00 在 23:00–07:00 內', async () => {
    // 2026-01-15 03:00 台北 = 2026-01-14 19:00 UTC
    freeze('2026-01-14T19:00:00.000Z');
    expect(await isInQuietHours({
      quiet_enabled: 1, quiet_start: '23:00', quiet_end: '07:00',
      timezone: 'Asia/Taipei'
    })).toBe(true);
  });

  it('跨午夜：12:00 不在 23:00–07:00', async () => {
    freeze('2026-01-15T04:00:00.000Z'); // 台北 12:00
    expect(await isInQuietHours({
      quiet_enabled: 1, quiet_start: '23:00', quiet_end: '07:00',
      timezone: 'Asia/Taipei'
    })).toBe(false);
  });

  it('同日：13:00 在 12:00–18:00 內', async () => {
    freeze('2026-01-15T05:00:00.000Z'); // 台北 13:00
    expect(await isInQuietHours({
      quiet_enabled: 1, quiet_start: '12:00', quiet_end: '18:00',
      timezone: 'Asia/Taipei'
    })).toBe(true);
  });

  it('同日邊界：18:00 結束時不在', async () => {
    freeze('2026-01-15T10:00:00.000Z'); // 台北 18:00
    expect(await isInQuietHours({
      quiet_enabled: 1, quiet_start: '12:00', quiet_end: '18:00',
      timezone: 'Asia/Taipei'
    })).toBe(false);
  });

  it('美東時區獨立計算', async () => {
    // UTC 13:00 = 紐約 08:00 (EST) → 不在 23:00–07:00
    freeze('2026-01-15T13:00:00.000Z');
    expect(await isInQuietHours({
      quiet_enabled: 1, quiet_start: '23:00', quiet_end: '07:00',
      timezone: 'America/New_York'
    })).toBe(false);
  });
});

describe('localDateString', () => {
  it('回傳該時區日期 (YYYY-MM-DD)', () => {
    // UTC 16:00 = 台北 00:00 → 隔日 00:00
    const d = new Date('2026-01-15T16:00:00.000Z');
    expect(localDateString('Asia/Taipei', d)).toBe('2026-01-16');
  });

  it('紐約時區獨立計算', () => {
    // UTC 04:00 = 紐約 23:00 前一日 (EST)
    const d = new Date('2026-01-15T04:00:00.000Z');
    expect(localDateString('America/New_York', d)).toBe('2026-01-14');
  });

  it('時區無效 fallback', () => {
    expect(localDateString('Not/AZone', new Date('2026-01-15T12:00:00.000Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
