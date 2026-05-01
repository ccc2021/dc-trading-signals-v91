import { describe, it, expect } from 'vitest';
import { t, STRINGS } from '../worker.js';

describe('t() 多語系', () => {
  it('預設 zh-TW', () => {
    expect(t({}, 'main_title')).toBe('📱 DC Trading Signals');
  });

  it('user settings.language=en', () => {
    expect(t({ language: 'en' }, 'btn_signals')).toBe('📊 Signals');
  });

  it('字串直接傳語系代號', () => {
    expect(t('en', 'btn_help')).toBe('❓ Help');
    expect(t('zh-TW', 'btn_help')).toBe('❓ 幫助說明');
  });

  it('未知 key fallback 到 key 本身', () => {
    expect(t('zh-TW', 'unknown_key')).toBe('unknown_key');
  });

  it('未知 lang fallback 到 zh-TW', () => {
    expect(t('xx-YY', 'main_title')).toBe('📱 DC Trading Signals');
  });

  it('英文缺 key 時 fallback 到 zh-TW', () => {
    // 為了測試，臨時插入只有 zh-TW 有的 key
    STRINGS['zh-TW'].__test_only = '只有中文';
    expect(t('en', '__test_only')).toBe('只有中文');
    delete STRINGS['zh-TW'].__test_only;
  });

  it('%d / %s 模板填入', () => {
    expect(t('zh-TW', 'days_left', 7)).toBe('剩餘 7 天');
    expect(t('en', 'days_left', 7)).toBe('7 days left');
  });
});
