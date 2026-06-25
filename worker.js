// ═══════════════════════════════════════════════════════════════════════════════
// DC Trading Signals Pro v9.1
// 用戶自主訂閱系統 - 手機完成所有操作
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  VERSION: '9.1.0',
  BUILD: 'UserSubscribe',
  BOT_TOKEN: '',
  ADMIN_IDS: [],
  BOT_USERNAME: '',

  // 會員等級
  TIERS: {
    free: { name: '免費會員', emoji: '👤', canReceive: false, tpCount: 0 },
    pro:  { name: 'Pro會員', emoji: '⭐', canReceive: true, tpCount: 2 },
    vip:  { name: 'VIP會員', emoji: '👑', canReceive: true, tpCount: 3 }
  },

  // 品種分類
  SYMBOL_CATEGORIES: {
    index: { name: '指數期貨', emoji: '📈' },
    metal: { name: '貴金屬', emoji: '🥇' },
    energy: { name: '能源', emoji: '🛢️' },
    forex: { name: '外匯', emoji: '💱' },
    crypto: { name: '加密貨幣', emoji: '🪙' }
  },

  // 訊號類型
  SIGNAL_TYPES: {
    scalp: { name: '短線訊號', emoji: '⚡', desc: '持倉數分鐘~數小時' },
    swing: { name: '波段訊號', emoji: '📈', desc: '持倉數小時~數天' },
    daytrade: { name: '日內訊號', emoji: '🎯', desc: '當日開平倉' }
  },

  // 訊號動作
  ACTIONS: {
    LONG:  { emoji: '⬆️', name: '做多' },
    SHORT: { emoji: '⬇️', name: '做空' }
  }
};

const AUTO_TRADE_STATUS = {
  disabled: 'disabled',
  skipped: 'skipped',
  queued: 'queued',
  sent: 'sent',
  acked: 'acked',
  failed: 'failed'
};

const DEFAULT_ECONOMIC_CALENDAR_SOURCE_URL = 'https://economic-calendar.tradingview.com/events?from={from_iso}&to={to_iso}';
const DEFAULT_ECONOMIC_CALENDAR_SOURCE_NAME = 'TradingView Calendar';
const DEFAULT_SIGNAL_PROXY_RULES = JSON.stringify([
  {
    enabled: true,
    source: 'USTEC',
    target: 'NQ',
    mode: 'weekly_offset',
    beta: 1,
    target_group: 'pro',
    label: 'USTEC weekly offset'
  }
]);

function algoProSmartTvTemplateObject() {
  const rawPlots = {};
  for (let i = 0; i <= 17; i++) rawPlots[`p${i}`] = `{{plot_${i}}}`;
  return {
    secret: '{{secret}}',
    source_id: '{{source_id}}',
    strategy: '{{strategy_id}}',
    event: 'entry',
    ticker: '{{ticker}}',
    exchange: '{{exchange}}',
    action: '{{strategy.order.action}}',
    order_id: '{{strategy.order.id}}',
    order_comment: '{{strategy.order.comment}}',
    entry_price: '{{strategy.order.price}}',
    order_price: '{{strategy.order.price}}',
    price: '{{strategy.order.price}}',
    close: '{{close}}',
    long_stop_loss: '{{plot_5}}',
    short_stop_loss: '{{plot_6}}',
    long_tp1: '{{plot_7}}',
    short_tp1: '{{plot_8}}',
    probability: '{{plot_9}}',
    ...rawPlots,
    contracts: '{{strategy.order.contracts}}',
    market_position: '{{strategy.market_position}}',
    prev_market_position: '{{strategy.prev_market_position}}',
    time: '{{time}}',
    interval: '{{interval}}',
    alert_id: '{{ticker}}-{{time}}-{{strategy_id}}-{{strategy.order.id}}-{{strategy.order.comment}}',
    mapping_note: 'AlgoPro V1.4 TradingView Add placeholder order: plot_5 Long SL, plot_6 Short SL, plot_7 Long TP, plot_8 Short TP. Backend uses indicator levels first and fills missing SL/TP by symbol strategy fallback.'
  };
}

function algoProSmartTvTemplateString() {
  return JSON.stringify(algoProSmartTvTemplateObject());
}

function algoProSmartRulesString(existing = '') {
  const current = parseObject(existing, {});
  return JSON.stringify({
    ...current,
    riskPoints: current.riskPoints || current.risk_points || 30,
    targetR: current.targetR || current.target_r || [1, 2, 3],
    entryMode: 'tradingview',
    levelSource: 'smart-directional-plot',
    requiresExplicitLevels: false,
    fallbackEnabled: true,
    fallbackPolicy: 'indicator-first-symbol-strategy',
    timeframes: current.timeframes || ['1', '3', '5', '15']
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 工具函數
// ═══════════════════════════════════════════════════════════════════════════════
function parseAdminIds(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {}
  return String(value).split(',').map((id) => id.trim()).filter(Boolean);
}

function loadRuntimeConfig(env = {}) {
  CONFIG.BOT_TOKEN = env.BOT_TOKEN || CONFIG.BOT_TOKEN;
  CONFIG.ADMIN_IDS = parseAdminIds(env.ADMIN_IDS || CONFIG.ADMIN_IDS);
  CONFIG.BOT_USERNAME = env.BOT_USERNAME || CONFIG.BOT_USERNAME;
}

const tgApi = () => `https://api.telegram.org/bot${CONFIG.BOT_TOKEN}`;
const json = (d, s = 200) => new Response(JSON.stringify(d), {
  status: s,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
});
const html = (body, status = 200, headers = {}) => new Response(body, {
  status,
  headers: { 'Content-Type': 'text/html; charset=utf-8', ...headers }
});

const genUID = () => Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();
const genRef = () => 'DC' + Math.random().toString(36).substr(2, 6).toUpperCase();
const genOrderId = () => 'ORD' + Date.now().toString(36).toUpperCase();
const genTicketId = () => 'TKT' + Date.now().toString(36).toUpperCase();
const isAdmin = (id) => CONFIG.ADMIN_IDS.includes(String(id));
const tierName = (t) => (CONFIG.TIERS[t]?.emoji || '👤') + ' ' + (CONFIG.TIERS[t]?.name || '免費會員');
const tierEmoji = (t) => CONFIG.TIERS[t]?.emoji || '👤';
const tierRank = (t) => ({ free: 0, pro: 1, vip: 2 }[String(t || 'free')] || 0);
const fmtNum = (n) => n?.toLocaleString() || '0';
const fmtPrice = (n) => n?.toFixed(2) || '0.00';
function normalizeProbabilityValue(value) {
  const raw = firstTvValue(value);
  if (raw === '') return null;
  const text = String(raw).replace(/,/g, '').trim();
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  let n = Number(match[0]);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n <= 1 && !text.includes('%')) n *= 100;
  if (n > 100) return null;
  return Number(n.toFixed(2));
}
function fmtProbability(value) {
  const n = normalizeProbabilityValue(value);
  if (n === null) return '-';
  return `${Number.isInteger(n) ? String(n) : n.toFixed(2)}%`;
}
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('zh-TW') : '-';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '-';
const fmtTime = () => new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
const formatUserLabel = (user, fallback = '') => {
  const username = String(user?.username || '').trim();
  if (username) return username.includes('@') ? username : `@${username}`;
  return user?.first_name || fallback || user?.user_id || '-';
};
const effectiveTierRank = (user) => memberCanReceive(user) ? tierRank(user?.tier) : 0;
const latestDateValue = (...values) => {
  let latest = null;
  for (const value of values) {
    const parsed = parseDbTime(value);
    if (parsed && (!latest || parsed > latest)) latest = parsed;
  }
  return latest ? latest.toISOString() : null;
};
const parseDbTime = (d) => {
  if (!d) return null;
  const text = String(d).trim();
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : `${text.replace(' ', 'T')}Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const fmtSignalTime = (d) => {
  const parsed = parseDbTime(d);
  if (!parsed) return '-';
  return parsed.toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).replace(',', '');
};
const daysLeft = (d) => d ? Math.max(0, Math.ceil((new Date(d) - new Date()) / 86400000)) : 0;
const parseJSON = (s, def = []) => { try { return JSON.parse(s) || def; } catch { return def; } };
const escHtml = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const firstUrl = (value) => String(value || '').match(/https?:\/\/[^\s<>"']+/)?.[0] || '';
const stripHtml = (value) => String(value || '').replace(/<[^>]+>/g, '');
const photoCaption = (value) => {
  const text = String(value || '');
  if (text.length <= 1000) return text;
  return stripHtml(text).slice(0, 1000);
};
const textBytes = (value) => new TextEncoder().encode(String(value));
const bytesToHex = (bytes) => Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
const hexToBytes = (hex) => {
  const clean = String(hex || '').replace(/[^0-9a-f]/gi, '');
  const bytes = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return bytes;
};
const base64UrlEncode = (value) => btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
const base64UrlDecode = (value) => {
  const padded = String(value || '').replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(String(value || '').length / 4) * 4, '=');
  return atob(padded);
};

async function sha256Bytes(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', textBytes(value)));
}

async function hmacHex(keyBytes, value) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return bytesToHex(new Uint8Array(await crypto.subtle.sign('HMAC', key, textBytes(value))));
}

async function sha256Hex(value) {
  return bytesToHex(await sha256Bytes(value));
}

function timingSafeEqual(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

function readCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

// ═══════════════════════════════════════════════════════════════════════════════
// Telegram API
// ═══════════════════════════════════════════════════════════════════════════════
async function sendTg(chatId, text, kb = null, options = {}) {
  const body = { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: options.disablePreview !== false };
  if (kb) body.reply_markup = kb;
  try {
    const res = await fetch(`${tgApi()}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return res.json();
  } catch (e) { return { ok: false }; }
}

function isTelegramChatId(value) {
  return /^-?\d+$/.test(String(value || '').trim());
}

async function ensureTelegramLinkSchema(db) {
  await addColumnIfMissing(db, 'users', 'telegram_user_id', 'TEXT');
  await addColumnIfMissing(db, 'users', 'telegram_linked_at', 'TEXT');
  await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram_user ON users(telegram_user_id)').run();
}

async function resolveMemberUserId(db, userId) {
  const incomingId = String(userId || '');
  if (!incomingId || !isTelegramChatId(incomingId)) return incomingId;
  await ensureTelegramLinkSchema(db);
  const linked = await db.prepare(`
    SELECT user_id FROM users
    WHERE telegram_user_id = ? AND user_id != ?
    LIMIT 1
  `).bind(incomingId, incomingId).first();
  return linked?.user_id || incomingId;
}

async function memberTelegramChatId(db, userId) {
  const id = String(userId || '').trim();
  if (!id) return '';
  if (isTelegramChatId(id)) return id;
  if (!db) return '';
  await ensureTelegramLinkSchema(db);
  const row = await db.prepare('SELECT telegram_user_id FROM users WHERE user_id = ?').bind(id).first();
  return isTelegramChatId(row?.telegram_user_id) ? String(row.telegram_user_id) : '';
}

async function sendMemberNotice(userId, text, kb = null, options = {}) {
  const chatId = await memberTelegramChatId(options.db, userId);
  if (!chatId) return { ok: false, skipped: true };
  return sendTg(chatId, text, kb, options);
}

async function sendTgPhoto(chatId, photoUrl, caption = '', kb = null) {
  const body = {
    chat_id: chatId,
    photo: photoUrl,
    caption: photoCaption(caption),
    parse_mode: 'HTML'
  };
  if (kb) body.reply_markup = kb;
  try {
    const res = await fetch(`${tgApi()}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return res.json();
  } catch (e) { return { ok: false }; }
}

async function editTg(chatId, msgId, text, kb = null) {
  const body = { chat_id: chatId, message_id: msgId, text, parse_mode: 'HTML', disable_web_page_preview: true };
  if (kb) body.reply_markup = kb;
  try {
    await fetch(`${tgApi()}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) {}
}

async function answerCb(cbId, text = '', showAlert = false) {
  if (!cbId) return;
  try {
    await fetch(`${tgApi()}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: cbId, text, show_alert: showAlert })
    });
  } catch (e) {}
}

// ═══════════════════════════════════════════════════════════════════════════════
// 資料庫操作
// ═══════════════════════════════════════════════════════════════════════════════
async function getUser(db, id) {
  try {
    let user = await db.prepare('SELECT * FROM users WHERE user_id = ?').bind(String(id)).first();
    if (!user) {
      const refCode = genRef();
      await db.prepare(`
        INSERT INTO users (user_id, referral_code, created_at, updated_at)
        VALUES (?, ?, datetime('now'), datetime('now'))
      `).bind(String(id), refCode).run();
      user = await db.prepare('SELECT * FROM users WHERE user_id = ?').bind(String(id)).first();

      // 建立預設設定
      await db.prepare(`
        INSERT INTO user_settings (user_id) VALUES (?)
      `).bind(String(id)).run();
    }
    return user || { user_id: String(id), tier: 'free', points: 0 };
  } catch (e) {
    return { user_id: String(id), tier: 'free', points: 0 };
  }
}

async function getUserSettings(db, id) {
  try {
    let settings = await db.prepare('SELECT * FROM user_settings WHERE user_id = ?').bind(String(id)).first();
    if (!settings) {
      await db.prepare(`INSERT INTO user_settings (user_id) VALUES (?)`).bind(String(id)).run();
      settings = await db.prepare('SELECT * FROM user_settings WHERE user_id = ?').bind(String(id)).first();
    }
    return settings || {
      user_id: String(id),
      capital: 10000,
      risk_percent: 1.0,
      subscribed_symbols: '["NQ","ES","GC","USTEC","XAUUSD","ETH"]',
      signal_types: '["scalp","swing"]',
      notify_entry: 1,
      notify_tp: 1,
      notify_sl: 1,
      notify_update: 1,
      notify_daily_report: 1,
      notify_announcement: 1,
      notify_alert: 1,
      quiet_enabled: 0,
      quiet_start: '23:00',
      quiet_end: '07:00',
      paused: 0,
      timezone: 'Asia/Taipei',
      language: 'zh-TW'
    };
  } catch (e) {
    return { user_id: String(id), capital: 10000, risk_percent: 1.0 };
  }
}

async function updateUser(db, id, data) {
  try {
    const sets = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(data), String(id)];
    await db.prepare(`UPDATE users SET ${sets}, updated_at = datetime('now') WHERE user_id = ?`).bind(...values).run();
  } catch (e) {}
}

async function updateUserSettings(db, id, data) {
  try {
    const sets = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(data), String(id)];
    await db.prepare(`UPDATE user_settings SET ${sets}, updated_at = datetime('now') WHERE user_id = ?`).bind(...values).run();
  } catch (e) {}
}

async function saveUserInfo(db, id, username, firstName) {
  try {
    await db.prepare(`
      UPDATE users SET username = ?, first_name = ?, last_active_at = datetime('now'), updated_at = datetime('now')
      WHERE user_id = ?
    `).bind(username || null, firstName || null, String(id)).run();
  } catch (e) {}
}

async function getConfig(db, key) {
  try {
    const r = await db.prepare('SELECT value FROM system_config WHERE key = ?').bind(key).first();
    return r?.value;
  } catch (e) { return null; }
}

async function ensureConfigSchema(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS system_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
}

async function setConfig(db, key, value) {
  await ensureConfigSchema(db);
  await db.prepare('INSERT OR REPLACE INTO system_config (key, value, updated_at) VALUES (?, ?, datetime("now"))').bind(key, value).run();
}

async function getSymbols(db) {
  try {
    const r = await db.prepare('SELECT * FROM symbols WHERE is_active = 1 ORDER BY sort_order').all();
    return r.results || [];
  } catch (e) { return []; }
}

async function getSymbolsByCategory(db) {
  const symbols = await getSymbols(db);
  const categories = {};
  for (const s of symbols) {
    if (!categories[s.category]) categories[s.category] = [];
    categories[s.category].push(s);
  }
  return categories;
}

async function logAction(db, adminId, action, target, details) {
  try {
    await db.prepare(`
      INSERT INTO admin_logs (admin_id, action, target, details, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).bind(adminId, action, target, details).run();
  } catch (e) {}
}

async function addPoints(db, userId, points, reason) {
  try {
    await db.prepare('UPDATE users SET points = points + ? WHERE user_id = ?').bind(points, userId).run();
    await db.prepare(`INSERT INTO point_history (user_id, points, reason, created_at) VALUES (?, ?, ?, datetime('now'))`).bind(userId, points, reason).run();
  } catch (e) {}
}
// ═══════════════════════════════════════════════════════════════════════════════
// 訊號格式化
// ═══════════════════════════════════════════════════════════════════════════════

function formatSignalCard(signal, userSettings = null, isVip = false) {
  const { ticker, action, entry_price, stop_loss, tp1, tp2, tp3, signal_type } = signal;
  const actionInfo = CONFIG.ACTIONS[action] || { emoji: '', name: action };
  const typeInfo = CONFIG.SIGNAL_TYPES[signal_type] || { emoji: '', name: '' };

  const risk = Math.abs(entry_price - stop_loss);
  const reward1 = tp1 ? Math.abs(tp1 - entry_price) : 0;
  const rr = risk > 0 ? (reward1 / risk).toFixed(1) : '0';

  const tierLine = signal.is_vip_only ? 'VIP 專屬' : (signal.target_group === 'vip' ? 'VIP' : signal.target_group === 'pro' ? 'Pro 以上' : '付費會員');
  const chartUrl = signalMediaUrl(signal);
  const origin = signal.strategy_id || signal.source || 'TradingView';
  const probability = normalizeProbabilityValue(signal.probability);

  let msg = `${actionInfo.emoji || ''} <b>${escHtml(actionInfo.name || action)} ${escHtml(ticker)}</b>\n`;
  msg += `${typeInfo.emoji || ''} ${escHtml(typeInfo.name || signal_type)} · ${escHtml(tierLine)}\n\n`;

  msg += `💰 進場　<code>${fmtPrice(entry_price)}</code>\n`;
  msg += `🛑 止損　<code>${fmtPrice(stop_loss)}</code>\n\n`;

  if (tp1) msg += `🎯 TP1　<code>${fmtPrice(tp1)}</code>\n`;
  if (tp2) msg += `🎯 TP2　<code>${fmtPrice(tp2)}</code>\n`;
  if (tp3 && isVip) msg += `🎯 TP3　<code>${fmtPrice(tp3)}</code>　VIP\n`;
  const tpText = signalTpHitText(signal);
  if (tpText) msg += `✅ 已達　${escHtml(tpText)}\n`;
  if (probability !== null) msg += `📌 機率　<code>${fmtProbability(probability)}</code>\n`;
  msg += `\n📊 風險　<code>${fmtPrice(risk)}</code> 點\n`;
  msg += `🎯 報酬　<code>1:${rr}</code>\n`;

  if (userSettings && userSettings.capital > 0) {
    const riskAmount = userSettings.capital * (userSettings.risk_percent / 100);
    const tickValue = 5; // 預設 NQ tick value
    const contracts = risk > 0 ? (riskAmount / (risk * tickValue)).toFixed(2) : 0;
    msg += `\n📊 您的交易參考\n`;
    msg += `風險金額　$${fmtNum(riskAmount.toFixed(0))} (${userSettings.risk_percent}%)\n`;
    msg += `建議口數　${contracts} 口\n`;
  }

  msg += `\n${escHtml(origin)} · ${fmtTime()}\n`;
  msg += `<code>#${escHtml(signal.signal_uid)}</code>`;
  if (chartUrl) msg += `\n<a href="${escHtml(chartUrl)}">查看圖表</a>`;

  return msg;
}

function signalPreviewOptions(signal) {
  return { disablePreview: true };
}

function publicBaseUrl(env = {}, config = {}) {
  return String(
    config.public_base_url ||
    config.publicBaseUrl ||
    env.PUBLIC_BASE_URL ||
    env.MEMBER_WEB_URL ||
    env.PUBLIC_MEMBER_URL ||
    'https://dc-signals-v91.cc559773.workers.dev'
  ).replace(/\/+$/, '');
}

function signalCardPublicUrl(signal, env = {}) {
  if (!signal?.signal_uid) return '';
  return `${publicBaseUrl(env)}/signal-card/${encodeURIComponent(signal.signal_uid)}.svg`;
}

function signalMediaUrl(signal) {
  return firstUrl(signal?.snapshot_url) || firstUrl(signal?.chart_url) || firstUrl(signal?.note);
}

function signalPhotoUrl(signal, env = {}) {
  if (String(env.SIGNAL_SEND_PHOTOS || '').trim() !== '1') return '';
  return firstUrl(signal?.snapshot_url);
}

async function sendSignalTg(chatId, signal, message, kb = null, env = {}) {
  const photoUrl = signalPhotoUrl(signal, env);
  if (photoUrl) {
    const photoResult = await sendTgPhoto(chatId, photoUrl, message, kb);
    if (photoResult?.ok) return photoResult;
  }
  return sendTg(chatId, message, kb, signalPreviewOptions(signal));
}

function signalCardSvg(signal) {
  const action = signal.action === 'LONG' ? 'LONG' : 'SHORT';
  const isLong = action === 'LONG';
  const accent = isLong ? '#16a34a' : '#dc2626';
  const accentSoft = isLong ? '#dcfce7' : '#fee2e2';
  const risk = Math.abs(Number(signal.entry_price || 0) - Number(signal.stop_loss || 0));
  const reward = signal.tp1 ? Math.abs(Number(signal.tp1) - Number(signal.entry_price || 0)) : 0;
  const rr = risk > 0 ? (reward / risk).toFixed(1) : '0.0';
  const typeInfo = CONFIG.SIGNAL_TYPES[signal.signal_type] || { name: signal.signal_type || '訊號' };
  const tier = signal.is_vip_only || signal.target_group === 'vip' ? 'VIP 專屬' : signal.target_group === 'pro' ? 'Pro 以上' : '付費會員';
  const created = fmtDateTime(signal.created_at || new Date().toISOString());
  const showTp3 = Boolean((signal.is_vip_only || signal.target_group === 'vip') && signal.tp3);
  const status = signal.status === 'closed' ? '已結案' : signal.status === 'cancelled' ? '已取消' : signal.status === 'pending' ? '草稿' : '進行中';
  const pnl = signal.pnl_points != null ? `${Number(signal.pnl_points) >= 0 ? '+' : ''}${fmtPrice(Number(signal.pnl_points))} pts` : '';
  const title = `${action} ${signal.ticker}`;
  const uid = shortSignalId(signal.signal_uid);
  const tpRows = [
    ['TP1', signal.tp1],
    ['TP2', signal.tp2],
    ...(showTp3 ? [['TP3', signal.tp3]] : [])
  ].filter((row) => row[1] != null);
  const targetCard = (idx, label, value) => {
    const x = 92 + idx * 234;
    return `
    <g transform="translate(${x} 482)">
      <rect width="214" height="98" rx="18" fill="#111f31" stroke="#263b4f"/>
      <text x="24" y="38" class="label">${escHtml(label)}</text>
      <text x="24" y="78" fill="#f8fafc" font-size="34" font-weight="950">${escHtml(value)}</text>
    </g>`;
  };
  const tpSvg = (tpRows.length ? tpRows : [['TP', null]])
    .slice(0, 3)
    .map((row, idx) => targetCard(idx, row[0], row[1] == null ? '-' : fmtPrice(Number(row[1]))))
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#07111f"/>
      <stop offset="0.58" stop-color="#0f2437"/>
      <stop offset="1" stop-color="#132a3d"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#000" flood-opacity="0.32"/>
    </filter>
    <style>
      .sans { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; }
      .muted { fill: #9fb2c3; font-size: 24px; font-weight: 700; }
      .label { fill: #8aa0b4; font-size: 22px; font-weight: 800; letter-spacing: 0; }
      .value { fill: #f8fafc; font-size: 42px; font-weight: 900; letter-spacing: 0; }
      .small { fill: #cbd5e1; font-size: 22px; font-weight: 750; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    </style>
  </defs>
  <rect width="1200" height="675" fill="url(#bg)"/>
  <circle cx="1040" cy="80" r="210" fill="${accent}" opacity="0.10"/>
  <circle cx="110" cy="615" r="230" fill="#0891b2" opacity="0.12"/>
  <rect x="58" y="54" width="1084" height="567" rx="34" fill="#0b1726" opacity="0.88" filter="url(#shadow)"/>
  <rect x="58" y="54" width="1084" height="567" rx="34" fill="none" stroke="#263b4f" stroke-width="2"/>

  <g class="sans">
    <rect x="92" y="88" width="74" height="74" rx="18" fill="#1aa7bc"/>
    <text x="129" y="135" text-anchor="middle" fill="#06111c" font-size="28" font-weight="950">DC</text>
    <text x="188" y="116" fill="#f8fafc" font-size="31" font-weight="950">DC Trading Signals</text>
    <text x="188" y="151" class="muted">${escHtml(typeInfo.name || signal.signal_type || '訊號')} · ${escHtml(tier)} · ${escHtml(status)}</text>
    <rect x="899" y="91" width="203" height="58" rx="29" fill="${accentSoft}"/>
    <text x="1000" y="130" text-anchor="middle" fill="${accent}" font-size="29" font-weight="950">${escHtml(action)}</text>

    <text x="92" y="244" fill="#f8fafc" font-size="76" font-weight="950">${escHtml(title)}</text>
    <text x="96" y="290" class="muted">${escHtml(created)} · #${escHtml(uid)}</text>

    <g transform="translate(92 335)">
      <rect width="318" height="112" rx="20" fill="#111f31" stroke="#263b4f"/>
      <text x="28" y="41" class="label">ENTRY</text>
      <text x="28" y="88" class="value">${escHtml(fmtPrice(Number(signal.entry_price)))}</text>
    </g>
    <g transform="translate(442 335)">
      <rect width="318" height="112" rx="20" fill="#111f31" stroke="#263b4f"/>
      <text x="28" y="41" class="label">STOP LOSS</text>
      <text x="28" y="88" class="value">${escHtml(fmtPrice(Number(signal.stop_loss)))}</text>
    </g>
    <g transform="translate(792 335)">
      <rect width="310" height="112" rx="20" fill="#111f31" stroke="#263b4f"/>
      <text x="28" y="41" class="label">RISK / REWARD</text>
      <text x="28" y="88" class="value">${escHtml(fmtPrice(risk))} / 1:${escHtml(rr)}</text>
    </g>

    ${tpSvg}

    <rect x="837" y="482" width="265" height="98" rx="20" fill="#111f31" stroke="#263b4f"/>
    <text x="862" y="522" class="label">RESULT</text>
    <text x="862" y="565" class="value">${escHtml(pnl || status)}</text>
  </g>
</svg>`;
}

async function renderSignalCardResponse(db, signalUid) {
  const uid = String(signalUid || '').replace(/\.svg$/i, '').trim();
  if (!uid) return new Response('Missing signal', { status: 400 });
  const signal = await db.prepare('SELECT * FROM signals WHERE signal_uid = ?').bind(uid).first();
  if (!signal) return new Response('Signal not found', { status: 404 });
  return new Response(signalCardSvg(signal), {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=60'
    }
  });
}

function formatExitCard(type, ticker, price, pnl, note = '') {
  const icons = {
    TP1: { title: 'TP1 達成' },
    TP2: { title: 'TP2 達成' },
    TP3: { title: 'TP3 達成' },
    SL: { title: '止損觸發' },
    CLOSE: { title: '手動平倉' },
    AUTO: { title: '前筆訊號結算' },
    BE: { title: '移至成本' }
  };

  const info = icons[type] || { title: type };
  const pnlSign = pnl >= 0 ? '+' : '';

  let msg = `<b>${escHtml(info.title)}</b>\n`;
  msg += `${escHtml(ticker)} · ${escHtml(type)}\n\n`;
  msg += `<b>成交</b>\n`;
  msg += `價格 <code>${fmtPrice(price)}</code>\n`;
  if (pnl !== null) {
    msg += `${pnl >= 0 ? '獲利' : '虧損'} <code>${pnlSign}${fmtPrice(pnl)}</code> 點\n`;
  }
  if (note) msg += `\n<b>備註</b>\n${escHtml(note)}\n`;
  msg += `\n${fmtTime()}`;

  return msg;
}

function formatUpdateCard(message) {
  return `<b>訊號更新</b>\n\n${escHtml(message)}\n\n${fmtTime()}`;
}

function formatAlertCard(message) {
  return `<b>交易警報</b>\n\n${escHtml(message)}\n\n${fmtTime()}`;
}

function formatDailyReport(stats) {
  let msg = `<b>每日績效報告</b>\n`;
  msg += `${new Date().toLocaleDateString('zh-TW')}\n\n`;
  msg += `<b>今日戰績</b>\n`;
  msg += `總交易 ${stats.total || 0} 筆\n`;
  msg += `獲利 ${stats.wins || 0} 筆 · 虧損 ${stats.losses || 0} 筆\n`;
  const winRate = stats.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(1) : 0;
  msg += `勝率 <code>${winRate}%</code>\n\n`;
  msg += `<b>盈虧統計</b>\n`;
  msg += `淨盈虧 <code>${stats.pnl >= 0 ? '+' : ''}${fmtPrice(stats.pnl || 0)}</code> 點`;
  return msg;
}

function taipeiDateKey(date = new Date()) {
  return new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
}

function taipeiWeekStartKey(date = new Date()) {
  const key = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : taipeiDateKey(date);
  const [year, month, day] = key.split('-').map(Number);
  const utc = Date.UTC(year, month - 1, day);
  const dow = new Date(utc).getUTCDay();
  const mondayOffset = (dow + 6) % 7;
  return new Date(utc - mondayOffset * 86400000).toISOString().slice(0, 10);
}

function taipeiHour(date = new Date()) {
  return Number(new Date(date).toLocaleString('en-US', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    hour12: false
  }));
}

function normalizeEconomicImpact(value) {
  const text = String(value || '').trim().toLowerCase();
  if (['3', 'high', 'important', 'red', '高', '重要', '重大'].includes(text)) return 'high';
  if (['2', 'medium', 'moderate', 'orange', 'yellow', '中', '普通'].includes(text)) return 'medium';
  if (['1', 'low', 'minor', 'green', '低'].includes(text)) return 'low';
  return text || 'medium';
}

function normalizeTradingViewImportance(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  if (n >= 0) return 'high';
  return 'low';
}

function economicImpactLabel(impact) {
  const map = { high: '高', medium: '中', low: '低' };
  return map[normalizeEconomicImpact(impact)] || impact || '中';
}

const ECONOMIC_COUNTRY_TO_CURRENCY = {
  US: 'USD',
  EU: 'EUR',
  EZ: 'EUR',
  EA: 'EUR',
  EMU: 'EUR',
  GB: 'GBP',
  UK: 'GBP',
  JP: 'JPY',
  CN: 'CNY',
  CA: 'CAD',
  AU: 'AUD',
  NZ: 'NZD',
  CH: 'CHF'
};
const ECONOMIC_MARKET_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'CAD', 'AUD', 'NZD', 'CHF'];
const ECONOMIC_MARKET_HIGH_KEYWORDS = [
  'cpi', 'core cpi', 'pce', 'core pce', 'inflation', 'ppi',
  'non-farm', 'nonfarm', 'nfp', 'payroll', 'employment change',
  'unemployment', 'jobless claims', 'initial claims', 'continuing claims',
  'average hourly earnings', 'jolts',
  'fomc', 'fed interest rate', 'federal funds', 'fed rate', 'rate decision',
  'powell', 'fed chair', 'fed ', 'speech', 'central bank', 'ecb', 'boj', 'boe',
  'gdp', 'retail sales', 'ism', 'pmi', 'consumer confidence',
  'consumer sentiment', 'uom', 'durable goods', 'industrial production'
];
const ECONOMIC_MARKET_NOISE_KEYWORDS = [
  'holiday', 'bank holiday', 'bond auction', 'bill auction',
  'mortgage', 'housing starts', 'building permits', 'wholesale inventories',
  'retail inventories', 'business inventories', 'trade balance',
  'natural gas storage', 'crude oil inventories'
];

function economicEventKeywordText(event) {
  return [
    event?.title,
    event?.notes,
    event?.source
  ].filter(Boolean).join(' ').toLowerCase();
}

function normalizeEconomicCurrencyCode(currency, country = '') {
  const cur = String(currency || '').trim().toUpperCase();
  const c = String(country || '').trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(cur)) return cur;
  if (ECONOMIC_COUNTRY_TO_CURRENCY[c]) return ECONOMIC_COUNTRY_TO_CURRENCY[c];
  if (/^[A-Z]{3}$/.test(c)) return c;
  return cur;
}

function economicEventIsMarketMoving(event) {
  const impact = normalizeEconomicImpact(event?.impact);
  const currency = normalizeEconomicCurrencyCode(event?.currency, event?.country);
  const text = economicEventKeywordText(event);
  if (impact === 'low') return false;
  if (ECONOMIC_MARKET_NOISE_KEYWORDS.some((keyword) => text.includes(keyword))) return false;
  if (!ECONOMIC_MARKET_CURRENCIES.includes(currency)) return false;
  return ECONOMIC_MARKET_HIGH_KEYWORDS.some((keyword) => text.includes(keyword));
}

function normalizeEconomicDateTime(timeValue, dateValue = '', options = {}) {
  const assumeTimezone = String(options.assumeTimezone || 'Asia/Taipei');
  const offset = /utc/i.test(assumeTimezone) ? 'Z' : '+08:00';
  const rawNumber = typeof timeValue === 'number' ? timeValue : (/^\d{10,13}$/.test(String(timeValue || '').trim()) ? Number(String(timeValue).trim()) : null);
  if (Number.isFinite(rawNumber)) {
    const ms = rawNumber > 100000000000 ? rawNumber : rawNumber * 1000;
    const parsed = new Date(ms);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  const timeText = String(timeValue || '').trim();
  const dateText = String(dateValue || '').trim();
  if (!timeText && !dateText) return null;

  let text = timeText || dateText;
  if (/^\d{1,2}:\d{2}$/.test(timeText) && /^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    text = `${dateText}T${timeText}:00${offset}`;
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) {
    text = `${text}:00${offset}`;
  } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(text) && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
    text = `${text.replace(' ', 'T')}${offset}`;
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    text = `${text}T00:00:00${offset}`;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function economicEventDate(eventTime, fallback = '') {
  const parsed = parseDbTime(eventTime);
  if (parsed) return taipeiDateKey(parsed);
  const text = String(fallback || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : taipeiDateKey();
}

function economicEventTimeText(event) {
  const parsed = parseDbTime(event.event_time);
  if (!parsed) return '待定';
  return parsed.toLocaleTimeString('zh-TW', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function economicEventArray(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  const candidates = [
    data.events,
    data.data,
    data.result,
    data.calendar,
    data.items,
    data.economicCalendar,
    data?.data?.events,
    data?.data?.items
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function extractEconomicJsonFromText(text) {
  const raw = String(text || '');
  const marker = raw.indexOf('Markdown Content:');
  const body = (marker >= 0 ? raw.slice(marker + 'Markdown Content:'.length) : raw).trim();
  const pairs = [['[', ']'], ['{', '}']];
  for (const [open, close] of pairs) {
    const start = body.indexOf(open);
    const end = body.lastIndexOf(close);
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(body.slice(start, end + 1));
      } catch {}
    }
  }
  return null;
}

async function readEconomicCalendarResponse(res, sourceUrl) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    const extracted = extractEconomicJsonFromText(text);
    if (extracted) return extracted;
    throw new Error(`經濟日曆來源不是 JSON：${sourceUrl}`);
  }
}

function economicCalendarProxyUrl(sourceUrl) {
  const url = String(sourceUrl || '').trim();
  if (!url || url.includes('r.jina.ai/http://')) return '';
  return `https://r.jina.ai/http://${url.replace(/^https?:\/\//i, '')}`;
}

function buildEconomicCalendarUrl(template, dateKey) {
  const from = dateKey;
  const to = dateKey;
  const start = new Date(`${dateKey}T00:00:00+08:00`);
  const end = new Date(`${dateKey}T23:59:59.999+08:00`);
  const fromIso = Number.isNaN(start.getTime()) ? `${dateKey}T00:00:00.000Z` : start.toISOString();
  const toIso = Number.isNaN(end.getTime()) ? `${dateKey}T23:59:59.999Z` : end.toISOString();
  const original = String(template || '').trim();
  let url = original
    .replace(/\{date\}/g, encodeURIComponent(dateKey))
    .replace(/\{from\}/g, encodeURIComponent(from))
    .replace(/\{to\}/g, encodeURIComponent(to))
    .replace(/\{from_iso\}/g, encodeURIComponent(fromIso))
    .replace(/\{to_iso\}/g, encodeURIComponent(toIso));
  if (!url || /\{/.test(url)) return url;
  const fixedFileFeed = /\.(?:json|xml|csv)(?:$|\?)/i.test(url);
  if (url === original && !fixedFileFeed) {
    const sep = url.includes('?') ? '&' : '?';
    url += `${sep}date=${encodeURIComponent(dateKey)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  }
  return url;
}

function normalizeEconomicFeedItem(item, sourceName, fallbackDate) {
  if (!item || typeof item !== 'object') return null;
  const sourceText = String(firstTvValue(item.source, sourceName)).trim() || 'calendar';
  const title = String(firstTvValue(
    item.title, item.event, item.name, item.indicator, item.release, item.description
  )).trim();
  if (!title) return null;
  const assumeTimezone = /tradingview/i.test(sourceText) ? 'UTC' : 'Asia/Taipei';
  const eventTime = normalizeEconomicDateTime(firstTvValue(
    item.event_time, item.eventTime, item.datetime, item.dateTime, item.timestamp,
    item.time, item.release_time, item.releaseTime, item.date
  ), firstTvValue(item.event_date, item.eventDate, item.date, fallbackDate), { assumeTimezone });
  const eventDate = economicEventDate(eventTime, firstTvValue(item.event_date, item.eventDate, item.date, fallbackDate));
  let currency = String(firstTvValue(item.currency, item.currencyCode, item.ticker, item.iso_currency)).trim().toUpperCase();
  let country = String(firstTvValue(item.country, item.countryCode, item.region)).trim().toUpperCase();
  currency = normalizeEconomicCurrencyCode(currency, country);
  if (!country && currency) country = currency;
  const rawImpact = firstTvValue(item.impact, item.importanceLabel, item.priority, item.volatility);
  const impact = rawImpact ? normalizeEconomicImpact(rawImpact) : normalizeTradingViewImportance(item.importance);
  return {
    event_uid: String(firstTvValue(item.event_uid, item.eventUid, item.id, item.uid)).trim(),
    event_date: eventDate,
    event_time: eventTime,
    country,
    currency,
    title,
    impact: impact || 'medium',
    actual: String(firstTvValue(item.actual, item.actual_value, item.actualValue)).trim(),
    forecast: String(firstTvValue(item.forecast, item.consensus, item.estimate)).trim(),
    previous: String(firstTvValue(item.previous, item.prev, item.prior)).trim(),
    source: sourceText,
    source_url: cleanUrl(firstTvValue(item.source_url, item.sourceUrl, item.url)),
    status: String(firstTvValue(item.status, 'scheduled')).trim() || 'scheduled',
    notes: String(firstTvValue(item.notes, item.note, item.comment)).trim()
  };
}

async function ensureEconomicEventsSchema(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS economic_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_uid TEXT UNIQUE NOT NULL,
      event_date TEXT NOT NULL,
      event_time TEXT,
      timezone TEXT DEFAULT 'Asia/Taipei',
      country TEXT,
      currency TEXT,
      title TEXT NOT NULL,
      impact TEXT DEFAULT 'medium',
      actual TEXT,
      forecast TEXT,
      previous TEXT,
      source TEXT DEFAULT 'manual',
      source_url TEXT,
      status TEXT DEFAULT 'scheduled',
      notes TEXT,
      reminded_at TEXT,
      pre_reminded_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
  await addColumnIfMissing(db, 'economic_events', 'event_date', 'TEXT');
  await addColumnIfMissing(db, 'economic_events', 'event_time', 'TEXT');
  await addColumnIfMissing(db, 'economic_events', 'timezone', "TEXT DEFAULT 'Asia/Taipei'");
  await addColumnIfMissing(db, 'economic_events', 'country', 'TEXT');
  await addColumnIfMissing(db, 'economic_events', 'currency', 'TEXT');
  await addColumnIfMissing(db, 'economic_events', 'impact', "TEXT DEFAULT 'medium'");
  await addColumnIfMissing(db, 'economic_events', 'actual', 'TEXT');
  await addColumnIfMissing(db, 'economic_events', 'forecast', 'TEXT');
  await addColumnIfMissing(db, 'economic_events', 'previous', 'TEXT');
  await addColumnIfMissing(db, 'economic_events', 'source', "TEXT DEFAULT 'manual'");
  await addColumnIfMissing(db, 'economic_events', 'source_url', 'TEXT');
  await addColumnIfMissing(db, 'economic_events', 'status', "TEXT DEFAULT 'scheduled'");
  await addColumnIfMissing(db, 'economic_events', 'notes', 'TEXT');
  await addColumnIfMissing(db, 'economic_events', 'reminded_at', 'TEXT');
  await addColumnIfMissing(db, 'economic_events', 'pre_reminded_at', 'TEXT');
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_economic_events_date ON economic_events(event_date)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_economic_events_impact ON economic_events(impact)').run();
}

async function getEconomicConfig(db, env = {}) {
  const sourceUrl = String(env.ECONOMIC_CALENDAR_API_URL || env.ECONOMIC_CALENDAR_URL || await getConfig(db, 'economic_calendar_source_url') || DEFAULT_ECONOMIC_CALENDAR_SOURCE_URL).trim();
  const sourceName = String(env.ECONOMIC_CALENDAR_SOURCE || await getConfig(db, 'economic_calendar_source_name') || DEFAULT_ECONOMIC_CALENDAR_SOURCE_NAME).trim();
  const impacts = parseList(await getConfig(db, 'economic_calendar_impacts') || 'high').map(normalizeEconomicImpact).filter(Boolean);
  const currencies = parseList(await getConfig(db, 'economic_calendar_currencies') || 'USD,EUR,GBP,JPY,CAD,AUD,CNY').map((v) => v.toUpperCase());
  const countries = parseList(await getConfig(db, 'economic_calendar_countries') || '').map((v) => v.toUpperCase());
  const targetGroup = String(await getConfig(db, 'economic_calendar_target_group') || 'paid').trim().toLowerCase();
  const remindHour = Number(await getConfig(db, 'economic_calendar_remind_hour') || 8);
  const preEventMinutes = Number(await getConfig(db, 'economic_calendar_pre_event_minutes') || 30);
  const lookaheadDays = Number(await getConfig(db, 'economic_calendar_lookahead_days') || 1);
  const autoRemind = String(await getConfig(db, 'economic_calendar_auto_remind') || '1') !== '0';
  const marketOnly = String(await getConfig(db, 'economic_calendar_market_only') || '1') !== '0';
  return {
    sourceUrl,
    sourceName,
    impacts: impacts.length ? impacts : ['high'],
    currencies,
    countries,
    targetGroup: ['all', 'pro', 'vip', 'paid'].includes(targetGroup) ? targetGroup : 'paid',
    remindHour: Number.isFinite(remindHour) ? remindHour : 8,
    preEventMinutes: Number.isFinite(preEventMinutes) ? Math.max(0, Math.min(240, preEventMinutes)) : 30,
    lookaheadDays: Number.isFinite(lookaheadDays) ? Math.max(1, Math.min(7, lookaheadDays)) : 1,
    autoRemind,
    marketOnly
  };
}

function economicEventMatchesConfig(event, config) {
  const impact = normalizeEconomicImpact(event.impact);
  if (config.impacts?.length && !config.impacts.includes(impact)) return false;
  if (config.currencies?.length && event.currency && !config.currencies.includes(String(event.currency).toUpperCase())) return false;
  if (config.countries?.length && event.country && !config.countries.includes(String(event.country).toUpperCase())) return false;
  if (config.marketOnly && !economicEventIsMarketMoving(event)) return false;
  return true;
}

async function getUpcomingMarketEconomicEvents(db, config, { hours = 48, limit = 30 } = {}) {
  await ensureEconomicEventsSchema(db);
  const nowIso = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const untilIso = new Date(Date.now() + Math.max(1, Number(hours || 48)) * 60 * 60 * 1000).toISOString();
  const rows = await db.prepare(`
    SELECT *
    FROM economic_events
    WHERE COALESCE(status, 'scheduled') != 'cancelled'
      AND event_time IS NOT NULL
      AND datetime(event_time) >= datetime(?)
      AND datetime(event_time) <= datetime(?)
    ORDER BY datetime(event_time),
      CASE impact WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
      title
    LIMIT ?
  `).bind(nowIso, untilIso, Math.max(1, Math.min(100, Number(limit || 30)))).all();
  return (rows.results || []).filter((event) => economicEventMatchesConfig(event, config));
}

async function economicEventUid(event) {
  if (event.event_uid) return String(event.event_uid).slice(0, 120);
  const raw = [
    event.source || 'calendar',
    event.event_date || '',
    event.event_time || '',
    event.currency || '',
    event.country || '',
    event.title || ''
  ].join('|');
  return `ECO${(await sha256Hex(raw)).slice(0, 20).toUpperCase()}`;
}

async function upsertEconomicEvent(db, payload, source = 'manual', options = {}) {
  if (!options.skipEnsure) await ensureEconomicEventsSchema(db);
  const eventTime = normalizeEconomicDateTime(
    payload.event_time || payload.eventTime || payload.time,
    payload.event_date || payload.eventDate || payload.date
  );
  const event = {
    event_uid: String(payload.event_uid || payload.eventUid || '').trim(),
    event_date: economicEventDate(eventTime, payload.event_date || payload.eventDate || payload.date),
    event_time: eventTime,
    country: String(payload.country || '').trim().toUpperCase(),
    currency: String(payload.currency || '').trim().toUpperCase(),
    title: String(payload.title || payload.event || payload.name || '').trim(),
    impact: normalizeEconomicImpact(payload.impact || payload.importance),
    actual: String(payload.actual || '').trim(),
    forecast: String(payload.forecast || payload.consensus || '').trim(),
    previous: String(payload.previous || payload.prev || '').trim(),
    source: String(payload.source || source || 'manual').trim(),
    source_url: cleanUrl(payload.source_url || payload.sourceUrl || payload.url),
    status: String(payload.status || 'scheduled').trim(),
    notes: String(payload.notes || payload.note || '').trim()
  };
  if (!event.title) throw new Error('請輸入事件名稱');
  event.event_uid = await economicEventUid(event);
  await db.prepare(`
    INSERT INTO economic_events (
      event_uid, event_date, event_time, timezone, country, currency, title, impact,
      actual, forecast, previous, source, source_url, status, notes, created_at, updated_at
    ) VALUES (?, ?, ?, 'Asia/Taipei', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(event_uid) DO UPDATE SET
      event_date = excluded.event_date,
      event_time = excluded.event_time,
      country = excluded.country,
      currency = excluded.currency,
      title = excluded.title,
      impact = excluded.impact,
      actual = excluded.actual,
      forecast = excluded.forecast,
      previous = excluded.previous,
      source = excluded.source,
      source_url = excluded.source_url,
      status = excluded.status,
      notes = excluded.notes,
      updated_at = datetime('now')
  `).bind(
    event.event_uid, event.event_date, event.event_time, event.country || null, event.currency || null,
    event.title, event.impact, event.actual || null, event.forecast || null, event.previous || null,
    event.source || 'manual', event.source_url || null, event.status || 'scheduled', event.notes || null
  ).run();
  return event;
}

async function fetchEconomicCalendarEvents(env, config, dateKey) {
  if (!config.sourceUrl) return { events: [], skipped: true, reason: 'source_not_configured', source: 'manual' };
  const url = buildEconomicCalendarUrl(config.sourceUrl, dateKey);
  const headers = {
    Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
    'User-Agent': 'Mozilla/5.0 (compatible; DCSignals/9.1; +https://dc-signals-v91.cc559773.workers.dev)'
  };
  if (/tradingview\.com/i.test(url)) {
    headers.Origin = 'https://www.tradingview.com';
    headers.Referer = 'https://www.tradingview.com/';
  }
  if (env.ECONOMIC_CALENDAR_API_KEY) {
    headers.Authorization = `Bearer ${env.ECONOMIC_CALENDAR_API_KEY}`;
    headers['X-API-Key'] = env.ECONOMIC_CALENDAR_API_KEY;
  }
  const attempts = [url];
  const proxyUrl = economicCalendarProxyUrl(url);
  if (proxyUrl) attempts.push(proxyUrl);
  let data;
  let usedUrl = '';
  const errors = [];
  for (const attemptUrl of attempts) {
    try {
      const res = await fetch(attemptUrl, { headers });
      if (!res.ok) {
        errors.push(`${attemptUrl} ${res.status}`);
        continue;
      }
      data = await readEconomicCalendarResponse(res, attemptUrl);
      usedUrl = attemptUrl;
      break;
    } catch (e) {
      errors.push(`${attemptUrl} ${e.message}`);
    }
  }
  if (!data) throw new Error(`經濟日曆來源無法讀取：${errors.join('；') || 'unknown error'}`);
  const events = economicEventArray(data)
    .map((item) => normalizeEconomicFeedItem(item, config.sourceName, dateKey))
    .filter(Boolean);
  return { events, source: config.sourceName, url: usedUrl || url, proxied: usedUrl && usedUrl !== url };
}

async function syncEconomicEvents(db, env = {}, dateKey = taipeiDateKey(), options = {}) {
  if (!options.skipEnsure) await ensureEconomicEventsSchema(db);
  const config = options.config || await getEconomicConfig(db, env);
  const fetched = await fetchEconomicCalendarEvents(env, config, dateKey);
  let saved = 0;
  for (const event of fetched.events || []) {
    if (!economicEventMatchesConfig(event, config)) continue;
    await upsertEconomicEvent(db, event, event.source || config.sourceName, { skipEnsure: true });
    saved++;
  }
  return { synced: saved, total: (fetched.events || []).length, skipped: !!fetched.skipped, reason: fetched.reason || '', source: fetched.source || config.sourceName, url: fetched.url || '', proxied: !!fetched.proxied };
}

async function syncEconomicEventsRange(db, env = {}, startDateKey = taipeiDateKey(), days = 1) {
  const total = { synced: 0, total: 0, days: 0, errors: [], skipped: false, source: '' };
  const count = Math.max(1, Math.min(7, Number(days || 1)));
  const base = new Date(`${adminDateKey(startDateKey) || taipeiDateKey()}T00:00:00+08:00`);
  await ensureEconomicEventsSchema(db);
  const config = await getEconomicConfig(db, env);
  for (let i = 0; i < count; i++) {
    const key = taipeiDateKey(new Date(base.getTime() + i * 86400000));
    try {
      const result = await syncEconomicEvents(db, env, key, { skipEnsure: true, config });
      total.synced += Number(result.synced || 0);
      total.total += Number(result.total || 0);
      total.days++;
      total.skipped = total.skipped || !!result.skipped;
      if (result.source) total.source = result.source;
      if (result.proxied) total.proxied = true;
    } catch (e) {
      total.errors.push(`${key}: ${e.message}`);
    }
  }
  await setConfig(db, 'economic_calendar_last_sync', new Date().toISOString());
  return total;
}

async function getEconomicEventsForDate(db, dateKey = taipeiDateKey(), config = null) {
  await ensureEconomicEventsSchema(db);
  const rows = await db.prepare(`
    SELECT * FROM economic_events
    WHERE event_date = ? AND COALESCE(status, 'scheduled') != 'cancelled'
    ORDER BY
      CASE impact WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
      COALESCE(event_time, event_date),
      title
  `).bind(dateKey).all();
  let events = rows.results || [];
  if (config) events = events.filter((event) => economicEventMatchesConfig(event, config));
  return events;
}

function formatEconomicEventsMessage(events, options = {}) {
  const dateKey = options.dateKey || taipeiDateKey();
  const source = options.source || 'Economic Calendar';
  let msg = `<b>今日重要市場事件</b>\n`;
  msg += `${escHtml(dateKey)} · 台灣時間 UTC+8\n`;
  msg += `來源：${escHtml(source)}\n\n`;
  if (!events.length) {
    msg += `目前沒有符合條件的重大市場事件。`;
    return msg;
  }
  for (const event of events) {
    const line1 = `${economicEventTimeText(event)} ${event.currency || event.country || '-'} ${economicImpactLabel(event.impact)}｜${event.title}`;
    msg += `<b>${escHtml(line1)}</b>\n`;
    const values = [
      event.forecast ? `預期 ${event.forecast}` : '',
      event.previous ? `前值 ${event.previous}` : '',
      event.actual ? `實際 ${event.actual}` : ''
    ].filter(Boolean).join(' · ');
    if (values) msg += `${escHtml(values)}\n`;
    if (event.notes) msg += `${escHtml(event.notes)}\n`;
    msg += `\n`;
  }
  msg += `提醒：重大數據前後可能擴大點差與滑價，訊號請依風控執行。`;
  return msg.trim();
}

async function sendEconomicEventsReminder(env = {}, options = {}) {
  const db = env.DB;
  await ensureEconomicEventsSchema(db);
  const dateKey = options.date || taipeiDateKey();
  const config = await getEconomicConfig(db, env);
  if (!options.force) {
    if (!config.autoRemind) return { sent: 0, skipped: true, reason: 'auto_remind_disabled' };
    if (taipeiHour() !== config.remindHour) return { sent: 0, skipped: true, reason: 'outside_remind_hour', remindHour: config.remindHour };
    const last = await getConfig(db, `economic_calendar_last_reminded_${dateKey}`);
    if (last === '1') return { sent: 0, skipped: true, reason: 'already_reminded' };
  }

  let sync = null;
  try {
    sync = await syncEconomicEvents(db, env, dateKey);
  } catch (e) {
    sync = { synced: 0, error: e.message };
  }
  const events = await getEconomicEventsForDate(db, dateKey, config);
  if (!events.length) return { sent: 0, skipped: true, reason: 'no_events', sync };
  const msg = formatEconomicEventsMessage(events, { dateKey, source: config.sourceName });
  const result = await broadcastMessage(db, msg, config.targetGroup, 'alert');
  await db.prepare(`
    UPDATE economic_events
    SET reminded_at = COALESCE(reminded_at, datetime('now')), updated_at = datetime('now')
    WHERE event_date = ? AND COALESCE(status, 'scheduled') != 'cancelled'
  `).bind(dateKey).run();
  if (!options.force) await setConfig(db, `economic_calendar_last_reminded_${dateKey}`, '1');
  return { ...result, eventCount: events.length, targetGroup: config.targetGroup, sync };
}

async function sendEconomicPreEventAlerts(env = {}, options = {}) {
  const db = env.DB;
  await ensureEconomicEventsSchema(db);
  const config = await getEconomicConfig(db, env);
  if (!options.force && (!config.autoRemind || !config.preEventMinutes)) {
    return { sent: 0, skipped: true, reason: config.autoRemind ? 'pre_event_disabled' : 'auto_remind_disabled' };
  }
  const dateKey = options.date || taipeiDateKey();
  let sync = null;
  try {
    sync = await syncEconomicEvents(db, env, dateKey);
  } catch (e) {
    sync = { synced: 0, error: e.message };
  }
  const windowMinutes = Math.max(1, Number(config.preEventMinutes || 30));
  const nowIso = new Date().toISOString();
  const cutoffIso = new Date(Date.now() + windowMinutes * 60 * 1000).toISOString();
  const rows = await db.prepare(`
    SELECT *
    FROM economic_events
    WHERE COALESCE(status, 'scheduled') != 'cancelled'
      AND pre_reminded_at IS NULL
      AND event_time IS NOT NULL
      AND datetime(event_time) >= datetime(?)
      AND datetime(event_time) <= datetime(?)
    ORDER BY datetime(event_time), CASE impact WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, title
    LIMIT 12
  `).bind(nowIso, cutoffIso).all();
  const events = (rows.results || []).filter((event) => economicEventMatchesConfig(event, config));
  if (!events.length) return { sent: 0, skipped: true, reason: 'no_upcoming_events', sync };

  const msg = [
    '<b>重要市場事件即將公布</b>',
    `${escHtml(dateKey)} · 台灣時間 UTC+8 · 未來 ${escHtml(windowMinutes)} 分鐘`,
    '',
    ...events.map((event) => {
      const values = [
        event.forecast ? `預期 ${event.forecast}` : '',
        event.previous ? `前值 ${event.previous}` : ''
      ].filter(Boolean).join(' · ');
      return `<b>${escHtml(economicEventTimeText(event) + ' ' + (event.currency || event.country || '-') + '｜' + event.title)}</b>\n${escHtml(economicImpactLabel(event.impact))}${values ? ` · ${escHtml(values)}` : ''}`;
    }),
    '',
    '提醒：重大數據前後可能擴大點差、滑價與假突破，請降低槓桿並嚴格依風控。'
  ].join('\n');
  const result = await broadcastMessage(db, msg, config.targetGroup, 'alert');
  await db.prepare(`
    UPDATE economic_events
    SET pre_reminded_at = COALESCE(pre_reminded_at, datetime('now')), updated_at = datetime('now')
    WHERE event_uid IN (${events.map(() => '?').join(',')})
  `).bind(...events.map((event) => event.event_uid)).run();
  return { ...result, eventCount: events.length, targetGroup: config.targetGroup, sync };
}

async function maybeSyncWeeklyEconomicEvents(env = {}, options = {}) {
  const db = env.DB;
  await ensureEconomicEventsSchema(db);
  const dateKey = options.date || taipeiDateKey();
  const weekStart = taipeiWeekStartKey(dateKey);
  const last = await getConfig(db, 'economic_calendar_last_weekly_sync');
  if (!options.force && last === weekStart) {
    return { skipped: true, reason: 'already_synced_this_week', weekStart };
  }
  const result = await syncEconomicEventsRange(db, env, weekStart, 7);
  await setConfig(db, 'economic_calendar_last_weekly_sync', weekStart);
  await logAction(db, 'economic:cron', 'economic_weekly_sync', weekStart, `synced ${result.synced}/${result.total}`);
  return { ...result, weekStart };
}

function normalizeUserCallback(data) {
  if (!data) return data;
  if (data.startsWith('toggle_sym_')) return `sym_${data.replace('toggle_sym_', '')}`;
  if (data.startsWith('toggle_type_')) return `type_${data.replace('toggle_type_', '')}`;
  if (data.startsWith('set_cap_')) return `cap_${data.replace('set_cap_', '')}`;
  if (data.startsWith('set_risk_')) return `risk_${data.replace('set_risk_', '')}`;
  if (data.startsWith('toggle_notify_')) {
    const key = data.replace('toggle_notify_', '');
    const map = { entry: 'ntf_entry', tp: 'ntf_tp', sl: 'ntf_sl', update: 'ntf_update', daily: 'ntf_daily', announce: 'ntf_announce', alert: 'ntf_alert' };
    return map[key] || data;
  }
  if (data === 'save_symbols') return 'u_subscribe';
  if (data === 'save_types') return 'u_signaltype';
  if (data === 'set_quiet_start' || data === 'set_quiet_end') return 'u_quiet';
  return data;
}

function renderQuietText(settings) {
  let m = `<b>安靜時段</b>\n\n`;
  m += `狀態：${settings.quiet_enabled ? '已啟用' : '未啟用'}\n`;
  m += `開始：<code>${escHtml(settings.quiet_start || '23:00')}</code>\n`;
  m += `結束：<code>${escHtml(settings.quiet_end || '07:00')}</code>\n\n`;
  m += `安靜時段內的訊號會排程到結束後推送。`;
  return m;
}

function renderQuietKeyboard(settings) {
  return {
    inline_keyboard: [
      [{ text: settings.quiet_enabled ? '🔕 關閉' : '🔔 啟用', callback_data: 'toggle_quiet' }],
      [
        { text: '開始 22:00', callback_data: 'quiet_s_22' },
        { text: '開始 23:00', callback_data: 'quiet_s_23' },
        { text: '開始 00:00', callback_data: 'quiet_s_00' }
      ],
      [
        { text: '結束 06:00', callback_data: 'quiet_e_06' },
        { text: '結束 07:00', callback_data: 'quiet_e_07' },
        { text: '結束 08:00', callback_data: 'quiet_e_08' }
      ],
      [{ text: '« 返回', callback_data: 'u_settings' }]
    ]
  };
}

function renderCapitalText(settings) {
  const capital = Number(settings.capital || 0);
  const riskPercent = Number(settings.risk_percent || 0);
  const riskAmount = capital * (riskPercent / 100);
  let m = `<b>資金設定</b>\n\n`;
  m += `交易資金：<b>$${fmtNum(capital)}</b>\n`;
  m += `風險比例：<b>${riskPercent}%</b>\n`;
  m += `單筆風險：<b>$${fmtNum(riskAmount.toFixed(0))}</b>\n\n`;
  m += `設定後，訊號卡會顯示個人化倉位參考。`;
  return m;
}

function renderCapitalKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '$1,000', callback_data: 'cap_1000' },
        { text: '$5,000', callback_data: 'cap_5000' },
        { text: '$10,000', callback_data: 'cap_10000' }
      ],
      [
        { text: '$25,000', callback_data: 'cap_25000' },
        { text: '$50,000', callback_data: 'cap_50000' },
        { text: '$100,000', callback_data: 'cap_100000' }
      ],
      [
        { text: '風險 0.5%', callback_data: 'risk_0.5' },
        { text: '風險 1%', callback_data: 'risk_1' },
        { text: '風險 2%', callback_data: 'risk_2' }
      ],
      [{ text: '« 返回', callback_data: 'u_settings' }]
    ]
  };
}

async function renderOrderPicker(cid, msgId, db, tier) {
  const prices = {
    1: await getConfig(db, `${tier}_price_1m`) || (tier === 'vip' ? '599' : '299'),
    3: await getConfig(db, `${tier}_price_3m`) || (tier === 'vip' ? '1617' : '807'),
    12: await getConfig(db, `${tier}_price_12m`) || (tier === 'vip' ? '5748' : '2868')
  };
  let m = `<b>訂閱 ${tierName(tier)}</b>\n\n`;
  m += `選擇訂閱時長，系統會建立付款訂單。\n\n`;
  m += `點選方案即表示您已閱讀並同意服務條款與交易風險揭露（版本 ${ORDER_TERMS_VERSION}）。`;
  const buttons = [
    [{ text: `1個月 NT$${prices[1]}`, callback_data: `buy_${tier}_1` }],
    [{ text: `3個月 NT$${prices[3]} (省10%)`, callback_data: `buy_${tier}_3` }],
    [{ text: `12個月 NT$${prices[12]} (省20%)`, callback_data: `buy_${tier}_12` }],
    [{ text: '« 返回', callback_data: 'u_plans' }]
  ];
  return editTg(cid, msgId, m, { inline_keyboard: buttons });
}

async function getTelegramUserOrders(db, userId, limit = 8) {
  await ensureOrderPaymentSchema(db);
  const rows = await db.prepare(`
    SELECT order_id, tier, months, days, amount, status, payment_method, payment_provider, payment_url, payment_note, currency,
           terms_version, terms_accepted_at, risk_acknowledged_at, paid_at, refunded_at, refund_amount, refund_note,
           created_at, confirmed_at
    FROM orders
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(userId, limit).all();
  const orders = rows.results || [];
  const events = await getOrderEvents(db, orders.map((order) => order.order_id), 80);
  for (const order of orders) {
    order.events = events[String(order.order_id || '').toUpperCase()] || [];
  }
  return orders;
}

function telegramOrderStatusIcon(status) {
  if (status && typeof status === 'object' && status.refunded_at) return '💸';
  status = status && typeof status === 'object' ? status.status : status;
  if (status === 'confirmed') return '✅';
  if (status === 'paid') return '💰';
  if (status === 'pending') return '⏳';
  if (status === 'cancelled' || status === 'rejected') return '❌';
  return '📋';
}

function memberOrderDisplayStatus(order) {
  if (order && typeof order === 'object' && order.refunded_at) return '已退款';
  return memberOrderStatusLabel(order && typeof order === 'object' ? order.status : order);
}

function telegramOrderLine(order) {
  const method = memberReceiptPaymentMethod(order);
  const refund = order.refunded_at ? `\n退款：${escHtml(orderRefundMoney(order))} · ${escHtml(memberReceiptDate(order.refunded_at))}` : '';
  return `${telegramOrderStatusIcon(order)} <code>${escHtml(order.order_id)}</code>\n` +
    `${tierName(order.tier)} ${order.months || 0}個月 · ${escHtml(memberReceiptMoney(order))}\n` +
    `狀態：${escHtml(memberOrderDisplayStatus(order))} · ${escHtml(method)}\n` +
    `建立：${escHtml(memberReceiptDate(order.created_at))}${refund}`;
}

function renderTelegramOrdersText(orders) {
  let m = `<b>我的訂單</b>\n\n`;
  if (!orders.length) {
    m += `目前沒有訂單紀錄。\n\n可從方案頁建立訂單，或到會員中心線上續費。`;
    return m;
  }
  for (const order of orders) {
    m += `${telegramOrderLine(order)}\n\n`;
  }
  m += `點選下方訂單可查看付款狀態、條款紀錄與流程。`;
  return m.trim();
}

function renderTelegramOrdersKeyboard(orders, env) {
  const rows = orders.slice(0, 6).map((order) => ([{
    text: `${telegramOrderStatusIcon(order)} ${order.order_id}`,
    callback_data: `u_order_${order.order_id}`
  }]));
  rows.push([{ text: '會員中心', url: memberPortalUrl(env) }]);
  rows.push([{ text: '方案 / 續費', callback_data: 'u_plans' }]);
  rows.push([{ text: '« 返回', callback_data: 'u_menu' }]);
  return { inline_keyboard: rows };
}

function renderTelegramOrderReceipt(order, events = [], env = {}) {
  let m = `<b>${order.refunded_at ? '退款收據' : order.status === 'confirmed' ? '付款收據' : '訂單明細'}</b>\n\n`;
  m += `訂單：<code>${escHtml(order.order_id)}</code>\n`;
  m += `狀態：${telegramOrderStatusIcon(order)} ${escHtml(memberOrderDisplayStatus(order))}\n`;
  m += `方案：${tierName(order.tier)} ${order.months || 0}個月 / ${order.days || 0}天\n`;
  m += `金額：<b>${escHtml(memberReceiptMoney(order))}</b>\n`;
  m += `付款：${escHtml(memberReceiptPaymentMethod(order))}\n`;
  m += `建立：${escHtml(memberReceiptDate(order.created_at))}\n`;
  if (order.paid_at || order.confirmed_at) m += `付款/確認：${escHtml(memberReceiptDate(order.confirmed_at || order.paid_at))}\n`;
  if (order.refunded_at) {
    m += `\n<b>退款紀錄</b>\n`;
    m += `金額：${escHtml(orderRefundMoney(order))}\n`;
    m += `時間：${escHtml(memberReceiptDate(order.refunded_at))}\n`;
    if (order.refund_note) m += `原因：${escHtml(order.refund_note)}\n`;
  }
  if (order.terms_accepted_at) {
    m += `\n<b>條款紀錄</b>\n`;
    m += `版本：${escHtml(order.terms_version || '-')}\n`;
    m += `同意：${escHtml(memberReceiptDate(order.terms_accepted_at))}\n`;
  }
  if (order.payment_note) {
    m += `\n<b>付款備註</b>\n${escHtml(order.payment_note)}\n`;
  }
  if (events.length) {
    m += `\n<b>流程</b>\n`;
    for (const event of events.slice(0, 5)) {
      m += `• ${escHtml(memberOrderEventLabel(event.event_type))} · ${escHtml(memberReceiptDate(event.created_at))}`;
      if (event.message) m += `\n  ${escHtml(event.message)}`;
      m += `\n`;
    }
  }
  m += `\n網站版可列印或另存 PDF。`;
  return m.trim();
}

function renderTelegramOrderReceiptKeyboard(order, env) {
  return {
    inline_keyboard: [
      [{ text: '開啟網站收據', url: `${publicBaseUrl(env)}/member/receipt/${encodeURIComponent(order.order_id)}` }],
      [{ text: '取得會員中心登入碼', callback_data: 'u_login' }],
      [{ text: '我的訂單', callback_data: 'u_orders' }],
      [{ text: '« 返回', callback_data: 'u_menu' }]
    ]
  };
}

function renderUserMenuText(user) {
  const dl = user.tier !== 'free' ? daysLeft(user.tier_expires_at) : 0;
  let m = `<b>DC Trading Signals 會員工作台</b>\n\n`;
  m += `${escHtml(user.first_name || '用戶')} · <b>${tierName(user.tier)}</b>\n`;
  if (user.tier !== 'free') {
    m += `剩餘：<b>${dl}</b> 天\n`;
    m += `到期：${escHtml(fmtDate(user.tier_expires_at))}\n`;
  } else {
    m += `狀態：尚未訂閱\n`;
  }
  m += `\n請用下方按鈕操作，手機上不需要輸入指令。`;
  return m;
}

function renderUserMenuKeyboard(env = {}) {
  return {
    inline_keyboard: [
      [
        { text: '最新訊號', callback_data: 'u_signals' },
        { text: '進行中', callback_data: 'u_active' }
      ],
      [
        { text: '會員中心', url: memberPortalUrl(env) },
        { text: '訂閱設定', callback_data: 'u_subscribe' }
      ],
      [
        { text: '財經日曆', callback_data: 'u_calendar' },
        { text: '今日事件', callback_data: 'u_events' }
      ],
      [
        { text: '我的績效', callback_data: 'u_mystats' },
        { text: '升級 / 續費', callback_data: 'u_plans' }
      ],
      [
        { text: '我的訂單', callback_data: 'u_orders' },
        { text: '個人設定', callback_data: 'u_settings' }
      ],
      [
        { text: '邀請好友', callback_data: 'u_invite' },
        { text: '聯繫客服', callback_data: 'u_contact' }
      ],
      [
        { text: '幫助說明', callback_data: 'u_help' }
      ]
    ]
  };
}

function renderSubscribeText(categories, subscribedSymbols) {
  let m = `<b>訂閱設定</b>\n\n`;
  m += `選擇要接收訊號的品種。\n\n`;
  for (const [cat, catSymbols] of Object.entries(categories)) {
    const catInfo = CONFIG.SYMBOL_CATEGORIES[cat] || { name: cat };
    const names = catSymbols.map((s) => subscribedSymbols.includes(s.symbol) ? `${s.symbol} 已選` : s.symbol).join(' · ');
    m += `<b>${escHtml(catInfo.name)}</b>\n${escHtml(names)}\n\n`;
  }
  m += `已選擇 <b>${subscribedSymbols.length}</b> 個品種`;
  return m;
}

function renderSubscribeKeyboard(categories, subscribedSymbols) {
  const buttons = [];
  for (const catSymbols of Object.values(categories)) {
    const row = [];
    for (const s of catSymbols) {
      const icon = subscribedSymbols.includes(s.symbol) ? '✅' : '⬜';
      row.push({ text: `${icon} ${s.symbol}`, callback_data: `sym_${s.symbol}` });
      if (row.length === 2) {
        buttons.push([...row]);
        row.length = 0;
      }
    }
    if (row.length > 0) buttons.push([...row]);
  }
  buttons.push([{ text: '訊號類型', callback_data: 'u_signaltype' }]);
  buttons.push([{ text: '« 返回', callback_data: 'u_menu' }]);
  return { inline_keyboard: buttons };
}

function renderSignalTypeText(signalTypes) {
  let m = `<b>訊號類型偏好</b>\n\n`;
  m += `選擇想接收的訊號型態。\n\n`;
  for (const [type, info] of Object.entries(CONFIG.SIGNAL_TYPES)) {
    const mark = signalTypes.includes(type) ? '已開啟' : '未開啟';
    m += `<b>${escHtml(info.name)}</b> · ${mark}\n${escHtml(info.desc)}\n\n`;
  }
  return m.trim();
}

function renderSignalTypeKeyboard(signalTypes) {
  const buttons = [];
  for (const [type, info] of Object.entries(CONFIG.SIGNAL_TYPES)) {
    const icon = signalTypes.includes(type) ? '✅' : '⬜';
    buttons.push([{ text: `${icon} ${info.name}`, callback_data: `type_${type}` }]);
  }
  buttons.push([{ text: '« 返回', callback_data: 'u_subscribe' }]);
  return { inline_keyboard: buttons };
}

function renderSettingsText(settings) {
  return `<b>個人設定</b>\n\n接收狀態：${settings.paused ? '已暫停' : '正常接收'}\n時區：<code>${escHtml(settings.timezone || 'Asia/Taipei')}</code>`;
}

function renderSettingsKeyboard(settings) {
  return {
    inline_keyboard: [
      [{ text: '通知設定', callback_data: 'u_notify' }],
      [{ text: '安靜時段', callback_data: 'u_quiet' }],
      [{ text: '資金設定', callback_data: 'u_capital' }],
      [{ text: '時區設定', callback_data: 'u_timezone' }],
      [{ text: settings.paused ? '恢復接收訊號' : '暫停接收訊號', callback_data: 'toggle_pause' }],
      [{ text: '« 返回', callback_data: 'u_menu' }]
    ]
  };
}

function renderNotifyText() {
  return `<b>通知設定</b>\n\n點擊按鈕切換要接收的通知。`;
}

function renderNotifyKeyboard(settings) {
  return {
    inline_keyboard: [
      [
        { text: (settings.notify_entry ? '✅' : '⬜') + ' 進場訊號', callback_data: 'ntf_entry' },
        { text: (settings.notify_tp ? '✅' : '⬜') + ' 止盈通知', callback_data: 'ntf_tp' }
      ],
      [
        { text: (settings.notify_sl ? '✅' : '⬜') + ' 止損通知', callback_data: 'ntf_sl' },
        { text: (settings.notify_update ? '✅' : '⬜') + ' 訊號更新', callback_data: 'ntf_update' }
      ],
      [
        { text: (settings.notify_daily_report ? '✅' : '⬜') + ' 每日報告', callback_data: 'ntf_daily' },
        { text: (settings.notify_announcement ? '✅' : '⬜') + ' 公告', callback_data: 'ntf_announce' }
      ],
      [{ text: (settings.notify_alert ? '✅' : '⬜') + ' 行情警報', callback_data: 'ntf_alert' }],
      [{ text: '« 返回', callback_data: 'u_settings' }]
    ]
  };
}

function shortSignalId(uid) {
  const value = String(uid || '');
  return value.length > 8 ? value.slice(0, 8) : value;
}

function signalStatusLabel(sig) {
  if (sig.status === 'active') return '進行中';
  if (sig.status === 'pending') return '草稿';
  if (sig.status === 'cancelled') return '取消';
  if (sig.result === 'win') return '獲利';
  if (sig.result === 'loss') return '止損';
  if (sig.result === 'breakeven') return '保本';
  return sig.status || '-';
}

function formatSignalListItem(sig, tier, options = {}) {
  const actionInfo = CONFIG.ACTIONS[sig.action] || { emoji: '', name: sig.action };
  const typeInfo = CONFIG.SIGNAL_TYPES[sig.signal_type] || { emoji: '', name: sig.signal_type || '訊號' };
  const side = actionInfo.name || sig.action;
  const pnl = sig.pnl_points != null ? ` ${sig.pnl_points >= 0 ? '+' : ''}${fmtPrice(sig.pnl_points)}點` : '';
  const lines = [
    `${actionInfo.emoji || ''} <b>${escHtml(side)} ${escHtml(sig.ticker)}</b>`,
    `${typeInfo.emoji || ''} ${escHtml(typeInfo.name)} · ${escHtml(signalStatusLabel(sig))}${escHtml(pnl)}`,
    '',
    `💰 進場　<code>${fmtPrice(sig.entry_price)}</code>`,
    `🛑 止損　<code>${fmtPrice(sig.stop_loss)}</code>`
  ];
  if (sig.tp1 || sig.tp2 || (sig.tp3 && tier === 'vip')) lines.push('');
  if (sig.tp1) lines.push(`🎯 TP1　<code>${fmtPrice(sig.tp1)}</code>`);
  if (sig.tp2) lines.push(`🎯 TP2　<code>${fmtPrice(sig.tp2)}</code>`);
  if (sig.tp3 && tier === 'vip') lines.push(`🎯 TP3　<code>${fmtPrice(sig.tp3)}</code>`);
  const tpText = signalTpHitText(sig);
  if (tpText) lines.push(`✅ 已達　${escHtml(tpText)}`);
  if (options.includeTimes) {
    const endedAt = sig.closed_at ? fmtSignalTime(sig.closed_at) : '尚未結束';
    lines.push('');
    lines.push(`時間　${fmtSignalTime(sig.created_at)} → ${endedAt}`);
  }
  if (options.includeId) {
    lines.push('');
    lines.push(`單號　<code>${escHtml(shortSignalId(sig.signal_uid))}</code>`);
  }
  return lines.join('\n');
}

function signalTpHitCountFromFields(signal = {}) {
  const explicit = Number(signal.tp_hit_count || 0);
  const inferred = signal.tp3_hit_at ? 3 : signal.tp2_hit_at ? 2 : signal.tp1_hit_at ? 1 : 0;
  return Math.max(explicit, inferred);
}

function signalTpHitText(signal = {}) {
  const count = signalTpHitCountFromFields(signal);
  const labels = [];
  if (count >= 1 && signal.tp1 != null) labels.push('TP1');
  if (count >= 2 && signal.tp2 != null) labels.push('TP2');
  if (count >= 3 && signal.tp3 != null) labels.push('TP3');
  return labels.join(' / ');
}

function signalTpHitCountAtPrice(signal = {}, price, type = '') {
  const exit = Number(price);
  let count = signalTpHitCountFromFields(signal);
  const explicit = String(type || '').toUpperCase().match(/^TP([123])$/);
  if (explicit) count = Math.max(count, Number(explicit[1]));
  if (!Number.isFinite(exit)) return count;
  const isLong = signal.action === 'LONG';
  const targets = [signal.tp1, signal.tp2, signal.tp3];
  targets.forEach((target, index) => {
    const value = Number(target);
    if (!Number.isFinite(value)) return;
    const touched = isLong ? exit >= value : exit <= value;
    if (touched) count = Math.max(count, index + 1);
  });
  return Math.max(0, Math.min(3, count));
}

async function ensureSignalLifecycleSchema(db) {
  await addColumnIfMissing(db, 'signals', 'tp1_hit_at', 'TEXT');
  await addColumnIfMissing(db, 'signals', 'tp2_hit_at', 'TEXT');
  await addColumnIfMissing(db, 'signals', 'tp3_hit_at', 'TEXT');
  await addColumnIfMissing(db, 'signals', 'tp_hit_count', 'INTEGER DEFAULT 0');
}

async function markSignalTpHits(db, signalUid, count) {
  const hitCount = Math.max(0, Math.min(3, Number(count || 0)));
  if (!signalUid || hitCount <= 0) return { tpHitCount: 0, updated: false };
  await ensureSignalLifecycleSchema(db);
  const before = await db.prepare(`
    SELECT tp_hit_count, tp1_hit_at, tp2_hit_at, tp3_hit_at
    FROM signals
    WHERE signal_uid = ?
  `).bind(signalUid).first();
  const previous = signalTpHitCountFromFields(before || {});
  await db.prepare(`
    UPDATE signals
    SET tp_hit_count = CASE WHEN COALESCE(tp_hit_count, 0) > ? THEN COALESCE(tp_hit_count, 0) ELSE ? END,
        tp1_hit_at = CASE WHEN ? >= 1 THEN COALESCE(tp1_hit_at, datetime('now')) ELSE tp1_hit_at END,
        tp2_hit_at = CASE WHEN ? >= 2 THEN COALESCE(tp2_hit_at, datetime('now')) ELSE tp2_hit_at END,
        tp3_hit_at = CASE WHEN ? >= 3 THEN COALESCE(tp3_hit_at, datetime('now')) ELSE tp3_hit_at END
    WHERE signal_uid = ?
  `).bind(hitCount, hitCount, hitCount, hitCount, hitCount, signalUid).run();
  return { tpHitCount: Math.max(previous, hitCount), previousTpHitCount: previous, updated: hitCount > previous };
}

async function closeSignalRecord(db, signal, price, type = 'CLOSE', reason = '') {
  await ensureSignalLifecycleSchema(db);
  const exitPrice = asNumber(price);
  if (exitPrice === null) throw new Error('請輸入結案價格');
  const closeType = String(type || 'CLOSE').toUpperCase();
  const pnl = signal.action === 'LONG' ? exitPrice - Number(signal.entry_price) : Number(signal.entry_price) - exitPrice;
  const result = closeType === 'SL' ? 'loss' : pnl > 0.5 ? 'win' : pnl < -0.5 ? 'loss' : 'breakeven';
  const tpHitCount = signalTpHitCountAtPrice(signal, exitPrice, closeType);
  await db.prepare(`
    UPDATE signals
    SET status = 'closed',
        exit_price = ?,
        pnl_points = ?,
        result = ?,
        exit_reason = ?,
        closed_at = datetime('now'),
        tp_hit_count = CASE WHEN COALESCE(tp_hit_count, 0) > ? THEN COALESCE(tp_hit_count, 0) ELSE ? END,
        tp1_hit_at = CASE WHEN ? >= 1 THEN COALESCE(tp1_hit_at, datetime('now')) ELSE tp1_hit_at END,
        tp2_hit_at = CASE WHEN ? >= 2 THEN COALESCE(tp2_hit_at, datetime('now')) ELSE tp2_hit_at END,
        tp3_hit_at = CASE WHEN ? >= 3 THEN COALESCE(tp3_hit_at, datetime('now')) ELSE tp3_hit_at END
    WHERE signal_uid = ?
  `).bind(exitPrice, pnl, result, reason || closeType, tpHitCount, tpHitCount, tpHitCount, tpHitCount, tpHitCount, signal.signal_uid).run();

  await db.prepare(`
    INSERT INTO performance (signal_uid, ticker, direction, signal_type, entry_price, exit_price, pnl_points, result, exit_reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(signal.signal_uid, signal.ticker, signal.action, signal.signal_type, signal.entry_price, exitPrice, pnl, result, closeType).run();

  return {
    signalUid: signal.signal_uid,
    ticker: signal.ticker,
    price: exitPrice,
    pnl,
    result,
    tpHitCount,
    tpHitsText: signalTpHitText({ ...signal, tp_hit_count: tpHitCount }),
    type: closeType,
    reason: reason || closeType
  };
}

async function closeActiveSignalsForReplacement(db, nextSignal, actorId, env = {}, notify = true) {
  await ensureSignalLifecycleSchema(db);
  const rows = await db.prepare(`
    SELECT * FROM signals
    WHERE ticker = ? AND status = 'active' AND signal_uid != ?
    ORDER BY created_at DESC
    LIMIT 8
  `).bind(nextSignal.ticker, nextSignal.signal_uid || '').all();
  const closed = [];
  for (const signal of rows.results || []) {
    const reason = `新訊號 ${nextSignal.action || ''} ${nextSignal.ticker} 進場，自動結束上一筆`;
    const result = await closeSignalRecord(db, signal, nextSignal.entry_price, 'AUTO', reason);
    if (notify) {
      const tpNote = result.tpHitsText ? `${reason}\n已達 ${result.tpHitsText}` : reason;
      result.delivery = await broadcastExit(db, 'AUTO', signal.ticker, result.price, result.pnl, tpNote, signal.signal_uid);
    } else {
      result.delivery = { sent: 0 };
    }
    await logAction(db, actorId || 'system', 'auto_signal_close', signal.signal_uid, `${signal.ticker} @${fmtPrice(nextSignal.entry_price)} ${result.pnl >= 0 ? '+' : ''}${fmtPrice(result.pnl)}`);
    closed.push(result);
  }
  return closed;
}

async function ensurePerformanceSchema(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS performance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      signal_uid TEXT NOT NULL,
      ticker TEXT NOT NULL,
      direction TEXT NOT NULL,
      signal_type TEXT,
      entry_price REAL NOT NULL,
      exit_price REAL NOT NULL,
      pnl_points REAL,
      result TEXT CHECK(result IN ('win', 'loss', 'breakeven')),
      exit_reason TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_perf_ticker ON performance(ticker)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_perf_result ON performance(result)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_perf_created ON performance(created_at)').run();
}

function signalRebuildRangeFromPayload(payload = {}) {
  const all = payload.all === true || payload.all === '1';
  const start = all ? '' : adminDateKey(payload.start);
  const end = all ? '' : adminDateKey(payload.end);
  const limitRaw = Number(payload.limit || 5000);
  const limit = Math.max(100, Math.min(5000, Number.isFinite(limitRaw) ? limitRaw : 5000));
  const normalizedStart = start && end && start > end ? end : start;
  const normalizedEnd = start && end && start > end ? start : end;
  return { start: normalizedStart, end: normalizedEnd, limit, all };
}

async function rebuildSignalPerformance(db, adminId = 'system', payload = {}) {
  await ensureSignalLifecycleSchema(db);
  await ensurePerformanceSchema(db);
  const range = signalRebuildRangeFromPayload(payload);
  const dateWhere = adminDateWhere('created_at', range);
  const where = ["status IN ('active', 'closed')"];
  const binds = [];
  if (dateWhere.clause) {
    where.push(dateWhere.clause.replace(/^WHERE\s+/i, ''));
    binds.push(...dateWhere.binds);
  }
  const rows = await db.prepare(`
    SELECT *
    FROM signals
    WHERE ${where.join(' AND ')}
    ORDER BY ticker, datetime(created_at), id
    LIMIT ?
  `).bind(...binds, range.limit).all();

  const groups = new Map();
  for (const row of rows.results || []) {
    const ticker = String(row.ticker || '').trim().toUpperCase();
    if (!ticker) continue;
    if (!groups.has(ticker)) groups.set(ticker, []);
    groups.get(ticker).push(row);
  }

  let scanned = 0;
  let closedByNext = 0;
  let repairedClosed = 0;
  let tpUpdated = 0;
  let performanceRows = 0;
  let skipped = 0;

  for (const [ticker, signals] of groups.entries()) {
    for (let i = 0; i < signals.length; i++) {
      const signal = signals[i];
      scanned++;
      const entry = asNumber(signal.entry_price);
      if (entry === null) {
        skipped++;
        continue;
      }
      const next = signals.slice(i + 1).find((candidate) => asNumber(candidate.entry_price) !== null);
      let exitPrice = asNumber(signal.exit_price);
      let closedAt = signal.closed_at || null;
      let exitReason = String(signal.exit_reason || '').trim();
      let shouldCloseByNext = false;

      if (next && (signal.status === 'active' || exitPrice === null)) {
        exitPrice = asNumber(next.entry_price);
        closedAt = next.created_at || closedAt || new Date().toISOString();
        exitReason = `新訊號 ${next.action || ''} ${ticker} 進場，自動結束上一筆`;
        shouldCloseByNext = true;
      }

      if (exitPrice === null) {
        skipped++;
        continue;
      }

      const pnl = signal.action === 'LONG' ? exitPrice - entry : entry - exitPrice;
      const result = pnl > 0.5 ? 'win' : pnl < -0.5 ? 'loss' : 'breakeven';
      const tpHitCount = signalTpHitCountAtPrice(signal, exitPrice, exitReason);
      const previousTpHitCount = signalTpHitCountFromFields(signal);
      const effectiveClosedAt = closedAt || signal.closed_at || new Date().toISOString();
      const effectiveReason = exitReason || '績效重建';

      await db.prepare(`
        UPDATE signals
        SET status = 'closed',
            exit_price = ?,
            pnl_points = ?,
            result = ?,
            exit_reason = ?,
            closed_at = ?,
            tp_hit_count = CASE WHEN COALESCE(tp_hit_count, 0) > ? THEN COALESCE(tp_hit_count, 0) ELSE ? END,
            tp1_hit_at = CASE WHEN ? >= 1 THEN COALESCE(tp1_hit_at, ?) ELSE tp1_hit_at END,
            tp2_hit_at = CASE WHEN ? >= 2 THEN COALESCE(tp2_hit_at, ?) ELSE tp2_hit_at END,
            tp3_hit_at = CASE WHEN ? >= 3 THEN COALESCE(tp3_hit_at, ?) ELSE tp3_hit_at END
        WHERE signal_uid = ?
      `).bind(
        exitPrice, pnl, result, effectiveReason, effectiveClosedAt,
        tpHitCount, tpHitCount,
        tpHitCount, effectiveClosedAt,
        tpHitCount, effectiveClosedAt,
        tpHitCount, effectiveClosedAt,
        signal.signal_uid
      ).run();

      await db.prepare('DELETE FROM performance WHERE signal_uid = ?').bind(signal.signal_uid).run();
      await db.prepare(`
        INSERT INTO performance (signal_uid, ticker, direction, signal_type, entry_price, exit_price, pnl_points, result, exit_reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        signal.signal_uid, ticker, signal.action, signal.signal_type,
        entry, exitPrice, pnl, result, effectiveReason, effectiveClosedAt
      ).run();

      if (shouldCloseByNext && signal.status === 'active') closedByNext++;
      if (shouldCloseByNext && signal.status !== 'active') repairedClosed++;
      if (tpHitCount > previousTpHitCount) tpUpdated++;
      performanceRows++;
    }
  }

  const detail = `scanned ${scanned}, closed ${closedByNext}, repaired ${repairedClosed}, performance ${performanceRows}`;
  await logAction(db, adminId || 'system', 'signal_performance_rebuild', range.all ? 'all' : `${range.start || '-'}:${range.end || '-'}`, detail);
  return { range, scanned, closedByNext, repairedClosed, tpUpdated, performanceRows, skipped, tickers: groups.size };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 廣播系統
// ═══════════════════════════════════════════════════════════════════════════════

async function shouldReceiveSignal(db, userId, signal) {
  const user = await getUser(db, userId);
  const settings = await getUserSettings(db, userId);

  // 檢查會員等級
  if (user.tier === 'free') return false;
  if (signal.is_vip_only && user.tier !== 'vip') return false;

  // 檢查是否暫停
  if (settings.paused) return false;

  // 檢查品種訂閱
  const subscribedSymbols = parseJSON(settings.subscribed_symbols, []);
  if (subscribedSymbols.length > 0 && !subscribedSymbols.includes(signal.ticker)) {
    return false;
  }

  // 檢查訊號類型
  const signalTypes = parseJSON(settings.signal_types, []);
  if (signalTypes.length > 0 && !signalTypes.includes(signal.signal_type)) {
    return false;
  }

  return true;
}

async function isInQuietHours(settings) {
  if (!settings.quiet_enabled) return false;

  const now = new Date();
  const tz = settings.timezone || 'Asia/Taipei';
  const timeStr = now.toLocaleTimeString('en-US', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit' });

  const [startH, startM] = settings.quiet_start.split(':').map(Number);
  const [endH, endM] = settings.quiet_end.split(':').map(Number);
  const [nowH, nowM] = timeStr.split(':').map(Number);

  const start = startH * 60 + startM;
  const end = endH * 60 + endM;
  const current = nowH * 60 + nowM;

  if (start <= end) {
    return current >= start && current < end;
  } else {
    return current >= start || current < end;
  }
}

function signalRecipientMatches(user, signal) {
  if (user.tier === 'free') return false;
  if (signal.is_vip_only && user.tier !== 'vip') return false;
  if (user.paused) return false;
  if (!user.notify_entry) return false;

  const subscribedSymbols = parseJSON(user.subscribed_symbols, []);
  if (subscribedSymbols.length > 0 && !subscribedSymbols.includes(signal.ticker)) return false;

  const signalTypes = parseJSON(user.signal_types, []);
  if (signalTypes.length > 0 && !signalTypes.includes(signal.signal_type)) return false;

  return true;
}

async function sendSignalRecipient(db, user, signal, env = {}) {
  const chatId = isTelegramChatId(user.telegram_user_id) ? user.telegram_user_id : user.user_id;
  if (!isTelegramChatId(chatId)) return { type: 'skipped' };
  if (!signalRecipientMatches(user, signal)) return { type: 'skipped' };

  const isVip = user.tier === 'vip';
  const msg = formatSignalCard(signal, user, isVip);
  if (await isInQuietHours(user)) {
    await db.prepare(`
      INSERT INTO queued_signals (user_id, signal_uid, message, photo_url, scheduled_at)
      VALUES (?, ?, ?, ?, datetime('now', '+8 hours'))
    `).bind(chatId, signal.signal_uid, msg, signalPhotoUrl(signal, env) || null).run();
    return { type: 'queued' };
  }

  const kb = {
    inline_keyboard: [
      [
        { text: '已執行', callback_data: `exec_${signal.signal_uid}` },
        { text: '跳過', callback_data: `skip_${signal.signal_uid}` }
      ],
      [
        { text: '訊號卡', url: signalCardPublicUrl(signal, env) },
        { text: '會員中心', url: memberPortalUrl(env) }
      ]
    ]
  };
  const result = await sendSignalTg(chatId, signal, msg, kb, env);
  return result?.ok ? { type: 'sent' } : { type: 'skipped' };
}

async function broadcastSignal(db, signal, env = {}) {
  await ensureTelegramLinkSchema(db);
  const users = await db.prepare(`
    SELECT u.user_id, u.telegram_user_id, u.tier, us.*
    FROM users u
    LEFT JOIN user_settings us ON u.user_id = us.user_id
    WHERE u.is_active = 1 AND u.is_banned = 0 AND u.tier != 'free'
      AND (u.tier_expires_at IS NULL OR u.tier_expires_at > datetime('now'))
  `).all();

  let sent = 0, queued = 0, skipped = 0, failed = 0;
  const errors = [];
  const recipients = users.results || [];
  const batchSize = Math.max(1, Math.min(25, Number(env.SIGNAL_SEND_BATCH_SIZE || 12)));

  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(async (user) => {
      try {
        return await sendSignalRecipient(db, user, signal, env);
      } catch (e) {
        const userId = String(user.telegram_user_id || user.user_id || '').slice(0, 32);
        return { type: 'failed', userId, error: e?.message || String(e) };
      }
    }));
    for (const result of results) {
      if (result.type === 'sent') sent++;
      else if (result.type === 'queued') queued++;
      else if (result.type === 'failed') {
        failed++;
        if (errors.length < 5) errors.push(`${result.userId || '-'}:${String(result.error || '').slice(0, 120)}`);
      }
      else skipped++;
    }
    if (i + batchSize < recipients.length) await new Promise((resolve) => setTimeout(resolve, 120));
  }

  if (failed) {
    await logAction(db, 'telegram:broadcast', 'telegram_signal_recipient_failures', signal.signal_uid, `${failed} failed / ${recipients.length} recipients${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  }

  return { sent, queued, skipped, failed, total: recipients.length };
}

function fmtSignedPoints(value) {
  const n = Number(value || 0);
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  return `${sign}${fmtPrice(Math.abs(n))}`;
}

function normalizeProxyRules(value) {
  const parsed = parseObject(value, []);
  const list = Array.isArray(parsed) ? parsed : [];
  return list.map((rule) => ({
    enabled: rule?.enabled !== false && String(rule?.enabled ?? '1') !== '0',
    source: normalizeTvTicker(rule?.source || rule?.source_ticker || rule?.from),
    target: normalizeTvTicker(rule?.target || rule?.target_ticker || rule?.to),
    mode: String(rule?.mode || 'weekly_offset').trim().toLowerCase(),
    beta: Number(rule?.beta || rule?.multiplier || 1) || 1,
    target_group: String(rule?.target_group || rule?.targetGroup || 'pro').trim().toLowerCase(),
    label: String(rule?.label || rule?.name || 'proxy').trim()
  })).filter((rule) => rule.enabled && rule.source && rule.target && rule.source !== rule.target);
}

async function getSignalProxyRules(db, env = {}) {
  const raw = env.SIGNAL_PROXY_RULES || await getConfig(db, 'signal_proxy_rules') || DEFAULT_SIGNAL_PROXY_RULES;
  return normalizeProxyRules(raw);
}

async function latestSignalProxyCalibration(db, rule) {
  return db.prepare(`
    SELECT * FROM signal_proxy_calibrations
    WHERE source_symbol = ? AND target_symbol = ? AND mode = ? AND status = 'active'
      AND (valid_until IS NULL OR valid_until > datetime('now'))
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).bind(rule.source, rule.target, rule.mode || 'weekly_offset').first();
}

function normalizeProxyCalibrationTime(value) {
  const text = String(firstTvValue(value) || '').trim();
  if (!text) return '';
  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric > 1000000000) {
    const ms = numeric > 9999999999 ? numeric : numeric * 1000;
    return new Date(ms).toISOString();
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString();
}

function isProxyCalibrationPayload(payload = {}) {
  const event = String(firstTvValue(payload.event, payload.event_type, payload.type, payload.kind)).trim().toLowerCase();
  if (['proxy_calibration', 'proxy-calibration', 'calibration', 'weekly_offset_calibration'].includes(event)) return true;
  const role = String(firstTvValue(payload.role, payload.calibration_role, payload.anchor_role)).trim().toLowerCase();
  const hasPair = Boolean(firstTvValue(payload.source, payload.source_symbol, payload.from) || firstTvValue(payload.target, payload.target_symbol, payload.to));
  return ['source', 'target', 'from', 'to'].includes(role) && hasPair;
}

async function proxyRuleForPair(db, env, sourceSymbol, targetSymbol, mode = 'weekly_offset') {
  const rules = await getSignalProxyRules(db, env);
  return rules.find((rule) => (
    rule.source === sourceSymbol && rule.target === targetSymbol && (rule.mode || 'weekly_offset') === mode
  )) || null;
}

async function handleProxyCalibrationPayload(db, payload = {}, source = {}, env = {}) {
  const roleRaw = String(firstTvValue(payload.role, payload.calibration_role, payload.anchor_role)).trim().toLowerCase();
  const role = ['target', 'to'].includes(roleRaw) ? 'target' : 'source';
  const sourceSymbol = normalizeTvTicker(firstTvValue(
    payload.source, payload.source_symbol, payload.sourceSymbol, payload.from, role === 'source' ? payload.ticker : ''
  ) || 'USTEC');
  const targetSymbol = normalizeTvTicker(firstTvValue(
    payload.target, payload.target_symbol, payload.targetSymbol, payload.to, role === 'target' ? payload.ticker : ''
  ) || 'NQ');
  const mode = String(firstTvValue(payload.mode, payload.calibration_mode) || 'weekly_offset').trim().toLowerCase();
  if (!sourceSymbol || !targetSymbol || sourceSymbol === targetSymbol) throw new Error('Proxy calibration 缺少有效 source/target');

  const rule = await proxyRuleForPair(db, env, sourceSymbol, targetSymbol, mode);
  const beta = Number(firstTvValue(payload.beta, payload.multiplier) || rule?.beta || 1) || 1;
  const sourcePrice = tvExplicitNumber(payload.source_price, payload.sourcePrice, payload.source_close, payload.sourceClose, role === 'source' ? payload.price : '', role === 'source' ? payload.close : '');
  const targetPrice = tvExplicitNumber(payload.target_price, payload.targetPrice, payload.target_close, payload.targetClose, role === 'target' ? payload.price : '', role === 'target' ? payload.close : '');
  const capturedSourceAt = normalizeProxyCalibrationTime(firstTvValue(payload.source_time, payload.sourceTime, role === 'source' ? payload.time : ''));
  const capturedTargetAt = normalizeProxyCalibrationTime(firstTvValue(payload.target_time, payload.targetTime, role === 'target' ? payload.time : ''));
  const note = String(firstTvValue(payload.note, payload.memo) || '').trim();

  if (sourcePrice !== null && targetPrice !== null) {
    const offset = Number((targetPrice - sourcePrice).toFixed(4));
    await db.prepare(`
      INSERT INTO signal_proxy_calibrations (
        source_symbol, target_symbol, mode, source_price, target_price, beta, offset,
        status, captured_source_at, captured_target_at, valid_from, valid_until, note,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, datetime('now'), datetime('now', '+8 days'), ?, datetime('now'), datetime('now'))
    `).bind(sourceSymbol, targetSymbol, mode, sourcePrice, targetPrice, beta, offset, capturedSourceAt || null, capturedTargetAt || null, note || null).run();
    const inserted = await latestSignalProxyCalibration(db, { source: sourceSymbol, target: targetSymbol, mode });
    await logAction(db, 'signal:proxy', 'proxy_calibration_active', `${sourceSymbol}->${targetSymbol}`, `${fmtSignedPoints(offset)} (${sourcePrice} -> ${targetPrice})`);
    return { status: 'calibration_active', calibration: inserted, rule: rule || null };
  }

  if (role === 'source') {
    if (sourcePrice === null) throw new Error('Proxy calibration source 缺少 USTEC 價格');
    await db.prepare(`
      INSERT INTO signal_proxy_calibrations (
        source_symbol, target_symbol, mode, source_price, beta, status,
        captured_source_at, valid_from, valid_until, note, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, datetime('now'), datetime('now', '+2 days'), ?, datetime('now'), datetime('now'))
    `).bind(sourceSymbol, targetSymbol, mode, sourcePrice, beta, capturedSourceAt || null, note || null).run();
    const inserted = await db.prepare(`
      SELECT * FROM signal_proxy_calibrations
      WHERE source_symbol = ? AND target_symbol = ? AND mode = ? AND status = 'pending'
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `).bind(sourceSymbol, targetSymbol, mode).first();
    await logAction(db, 'signal:proxy', 'proxy_calibration_source', `${sourceSymbol}->${targetSymbol}`, `${fmtPrice(sourcePrice)} pending ${targetSymbol}`);
    return { status: 'calibration_source_pending', calibration: inserted, next: `10 分鐘後送 ${targetSymbol} target calibration` };
  }

  if (targetPrice === null) throw new Error('Proxy calibration target 缺少 NQ 價格');
  const pending = await db.prepare(`
    SELECT * FROM signal_proxy_calibrations
    WHERE source_symbol = ? AND target_symbol = ? AND mode = ? AND status = 'pending' AND source_price IS NOT NULL
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).bind(sourceSymbol, targetSymbol, mode).first();
  if (!pending) {
    await logAction(db, 'signal:proxy', 'proxy_calibration_target_missing_source', `${sourceSymbol}->${targetSymbol}`, fmtPrice(targetPrice));
    return { status: 'calibration_missing_source', targetPrice, message: '尚未找到本週 USTEC source anchor，未啟用 NQ 週差額' };
  }
  const offset = Number((targetPrice - Number(pending.source_price)).toFixed(4));
  await db.prepare(`
    UPDATE signal_proxy_calibrations
    SET target_price = ?, beta = ?, offset = ?, status = 'active',
        captured_target_at = ?, valid_from = datetime('now'), valid_until = datetime('now', '+8 days'),
        note = COALESCE(NULLIF(?, ''), note), updated_at = datetime('now')
    WHERE id = ?
  `).bind(targetPrice, beta, offset, capturedTargetAt || null, note, pending.id).run();
  const updated = await db.prepare('SELECT * FROM signal_proxy_calibrations WHERE id = ?').bind(pending.id).first();
  await logAction(db, 'signal:proxy', 'proxy_calibration_target', `${sourceSymbol}->${targetSymbol}`, `${fmtSignedPoints(offset)} (${pending.source_price} -> ${targetPrice})`);
  return { status: 'calibration_active', calibration: updated, rule: rule || null };
}

function proxyConvertedLevel(sourceLevel, calibration, rule) {
  if (sourceLevel === null || sourceLevel === undefined) return null;
  const beta = Number(rule.beta || calibration.beta || 1) || 1;
  const sourceAnchor = Number(calibration.source_price);
  const targetAnchor = Number(calibration.target_price);
  const converted = targetAnchor + (Number(sourceLevel) - sourceAnchor) * beta;
  return Number(converted.toFixed(2));
}

function buildWeeklyOffsetProxyDraft(sourceSignal, rule, calibration) {
  const converted = (value) => proxyConvertedLevel(value, calibration, rule);
  const sourceTime = calibration.captured_source_at || calibration.valid_from || calibration.created_at || '';
  const targetTime = calibration.captured_target_at || calibration.updated_at || '';
  const noteParts = [
    `${rule.label || 'Proxy'}: ${sourceSignal.ticker}->${rule.target}`,
    `週校正差額 ${fmtSignedPoints(calibration.offset)} 點`,
    `Source ${fmtPrice(calibration.source_price)} @ ${sourceTime}`,
    `Delayed ${rule.target} ${fmtPrice(calibration.target_price)} @ ${targetTime}`,
    `beta ${fmtPrice(rule.beta || calibration.beta || 1)}`,
    `原始訊號 ${sourceSignal.signal_uid}`
  ];
  return {
    ...sourceSignal,
    signal_uid: genUID(),
    ticker: rule.target,
    entry_price: converted(sourceSignal.entry_price),
    stop_loss: converted(sourceSignal.stop_loss),
    tp1: converted(sourceSignal.tp1),
    tp2: converted(sourceSignal.tp2),
    tp3: converted(sourceSignal.tp3),
    note: `${sourceSignal.note || ''}${sourceSignal.note ? ' / ' : ''}${noteParts.join(' / ')}`,
    chart_url: '',
    snapshot_url: '',
    target_group: rule.target_group || sourceSignal.target_group || 'pro',
    is_vip_only: rule.target_group === 'vip' ? 1 : 0,
    source: `proxy:${sourceSignal.source || 'tv'}`,
    strategy_id: sourceSignal.strategy_id || 'proxy-weekly-offset',
    strategy: sourceSignal.strategy,
    rules: sourceSignal.rules
  };
}

async function createProxySignalsForDraft(db, sourceDraft, alertUid, autoSend, env = {}, options = {}) {
  const rules = (await getSignalProxyRules(db, env)).filter((rule) => (
    rule.mode === 'weekly_offset' && rule.source === normalizeTvTicker(sourceDraft.ticker)
  ));
  const results = [];
  for (const rule of rules) {
    const calibration = await latestSignalProxyCalibration(db, rule);
    if (!calibration) {
      await logAction(db, 'signal:proxy', 'proxy_signal_skipped', `${sourceDraft.signal_uid}:${rule.target}`, 'missing weekly calibration');
      results.push({ target: rule.target, status: 'skipped', reason: 'missing_weekly_calibration' });
      continue;
    }
    const proxyDraft = buildWeeklyOffsetProxyDraft(sourceDraft, rule, calibration);
    const proxyAlertUid = `${alertUid}:proxy:${rule.target}`;
    const result = await createSignalFromTvDraft(db, proxyDraft, proxyAlertUid, autoSend, env, options);
    results.push({ target: rule.target, calibrationId: calibration.id, ...result });
  }
  return results;
}

async function previewProxySignalsForDraft(db, sourceDraft, env = {}) {
  const rules = (await getSignalProxyRules(db, env)).filter((rule) => (
    rule.mode === 'weekly_offset' && rule.source === normalizeTvTicker(sourceDraft.ticker)
  ));
  const results = [];
  for (const rule of rules) {
    const calibration = await latestSignalProxyCalibration(db, rule);
    if (!calibration) {
      results.push({ target: rule.target, status: 'skipped', reason: 'missing_weekly_calibration' });
      continue;
    }
    const proxyDraft = buildWeeklyOffsetProxyDraft(sourceDraft, rule, calibration);
    results.push({
      target: rule.target,
      status: 'preview',
      calibrationId: calibration.id,
      offset: calibration.offset,
      signal: {
        ticker: proxyDraft.ticker,
        action: proxyDraft.action,
        signal_type: proxyDraft.signal_type,
        entry_price: proxyDraft.entry_price,
        stop_loss: proxyDraft.stop_loss,
        tp1: proxyDraft.tp1,
        tp2: proxyDraft.tp2,
        tp3: proxyDraft.tp3,
        probability: proxyDraft.probability,
        target_group: proxyDraft.target_group,
        strategy_id: proxyDraft.strategy_id
      }
    });
  }
  return results;
}

async function broadcastExit(db, type, ticker, price, pnl, note, signalUid) {
  await ensureTelegramLinkSchema(db);
  const signal = signalUid ? await db.prepare('SELECT * FROM signals WHERE signal_uid = ?').bind(signalUid).first() : null;
  const users = await db.prepare(`
    SELECT u.user_id, u.telegram_user_id, us.notify_tp, us.notify_sl
    FROM users u
    LEFT JOIN user_settings us ON u.user_id = us.user_id
    WHERE u.is_active = 1 AND u.is_banned = 0 AND u.tier != 'free'
  `).all();

  let sent = 0;
  const msg = formatExitCard(type, ticker, price, pnl, note);

  for (const user of users.results || []) {
    // 檢查通知設定
    if (type.startsWith('TP') && !user.notify_tp) continue;
    if (type === 'SL' && !user.notify_sl) continue;
    if (signal && !(await shouldReceiveSignal(db, user.user_id, signal))) continue;

    const chatId = isTelegramChatId(user.telegram_user_id) ? user.telegram_user_id : user.user_id;
    if (!isTelegramChatId(chatId)) continue;
    const r = await sendTg(chatId, msg);
    if (r?.ok) sent++;

    if (sent % 20 === 0) await new Promise(r => setTimeout(r, 100));
  }

  return { sent };
}

async function broadcastMessage(db, message, targetGroup = 'all', notifyType = 'announcement') {
  await ensureTelegramLinkSchema(db);
  let query = `
    SELECT u.user_id, u.telegram_user_id, us.*
    FROM users u
    LEFT JOIN user_settings us ON u.user_id = us.user_id
    WHERE u.is_active = 1 AND u.is_banned = 0
  `;

  if (targetGroup === 'pro') {
    query += " AND u.tier IN ('pro', 'vip')";
  } else if (targetGroup === 'vip') {
    query += " AND u.tier = 'vip'";
  } else if (targetGroup === 'paid') {
    query += " AND u.tier != 'free'";
  } else if (targetGroup !== 'all' && targetGroup !== 'everyone') {
    // 自訂群組
    const members = await db.prepare(`
      SELECT user_id FROM group_members WHERE group_name = ?
    `).bind(targetGroup).all();

    let sent = 0;
    for (const m of members.results || []) {
      const r = await sendMemberNotice(m.user_id, message, null, { db });
      if (r?.ok) sent++;
    }
    return { sent };
  }

  const users = await db.prepare(query).all();
  let sent = 0;

  for (const user of users.results || []) {
    // 檢查通知設定
    if (notifyType === 'announcement' && !user.notify_announcement) continue;
    if (notifyType === 'alert' && !user.notify_alert) continue;
    if (notifyType === 'daily_report' && !user.notify_daily_report) continue;

    const chatId = isTelegramChatId(user.telegram_user_id) ? user.telegram_user_id : user.user_id;
    if (!isTelegramChatId(chatId)) continue;
    const r = await sendTg(chatId, message);
    if (r?.ok) sent++;

    if (sent % 20 === 0) await new Promise(r => setTimeout(r, 100));
  }

  return { sent };
}
// ═══════════════════════════════════════════════════════════════════════════════
// 用戶指令處理
// ═══════════════════════════════════════════════════════════════════════════════

async function handleUserCommand(cid, uid, cmd, args, env) {
  const db = env.DB;
  const telegramUid = String(uid);
  uid = await resolveMemberUserId(db, telegramUid);
  const user = await getUser(db, uid);
  const settings = await getUserSettings(db, uid);

  if (cmd === '/login') {
    const code = await createMemberLoginCode(db, uid);
    return sendTg(cid,
      `<b>會員中心登入碼</b>\n\n<code>${code}</code>\n\n10 分鐘內有效，只能使用一次。\n請到會員中心輸入此登入碼完成登入。`,
      { inline_keyboard: [[{ text: '開啟會員中心', url: memberPortalUrl(env) }]] }
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 主選單 /menu
  // ═══════════════════════════════════════════════════════════════════════════
  if (cmd === '/start' || cmd === '/menu') {
    // 處理推薦碼
    if (cmd === '/start' && args[0]?.startsWith('ref_')) {
      const refCode = args[0].replace('ref_', '');
      if (!user.referred_by) {
        const referrer = await db.prepare('SELECT user_id FROM users WHERE referral_code = ?').bind(refCode).first();
        if (referrer && referrer.user_id !== uid) {
          await updateUser(db, uid, { referred_by: referrer.user_id });
          const refPoints = parseInt(await getConfig(db, 'referral_points') || '50');
          await addPoints(db, referrer.user_id, refPoints, '邀請好友');
          await db.prepare('UPDATE users SET referral_count = referral_count + 1 WHERE user_id = ?').bind(referrer.user_id).run();
        }
      }
    }

    return sendTg(cid, renderUserMenuText(user), renderUserMenuKeyboard(env));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 訂閱設定 /subscribe
  // ═══════════════════════════════════════════════════════════════════════════
  if (cmd === '/subscribe' || cmd === '/symbols') {
    if (user.tier === 'free') {
      return handleUserCommand(cid, uid, '/plans', [], env);
    }

    const subscribedSymbols = parseJSON(settings.subscribed_symbols, []);
    const categories = await getSymbolsByCategory(db);
    return sendTg(cid, renderSubscribeText(categories, subscribedSymbols), renderSubscribeKeyboard(categories, subscribedSymbols));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 訊號類型偏好 /signaltype
  // ═══════════════════════════════════════════════════════════════════════════
  if (cmd === '/signaltype') {
    if (user.tier === 'free') {
      return sendTg(cid, `❌ 此功能需要訂閱會員`);
    }

    const signalTypes = parseJSON(settings.signal_types, []);

    return sendTg(cid, renderSignalTypeText(signalTypes), renderSignalTypeKeyboard(signalTypes));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 個人設定 /settings
  // ═══════════════════════════════════════════════════════════════════════════
  if (cmd === '/settings') {
    return sendTg(cid, renderSettingsText(settings), renderSettingsKeyboard(settings));
  }

  if (cmd === '/timezone') {
    let m = `<b>時區設定</b>\n\n`;
    m += `目前時區：<code>${escHtml(settings.timezone || 'Asia/Taipei')}</code>\n\n`;
    m += `選擇您希望報表與通知顯示的時間基準。`;
    const kb = {
      inline_keyboard: [
        [{ text: '台北 UTC+8', callback_data: 'tz_Asia/Taipei' }],
        [{ text: '東京 UTC+9', callback_data: 'tz_Asia/Tokyo' }],
        [{ text: '紐約 UTC-5/-4', callback_data: 'tz_America/New_York' }],
        [{ text: '倫敦 UTC+0/+1', callback_data: 'tz_Europe/London' }],
        [{ text: '« 返回', callback_data: 'u_settings' }]
      ]
    };
    return sendTg(cid, m, kb);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 通知設定 /notify
  // ═══════════════════════════════════════════════════════════════════════════
  if (cmd === '/notify') {
    return sendTg(cid, renderNotifyText(), renderNotifyKeyboard(settings));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 安靜時段 /quiet
  // ═══════════════════════════════════════════════════════════════════════════
  if (cmd === '/quiet') {
    return sendTg(cid, renderQuietText(settings), renderQuietKeyboard(settings));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 資金設定 /capital
  // ═══════════════════════════════════════════════════════════════════════════
  if (cmd === '/capital' || cmd === '/risk') {
    if (args.length > 0) {
      const value = parseFloat(args[0]);
      if (!isNaN(value)) {
        if (cmd === '/capital') {
          await updateUserSettings(db, uid, { capital: value });
          return sendTg(cid, `✅ 交易資金已設為 $${fmtNum(value)}`);
        } else {
          await updateUserSettings(db, uid, { risk_percent: value });
          return sendTg(cid, `✅ 風險比例已設為 ${value}%`);
        }
      }
    }

    let m = renderCapitalText(settings);
    m += `\n\n指令：\n/capital [金額]\n/risk [比例]`;
    return sendTg(cid, m, renderCapitalKeyboard());
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 會員狀態 /status
  // ═══════════════════════════════════════════════════════════════════════════
  if (cmd === '/status' || cmd === '/me') {
    const dl = user.tier !== 'free' ? daysLeft(user.tier_expires_at) : 0;
    const subscribedSymbols = parseJSON(settings.subscribed_symbols, []);

    let m = `<b>會員狀態</b>\n\n`;
    m += `${tierName(user.tier)}\n`;

    if (user.tier !== 'free') {
      m += `到期日：${fmtDate(user.tier_expires_at)}\n`;
      m += `剩餘：${dl} 天\n\n`;
    } else {
      m += `\n`;
    }

    m += `<b>訂閱</b>\n`;
    m += `品種：${escHtml(subscribedSymbols.join(', ') || '未設定')}\n\n`;
    m += `<b>風控</b>\n`;
    m += `資金：$${fmtNum(settings.capital)}\n`;
    m += `風險：${settings.risk_percent}%\n\n`;
    m += `<b>積分邀請</b>\n`;
    m += `積分：${user.points || 0}\n`;
    m += `推薦：${user.referral_count || 0} 人\n`;
    m += `推薦碼：<code>${escHtml(user.referral_code)}</code>\n`;

    const buttons = [
      [
        { text: '續費', callback_data: 'u_renew' },
        { text: '升級 VIP', callback_data: 'u_upgrade' }
      ],
      [{ text: '我的訂單', callback_data: 'u_orders' }],
      [{ text: '« 返回', callback_data: 'u_menu' }]
    ];

    return sendTg(cid, m, { inline_keyboard: buttons });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 方案介紹 /plans
  // ═══════════════════════════════════════════════════════════════════════════
  if (cmd === '/plans') {
    const proPrices = {
      1: await getConfig(db, 'pro_price_1m') || '299',
      3: await getConfig(db, 'pro_price_3m') || '807',
      12: await getConfig(db, 'pro_price_12m') || '2868'
    };
    const vipPrices = {
      1: await getConfig(db, 'vip_price_1m') || '599',
      3: await getConfig(db, 'vip_price_3m') || '1617',
      12: await getConfig(db, 'vip_price_12m') || '5748'
    };

    let m = `<b>會員方案</b>\n\n`;

    m += `<b>Pro 會員</b>\n`;
    m += `• 即時接收所有訊號\n`;
    m += `• 2個止盈目標\n`;
    m += `• 自選訂閱品種\n`;
    m += `• 個人化資金計算\n`;
    m += `• 完整績效統計\n\n`;
    m += `NT$ ${proPrices[1]}/月\n`;
    m += `NT$ ${proPrices[3]}/季 (省10%)\n`;
    m += `NT$ ${proPrices[12]}/年 (省20%)\n\n`;

    m += `<b>VIP 會員</b>\n`;
    m += `• Pro全部功能\n`;
    m += `• 3個止盈目標\n`;
    m += `• VIP專屬訊號\n`;
    m += `• 提前行情提醒\n`;
    m += `• 優先客服\n\n`;
    m += `NT$ ${vipPrices[1]}/月\n`;
    m += `NT$ ${vipPrices[3]}/季 (省10%)\n`;
    m += `NT$ ${vipPrices[12]}/年 (省20%)\n`;

    const buttons = [
      [{ text: '申請 7 天試用', callback_data: 'u_trial' }],
      [
        { text: '訂閱 Pro', callback_data: 'order_pro' },
        { text: '訂閱 VIP', callback_data: 'order_vip' }
      ],
      [{ text: '聯繫客服', callback_data: 'u_contact' }],
      [{ text: '« 返回', callback_data: 'u_menu' }]
    ];

    return sendTg(cid, m, { inline_keyboard: buttons });
  }

  if (cmd === '/renew' || cmd === '/upgrade') {
    const dl = user.tier !== 'free' ? daysLeft(user.tier_expires_at) : 0;
    let m = `<b>續費 / 升級</b>\n\n`;
    m += `目前方案：${tierName(user.tier)}\n`;
    if (user.tier !== 'free') {
      m += `到期日：${fmtDate(user.tier_expires_at)}\n`;
      m += `剩餘：${dl} 天\n`;
    }
    m += `\n選擇方案後會建立付款訂單。`;
    const buttons = [
      [{ text: 'Pro 續費', callback_data: 'order_pro' }],
      [{ text: 'VIP 升級 / 續費', callback_data: 'order_vip' }],
      [{ text: '聯繫客服', callback_data: 'u_contact' }],
      [{ text: '« 返回', callback_data: 'u_menu' }]
    ];
    return sendTg(cid, m, { inline_keyboard: buttons });
  }

  if (cmd === '/myorders' || cmd === '/orders' || cmd === '/order') {
    const orders = await getTelegramUserOrders(db, uid, 8);
    return sendTg(cid, renderTelegramOrdersText(orders), renderTelegramOrdersKeyboard(orders, env));
  }

  if (cmd === '/receipt') {
    const requestedOrderId = String(args[0] || '').trim().toUpperCase();
    let orderId = requestedOrderId;
    if (!orderId) {
      const latest = await getTelegramUserOrders(db, uid, 1);
      orderId = latest[0]?.order_id || '';
    }
    if (!orderId) {
      return sendTg(cid, `<b>訂單明細</b>\n\n目前沒有可查詢的訂單。`, {
        inline_keyboard: [[{ text: '查看方案', callback_data: 'u_plans' }], [{ text: '« 返回', callback_data: 'u_menu' }]]
      });
    }
    const receipt = await getMemberOrderReceipt(db, uid, orderId);
    if (!receipt) {
      return sendTg(cid, `<b>訂單明細</b>\n\n找不到訂單 <code>${escHtml(orderId)}</code>，或此訂單不屬於目前會員。`, {
        inline_keyboard: [[{ text: '我的訂單', callback_data: 'u_orders' }], [{ text: '« 返回', callback_data: 'u_menu' }]]
      });
    }
    return sendTg(cid, renderTelegramOrderReceipt(receipt.order, receipt.events, env), renderTelegramOrderReceiptKeyboard(receipt.order, env));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 申請試用 /trial
  // ═══════════════════════════════════════════════════════════════════════════
  if (cmd === '/trial') {
    if (user.tier !== 'free') {
      return sendTg(cid, `您已是 ${tierName(user.tier)}！`);
    }

    if (user.total_signals > 0) {
      return sendTg(cid, `您已使用過試用\n\n使用 /plans 查看正式方案`);
    }

    const trialDays = parseInt(await getConfig(db, 'trial_days') || '7');
    const expires = new Date(Date.now() + trialDays * 86400000).toISOString();

    await updateUser(db, uid, { tier: 'pro', tier_expires_at: expires });

    let m = `<b>試用已開通</b>\n\n`;
    m += `等級：Pro 會員\n`;
    m += `天數：${trialDays} 天\n`;
    m += `到期：${fmtDate(expires)}\n\n`;
    m += `現在請先設定您的訂閱偏好：\n`;

    const kb = {
      inline_keyboard: [
        [{ text: '設定訂閱品種', callback_data: 'u_subscribe' }],
        [{ text: '設定交易資金', callback_data: 'u_capital' }],
        [{ text: '查看訊號', callback_data: 'u_signals' }]
      ]
    };

    return sendTg(cid, m, kb);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 訊號列表 /signals
  // ═══════════════════════════════════════════════════════════════════════════
  if (cmd === '/signals') {
    if (user.tier === 'free') {
      return sendTg(cid, `❌ 此功能需要訂閱會員\n\n使用 /trial 申請試用`);
    }

    const subscribedSymbols = parseJSON(settings.subscribed_symbols, []);
    let symbolFilter = '';
    if (subscribedSymbols.length > 0) {
      symbolFilter = `AND ticker IN (${subscribedSymbols.map(s => `'${s}'`).join(',')})`;
    }

    const signals = await db.prepare(`
      SELECT * FROM signals
      WHERE status IN ('active', 'closed')
        AND created_at > datetime('now', '-24 hours')
        ${symbolFilter}
      ORDER BY created_at DESC LIMIT 10
    `).all();

    if (!signals.results || signals.results.length === 0) {
      return sendTg(cid, `📊 目前沒有符合您訂閱的訊號\n\n使用 /subscribe 調整訂閱品種`);
    }

    let m = `<b>最新訊號</b>\n\n`;

    for (const sig of signals.results) {
      m += `${formatSignalListItem(sig, user.tier)}\n\n`;
    }

    m += `已訂閱：${escHtml(subscribedSymbols.join(', ') || '未設定')}`;

    const kb = {
      inline_keyboard: [
        [{ text: '歷史訊號', callback_data: 'u_history' }],
        [{ text: '修改訂閱', callback_data: 'u_subscribe' }],
        [{ text: '« 返回', callback_data: 'u_menu' }]
      ]
    };

    return sendTg(cid, m, kb);
  }

  if (cmd === '/events' || cmd === '/calendar' || cmd === '/econ' || cmd === '/財經') {
    await ensureAdminSchema(db);
    const config = await getEconomicConfig(db, env);
    const dateKey = taipeiDateKey();
    let syncNote = '';
    if (config.sourceUrl) {
      try {
        const sync = await syncEconomicEvents(db, env, dateKey);
        syncNote = sync.skipped ? '' : `\n\n同步：${sync.synced}/${sync.total}`;
      } catch (e) {
        syncNote = `\n\n同步提醒：${escHtml(e.message)}`;
      }
    }
    const events = await getEconomicEventsForDate(db, dateKey, config);
    const kb = {
      inline_keyboard: [
        [{ text: '最新訊號', callback_data: 'u_signals' }],
        [{ text: '« 返回', callback_data: 'u_menu' }]
      ]
    };
    return sendTg(cid, formatEconomicEventsMessage(events, { dateKey, source: config.sourceName }) + syncNote, kb);
  }

  if (cmd === '/active' || cmd === '/history' || cmd === '/lastsignal') {
    if (user.tier === 'free') {
      return sendTg(cid, `此功能需要訂閱會員\n\n使用 /trial 申請試用`, {
        inline_keyboard: [[{ text: '查看方案', callback_data: 'u_plans' }]]
      });
    }
    const subscribedSymbols = parseJSON(settings.subscribed_symbols, []);
    const statusFilter = cmd === '/active' ? "status = 'active'" : "status IN ('active','closed','cancelled')";
    const rows = await db.prepare(`
      SELECT * FROM signals
      WHERE ${statusFilter}
      ORDER BY created_at DESC
      LIMIT 40
    `).all();
    let list = rows.results || [];
    if (subscribedSymbols.length > 0) list = list.filter((sig) => subscribedSymbols.includes(sig.ticker));
    if (cmd === '/lastsignal') list = list.slice(0, 1);
    else list = list.slice(0, cmd === '/history' ? 6 : 8);

    const title = cmd === '/active' ? '進行中訊號' : cmd === '/lastsignal' ? '最近一筆訊號' : '歷史訊號';
    if (list.length === 0) {
      return sendTg(cid, `<b>${title}</b>\n\n目前沒有符合您訂閱品種的資料。`, {
        inline_keyboard: [[{ text: '修改訂閱', callback_data: 'u_subscribe' }], [{ text: '« 返回', callback_data: 'u_menu' }]]
      });
    }

    let m = `<b>${title}</b>\n\n`;
    for (const sig of list) {
      m += `${formatSignalListItem(sig, user.tier, { includeId: true, includeTimes: cmd === '/history' })}\n\n`;
    }
    return sendTg(cid, m.trim(), {
      inline_keyboard: [
        [{ text: '進行中', callback_data: 'u_active' }, { text: '歷史', callback_data: 'u_history' }],
        [{ text: '修改訂閱', callback_data: 'u_subscribe' }],
        [{ text: '« 返回', callback_data: 'u_menu' }]
      ]
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 我的績效 /mystats
  // ═══════════════════════════════════════════════════════════════════════════
  if (cmd === '/mystats') {
    if (user.tier === 'free') {
      // 免費用戶看簡版
      const stats = await db.prepare(`
        SELECT COUNT(*) as total, SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins
        FROM performance WHERE created_at > datetime('now', '-30 days')
      `).first();

      const winRate = stats?.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(0) : 0;

      let m = `📈 <b>系統績效摘要</b>\n\n`;
      m += `近30天交易：${stats?.total || 0} 筆\n`;
      m += `勝率：${winRate}%\n\n`;
      m += `💡 升級會員查看完整個人績效`;

      return sendTg(cid, m);
    }

    // 會員看完整版
    const executions = await db.prepare(`
      SELECT ue.*, s.ticker, s.action, s.result, s.pnl_points
      FROM user_executions ue
      JOIN signals s ON ue.signal_uid = s.signal_uid
      WHERE ue.user_id = ? AND ue.status = 'executed'
        AND ue.created_at > datetime('now', '-30 days')
    `).bind(uid).all();

    let total = 0, wins = 0, totalPnl = 0;
    for (const e of executions.results || []) {
      total++;
      if (e.result === 'win') wins++;
      if (e.pnl_points) totalPnl += e.pnl_points;
    }

    const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : 0;
    const estimatedPnl = totalPnl * settings.capital * (settings.risk_percent / 100) / 100;

    let m = `<b>我的績效</b>\n近30天\n\n`;
    m += `<b>執行統計</b>\n`;
    m += `已執行 ${total} 筆\n`;
    m += `獲利 ${wins} 筆 · 虧損 ${total - wins} 筆\n`;
    m += `勝率 <code>${winRate}%</code>\n\n`;
    m += `<b>模擬盈虧</b>\n`;
    m += `總點數 <code>${totalPnl >= 0 ? '+' : ''}${fmtPrice(totalPnl)}</code> 點\n`;
    m += `預估盈虧 <code>$${fmtNum(estimatedPnl.toFixed(0))}</code>\n`;

    const kb = {
      inline_keyboard: [
        [{ text: '按品種分析', callback_data: 'mystats_symbol' }],
        [{ text: '選擇月份', callback_data: 'mystats_month' }],
        [{ text: '« 返回', callback_data: 'u_menu' }]
      ]
    };

    return sendTg(cid, m, kb);
  }

  if (cmd === '/perfbysymbol' || cmd === '/mymonth' || cmd === '/myweek' || cmd === '/mytoday') {
    if (user.tier === 'free') {
      return sendTg(cid, `此功能需要訂閱會員`, {
        inline_keyboard: [[{ text: '查看方案', callback_data: 'u_plans' }]]
      });
    }
    const days = cmd === '/mytoday' ? 1 : cmd === '/myweek' ? 7 : 30;
    if (cmd === '/perfbysymbol') {
      const stats = await db.prepare(`
        SELECT s.ticker,
               COUNT(*) as total,
               SUM(CASE WHEN s.result = 'win' THEN 1 ELSE 0 END) as wins,
               SUM(COALESCE(s.pnl_points, 0)) as pnl
        FROM user_executions ue
        JOIN signals s ON ue.signal_uid = s.signal_uid
        WHERE ue.user_id = ? AND ue.status = 'executed'
          AND ue.created_at > datetime('now', '-30 days')
        GROUP BY s.ticker
        ORDER BY total DESC
      `).bind(uid).all();
      let m = `📊 <b>按品種分析</b>\n近30天\n\n`;
      if (!stats.results || stats.results.length === 0) m += `目前沒有已執行紀錄。`;
      for (const row of stats.results || []) {
        const winRate = row.total > 0 ? ((row.wins / row.total) * 100).toFixed(0) : 0;
        m += `<b>${escHtml(row.ticker)}</b> ${row.total}筆 · 勝率 ${winRate}% · ${row.pnl >= 0 ? '+' : ''}${fmtPrice(row.pnl || 0)}點\n`;
      }
      return sendTg(cid, m, { inline_keyboard: [[{ text: '« 返回', callback_data: 'u_mystats' }]] });
    }

    const executions = await db.prepare(`
      SELECT s.ticker, s.action, s.result, s.pnl_points, ue.created_at
      FROM user_executions ue
      JOIN signals s ON ue.signal_uid = s.signal_uid
      WHERE ue.user_id = ? AND ue.status = 'executed'
        AND ue.created_at > datetime('now', '-${days} days')
      ORDER BY ue.created_at DESC
    `).bind(uid).all();
    const rows = executions.results || [];
    const wins = rows.filter((r) => r.result === 'win').length;
    const pnl = rows.reduce((sum, r) => sum + Number(r.pnl_points || 0), 0);
    const winRate = rows.length ? ((wins / rows.length) * 100).toFixed(1) : '0.0';
    const title = cmd === '/mytoday' ? '今日績效' : cmd === '/myweek' ? '本週績效' : '本月績效';
    let m = `📈 <b>${title}</b>\n\n`;
    m += `已執行 ${rows.length} 筆\n`;
    m += `勝率 <code>${winRate}%</code>\n`;
    m += `總點數 <code>${pnl >= 0 ? '+' : ''}${fmtPrice(pnl)}</code>\n\n`;
    for (const row of rows.slice(0, 8)) {
      m += `${escHtml(row.ticker)} ${row.action === 'LONG' ? '做多' : '做空'} · ${row.result || '未結算'} · ${row.pnl_points >= 0 ? '+' : ''}${fmtPrice(row.pnl_points || 0)}點\n`;
    }
    return sendTg(cid, m.trim(), { inline_keyboard: [[{ text: '« 返回', callback_data: 'u_mystats' }]] });
  }

  if (cmd === '/executed' || cmd === '/skipped') {
    const status = cmd === '/executed' ? 'executed' : 'skipped';
    const rows = await db.prepare(`
      SELECT ue.*, s.ticker, s.action, s.entry_price
      FROM user_executions ue
      JOIN signals s ON ue.signal_uid = s.signal_uid
      WHERE ue.user_id = ? AND ue.status = ?
      ORDER BY ue.created_at DESC LIMIT 15
    `).bind(uid, status).all();
    let m = `${status === 'executed' ? '✅ 已執行' : '⏭️ 已跳過'} <b>訊號</b>\n\n`;
    if (!rows.results || rows.results.length === 0) m += `目前沒有紀錄。`;
    for (const row of rows.results || []) {
      m += `${escHtml(row.ticker)} ${row.action} @ ${fmtPrice(row.entry_price)}\n<code>#${escHtml(row.signal_uid)}</code>\n\n`;
    }
    return sendTg(cid, m.trim(), { inline_keyboard: [[{ text: '« 返回', callback_data: 'u_menu' }]] });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 每日簽到 /checkin
  // ═══════════════════════════════════════════════════════════════════════════
  if (cmd === '/checkin') {
    const today = new Date().toISOString().split('T')[0];

    if (user.last_checkin_at?.startsWith(today)) {
      return sendTg(cid, `✅ 今日已簽到！\n\n明天再來～\n目前積分：${user.points || 0}`);
    }

    const checkinPoints = parseInt(await getConfig(db, 'checkin_points') || '10');
    await addPoints(db, uid, checkinPoints, '每日簽到');
    await updateUser(db, uid, { last_checkin_at: new Date().toISOString() });

    const newPoints = (user.points || 0) + checkinPoints;

    return sendTg(cid, `<b>簽到成功</b>\n\n獲得 <b>+${checkinPoints}</b> 積分\n目前積分：<b>${newPoints}</b>`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 邀請好友 /invite
  // ═══════════════════════════════════════════════════════════════════════════
  if (cmd === '/invite') {
    const refLink = `https://t.me/${CONFIG.BOT_USERNAME}?start=ref_${user.referral_code}`;
    const refPoints = await getConfig(db, 'referral_points') || '50';
    const refPaidPoints = await getConfig(db, 'referral_paid_points') || '100';

    let m = `<b>邀請好友</b>\n\n`;
    m += `您的專屬邀請連結：\n`;
    m += `<code>${refLink}</code>\n\n`;
    m += `<b>邀請統計</b>\n`;
    m += `已邀請 ${user.referral_count || 0} 人\n\n`;
    m += `<b>邀請獎勵</b>\n`;
    m += `好友註冊 +${refPoints} 點\n`;
    m += `好友付費 +${refPaidPoints} 點\n`;

    const kb = {
      inline_keyboard: [
        [{ text: '複製連結', callback_data: 'copy_ref' }],
        [{ text: '« 返回', callback_data: 'u_menu' }]
      ]
    };

    return sendTg(cid, m, kb);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 積分查詢 /points
  // ═══════════════════════════════════════════════════════════════════════════
  if (cmd === '/points') {
    const history = await db.prepare(`
      SELECT * FROM point_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 10
    `).bind(uid).all();

    const pointsPerDay = parseInt(await getConfig(db, 'points_per_day') || '100');
    const redeemableDays = Math.floor((user.points || 0) / pointsPerDay);

    let m = `<b>積分中心</b>\n\n`;
    m += `目前積分：<b>${user.points || 0}</b>\n`;
    m += `可兌換：${redeemableDays} 天會員\n\n`;

    if (history.results && history.results.length > 0) {
      m += `<b>最近記錄</b>\n`;
      for (const h of history.results.slice(0, 5)) {
        const sign = h.points > 0 ? '+' : '';
        m += `${sign}${h.points} - ${h.reason}\n`;
      }
    }

    const kb = {
      inline_keyboard: [
        [{ text: '立即簽到', callback_data: 'u_checkin' }],
        [{ text: '兌換會員', callback_data: 'u_redeem' }],
        [{ text: '« 返回', callback_data: 'u_menu' }]
      ]
    };

    return sendTg(cid, m, kb);
  }

  if (cmd === '/redeem') {
    const pointsPerDay = parseInt(await getConfig(db, 'points_per_day') || '100');
    const redeemableDays = Math.floor((user.points || 0) / pointsPerDay);
    if (redeemableDays <= 0) {
      return sendTg(cid, `🎁 <b>兌換會員</b>\n\n目前積分：${user.points || 0}\n每 ${pointsPerDay} 點可兌換 1 天會員。\n\n您的積分尚不足。`, {
        inline_keyboard: [[{ text: '每日簽到', callback_data: 'u_checkin' }], [{ text: '« 返回', callback_data: 'u_points' }]]
      });
    }
    const days = Math.min(redeemableDays, 30);
    const cost = days * pointsPerDay;
    const base = user.tier !== 'free' && user.tier_expires_at && new Date(user.tier_expires_at) > new Date()
      ? new Date(user.tier_expires_at)
      : new Date();
    const expires = new Date(base.getTime() + days * 86400000).toISOString();
    const tier = user.tier === 'vip' ? 'vip' : 'pro';
    await updateUser(db, uid, { tier, tier_expires_at: expires });
    await addPoints(db, uid, -cost, `兌換${days}天會員`);
    return sendTg(cid, `✅ <b>兌換成功</b>\n\n使用 ${cost} 點兌換 ${days} 天 ${tierName(tier)}。\n到期日：${fmtDate(expires)}`, {
      inline_keyboard: [[{ text: '會員狀態', callback_data: 'u_status' }], [{ text: '« 返回', callback_data: 'u_menu' }]]
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 聯繫客服 /contact
  // ═══════════════════════════════════════════════════════════════════════════
  if (cmd === '/contact') {
    const tg = await getConfig(db, 'contact_telegram') || '@Admin';
    const line = await getConfig(db, 'contact_line');

    let m = `<b>聯繫客服</b>\n\n`;
    m += `Telegram：${tg}\n`;
    if (line) m += `LINE：${line}\n`;
    m += `\n也可直接使用：\n<code>/support 你的問題</code>\n系統會建立客服工單並通知管理員。`;

    return sendTg(cid, m, {
      inline_keyboard: [[{ text: '我的工單', callback_data: 'u_tickets' }], [{ text: '« 返回', callback_data: 'u_menu' }]]
    });
  }

  if (cmd === '/support') {
    const message = args.join(' ').trim();
    if (!message) {
      return sendTg(cid, `<b>客服工單</b>\n\n用法：\n<code>/support 我遇到的問題...</code>\n\n提交後管理員會收到通知，並可直接回覆您。`, {
        inline_keyboard: [[{ text: '我的工單', callback_data: 'u_tickets' }], [{ text: '« 返回', callback_data: 'u_menu' }]]
      });
    }
    const ticket = await createSupportTicket(db, env, uid, { message }, 'telegram');
    return sendTg(cid, `✅ <b>客服工單已建立</b>\n\n工單：<code>${ticket.ticketId}</code>\n主旨：${escHtml(ticket.subject)}\n狀態：${supportStatusLabel(ticket.status)}\n\n管理員回覆後會通知您。`, {
      inline_keyboard: [[{ text: '我的工單', callback_data: 'u_tickets' }], [{ text: '« 返回', callback_data: 'u_menu' }]]
    });
  }

  if (cmd === '/mytickets' || cmd === '/tickets') {
    const tickets = await getMemberSupportTickets(db, uid, 8);
    let m = `<b>我的客服工單</b>\n\n`;
    if (!tickets.length) {
      m += `目前沒有工單。\n\n使用 <code>/support 你的問題</code> 建立客服工單。`;
    } else {
      for (const ticket of tickets) {
        m += `${ticket.status === 'closed' ? '✅' : ticket.status === 'pending' ? '💬' : '📨'} <code>${ticket.ticket_id}</code> · ${escHtml(supportStatusLabel(ticket.status))}\n`;
        m += `${escHtml(ticket.subject)}\n`;
        m += `更新：${escHtml(memberReceiptDate(ticket.updated_at))}\n`;
        if (ticket.last_reply) m += `${escHtml(ticket.last_reply).slice(0, 120)}\n`;
        m += `\n`;
      }
    }
    return sendTg(cid, m.trim(), {
      inline_keyboard: [[{ text: '聯繫客服', callback_data: 'u_contact' }], [{ text: '« 返回', callback_data: 'u_menu' }]]
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 財經日曆 /calendar
  // ═══════════════════════════════════════════════════════════════════════════
  if (cmd === '/calendar' || cmd === '/events' || cmd === '/econ' || cmd === '/財經') {
    const config = await getEconomicConfig(db, env);
    if (user.tier === 'free') config.impacts = ['high'];
    const events = await getUpcomingMarketEconomicEvents(db, config, { hours: 48, limit: 25 });
    return sendTg(cid, formatEconomicEventsMessage(events, { dateKey: taipeiDateKey(), source: config.sourceName }), {
      inline_keyboard: [[{ text: '« 返回', callback_data: 'u_menu' }]]
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 幫助說明 /help
  // ═══════════════════════════════════════════════════════════════════════════
  if (cmd === '/help') {
    let m = `❓ <b>使用說明</b>\n\n`;

    m += `📱 <b>基本功能</b>\n`;
    m += `/menu - 主選單\n`;
    m += `/login - 會員中心登入碼\n`;
    m += `/status - 會員狀態\n`;
    m += `/plans - 方案介紹\n`;
    m += `/contact - 聯繫客服\n`;
    m += `/support [問題] - 建立客服工單\n`;
    m += `/mytickets - 我的客服工單\n\n`;

    m += `🎯 <b>訂閱設定</b>\n`;
    m += `/subscribe - 選擇訂閱品種\n`;
    m += `/signaltype - 訊號類型偏好\n\n`;

    m += `⚙️ <b>個人設定</b>\n`;
    m += `/settings - 設定選單\n`;
    m += `/notify - 通知設定\n`;
    m += `/quiet - 安靜時段\n`;
    m += `/capital - 資金設定\n\n`;

    m += `📊 <b>訊號功能</b>\n`;
    m += `/signals - 最新訊號\n`;
    m += `/calendar - 財經日曆 / 經濟事件\n`;
    m += `/events - 今日重要經濟事件\n`;
    m += `/mystats - 我的績效\n\n`;

    m += `💳 <b>訂單收據</b>\n`;
    m += `/myorders - 我的訂單\n`;
    m += `/receipt [訂單ID] - 查詢訂單明細 / 收據\n\n`;

    m += `🎁 <b>積分系統</b>\n`;
    m += `/checkin - 每日簽到\n`;
    m += `/points - 積分查詢\n`;
    m += `/invite - 邀請好友\n`;

    return sendTg(cid, m);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 暫停/恢復訂閱 /pausesub /resumesub
  // ═══════════════════════════════════════════════════════════════════════════
  if (cmd === '/pausesub') {
    await updateUserSettings(db, uid, { paused: 1 });
    return sendTg(cid, `⏸️ 已暫停接收訊號\n\n使用 /resumesub 恢復`);
  }

  if (cmd === '/resumesub') {
    await updateUserSettings(db, uid, { paused: 0 });
    return sendTg(cid, `▶️ 已恢復接收訊號`);
  }

  return null;
}
// ═══════════════════════════════════════════════════════════════════════════════
// 用戶 Callback 處理
// ═══════════════════════════════════════════════════════════════════════════════

async function handleUserCallback(cid, uid, msgId, data, env, cbId = null) {
  const db = env.DB;
  const telegramUid = String(uid);
  uid = await resolveMemberUserId(db, telegramUid);
  const user = await getUser(db, uid);
  const settings = await getUserSettings(db, uid);
  data = normalizeUserCallback(data);
  await answerCb(cbId);

  // 返回主選單
  if (data === 'u_menu') {
    return editTg(cid, msgId, renderUserMenuText(user), renderUserMenuKeyboard(env));
  }

  // 訂閱設定
  if (data === 'u_subscribe') {
    if (user.tier === 'free') {
      return handleUserCommand(cid, uid, '/plans', [], env);
    }

    const subscribedSymbols = parseJSON(settings.subscribed_symbols, []);
    const categories = await getSymbolsByCategory(db);
    return editTg(cid, msgId, renderSubscribeText(categories, subscribedSymbols), renderSubscribeKeyboard(categories, subscribedSymbols));
  }

  // 切換品種訂閱
  if (data.startsWith('sym_')) {
    const symbol = data.replace('sym_', '');
    let subscribedSymbols = parseJSON(settings.subscribed_symbols, []);

    if (subscribedSymbols.includes(symbol)) {
      subscribedSymbols = subscribedSymbols.filter(s => s !== symbol);
    } else {
      subscribedSymbols.push(symbol);
    }

    await updateUserSettings(db, uid, { subscribed_symbols: JSON.stringify(subscribedSymbols) });

    const categories = await getSymbolsByCategory(db);
    return editTg(cid, msgId, renderSubscribeText(categories, subscribedSymbols), renderSubscribeKeyboard(categories, subscribedSymbols));
  }

  // 訊號類型設定
  if (data === 'u_signaltype') {
    const signalTypes = parseJSON(settings.signal_types, []);

    return editTg(cid, msgId, renderSignalTypeText(signalTypes), renderSignalTypeKeyboard(signalTypes));
  }

  // 切換訊號類型
  if (data.startsWith('type_')) {
    const type = data.replace('type_', '');
    let signalTypes = parseJSON(settings.signal_types, []);

    if (signalTypes.includes(type)) {
      signalTypes = signalTypes.filter(t => t !== type);
    } else {
      signalTypes.push(type);
    }

    await updateUserSettings(db, uid, { signal_types: JSON.stringify(signalTypes) });

    return editTg(cid, msgId, renderSignalTypeText(signalTypes), renderSignalTypeKeyboard(signalTypes));
  }

  // 個人設定
  if (data === 'u_settings') {
    return editTg(cid, msgId, renderSettingsText(settings), renderSettingsKeyboard(settings));
  }

  // 暫停/恢復
  if (data === 'toggle_pause') {
    const newPaused = settings.paused ? 0 : 1;
    await updateUserSettings(db, uid, { paused: newPaused });

    await answerCb(cbId, newPaused ? '已暫停接收訊號' : '已恢復接收訊號');

    const newSettings = await getUserSettings(db, uid);
    return editTg(cid, msgId, renderSettingsText(newSettings), renderSettingsKeyboard(newSettings));
  }

  // 通知設定
  if (data === 'u_notify') {
    return editTg(cid, msgId, renderNotifyText(), renderNotifyKeyboard(settings));
  }

  // 切換通知設定
  if (data.startsWith('ntf_')) {
    const field = {
      'ntf_entry': 'notify_entry',
      'ntf_tp': 'notify_tp',
      'ntf_sl': 'notify_sl',
      'ntf_update': 'notify_update',
      'ntf_daily': 'notify_daily_report',
      'ntf_announce': 'notify_announcement',
      'ntf_alert': 'notify_alert'
    }[data];

    if (field) {
      const newValue = settings[field] ? 0 : 1;
      await updateUserSettings(db, uid, { [field]: newValue });

      // 重新取得設定
      const newSettings = await getUserSettings(db, uid);
      return editTg(cid, msgId, renderNotifyText(), renderNotifyKeyboard(newSettings));
    }
  }

  // 安靜時段
  if (data === 'u_quiet') {
    return editTg(cid, msgId, renderQuietText(settings), renderQuietKeyboard(settings));
  }

  // 切換安靜時段
  if (data === 'toggle_quiet') {
    const newValue = settings.quiet_enabled ? 0 : 1;
    await updateUserSettings(db, uid, { quiet_enabled: newValue });
      await answerCb(cbId, newValue ? '安靜時段已啟用' : '安靜時段已關閉');

    const newSettings = await getUserSettings(db, uid);
    return editTg(cid, msgId, renderQuietText(newSettings), renderQuietKeyboard(newSettings));
  }

  // 設定安靜時段時間
  if (data.startsWith('quiet_s_')) {
    const hour = data.replace('quiet_s_', '');
    await updateUserSettings(db, uid, { quiet_start: `${hour}:00` });
    await answerCb(cbId, `開始時間設為 ${hour}:00`);
    const newSettings = await getUserSettings(db, uid);
    return editTg(cid, msgId, renderQuietText(newSettings), renderQuietKeyboard(newSettings));
  }

  if (data.startsWith('quiet_e_')) {
    const hour = data.replace('quiet_e_', '');
    await updateUserSettings(db, uid, { quiet_end: `${hour}:00` });
    await answerCb(cbId, `結束時間設為 ${hour}:00`);
    const newSettings = await getUserSettings(db, uid);
    return editTg(cid, msgId, renderQuietText(newSettings), renderQuietKeyboard(newSettings));
  }

  if (data.startsWith('tz_')) {
    const timezone = data.replace('tz_', '');
    await updateUserSettings(db, uid, { timezone });
    await answerCb(cbId, `時區已設為 ${timezone}`);
    let m = `<b>時區設定</b>\n\n`;
    m += `目前時區：<code>${escHtml(timezone)}</code>`;
    return editTg(cid, msgId, m, { inline_keyboard: [[{ text: '« 返回', callback_data: 'u_settings' }]] });
  }

  // 資金設定
  if (data === 'u_capital') {
    return editTg(cid, msgId, renderCapitalText(settings), renderCapitalKeyboard());
  }

  // 設定資金
  if (data.startsWith('cap_')) {
    const value = parseInt(data.replace('cap_', ''));
    await updateUserSettings(db, uid, { capital: value });
    await answerCb(cbId, `交易資金設為 $${fmtNum(value)}`);

    const newSettings = await getUserSettings(db, uid);
    const riskAmount = newSettings.capital * (newSettings.risk_percent / 100);

    return editTg(cid, msgId, renderCapitalText(newSettings), renderCapitalKeyboard());
  }

  // 設定風險
  if (data.startsWith('risk_')) {
    const value = parseFloat(data.replace('risk_', ''));
    await updateUserSettings(db, uid, { risk_percent: value });
    await answerCb(cbId, `風險比例設為 ${value}%`);
    const newSettings = await getUserSettings(db, uid);
    return editTg(cid, msgId, renderCapitalText(newSettings), renderCapitalKeyboard());
  }

  if (data.startsWith('u_order_')) {
    const orderId = data.replace('u_order_', '').toUpperCase();
    const receipt = await getMemberOrderReceipt(db, uid, orderId);
    if (!receipt) {
      return editTg(cid, msgId, `<b>訂單明細</b>\n\n找不到訂單 <code>${escHtml(orderId)}</code>，或此訂單不屬於目前會員。`, {
        inline_keyboard: [[{ text: '我的訂單', callback_data: 'u_orders' }], [{ text: '« 返回', callback_data: 'u_menu' }]]
      });
    }
    return editTg(cid, msgId, renderTelegramOrderReceipt(receipt.order, receipt.events, env), renderTelegramOrderReceiptKeyboard(receipt.order, env));
  }

  // 訊號執行記錄
  if (data.startsWith('exec_')) {
    const signalUid = data.replace('exec_', '');

    await db.prepare(`
      INSERT OR REPLACE INTO user_executions (user_id, signal_uid, status, created_at)
      VALUES (?, ?, 'executed', datetime('now'))
    `).bind(uid, signalUid).run();

    await answerCb(cbId, '已記錄為已執行');
    return;
  }

  if (data.startsWith('skip_')) {
    const signalUid = data.replace('skip_', '');

    await db.prepare(`
      INSERT OR REPLACE INTO user_executions (user_id, signal_uid, status, created_at)
      VALUES (?, ?, 'skipped', datetime('now'))
    `).bind(uid, signalUid).run();

    await answerCb(cbId, '已記錄為跳過');
    return;
  }

  // 其他頁面跳轉
  if (data === 'u_signals') return handleUserCommand(cid, uid, '/signals', [], env);
  if (data === 'u_calendar') return handleUserCommand(cid, uid, '/calendar', [], env);
  if (data === 'u_events') return handleUserCommand(cid, uid, '/events', [], env);
  if (data === 'u_active') return handleUserCommand(cid, uid, '/active', [], env);
  if (data === 'u_mystats') return handleUserCommand(cid, uid, '/mystats', [], env);
  if (data === 'u_plans') return handleUserCommand(cid, uid, '/plans', [], env);
  if (data === 'u_login') return handleUserCommand(cid, uid, '/login', [], env);
  if (data === 'u_status') return handleUserCommand(cid, uid, '/status', [], env);
  if (data === 'u_invite') return handleUserCommand(cid, uid, '/invite', [], env);
  if (data === 'u_contact') return handleUserCommand(cid, uid, '/contact', [], env);
  if (data === 'u_help') return handleUserCommand(cid, uid, '/help', [], env);
  if (data === 'u_tickets') return handleUserCommand(cid, uid, '/mytickets', [], env);
  if (data === 'u_checkin') return handleUserCommand(cid, uid, '/checkin', [], env);
  if (data === 'u_trial') return handleUserCommand(cid, uid, '/trial', [], env);
  if (data === 'u_points') return handleUserCommand(cid, uid, '/points', [], env);
  if (data === 'u_history') return handleUserCommand(cid, uid, '/history', [], env);
  if (data === 'u_renew') return handleUserCommand(cid, uid, '/renew', [], env);
  if (data === 'u_orders') return handleUserCommand(cid, uid, '/myorders', [], env);
  if (data === 'u_upgrade') return renderOrderPicker(cid, msgId, db, 'vip');
  if (data === 'u_redeem') return handleUserCommand(cid, uid, '/redeem', [], env);
  if (data === 'u_timezone') return handleUserCommand(cid, uid, '/timezone', [], env);
  if (data === 'copy_ref') {
    const refLink = `https://t.me/${CONFIG.BOT_USERNAME}?start=ref_${user.referral_code}`;
    await answerCb(cbId, '邀請連結已顯示在新訊息');
    return sendTg(cid, `<b>您的邀請連結</b>\n\n<code>${escHtml(refLink)}</code>`);
  }
  if (data === 'mystats_symbol') return handleUserCommand(cid, uid, '/perfbysymbol', [], env);
  if (data === 'mystats_month') return handleUserCommand(cid, uid, '/mymonth', [], env);

  // 訂閱方案
  if (data === 'order_pro' || data === 'order_vip') {
    const tier = data === 'order_pro' ? 'pro' : 'vip';
    return renderOrderPicker(cid, msgId, db, tier);
  }

  // 建立訂單
  if (data.startsWith('buy_')) {
    const parts = data.replace('buy_', '').split('_');
    const tier = parts[0];
    const months = parseInt(parts[1]);
    const price = parseInt(await getConfig(db, `${tier}_price_${months}m`));
    const days = months * 30;
    const orderId = genOrderId();
    await ensureOrderPaymentSchema(db);
    const clientHash = (await sha256Hex(`telegram:${uid}`)).slice(0, 40);

    await db.prepare(`
      INSERT INTO orders (
        order_id, user_id, tier, months, days, amount, payment_method, payment_provider, currency,
        terms_version, terms_accepted_at, risk_acknowledged_at, terms_client_hash, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?, datetime('now'))
    `).bind(orderId, uid, tier, months, days, price, 'manual', 'manual', stripeCurrency(env).toUpperCase(), ORDER_TERMS_VERSION, clientHash).run();
    await recordOrderEvent(db, orderId, uid, 'created', uid, `Telegram 建立 ${tierName(tier)} ${months} 個月訂單`, {
      tier,
      months,
      amount: price,
      paymentProvider: 'manual',
      termsVersion: ORDER_TERMS_VERSION,
      riskAcknowledged: true
    });
    await recordOrderEvent(db, orderId, uid, 'terms_accepted', uid, `Telegram 會員同意服務條款與交易風險揭露 ${ORDER_TERMS_VERSION}`, {
      termsVersion: ORDER_TERMS_VERSION,
      clientHash
    });

    const bank = await getConfig(db, 'payment_bank');
    const account = await getConfig(db, 'payment_account');
    const name = await getConfig(db, 'payment_name');
    const contact = await getConfig(db, 'contact_telegram');

    let m = `<b>訂單確認</b>\n\n`;
    m += `訂單編號：<code>${orderId}</code>\n`;
    m += `方案：${tierName(tier)} ${months}個月\n`;
    m += `金額：<b>NT$ ${fmtNum(price)}</b>\n\n`;
    m += `<b>付款方式</b>\n`;
    m += `銀行：${escHtml(bank)}\n`;
    m += `帳號：<code>${escHtml(account)}</code>\n`;
    m += `戶名：${escHtml(name)}\n\n`;
    m += `付款後請點擊下方按鈕通知客服。\n`;

    const buttons = [
      [{ text: '我已付款', callback_data: `paid_${orderId}` }],
      [{ text: '訂單明細', callback_data: `u_order_${orderId}` }],
      [{ text: '取消訂單', callback_data: `cancel_${orderId}` }],
      [{ text: '我的訂單', callback_data: 'u_orders' }],
      [{ text: '聯繫客服', callback_data: 'u_contact' }]
    ];

    // 通知管理員
    for (const adminId of CONFIG.ADMIN_IDS) {
      await sendTg(adminId, `📋 新訂單！\n\n用戶：${escHtml(formatUserLabel(user, uid))}\nID：<code>${uid}</code>\n訂單：<code>${orderId}</code>\n方案：${tierName(tier)} ${months}個月\n金額：NT$${price}`);
    }

    return editTg(cid, msgId, m, { inline_keyboard: buttons });
  }

  // 付款通知
  if (data.startsWith('paid_')) {
    const orderId = data.replace('paid_', '');
    const order = await db.prepare('SELECT * FROM orders WHERE order_id = ? AND user_id = ?').bind(orderId, uid).first();
    if (!order) {
      await answerCb(cbId, '找不到此訂單');
      return;
    }
    if (!['pending', 'paid'].includes(order.status)) {
      await answerCb(cbId, '此訂單狀態無法通知付款');
      return;
    }
    await db.prepare(`UPDATE orders SET status = 'paid', paid_at = COALESCE(paid_at, datetime('now')), payment_note = '用戶已通知付款' WHERE order_id = ?`).bind(orderId).run();
    await recordOrderEvent(db, orderId, uid, 'paid_notice', uid, 'Telegram 用戶已通知付款', { previousStatus: order.status });

    // 通知管理員
    for (const adminId of CONFIG.ADMIN_IDS) {
      await sendTg(adminId, `💰 用戶已付款通知！\n\n訂單：<code>${orderId}</code>\n用戶：<code>${uid}</code>\n\n請確認後使用 /confirm ${orderId}`);
    }

    await answerCb(cbId, '已通知客服，請稍候', true);

    let m = `✅ <b>付款通知已送出</b>\n\n`;
    m += `訂單編號：<code>${orderId}</code>\n\n`;
    m += `客服確認付款後會自動開通會員\n`;
    m += `請稍候，通常10分鐘內處理完成`;

    return editTg(cid, msgId, m, {
      inline_keyboard: [
        [{ text: '訂單明細', callback_data: `u_order_${orderId}` }],
        [{ text: '我的訂單', callback_data: 'u_orders' }],
        [{ text: '« 返回', callback_data: 'u_menu' }]
      ]
    });
  }

  // 取消訂單
  if (data.startsWith('cancel_')) {
    const orderId = data.replace('cancel_', '');
    const order = await db.prepare('SELECT * FROM orders WHERE order_id = ? AND user_id = ?').bind(orderId, uid).first();
    if (!order) {
      await answerCb(cbId, '找不到此訂單');
      return;
    }
    if (!['pending', 'paid'].includes(order.status)) {
      await answerCb(cbId, '此訂單狀態無法取消');
      return;
    }
    await db.prepare(`UPDATE orders SET status = 'cancelled' WHERE order_id = ?`).bind(orderId).run();
    await recordOrderEvent(db, orderId, uid, 'cancelled', uid, 'Telegram 用戶取消訂單', { previousStatus: order.status });
    await answerCb(cbId, '訂單已取消');
    return editTg(cid, msgId, `❌ 訂單已取消\n\n如需重新訂閱，請使用 /plans`, {
      inline_keyboard: [
        [{ text: '訂單明細', callback_data: `u_order_${orderId}` }],
        [{ text: '我的訂單', callback_data: 'u_orders' }],
        [{ text: '« 返回', callback_data: 'u_menu' }]
      ]
    });
  }

  return null;
}
// ═══════════════════════════════════════════════════════════════════════════════
// 管理員指令處理
// ═══════════════════════════════════════════════════════════════════════════════

async function handleAdminCommand(cid, uid, cmd, args, fullText, env) {
  const db = env.DB;

  // ═══════════════════════════════════════════════════════════════════════════
  // 快速發訊
  // ═══════════════════════════════════════════════════════════════════════════

  // /long NQ 21500 21480 21520 21540 @vip
  // /short ES 5820 5835 5810 5800
  if (cmd === '/long' || cmd === '/short') {
    if (args.length < 4) {
      return sendTg(cid,
        `📊 <b>快速發訊</b>\n\n` +
        `格式：\n<code>/${cmd.slice(1)} 品種 進場 止損 TP1 [TP2] [TP3] [@群組]</code>\n\n` +
        `範例：\n` +
        `<code>/long NQ 21500 21480 21520 21540</code>\n` +
        `<code>/short ES 5820 5835 5810 5800 @vip</code>\n\n` +
        `類型：\n` +
        `<code>/scalp long NQ ...</code> 短線\n` +
        `<code>/swing short ES ...</code> 波段`
      );
    }

    const ticker = args[0].toUpperCase();
    const entry = parseFloat(args[1]);
    const sl = parseFloat(args[2]);
    const tp1 = args[3] ? parseFloat(args[3]) : null;
    const tp2 = args[4] && !args[4].startsWith('@') ? parseFloat(args[4]) : null;
    const tp3 = args[5] && !args[5].startsWith('@') ? parseFloat(args[5]) : null;

    let targetGroup = 'all';
    let isVipOnly = false;
    for (const arg of args) {
      if (arg.startsWith('@')) {
        targetGroup = arg.slice(1).toLowerCase();
        if (targetGroup === 'vip') isVipOnly = true;
        break;
      }
    }

    const action = cmd === '/long' ? 'LONG' : 'SHORT';
    const signalUid = genUID();
    const signalType = 'scalp'; // 預設

    // 檢查是否暫停
    const paused = await getConfig(db, 'signals_paused');
    if (paused === '1') {
      return sendTg(cid, `⚠️ 訊號已暫停\n使用 /resume 恢復`);
    }

    await closeActiveSignalsForReplacement(db, {
      signal_uid: signalUid,
      ticker,
      action,
      entry_price: entry
    }, uid, env, true);

    // 儲存訊號
    await db.prepare(`
      INSERT INTO signals (signal_uid, ticker, action, signal_type, entry_price, stop_loss, tp1, tp2, tp3, target_group, is_vip_only, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(signalUid, ticker, action, signalType, entry, sl, tp1, tp2, tp3, targetGroup, isVipOnly ? 1 : 0).run();

    // 建立訊號物件
    const signal = {
      signal_uid: signalUid,
      ticker, action, signal_type: signalType,
      entry_price: entry, stop_loss: sl,
      tp1, tp2, tp3,
      target_group: targetGroup,
      is_vip_only: isVipOnly
    };

    // 廣播訊號
    const result = await broadcastSignal(db, signal, env);

    await logAction(db, uid, 'signal', signalUid, `${action} ${ticker} @${targetGroup}`);

    // 更新發送數
    await db.prepare(`UPDATE signals SET sent_count = ? WHERE signal_uid = ?`).bind(result.sent, signalUid).run();

    return sendTg(cid,
      `✅ <b>訊號已發送</b>\n\n` +
      `${CONFIG.ACTIONS[action].emoji} ${CONFIG.ACTIONS[action].name} ${ticker}\n` +
      `進場：${fmtPrice(entry)} | 止損：${fmtPrice(sl)}\n` +
      `目標：${isVipOnly ? '👑 VIP專屬' : '@' + targetGroup}\n\n` +
      `📤 發送：${result.sent} 人\n` +
      `⏳ 待發：${result.queued} 人 (安靜時段)\n` +
      `⏭️ 跳過：${result.skipped} 人\n\n` +
      `🔖 #${signalUid}`
    );
  }

  // /scalp /swing 帶類型發訊
  if (cmd === '/scalp' || cmd === '/swing') {
    if (args.length < 5) {
      return sendTg(cid, `用法：/${cmd.slice(1)} [long/short] [品種] [進場] [止損] [TP1] ...`);
    }

    const action = args[0].toUpperCase();
    if (action !== 'LONG' && action !== 'SHORT') {
      return sendTg(cid, `第一個參數必須是 long 或 short`);
    }

    const ticker = args[1].toUpperCase();
    const entry = parseFloat(args[2]);
    const sl = parseFloat(args[3]);
    const tp1 = args[4] ? parseFloat(args[4]) : null;
    const tp2 = args[5] && !args[5].startsWith('@') ? parseFloat(args[5]) : null;
    const tp3 = args[6] && !args[6].startsWith('@') ? parseFloat(args[6]) : null;

    let targetGroup = 'all';
    let isVipOnly = false;
    for (const arg of args) {
      if (arg.startsWith('@')) {
        targetGroup = arg.slice(1).toLowerCase();
        if (targetGroup === 'vip') isVipOnly = true;
        break;
      }
    }

    const signalUid = genUID();
    const signalType = cmd === '/scalp' ? 'scalp' : 'swing';

    const paused = await getConfig(db, 'signals_paused');
    if (paused === '1') {
      return sendTg(cid, `⚠️ 訊號已暫停\n使用 /resume 恢復`);
    }

    await closeActiveSignalsForReplacement(db, {
      signal_uid: signalUid,
      ticker,
      action,
      entry_price: entry
    }, uid, env, true);

    await db.prepare(`
      INSERT INTO signals (signal_uid, ticker, action, signal_type, entry_price, stop_loss, tp1, tp2, tp3, target_group, is_vip_only, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(signalUid, ticker, action, signalType, entry, sl, tp1, tp2, tp3, targetGroup, isVipOnly ? 1 : 0).run();

    const signal = {
      signal_uid: signalUid,
      ticker, action, signal_type: signalType,
      entry_price: entry, stop_loss: sl,
      tp1, tp2, tp3,
      target_group: targetGroup,
      is_vip_only: isVipOnly
    };

    const result = await broadcastSignal(db, signal, env);
    await logAction(db, uid, 'signal', signalUid, `${signalType} ${action} ${ticker}`);

    const typeInfo = CONFIG.SIGNAL_TYPES[signalType];

    return sendTg(cid,
      `✅ <b>${typeInfo.emoji} ${typeInfo.name}已發送</b>\n\n` +
      `${CONFIG.ACTIONS[action].emoji} ${CONFIG.ACTIONS[action].name} ${ticker}\n` +
      `發送：${result.sent} 人\n` +
      `🔖 #${signalUid}`
    );
  }

  // /tp1 /tp2 /tp3 止盈
  if (cmd === '/tp1' || cmd === '/tp2' || cmd === '/tp3' || cmd === '/tp') {
    let ticker, price, tpNum;

    if (cmd === '/tp') {
      if (args.length < 3) return sendTg(cid, `用法：/tp [品種] [1/2/3] [價格]`);
      ticker = args[0].toUpperCase();
      tpNum = args[1];
      price = parseFloat(args[2]);
    } else {
      if (args.length < 2) return sendTg(cid, `用法：${cmd} [品種] [價格]`);
      ticker = args[0].toUpperCase();
      price = parseFloat(args[1]);
      tpNum = cmd.slice(3);
    }

    const type = `TP${tpNum}`;
    if (!['TP1', 'TP2', 'TP3'].includes(type)) return sendTg(cid, `用法：/tp [品種] [1/2/3] [價格]`);

    // 找到對應訊號
    const signal = await db.prepare(`
      SELECT * FROM signals WHERE ticker = ? AND action IN ('LONG', 'SHORT') AND status = 'active'
      ORDER BY created_at DESC LIMIT 1
    `).bind(ticker).first();

    // TP1 / TP2：部分止盈，移動止損保本續抱（不平倉）
    if (signal && (type === 'TP1' || type === 'TP2')) {
      const r = await applyPartialTakeProfit(db, uid, signal, type, price, true);
      return sendTg(cid, `✅ ${type} 部分止盈已發送\n${ticker} @ ${fmtPrice(price)}\n盈虧：${r.pnl >= 0 ? '+' : ''}${fmtPrice(r.pnl)} 點\n止損移到 ${fmtPrice(r.newStop)}（${r.level === 1 ? '保本' : '鎖利'}），續抱中\n發送：${r.delivery.sent} 人`);
    }

    let pnl = null;
    let tpHitText = '';
    if (signal) {
      pnl = signal.action === 'LONG' ? price - signal.entry_price : signal.entry_price - price;
      if (type === 'TP3') {
        const closed = await closeSignalRecord(db, signal, price, type, `${type} 達成`);
        pnl = closed.pnl;
        tpHitText = closed.tpHitsText;
      } else {
        const count = signalTpHitCountAtPrice(signal, price, type);
        await markSignalTpHits(db, signal.signal_uid, count);
        tpHitText = signalTpHitText({ ...signal, tp_hit_count: count });
      }
    }

    const note = tpHitText ? `已達 ${tpHitText}` : '恭喜獲利！🎉';
    const result = await broadcastExit(db, type, ticker, price, pnl, note, signal?.signal_uid);

    await logAction(db, uid, type, ticker, `${fmtPrice(price)}`);

    return sendTg(cid, `✅ ${type} 已更新\n${ticker} @ ${fmtPrice(price)}\n盈虧：${pnl !== null ? (pnl >= 0 ? '+' : '') + fmtPrice(pnl) + '點' : '-'}${tpHitText ? `\n已達：${tpHitText}` : ''}\n發送：${result.sent} 人`);
  }

  // /sl 止損
  if (cmd === '/sl') {
    if (args.length < 2) return sendTg(cid, `用法：/sl [品種] [價格]`);

    const ticker = args[0].toUpperCase();
    const price = parseFloat(args[1]);

    const signal = await db.prepare(`
      SELECT * FROM signals WHERE ticker = ? AND action IN ('LONG', 'SHORT') AND status = 'active'
      ORDER BY created_at DESC LIMIT 1
    `).bind(ticker).first();

    let pnl = null;
    if (signal) {
      const closed = await closeSignalRecord(db, signal, price, 'SL', '止損觸發');
      pnl = closed.pnl;
    }

    const result = await broadcastExit(db, 'SL', ticker, price, pnl, '止損觸發', signal?.signal_uid);

    await logAction(db, uid, 'SL', ticker, `${fmtPrice(price)}`);

    return sendTg(cid, `✅ 止損已發送\n${ticker} @ ${fmtPrice(price)}\n虧損：${pnl !== null ? fmtPrice(pnl) + '點' : '-'}\n發送：${result.sent} 人`);
  }

  // /close 手動平倉
  if (cmd === '/close') {
    if (args.length < 2) return sendTg(cid, `用法：/close [品種] [價格] [原因]`);

    const ticker = args[0].toUpperCase();
    const price = parseFloat(args[1]);
    const reason = args.slice(2).join(' ') || '手動平倉';

    const signal = await db.prepare(`
      SELECT * FROM signals WHERE ticker = ? AND action IN ('LONG', 'SHORT') AND status = 'active'
      ORDER BY created_at DESC LIMIT 1
    `).bind(ticker).first();

    let pnl = null;
    let resultType = 'breakeven';
    if (signal) {
      const closed = await closeSignalRecord(db, signal, price, 'CLOSE', reason);
      pnl = closed.pnl;
      resultType = closed.result;
    }

    const result = await broadcastExit(db, 'CLOSE', ticker, price, pnl, reason, signal?.signal_uid);

    await logAction(db, uid, 'CLOSE', ticker, `${fmtPrice(price)} - ${reason}`);

    return sendTg(cid, `✅ 平倉已發送\n${ticker} @ ${fmtPrice(price)}\n盈虧：${pnl !== null ? (pnl >= 0 ? '+' : '') + fmtPrice(pnl) + '點' : '-'}\n發送：${result.sent} 人`);
  }

  // /update 更新
  if (cmd === '/update') {
    if (!fullText) return sendTg(cid, `用法：/update [更新內容]`);
    const msg = formatUpdateCard(fullText);
    const result = await broadcastMessage(db, msg, 'paid', 'update');
    return sendTg(cid, `✅ 更新已發送 | ${result.sent} 人`);
  }

  // /alert 警報
  if (cmd === '/alert') {
    if (!fullText) return sendTg(cid, `用法：/alert [警報內容]`);
    const msg = formatAlertCard(fullText);
    const result = await broadcastMessage(db, msg, 'paid', 'alert');
    return sendTg(cid, `✅ 警報已發送 | ${result.sent} 人`);
  }

  if (cmd === '/econpush' || cmd === '/eventpush') {
    const dateKey = args[0] || taipeiDateKey();
    const result = await sendEconomicEventsReminder(env, { force: true, date: dateKey });
    return sendTg(cid, `✅ 經濟事件提醒已處理\n日期：${escHtml(dateKey)}\n事件：${result.eventCount || 0}\n發送：${result.sent || 0} 人${result.skipped ? `\n略過：${escHtml(result.reason || '')}` : ''}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 廣播系統
  // ═══════════════════════════════════════════════════════════════════════════

  // /bc 廣播
  if (cmd === '/bc') {
    if (!fullText) return sendTg(cid, `用法：\n/bc [訊息]\n/bc @all [訊息]\n/bc @vip [訊息]\n/bc @群組 [訊息]`);

    let targetGroup = 'paid';
    let message = fullText;

    if (args[0]?.startsWith('@')) {
      targetGroup = args[0].slice(1).toLowerCase();
      message = args.slice(1).join(' ');
    }

    if (!message) return sendTg(cid, `請輸入廣播內容`);

    const formattedMsg = `<b>公告</b>\n\n${escHtml(message)}\n\n${fmtTime()}`;

    const result = await broadcastMessage(db, formattedMsg, targetGroup, 'announcement');

    await db.prepare(`INSERT INTO broadcasts (message, target_group, sent_count, created_by, created_at) VALUES (?, ?, ?, ?, datetime('now'))`).bind(message, targetGroup, result.sent, uid).run();
    await logAction(db, uid, 'broadcast', targetGroup, message.substring(0, 50));

    return sendTg(cid, `✅ 廣播已發送\n目標：@${targetGroup}\n成功：${result.sent} 人`);
  }

  // /announce 重要公告
  if (cmd === '/announce') {
    if (!fullText) return sendTg(cid, `用法：/announce [公告內容]`);

    const msg = `<b>重要公告</b>\n\n${escHtml(fullText)}\n\n${fmtTime()}`;

    const result = await broadcastMessage(db, msg, 'all', 'announcement');
    await logAction(db, uid, 'announce', '', fullText.substring(0, 50));

    return sendTg(cid, `✅ 重要公告已發送 | ${result.sent} 人`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 管理儀表板
  // ═══════════════════════════════════════════════════════════════════════════

  if (cmd === '/ops') {
    await ensureAdminSchema(db);
    const configRows = await db.prepare(`SELECT key, value FROM system_config WHERE key IN (${ADMIN_CONFIG_KEYS.map(() => '?').join(',')})`).bind(...ADMIN_CONFIG_KEYS).all();
    const config = {};
    for (const row of configRows.results || []) config[row.key] = row.value;
    const ops = await getOperationalHealth(db, config, Date.now(), env);
    const statusIcon = ops.status === 'critical' ? '🔴' : ops.status === 'warning' ? '🟡' : '🟢';
    let m = `${statusIcon} <b>營運健康檢查</b>\n\n`;
    m += `狀態：<b>${escHtml(ops.statusText)}</b>\n`;
    m += `後台載入：${ops.bootstrapMs}ms\n`;
    m += `TV來源：${ops.sourceStats.active}/${ops.sourceStats.total}\n`;
    m += `24H Alert：${ops.alertStats.total24} 筆，錯誤 ${ops.alertStats.failed24} 筆\n`;
    m += `訊號：進行中 ${ops.signalStats.active}，草稿 ${ops.signalStats.drafts}\n`;
    m += `訂單：待處理 ${ops.orderStats.total}，已付款待確認 ${ops.orderStats.paid}\n`;
    m += `待發佇列：${ops.queueStats.due}\n`;
    if (ops.alertStats.latestAt) m += `最新 Alert：${fmtDateTime(ops.alertStats.latestAt)}\n`;
    if (ops.issues.length) {
      m += `\n<b>待處理</b>\n`;
      for (const issue of ops.issues.slice(0, 6)) {
        const icon = issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵';
        m += `${icon} ${escHtml(issue.title)}\n${escHtml(issue.action)}\n`;
      }
    } else {
      m += `\n目前沒有需要處理的營運警示。`;
    }
    return sendTg(cid, m, {
      inline_keyboard: [
        [{ text: '開啟後台', url: 'https://dc-signals-v91.cc559773.workers.dev/admin' }],
        [{ text: '訂單', callback_data: 'a_orders' }, { text: '設定', callback_data: 'a_config' }]
      ]
    });
  }

  if (cmd === '/admin' || cmd === '/dash') {
    const totalUsers = await db.prepare('SELECT COUNT(*) as c FROM users').first();
    const proUsers = await db.prepare("SELECT COUNT(*) as c FROM users WHERE tier = 'pro' AND is_active = 1").first();
    const vipUsers = await db.prepare("SELECT COUNT(*) as c FROM users WHERE tier = 'vip' AND is_active = 1").first();
    const todaySignals = await db.prepare("SELECT COUNT(*) as c FROM signals WHERE DATE(created_at) = DATE('now')").first();
    const activeSignals = await db.prepare("SELECT COUNT(*) as c FROM signals WHERE status = 'active'").first();
    const pendingOrders = await db.prepare("SELECT COUNT(*) as c FROM orders WHERE status IN ('pending', 'paid')").first();

    const todayPerf = await db.prepare(`
      SELECT COUNT(*) as total, SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins, SUM(pnl_points) as pnl
      FROM performance WHERE DATE(created_at) = DATE('now')
    `).first();

    const paused = await getConfig(db, 'signals_paused');

    let m = `<b>DC Signals 管理儀表板</b>\n`;
    m += `v${CONFIG.VERSION} ${CONFIG.BUILD}\n\n`;
    m += `<b>用戶</b>\n`;
    m += `總計 ${totalUsers?.c || 0}\n`;
    m += `Pro ${proUsers?.c || 0} · VIP ${vipUsers?.c || 0}\n\n`;
    m += `<b>今日訊號</b>\n`;
    m += `發送 ${todaySignals?.c || 0} 筆\n`;
    const winRate = todayPerf?.total > 0 ? ((todayPerf.wins / todayPerf.total) * 100).toFixed(0) : 0;
    m += `勝率 ${winRate}%\n`;
    m += `盈虧 ${(todayPerf?.pnl || 0) >= 0 ? '+' : ''}${fmtPrice(todayPerf?.pnl || 0)} 點\n`;

    if (pendingOrders?.c > 0) {
      m += `\n待處理訂單：${pendingOrders.c}\n`;
    }

    m += `\n${paused === '1' ? '已暫停' : '運行中'} · ${fmtTime()}`;

    const kb = {
      inline_keyboard: [
        [
          { text: '⬆️ 做多', callback_data: 'a_help_long' },
          { text: '⬇️ 做空', callback_data: 'a_help_short' }
        ],
        [
          { text: '📢 廣播', callback_data: 'a_help_bc' },
          { text: '⚠️ 警報', callback_data: 'a_help_alert' }
        ],
        [
          { text: '👥 用戶', callback_data: 'a_users' },
          { text: '📊 績效', callback_data: 'a_perf' }
        ],
        [
          { text: '💰 訂單', callback_data: 'a_orders' },
          { text: '客服', callback_data: 'a_tickets' }
        ],
        [
          { text: '🩺 營運', callback_data: 'a_ops' },
          { text: '⚙️ 設定', callback_data: 'a_config' }
        ]
      ]
    };

    return sendTg(cid, m, kb);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 用戶管理
  // ═══════════════════════════════════════════════════════════════════════════

  if (cmd === '/users') {
    const page = parseInt(args[0]) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    const total = await db.prepare('SELECT COUNT(*) as c FROM users').first();
    const users = await db.prepare(`
      SELECT user_id, username, first_name, tier, tier_expires_at
      FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    let m = `👥 <b>用戶列表</b> (${page}/${Math.ceil((total?.c || 0) / limit)})\n\n`;

    for (const u of users.results || []) {
      const name = u.username ? `@${u.username}` : u.first_name || u.user_id;
      const dl = u.tier !== 'free' && u.tier_expires_at ? ` (${daysLeft(u.tier_expires_at)}天)` : '';
      m += `${tierEmoji(u.tier)} ${name}${dl}\n`;
    }

    m += `\n總計：${total?.c || 0} 人\n下一頁：/users ${page + 1}`;

    return sendTg(cid, m);
  }

  if (cmd === '/user') {
    if (!args[0]) return sendTg(cid, `用法：/user [ID或@用戶名]`);

    let userId = args[0];
    if (userId.startsWith('@')) {
      const found = await db.prepare('SELECT user_id FROM users WHERE username = ?').bind(userId.slice(1)).first();
      if (found) userId = found.user_id;
    }

    const user = await getUser(db, userId);
    const settings = await getUserSettings(db, userId);
    const subscribedSymbols = parseJSON(settings.subscribed_symbols, []);

    let m = `<b>用戶詳情</b>\n\n`;
    m += `ID：<code>${user.user_id}</code>\n`;
    m += `用戶名：${user.username ? '@' + user.username : '-'}\n`;
    m += `姓名：${user.first_name || '-'}\n\n`;
    m += `${tierName(user.tier)}\n`;

    if (user.tier !== 'free' && user.tier_expires_at) {
      m += `到期：${fmtDate(user.tier_expires_at)} (${daysLeft(user.tier_expires_at)}天)\n`;
    }

    m += `\n📊 訂閱品種：${subscribedSymbols.join(', ') || '未設定'}\n`;
    m += `💰 資金：$${fmtNum(settings.capital)}\n`;
    m += `📈 風險：${settings.risk_percent}%\n`;
    m += `🔔 通知：${settings.paused ? '已暫停' : '開啟'}\n\n`;
    m += `🎁 積分：${user.points || 0}\n`;
    m += `👥 推薦：${user.referral_count || 0} 人`;

    if (user.admin_note) m += `\n\n📝 備註：${user.admin_note}`;

    const kb = {
      inline_keyboard: [
        [
          { text: '⭐ Pro 30天', callback_data: `adm_pro_${userId}` },
          { text: '👑 VIP 30天', callback_data: `adm_vip_${userId}` }
        ],
        [
          { text: '➕ 7天', callback_data: `adm_add7_${userId}` },
          { text: '➕ 30天', callback_data: `adm_add30_${userId}` }
        ],
        [
          { text: '💬 私訊', callback_data: `adm_msg_${userId}` },
          { text: '🚫 封禁', callback_data: `adm_ban_${userId}` }
        ]
      ]
    };

    return sendTg(cid, m, kb);
  }

  if (cmd === '/pro' || cmd === '/vip') {
    if (!args[0]) return sendTg(cid, `用法：${cmd} [用戶ID] [天數]`);

    const userId = args[0];
    const days = parseInt(args[1]) || 30;
    const tier = cmd === '/pro' ? 'pro' : 'vip';
    const expires = new Date(Date.now() + days * 86400000).toISOString();

    await updateUser(db, userId, { tier, tier_expires_at: expires });
    await logAction(db, uid, `set_${tier}`, userId, `${days} days`);

    await sendMemberNotice(userId, `🎉 恭喜！您已升級為 ${tierName(tier)}\n\n天數：${days} 天\n到期：${fmtDate(expires)}\n\n請使用 /subscribe 設定您想接收的品種`, null, { db });

    return sendTg(cid, `✅ 已將 <code>${userId}</code> 設為 ${tierName(tier)} (${days}天)`);
  }

  if (cmd === '/adddays') {
    if (args.length < 2) return sendTg(cid, `用法：/adddays [用戶ID] [天數]`);

    const userId = args[0];
    const days = parseInt(args[1]);
    const user = await getUser(db, userId);

    let newExpiry;
    if (user.tier !== 'free' && user.tier_expires_at && new Date(user.tier_expires_at) > new Date()) {
      newExpiry = new Date(new Date(user.tier_expires_at).getTime() + days * 86400000);
    } else {
      newExpiry = new Date(Date.now() + days * 86400000);
    }

    await updateUser(db, userId, { tier_expires_at: newExpiry.toISOString() });
    await logAction(db, uid, 'adddays', userId, `${days} days`);

    await sendMemberNotice(userId, `🎉 您的會員已延長 <b>${days}</b> 天！\n新到期日：${fmtDate(newExpiry)}`, null, { db });

    return sendTg(cid, `✅ 已為 <code>${userId}</code> 延長 ${days} 天`);
  }

  if (cmd === '/ban') {
    if (!args[0]) return sendTg(cid, `用法：/ban [用戶ID]`);
    await updateUser(db, args[0], { is_banned: 1 });
    await logAction(db, uid, 'ban', args[0], '');
    return sendTg(cid, `🚫 已封禁 <code>${args[0]}</code>`);
  }

  if (cmd === '/unban') {
    if (!args[0]) return sendTg(cid, `用法：/unban [用戶ID]`);
    await updateUser(db, args[0], { is_banned: 0 });
    await logAction(db, uid, 'unban', args[0], '');
    return sendTg(cid, `✅ 已解封 <code>${args[0]}</code>`);
  }

  if (cmd === '/msg') {
    if (args.length < 2) return sendTg(cid, `用法：/msg [用戶ID] [訊息]`);
    const userId = args[0];
    const message = args.slice(1).join(' ');
    const result = await sendMemberNotice(userId, `<b>管理員訊息</b>\n\n${escHtml(message)}`, null, { db });
    return sendTg(cid, result?.ok ? `✅ 訊息已發送給 <code>${userId}</code>` : `❌ 發送失敗`);
  }

  if (cmd === '/tickets') {
    const tickets = await getAdminSupportTickets(db, 12);
    let m = `<b>客服工單</b>\n\n`;
    if (!tickets.length) {
      m += `目前沒有客服工單。`;
    } else {
      for (const ticket of tickets) {
        const name = ticket.username ? `@${ticket.username}` : ticket.first_name || ticket.user_id;
        const icon = ticket.status === 'closed' ? '✅' : ticket.status === 'pending' ? '💬' : '📨';
        m += `${icon} <code>${ticket.ticket_id}</code> · ${escHtml(supportStatusLabel(ticket.status))} · ${escHtml(ticket.priority)}\n`;
        m += `會員：${escHtml(name)} (${escHtml(ticket.tier || 'free')})\n`;
        m += `主旨：${escHtml(ticket.subject)}\n`;
        m += `更新：${escHtml(memberReceiptDate(ticket.updated_at))}\n\n`;
      }
      m += `回覆：/reply [工單ID] [內容]\n`;
      m += `結案：/closeticket [工單ID] [原因]`;
    }
    return sendTg(cid, m);
  }

  if (cmd === '/reply') {
    if (args.length < 2) return sendTg(cid, `用法：/reply [工單ID] [回覆內容]`);
    const ticketId = args[0].toUpperCase();
    const message = args.slice(1).join(' ');
    await replySupportTicket(db, env, uid, ticketId, message);
    return sendTg(cid, `✅ 已回覆工單 <code>${ticketId}</code>`);
  }

  if (cmd === '/closeticket') {
    if (!args[0]) return sendTg(cid, `用法：/closeticket [工單ID] [原因]`);
    const ticketId = args[0].toUpperCase();
    const reason = args.slice(1).join(' ') || '客服已結案';
    await closeSupportTicket(db, env, uid, ticketId, reason);
    return sendTg(cid, `✅ 已結案工單 <code>${ticketId}</code>`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 訂單管理
  // ═══════════════════════════════════════════════════════════════════════════

  if (cmd === '/orders') {
    const orders = await db.prepare(`
      SELECT o.*, u.username, u.first_name FROM orders o
      LEFT JOIN users u ON o.user_id = u.user_id
      WHERE o.status IN ('pending', 'paid')
      ORDER BY o.created_at DESC
    `).all();

    if (!orders.results || orders.results.length === 0) {
      return sendTg(cid, `📋 沒有待處理訂單`);
    }

    let m = `💰 <b>待處理訂單</b>\n\n`;

    for (const o of orders.results) {
      const name = o.username ? `@${o.username}` : o.first_name || o.user_id;
      const status = o.status === 'paid' ? '💰 已付款' : '⏳ 待付款';
      m += `📋 <code>${o.order_id}</code>\n`;
      m += `├ ${status}\n`;
      m += `├ ${name}\n`;
      m += `├ ${tierName(o.tier)} ${o.months}個月\n`;
      m += `NT$${fmtNum(o.amount)}\n\n`;
    }

    m += `確認：/confirm [訂單ID]\n`;
    m += `拒絕：/reject [訂單ID]\n`;
    m += `退款：/refund [訂單ID] [金額] [原因]`;

    return sendTg(cid, m);
  }

  if (cmd === '/confirm') {
    if (!args[0]) return sendTg(cid, `用法：/confirm [訂單ID]`);

    const orderId = args[0].toUpperCase();
    const order = await db.prepare('SELECT * FROM orders WHERE order_id = ?').bind(orderId).first();

    if (!order) return sendTg(cid, `❌ 找不到訂單 ${orderId}`);
    if (order.status === 'confirmed') return sendTg(cid, `❌ 訂單已確認`);

    await confirmOrderRecord(db, uid, order, {
      paymentMethod: order.payment_method || 'manual',
      paymentProvider: order.payment_provider || order.payment_method || 'manual',
      action: 'confirm_order'
    });
    return sendTg(cid, `✅ 訂單 ${orderId} 已確認\n用戶已升級為 ${tierName(order.tier)}`);
  }

  if (cmd === '/reject') {
    if (!args[0]) return sendTg(cid, `用法：/reject [訂單ID] [原因]`);

    const orderId = args[0].toUpperCase();
    const reason = args.slice(1).join(' ') || '未說明';
    const order = await db.prepare('SELECT * FROM orders WHERE order_id = ?').bind(orderId).first();
    if (!order) return sendTg(cid, `❌ 找不到訂單 ${orderId}`);

    await db.prepare(`UPDATE orders SET status = 'rejected' WHERE order_id = ?`).bind(orderId).run();
    await recordOrderEvent(db, orderId, order.user_id, 'rejected', uid, reason, { source: 'telegram-admin' });
    await sendMemberNotice(order.user_id, `❌ <b>訂單已取消</b>\n\n訂單：${orderId}\n原因：${reason}`, null, { db });

    return sendTg(cid, `✅ 訂單 ${orderId} 已拒絕`);
  }

  if (cmd === '/refund') {
    if (!args[0]) return sendTg(cid, `用法：/refund [訂單ID] [金額] [原因]\n金額可省略，預設為訂單全額。`);

    const orderId = args[0].toUpperCase();
    const order = await db.prepare('SELECT * FROM orders WHERE order_id = ?').bind(orderId).first();
    if (!order) return sendTg(cid, `❌ 找不到訂單 ${orderId}`);

    const maybeAmount = asNumber(args[1], null);
    const amount = maybeAmount == null ? Number(order.amount || 0) : maybeAmount;
    const reason = (maybeAmount == null ? args.slice(1) : args.slice(2)).join(' ') || '人工退款';
    const result = await refundOrderRecord(db, uid, order, {
      amount,
      reason,
      revoke_access: true,
      notify: true,
      action: 'telegram_order_refund'
    });
    return sendTg(cid, `✅ 已記錄退款 ${orderId}\n金額：${orderRefundMoney({ ...order, refund_amount: result.refundAmount })}\n${escHtml(result.note || '')}`);
  }

  if (cmd === '/revenue' || cmd === '/arpu' || cmd === '/churn' || cmd === '/lifetime') {
    const metrics = await getFinanceMetrics(db);
    return sendTg(cid, renderFinanceReportText(metrics, cmd.slice(1)));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 績效統計
  // ═══════════════════════════════════════════════════════════════════════════

  if (cmd === '/perf') {
    const days = parseInt(args[0]) || 7;
    const since = new Date(Date.now() - days * 86400000);
    const sinceIso = since.toISOString().replace('T', ' ').slice(0, 19);

    const stats = await db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) as losses,
        SUM(pnl_points) as total_pnl,
        AVG(CASE WHEN result = 'win' THEN pnl_points END) as avg_win,
        AVG(CASE WHEN result = 'loss' THEN pnl_points END) as avg_loss
      FROM performance
      WHERE created_at > ?
    `).bind(sinceIso).first();

    const winRate = stats?.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(1) : '0';

    let m = `<b>績效統計</b> (${days}天)\n\n`;
    m += `期間：${fmtDateTime(sinceIso)} 至 ${fmtTime()}\n\n`;
    m += `📊 總交易：${stats?.total || 0} 筆\n`;
    m += `✅ 獲利：${stats?.wins || 0} 筆\n`;
    m += `❌ 虧損：${stats?.losses || 0} 筆\n`;
    m += `🎯 勝率：${winRate}%\n\n`;
    m += `💰 總盈虧：${(stats?.total_pnl || 0) >= 0 ? '+' : ''}${fmtPrice(stats?.total_pnl || 0)} 點\n`;
    m += `📈 平均獲利：+${fmtPrice(stats?.avg_win || 0)} 點\n`;
    m += `📉 平均虧損：${fmtPrice(stats?.avg_loss || 0)} 點`;

    return sendTg(cid, m);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 系統設定
  // ═══════════════════════════════════════════════════════════════════════════

  if (cmd === '/config') {
    const proPrice = await getConfig(db, 'pro_price_1m');
    const vipPrice = await getConfig(db, 'vip_price_1m');
    const trialDays = await getConfig(db, 'trial_days');
    const contact = await getConfig(db, 'contact_telegram');
    const paused = await getConfig(db, 'signals_paused');

    let m = `<b>系統設定</b>\n\n`;
    m += `<b>價格</b>\n`;
    m += `Pro月費：NT$${proPrice}\n`;
    m += `VIP月費：NT$${vipPrice}\n\n`;
    m += `<b>其他</b>\n`;
    m += `試用天數：${trialDays}\n`;
    m += `聯繫方式：${contact}\n`;
    m += `訊號狀態：${paused === '1' ? '已暫停' : '運行中'}\n\n`;
    m += `修改：/setprice /settrial /setcontact`;

    return sendTg(cid, m);
  }

  if (cmd === '/pause') {
    await setConfig(db, 'signals_paused', '1');
    await logAction(db, uid, 'pause', '', '');
    return sendTg(cid, `⏸️ 訊號已暫停`);
  }

  if (cmd === '/resume') {
    await setConfig(db, 'signals_paused', '0');
    await logAction(db, uid, 'resume', '', '');
    return sendTg(cid, `▶️ 訊號已恢復`);
  }

  // /help 管理員幫助
  if (cmd === '/help') {
    let m = `🔐 <b>管理員指令</b>\n\n`;
    m += `<b>發訊</b>\n`;
    m += `/long [品種] [進場] [止損] [TP1]...\n`;
    m += `/short [品種] [進場] [止損] [TP1]...\n`;
    m += `/scalp /swing [方向] [品種]...\n`;
    m += `/tp1 /tp2 /tp3 [品種] [價格]\n`;
    m += `/sl [品種] [價格]\n`;
    m += `/close [品種] [價格] [原因]\n\n`;
    m += `<b>廣播</b>\n`;
    m += `/bc /announce /update /alert /econpush\n\n`;
    m += `<b>管理</b>\n`;
    m += `/users /user /pro /vip /adddays\n`;
    m += `/tickets /reply /closeticket\n`;
    m += `/orders /confirm /reject /refund\n`;
    m += `/revenue /arpu /churn /lifetime\n`;
    m += `/dash /ops /perf /config`;

    return sendTg(cid, m);
  }

  return null;
}
// ═══════════════════════════════════════════════════════════════════════════════
// 管理員 Callback 處理
// ═══════════════════════════════════════════════════════════════════════════════

async function handleAdminCallback(cid, uid, msgId, data, env, cbId = null) {
  const db = env.DB;
  await answerCb(cbId);

  // 幫助提示
  if (data === 'a_help_long') {
    await answerCb(cbId, '');
    return sendTg(cid, `⬆️ <b>做多訊號</b>\n\n<code>/long NQ 21500 21480 21520 21540</code>\n\n參數：品種 進場 止損 TP1 [TP2] [TP3] [@群組]`);
  }

  if (data === 'a_help_short') {
    await answerCb(cbId, '');
    return sendTg(cid, `⬇️ <b>做空訊號</b>\n\n<code>/short ES 5820 5835 5810 5800</code>\n\n參數：品種 進場 止損 TP1 [TP2] [TP3] [@群組]`);
  }

  if (data === 'a_help_bc') {
    await answerCb(cbId, '');
    return sendTg(cid, `📢 <b>廣播</b>\n\n<code>/bc 訊息內容</code>\n<code>/bc @vip VIP專屬訊息</code>\n<code>/announce 重要公告</code>`);
  }

  if (data === 'a_help_alert') {
    await answerCb(cbId, '');
    return sendTg(cid, `⚠️ <b>警報</b>\n\n<code>/alert 今晚20:30 CPI數據</code>\n<code>/update 移動止損到21510</code>`);
  }

  // 頁面跳轉
  if (data === 'a_users') return handleAdminCommand(cid, uid, '/users', [], '', env);
  if (data === 'a_perf') return handleAdminCommand(cid, uid, '/perf', ['7'], '', env);
  if (data === 'a_orders') return handleAdminCommand(cid, uid, '/orders', [], '', env);
  if (data === 'a_tickets') return handleAdminCommand(cid, uid, '/tickets', [], '', env);
  if (data === 'a_ops') return handleAdminCommand(cid, uid, '/ops', [], '', env);
  if (data === 'a_config') return handleAdminCommand(cid, uid, '/config', [], '', env);

  // 用戶操作
  if (data.startsWith('adm_pro_')) {
    const userId = data.replace('adm_pro_', '');
    const expires = new Date(Date.now() + 30 * 86400000).toISOString();
    await updateUser(db, userId, { tier: 'pro', tier_expires_at: expires });
    await logAction(db, uid, 'set_pro', userId, '30 days');
    await sendMemberNotice(userId, `🎉 恭喜！您已升級為 ⭐ Pro會員\n天數：30天\n到期：${fmtDate(expires)}`, null, { db });
    await answerCb(cbId, '已設為Pro 30天');
    return;
  }

  if (data.startsWith('adm_vip_')) {
    const userId = data.replace('adm_vip_', '');
    const expires = new Date(Date.now() + 30 * 86400000).toISOString();
    await updateUser(db, userId, { tier: 'vip', tier_expires_at: expires });
    await logAction(db, uid, 'set_vip', userId, '30 days');
    await sendMemberNotice(userId, `🎉 恭喜！您已升級為 👑 VIP會員\n天數：30天\n到期：${fmtDate(expires)}`, null, { db });
    await answerCb(cbId, '已設為VIP 30天');
    return;
  }

  if (data.startsWith('adm_add7_')) {
    const userId = data.replace('adm_add7_', '');
    const user = await getUser(db, userId);
    let newExpiry;
    if (user.tier !== 'free' && user.tier_expires_at && new Date(user.tier_expires_at) > new Date()) {
      newExpiry = new Date(new Date(user.tier_expires_at).getTime() + 7 * 86400000);
    } else {
      newExpiry = new Date(Date.now() + 7 * 86400000);
    }
    await updateUser(db, userId, { tier_expires_at: newExpiry.toISOString() });
    await logAction(db, uid, 'adddays', userId, '7 days');
    await sendMemberNotice(userId, `🎉 您的會員已延長 7 天！\n新到期日：${fmtDate(newExpiry)}`, null, { db });
    await answerCb(cbId, '已延長7天');
    return;
  }

  if (data.startsWith('adm_add30_')) {
    const userId = data.replace('adm_add30_', '');
    const user = await getUser(db, userId);
    let newExpiry;
    if (user.tier !== 'free' && user.tier_expires_at && new Date(user.tier_expires_at) > new Date()) {
      newExpiry = new Date(new Date(user.tier_expires_at).getTime() + 30 * 86400000);
    } else {
      newExpiry = new Date(Date.now() + 30 * 86400000);
    }
    await updateUser(db, userId, { tier_expires_at: newExpiry.toISOString() });
    await logAction(db, uid, 'adddays', userId, '30 days');
    await sendMemberNotice(userId, `🎉 您的會員已延長 30 天！\n新到期日：${fmtDate(newExpiry)}`, null, { db });
    await answerCb(cbId, '已延長30天');
    return;
  }

  if (data.startsWith('adm_ban_')) {
    const userId = data.replace('adm_ban_', '');
    await updateUser(db, userId, { is_banned: 1 });
    await logAction(db, uid, 'ban', userId, '');
    await answerCb(cbId, '已封禁');
    return;
  }

  if (data.startsWith('adm_msg_')) {
    const userId = data.replace('adm_msg_', '');
    await answerCb(cbId, '');
    return sendTg(cid, `💬 發送私訊\n\n<code>/msg ${userId} 您的訊息內容</code>`);
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Web Admin
// ═══════════════════════════════════════════════════════════════════════════════

const ADMIN_CONFIG_KEYS = [
  'pro_price_1m', 'pro_price_3m', 'pro_price_12m',
  'vip_price_1m', 'vip_price_3m', 'vip_price_12m',
  'trial_days', 'trial_tier', 'signals_paused',
  'signal_min_probability',
  'contact_telegram', 'contact_line',
  'public_base_url',
  'payment_manual_enabled', 'payment_bank', 'payment_bank_branch', 'payment_account', 'payment_name', 'payment_transfer_note',
  'payment_crypto_enabled', 'payment_crypto_asset', 'payment_crypto_network', 'payment_crypto_wallet',
  'payment_crypto_memo', 'payment_crypto_rate_note', 'payment_crypto_note',
  'welcome_message',
  'econ_enabled', 'econ_reminder_lead', 'econ_currencies', 'econ_impacts',
  'auto_trade_enabled', 'auto_trade_mode', 'auto_trade_bridge_url', 'auto_trade_bridge_secret',
  'auto_trade_account', 'auto_trade_default_volume', 'auto_trade_risk_percent',
  'auto_trade_max_orders_per_day', 'auto_trade_allowed_symbols', 'auto_trade_allowed_strategies',
  'signal_proxy_rules',
  'economic_calendar_source_url', 'economic_calendar_source_name',
  'economic_calendar_impacts', 'economic_calendar_currencies', 'economic_calendar_countries',
  'economic_calendar_auto_remind', 'economic_calendar_remind_hour', 'economic_calendar_target_group',
  'economic_calendar_pre_event_minutes', 'economic_calendar_lookahead_days', 'economic_calendar_market_only'
];
const ADMIN_SESSION_COOKIE = 'dc_admin_session';
const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8;

const adminHtmlResponse = (body, status = 200, headers = {}) => new Response(body, {
  status,
  headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    ...headers
  }
});

function unauthorizedAdminResponse(message = '需要後台登入') {
  return adminHtmlResponse(renderAdminLoginPage(message, 'error'), 401, {
    'WWW-Authenticate': 'Basic realm="DC Signals Admin", charset="UTF-8"',
    'Cache-Control': 'no-store'
  });
}

function isAdminHttpRequest(request, env) {
  const password = env.ADMIN_WEB_PASSWORD;
  if (!password) return false;

  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Basic ')) return false;

  try {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(':');
    if (separator === -1) return false;

    const username = decoded.slice(0, separator);
    const provided = decoded.slice(separator + 1);
    const expectedUser = env.ADMIN_WEB_USER || 'admin';
    return username === expectedUser && provided === password;
  } catch {
    return false;
  }
}

function adminSessionSecret(env) {
  return sha256Bytes(`dc-admin-session:${env.ADMIN_WEB_PASSWORD || ''}:${env.BOT_TOKEN || ''}:${env.ADMIN_WEB_USER || 'admin'}`);
}

async function adminPasswordMatches(username, password, env) {
  const expectedUser = String(env.ADMIN_WEB_USER || 'admin');
  const expectedPassword = String(env.ADMIN_WEB_PASSWORD || '');
  const userOk = timingSafeEqual(await sha256Hex(String(username || '')), await sha256Hex(expectedUser));
  const passOk = timingSafeEqual(await sha256Hex(String(password || '')), await sha256Hex(expectedPassword));
  return userOk && passOk;
}

async function createAdminSessionToken(username, env) {
  const now = Math.floor(Date.now() / 1000);
  const csrf = genUID();
  const payload = {
    u: String(username || env.ADMIN_WEB_USER || 'admin'),
    iat: now,
    exp: now + ADMIN_SESSION_MAX_AGE,
    csrf,
    n: genUID()
  };
  const body = base64UrlEncode(JSON.stringify(payload));
  const mac = await hmacHex(await adminSessionSecret(env), body);
  return { token: `${body}.${mac}`, payload };
}

async function verifyAdminSession(request, env) {
  const token = readCookie(request, ADMIN_SESSION_COOKIE);
  if (!token || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const expectedMac = await hmacHex(await adminSessionSecret(env), body);
  if (!timingSafeEqual(mac, expectedMac)) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(body));
    if (!payload || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (String(payload.u || '') !== String(env.ADMIN_WEB_USER || 'admin')) return null;
    return payload;
  } catch {
    return null;
  }
}

function adminSessionCookie(token, request, maxAge = ADMIN_SESSION_MAX_AGE) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token || '')}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Priority=High${secure}`;
}

function clearAdminSessionCookie(request) {
  return adminSessionCookie('', request, 0);
}

async function requireAdminRequest(request, env, wantsJson = false) {
  if (!env.ADMIN_WEB_PASSWORD) {
    if (wantsJson) return json({ ok: false, error: 'ADMIN_WEB_PASSWORD secret is not configured' }, 503);
    return adminHtmlResponse(renderAdminLoginPage('ADMIN_WEB_PASSWORD 尚未設定，請先設定 Worker secret。', 'error'), 503);
  }
  const basicOk = isAdminHttpRequest(request, env);
  const session = basicOk ? { u: env.ADMIN_WEB_USER || 'admin', csrf: 'basic' } : await verifyAdminSession(request, env);
  if (!session) {
    if (wantsJson) return json({ ok: false, error: 'Unauthorized' }, 401);
    return adminHtmlResponse(renderAdminLoginPage(), 200, { 'Cache-Control': 'no-store' });
  }
  if (wantsJson && !basicOk && !['GET', 'HEAD'].includes(request.method)) {
    const csrf = request.headers.get('X-Admin-CSRF') || '';
    if (!session.csrf || !timingSafeEqual(csrf, session.csrf)) {
      return json({ ok: false, error: 'Invalid admin session token' }, 403);
    }
  }
  return null;
}

function requireAdminHttp(request, env, wantsJson = false) {
  if (!env.ADMIN_WEB_PASSWORD) {
    return json({ ok: false, error: 'ADMIN_WEB_PASSWORD secret is not configured' }, 503);
  }
  if (!isAdminHttpRequest(request, env)) {
    if (wantsJson) return json({ ok: false, error: 'Unauthorized' }, 401);
    return unauthorizedAdminResponse();
  }
  return null;
}

function requireCronHttp(request, env, url) {
  if (isAdminHttpRequest(request, env)) return null;
  const expected = String(env.CRON_SECRET || '').trim();
  if (!expected) return json({ ok: false, error: 'CRON_SECRET secret is not configured' }, 503);
  const provided = String(
    request.headers.get('X-Cron-Secret') ||
    request.headers.get('X-Webhook-Secret') ||
    url.searchParams.get('secret') ||
    ''
  ).trim();
  if (!timingSafeEqual(provided, expected)) return json({ ok: false, error: 'Unauthorized cron request' }, 401);
  return null;
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function appError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function cleanListValue(value) {
  if (Array.isArray(value)) {
    return JSON.stringify(value.map(String).map((v) => v.trim()).filter(Boolean));
  }
  if (!value) return '[]';
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return JSON.stringify(parsed.map(String).map((v) => v.trim()).filter(Boolean));
  } catch {}
  return JSON.stringify(String(value).split(',').map((v) => v.trim()).filter(Boolean));
}

function appendListItemValue(value, item) {
  const target = String(item || '').trim().toUpperCase();
  const list = parseList(value).map((v) => String(v || '').trim()).filter(Boolean);
  if (!target) return JSON.stringify(list);
  if (!list.some((v) => v.toUpperCase() === target)) list.push(target);
  return JSON.stringify(list);
}

function asNumber(value, fallback = null) {
  if (value === '' || value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function slugify(value, fallback = 'strategy') {
  const slug = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || `${fallback}-${Date.now().toString(36)}`;
}

async function addColumnIfMissing(db, table, column, definition) {
  const tableExists = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").bind(table).first();
  if (!tableExists) return;
  const info = await db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = (info.results || []).some((row) => row.name === column);
  if (!exists) await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
}

async function ensureRateLimitSchema(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rate_key TEXT UNIQUE NOT NULL,
      count INTEGER DEFAULT 0,
      reset_at_ms INTEGER NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON rate_limits(reset_at_ms)').run();
}

async function ensureAutoTradeSchema(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS auto_trade_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      command_id TEXT UNIQUE NOT NULL,
      signal_uid TEXT NOT NULL,
      ticker TEXT,
      action TEXT,
      broker TEXT DEFAULT 'exness-mt5',
      account TEXT,
      mode TEXT DEFAULT 'paper',
      volume REAL,
      risk_percent REAL,
      entry_price REAL,
      stop_loss REAL,
      tp1 REAL,
      tp2 REAL,
      tp3 REAL,
      status TEXT DEFAULT 'queued',
      attempts INTEGER DEFAULT 0,
      request_payload TEXT,
      response_payload TEXT,
      last_error TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      sent_at TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_auto_trade_signal ON auto_trade_orders(signal_uid)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_auto_trade_status ON auto_trade_orders(status, created_at)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_auto_trade_created ON auto_trade_orders(created_at)').run();
}

function autoTradeMode(value) {
  const mode = String(value || 'paper').trim().toLowerCase();
  return ['paper', 'live'].includes(mode) ? mode : 'paper';
}

async function getAutoTradeConfig(db, env = {}) {
  const enabledRaw = String(env.AUTO_TRADE_ENABLED || await getConfig(db, 'auto_trade_enabled') || '0');
  const mode = autoTradeMode(env.AUTO_TRADE_MODE || await getConfig(db, 'auto_trade_mode') || 'paper');
  const bridgeUrl = cleanUrl(env.AUTO_TRADE_BRIDGE_URL || await getConfig(db, 'auto_trade_bridge_url') || '');
  const bridgeSecret = String(env.AUTO_TRADE_BRIDGE_SECRET || await getConfig(db, 'auto_trade_bridge_secret') || '').trim();
  const defaultVolume = asNumber(env.AUTO_TRADE_DEFAULT_VOLUME || await getConfig(db, 'auto_trade_default_volume'), 0.01);
  const riskPercent = asNumber(env.AUTO_TRADE_RISK_PERCENT || await getConfig(db, 'auto_trade_risk_percent'), 1);
  const maxDailyOrders = Math.max(1, Number(env.AUTO_TRADE_MAX_ORDERS_PER_DAY || await getConfig(db, 'auto_trade_max_orders_per_day') || 20));
  const allowedSymbols = parseList(env.AUTO_TRADE_ALLOWED_SYMBOLS || await getConfig(db, 'auto_trade_allowed_symbols') || '')
    .map((symbol) => String(symbol || '').trim().toUpperCase())
    .filter(Boolean);
  const allowedStrategies = parseList(env.AUTO_TRADE_ALLOWED_STRATEGIES || await getConfig(db, 'auto_trade_allowed_strategies') || '')
    .map((strategy) => slugify(strategy, 'strategy'))
    .filter(Boolean);
  return {
    enabled: enabledRaw === '1' || enabledRaw === 'true',
    mode,
    broker: 'exness-mt5',
    bridgeUrl,
    bridgeSecret,
    account: String(env.AUTO_TRADE_ACCOUNT || await getConfig(db, 'auto_trade_account') || '').trim(),
    defaultVolume: Number.isFinite(defaultVolume) && defaultVolume > 0 ? defaultVolume : 0.01,
    riskPercent: Number.isFinite(riskPercent) && riskPercent > 0 ? riskPercent : 1,
    maxDailyOrders,
    allowedSymbols,
    allowedStrategies
  };
}

function publicAutoTradeConfig(config = {}) {
  return {
    enabled: !!config.enabled,
    mode: config.mode || 'paper',
    broker: config.broker || 'exness-mt5',
    bridgeConfigured: !!(config.bridgeUrl || config.bridgeSecret),
    bridgeMode: config.bridgeUrl ? 'push-webhook' : 'mt5-poll',
    account: config.account || '',
    defaultVolume: config.defaultVolume || 0.01,
    riskPercent: config.riskPercent || 1,
    maxDailyOrders: config.maxDailyOrders || 20,
    allowedSymbols: config.allowedSymbols || [],
    allowedStrategies: config.allowedStrategies || []
  };
}

function autoTradeSide(action) {
  return action === 'LONG' ? 'buy' : 'sell';
}

function autoTradeBrokerSymbol(ticker) {
  const symbol = String(ticker || '').trim().toUpperCase();
  const map = {
    ETH: 'ETHUSD',
    BTC: 'BTCUSD'
  };
  return map[symbol] || symbol;
}

function autoTradeCommandPayload(signal, config = {}, options = {}) {
  const targets = [signal.tp1, signal.tp2, signal.tp3].filter((value) => value !== null && value !== undefined && value !== '');
  const brokerSymbol = autoTradeBrokerSymbol(signal.ticker);
  return {
    command_id: options.commandId,
    command: 'open_signal',
    broker: config.broker || 'exness-mt5',
    mode: config.mode || 'paper',
    account: config.account || '',
    signal_uid: signal.signal_uid,
    ticker: signal.ticker,
    symbol: signal.ticker,
    broker_symbol: brokerSymbol,
    side: autoTradeSide(signal.action),
    order_type: 'market',
    volume: config.defaultVolume || 0.01,
    risk_percent: config.riskPercent || 1,
    entry_price: Number(signal.entry_price),
    stop_loss: Number(signal.stop_loss),
    take_profit: targets.map(Number),
    tp1: signal.tp1 == null ? null : Number(signal.tp1),
    tp2: signal.tp2 == null ? null : Number(signal.tp2),
    tp3: signal.tp3 == null ? null : Number(signal.tp3),
    strategy_id: signal.strategy_id || '',
    source: signal.source || '',
    target_group: signal.target_group || '',
    replace_previous: true,
    closed_signal_uids: (options.autoClosed || []).map((row) => row.signalUid).filter(Boolean),
    created_at: signal.created_at || fmtTime(),
    requested_at: new Date().toISOString()
  };
}

async function autoTradeHeaders(config, body) {
  const headers = { 'Content-Type': 'application/json', 'User-Agent': 'DC-Signals-AutoTrade/1.0' };
  if (config.bridgeSecret) {
    const timestamp = new Date().toISOString();
    headers['X-DC-Timestamp'] = timestamp;
    headers['X-DC-Signature'] = await hmacHex(textBytes(config.bridgeSecret), `${timestamp}.${body}`);
  }
  return headers;
}

async function createAutoTradeOrder(db, signal, config, status, payload, error = '') {
  await ensureAutoTradeSchema(db);
  const commandId = payload.command_id || `AT${genUID()}`;
  await db.prepare(`
    INSERT INTO auto_trade_orders (
      command_id, signal_uid, ticker, action, broker, account, mode, volume, risk_percent,
      entry_price, stop_loss, tp1, tp2, tp3, status, request_payload, last_error, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(command_id) DO UPDATE SET
      status = excluded.status,
      request_payload = excluded.request_payload,
      last_error = excluded.last_error,
      updated_at = datetime('now')
  `).bind(
    commandId,
    signal.signal_uid,
    signal.ticker,
    signal.action,
    config.broker || 'exness-mt5',
    config.account || null,
    config.mode || 'paper',
    config.defaultVolume || 0.01,
    config.riskPercent || 1,
    Number(signal.entry_price),
    Number(signal.stop_loss),
    signal.tp1 == null ? null : Number(signal.tp1),
    signal.tp2 == null ? null : Number(signal.tp2),
    signal.tp3 == null ? null : Number(signal.tp3),
    status,
    JSON.stringify(payload),
    error || null
  ).run();
  return commandId;
}

async function dispatchAutoTradeForSignal(env = {}, signalUid, options = {}) {
  const db = env.DB;
  if (!db || !signalUid) return { status: AUTO_TRADE_STATUS.skipped, reason: 'missing_signal' };
  await ensureAutoTradeSchema(db);
  const config = await getAutoTradeConfig(db, env);
  const signal = typeof signalUid === 'object'
    ? signalUid
    : await db.prepare('SELECT * FROM signals WHERE signal_uid = ?').bind(signalUid).first();
  if (!signal) return { status: AUTO_TRADE_STATUS.skipped, reason: 'signal_not_found' };

  const commandId = `AT${genUID()}`;
  const payload = autoTradeCommandPayload(signal, config, { ...options, commandId });
  if (!config.enabled) {
    await createAutoTradeOrder(db, signal, config, AUTO_TRADE_STATUS.disabled, payload, '自動交易未啟用');
    return { status: AUTO_TRADE_STATUS.disabled, commandId };
  }
  if (config.allowedSymbols.length && !config.allowedSymbols.includes(String(signal.ticker || '').toUpperCase())) {
    await createAutoTradeOrder(db, signal, config, AUTO_TRADE_STATUS.skipped, payload, `${signal.ticker} 不在自動交易允許品種`);
    return { status: AUTO_TRADE_STATUS.skipped, commandId, reason: 'symbol_not_allowed' };
  }
  const signalStrategy = slugify(signal.strategy_id || signal.strategyId || '', 'strategy');
  if (config.allowedStrategies.length && !config.allowedStrategies.includes(signalStrategy)) {
    await createAutoTradeOrder(db, signal, config, AUTO_TRADE_STATUS.skipped, payload, `${signal.strategy_id || '未指定策略'} 不在自動交易允許策略`);
    return { status: AUTO_TRADE_STATUS.skipped, commandId, reason: 'strategy_not_allowed' };
  }
  const todayCount = await db.prepare(`
    SELECT COUNT(*) AS c
    FROM auto_trade_orders
    WHERE DATE(created_at) = DATE('now') AND status IN ('sent','acked')
  `).first();
  if (Number(todayCount?.c || 0) >= config.maxDailyOrders) {
    await createAutoTradeOrder(db, signal, config, AUTO_TRADE_STATUS.skipped, payload, '已達今日自動交易上限');
    return { status: AUTO_TRADE_STATUS.skipped, commandId, reason: 'daily_limit' };
  }

  await createAutoTradeOrder(db, signal, config, AUTO_TRADE_STATUS.queued, payload);
  if (!config.bridgeUrl) {
    await logAction(db, 'auto-trade', 'auto_trade_queued_for_mt5_poll', signal.signal_uid, `${signal.ticker} ${signal.action}`);
    return { status: AUTO_TRADE_STATUS.queued, commandId, bridgeMode: 'mt5-poll' };
  }
  const body = JSON.stringify(payload);
  try {
    const res = await fetch(config.bridgeUrl, {
      method: 'POST',
      headers: await autoTradeHeaders(config, body),
      body
    });
    const responseText = await res.text().catch(() => '');
    const status = res.ok ? AUTO_TRADE_STATUS.sent : AUTO_TRADE_STATUS.failed;
    await db.prepare(`
      UPDATE auto_trade_orders
      SET status = ?,
          attempts = attempts + 1,
          response_payload = ?,
          last_error = ?,
          sent_at = CASE WHEN ? THEN datetime('now') ELSE sent_at END,
          updated_at = datetime('now')
      WHERE command_id = ?
    `).bind(status, responseText.slice(0, 4000), res.ok ? null : `Bridge HTTP ${res.status}`, res.ok ? 1 : 0, commandId).run();
    await logAction(db, 'auto-trade', res.ok ? 'auto_trade_sent' : 'auto_trade_failed', signal.signal_uid, `${signal.ticker} ${signal.action} ${res.status}`);
    return { status, commandId, httpStatus: res.status };
  } catch (e) {
    await db.prepare(`
      UPDATE auto_trade_orders
      SET status = 'failed',
          attempts = attempts + 1,
          last_error = ?,
          updated_at = datetime('now')
      WHERE command_id = ?
    `).bind(e.message, commandId).run();
    await logAction(db, 'auto-trade', 'auto_trade_failed', signal.signal_uid, e.message);
    return { status: AUTO_TRADE_STATUS.failed, commandId, error: e.message };
  }
}

async function getAutoTradeDashboard(db, env = {}, range = null) {
  await ensureAutoTradeSchema(db);
  const config = await getAutoTradeConfig(db, env);
  const orderWhere = adminDateWhere('created_at', range || { all: true });
  const [summary, recent] = await Promise.all([
    db.prepare(`
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN status IN ('sent','acked') THEN 1 ELSE 0 END) AS sent,
             SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
             SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) AS queued,
             SUM(CASE WHEN status IN ('disabled','skipped') THEN 1 ELSE 0 END) AS skipped,
             MAX(created_at) AS latest_at
      FROM auto_trade_orders
      ${orderWhere.clause}
    `).bind(...orderWhere.binds).first(),
    db.prepare(`
      SELECT *
      FROM auto_trade_orders
      ${orderWhere.clause}
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(...orderWhere.binds, Math.min(Number(range?.limit || 80), 120)).all()
  ]);
  return {
    config: publicAutoTradeConfig(config),
    summary: {
      total: Number(summary?.total || 0),
      sent: Number(summary?.sent || 0),
      failed: Number(summary?.failed || 0),
      queued: Number(summary?.queued || 0),
      skipped: Number(summary?.skipped || 0),
      latestAt: summary?.latest_at || null
    },
    recent: recent.results || []
  };
}

async function verifyAutoTradeBridgeRequest(db, env, rawBody, request) {
  const config = await getAutoTradeConfig(db, env);
  if (!config.bridgeSecret) throw appError('AUTO_TRADE_BRIDGE_SECRET 尚未設定', 503);
  const directSecret = String(request.headers.get('X-Bridge-Secret') || request.headers.get('X-DC-Bridge-Secret') || '').trim();
  if (directSecret && timingSafeEqual(directSecret, config.bridgeSecret)) return config;
  const timestamp = String(request.headers.get('X-DC-Timestamp') || '').trim();
  const signature = String(request.headers.get('X-DC-Signature') || '').trim();
  if (!timestamp || !signature) throw appError('Auto trade bridge signature missing', 401);
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime()) || Math.abs(Date.now() - parsed.getTime()) > 5 * 60 * 1000) {
    throw appError('Auto trade bridge signature expired', 401);
  }
  const expected = await hmacHex(textBytes(config.bridgeSecret), `${timestamp}.${rawBody}`);
  if (!timingSafeEqual(signature, expected)) throw appError('Auto trade bridge signature invalid', 401);
  return config;
}

async function handleAutoTradeBridgePoll(request, env) {
  const db = env.DB;
  await ensureAutoTradeSchema(db);
  try {
    const rawBody = request.method === 'POST' ? await request.text() : '';
    const config = await verifyAutoTradeBridgeRequest(db, env, rawBody, request);
    if (!config.enabled) return json({ ok: true, data: { disabled: true, orders: [] } });
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(5, Number(url.searchParams.get('limit') || 1)));
    const rows = await db.prepare(`
      SELECT *
      FROM auto_trade_orders
      WHERE status = 'queued'
      ORDER BY created_at ASC
      LIMIT ?
    `).bind(limit).all();
    const orders = [];
    for (const row of rows.results || []) {
      let payload = {};
      try {
        payload = JSON.parse(row.request_payload || '{}');
      } catch {
        payload = {};
      }
      payload.command_id = payload.command_id || row.command_id;
      payload.signal_uid = payload.signal_uid || row.signal_uid;
      payload.ticker = payload.ticker || row.ticker;
      payload.symbol = payload.symbol || row.ticker;
      payload.broker_symbol = payload.broker_symbol || autoTradeBrokerSymbol(row.ticker);
      payload.side = payload.side || autoTradeSide(row.action);
      payload.mode = payload.mode || row.mode || config.mode;
      payload.volume = payload.volume || row.volume || config.defaultVolume;
      orders.push(payload);
      await db.prepare(`
        UPDATE auto_trade_orders
        SET status = 'sent',
            attempts = attempts + 1,
            sent_at = COALESCE(sent_at, datetime('now')),
            updated_at = datetime('now')
        WHERE command_id = ?
      `).bind(row.command_id).run();
    }
    return json({ ok: true, data: { orders, count: orders.length, mode: config.mode, broker: config.broker } });
  } catch (e) {
    return json({ ok: false, error: e.message }, e.status || 400);
  }
}

async function handleAutoTradeBridgeAck(request, env) {
  const db = env.DB;
  await ensureAutoTradeSchema(db);
  try {
    const rawBody = await request.text();
    await verifyAutoTradeBridgeRequest(db, env, rawBody, request);
    const payload = rawBody ? JSON.parse(rawBody) : {};
    const commandId = String(payload.command_id || payload.commandId || '').trim();
    if (!commandId) throw appError('command_id is required', 400);
    const status = String(payload.status || (payload.ok === false ? 'failed' : 'acked')).toLowerCase();
    const normalized = ['acked', 'failed', 'sent'].includes(status) ? status : 'acked';
    const error = String(payload.error || payload.message || '').slice(0, 1000);
    const result = await db.prepare(`
      UPDATE auto_trade_orders
      SET status = ?,
          response_payload = ?,
          last_error = ?,
          updated_at = datetime('now')
      WHERE command_id = ?
    `).bind(normalized, JSON.stringify(payload).slice(0, 4000), normalized === 'failed' ? error || 'bridge reported failed' : null, commandId).run();
    await logAction(db, 'auto-trade-bridge', 'auto_trade_ack', commandId, normalized);
    return json({ ok: true, data: { commandId, status: normalized, updated: result?.meta?.changes || 0 } });
  } catch (e) {
    return json({ ok: false, error: e.message }, e.status || 400);
  }
}

function requestClientIp(request) {
  const cf = String(request.headers.get('cf-connecting-ip') || '').trim();
  if (cf) return cf;
  const forwarded = String(request.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  if (forwarded) return forwarded;
  return String(request.headers.get('x-real-ip') || '').trim() || 'unknown';
}

async function rateKey(parts) {
  const raw = parts.map((part) => String(part || '')).join(':');
  return `${parts[0]}:${(await sha256Hex(raw)).slice(0, 32)}`;
}

async function enforceRateLimit(db, key, limit, windowSeconds, message) {
  await ensureRateLimitSchema(db);
  const now = Date.now();
  const resetAt = now + Number(windowSeconds || 60) * 1000;
  const row = await db.prepare('SELECT count, reset_at_ms FROM rate_limits WHERE rate_key = ?').bind(key).first();
  if (!row || Number(row.reset_at_ms || 0) <= now) {
    await db.prepare(`
      INSERT INTO rate_limits (rate_key, count, reset_at_ms, updated_at)
      VALUES (?, 1, ?, datetime('now'))
      ON CONFLICT(rate_key) DO UPDATE SET count = 1, reset_at_ms = excluded.reset_at_ms, updated_at = datetime('now')
    `).bind(key, resetAt).run();
    return { allowed: true, remaining: Math.max(0, limit - 1), resetAt };
  }
  const current = Number(row.count || 0);
  if (current >= limit) {
    const retrySeconds = Math.max(1, Math.ceil((Number(row.reset_at_ms) - now) / 1000));
    throw appError(`${message}（約 ${Math.ceil(retrySeconds / 60)} 分鐘後再試）`, 429);
  }
  await db.prepare('UPDATE rate_limits SET count = count + 1, updated_at = datetime("now") WHERE rate_key = ?').bind(key).run();
  return { allowed: true, remaining: Math.max(0, limit - current - 1), resetAt: row.reset_at_ms };
}

async function ensureAdminSchema(db) {
  await ensureConfigSchema(db);
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS admin_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id TEXT,
      action TEXT,
      target TEXT,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_logs(action)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at)').run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS queued_signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      signal_uid TEXT,
      message TEXT,
      photo_url TEXT,
      scheduled_at TEXT DEFAULT (datetime('now')),
      sent INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_queued_signals_due ON queued_signals(sent, scheduled_at)').run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS signal_proxy_calibrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_symbol TEXT NOT NULL,
      target_symbol TEXT NOT NULL,
      mode TEXT DEFAULT 'weekly_offset',
      source_price REAL,
      target_price REAL,
      beta REAL DEFAULT 1,
      offset REAL,
      status TEXT DEFAULT 'pending',
      captured_source_at TEXT,
      captured_target_at TEXT,
      valid_from TEXT,
      valid_until TEXT,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_proxy_cal_pair ON signal_proxy_calibrations(source_symbol, target_symbol, status, created_at)').run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS strategies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      strategy_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      signal_types TEXT DEFAULT '["scalp"]',
      symbols TEXT DEFAULT '[]',
      tier TEXT DEFAULT 'pro' CHECK(tier IN ('free', 'pro', 'vip')),
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      rules_json TEXT DEFAULT '{"riskPoints":30,"targetR":[1,2,3],"entryMode":"close"}',
      tv_alert_template TEXT,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
  await addColumnIfMissing(db, 'strategies', 'rules_json', `TEXT DEFAULT '{"riskPoints":30,"targetR":[1,2,3],"entryMode":"close"}'`);
  await addColumnIfMissing(db, 'strategies', 'tv_alert_template', 'TEXT');
  await addColumnIfMissing(db, 'signals', 'source', 'TEXT');
  await addColumnIfMissing(db, 'signals', 'strategy_id', 'TEXT');
  await addColumnIfMissing(db, 'signals', 'tv_alert_uid', 'TEXT');
  await addColumnIfMissing(db, 'signals', 'chart_url', 'TEXT');
  await addColumnIfMissing(db, 'signals', 'snapshot_url', 'TEXT');
  await addColumnIfMissing(db, 'signals', 'probability', 'REAL');
  // 部分止盈狀態：0=未命中、1=TP1 已命中(保本)、2=TP2 已命中
  await addColumnIfMissing(db, 'signals', 'tp_hit_level', 'INTEGER DEFAULT 0');
  await ensureSignalLifecycleSchema(db);
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_strategies_active ON strategies(is_active)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_strategies_tier ON strategies(tier)').run();
  // 品種預設止損 / 止盈點位（當 TradingView 沒帶指標點位時使用）
  const symbolDefaultsExisted = (await db.prepare("PRAGMA table_info(symbols)").all()).results?.some((row) => row.name === 'default_stop_points');
  await addColumnIfMissing(db, 'symbols', 'default_stop_points', 'REAL');
  await addColumnIfMissing(db, 'symbols', 'default_tp_spacing', 'REAL');
  // 推算模式：auto（有固定點位用固定，否則 R 倍數）/ fixed（固定點位）/ rmultiple（riskPoints × targetR）
  await addColumnIfMissing(db, 'symbols', 'default_level_mode', "TEXT DEFAULT 'auto'");
  if (!symbolDefaultsExisted) {
    // 首次建立欄位時，帶入黃金品種預設（止損 20、TP 間隔 12）
    await db.prepare("UPDATE symbols SET default_stop_points = 20, default_tp_spacing = 12 WHERE symbol IN ('XAUUSD','GC') AND (default_stop_points IS NULL OR default_stop_points = 0)").run();
  }
  await db.prepare(`
    INSERT OR IGNORE INTO strategies (strategy_id, name, description, signal_types, symbols, tier, sort_order, rules_json, tv_alert_template) VALUES
    ('scalp-core', '短線核心策略', '盤中短線訊號，重視進出場速度與風險控制。', '["scalp"]', '["NQ","ES","GC","USTEC","XAUUSD","ETH"]', 'pro', 1, '{"riskPoints":30,"targetR":[1,2,3],"entryMode":"close","timeframes":["1","3","5","15"]}', '{"strategy":"scalp-core","ticker":"{{ticker}}","action":"{{strategy.order.action}}","price":"{{close}}","time":"{{time}}","interval":"{{interval}}"}'),
    ('algo-pro-v1-4', 'AlgoPro V1.4', '串接 TradingView 既有 AlgoPro 指標，使用 Data Window plot 回傳實際 SL/TP。', '["scalp","daytrade"]', '["USTEC","XAUUSD","NQ","GC","ETH"]', 'pro', 2, '{"riskPoints":30,"targetR":[1,2,3],"entryMode":"tradingview","levelSource":"smart-directional-plot","requiresExplicitLevels":false,"fallbackEnabled":true,"fallbackPolicy":"indicator-first-symbol-strategy","timeframes":["1","3","5","15"]}', '{"secret":"{{secret}}","source_id":"{{source_id}}","strategy":"{{strategy_id}}","event":"entry","ticker":"{{ticker}}","exchange":"{{exchange}}","action":"{{strategy.order.action}}","order_id":"{{strategy.order.id}}","order_comment":"{{strategy.order.comment}}","entry_price":"{{strategy.order.price}}","order_price":"{{strategy.order.price}}","price":"{{strategy.order.price}}","close":"{{close}}","long_stop_loss":"{{plot_5}}","short_stop_loss":"{{plot_6}}","long_tp1":"{{plot_7}}","short_tp1":"{{plot_8}}","probability":"{{plot_9}}","p0":"{{plot_0}}","p1":"{{plot_1}}","p2":"{{plot_2}}","p3":"{{plot_3}}","p4":"{{plot_4}}","p5":"{{plot_5}}","p6":"{{plot_6}}","p7":"{{plot_7}}","p8":"{{plot_8}}","p9":"{{plot_9}}","p10":"{{plot_10}}","p11":"{{plot_11}}","p12":"{{plot_12}}","p13":"{{plot_13}}","p14":"{{plot_14}}","p15":"{{plot_15}}","p16":"{{plot_16}}","p17":"{{plot_17}}","contracts":"{{strategy.order.contracts}}","market_position":"{{strategy.market_position}}","prev_market_position":"{{strategy.prev_market_position}}","time":"{{time}}","interval":"{{interval}}","alert_id":"{{ticker}}-{{time}}-{{strategy_id}}-{{strategy.order.id}}-{{strategy.order.comment}}","mapping_note":"AlgoPro V1.4 TradingView Add placeholder order: plot_5 Long SL, plot_6 Short SL, plot_7 Long TP, plot_8 Short TP, plot_9 probability. Backend uses indicator levels first and fills missing SL/TP by symbol strategy fallback."}'),
    ('swing-trend', '波段趨勢策略', '順勢波段訊號，適合可持倉數小時到數天的會員。', '["swing"]', '["NQ","ES","GC","CL","USTEC","XAUUSD","ETH"]', 'pro', 2, '{"riskPoints":75,"targetR":[1,2,3],"entryMode":"close","timeframes":["60","120","240","D"]}', '{"strategy":"swing-trend","ticker":"{{ticker}}","action":"{{strategy.order.action}}","price":"{{close}}","time":"{{time}}","interval":"{{interval}}"}'),
    ('vip-momentum', 'VIP 動能策略', '高動能與關鍵行情提醒，含第三止盈目標。', '["scalp","daytrade"]', '["NQ","GC","CL","USTEC","XAUUSD","ETH"]', 'vip', 3, '{"riskPoints":45,"targetR":[1,2,3.5],"entryMode":"close","timeframes":["5","15","30","60"]}', '{"strategy":"vip-momentum","ticker":"{{ticker}}","action":"{{strategy.order.action}}","price":"{{close}}","time":"{{time}}","interval":"{{interval}}"}'),
    ('bb-squeeze-breakout', 'BB Squeeze 突破共振', '串接 TradingView BB Squeeze 突破共振系統；目前需 Pine 補 TP hidden plot 才能正式發送。', '["scalp","daytrade"]', '["USTEC","XAUUSD","NQ","GC","ETH"]', 'pro', 4, '{"riskPoints":30,"targetR":[1,2,3],"entryMode":"tradingview","levelSource":"plot","requiresExplicitLevels":true,"needsTpPlots":true}', '{"strategy":"bb-squeeze-breakout","ticker":"{{ticker}}","action":"{{strategy.order.action}}","entry_price":"{{close}}","stop_loss":"{{plot_6_or_7}}","tp1":"ADD_TP1_PLOT_TO_PINE","tp2":"ADD_TP2_PLOT_TO_PINE","tp3":"ADD_TP3_PLOT_TO_PINE","time":"{{time}}","interval":"{{interval}}"}'),
    ('ict-silver-bullet-2026', 'ICT Silver Bullet 2026', '串接 TradingView ICT Advanced Silver Bullet；需 alert_message 或 hidden plot 回傳 SL/TP。', '["scalp","daytrade"]', '["XAUUSD","GC","USTEC","NQ","ETH"]', 'pro', 5, '{"riskPoints":30,"targetR":[1,2,3],"entryMode":"tradingview","levelSource":"alert_message","requiresExplicitLevels":true,"needsAlertMessage":true}', '{"strategy":"ict-silver-bullet-2026","ticker":"{{ticker}}","action":"{{strategy.order.action}}","entry_price":"{{strategy.order.price}}","stop_loss":"ADD_SL_TO_PINE_ALERT","tp1":"ADD_TP1_TO_PINE_ALERT","tp2":"ADD_TP2_TO_PINE_ALERT","tp3":"ADD_TP3_TO_PINE_ALERT","time":"{{time}}","interval":"{{interval}}"}')
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS tradingview_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      webhook_secret TEXT NOT NULL,
      default_strategy_id TEXT,
      allowed_symbols TEXT DEFAULT '[]',
      default_signal_type TEXT DEFAULT 'auto',
      target_group TEXT DEFAULT 'pro',
      auto_send INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS tv_alert_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_uid TEXT NOT NULL,
      source_id TEXT NOT NULL,
      strategy_id TEXT,
      ticker TEXT,
      action TEXT,
      payload TEXT,
      signal_uid TEXT,
      status TEXT DEFAULT 'received',
      error TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(source_id, alert_uid)
    )
  `).run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_tv_sources_active ON tradingview_sources(is_active)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_tv_logs_source ON tv_alert_logs(source_id)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_tv_logs_created ON tv_alert_logs(created_at)').run();
  const sourceCount = await db.prepare('SELECT COUNT(*) as c FROM tradingview_sources').first();
  if (!sourceCount?.c) {
    await db.prepare(`
      INSERT INTO tradingview_sources (source_id, name, webhook_secret, default_strategy_id, allowed_symbols, default_signal_type, target_group, auto_send, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind('default-tv', 'Default TradingView', genUID(), 'scalp-core', '["NQ","ES","GC","CL","USTEC","XAUUSD","ETH"]', 'auto', 'pro', 1, '預設來源，抓到進場位即自動發送訊號。可在後台改回草稿模式。').run();
  }
  // 一次性遷移：把既有來源改為自動發送（抓到進場位即推播）
  const autoSendMigrated = await getConfig(db, 'tv_autosend_migrated');
  if (autoSendMigrated !== '1') {
    await db.prepare('UPDATE tradingview_sources SET auto_send = 1 WHERE auto_send = 0').run();
    await setConfig(db, 'tv_autosend_migrated', '1');
  }
  await db.prepare(`
    INSERT OR IGNORE INTO symbols (symbol, name, name_zh, category, tick_size, tick_value, is_active, sort_order)
    VALUES ('ETH', 'Ethereum CFD', '以太坊', 'crypto', 0.01, 1, 1, 41)
  `).run();
  const strategyRows = await db.prepare('SELECT strategy_id, symbols FROM strategies').all();
  for (const row of strategyRows.results || []) {
    if (!parseList(row.symbols).length) continue;
    const nextSymbols = appendListItemValue(row.symbols, 'ETH');
    if (nextSymbols !== cleanListValue(row.symbols)) {
      await db.prepare('UPDATE strategies SET symbols = ?, updated_at = datetime("now") WHERE strategy_id = ?').bind(nextSymbols, row.strategy_id).run();
    }
  }
  const sourceRows = await db.prepare('SELECT source_id, allowed_symbols FROM tradingview_sources').all();
  for (const row of sourceRows.results || []) {
    if (!parseList(row.allowed_symbols).length) continue;
    const nextSymbols = appendListItemValue(row.allowed_symbols, 'ETH');
    if (nextSymbols !== cleanListValue(row.allowed_symbols)) {
      await db.prepare('UPDATE tradingview_sources SET allowed_symbols = ?, updated_at = datetime("now") WHERE source_id = ?').bind(nextSymbols, row.source_id).run();
    }
  }
  await db.prepare(`
    UPDATE strategies
    SET tv_alert_template = ?,
        rules_json = ?,
        updated_at = datetime('now')
    WHERE strategy_id = 'algo-pro-v1-4'
      AND (
        tv_alert_template IS NULL
        OR tv_alert_template LIKE '%_or_%'
        OR tv_alert_template NOT LIKE '%long_stop_loss%'
        OR tv_alert_template NOT LIKE '%"p17"%'
        OR tv_alert_template LIKE '%plot("Probability")%'
        OR tv_alert_template LIKE '%plot(\\"Probability\\")%'
        OR (tv_alert_template NOT LIKE '%probability%' AND tv_alert_template LIKE '%plot_10%' AND tv_alert_template LIKE '%plot_17%')
        OR tv_alert_template LIKE '%plot("Long SL")%'
        OR rules_json LIKE '%"requiresExplicitLevels":true%'
        OR rules_json NOT LIKE '%smart-directional-plot%'
      )
  `).bind(algoProSmartTvTemplateString(), algoProSmartRulesString()).run();
  await db.prepare(`
    UPDATE strategies
    SET tv_alert_template = ?,
        rules_json = ?,
        updated_at = datetime('now')
    WHERE strategy_id = 'algo-pro-v1-4'
      AND tv_alert_template LIKE '%chart_url%'
  `).bind(algoProSmartTvTemplateString(), algoProSmartRulesString()).run();
  await ensureEconomicEventsSchema(db);
  await ensureAutoTradeSchema(db);
}

function hoursSinceDbTime(value) {
  const parsed = parseDbTime(value);
  if (!parsed) return null;
  return Math.max(0, Math.round((Date.now() - parsed.getTime()) / 36e5));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 經濟事件 / 財經日曆（真實來源：Forex Factory 每週 JSON）
// ═══════════════════════════════════════════════════════════════════════════════
const ECON_DEFAULT_SOURCE = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

async function ensureEconomicSchema(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS economic_events (
      event_uid TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      country TEXT,
      impact TEXT,
      forecast TEXT,
      previous TEXT,
      actual TEXT,
      event_at TEXT NOT NULL,
      reminded INTEGER DEFAULT 0,
      analyzed INTEGER DEFAULT 0,
      source TEXT DEFAULT 'forexfactory',
      synced_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
  const analyzedExisted = (await db.prepare("PRAGMA table_info(economic_events)").all()).results?.some((row) => row.name === 'analyzed');
  await addColumnIfMissing(db, 'economic_events', 'analyzed', 'INTEGER DEFAULT 0');
  if (!analyzedExisted) {
    // 首次建立欄位時，把「已公布」的歷史事件標記為已解讀，避免上線時對 VIP 回補大量舊事件
    await db.prepare("UPDATE economic_events SET analyzed = 1 WHERE actual IS NOT NULL AND actual != ''").run();
  }
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_econ_event_at ON economic_events(event_at)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_econ_reminded ON economic_events(reminded, event_at)').run();
}

function normalizeLegacyEconomicImpact(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v.startsWith('high')) return 'High';
  if (v.startsWith('med')) return 'Medium';
  if (v.startsWith('low')) return 'Low';
  if (v.includes('holiday')) return 'Holiday';
  return 'Low';
}

function econImpactLabel(impact) {
  return { High: '🔴 高影響', Medium: '🟠 中影響', Low: '🟡 低影響', Holiday: '⚪ 休市' }[impact] || impact || '-';
}

function econCurrencyFlag(country) {
  const map = { USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', CNY: '🇨🇳', AUD: '🇦🇺', CAD: '🇨🇦', CHF: '🇨🇭', NZD: '🇳🇿' };
  return map[String(country || '').toUpperCase()] || '🌐';
}

function normalizeEconomicEvent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = String(raw.title || raw.event || '').trim();
  const country = String(raw.country || raw.currency || '').trim().toUpperCase();
  const dateRaw = raw.date || raw.dateline || raw.timestamp;
  if (!title || !dateRaw) return null;
  const parsed = new Date(dateRaw);
  if (Number.isNaN(parsed.getTime())) return null;
  const eventAt = parsed.toISOString();
  const impact = normalizeLegacyEconomicImpact(raw.impact);
  const forecast = raw.forecast == null ? '' : String(raw.forecast);
  const previous = raw.previous == null ? '' : String(raw.previous);
  const actual = raw.actual == null ? '' : String(raw.actual);
  // 以標題 + 幣別 + 時間組成穩定 uid
  const uid = `${country}|${eventAt}|${title}`.slice(0, 200);
  return { event_uid: uid, title, country, impact, forecast, previous, actual, event_at: eventAt };
}

async function fetchEconomicCalendar(env) {
  const url = String(env.ECON_CALENDAR_URL || ECON_DEFAULT_SOURCE).trim();
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DCSignals/9.1)', 'Accept': 'application/json' },
    cf: { cacheTtl: 600 }
  });
  if (!res.ok) throw new Error(`經濟日曆來源回應 ${res.status}`);
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('經濟日曆來源回傳的資料不是 JSON');
  }
  if (!Array.isArray(data)) throw new Error('經濟日曆來源格式不正確（預期陣列）');
  return data.map(normalizeEconomicEvent).filter(Boolean);
}

async function syncLegacyEconomicEvents(db, env) {
  await ensureEconomicSchema(db);
  const events = await fetchEconomicCalendar(env);
  let upserted = 0;
  for (const ev of events) {
    // 更新 forecast/previous/actual，但保留既有的 reminded 旗標（避免重複提醒）
    await db.prepare(`
      INSERT INTO economic_events (event_uid, title, country, impact, forecast, previous, actual, event_at, reminded, source, synced_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'forexfactory', datetime('now'), datetime('now'))
      ON CONFLICT(event_uid) DO UPDATE SET
        title = excluded.title,
        country = excluded.country,
        impact = excluded.impact,
        forecast = excluded.forecast,
        previous = excluded.previous,
        actual = excluded.actual,
        event_at = excluded.event_at,
        updated_at = datetime('now')
    `).bind(ev.event_uid, ev.title, ev.country, ev.impact, ev.forecast, ev.previous, ev.actual, ev.event_at).run();
    upserted++;
  }
  // 清掉 30 天前的舊事件
  await db.prepare("DELETE FROM economic_events WHERE event_at < datetime('now', '-30 days')").run();
  await setConfig(db, 'econ_last_sync', new Date().toISOString());
  return { upserted, fetched: events.length };
}

function econFilterClause(currencies, impacts) {
  const clauses = [];
  const binds = [];
  if (Array.isArray(currencies) && currencies.length) {
    clauses.push(`country IN (${currencies.map(() => '?').join(',')})`);
    binds.push(...currencies);
  }
  if (Array.isArray(impacts) && impacts.length) {
    clauses.push(`impact IN (${impacts.map(() => '?').join(',')})`);
    binds.push(...impacts);
  }
  return { where: clauses.length ? ' AND ' + clauses.join(' AND ') : '', binds };
}

function parseEconList(value, fallback) {
  const list = String(value == null ? '' : value)
    .split(/[,\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  return list.length ? list : (fallback || []);
}

async function getEconomicSettings(db) {
  const [enabled, lead, currencies, impacts, lastSync] = await Promise.all([
    getConfig(db, 'econ_enabled'),
    getConfig(db, 'econ_reminder_lead'),
    getConfig(db, 'econ_currencies'),
    getConfig(db, 'econ_impacts'),
    getConfig(db, 'econ_last_sync')
  ]);
  return {
    enabled: enabled == null ? true : enabled === '1',
    leadMinutes: Math.max(5, Number(lead) || 60),
    currencies: parseEconList(currencies, ['USD']),
    // impacts 需正規化成資料庫的 Title-case（High/Medium/Low/Holiday），parseEconList 會轉大寫
    impacts: [...new Set(parseEconList(impacts, ['High']).map(normalizeLegacyEconomicImpact))],
    lastSync: lastSync || null
  };
}

async function getUpcomingEconomicEvents(db, { hours = 48, currencies = null, impacts = null, limit = 30 } = {}) {
  await ensureEconomicSchema(db);
  const { where, binds } = econFilterClause(currencies, impacts);
  const rows = await db.prepare(`
    SELECT * FROM economic_events
    WHERE event_at >= datetime('now', '-30 minutes')
      AND event_at <= datetime('now', '+${Number(hours) || 48} hours')
      ${where}
    ORDER BY event_at ASC
    LIMIT ?
  `).bind(...binds, Number(limit) || 30).all();
  return rows.results || [];
}

function fmtEconTime(eventAtIso) {
  try {
    return new Date(eventAtIso).toLocaleString('zh-TW', {
      timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
    });
  } catch {
    return eventAtIso;
  }
}

function renderEconomicEventsText(events, title = '財經日曆') {
  if (!events.length) return `<b>${escHtml(title)}</b>\n\n近期沒有符合條件的重要經濟事件。`;
  let m = `<b>📅 ${escHtml(title)}</b>\n<i>時間為台北 (UTC+8)</i>\n\n`;
  let lastDay = '';
  for (const ev of events) {
    const day = fmtEconTime(ev.event_at).split(' ')[0];
    if (day !== lastDay) { m += `<b>${escHtml(day)}</b>\n`; lastDay = day; }
    const time = fmtEconTime(ev.event_at).split(' ')[1] || '';
    m += `${econCurrencyFlag(ev.country)} <code>${escHtml(time)}</code> ${escHtml(ev.title)} <i>${escHtml(ev.country)}</i> ${econImpactLabel(ev.impact)}\n`;
    const meta = [];
    if (ev.forecast) meta.push(`預估 ${escHtml(ev.forecast)}`);
    if (ev.previous) meta.push(`前值 ${escHtml(ev.previous)}`);
    if (ev.actual) meta.push(`公布 ${escHtml(ev.actual)}`);
    if (meta.length) m += `   ${meta.join(' · ')}\n`;
  }
  return m.trim();
}

// 把財經數值字串轉成數字（處理 %、$、逗號與 K/M/B/T 後綴）
function econParseNumber(value) {
  if (value == null) return null;
  let s = String(value).trim();
  if (!s || s === '-') return null;
  s = s.replace(/[%$,\s]/g, '');
  const m = s.match(/^(-?\d+(?:\.\d+)?)([kKmMbBtT])?/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const mult = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 }[(m[2] || '').toLowerCase()] || 1;
  return n * mult;
}

// 數值越高代表貨幣越「弱」的反向指標（失業率、失業金申請等）
const ECON_INVERSE_KEYWORDS = ['unemployment rate', 'jobless', 'initial claims', 'continuing claims', 'misery'];
function econIsInverseIndicator(title) {
  const t = String(title || '').toLowerCase();
  return ECON_INVERSE_KEYWORDS.some((k) => t.includes(k));
}

// VIP 事件解讀：依實際值偏離預測，研判貨幣與各品種可能多空方向
function analyzeEconomicEvent(ev) {
  const actual = econParseNumber(ev.actual);
  const forecast = econParseNumber(ev.forecast);
  if (actual == null || forecast == null) return null;
  const diff = actual - forecast;
  const eps = Math.max(Math.abs(forecast) * 0.0005, 1e-9);
  const inverse = econIsInverseIndicator(ev.title);
  // beat > 0：對該貨幣偏多；< 0：偏空；0：符合預期
  let beat = 0;
  if (Math.abs(diff) > eps) beat = (diff > 0 ? 1 : -1) * (inverse ? -1 : 1);
  const pct = forecast !== 0 ? (diff / Math.abs(forecast)) * 100 : null;
  return { actual, forecast, diff, beat, pct, inverse, cur: String(ev.country || '').toUpperCase() };
}

function dirChip(dir) {
  return dir > 0 ? '偏多 🟢' : dir < 0 ? '偏空 🔴' : '震盪 ⚪';
}

function renderEconomicAnalysisText(ev, a) {
  const verdict = a.beat > 0 ? '優於預期' : a.beat < 0 ? '不如預期' : '符合預期';
  const pctText = a.pct == null ? '' : `（偏離 ${a.pct >= 0 ? '+' : ''}${a.pct.toFixed(1)}%）`;
  let m = `<b>🧠 VIP 事件解讀</b>\n\n`;
  m += `${econCurrencyFlag(ev.country)} <b>${escHtml(ev.title)}</b>（${escHtml(ev.country)}）${econImpactLabel(ev.impact)}\n`;
  m += `公布 <b>${escHtml(ev.actual)}</b> / 預期 ${escHtml(ev.forecast || '-')}｜<b>${verdict}</b>${pctText}\n\n`;

  if (a.cur === 'USD') {
    const strongerUsd = a.beat > 0;
    const curWord = a.beat === 0 ? '中性' : strongerUsd ? '偏強 🟢' : '偏弱 🔴';
    m += `研判：美元 ${curWord}\n`;
    if (a.beat === 0) {
      m += `數據貼近預期，方向不明，留意公布後的延伸波動。\n`;
    } else {
      const s = strongerUsd ? -1 : 1; // 美元走強 → 美元計價商品多偏空
      m += `可能影響（機械式研判，僅供參考）：\n`;
      m += `🥇 貴金屬 XAU/GC：${dirChip(s)}\n`;
      m += `📈 美股指數 NQ/ES/USTEC：${dirChip(s)}\n`;
      m += `🛢️ 原油 CL：${dirChip(s)}\n`;
      m += `💱 美元指數偏${strongerUsd ? '多' : '空'}、歐元/日圓等非美貨幣偏${strongerUsd ? '空' : '多'}\n`;
    }
  } else {
    const curWord = a.beat === 0 ? '中性' : a.beat > 0 ? '偏強 🟢' : '偏弱 🔴';
    m += `研判：${escHtml(a.cur)} ${curWord}\n`;
    m += `此為非美元數據，對美元計價的黃金 / 美股指數影響相對間接，主要反映在 ${escHtml(a.cur)} 相關匯率。\n`;
  }
  m += `\n⚠️ 以上為「實際值偏離預期」的機械式研判，非投資建議，請搭配盤勢、技術面與風控自行判斷。`;
  return m;
}

async function handleEconomicReminders(env) {
  const db = env.DB;
  await ensureEconomicSchema(db);
  const settings = await getEconomicSettings(db);
  let synced = null;
  try {
    synced = await syncLegacyEconomicEvents(db, env);
  } catch (e) {
    // 同步失敗時仍嘗試用既有資料提醒
    synced = { error: e.message };
  }
  if (!settings.enabled) return { skipped: true, reason: 'disabled', synced };

  const { where, binds } = econFilterClause(settings.currencies, settings.impacts);
  const due = await db.prepare(`
    SELECT * FROM economic_events
    WHERE reminded = 0
      AND event_at >= datetime('now')
      AND event_at <= datetime('now', '+${settings.leadMinutes} minutes')
      ${where}
    ORDER BY event_at ASC
    LIMIT 20
  `).bind(...binds).all();

  const events = due.results || [];
  let notified = 0;
  for (const ev of events) {
    const minutesAway = Math.max(0, Math.round((new Date(ev.event_at).getTime() - Date.now()) / 60000));
    const meta = [];
    if (ev.forecast) meta.push(`預估 ${ev.forecast}`);
    if (ev.previous) meta.push(`前值 ${ev.previous}`);
    const msg = `<b>⏰ 財經事件提醒</b>\n\n`
      + `${econCurrencyFlag(ev.country)} <b>${escHtml(ev.title)}</b>（${escHtml(ev.country)}）\n`
      + `${econImpactLabel(ev.impact)}\n`
      + `🕒 ${escHtml(fmtEconTime(ev.event_at))}（約 ${minutesAway} 分鐘後）\n`
      + (meta.length ? `📊 ${escHtml(meta.join(' · '))}\n` : '')
      + `\n高影響數據公布前後波動加劇，請留意持倉風險。`;
    const result = await broadcastMessage(db, msg, 'paid', 'alert');
    notified += result?.sent || 0;
    await db.prepare('UPDATE economic_events SET reminded = 1 WHERE event_uid = ?').bind(ev.event_uid).run();
  }

  // VIP 事件解讀：數據公布後（有 actual）依偏離預期研判多空，只發給 VIP
  let analyzedSent = 0;
  const published = await db.prepare(`
    SELECT * FROM economic_events
    WHERE analyzed = 0
      AND actual IS NOT NULL AND actual != ''
      AND event_at >= datetime('now', '-12 hours')
      AND event_at <= datetime('now', '+30 minutes')
      ${where}
    ORDER BY event_at DESC
    LIMIT 20
  `).bind(...binds).all();
  for (const ev of published.results || []) {
    const analysis = analyzeEconomicEvent(ev);
    if (analysis) {
      const result = await broadcastMessage(db, renderEconomicAnalysisText(ev, analysis), 'vip', 'alert');
      analyzedSent += result?.sent || 0;
    }
    // 無論能否解讀都標記，避免重複處理
    await db.prepare('UPDATE economic_events SET analyzed = 1 WHERE event_uid = ?').bind(ev.event_uid).run();
  }

  return { synced, dueEvents: events.length, notified, analyzed: (published.results || []).length, analyzedSent };
}

function opsIssue(severity, title, detail, action, view = 'overview') {
  return { severity, title, detail, action, view };
}

async function getOperationalHealth(db, config = {}, startedAt = Date.now(), env = {}) {
  const integrations = integrationReadiness(env, config);
  const autoTradeEnabled = String(env.AUTO_TRADE_ENABLED || config.auto_trade_enabled || '0') === '1' || String(env.AUTO_TRADE_ENABLED || config.auto_trade_enabled || '') === 'true';
  const autoTradeBridgeUrl = cleanUrl(env.AUTO_TRADE_BRIDGE_URL || config.auto_trade_bridge_url || '');
  const autoTradeBridgeSecret = String(env.AUTO_TRADE_BRIDGE_SECRET || config.auto_trade_bridge_secret || '').trim();
  const autoTradeModeValue = autoTradeMode(env.AUTO_TRADE_MODE || config.auto_trade_mode || 'paper');
  await ensureRateLimitSchema(db);
  const [
    sourceStats, alertStats, latestAlert, signalStats, orderStats, queueStats, rateLimitStats
  ] = await Promise.all([
    db.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active
      FROM tradingview_sources
    `).first(),
    db.prepare(`
      SELECT COUNT(*) as total24,
             SUM(CASE WHEN status = 'error' OR error IS NOT NULL THEN 1 ELSE 0 END) as failed24,
             MAX(created_at) as latest_at
      FROM tv_alert_logs
      WHERE created_at > datetime('now', '-24 hours')
    `).first(),
    db.prepare(`
      SELECT source_id, strategy_id, ticker, action, status, error, created_at
      FROM tv_alert_logs
      ORDER BY created_at DESC LIMIT 1
    `).first(),
    db.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as drafts,
             SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
             MAX(created_at) as latest_at
      FROM signals
    `).first(),
    db.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid,
             MIN(created_at) as oldest_at
      FROM orders
      WHERE status IN ('pending','paid')
    `).first(),
    db.prepare(`
      SELECT COUNT(*) as due,
             MIN(scheduled_at) as oldest_due_at
      FROM queued_signals
      WHERE sent = 0 AND scheduled_at <= datetime('now')
    `).first(),
    db.prepare(`
      SELECT COUNT(*) as active,
             MAX(count) as max_count,
             SUM(CASE WHEN count >= 6 THEN 1 ELSE 0 END) as hot
      FROM rate_limits
      WHERE reset_at_ms > ?
    `).bind(Date.now()).first()
  ]);

  const issues = [];
  if (config.signals_paused === '1') {
    issues.push(opsIssue('critical', '訊號目前暫停', '會員不會收到新訊號。', '到收費設定或 Telegram /resume 恢復發訊。', 'billing'));
  }
  if (!Number(sourceStats?.active || 0)) {
    issues.push(opsIssue('warning', '沒有啟用的 TradingView 來源', '現有 TradingView alert 無法形成穩定訊號入口。', '到 TradingView 頁啟用或新增來源。', 'tradingview'));
  }
  if (Number(alertStats?.failed24 || 0) > 0) {
    issues.push(opsIssue('warning', '近 24 小時有 Alert 錯誤', `${alertStats.failed24} 筆 alert 解析或驗證失敗。`, '檢查 TradingView 日誌與來源 Secret。', 'tradingview'));
  }
  if (Number(queueStats?.due || 0) > 0) {
    issues.push(opsIssue('warning', '有逾時未發送佇列', `${queueStats.due} 筆通知已到發送時間但仍未送出。`, '檢查排程 cron 與 Telegram 發送狀態。', 'overview'));
  }
  if (Number(orderStats?.paid || 0) > 0) {
    issues.push(opsIssue('warning', '有付款待確認', `${orderStats.paid} 筆會員已通知付款。`, '到訂單管理確認入帳或拒絕。', 'orders'));
  }
  if (Number(signalStats?.drafts || 0) > 0) {
    issues.push(opsIssue('info', '有待審訊號草稿', `${signalStats.drafts} 筆訊號尚未發送。`, '到訊號工作台審核發送。', 'signals'));
  }
  if (Number(sourceStats?.active || 0) > 0 && !latestAlert) {
    issues.push(opsIssue('info', '尚未收到 TradingView Alert', '來源已啟用，但還沒有 alert 紀錄。', '從 TradingView 送一筆測試 alert。', 'tradingview'));
  }
  if (!integrations.stripe.secretKey) {
    issues.push(opsIssue('warning', '線上付款尚未啟用', '會員中心目前只會顯示轉帳訂單。', '設定 STRIPE_SECRET_KEY 與 Stripe webhook。', 'billing'));
  } else if (!integrations.stripe.webhookSecret) {
    issues.push(opsIssue('critical', 'Stripe webhook 尚未啟用', 'Checkout 可收款但訂單無法自動確認，系統已暫停對會員顯示線上付款。', '設定 STRIPE_WEBHOOK_SECRET 並在 Stripe 訂閱 webhook 事件。', 'billing'));
  }
  if (!integrations.oauth.enabledCount) {
    issues.push(opsIssue('info', 'Google 登入尚未啟用', '會員仍可用 Email 或 Telegram 登入碼。', '設定 Google OAuth secret。', 'billing'));
  }
  if (!integrations.telegram.botToken) {
    issues.push(opsIssue('critical', 'Telegram Bot Token 未設定', '會員登入碼與 Telegram 推播都無法使用。', '設定 BOT_TOKEN secret。', 'billing'));
  }
  if (!integrations.cron.manualSecret) {
    issues.push(opsIssue('info', '手動 Cron 端點已鎖定', '尚未設定 CRON_SECRET，外部無法手動觸發維運端點；Cloudflare 排程仍會正常執行。', '如需手動測試 cron，設定 CRON_SECRET。', 'billing'));
  }
  if (autoTradeEnabled && !autoTradeBridgeUrl && !autoTradeBridgeSecret) {
    issues.push(opsIssue('critical', '自動交易已啟用但未設定 Bridge', '系統需要外部 Bridge URL，或 Bridge Secret 供 MT5 EA 輪詢。', '到自動交易設定填入 Bridge Secret，先用 MT5 polling + Paper 測試。', 'tradingview'));
  } else if (autoTradeEnabled && autoTradeModeValue === 'live') {
    issues.push(opsIssue('warning', '自動交易為 Live 模式', '訊號會送往橋接端實際下單，請確認 bridge 端風控與交易帳戶。', '先用 paper 模式測通，再切回 live。', 'tradingview'));
  }
  if (Number(rateLimitStats?.hot || 0) > 0) {
    issues.push(opsIssue('info', '偵測到高頻會員操作', `${rateLimitStats.hot} 個登入或訂單操作已接近限制。`, '觀察會員登入與訂單建立是否有異常。', 'overview'));
  }

  const hasCritical = issues.some((issue) => issue.severity === 'critical');
  const hasWarning = issues.some((issue) => issue.severity === 'warning');
  const status = hasCritical ? 'critical' : hasWarning ? 'warning' : 'ok';

  return {
    status,
    statusText: status === 'critical' ? '需要立即處理' : status === 'warning' ? '需要注意' : '正常',
    bootstrapMs: Math.max(1, Date.now() - startedAt),
    issues,
    sourceStats: {
      total: sourceStats?.total || 0,
      active: sourceStats?.active || 0
    },
    alertStats: {
      total24: alertStats?.total24 || 0,
      failed24: alertStats?.failed24 || 0,
      latestAt: latestAlert?.created_at || alertStats?.latest_at || null,
      latestAgeHours: hoursSinceDbTime(latestAlert?.created_at || alertStats?.latest_at),
      latest: latestAlert || null
    },
    integrations,
    signalStats: {
      total: signalStats?.total || 0,
      drafts: signalStats?.drafts || 0,
      active: signalStats?.active || 0,
      latestAt: signalStats?.latest_at || null,
      latestAgeHours: hoursSinceDbTime(signalStats?.latest_at)
    },
    orderStats: {
      total: orderStats?.total || 0,
      paid: orderStats?.paid || 0,
      oldestAt: orderStats?.oldest_at || null,
      oldestAgeHours: hoursSinceDbTime(orderStats?.oldest_at)
    },
    queueStats: {
      due: queueStats?.due || 0,
      oldestDueAt: queueStats?.oldest_due_at || null,
      oldestDueAgeHours: hoursSinceDbTime(queueStats?.oldest_due_at)
    },
    securityStats: {
      activeRateLimits: rateLimitStats?.active || 0,
      hotRateLimits: rateLimitStats?.hot || 0,
      maxRateCount: rateLimitStats?.max_count || 0
    }
  };
}

async function getFinanceMetrics(db) {
  await ensureOrderPaymentSchema(db);
  const [
    lifetime,
    gross30,
    refunds30,
    gross7,
    refunds7,
    grossToday,
    refundsToday,
    tierRows,
    dailyRows,
    activePaid,
    expiring7,
    expired30,
    pendingValue
  ] = await Promise.all([
    db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN confirmed_at IS NOT NULL THEN amount ELSE 0 END), 0) AS gross_revenue,
        COALESCE(SUM(CASE WHEN refunded_at IS NOT NULL THEN COALESCE(refund_amount, amount) ELSE 0 END), 0) AS refunds,
        SUM(CASE WHEN confirmed_at IS NOT NULL THEN 1 ELSE 0 END) AS confirmed_orders,
        SUM(CASE WHEN refunded_at IS NOT NULL THEN 1 ELSE 0 END) AS refunded_orders,
        COUNT(DISTINCT CASE WHEN confirmed_at IS NOT NULL THEN user_id END) AS paying_customers
      FROM orders
    `).first(),
    db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS orders
      FROM orders
      WHERE confirmed_at IS NOT NULL AND datetime(confirmed_at) >= datetime('now', '-30 days')
    `).first(),
    db.prepare(`
      SELECT COALESCE(SUM(COALESCE(refund_amount, amount)), 0) AS amount, COUNT(*) AS orders
      FROM orders
      WHERE refunded_at IS NOT NULL AND datetime(refunded_at) >= datetime('now', '-30 days')
    `).first(),
    db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS orders
      FROM orders
      WHERE confirmed_at IS NOT NULL AND datetime(confirmed_at) >= datetime('now', '-7 days')
    `).first(),
    db.prepare(`
      SELECT COALESCE(SUM(COALESCE(refund_amount, amount)), 0) AS amount, COUNT(*) AS orders
      FROM orders
      WHERE refunded_at IS NOT NULL AND datetime(refunded_at) >= datetime('now', '-7 days')
    `).first(),
    db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS orders
      FROM orders
      WHERE confirmed_at IS NOT NULL AND DATE(confirmed_at) = DATE('now')
    `).first(),
    db.prepare(`
      SELECT COALESCE(SUM(COALESCE(refund_amount, amount)), 0) AS amount, COUNT(*) AS orders
      FROM orders
      WHERE refunded_at IS NOT NULL AND DATE(refunded_at) = DATE('now')
    `).first(),
    db.prepare(`
      SELECT tier,
             COUNT(*) AS orders,
             COALESCE(SUM(amount), 0) AS gross,
             COALESCE(SUM(CASE WHEN refunded_at IS NOT NULL THEN COALESCE(refund_amount, amount) ELSE 0 END), 0) AS refunds
      FROM orders
      WHERE confirmed_at IS NOT NULL
      GROUP BY tier
      ORDER BY tier
    `).all(),
    db.prepare(`
      SELECT day, COALESCE(SUM(gross), 0) AS gross, COALESCE(SUM(refunds), 0) AS refunds
      FROM (
        SELECT DATE(confirmed_at) AS day, amount AS gross, 0 AS refunds
        FROM orders
        WHERE confirmed_at IS NOT NULL AND DATE(confirmed_at) >= DATE('now', '-13 days')
        UNION ALL
        SELECT DATE(refunded_at) AS day, 0 AS gross, COALESCE(refund_amount, amount) AS refunds
        FROM orders
        WHERE refunded_at IS NOT NULL AND DATE(refunded_at) >= DATE('now', '-13 days')
      )
      GROUP BY day
      ORDER BY day
    `).all(),
    db.prepare(`
      SELECT COUNT(*) AS c
      FROM users
      WHERE tier IN ('pro','vip')
        AND is_active = 1
        AND is_banned = 0
        AND tier_expires_at IS NOT NULL
        AND datetime(tier_expires_at) > datetime('now')
    `).first(),
    db.prepare(`
      SELECT COUNT(*) AS c
      FROM users
      WHERE tier IN ('pro','vip')
        AND is_active = 1
        AND is_banned = 0
        AND tier_expires_at IS NOT NULL
        AND datetime(tier_expires_at) > datetime('now')
        AND datetime(tier_expires_at) <= datetime('now', '+7 days')
    `).first(),
    db.prepare(`
      SELECT COUNT(*) AS c
      FROM users
      WHERE total_spent > 0
        AND (tier = 'free' OR tier_expires_at IS NULL OR datetime(tier_expires_at) <= datetime('now'))
        AND datetime(updated_at) >= datetime('now', '-30 days')
    `).first(),
    db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS orders
      FROM orders
      WHERE status IN ('pending','paid')
    `).first()
  ]);

  const grossRevenue = Number(lifetime?.gross_revenue || 0);
  const refunds = Number(lifetime?.refunds || 0);
  const netRevenue = Math.max(0, grossRevenue - refunds);
  const netRevenue30 = Math.max(0, Number(gross30?.amount || 0) - Number(refunds30?.amount || 0));
  const netRevenue7 = Math.max(0, Number(gross7?.amount || 0) - Number(refunds7?.amount || 0));
  const netRevenueToday = Math.max(0, Number(grossToday?.amount || 0) - Number(refundsToday?.amount || 0));
  const confirmedOrders = Number(lifetime?.confirmed_orders || 0);
  const payingCustomers = Number(lifetime?.paying_customers || 0);
  const activePaidUsers = Number(activePaid?.c || 0);
  const expiredPaidUsers30 = Number(expired30?.c || 0);
  const churnBase = activePaidUsers + expiredPaidUsers30;
  const tierRevenue = (tierRows.results || []).map((row) => ({
    tier: row.tier || 'unknown',
    orders: Number(row.orders || 0),
    gross: Number(row.gross || 0),
    refunds: Number(row.refunds || 0),
    net: Math.max(0, Number(row.gross || 0) - Number(row.refunds || 0))
  }));
  const dailyRevenue = (dailyRows.results || []).map((row) => ({
    day: row.day,
    gross: Number(row.gross || 0),
    refunds: Number(row.refunds || 0),
    net: Math.max(0, Number(row.gross || 0) - Number(row.refunds || 0))
  }));

  return {
    grossRevenue,
    refunds,
    netRevenue,
    grossRevenue30: Number(gross30?.amount || 0),
    refunds30: Number(refunds30?.amount || 0),
    netRevenue30,
    netRevenue7,
    netRevenueToday,
    confirmedOrders,
    refundedOrders: Number(lifetime?.refunded_orders || 0),
    payingCustomers,
    activePaidUsers,
    expiringPaidUsers7: Number(expiring7?.c || 0),
    expiredPaidUsers30,
    pendingOrderValue: Number(pendingValue?.amount || 0),
    pendingOrderCount: Number(pendingValue?.orders || 0),
    avgOrderValue: confirmedOrders ? netRevenue / confirmedOrders : 0,
    arpu30: activePaidUsers ? netRevenue30 / activePaidUsers : 0,
    ltv: payingCustomers ? netRevenue / payingCustomers : 0,
    refundRate: grossRevenue ? (refunds / grossRevenue) * 100 : 0,
    churnRate30: churnBase ? (expiredPaidUsers30 / churnBase) * 100 : 0,
    tierRevenue,
    dailyRevenue
  };
}

function adminDateKey(value) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
  const parsed = new Date(`${text}T00:00:00+08:00`);
  return Number.isNaN(parsed.getTime()) ? '' : text;
}

function adminDefaultStartDate() {
  const date = new Date(Date.now() - 29 * 86400000);
  return taipeiDateKey(date);
}

function adminQueryRange(request = null) {
  const url = request ? new URL(request.url) : null;
  const all = url?.searchParams.get('all') === '1';
  const start = all ? '' : (adminDateKey(url?.searchParams.get('start')) || adminDefaultStartDate());
  const end = all ? '' : (adminDateKey(url?.searchParams.get('end')) || taipeiDateKey());
  const limitRaw = Number(url?.searchParams.get('limit') || 300);
  const limit = Math.max(80, Math.min(1000, Number.isFinite(limitRaw) ? limitRaw : 300));
  const normalizedStart = start && end && start > end ? end : start;
  const normalizedEnd = start && end && start > end ? start : end;
  return { start: normalizedStart, end: normalizedEnd, limit, all };
}

function adminDateWhere(column, range, localDateColumn = false) {
  const expr = localDateColumn ? column : `DATE(datetime(${column}, '+8 hours'))`;
  const where = [];
  const binds = [];
  if (range?.start) {
    where.push(`${expr} >= ?`);
    binds.push(range.start);
  }
  if (range?.end) {
    where.push(`${expr} <= ?`);
    binds.push(range.end);
  }
  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', binds };
}

function signalTpSql() {
  return `MAX(COALESCE(tp_hit_count, 0), CASE WHEN tp3_hit_at IS NOT NULL THEN 3 WHEN tp2_hit_at IS NOT NULL THEN 2 WHEN tp1_hit_at IS NOT NULL THEN 1 ELSE 0 END)`;
}

async function getSignalAnalytics(db, range) {
  await ensureSignalLifecycleSchema(db);
  const signalWhere = adminDateWhere('created_at', range);
  const tpSql = signalTpSql();
  const [summary, byTicker, byStrategy, daily] = await Promise.all([
    db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
        SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) AS losses,
        SUM(CASE WHEN result = 'breakeven' THEN 1 ELSE 0 END) AS breakeven,
        COALESCE(SUM(CASE WHEN status = 'closed' THEN pnl_points ELSE 0 END), 0) AS net_pnl,
        AVG(CASE WHEN status = 'closed' THEN pnl_points END) AS avg_pnl,
        AVG(CASE WHEN result = 'win' THEN pnl_points END) AS avg_win,
        AVG(CASE WHEN result = 'loss' THEN pnl_points END) AS avg_loss,
        SUM(CASE WHEN ${tpSql} >= 1 THEN 1 ELSE 0 END) AS tp1_hits,
        SUM(CASE WHEN ${tpSql} >= 2 THEN 1 ELSE 0 END) AS tp2_hits,
        SUM(CASE WHEN ${tpSql} >= 3 THEN 1 ELSE 0 END) AS tp3_hits,
        COALESCE(SUM(sent_count), 0) AS sent_count
      FROM signals
      ${signalWhere.clause}
    `).bind(...signalWhere.binds).first(),
    db.prepare(`
      SELECT ticker,
             COUNT(*) AS total,
             SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed,
             SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) AS wins,
             COALESCE(SUM(CASE WHEN status = 'closed' THEN pnl_points ELSE 0 END), 0) AS net_pnl
      FROM signals
      ${signalWhere.clause}
      GROUP BY ticker
      ORDER BY total DESC, ticker
      LIMIT 10
    `).bind(...signalWhere.binds).all(),
    db.prepare(`
      SELECT COALESCE(NULLIF(strategy_id, ''), NULLIF(source, ''), 'manual') AS strategy,
             COUNT(*) AS total,
             SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed,
             SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) AS wins,
             COALESCE(SUM(CASE WHEN status = 'closed' THEN pnl_points ELSE 0 END), 0) AS net_pnl
      FROM signals
      ${signalWhere.clause}
      GROUP BY strategy
      ORDER BY total DESC, strategy
      LIMIT 10
    `).bind(...signalWhere.binds).all(),
    db.prepare(`
      SELECT DATE(datetime(created_at, '+8 hours')) AS day,
             COUNT(*) AS total,
             SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed,
             COALESCE(SUM(CASE WHEN status = 'closed' THEN pnl_points ELSE 0 END), 0) AS net_pnl
      FROM signals
      ${signalWhere.clause}
      GROUP BY day
      ORDER BY day
      LIMIT 120
    `).bind(...signalWhere.binds).all()
  ]);
  const total = Number(summary?.total || 0);
  const closed = Number(summary?.closed || 0);
  const wins = Number(summary?.wins || 0);
  const losses = Number(summary?.losses || 0);
  const winRate = closed ? (wins / closed) * 100 : 0;
  const lossRate = closed ? (losses / closed) * 100 : 0;
  return {
    range,
    summary: {
      total,
      pending: Number(summary?.pending || 0),
      active: Number(summary?.active || 0),
      closed,
      cancelled: Number(summary?.cancelled || 0),
      wins,
      losses,
      breakeven: Number(summary?.breakeven || 0),
      winRate,
      lossRate,
      netPnl: Number(summary?.net_pnl || 0),
      avgPnl: Number(summary?.avg_pnl || 0),
      avgWin: Number(summary?.avg_win || 0),
      avgLoss: Number(summary?.avg_loss || 0),
      tp1Hits: Number(summary?.tp1_hits || 0),
      tp2Hits: Number(summary?.tp2_hits || 0),
      tp3Hits: Number(summary?.tp3_hits || 0),
      sentCount: Number(summary?.sent_count || 0)
    },
    byTicker: (byTicker.results || []).map((row) => ({
      ticker: row.ticker || '-',
      total: Number(row.total || 0),
      closed: Number(row.closed || 0),
      wins: Number(row.wins || 0),
      winRate: Number(row.closed || 0) ? (Number(row.wins || 0) / Number(row.closed || 0)) * 100 : 0,
      netPnl: Number(row.net_pnl || 0)
    })),
    byStrategy: (byStrategy.results || []).map((row) => ({
      strategy: row.strategy || '-',
      total: Number(row.total || 0),
      closed: Number(row.closed || 0),
      wins: Number(row.wins || 0),
      winRate: Number(row.closed || 0) ? (Number(row.wins || 0) / Number(row.closed || 0)) * 100 : 0,
      netPnl: Number(row.net_pnl || 0)
    })),
    daily: (daily.results || []).map((row) => ({
      day: row.day,
      total: Number(row.total || 0),
      closed: Number(row.closed || 0),
      netPnl: Number(row.net_pnl || 0)
    }))
  };
}

function fallbackFinanceMetrics() {
  return {
    grossRevenue: 0,
    refunds: 0,
    netRevenue: 0,
    grossRevenue30: 0,
    refunds30: 0,
    netRevenue30: 0,
    netRevenue7: 0,
    netRevenueToday: 0,
    confirmedOrders: 0,
    refundedOrders: 0,
    payingCustomers: 0,
    activePaidUsers: 0,
    expiringPaidUsers7: 0,
    expiredPaidUsers30: 0,
    pendingOrderValue: 0,
    pendingOrderCount: 0,
    avgOrderValue: 0,
    arpu30: 0,
    ltv: 0,
    refundRate: 0,
    churnRate30: 0,
    tierRevenue: [],
    dailyRevenue: []
  };
}

function fallbackSignalAnalytics(range) {
  return {
    range,
    summary: {
      total: 0,
      pending: 0,
      active: 0,
      closed: 0,
      cancelled: 0,
      wins: 0,
      losses: 0,
      breakeven: 0,
      winRate: 0,
      lossRate: 0,
      netPnl: 0,
      avgPnl: 0,
      avgWin: 0,
      avgLoss: 0,
      tp1Hits: 0,
      tp2Hits: 0,
      tp3Hits: 0,
      sentCount: 0
    },
    byTicker: [],
    byStrategy: [],
    daily: []
  };
}

function fallbackAutoTradeDashboard() {
  return {
    config: {
      enabled: false,
      mode: 'paper',
      broker: 'exness-mt5',
      account: '',
      defaultVolume: 0.01,
      riskPercent: 1,
      maxDailyOrders: 20,
      allowedSymbols: [],
      allowedStrategies: [],
      bridgeConfigured: false,
      bridgeMode: 'mt5-poll'
    },
    summary: {
      total: 0,
      sent: 0,
      failed: 0,
      queued: 0,
      skipped: 0,
      latestAt: null
    },
    recent: []
  };
}

function fallbackOperationalHealth(config = {}, startedAt = Date.now(), env = {}) {
  const integrations = integrationReadiness(env, config);
  return {
    status: 'warning',
    statusText: '部分資料異常',
    bootstrapMs: Math.max(1, Date.now() - startedAt),
    issues: [],
    sourceStats: { total: 0, active: 0 },
    alertStats: { total24: 0, failed24: 0, latestAt: null, latestAgeHours: null, latest: null },
    integrations,
    signalStats: { total: 0, drafts: 0, active: 0, latestAt: null, latestAgeHours: null },
    orderStats: { total: 0, paid: 0, oldestAt: null, oldestAgeHours: null },
    queueStats: { due: 0, oldestDueAt: null, oldestDueAgeHours: null },
    securityStats: { activeRateLimits: 0, hotRateLimits: 0, maxRateCount: 0 }
  };
}

async function getAdminBootstrap(db, env = {}, request = null) {
  const startedAt = Date.now();
  await ensureAdminSchema(db);
  await ensureOrderPaymentSchema(db);
  await ensureSupportSchema(db);
  await ensureEconomicEventsSchema(db);
  const todayKey = taipeiDateKey();
  const range = adminQueryRange(request);
  const signalWhere = adminDateWhere('created_at', range);
  const orderWhere = adminDateWhere('o.created_at', range);
  const orderEventWhere = adminDateWhere('created_at', range);
  const tvLogWhere = adminDateWhere('created_at', range);
  const economicWhere = adminDateWhere('event_date', range, true);
  const supportWhere = adminDateWhere('updated_at', range);
  const bootstrapErrors = [];
  const safe = async (label, promise, fallback) => {
    try {
      return await promise;
    } catch (e) {
      bootstrapErrors.push({
        module: label,
        error: e?.message || String(e)
      });
      return typeof fallback === 'function' ? fallback() : fallback;
    }
  };
  const emptyRows = () => ({ results: [] });

  const [
    totalUsers, proUsers, vipUsers, todaySignals, activeSignals, pendingOrders,
    todayPerf, configRows, symbols, strategies, signals, orders, orderEvents, users, usersSummary, tvSources, tvLogs, economicEvents, finance, supportTickets, supportStats, signalAnalytics, autoTrade
  ] = await Promise.all([
    safe('users.count', db.prepare('SELECT COUNT(*) as c FROM users').first(), { c: 0 }),
    safe('users.pro', db.prepare("SELECT COUNT(*) as c FROM users WHERE tier = 'pro' AND is_active = 1").first(), { c: 0 }),
    safe('users.vip', db.prepare("SELECT COUNT(*) as c FROM users WHERE tier = 'vip' AND is_active = 1").first(), { c: 0 }),
    safe('signals.today', db.prepare("SELECT COUNT(*) as c FROM signals WHERE DATE(created_at) = DATE('now')").first(), { c: 0 }),
    safe('signals.active', db.prepare("SELECT COUNT(*) as c FROM signals WHERE status = 'active'").first(), { c: 0 }),
    safe('orders.pending', db.prepare("SELECT COUNT(*) as c FROM orders WHERE status IN ('pending', 'paid')").first(), { c: 0 }),
    safe('performance.today', db.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
             SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) as losses,
             SUM(pnl_points) as pnl
      FROM performance
      WHERE DATE(created_at) = DATE('now')
    `).first(), { total: 0, wins: 0, losses: 0, pnl: 0 }),
    safe('config', db.prepare(`SELECT key, value FROM system_config WHERE key IN (${ADMIN_CONFIG_KEYS.map(() => '?').join(',')}) ORDER BY key`).bind(...ADMIN_CONFIG_KEYS).all(), emptyRows),
    safe('symbols', db.prepare('SELECT * FROM symbols ORDER BY sort_order, symbol').all(), emptyRows),
    safe('strategies', db.prepare('SELECT * FROM strategies ORDER BY sort_order, strategy_id').all(), emptyRows),
    safe('signals.list', db.prepare(`SELECT * FROM signals ${signalWhere.clause} ORDER BY created_at DESC LIMIT ?`).bind(...signalWhere.binds, range.limit).all(), emptyRows),
    safe('orders.list', db.prepare(`
      SELECT o.*, u.username, u.first_name FROM orders o
      LEFT JOIN users u ON o.user_id = u.user_id
      ${orderWhere.clause}
      ORDER BY o.created_at DESC LIMIT ?
    `).bind(...orderWhere.binds, range.limit).all(), emptyRows),
    safe('orders.events', db.prepare(`
      SELECT order_id, user_id, event_type, actor_id, message, metadata, created_at
      FROM order_events
      ${orderEventWhere.clause}
      ORDER BY created_at DESC LIMIT ?
    `).bind(...orderEventWhere.binds, Math.min(range.limit * 2, 1000)).all(), emptyRows),
    safe('users.list', db.prepare(`
      SELECT u.user_id, u.username, u.first_name, u.telegram_user_id, u.tier, u.tier_expires_at, u.points, u.total_spent,
             u.is_active, u.is_banned, u.last_active_at, u.admin_note, u.created_at,
             us.capital, us.risk_percent, us.subscribed_symbols, us.signal_types,
             us.notify_entry, us.notify_tp, us.notify_sl, us.notify_update, us.notify_alert,
             us.quiet_enabled, us.quiet_start, us.quiet_end, us.paused, us.timezone
      FROM users u
      LEFT JOIN user_settings us ON u.user_id = us.user_id
      ORDER BY u.created_at DESC LIMIT ?
    `).bind(range.limit).all(), emptyRows),
    safe('users.summary', db.prepare(`
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN tier = 'free' THEN 1 ELSE 0 END) AS free,
             SUM(CASE WHEN tier = 'pro' THEN 1 ELSE 0 END) AS pro,
             SUM(CASE WHEN tier = 'vip' THEN 1 ELSE 0 END) AS vip,
             SUM(CASE WHEN tier != 'free' AND is_active = 1 AND is_banned = 0 AND (tier_expires_at IS NULL OR tier_expires_at > datetime('now')) THEN 1 ELSE 0 END) AS active_paid,
             SUM(CASE WHEN tier != 'free' AND tier_expires_at IS NOT NULL AND tier_expires_at > datetime('now') AND tier_expires_at <= datetime('now', '+7 days') THEN 1 ELSE 0 END) AS expiring7,
             SUM(CASE WHEN is_banned = 1 THEN 1 ELSE 0 END) AS banned,
             SUM(CASE WHEN username LIKE '%@%' THEN 1 ELSE 0 END) AS email_linked,
             SUM(CASE WHEN telegram_user_id IS NOT NULL AND telegram_user_id != '' THEN 1 ELSE 0 END) AS telegram_linked,
             COALESCE(SUM(total_spent), 0) AS total_spent
      FROM users
    `).first(), { total: 0, free: 0, pro: 0, vip: 0, active_paid: 0, expiring7: 0, banned: 0, email_linked: 0, telegram_linked: 0, total_spent: 0 }),
    safe('tradingview.sources', db.prepare('SELECT * FROM tradingview_sources ORDER BY created_at DESC').all(), emptyRows),
    safe('tradingview.logs', db.prepare(`SELECT * FROM tv_alert_logs ${tvLogWhere.clause} ORDER BY created_at DESC LIMIT ?`).bind(...tvLogWhere.binds, range.limit).all(), emptyRows),
    safe('economic.events', db.prepare(`
      SELECT * FROM economic_events
      ${economicWhere.clause}
      ORDER BY event_date,
        CASE impact WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
        COALESCE(event_time, event_date),
        title
      LIMIT ?
    `).bind(...economicWhere.binds, range.limit).all(), emptyRows),
    safe('finance.metrics', getFinanceMetrics(db), fallbackFinanceMetrics),
    safe('support.tickets', getAdminSupportTickets(db, range.limit, range), []),
    safe('support.summary', db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed,
        COUNT(*) AS total
      FROM support_tickets
      ${supportWhere.clause}
    `).bind(...supportWhere.binds).first(), { open: 0, pending: 0, closed: 0, total: 0 }),
    safe('signals.analytics', getSignalAnalytics(db, range), () => fallbackSignalAnalytics(range)),
    safe('auto_trade.dashboard', getAutoTradeDashboard(db, env, range), fallbackAutoTradeDashboard)
  ]);

  const config = {};
  for (const row of configRows.results || []) config[row.key] = row.value;
  if (!config.public_base_url) config.public_base_url = publicBaseUrl(env);
  if (!config.payment_manual_enabled) config.payment_manual_enabled = '1';
  if (!config.payment_crypto_enabled) config.payment_crypto_enabled = '0';
  if (!config.payment_crypto_asset) config.payment_crypto_asset = 'USDT';
  if (!config.payment_crypto_network) config.payment_crypto_network = 'TRC20';
  if (!config.payment_crypto_rate_note) config.payment_crypto_rate_note = '請依付款當下匯率換算，實收以客服確認為準';
  if (!config.economic_calendar_source_url) config.economic_calendar_source_url = DEFAULT_ECONOMIC_CALENDAR_SOURCE_URL;
  if (!config.economic_calendar_source_name) config.economic_calendar_source_name = DEFAULT_ECONOMIC_CALENDAR_SOURCE_NAME;
  if (!config.economic_calendar_auto_remind) config.economic_calendar_auto_remind = '1';
  if (!config.economic_calendar_remind_hour) config.economic_calendar_remind_hour = '8';
  if (!config.economic_calendar_pre_event_minutes) config.economic_calendar_pre_event_minutes = '30';
  if (!config.economic_calendar_lookahead_days) config.economic_calendar_lookahead_days = '7';
  if (!config.economic_calendar_target_group) config.economic_calendar_target_group = 'paid';
  if (!config.economic_calendar_impacts) config.economic_calendar_impacts = 'high';
  if (!config.economic_calendar_currencies) config.economic_calendar_currencies = 'USD,EUR,GBP,JPY,CAD,AUD,CNY';
  if (!config.economic_calendar_market_only) config.economic_calendar_market_only = '1';
  if (!config.signal_proxy_rules) config.signal_proxy_rules = DEFAULT_SIGNAL_PROXY_RULES;
  if (!config.signal_min_probability) config.signal_min_probability = '60';
  const winRate = todayPerf?.total > 0 ? Math.round(((todayPerf.wins || 0) / todayPerf.total) * 100) : 0;
  const ops = await safe('ops.health', getOperationalHealth(db, config, startedAt, env), () => fallbackOperationalHealth(config, startedAt, env));
  if (bootstrapErrors.length) {
    ops.status = ops.status === 'critical' ? 'critical' : 'warning';
    ops.statusText = ops.status === 'critical' ? ops.statusText : '部分資料異常';
    ops.issues = [
      ...bootstrapErrors.slice(0, 6).map((item) => opsIssue(
        'warning',
        `後台模組載入失敗：${item.module}`,
        item.error,
        '此模組已降級處理，其他後台功能仍可使用；請查看 Worker logs 後修正。',
        'overview'
      )),
      ...(ops.issues || [])
    ];
  }
  const economicRuntimeConfig = await safe('economic.config', getEconomicConfig(db, env), {
    autoRemind: true,
    impacts: ['high'],
    currencies: ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CNY'],
    preEventMinutes: 30,
    marketOnly: true
  });
  const economicSettings = {
    enabled: !!economicRuntimeConfig.autoRemind,
    impacts: economicRuntimeConfig.impacts,
    currencies: economicRuntimeConfig.currencies,
    leadMinutes: economicRuntimeConfig.preEventMinutes,
    marketOnly: !!economicRuntimeConfig.marketOnly,
    lastSync: config.economic_calendar_last_sync || null
  };
  const upcomingEconomicEvents = await safe('economic.upcoming', getUpcomingMarketEconomicEvents(db, economicRuntimeConfig, { hours: 72, limit: 60 }), []);
  const economicRows = economicEvents.results || [];
  const deliveryDiagnostics = await safe(
    'delivery.diagnostics',
    getDeliveryDiagnostics(db, env, Math.min(Number(range.limit || 40), 60)),
    fallbackDeliveryDiagnostics
  );

  return {
    stats: {
      totalUsers: totalUsers?.c || 0,
      proUsers: proUsers?.c || 0,
      vipUsers: vipUsers?.c || 0,
      todaySignals: todaySignals?.c || 0,
      activeSignals: activeSignals?.c || 0,
      pendingOrders: pendingOrders?.c || 0,
      todayWins: todayPerf?.wins || 0,
      todayLosses: todayPerf?.losses || 0,
      todayPnl: todayPerf?.pnl || 0,
      winRate,
      paused: config.signals_paused === '1'
    },
    range,
    signalAnalytics,
    usersSummary: {
      total: Number(usersSummary?.total || 0),
      free: Number(usersSummary?.free || 0),
      pro: Number(usersSummary?.pro || 0),
      vip: Number(usersSummary?.vip || 0),
      activePaid: Number(usersSummary?.active_paid || 0),
      expiring7: Number(usersSummary?.expiring7 || 0),
      banned: Number(usersSummary?.banned || 0),
      emailLinked: Number(usersSummary?.email_linked || 0),
      telegramLinked: Number(usersSummary?.telegram_linked || 0),
      totalSpent: Number(usersSummary?.total_spent || 0)
    },
    config,
    symbols: symbols.results || [],
    strategies: strategies.results || [],
    signals: signals.results || [],
    orders: orders.results || [],
    orderEvents: orderEvents.results || [],
    users: users.results || [],
    tvSources: tvSources.results || [],
    tvLogs: tvLogs.results || [],
    economicEvents: economicRows,
    economic: {
      today: todayKey,
      todayCount: economicRows.filter((event) => event.event_date === todayKey).length,
      highCount: economicRows.filter((event) => event.event_date === todayKey && normalizeEconomicImpact(event.impact) === 'high').length
    },
    integrations: ops.integrations,
    ops,
    finance,
    economicSettings,
    upcomingEconomicEvents,
    deliveryDiagnostics,
    autoTrade,
    supportTickets,
    supportStats: {
      open: Number(supportStats?.open || 0),
      pending: Number(supportStats?.pending || 0),
      closed: Number(supportStats?.closed || 0),
      total: Number(supportStats?.total || 0)
    },
    bootstrapErrors,
    serverTime: fmtTime()
  };
}

function parseTvLogPayload(log = {}) {
  return parseObject(log.payload, {});
}

function deliveryLevelSnapshot(payload = {}, action = '') {
  const resolvedAction = action || normalizeTvAction(payload) || '';
  return {
    entry: tvEntryPrice(payload),
    stopLoss: tvStopLoss(payload, resolvedAction),
    tp1: tvTargetPrice(payload, 1, resolvedAction),
    tp2: tvTargetPrice(payload, 2, resolvedAction),
    tp3: tvTargetPrice(payload, 3, resolvedAction),
    probability: tvProbability(payload, resolvedAction)
  };
}

function rawLevelSnapshot(payload = {}, action = '') {
  const resolvedAction = action || normalizeTvAction(payload) || '';
  const side = tvActionSide(resolvedAction);
  const stopValues = tvStopLossValues(payload, resolvedAction);
  return {
    entry: firstTvValue(payload.entry_price, payload.entry, payload.order_price, payload.strategy_order_price, payload.price, payload.close),
    stopLoss: firstTvValue(...stopValues),
    tp1: firstTvValue(...tvTargetValues(payload, 1, resolvedAction)),
    tp2: firstTvValue(...tvTargetValues(payload, 2, resolvedAction)),
    tp3: firstTvValue(...tvTargetValues(payload, 3, resolvedAction)),
    probability: fmtProbability(tvProbability(payload, resolvedAction)),
    side
  };
}

function levelIssuesFromSnapshot(levels = {}) {
  const required = [
    ['entry', levels.entry],
    ['stopLoss', levels.stopLoss],
    ['tp1', levels.tp1]
  ];
  const optional = [
    ['tp2', levels.tp2],
    ['tp3', levels.tp3]
  ];
  const missing = required.filter(([, value]) => value === null || value === undefined).map(([name]) => name);
  const zero = [...required, ...optional]
    .filter(([, value]) => value !== null && value !== undefined && Number(value) === 0)
    .map(([name]) => name);
  return { missing, zero };
}

function diagnoseDeliveryLog(log = {}, deliveryLog = null) {
  const payload = parseTvLogPayload(log);
  const action = log.action || normalizeTvAction(payload) || '';
  const levels = deliveryLevelSnapshot(payload, action);
  const rawLevels = rawLevelSnapshot(payload, action);
  const logAction = String(log.action || '').toUpperCase();
  const isExit = inferTvEventKind(payload) === 'exit' || ['TP1', 'TP2', 'TP3', 'SL', 'CLOSE', 'AUTO'].includes(logAction);
  const issues = isExit ? { missing: [], zero: [] } : levelIssuesFromSnapshot(levels);
  const error = String(log.error || '');
  const status = String(log.status || '').toLowerCase();
  let tone = 'green';
  let title = '已接收';
  let actionText = log.signal_uid ? '已建立訊號，等待或已完成背景派送。' : '已記錄 alert，尚未建立訊號。';
  let stage = log.signal_uid ? 'signal_created' : 'received';

  if (isExit) {
    title = '出場 / 結案 alert';
    actionText = log.signal_uid ? '已處理既有訊號的出場或結案。' : '已收到出場 alert，尚未對應到訊號。';
    stage = 'exit';
  }
  if (deliveryLog) {
    title = 'TG 派送完成';
    actionText = deliveryLog.details || '背景派送已完成。';
    stage = 'delivered';
  }
  if (issues.zero.length) {
    tone = 'red';
    title = 'SL/TP 回傳 0';
    actionText = 'TradingView 已打到後台，但 plot 沒取到指標實際點位；後台已拒絕發給會員。';
    stage = 'blocked_zero_levels';
  } else if (issues.missing.length) {
    tone = 'amber';
    title = '點位欄位不完整';
    actionText = 'entry、stopLoss、tp1 是必要欄位；請重貼後台產生的 TradingView Message。';
    stage = 'missing_levels';
  }
  if (error || status === 'error') {
    tone = 'red';
    stage = stage === 'blocked_zero_levels' ? stage : 'error';
    if (error.includes('為 0') || error.includes('plot 沒取到')) {
      title = 'TV plot 回傳 0';
      actionText = '請到 TradingView Data Window 核對 AlgoPro SL/TP plot 名稱或 plot_序號。';
    } else if (error.includes('placeholder') || error.includes('未解析')) {
      title = 'TV placeholder 未解析';
      actionText = 'Alert Message 仍是 placeholder，TradingView 沒有轉成數字。';
    } else if (error.includes('stop_loss') || error.includes('止損')) {
      title = '缺少止損';
      actionText = 'Alert Message 必須帶 stop_loss/sl，不能由後端推算。';
    } else if (error.includes('tp1') || error.includes('target1') || error.includes('止盈') || error.includes('止贏')) {
      title = '缺少 TP1';
      actionText = 'Alert Message 必須帶 tp1/target1，不能由後端推算。';
    } else if (error.includes('secret')) {
      title = 'Webhook Secret 錯誤';
      actionText = '確認 TV webhook URL、source_id 與後台來源 secret。';
    } else {
      title = 'Alert 錯誤';
      actionText = error || '請檢查 payload 格式。';
    }
  }

  return {
    stage,
    tone,
    title,
    action: actionText,
    levels,
    rawLevels,
    missing: issues.missing,
    zero: issues.zero,
    error
  };
}

function fallbackDeliveryDiagnostics() {
  return {
    stats: { alerts24: 0, errors24: 0, zero24: 0, delivered24: 0, queuedDue: 0 },
    items: [],
    deliveryLogs: [],
    queue: { due: 0, oldestDueAt: null },
    adminTargets: 0
  };
}

async function getDeliveryDiagnostics(db, env = {}, limit = 40) {
  await ensureAdminSchema(db);
  await addColumnIfMissing(db, 'queued_signals', 'photo_url', 'TEXT');
  loadRuntimeConfig(env);
  const cappedLimit = Math.max(10, Math.min(100, Number(limit || 40)));
  const [logs, deliveryLogs, queue, stats] = await Promise.all([
    db.prepare('SELECT * FROM tv_alert_logs ORDER BY created_at DESC LIMIT ?').bind(cappedLimit).all(),
    db.prepare(`
      SELECT admin_id, action, target, details, created_at
      FROM admin_logs
      WHERE action IN ('tv_signal_delivery_done','admin_signal_delivery_done','tv_alert_error_notify_failed','admin_auto_close_notify_failed','auto_close_notify_failed')
      ORDER BY created_at DESC
      LIMIT 120
    `).all(),
    db.prepare(`
      SELECT COUNT(*) AS due, MIN(scheduled_at) AS oldestDueAt
      FROM queued_signals
      WHERE sent = 0 AND scheduled_at <= datetime('now')
    `).first(),
    db.prepare(`
      SELECT
        COUNT(*) AS alerts24,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors24,
        SUM(CASE WHEN error LIKE '%為 0%' OR error LIKE '%plot 沒取到%' THEN 1 ELSE 0 END) AS zero24
      FROM tv_alert_logs
      WHERE created_at >= datetime('now', '-24 hours')
    `).first()
  ]);
  const deliveryRows = deliveryLogs.results || [];
  const deliveryBySignal = new Map();
  for (const row of deliveryRows) {
    const key = String(row.target || '');
    if (key && !deliveryBySignal.has(key)) deliveryBySignal.set(key, row);
  }
  const delivered24 = deliveryRows.filter((row) => (
    row.action === 'tv_signal_delivery_done' || row.action === 'admin_signal_delivery_done'
  ) && Date.now() - Date.parse(String(row.created_at || '').replace(' ', 'T') + 'Z') <= 86400000).length;
  const items = (logs.results || []).map((log) => {
    const delivery = log.signal_uid ? deliveryBySignal.get(String(log.signal_uid)) : null;
    return {
      id: log.id,
      created_at: log.created_at,
      source_id: log.source_id,
      strategy_id: log.strategy_id,
      ticker: log.ticker,
      action: log.action,
      status: log.status,
      signal_uid: log.signal_uid,
      error: log.error,
      payload: log.payload,
      delivery,
      diagnosis: diagnoseDeliveryLog(log, delivery)
    };
  });
  return {
    stats: {
      alerts24: Number(stats?.alerts24 || 0),
      errors24: Number(stats?.errors24 || 0),
      zero24: Number(stats?.zero24 || 0),
      delivered24,
      queuedDue: Number(queue?.due || 0)
    },
    items,
    deliveryLogs: deliveryRows.slice(0, 20),
    queue: {
      due: Number(queue?.due || 0),
      oldestDueAt: queue?.oldestDueAt || null
    },
    adminTargets: (CONFIG.ADMIN_IDS || []).filter(isTelegramChatId).length
  };
}

async function buildAdminTestSignal(db, payload = {}) {
  const ticker = String(payload.ticker || payload.symbol || payload.instrument || '').trim().toUpperCase();
  const action = String(payload.action || '').toUpperCase();
  const signalType = String(payload.signal_type || payload.signalType || 'scalp').toLowerCase();
  const entry = asNumber(payload.entry_price ?? payload.entry);
  const stopLoss = asNumber(payload.stop_loss ?? payload.stop);
  const tp1 = asNumber(payload.tp1);
  const tp2 = asNumber(payload.tp2);
  const tp3 = asNumber(payload.tp3);
  const probability = normalizeProbabilityValue(payload.probability ?? payload.confidence ?? payload.win_rate ?? payload.winRate);
  if (!ticker) throw new Error('請輸入品種');
  if (!['LONG', 'SHORT'].includes(action)) throw new Error('方向必須是 LONG 或 SHORT');
  if (!CONFIG.SIGNAL_TYPES[signalType]) throw new Error('訊號類型不正確');
  if (entry === null || stopLoss === null || tp1 === null) throw new Error('測試發送需要進場、止損、TP1');
  assertNoZeroSignalLevels('管理員測試訊號', { entry, stopLoss, tp1, tp2, tp3 });
  if (action === 'LONG' && stopLoss >= entry) throw new Error('做多訊號的止損必須低於進場');
  if (action === 'SHORT' && stopLoss <= entry) throw new Error('做空訊號的止損必須高於進場');
  const targets = [tp1, tp2, tp3].filter((value) => value !== null);
  if (action === 'LONG' && targets.some((value) => value <= entry)) throw new Error('做多訊號的目標價必須高於進場');
  if (action === 'SHORT' && targets.some((value) => value >= entry)) throw new Error('做空訊號的目標價必須低於進場');
  const symbol = await db.prepare('SELECT symbol FROM symbols WHERE symbol = ? AND is_active = 1').bind(ticker).first();
  if (!symbol) throw new Error(`${ticker} 尚未啟用，請先到品種管理新增或啟用`);
  const targetGroup = String(payload.target_group || payload.targetGroup || 'pro').trim().toLowerCase() || 'pro';
  return {
    signal_uid: `TEST-${genUID()}`,
    ticker,
    action,
    signal_type: signalType,
    entry_price: entry,
    stop_loss: stopLoss,
    tp1,
    tp2,
    tp3,
    probability,
    target_group: targetGroup,
    is_vip_only: targetGroup === 'vip' ? 1 : 0,
    status: 'test',
    note: String(payload.note || '管理員測試發送，不會推送會員。').slice(0, 500),
    created_at: new Date().toISOString()
  };
}

async function sendAdminSignalTest(db, adminId, payload = {}, env = {}) {
  loadRuntimeConfig(env);
  if (!CONFIG.BOT_TOKEN) throw new Error('BOT_TOKEN 尚未設定，無法發送 Telegram 測試');
  const admins = (CONFIG.ADMIN_IDS || []).filter(isTelegramChatId);
  if (!admins.length) throw new Error('ADMIN_IDS 尚未設定可發送的 Telegram ID');
  const startedAt = Date.now();
  const signal = await buildAdminTestSignal(db, payload);
  const card = formatSignalCard(signal, null, true);
  const message = `🧪 <b>管理員測試發送</b>\n\n${card}\n\n此訊息只發給 ADMIN_IDS，不會發給會員。`;
  const kb = {
    inline_keyboard: [[
      { text: '開啟後台', url: `${publicBaseUrl(env)}/admin` },
      { text: '會員中心', url: memberPortalUrl(env) }
    ]]
  };
  let sent = 0;
  const results = [];
  for (const chatId of admins) {
    const result = await sendTg(chatId, message, kb, { disablePreview: true });
    if (result?.ok) sent += 1;
    results.push({ chatId, ok: !!result?.ok, error: result?.description || '' });
  }
  const ms = Date.now() - startedAt;
  await logAction(db, adminId, 'admin_signal_test', signal.signal_uid, `sent ${sent}/${admins.length}, ms ${ms}`);
  return { signalUid: signal.signal_uid, sent, total: admins.length, ms, results };
}

async function createAdminSignal(db, adminId, payload, env = {}, options = {}) {
  await ensureAdminSchema(db);
  const ticker = String(payload.ticker || payload.symbol || payload.instrument || '').trim().toUpperCase();
  const action = String(payload.action || '').toUpperCase();
  const signalType = String(payload.signal_type || payload.signalType || 'scalp').toLowerCase();
  const entry = asNumber(payload.entry_price ?? payload.entry);
  const stopLoss = asNumber(payload.stop_loss ?? payload.stop);
  const tp1 = asNumber(payload.tp1);
  const tp2 = asNumber(payload.tp2);
  const tp3 = asNumber(payload.tp3);
  const probability = normalizeProbabilityValue(payload.probability ?? payload.confidence ?? payload.win_rate ?? payload.winRate);

  if (!ticker) throw new Error('請輸入品種');
  if (!['LONG', 'SHORT'].includes(action)) throw new Error('方向必須是 LONG 或 SHORT');
  if (!CONFIG.SIGNAL_TYPES[signalType]) throw new Error('訊號類型不正確');
  if (entry === null || stopLoss === null || tp1 === null) throw new Error('進場、止損、TP1 為必填數字');
  assertNoZeroSignalLevels('手動訊號', { entry, stopLoss, tp1, tp2, tp3 });
  if (action === 'LONG' && stopLoss >= entry) throw new Error('做多訊號的止損必須低於進場');
  if (action === 'SHORT' && stopLoss <= entry) throw new Error('做空訊號的止損必須高於進場');
  const targets = [tp1, tp2, tp3].filter((value) => value !== null);
  if (action === 'LONG' && targets.some((value) => value <= entry)) throw new Error('做多訊號的目標價必須高於進場');
  if (action === 'SHORT' && targets.some((value) => value >= entry)) throw new Error('做空訊號的目標價必須低於進場');
  const symbol = await db.prepare('SELECT symbol FROM symbols WHERE symbol = ? AND is_active = 1').bind(ticker).first();
  if (!symbol) throw new Error(`${ticker} 尚未啟用，請先到品種管理新增或啟用`);

  const sendNow = payload.send !== false;
  const targetGroup = String(payload.target_group || payload.targetGroup || (payload.is_vip_only ? 'vip' : 'all')).trim().toLowerCase() || 'all';
  if (!['all', 'pro', 'vip', 'paid'].includes(targetGroup)) throw new Error('發送目標不正確');
  const isVipOnly = payload.is_vip_only === true || payload.isVipOnly === true || targetGroup === 'vip';
  const chartUrl = cleanUrl(payload.chart_url || payload.chartUrl || payload.chart);
  const snapshotUrl = cleanUrl(payload.snapshot_url || payload.snapshotUrl || payload.image_url || payload.imageUrl || payload.screenshot_url || payload.screenshotUrl);
  const paused = await getConfig(db, 'signals_paused');
  if (sendNow && paused === '1') throw new Error('訊號目前已暫停，請先恢復或儲存草稿');

  const signalUid = genUID();
  const deferDelivery = Boolean(options.deferDelivery && sendNow);
  let autoClosed = [];
  if (sendNow) {
    autoClosed = await closeActiveSignalsForReplacement(db, { signal_uid: signalUid, ticker, action, entry_price: entry }, adminId, env, !deferDelivery);
  }
  await db.prepare(`
    INSERT INTO signals (
      signal_uid, ticker, action, signal_type, entry_price, stop_loss,
      tp1, tp2, tp3, probability, note, chart_url, snapshot_url, target_group, is_vip_only, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    signalUid, ticker, action, signalType, entry, stopLoss,
    tp1, tp2, tp3, probability, payload.note || null, chartUrl || null, snapshotUrl || null, targetGroup, isVipOnly ? 1 : 0, sendNow ? 'active' : 'pending'
  ).run();

  const signal = {
    signal_uid: signalUid,
    ticker,
    action,
    signal_type: signalType,
    entry_price: entry,
    stop_loss: stopLoss,
    tp1,
    tp2,
    tp3,
    probability,
    note: payload.note || '',
    chart_url: chartUrl,
    snapshot_url: snapshotUrl,
    target_group: targetGroup,
    is_vip_only: isVipOnly ? 1 : 0
  };

  let delivery = { sent: 0, queued: 0, skipped: 0, total: 0 };
  let autoTrade = { status: AUTO_TRADE_STATUS.skipped, reason: 'not_sent' };
  if (sendNow) {
    if (deferDelivery) {
      delivery = { deferred: true, sent: 0, queued: 0, skipped: 0, total: 0 };
      autoTrade = { status: AUTO_TRADE_STATUS.queued, deferred: true };
    } else {
      delivery = await broadcastSignal(db, signal, env);
      await db.prepare('UPDATE signals SET sent_count = ? WHERE signal_uid = ?').bind(delivery.sent, signalUid).run();
      autoTrade = await dispatchAutoTradeForSignal(env, signal, { autoClosed });
    }
  }
  await logAction(db, adminId, sendNow ? 'web_signal_send' : 'web_signal_draft', signalUid, `${action} ${ticker} @${targetGroup}`);
  return { signalUid, delivery, autoClosed, autoTrade, deferred: deferDelivery };
}

// 部分止盈：TP1/TP2 命中 → 移動止損保本續抱，不平倉
async function applyPartialTakeProfit(db, actorId, signal, type, price, notify = true) {
  const level = type === 'TP2' ? 2 : 1;
  const pnl = signal.action === 'LONG' ? price - signal.entry_price : signal.entry_price - price;
  // TP1 → 止損移到進場價（保本）；TP2 → 止損移到 TP1（無 TP1 則進場價）
  const newStop = level === 1
    ? signal.entry_price
    : (signal.tp1 != null ? signal.tp1 : signal.entry_price);
  await db.prepare('UPDATE signals SET stop_loss = ?, tp_hit_level = ? WHERE signal_uid = ?')
    .bind(newStop, level, signal.signal_uid).run();
  await db.prepare(`
    INSERT INTO performance (signal_uid, ticker, direction, signal_type, entry_price, exit_price, pnl_points, result, exit_reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'win', ?, datetime('now'))
  `).bind(signal.signal_uid, signal.ticker, signal.action, signal.signal_type, signal.entry_price, price, pnl, type).run();
  const beText = level === 1
    ? `止損已上移到進場價 ${fmtPrice(signal.entry_price)}（保本），續抱 TP2 / TP3。`
    : `止損已上移到 TP1 ${fmtPrice(newStop)}，續抱 TP3。`;
  let delivery = { sent: 0 };
  if (notify !== false) {
    delivery = await broadcastExit(db, type, signal.ticker, price, pnl, `部分止盈 🎉 ${beText}`, signal.signal_uid);
  }
  if (actorId) await logAction(db, actorId, `partial_${type.toLowerCase()}`, signal.ticker, `${fmtPrice(price)} → SL ${fmtPrice(newStop)}`);
  return { signalUid: signal.signal_uid, pnl, result: 'win', newStop, level, status: 'active', delivery };
}

async function closeAdminSignal(db, adminId, signalUid, payload) {
  const signal = await db.prepare('SELECT * FROM signals WHERE signal_uid = ?').bind(signalUid).first();
  if (!signal) throw new Error('找不到訊號');
  if (signal.status !== 'active') throw new Error('只有已發送且進行中的訊號可以結案');

  const price = asNumber(payload.price);
  if (price === null) throw new Error('請輸入結案價格');

  const type = String(payload.type || 'CLOSE').toUpperCase();
  if (!['CLOSE', 'TP1', 'TP2', 'TP3', 'SL', 'AUTO'].includes(type)) throw new Error('結案類型不正確');

  // TP1 / TP2 改為部分止盈：移動止損保本續抱，不結案
  if (type === 'TP1' || type === 'TP2') {
    return applyPartialTakeProfit(db, adminId, signal, type, price, payload.notify);
  }
  const reason = String(payload.reason || (type === 'SL' ? '止損觸發' : '手動平倉')).trim();
  const closed = await closeSignalRecord(db, signal, price, type, reason || type);

  let delivery = { sent: 0 };
  if (payload.notify !== false) {
    const note = closed.tpHitsText ? `${reason}\n已達 ${closed.tpHitsText}` : reason;
    delivery = await broadcastExit(db, type, signal.ticker, price, closed.pnl, note, signalUid);
  }
  await logAction(db, adminId, 'web_signal_close', signalUid, `${type} ${price}`);
  return { signalUid, pnl: closed.pnl, result: closed.result, tpHitCount: closed.tpHitCount, tpHitsText: closed.tpHitsText, delivery };
}

async function deleteSignalCascade(db, signalUid) {
  const deletes = {};
  const statements = [
    ['queued_signals', 'DELETE FROM queued_signals WHERE signal_uid = ?'],
    ['user_executions', 'DELETE FROM user_executions WHERE signal_uid = ?'],
    ['performance', 'DELETE FROM performance WHERE signal_uid = ?'],
    ['auto_trade_orders', 'DELETE FROM auto_trade_orders WHERE signal_uid = ?'],
    ['tv_alert_logs', 'DELETE FROM tv_alert_logs WHERE signal_uid = ?'],
    ['signals', 'DELETE FROM signals WHERE signal_uid = ?']
  ];
  for (const [table, sql] of statements) {
    try {
      const result = await db.prepare(sql).bind(signalUid).run();
      deletes[table] = result?.meta?.changes || 0;
    } catch (e) {
      deletes[table] = 0;
    }
  }
  return deletes;
}

async function deleteAdminSignal(db, adminId, signalUid, payload = {}) {
  const signal = await db.prepare('SELECT * FROM signals WHERE signal_uid = ?').bind(signalUid).first();
  if (!signal) throw new Error('找不到訊號');
  if (signal.status === 'active' && !payload.force) throw new Error('進行中的訊號不可直接刪除，請先結案或傳 force=true');
  const deleted = await deleteSignalCascade(db, signalUid);
  await logAction(db, adminId, 'web_signal_delete', signalUid, `${signal.ticker} ${signal.status}`);
  return { signalUid, deleted };
}

async function purgeAdminSignals(db, adminId, payload = {}) {
  const statuses = parseList(payload.statuses || 'closed,cancelled')
    .map((status) => String(status || '').trim().toLowerCase())
    .filter((status) => ['pending', 'closed', 'cancelled'].includes(status));
  if (!statuses.length) throw new Error('請指定可清理狀態：pending, closed, cancelled');
  const before = adminDateKey(payload.before || '');
  const olderThanDays = Math.max(1, Math.min(3650, Number(payload.olderThanDays || 90)));
  const limit = Math.max(1, Math.min(1000, Number(payload.limit || 300)));
  const cutoffExpr = before ? '?' : "datetime('now', ?)";
  const cutoffBind = before ? `${before} 23:59:59` : `-${olderThanDays} days`;
  const placeholders = statuses.map(() => '?').join(',');
  const rows = await db.prepare(`
    SELECT signal_uid, ticker, status, created_at
    FROM signals
    WHERE status IN (${placeholders})
      AND created_at < ${cutoffExpr}
    ORDER BY created_at ASC
    LIMIT ?
  `).bind(...statuses, cutoffBind, limit).all();
  const signals = rows.results || [];
  if (payload.dryRun) return { matched: signals.length, deleted: 0, signals };
  let deleted = 0;
  const details = [];
  for (const signal of signals) {
    const result = await deleteSignalCascade(db, signal.signal_uid);
    deleted += result.signals || 0;
    details.push({ signalUid: signal.signal_uid, ticker: signal.ticker, status: signal.status, deleted: result });
  }
  await logAction(db, adminId, 'web_signal_purge', statuses.join(','), `deleted ${deleted}`);
  return { matched: signals.length, deleted, details };
}

async function sendPendingAdminSignal(db, adminId, signalUid, env = {}, options = {}) {
  const signal = await db.prepare('SELECT * FROM signals WHERE signal_uid = ?').bind(signalUid).first();
  if (!signal) throw new Error('找不到訊號');
  if (signal.status !== 'pending') throw new Error('只有草稿訊號可以發送');

  const paused = await getConfig(db, 'signals_paused');
  if (paused === '1') throw new Error('訊號目前已暫停，請先恢復發訊');

  const deferDelivery = Boolean(options.deferDelivery);
  const autoClosed = await closeActiveSignalsForReplacement(db, signal, adminId, env, !deferDelivery);
  let delivery = { deferred: true, sent: 0, queued: 0, skipped: 0, total: 0 };
  let autoTrade = { status: AUTO_TRADE_STATUS.queued, deferred: true };
  if (!deferDelivery) {
    delivery = await broadcastSignal(db, signal, env);
    autoTrade = await dispatchAutoTradeForSignal(env, signal, { autoClosed });
  }
  await db.prepare(`
    UPDATE signals
    SET status = 'active', sent_count = ?, created_at = datetime('now')
    WHERE signal_uid = ?
  `).bind(delivery.sent || 0, signalUid).run();
  await db.prepare("UPDATE tv_alert_logs SET status = 'active' WHERE signal_uid = ?").bind(signalUid).run();
  await logAction(db, adminId, 'web_signal_release', signalUid, `${signal.action} ${signal.ticker}`);
  return { signalUid, delivery, autoClosed, autoTrade, deferred: deferDelivery };
}

async function upsertAdminSymbol(db, payload) {
  await ensureAdminSchema(db);
  const symbol = String(payload.symbol || '').trim().toUpperCase();
  if (!symbol) throw new Error('請輸入品種代碼');
  const name = String(payload.name || symbol).trim();
  const nameZh = String(payload.name_zh || payload.nameZh || '').trim() || null;
  const category = String(payload.category || 'index').trim();
  const tickSize = asNumber(payload.tick_size ?? payload.tickSize, 0.25);
  const tickValue = asNumber(payload.tick_value ?? payload.tickValue, 5);
  const isActive = payload.is_active === false || payload.isActive === false ? 0 : 1;
  const sortOrder = asNumber(payload.sort_order ?? payload.sortOrder, 0);
  const defaultStopRaw = asNumber(payload.default_stop_points ?? payload.defaultStopPoints, null);
  const defaultTpRaw = asNumber(payload.default_tp_spacing ?? payload.defaultTpSpacing, null);
  const defaultStop = Number.isFinite(defaultStopRaw) && defaultStopRaw > 0 ? defaultStopRaw : null;
  const defaultTp = Number.isFinite(defaultTpRaw) && defaultTpRaw > 0 ? defaultTpRaw : null;
  const levelModeRaw = String(payload.default_level_mode ?? payload.defaultLevelMode ?? 'auto').trim().toLowerCase();
  const levelMode = ['auto', 'fixed', 'rmultiple'].includes(levelModeRaw) ? levelModeRaw : 'auto';

  await db.prepare(`
    INSERT INTO symbols (symbol, name, name_zh, category, tick_size, tick_value, is_active, sort_order, default_stop_points, default_tp_spacing, default_level_mode)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(symbol) DO UPDATE SET
      name = excluded.name,
      name_zh = excluded.name_zh,
      category = excluded.category,
      tick_size = excluded.tick_size,
      tick_value = excluded.tick_value,
      is_active = excluded.is_active,
      sort_order = excluded.sort_order,
      default_stop_points = excluded.default_stop_points,
      default_tp_spacing = excluded.default_tp_spacing,
      default_level_mode = excluded.default_level_mode
  `).bind(symbol, name, nameZh, category, tickSize, tickValue, isActive, sortOrder, defaultStop, defaultTp, levelMode).run();
  return { symbol };
}

async function upsertAdminStrategy(db, payload) {
  await ensureAdminSchema(db);
  const name = String(payload.name || '').trim();
  if (!name) throw new Error('請輸入策略名稱');
  const strategyId = slugify(payload.strategy_id || payload.strategyId || name, 'strategy');
  const description = String(payload.description || '').trim();
  const tier = ['free', 'pro', 'vip'].includes(payload.tier) ? payload.tier : 'pro';
  const isActive = payload.is_active === false || payload.isActive === false ? 0 : 1;
  const sortOrder = asNumber(payload.sort_order ?? payload.sortOrder, 0);
  const signalTypes = cleanListValue(payload.signal_types ?? payload.signalTypes);
  const symbols = cleanListValue(payload.symbols);
  const rawRules = payload.rules_json ?? payload.rulesJson;
  const rules = rawRules === undefined || rawRules === ''
    ? { riskPoints: 30, targetR: [1, 2, 3], entryMode: 'close' }
    : parseObject(rawRules, null);
  if (!rules) throw new Error('風控規則 JSON 格式不正確');
  const rulesJson = JSON.stringify(rules);
  const tvAlertTemplate = String(payload.tv_alert_template || payload.tvAlertTemplate || '').trim();
  const note = String(payload.note || '').trim();

  await db.prepare(`
    INSERT INTO strategies (strategy_id, name, description, signal_types, symbols, tier, is_active, sort_order, rules_json, tv_alert_template, note, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(strategy_id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      signal_types = excluded.signal_types,
      symbols = excluded.symbols,
      tier = excluded.tier,
      is_active = excluded.is_active,
      sort_order = excluded.sort_order,
      rules_json = excluded.rules_json,
      tv_alert_template = excluded.tv_alert_template,
      note = excluded.note,
      updated_at = datetime('now')
  `).bind(strategyId, name, description, signalTypes, symbols, tier, isActive, sortOrder, rulesJson, tvAlertTemplate || null, note).run();
  return { strategyId };
}

async function updateAdminUser(db, adminId, userId, payload) {
  const data = {};
  const settingsData = {};
  if (payload.tier && ['free', 'pro', 'vip'].includes(payload.tier)) data.tier = payload.tier;
  if (payload.days !== undefined) {
    const days = asNumber(payload.days, 0);
    if (days > 0) {
      const user = await getUser(db, userId);
      const base = user.tier_expires_at && new Date(user.tier_expires_at) > new Date()
        ? new Date(user.tier_expires_at)
        : new Date();
      data.tier_expires_at = new Date(base.getTime() + days * 86400000).toISOString();
    }
  }
  if (payload.is_banned !== undefined || payload.isBanned !== undefined) data.is_banned = payload.is_banned || payload.isBanned ? 1 : 0;
  if (payload.admin_note !== undefined || payload.adminNote !== undefined) data.admin_note = String(payload.admin_note ?? payload.adminNote ?? '');
  if (payload.subscribed_symbols !== undefined || payload.subscribedSymbols !== undefined) {
    settingsData.subscribed_symbols = cleanListValue(payload.subscribed_symbols ?? payload.subscribedSymbols);
  }
  if (payload.signal_types !== undefined || payload.signalTypes !== undefined) {
    settingsData.signal_types = cleanListValue(payload.signal_types ?? payload.signalTypes);
  }
  for (const key of ['notify_entry', 'notify_tp', 'notify_sl', 'notify_update', 'notify_alert', 'paused']) {
    if (payload[key] !== undefined) settingsData[key] = payload[key] ? 1 : 0;
  }
  if (Object.keys(data).length === 0 && Object.keys(settingsData).length === 0) throw new Error('沒有可更新的用戶欄位');
  if (Object.keys(data).length) await updateUser(db, userId, data);
  if (Object.keys(settingsData).length) {
    await getUserSettings(db, userId);
    await updateUserSettings(db, userId, settingsData);
  }
  await logAction(db, adminId, 'web_user_update', userId, JSON.stringify({ user: data, settings: settingsData }));
  return { userId };
}

function isOrderRefunded(order) {
  return !!(order && order.refunded_at);
}

function orderRefundMoney(order) {
  const currency = String(order?.currency || 'TWD').toUpperCase();
  return `${currency} ${fmtNum(Number(order?.refund_amount || order?.amount || 0))}`;
}

async function refundOrderRecord(db, actorId, order, payload = {}) {
  await ensureOrderPaymentSchema(db);
  const orderId = String(order?.order_id || '').toUpperCase();
  if (!orderId) throw new Error('找不到訂單');
  if (isOrderRefunded(order)) throw new Error('此訂單已記錄退款');
  if (!['paid', 'confirmed'].includes(order.status)) throw new Error('只有已付款或已確認訂單可記錄退款');

  const orderAmount = Number(order.amount || 0);
  const requestedAmount = asNumber(payload.amount ?? payload.refund_amount ?? payload.refundAmount, null);
  const refundAmount = requestedAmount == null ? orderAmount : requestedAmount;
  if (!Number.isFinite(refundAmount) || refundAmount <= 0) throw new Error('退款金額不正確');
  if (orderAmount > 0 && refundAmount > orderAmount + 0.01) throw new Error('退款金額不可大於訂單金額');

  const reason = String(payload.reason || payload.note || payload.refund_note || '人工退款').trim() || '人工退款';
  const revokeAccess = boolAccepted(payload.revoke_access ?? payload.revokeAccess ?? payload.revoke ?? true);
  const notify = payload.notify !== false;
  const existingNote = String(order.payment_note || '').trim();
  const refundLine = `退款：${orderRefundMoney({ ...order, refund_amount: refundAmount })}｜${reason}`;
  const paymentNote = existingNote ? `${existingNote}\n${refundLine}` : refundLine;

  const user = await getUser(db, order.user_id);
  const userPatch = {};
  if (order.status === 'confirmed') {
    userPatch.total_spent = Math.max(0, Number(user.total_spent || 0) - refundAmount);
  }

  let accessRevoked = false;
  let revokeNote = '既有會員權限未異動';
  if (revokeAccess && order.status === 'confirmed') {
    const laterOrder = order.created_at ? await db.prepare(`
      SELECT order_id FROM orders
      WHERE user_id = ?
        AND order_id <> ?
        AND status = 'confirmed'
        AND refunded_at IS NULL
        AND datetime(created_at) > datetime(?)
      ORDER BY created_at DESC LIMIT 1
    `).bind(order.user_id, orderId, order.created_at).first() : null;
    if (!laterOrder && String(user.tier || '') === String(order.tier || '')) {
      userPatch.tier = 'free';
      userPatch.tier_expires_at = null;
      accessRevoked = true;
      revokeNote = '會員權限已同步停用';
    } else if (laterOrder) {
      revokeNote = `偵測到較新的已確認訂單 ${laterOrder.order_id}，會員權限保留`;
    } else {
      revokeNote = '會員目前方案不同，權限保留';
    }
  }
  if (Object.keys(userPatch).length) await updateUser(db, order.user_id, userPatch);

  await db.prepare(`
    UPDATE orders
    SET status = 'cancelled',
        refunded_at = datetime('now'),
        refund_amount = ?,
        refund_note = ?,
        refunded_by = ?,
        payment_note = ?
    WHERE order_id = ?
  `).bind(refundAmount, reason, String(actorId || ''), paymentNote, orderId).run();

  await recordOrderEvent(db, orderId, order.user_id, 'refunded', actorId, `退款 ${orderRefundMoney({ ...order, refund_amount: refundAmount })}｜${reason}`, {
    amount: refundAmount,
    currency: String(order.currency || 'TWD').toUpperCase(),
    previousStatus: order.status,
    revokeAccess,
    accessRevoked
  });

  if (notify) {
    await sendMemberNotice(order.user_id, [
      '💸 <b>訂單已記錄退款</b>',
      '',
      `訂單：<code>${escHtml(orderId)}</code>`,
      `金額：<b>${escHtml(orderRefundMoney({ ...order, refund_amount: refundAmount }))}</b>`,
      `原因：${escHtml(reason)}`,
      `會員權限：${escHtml(revokeNote)}`
    ].join('\n'), {
      inline_keyboard: [
        [{ text: '查看訂單', callback_data: `u_order_${orderId}` }],
        [{ text: '我的訂單', callback_data: 'u_orders' }]
      ]
    }, { db });
  }

  await logAction(db, actorId, payload.action || 'order_refund', orderId, `${refundAmount} ${reason}`);
  return { orderId, status: 'refunded', refundAmount, accessRevoked, note: revokeNote };
}

function financeMoney(value) {
  return `NT$${fmtNum(Math.round(Number(value || 0)))}`;
}

function financePercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function renderFinanceReportText(metrics, mode = 'revenue') {
  const titleMap = {
    revenue: '財務營收',
    arpu: 'ARPU / 客單',
    churn: '會員流失',
    lifetime: 'LTV / 生命週期價值'
  };
  const title = titleMap[mode] || titleMap.revenue;
  let m = `<b>${title}</b>\n\n`;
  m += `淨營收：<b>${financeMoney(metrics.netRevenue)}</b>\n`;
  m += `總收款：${financeMoney(metrics.grossRevenue)}\n`;
  m += `退款：${financeMoney(metrics.refunds)}（${financePercent(metrics.refundRate)}）\n\n`;
  m += `<b>近期</b>\n`;
  m += `今日淨收：${financeMoney(metrics.netRevenueToday)}\n`;
  m += `7 日淨收：${financeMoney(metrics.netRevenue7)}\n`;
  m += `30 日淨收：${financeMoney(metrics.netRevenue30)}\n`;
  m += `待處理訂單：${metrics.pendingOrderCount} 筆 / ${financeMoney(metrics.pendingOrderValue)}\n\n`;
  m += `<b>會員價值</b>\n`;
  m += `付費會員：${metrics.activePaidUsers} 位\n`;
  m += `付費客戶：${metrics.payingCustomers} 位\n`;
  m += `ARPU 30D：${financeMoney(metrics.arpu30)}\n`;
  m += `平均客單：${financeMoney(metrics.avgOrderValue)}\n`;
  m += `LTV：${financeMoney(metrics.ltv)}\n\n`;
  m += `<b>流失</b>\n`;
  m += `7 日內到期：${metrics.expiringPaidUsers7} 位\n`;
  m += `30 日流失/到期：${metrics.expiredPaidUsers30} 位\n`;
  m += `30 日流失率：${financePercent(metrics.churnRate30)}`;
  return m;
}

async function handleAdminOrderAction(db, adminId, orderId, action, payload = {}) {
  const normalizedOrderId = String(orderId || '').toUpperCase();
  const order = await db.prepare('SELECT * FROM orders WHERE order_id = ?').bind(normalizedOrderId).first();
  if (!order) throw new Error('找不到訂單');

  if (action === 'confirm') {
    if (isOrderRefunded(order)) throw new Error('此訂單已退款，無法確認');
    return confirmOrderRecord(db, adminId, order, {
      notify: payload.notify,
      paymentMethod: order.payment_method || 'manual',
      paymentProvider: order.payment_provider || order.payment_method || 'manual',
      action: 'web_order_confirm'
    });
  }

  if (action === 'reject') {
    const reason = String(payload.reason || '未說明');
    await db.prepare("UPDATE orders SET status = 'rejected' WHERE order_id = ?").bind(normalizedOrderId).run();
    await recordOrderEvent(db, normalizedOrderId, order.user_id, 'rejected', adminId, reason, { source: 'admin-web' });
    if (payload.notify !== false) await sendMemberNotice(order.user_id, `❌ <b>訂單已取消</b>\n\n訂單：${normalizedOrderId}\n原因：${reason}`, null, { db });
    await logAction(db, adminId, 'web_order_reject', normalizedOrderId, reason);
    return { orderId: normalizedOrderId, status: 'rejected' };
  }

  if (action === 'refund') {
    return refundOrderRecord(db, adminId, order, {
      ...payload,
      action: 'web_order_refund'
    });
  }

  throw new Error('不支援的訂單操作');
}

// ═══════════════════════════════════════════════════════════════════════════════
// Member Web Portal
// ═══════════════════════════════════════════════════════════════════════════════

const MEMBER_SESSION_COOKIE = 'dc_member_session';
const MEMBER_OAUTH_COOKIE = 'dc_oauth_state';
const MEMBER_SESSION_TTL = 30 * 86400;
const MEMBER_OAUTH_TTL = 10 * 60;
const MEMBER_PASSWORD_ITERATIONS = 100000;
const ORDER_TERMS_VERSION = '2026-06-13';
const MEMBER_PORTAL_PATH = '/m';

function memberPortalUrl(env = {}) {
  return `${publicBaseUrl(env)}${MEMBER_PORTAL_PATH}`;
}

function memberTermsUrl(env = {}) {
  return `${publicBaseUrl(env)}/terms`;
}

function memberPolicyUrl(env = {}, path = '/terms') {
  return `${publicBaseUrl(env)}${path}`;
}

function genLoginCode() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 1000000).padStart(6, '0');
}

async function ensureMemberLoginSchema(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS member_login_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      used_at TEXT
    )
  `).run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_member_login_codes_user ON member_login_codes(user_id, created_at)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_member_login_codes_expires ON member_login_codes(expires_at)').run();
}

async function ensureMemberOAuthSchema(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS member_oauth_identities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      email TEXT,
      display_name TEXT,
      avatar_url TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      last_login_at TEXT,
      UNIQUE(provider, provider_user_id)
    )
  `).run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_member_oauth_user ON member_oauth_identities(user_id)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_member_oauth_provider ON member_oauth_identities(provider, provider_user_id)').run();
}

async function ensureMemberPasswordSchema(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS member_password_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      user_id TEXT UNIQUE NOT NULL,
      display_name TEXT,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      iterations INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      last_login_at TEXT
    )
  `).run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_member_password_email ON member_password_accounts(email)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_member_password_user ON member_password_accounts(user_id)').run();
}

async function ensureOrderPaymentSchema(db) {
  await addColumnIfMissing(db, 'orders', 'payment_provider', 'TEXT');
  await addColumnIfMissing(db, 'orders', 'payment_session_id', 'TEXT');
  await addColumnIfMissing(db, 'orders', 'payment_url', 'TEXT');
  await addColumnIfMissing(db, 'orders', 'currency', 'TEXT');
  await addColumnIfMissing(db, 'orders', 'paid_at', 'TEXT');
  await addColumnIfMissing(db, 'orders', 'refunded_at', 'TEXT');
  await addColumnIfMissing(db, 'orders', 'refund_amount', 'REAL');
  await addColumnIfMissing(db, 'orders', 'refund_note', 'TEXT');
  await addColumnIfMissing(db, 'orders', 'refunded_by', 'TEXT');
  await addColumnIfMissing(db, 'orders', 'terms_version', 'TEXT');
  await addColumnIfMissing(db, 'orders', 'terms_accepted_at', 'TEXT');
  await addColumnIfMissing(db, 'orders', 'risk_acknowledged_at', 'TEXT');
  await addColumnIfMissing(db, 'orders', 'terms_client_hash', 'TEXT');
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_orders_payment_provider ON orders(payment_provider)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_orders_payment_session ON orders(payment_session_id)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_orders_refunded_at ON orders(refunded_at)').run();
  await ensureOrderEventSchema(db);
}

async function ensureOrderEventSchema(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS order_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      user_id TEXT,
      event_type TEXT NOT NULL,
      actor_id TEXT,
      message TEXT,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events(order_id, created_at)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_order_events_created ON order_events(created_at)').run();
}

async function ensureSupportSchema(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'open' CHECK(status IN ('open', 'pending', 'closed')),
      priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
      last_reply TEXT,
      last_actor_id TEXT,
      closed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS support_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id TEXT NOT NULL,
      actor_type TEXT NOT NULL CHECK(actor_type IN ('user', 'admin', 'system')),
      actor_id TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id, created_at)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status, updated_at)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_support_replies_ticket ON support_replies(ticket_id, created_at)').run();
}

async function recordOrderEvent(db, orderId, userId, eventType, actorId, message = '', metadata = null) {
  if (!orderId || !eventType) return;
  await ensureOrderEventSchema(db);
  const meta = metadata == null ? null : JSON.stringify(metadata);
  await db.prepare(`
    INSERT INTO order_events (order_id, user_id, event_type, actor_id, message, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(String(orderId).toUpperCase(), userId ? String(userId) : null, String(eventType), actorId ? String(actorId) : null, String(message || ''), meta).run();
}

async function createMemberLoginCode(db, userId) {
  await ensureMemberLoginSchema(db);
  await db.prepare(`
    UPDATE member_login_codes
    SET used_at = datetime('now')
    WHERE user_id = ? AND used_at IS NULL
  `).bind(userId).run();

  for (let i = 0; i < 8; i++) {
    const code = genLoginCode();
    try {
      await db.prepare(`
        INSERT INTO member_login_codes (code, user_id, expires_at)
        VALUES (?, ?, datetime('now', '+10 minutes'))
      `).bind(code, userId).run();
      return code;
    } catch {}
  }
  throw new Error('登入碼產生失敗，請稍後再試');
}

async function loginMemberWithCode(db, env, payload) {
  await ensureMemberLoginSchema(db);
  const code = String(payload.code || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(code)) throw new Error('請輸入 6 位登入碼');

  const row = await db.prepare(`
    SELECT id, user_id FROM member_login_codes
    WHERE code = ? AND used_at IS NULL AND expires_at > datetime('now')
    ORDER BY created_at DESC LIMIT 1
  `).bind(code).first();
  if (!row) throw new Error('登入碼錯誤或已過期，請在 Telegram 重新輸入 /login');

  const result = await db.prepare(`
    UPDATE member_login_codes
    SET used_at = datetime('now')
    WHERE id = ? AND used_at IS NULL
  `).bind(row.id).run();
  if (result?.meta?.changes === 0) throw new Error('登入碼已使用，請重新取得');

  await getUser(db, row.user_id);
  const session = await createMemberSession(row.user_id, env);
  return { session, data: await getMemberBootstrap(db, row.user_id, env) };
}

async function mergeUserOwnedRows(db, currentUserId, telegramUserId) {
  const run = async (sql, ...params) => {
    try { await db.prepare(sql).bind(...params).run(); } catch (e) {}
  };

  await run(`
    INSERT OR IGNORE INTO user_executions (
      user_id, signal_uid, status, actual_entry, actual_contracts, actual_exit,
      actual_pnl, notes, created_at, updated_at
    )
    SELECT ?, signal_uid, status, actual_entry, actual_contracts, actual_exit,
           actual_pnl, notes, created_at, updated_at
    FROM user_executions
    WHERE user_id = ?
  `, currentUserId, telegramUserId);
  await run('DELETE FROM user_executions WHERE user_id = ?', telegramUserId);

  await run(`
    INSERT OR IGNORE INTO group_members (group_name, user_id, added_at)
    SELECT group_name, ?, added_at
    FROM group_members
    WHERE user_id = ?
  `, currentUserId, telegramUserId);
  await run('DELETE FROM group_members WHERE user_id = ?', telegramUserId);

  await run('UPDATE orders SET user_id = ? WHERE user_id = ?', currentUserId, telegramUserId);
  await run('UPDATE order_events SET user_id = ? WHERE user_id = ?', currentUserId, telegramUserId);
  await run('UPDATE order_events SET actor_id = ? WHERE actor_id = ?', currentUserId, telegramUserId);
  await run('UPDATE support_tickets SET user_id = ? WHERE user_id = ?', currentUserId, telegramUserId);
  await run('UPDATE support_tickets SET last_actor_id = ? WHERE last_actor_id = ?', currentUserId, telegramUserId);
  await run('UPDATE support_replies SET actor_id = ? WHERE actor_id = ?', currentUserId, telegramUserId);
  await run('UPDATE point_history SET user_id = ? WHERE user_id = ?', currentUserId, telegramUserId);
  await run('UPDATE member_login_codes SET user_id = ? WHERE user_id = ?', currentUserId, telegramUserId);
  await run('UPDATE member_oauth_identities SET user_id = ? WHERE user_id = ?', currentUserId, telegramUserId);
}

async function mergeTelegramUserSettings(db, currentUserId, telegramUserId, preferTelegram) {
  const telegramSettings = await db.prepare('SELECT * FROM user_settings WHERE user_id = ?').bind(telegramUserId).first();
  if (!telegramSettings) return;
  await getUserSettings(db, currentUserId);

  const currentSettings = await db.prepare('SELECT * FROM user_settings WHERE user_id = ?').bind(currentUserId).first();
  const source = preferTelegram ? telegramSettings : currentSettings;
  const data = {};
  for (const field of [
    'capital', 'risk_percent', 'subscribed_symbols', 'signal_types',
    'notify_entry', 'notify_tp', 'notify_sl', 'notify_update',
    'notify_daily_report', 'notify_weekly_report', 'notify_announcement',
    'notify_alert', 'quiet_enabled', 'quiet_start', 'quiet_end',
    'paused', 'timezone', 'language'
  ]) {
    data[field] = source?.[field] ?? currentSettings?.[field] ?? telegramSettings?.[field];
  }
  await updateUserSettings(db, currentUserId, data);
}

async function mergeTelegramAccountIntoMember(db, currentUserId, telegramUserId, currentUser, telegramUser) {
  const currentEffectiveRank = effectiveTierRank(currentUser);
  const telegramEffectiveRank = effectiveTierRank(telegramUser);
  const preferTelegram = telegramEffectiveRank > currentEffectiveRank;
  const sourceUser = preferTelegram ? telegramUser : currentUser;
  const mergedTier = sourceUser.tier || 'free';
  const mergedExpiry = mergedTier === 'free'
    ? null
    : (!sourceUser.tier_expires_at ? null : latestDateValue(currentUser.tier_expires_at, telegramUser.tier_expires_at));

  await mergeTelegramUserSettings(db, currentUserId, telegramUserId, preferTelegram);
  await mergeUserOwnedRows(db, currentUserId, telegramUserId);

  const mergedNote = `Linked Telegram ${telegramUserId} into ${currentUserId} at ${fmtTime()}`;
  await db.prepare(`
    UPDATE users
    SET telegram_user_id = ?,
        telegram_linked_at = datetime('now'),
        username = COALESCE(NULLIF(username, ''), ?),
        first_name = COALESCE(NULLIF(first_name, ''), ?),
        tier = ?,
        tier_expires_at = ?,
        points = COALESCE(points, 0) + ?,
        referral_count = COALESCE(referral_count, 0) + ?,
        total_signals = COALESCE(total_signals, 0) + ?,
        total_spent = COALESCE(total_spent, 0) + ?,
        referred_by = COALESCE(NULLIF(referred_by, ''), ?),
        last_checkin_at = COALESCE(?, last_checkin_at),
        last_active_at = COALESCE(?, last_active_at),
        is_active = 1,
        is_banned = CASE WHEN COALESCE(is_banned, 0) = 1 OR ? = 1 THEN 1 ELSE 0 END,
        updated_at = datetime('now')
    WHERE user_id = ?
  `).bind(
    telegramUserId,
    telegramUser.username || null,
    telegramUser.first_name || null,
    mergedTier,
    mergedExpiry,
    Number(telegramUser.points || 0),
    Number(telegramUser.referral_count || 0),
    Number(telegramUser.total_signals || 0),
    Number(telegramUser.total_spent || 0),
    telegramUser.referred_by || null,
    latestDateValue(currentUser.last_checkin_at, telegramUser.last_checkin_at),
    latestDateValue(currentUser.last_active_at, telegramUser.last_active_at),
    Number(telegramUser.is_banned || 0),
    currentUserId
  ).run();

  await db.prepare(`
    UPDATE users
    SET tier = 'free',
        tier_expires_at = NULL,
        is_active = 0,
        updated_at = datetime('now'),
        admin_note = COALESCE(NULLIF(admin_note, '') || char(10), '') || ?
    WHERE user_id = ?
  `).bind(mergedNote, telegramUserId).run();
}

async function linkTelegramWithLoginCode(db, env, currentUserId, payload = {}) {
  await ensureMemberLoginSchema(db);
  await ensureTelegramLinkSchema(db);
  const code = String(payload.code || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(code)) throw new Error('請輸入 Telegram /login 取得的 6 位碼');

  const row = await db.prepare(`
    SELECT id, user_id FROM member_login_codes
    WHERE code = ? AND used_at IS NULL AND expires_at > datetime('now')
    ORDER BY created_at DESC LIMIT 1
  `).bind(code).first();
  if (!row) throw new Error('登入碼錯誤或已過期，請在 Telegram 重新輸入 /login');

  const telegramUserId = String(row.user_id || '');
  if (!isTelegramChatId(telegramUserId)) throw new Error('這組登入碼已屬於網站帳號，請用尚未綁定的 Telegram 帳號重新輸入 /login');
  if (String(currentUserId) === telegramUserId) {
    await db.prepare('UPDATE member_login_codes SET used_at = datetime("now") WHERE id = ?').bind(row.id).run();
    return { linked: true, telegramUserId, alreadyTelegramAccount: true };
  }

  const existing = await db.prepare(`
    SELECT user_id FROM users
    WHERE telegram_user_id = ? AND user_id != ?
    LIMIT 1
  `).bind(telegramUserId, currentUserId).first();
  if (existing?.user_id) throw new Error('此 Telegram 已綁定其他會員帳號');

  const currentUser = await getUser(db, currentUserId);
  if (currentUser.telegram_user_id && String(currentUser.telegram_user_id) !== telegramUserId) {
    throw new Error('此網站會員已綁定其他 Telegram');
  }
  const telegramUser = await getUser(db, telegramUserId);
  await mergeTelegramAccountIntoMember(db, currentUserId, telegramUserId, currentUser, telegramUser);
  await db.prepare('UPDATE member_login_codes SET used_at = datetime("now") WHERE id = ?').bind(row.id).run();
  await sendTg(telegramUserId, `✅ <b>Telegram 已綁定會員中心</b>\n\n之後付費訊號、訂單通知與客服回覆會同步推送到此 Telegram。`, {
    inline_keyboard: [[{ text: '開啟會員中心', url: memberPortalUrl(env) }]]
  });
  await logAction(db, currentUserId, 'member_telegram_link', telegramUserId, 'website');
  return { linked: true, telegramUserId, linkedAt: fmtTime() };
}

function normalizeMemberEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('請輸入有效 Email');
  return email;
}

function normalizeMemberDisplayName(value, email) {
  const name = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 64);
  return name || String(email || '').split('@')[0].slice(0, 64) || '網站會員';
}

function validateMemberPassword(value) {
  const password = String(value || '');
  if (password.length < 8) throw new Error('密碼至少需要 8 個字元');
  if (password.length > 128) throw new Error('密碼不可超過 128 個字元');
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) throw new Error('密碼需同時包含英文與數字');
  return password;
}

function randomHex(byteLength = 16) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

async function hashMemberPassword(password, saltHex, iterations = MEMBER_PASSWORD_ITERATIONS) {
  const keyMaterial = await crypto.subtle.importKey('raw', textBytes(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: hexToBytes(saltHex),
    iterations: Number(iterations || MEMBER_PASSWORD_ITERATIONS)
  }, keyMaterial, 256);
  return bytesToHex(new Uint8Array(bits));
}

async function verifyMemberPassword(password, account) {
  if (!account?.password_hash || !account?.password_salt) return false;
  const actual = await hashMemberPassword(password, account.password_salt, account.iterations || MEMBER_PASSWORD_ITERATIONS);
  return timingSafeEqual(actual, account.password_hash);
}

async function webUserIdForEmail(email) {
  const digest = await sha256Hex(`email:${email}`);
  return `web_email_${digest.slice(0, 18)}`;
}

async function registerMemberWithPassword(db, env, payload = {}) {
  await ensureMemberPasswordSchema(db);
  const email = normalizeMemberEmail(payload.email);
  const password = validateMemberPassword(payload.password);
  const displayName = normalizeMemberDisplayName(payload.display_name || payload.displayName || payload.name, email);

  const existing = await db.prepare('SELECT user_id FROM member_password_accounts WHERE email = ?').bind(email).first();
  if (existing?.user_id) throw appError('此 Email 已註冊，請直接登入', 409);

  const userId = await webUserIdForEmail(email);
  const salt = randomHex(16);
  const passwordHash = await hashMemberPassword(password, salt);
  await getUser(db, userId);
  await saveUserInfo(db, userId, email, displayName);
  await db.prepare(`
    INSERT INTO member_password_accounts (email, user_id, display_name, password_hash, password_salt, iterations, created_at, updated_at, last_login_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
  `).bind(email, userId, displayName, passwordHash, salt, MEMBER_PASSWORD_ITERATIONS).run();

  await logAction(db, userId, 'member_password_register', email, 'website');
  const session = await createMemberSession(userId, env);
  return { session, data: await getMemberBootstrap(db, userId, env) };
}

async function loginMemberWithPassword(db, env, payload = {}) {
  await ensureMemberPasswordSchema(db);
  const email = normalizeMemberEmail(payload.email);
  const password = String(payload.password || '');
  const account = await db.prepare('SELECT * FROM member_password_accounts WHERE email = ?').bind(email).first();
  if (!account || !(await verifyMemberPassword(password, account))) throw appError('Email 或密碼不正確', 401);

  await getUser(db, account.user_id);
  await saveUserInfo(db, account.user_id, email, account.display_name || normalizeMemberDisplayName('', email));
  await db.prepare(`
    UPDATE member_password_accounts
    SET last_login_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).bind(account.id).run();

  await logAction(db, account.user_id, 'member_password_login', email, 'website');
  const session = await createMemberSession(account.user_id, env);
  return { session, data: await getMemberBootstrap(db, account.user_id, env) };
}

async function setupMemberPasswordBackup(db, userId, payload = {}) {
  await ensureMemberPasswordSchema(db);
  const email = normalizeMemberEmail(payload.email);
  const password = validateMemberPassword(payload.password || payload.new_password || payload.newPassword);
  const displayName = normalizeMemberDisplayName(payload.display_name || payload.displayName || payload.name, email);

  const current = await db.prepare('SELECT * FROM member_password_accounts WHERE user_id = ?').bind(userId).first();
  if (current?.id) throw appError('此會員已設定網站帳號，請使用更新密碼', 409);

  const existing = await db.prepare('SELECT user_id FROM member_password_accounts WHERE email = ?').bind(email).first();
  if (existing?.user_id && String(existing.user_id) !== String(userId)) {
    throw appError('此 Email 已被其他網站會員使用，請先用該 Email 登入後再綁定 Telegram', 409);
  }

  const salt = randomHex(16);
  const passwordHash = await hashMemberPassword(password, salt);
  await getUser(db, userId);
  await saveUserInfo(db, userId, email, displayName);
  await db.prepare(`
    INSERT INTO member_password_accounts (email, user_id, display_name, password_hash, password_salt, iterations, created_at, updated_at, last_login_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), NULL)
  `).bind(email, userId, displayName, passwordHash, salt, MEMBER_PASSWORD_ITERATIONS).run();

  await logAction(db, userId, 'member_password_backup_setup', email, 'member-center');
  return { enabled: true, email, display_name: displayName, created_at: fmtTime() };
}

async function changeMemberPassword(db, userId, payload = {}) {
  await ensureMemberPasswordSchema(db);
  const currentPassword = String(payload.current_password || payload.currentPassword || '');
  const newPassword = validateMemberPassword(payload.new_password || payload.newPassword);
  if (currentPassword === newPassword) throw new Error('新密碼不可與目前密碼相同');

  const account = await db.prepare('SELECT * FROM member_password_accounts WHERE user_id = ?').bind(userId).first();
  if (!account) throw appError('此帳號尚未設定網站密碼，請使用原登入方式', 400);
  if (!(await verifyMemberPassword(currentPassword, account))) throw appError('目前密碼不正確', 401);

  const salt = randomHex(16);
  const passwordHash = await hashMemberPassword(newPassword, salt);
  await db.prepare(`
    UPDATE member_password_accounts
    SET password_hash = ?, password_salt = ?, iterations = ?, updated_at = datetime('now')
    WHERE id = ?
  `).bind(passwordHash, salt, MEMBER_PASSWORD_ITERATIONS, account.id).run();
  await logAction(db, userId, 'member_password_change', account.email, 'website');
  return { updated: true, passwordUpdatedAt: fmtTime() };
}

async function verifyTelegramLoginPayload(payload, env) {
  const token = env.BOT_TOKEN || CONFIG.BOT_TOKEN;
  if (!token) throw new Error('BOT_TOKEN 尚未設定，無法啟用 Telegram Login');

  const hash = String(payload.hash || '').trim();
  const authDate = Number(payload.auth_date || 0);
  if (!hash || !payload.id || !authDate) throw new Error('Telegram 登入資料不完整');
  if (Math.floor(Date.now() / 1000) - authDate > 86400) throw new Error('Telegram 登入已逾時，請重新登入');

  const dataCheckString = Object.keys(payload)
    .filter((key) => key !== 'hash' && payload[key] !== undefined && payload[key] !== null)
    .sort()
    .map((key) => `${key}=${payload[key]}`)
    .join('\n');
  const secret = await sha256Bytes(token);
  const expected = await hmacHex(secret, dataCheckString);
  if (!timingSafeEqual(expected, hash)) throw new Error('Telegram 登入驗證失敗');

  return {
    userId: String(payload.id),
    username: String(payload.username || ''),
    firstName: String(payload.first_name || ''),
    photoUrl: String(payload.photo_url || '')
  };
}

async function memberSessionSecret(env) {
  return sha256Bytes(env.BOT_TOKEN || env.ADMIN_WEB_PASSWORD || 'dc-member-session');
}

async function createMemberSession(userId, env) {
  const exp = Math.floor(Date.now() / 1000) + MEMBER_SESSION_TTL;
  const payload = base64UrlEncode(JSON.stringify({ uid: String(userId), exp }));
  const sig = await hmacHex(await memberSessionSecret(env), payload);
  return `${payload}.${sig}`;
}

async function readMemberSession(request, env) {
  const raw = readCookie(request, MEMBER_SESSION_COOKIE);
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) return null;
  const expected = await hmacHex(await memberSessionSecret(env), payload);
  if (!timingSafeEqual(expected, sig)) return null;
  try {
    const session = JSON.parse(base64UrlDecode(payload));
    if (!session.uid || Number(session.exp || 0) < Math.floor(Date.now() / 1000)) return null;
    return { userId: String(session.uid) };
  } catch {
    return null;
  }
}

function memberCookie(value, maxAge = MEMBER_SESSION_TTL) {
  return `${MEMBER_SESSION_COOKIE}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function oauthCookie(value, maxAge = MEMBER_OAUTH_TTL) {
  return `${MEMBER_OAUTH_COOKIE}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function oauthProviders(env = {}) {
  const providers = [
    {
      id: 'google',
      name: 'Google',
      clientId: env.GOOGLE_CLIENT_ID || env.OAUTH_GOOGLE_CLIENT_ID || '',
      clientSecret: env.GOOGLE_CLIENT_SECRET || env.OAUTH_GOOGLE_CLIENT_SECRET || '',
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
      scope: 'openid email profile'
    }
  ];
  return providers.map((provider) => ({
    ...provider,
    enabled: Boolean(provider.clientId && provider.clientSecret)
  }));
}

function oauthPublicProviders(env = {}) {
  return oauthProviders(env).map((provider) => ({
    id: provider.id,
    name: provider.name,
    enabled: provider.enabled
  }));
}

function getOAuthProvider(env, id) {
  const provider = oauthProviders(env).find((item) => item.id === String(id || '').toLowerCase());
  if (!provider || !provider.enabled) throw new Error('此第三方登入尚未設定');
  return provider;
}

async function createOAuthState(provider, env) {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const payload = {
    provider,
    nonce: bytesToHex(bytes),
    exp: Math.floor(Date.now() / 1000) + MEMBER_OAUTH_TTL
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const sig = await hmacHex(await memberSessionSecret(env), encoded);
  return `${encoded}.${sig}`;
}

async function verifyOAuthState(request, provider, state, env) {
  const cookieState = readCookie(request, MEMBER_OAUTH_COOKIE);
  if (!state || !cookieState || state !== cookieState) throw new Error('第三方登入驗證逾時，請重新登入');
  const [payload, sig] = String(state).split('.');
  if (!payload || !sig) throw new Error('第三方登入狀態無效');
  const expected = await hmacHex(await memberSessionSecret(env), payload);
  if (!timingSafeEqual(expected, sig)) throw new Error('第三方登入狀態驗證失敗');
  const data = JSON.parse(base64UrlDecode(payload));
  if (data.provider !== provider || Number(data.exp || 0) < Math.floor(Date.now() / 1000)) throw new Error('第三方登入狀態已過期');
  return data;
}

function oauthErrorPage(message) {
  return html(`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>登入失敗</title><style>body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#f4f7f9;color:#101828;display:grid;place-items:center;min-height:100vh;padding:24px}.card{max-width:420px;background:#fff;border:1px solid #d9e3ea;border-radius:12px;padding:22px;box-shadow:0 14px 34px rgba(15,23,42,.08)}a{color:#087e90;font-weight:800}</style></head><body><main class="card"><h1>登入失敗</h1><p>${escHtml(message)}</p><p><a href="${MEMBER_PORTAL_PATH}">返回會員中心</a></p></main></body></html>`, 400, { 'Cache-Control': 'no-store' });
}

async function exchangeOAuthCode(provider, code, redirectUri) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: provider.clientId,
    client_secret: provider.clientSecret
  });
  const res = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error(data.error_description || data.error || '第三方授權交換失敗');
  return data;
}

async function fetchOAuthProfile(provider, tokenData) {
  const res = await fetch(provider.userInfoUrl, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.message || '第三方會員資料讀取失敗');
  if (provider.id === 'google') {
    return {
      provider: provider.id,
      providerUserId: String(data.sub || ''),
      email: String(data.email || ''),
      displayName: String(data.name || data.given_name || data.email || 'Google 會員'),
      avatarUrl: String(data.picture || '')
    };
  }
  throw new Error('不支援的第三方登入');
}

function safeWebUserLabel(profile) {
  const email = String(profile.email || '').trim();
  if (email) return email.slice(0, 64);
  return `${profile.provider}:${String(profile.displayName || profile.providerUserId || 'member').slice(0, 48)}`;
}

async function webUserIdForProfile(profile) {
  const digest = await sha256Hex(`${profile.provider}:${profile.providerUserId}`);
  return `web_${profile.provider}_${digest.slice(0, 18)}`;
}

async function loginMemberWithOAuth(db, env, profile) {
  if (!profile.providerUserId) throw new Error('第三方帳號缺少識別碼');
  await ensureMemberOAuthSchema(db);
  const existing = await db.prepare(`
    SELECT user_id FROM member_oauth_identities
    WHERE provider = ? AND provider_user_id = ?
    LIMIT 1
  `).bind(profile.provider, profile.providerUserId).first();

  const userId = existing?.user_id || await webUserIdForProfile(profile);
  await getUser(db, userId);
  await saveUserInfo(db, userId, safeWebUserLabel(profile), profile.displayName);

  if (existing?.user_id) {
    await db.prepare(`
      UPDATE member_oauth_identities
      SET email = ?, display_name = ?, avatar_url = ?, updated_at = datetime('now'), last_login_at = datetime('now')
      WHERE provider = ? AND provider_user_id = ?
    `).bind(profile.email || null, profile.displayName || null, profile.avatarUrl || null, profile.provider, profile.providerUserId).run();
  } else {
    await db.prepare(`
      INSERT INTO member_oauth_identities (provider, provider_user_id, user_id, email, display_name, avatar_url, last_login_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(profile.provider, profile.providerUserId, userId, profile.email || null, profile.displayName || null, profile.avatarUrl || null).run();
  }

  await logAction(db, userId, 'member_oauth_login', profile.provider, profile.email || profile.displayName || '');
  const session = await createMemberSession(userId, env);
  return { session, userId };
}

async function handleOAuthStart(request, env, providerId) {
  try {
    const provider = getOAuthProvider(env, providerId);
    const state = await createOAuthState(provider.id, env);
    const redirectUri = `${publicBaseUrl(env)}/auth/${provider.id}/callback`;
    const url = new URL(provider.authUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', provider.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', provider.scope);
    url.searchParams.set('state', state);
    if (provider.id === 'google') url.searchParams.set('prompt', 'select_account');
    return new Response(null, {
      status: 302,
      headers: {
        Location: url.toString(),
        'Set-Cookie': oauthCookie(state),
        'Cache-Control': 'no-store'
      }
    });
  } catch (e) {
    return oauthErrorPage(e.message);
  }
}

async function handleOAuthCallback(request, env, providerId, url) {
  try {
    const provider = getOAuthProvider(env, providerId);
    const error = url.searchParams.get('error');
    if (error) throw new Error(url.searchParams.get('error_description') || error);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code) throw new Error('第三方登入缺少授權碼');
    await verifyOAuthState(request, provider.id, state, env);
    const redirectUri = `${publicBaseUrl(env)}/auth/${provider.id}/callback`;
    const tokenData = await exchangeOAuthCode(provider, code, redirectUri);
    const profile = await fetchOAuthProfile(provider, tokenData);
    const login = await loginMemberWithOAuth(env.DB, env, profile);
    const headers = new Headers({
      Location: `${memberPortalUrl(env)}?login=${encodeURIComponent(provider.id)}`,
      'Cache-Control': 'no-store'
    });
    headers.append('Set-Cookie', memberCookie(login.session));
    headers.append('Set-Cookie', oauthCookie('', 0));
    return new Response(null, { status: 302, headers });
  } catch (e) {
    const errorResponse = oauthErrorPage(e.message);
    return new Response(await errorResponse.text(), {
      status: 400,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': oauthCookie('', 0),
        'Cache-Control': 'no-store'
      }
    });
  }
}

function stripeConfigured(env = {}) {
  return Boolean(env.STRIPE_SECRET_KEY);
}

function stripeWebhookConfigured(env = {}) {
  return Boolean(env.STRIPE_WEBHOOK_SECRET);
}

function stripeCurrency(env = {}) {
  return String(env.STRIPE_CURRENCY || 'twd').trim().toLowerCase();
}

function stripeCheckoutBase(env = {}) {
  return env.STRIPE_API_BASE || 'https://api.stripe.com/v1';
}

function stripeUnitAmount(amount, currency) {
  const zeroDecimal = new Set(['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'vnd', 'vuv', 'xaf', 'xof', 'xpf']);
  const value = Number(amount || 0);
  return zeroDecimal.has(String(currency || '').toLowerCase()) ? Math.round(value) : Math.round(value * 100);
}

function stripeEnabledPublic(env = {}) {
  return stripeConfigured(env) && stripeWebhookConfigured(env);
}

function integrationReadiness(env = {}, config = {}) {
  const baseUrl = publicBaseUrl(env, config);
  const providers = oauthPublicProviders(env);
  const enabledProviders = providers.filter((provider) => provider.enabled);
  const stripeKey = String(env.STRIPE_SECRET_KEY || '');
  const stripeMode = stripeKey.startsWith('sk_live_') ? 'live' : stripeKey.startsWith('sk_test_') ? 'test' : stripeConfigured(env) ? 'custom' : 'off';
  return {
    memberUrl: `${baseUrl}${MEMBER_PORTAL_PATH}`,
    telegram: {
      botToken: Boolean(env.BOT_TOKEN || CONFIG.BOT_TOKEN),
      botUsername: CONFIG.BOT_USERNAME || '',
      loginCodeEnabled: Boolean(env.BOT_TOKEN || CONFIG.BOT_TOKEN)
    },
    oauth: {
      enabledCount: enabledProviders.length,
      providers,
      callbackUrls: {
        google: `${baseUrl}/auth/google/callback`
      }
    },
    passwordAuth: {
      enabled: true,
      registerUrl: `${baseUrl}${MEMBER_PORTAL_PATH}`
    },
    stripe: {
      enabled: stripeEnabledPublic(env),
      secretKey: stripeConfigured(env),
      webhookSecret: stripeWebhookConfigured(env),
      mode: stripeMode,
      currency: stripeCurrency(env).toUpperCase(),
      webhookUrl: `${baseUrl}/webhook/stripe`
    },
    cron: {
      manualSecret: Boolean(env.CRON_SECRET),
      endpoints: {
        expire: `${baseUrl}/cron/expire`,
        remind: `${baseUrl}/cron/remind`,
        queued: `${baseUrl}/cron/queued`,
        securityCleanup: `${baseUrl}/cron/security-cleanup`,
        econ: `${baseUrl}/cron/econ`,
        economicEvents: `${baseUrl}/cron/economic-events`
      }
    },
    economicCalendar: {
      sourceConfigured: Boolean(env.ECONOMIC_CALENDAR_API_URL || env.ECONOMIC_CALENDAR_URL),
      sourceName: env.ECONOMIC_CALENDAR_SOURCE || 'Economic Calendar',
      tradingViewCalendarUrl: 'https://www.tradingview.com/economic-calendar/'
    }
  };
}

async function createStripeCheckoutSession(env, order, user = {}) {
  if (!stripeConfigured(env)) throw new Error('Stripe 尚未設定');
  const currency = stripeCurrency(env);
  const baseUrl = publicBaseUrl(env);
  const body = new URLSearchParams();
  body.set('mode', 'payment');
  body.set('client_reference_id', order.orderId);
  body.set('success_url', `${baseUrl}/member?checkout=success&order=${encodeURIComponent(order.orderId)}`);
  body.set('cancel_url', `${baseUrl}/member?checkout=cancel&order=${encodeURIComponent(order.orderId)}`);
  body.set('allow_promotion_codes', 'true');
  body.set('metadata[order_id]', order.orderId);
  body.set('metadata[user_id]', String(order.userId));
  body.set('metadata[tier]', order.tier);
  body.set('metadata[months]', String(order.months));
  body.set('line_items[0][quantity]', '1');
  body.set('line_items[0][price_data][currency]', currency);
  body.set('line_items[0][price_data][unit_amount]', String(stripeUnitAmount(order.amount, currency)));
  body.set('line_items[0][price_data][product_data][name]', `DC Signals ${tierName(order.tier)} ${order.months} 個月`);
  body.set('line_items[0][price_data][product_data][description]', `${order.days} 天會員方案`);
  if (user.username && String(user.username).includes('@')) body.set('customer_email', String(user.username));

  const res = await fetch(`${stripeCheckoutBase(env)}/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': '2026-02-25.clover'
    },
    body
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id || !data.url) throw new Error(data.error?.message || 'Stripe Checkout 建立失敗');
  return { sessionId: data.id, checkoutUrl: data.url, currency };
}

async function confirmOrderRecord(db, actorId, order, options = {}) {
  if (!order) throw new Error('找不到訂單');
  const orderId = String(order.order_id || order.orderId || '').toUpperCase();
  if (!orderId) throw new Error('訂單缺少編號');
  if (isOrderRefunded(order)) throw new Error('此訂單已退款，無法確認');
  if (order.status === 'confirmed') return { orderId, status: 'confirmed' };

  const expires = new Date(Date.now() + Number(order.days || 0) * 86400000).toISOString();
  const user = await getUser(db, order.user_id);
  let newExpiry = expires;
  if (user.tier === order.tier && user.tier_expires_at && new Date(user.tier_expires_at) > new Date()) {
    newExpiry = new Date(new Date(user.tier_expires_at).getTime() + Number(order.days || 0) * 86400000).toISOString();
  }

  await updateUser(db, order.user_id, {
    tier: order.tier,
    tier_expires_at: newExpiry,
    total_spent: (user.total_spent || 0) + Number(order.amount || 0)
  });

  if (user.referred_by) {
    const refPaidPoints = parseInt(await getConfig(db, 'referral_paid_points') || '100');
    await addPoints(db, user.referred_by, refPaidPoints, '被推薦人付費');
  }

  await ensureOrderPaymentSchema(db);
  await db.prepare(`
    UPDATE orders
    SET status = 'confirmed',
        confirmed_by = ?,
        confirmed_at = COALESCE(confirmed_at, datetime('now')),
        paid_at = COALESCE(paid_at, datetime('now')),
        payment_method = COALESCE(?, payment_method),
        payment_provider = COALESCE(?, payment_provider),
        payment_session_id = COALESCE(?, payment_session_id),
        payment_note = COALESCE(?, payment_note)
    WHERE order_id = ?
  `).bind(
    actorId,
    options.paymentMethod || null,
    options.paymentProvider || null,
    options.paymentSessionId || null,
    options.paymentNote || null,
    orderId
  ).run();

  if (options.notify !== false) {
    await sendMemberNotice(order.user_id, `🎉 <b>訂單已確認！</b>\n\n訂單：${orderId}\n方案：${tierName(order.tier)}\n天數：${order.days} 天\n到期：${fmtDate(newExpiry)}`, {
      inline_keyboard: [
        [{ text: '查看收據', callback_data: `u_order_${orderId}` }],
        [{ text: '我的訂單', callback_data: 'u_orders' }]
      ]
    }, { db });
  }
  await recordOrderEvent(db, orderId, order.user_id, 'confirmed', actorId, `訂單確認，會員到期日 ${fmtDate(newExpiry)}`, {
    tier: order.tier,
    days: order.days,
    paymentProvider: options.paymentProvider || order.payment_provider || order.payment_method || 'manual',
    sessionId: options.paymentSessionId || order.payment_session_id || ''
  });
  await logAction(db, actorId, options.action || 'order_confirm', orderId, `${order.tier} ${order.days}d`);
  return { orderId, status: 'confirmed', tier: order.tier, expiresAt: newExpiry };
}

function parseStripeSignature(header) {
  const parts = {};
  for (const item of String(header || '').split(',')) {
    const [key, value] = item.split('=');
    if (!key || !value) continue;
    if (!parts[key]) parts[key] = [];
    parts[key].push(value);
  }
  return parts;
}

async function verifyStripeWebhook(rawBody, signatureHeader, secret) {
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET 尚未設定');
  const parsed = parseStripeSignature(signatureHeader);
  const timestamp = Number(parsed.t?.[0] || 0);
  const signatures = parsed.v1 || [];
  if (!timestamp || !signatures.length) throw new Error('Stripe webhook signature 不完整');
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) throw new Error('Stripe webhook signature 已逾時');
  const expected = await hmacHex(textBytes(secret), `${timestamp}.${rawBody}`);
  if (!signatures.some((sig) => timingSafeEqual(sig, expected))) throw new Error('Stripe webhook signature 驗證失敗');
}

async function confirmStripeSessionOrder(db, session, eventType) {
  await ensureOrderPaymentSchema(db);
  const orderId = String(session?.metadata?.order_id || session?.client_reference_id || '').trim().toUpperCase();
  if (!orderId) throw new Error('Stripe session 缺少 order_id');
  const order = await db.prepare('SELECT * FROM orders WHERE order_id = ?').bind(orderId).first();
  if (!order) throw new Error(`找不到訂單 ${orderId}`);
  if (session.payment_status && session.payment_status !== 'paid' && eventType !== 'checkout.session.async_payment_succeeded') {
    await recordOrderEvent(db, orderId, order.user_id, 'stripe_skipped', 'stripe:webhook', `Stripe webhook 未確認付款：${session.payment_status}`, {
      eventType,
      sessionId: session.id || '',
      paymentStatus: session.payment_status || ''
    });
    return { orderId, status: order.status, skipped: true };
  }
  const paidNote = `Stripe ${eventType}\nSession：${session.id || '-'}\nPaymentIntent：${session.payment_intent || '-'}\nAmount：${session.amount_total || '-'} ${String(session.currency || order.currency || '').toUpperCase()}`;
  return confirmOrderRecord(db, 'stripe:webhook', order, {
    paymentMethod: 'stripe',
    paymentProvider: 'stripe',
    paymentSessionId: session.id || order.payment_session_id || null,
    paymentNote: paidNote,
    action: 'stripe_order_confirm'
  });
}

async function handleStripeWebhook(request, env) {
  try {
    const rawBody = await request.text();
    await verifyStripeWebhook(rawBody, request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET);
    const event = JSON.parse(rawBody);
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      return json({ ok: true, data: await confirmStripeSessionOrder(env.DB, event.data?.object || {}, event.type) });
    }
    return json({ ok: true, ignored: event.type || 'unknown' });
  } catch (e) {
    return json({ ok: false, error: e.message }, 400);
  }
}

function memberCanReceive(user) {
  if (!user || user.tier === 'free' || user.is_active === 0 || user.is_banned) return false;
  if (!user.tier_expires_at) return true;
  return new Date(user.tier_expires_at) > new Date();
}

function memberCanViewSignal(user, sig) {
  if (!memberCanReceive(user)) return false;
  if ((sig.is_vip_only || sig.target_group === 'vip') && user.tier !== 'vip') return false;
  return true;
}

async function getMemberPlans(db) {
  const fallback = {
    pro: { 1: 299, 3: 807, 12: 2868 },
    vip: { 1: 599, 3: 1617, 12: 5748 }
  };
  const plans = {};
  for (const tier of ['pro', 'vip']) {
    plans[tier] = {
      tier,
      name: CONFIG.TIERS[tier].name,
      months: {}
    };
    for (const months of [1, 3, 12]) {
      const configured = await getConfig(db, `${tier}_price_${months}m`);
      const price = Number(configured || fallback[tier][months] || 0);
      plans[tier].months[months] = {
        months,
        days: months * 30,
        amount: price
      };
    }
  }
  return plans;
}

async function getMemberPaymentInfo(db, env = {}) {
  const publicUrl = String(await getConfig(db, 'public_base_url') || '').trim();
  const urlEnv = publicUrl ? { ...env, PUBLIC_BASE_URL: publicUrl } : env;
  const manualEnabled = String(await getConfig(db, 'payment_manual_enabled') || '1') !== '0';
  const cryptoEnabled = String(await getConfig(db, 'payment_crypto_enabled') || '0') === '1';
  const cryptoWallet = await getConfig(db, 'payment_crypto_wallet') || '';
  return {
    publicBaseUrl: publicBaseUrl(urlEnv),
    manualEnabled,
    bank: await getConfig(db, 'payment_bank') || '',
    branch: await getConfig(db, 'payment_bank_branch') || '',
    account: await getConfig(db, 'payment_account') || '',
    name: await getConfig(db, 'payment_name') || '',
    transferNote: await getConfig(db, 'payment_transfer_note') || '',
    cryptoEnabled: cryptoEnabled && !!cryptoWallet,
    cryptoAsset: await getConfig(db, 'payment_crypto_asset') || 'USDT',
    cryptoNetwork: await getConfig(db, 'payment_crypto_network') || 'TRC20',
    cryptoWallet,
    cryptoMemo: await getConfig(db, 'payment_crypto_memo') || '',
    cryptoRateNote: await getConfig(db, 'payment_crypto_rate_note') || '請依付款當下匯率換算，實收以客服確認為準',
    cryptoNote: await getConfig(db, 'payment_crypto_note') || '',
    contactTelegram: await getConfig(db, 'contact_telegram') || '',
    contactLine: await getConfig(db, 'contact_line') || '',
    stripeEnabled: stripeEnabledPublic(env),
    stripeCurrency: stripeCurrency(env).toUpperCase(),
    termsVersion: ORDER_TERMS_VERSION,
    termsUrl: memberTermsUrl(urlEnv),
    riskUrl: memberPolicyUrl(urlEnv, '/risk-disclosure'),
    privacyUrl: memberPolicyUrl(urlEnv, '/privacy'),
    refundUrl: memberPolicyUrl(urlEnv, '/refund')
  };
}

function signalDto(sig, tier = 'free') {
  return {
    signal_uid: sig.signal_uid,
    ticker: sig.ticker,
    action: sig.action,
    signal_type: sig.signal_type,
    entry_price: sig.entry_price,
    stop_loss: sig.stop_loss,
    tp1: sig.tp1,
    tp2: sig.tp2,
    tp3: tier === 'vip' ? sig.tp3 : null,
    probability: normalizeProbabilityValue(sig.probability),
    status: sig.status,
    result: sig.result,
    tp_hit_level: sig.tp_hit_level || 0,
    pnl_points: sig.pnl_points,
    exit_price: sig.exit_price,
    exit_reason: sig.exit_reason,
    chart_url: sig.chart_url,
    snapshot_url: sig.snapshot_url,
    created_at: sig.created_at,
    closed_at: sig.closed_at,
    target_group: sig.target_group,
    is_vip_only: sig.is_vip_only,
    source: sig.source,
    strategy_id: sig.strategy_id,
    tp_hit_count: sig.tp_hit_count,
    tp1_hit_at: sig.tp1_hit_at,
    tp2_hit_at: sig.tp2_hit_at,
    tp3_hit_at: sig.tp3_hit_at
  };
}

function normalizeMemberDateParam(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function taipeiDayToSqliteUtc(value, endOfDay = false) {
  const date = normalizeMemberDateParam(value);
  if (!date) return '';
  const time = endOfDay ? '23:59:59' : '00:00:00';
  const parsed = new Date(`${date}T${time}+08:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 19).replace('T', ' ');
}

function memberSignalFilters(params = {}) {
  const read = (key) => typeof params.get === 'function' ? params.get(key) : params[key];
  const rawLimit = Number(read('limit') || 60);
  const status = String(read('status') || read('filter') || 'all').trim().toLowerCase();
  return {
    status: ['all', 'active', 'history', 'closed', 'cancelled'].includes(status) ? status : 'all',
    start: normalizeMemberDateParam(read('start') || read('from') || ''),
    end: normalizeMemberDateParam(read('end') || read('to') || ''),
    limit: Math.min(120, Math.max(1, Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 60))
  };
}

async function getMemberSignals(db, user, settings, filters = {}) {
  const query = memberSignalFilters(filters);
  if (!memberCanReceive(user)) {
    return { signals: [], query: { ...query, canReceive: false, hasMore: false } };
  }

  const where = [];
  const binds = [];
  if (query.status === 'active') {
    where.push("status = 'active'");
  } else if (query.status === 'history') {
    where.push("status IN ('closed','cancelled')");
  } else if (query.status === 'closed') {
    where.push("status = 'closed'");
  } else if (query.status === 'cancelled') {
    where.push("status = 'cancelled'");
  } else {
    where.push("status IN ('active','closed','cancelled')");
  }

  const start = taipeiDayToSqliteUtc(query.start, false);
  const end = taipeiDayToSqliteUtc(query.end, true);
  if (start) {
    where.push('created_at >= ?');
    binds.push(start);
  }
  if (end) {
    where.push('created_at <= ?');
    binds.push(end);
  }

  const subscribedSymbols = parseJSON(settings?.subscribed_symbols, []);
  const signalTypes = parseJSON(settings?.signal_types, []);
  const queryLimit = Math.min(420, Math.max(query.limit * 4, 80));
  const rows = await db.prepare(`
    SELECT * FROM signals
    WHERE ${where.join(' AND ')}
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(...binds, queryLimit).all();

  const allowed = (rows.results || [])
    .filter((sig) => (!subscribedSymbols.length || subscribedSymbols.includes(sig.ticker)))
    .filter((sig) => (!signalTypes.length || signalTypes.includes(sig.signal_type)))
    .filter((sig) => memberCanViewSignal(user, sig));

  return {
    signals: allowed.slice(0, query.limit).map((sig) => signalDto(sig, user.tier)),
    query: {
      ...query,
      canReceive: true,
      hasMore: allowed.length > query.limit,
      resultCount: Math.min(allowed.length, query.limit)
    }
  };
}

async function getOrderEvents(db, orderIds, limit = 80) {
  const ids = Array.from(new Set((orderIds || []).map((id) => String(id || '').toUpperCase()).filter(Boolean)));
  if (!ids.length) return {};
  await ensureOrderEventSchema(db);
  const rows = await db.prepare(`
    SELECT order_id, event_type, actor_id, message, metadata, created_at
    FROM order_events
    WHERE order_id IN (${ids.map(() => '?').join(',')})
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(...ids, limit).all();
  const grouped = {};
  for (const row of rows.results || []) {
    const key = String(row.order_id || '').toUpperCase();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row);
  }
  return grouped;
}

async function getMemberSecurity(db, userId) {
  await ensureMemberPasswordSchema(db);
  await ensureMemberOAuthSchema(db);
  await ensureTelegramLinkSchema(db);
  const [passwordAccount, oauthRows, userRow] = await Promise.all([
    db.prepare(`
      SELECT email, display_name, created_at, updated_at, last_login_at
      FROM member_password_accounts
      WHERE user_id = ?
    `).bind(userId).first(),
    db.prepare(`
      SELECT provider, email, display_name, last_login_at, created_at
      FROM member_oauth_identities
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).bind(userId).all(),
    db.prepare('SELECT telegram_user_id, telegram_linked_at FROM users WHERE user_id = ?').bind(userId).first()
  ]);
  const linkedTelegramId = isTelegramChatId(userId) ? String(userId) : String(userRow?.telegram_user_id || '');
  return {
    password_account: passwordAccount ? {
      enabled: true,
      email: passwordAccount.email || '',
      display_name: passwordAccount.display_name || '',
      created_at: passwordAccount.created_at || null,
      updated_at: passwordAccount.updated_at || null,
      last_login_at: passwordAccount.last_login_at || null
    } : { enabled: false },
    oauth_identities: (oauthRows.results || []).map((row) => ({
      provider: row.provider,
      email: row.email || '',
      display_name: row.display_name || '',
      last_login_at: row.last_login_at || null,
      created_at: row.created_at || null
    })),
    telegram_link: {
      linked: isTelegramChatId(linkedTelegramId),
      telegram_user_id: linkedTelegramId,
      linked_at: isTelegramChatId(userId) ? null : userRow?.telegram_linked_at || null
    }
  };
}

async function getMemberBootstrap(db, userId, env = {}) {
  await ensureOrderPaymentSchema(db);
  await ensureSupportSchema(db);
  await ensureTelegramLinkSchema(db);
  const user = await getUser(db, userId);
  const settings = await getUserSettings(db, userId);
  const symbols = (await db.prepare('SELECT * FROM symbols WHERE is_active = 1 ORDER BY sort_order, symbol').all()).results || [];
  const subscribedSymbols = parseJSON(settings.subscribed_symbols, []);
  const signalTypes = parseJSON(settings.signal_types, []);

  const signalPayload = await getMemberSignals(db, user, settings, { limit: 30 });
  const signals = signalPayload.signals;

  const orders = (await db.prepare(`
    SELECT order_id, tier, months, days, amount, status, payment_method, payment_provider, payment_url, payment_note, currency,
           terms_version, terms_accepted_at, risk_acknowledged_at, paid_at, refunded_at, refund_amount, refund_note,
           created_at, confirmed_at
    FROM orders WHERE user_id = ?
    ORDER BY created_at DESC LIMIT 10
  `).bind(userId).all()).results || [];
  const orderEvents = await getOrderEvents(db, orders.map((order) => order.order_id), 80);
  for (const order of orders) {
    order.events = (orderEvents[String(order.order_id || '').toUpperCase()] || []).slice(0, 8);
  }

  // 近期重要經濟事件（免費會員看高影響，付費會員依後台關注設定）
  let economicEvents = [];
  try {
    const econConfig = await getEconomicConfig(db, env);
    if ((user.tier || 'free') === 'free') econConfig.impacts = ['high'];
    economicEvents = await getUpcomingMarketEconomicEvents(db, econConfig, { hours: 48, limit: 15 });
  } catch { economicEvents = []; }

  return {
    user: {
      user_id: user.user_id,
      username: user.username,
      first_name: user.first_name,
      tier: user.tier || 'free',
      tier_name: CONFIG.TIERS[user.tier || 'free']?.name || '免費會員',
      tier_expires_at: user.tier_expires_at,
      points: user.points || 0,
      total_spent: user.total_spent || 0,
      referral_code: user.referral_code,
      can_receive: memberCanReceive(user)
    },
    settings: {
      capital: settings.capital || 10000,
      risk_percent: settings.risk_percent || 1,
      subscribed_symbols: subscribedSymbols,
      signal_types: signalTypes,
      notify_entry: !!settings.notify_entry,
      notify_tp: !!settings.notify_tp,
      notify_sl: !!settings.notify_sl,
      notify_update: !!settings.notify_update,
      notify_daily_report: !!settings.notify_daily_report,
      notify_announcement: !!settings.notify_announcement,
      notify_alert: !!settings.notify_alert,
      paused: !!settings.paused,
      timezone: settings.timezone || 'Asia/Taipei'
    },
    symbols,
    signalTypes: CONFIG.SIGNAL_TYPES,
    signals,
    signalQuery: signalPayload.query,
    economicEvents,
    orders,
    supportTickets: await getMemberSupportTickets(db, userId, 8),
    security: await getMemberSecurity(db, userId),
    plans: await getMemberPlans(db),
    payment: await getMemberPaymentInfo(db, env),
    botUsername: CONFIG.BOT_USERNAME,
    serverTime: fmtTime()
  };
}

function boolAccepted(value) {
  return value === true || value === 'true' || value === '1' || value === 1;
}

async function termsClientHash(request) {
  const ip = request ? requestClientIp(request) : 'unknown';
  const ua = request ? String(request.headers.get('user-agent') || '').slice(0, 240) : '';
  return (await sha256Hex(`terms:${ip}:${ua}`)).slice(0, 40);
}

async function createMemberOrder(db, env, userId, payload, request = null) {
  await ensureOrderPaymentSchema(db);
  const tier = String(payload.tier || '').trim().toLowerCase();
  const months = Number(payload.months || 0);
  const paymentProvider = String(payload.payment_provider || payload.paymentProvider || payload.method || 'manual').trim().toLowerCase();
  const termsAccepted = boolAccepted(payload.accept_terms ?? payload.acceptTerms ?? payload.terms_accepted ?? payload.termsAccepted);
  const riskAcknowledged = boolAccepted(payload.risk_acknowledged ?? payload.riskAcknowledged ?? payload.accept_risk ?? payload.acceptRisk);
  const acceptedTermsVersion = String(payload.terms_version || payload.termsVersion || ORDER_TERMS_VERSION).trim();
  if (!['pro', 'vip'].includes(tier)) throw new Error('方案不正確');
  if (![1, 3, 12].includes(months)) throw new Error('訂閱月份不正確');
  if (!['manual', 'stripe', 'crypto'].includes(paymentProvider)) throw new Error('付款方式不正確');
  if (!termsAccepted || !riskAcknowledged) throw new Error('請先閱讀並同意服務條款與交易風險揭露');
  if (acceptedTermsVersion !== ORDER_TERMS_VERSION) throw new Error('服務條款版本已更新，請重新整理後再下單');
  if (paymentProvider === 'stripe' && !stripeEnabledPublic(env)) throw new Error('線上付款尚未完整啟用，請先設定 Stripe secret 與 webhook secret，或改用轉帳付款');
  const paymentInfo = await getMemberPaymentInfo(db, env);
  if (paymentProvider === 'manual' && paymentInfo.manualEnabled === false) throw new Error('銀行轉帳付款尚未開放，請改用其他付款方式');
  if (paymentProvider === 'crypto' && !paymentInfo.cryptoEnabled) throw new Error('虛擬貨幣收款尚未設定完成，請改用轉帳付款或聯繫客服');

  const plans = await getMemberPlans(db);
  const plan = plans[tier]?.months?.[months];
  if (!plan || !plan.amount) throw new Error('方案價格尚未設定');

  const existing = await db.prepare(`
    SELECT order_id FROM orders
    WHERE user_id = ? AND status IN ('pending','paid')
    ORDER BY created_at DESC LIMIT 1
  `).bind(userId).first();
  if (existing?.order_id) throw new Error(`尚有未完成訂單 ${existing.order_id}，請先付款通知或取消`);

  const orderId = genOrderId();
  const clientHash = await termsClientHash(request);
  await db.prepare(`
    INSERT INTO orders (
      order_id, user_id, tier, months, days, amount, payment_method, payment_provider, currency,
      terms_version, terms_accepted_at, risk_acknowledged_at, terms_client_hash, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?, datetime('now'))
  `).bind(
    orderId, userId, tier, months, plan.days, plan.amount, paymentProvider, paymentProvider, stripeCurrency(env).toUpperCase(),
    ORDER_TERMS_VERSION, clientHash
  ).run();
  await recordOrderEvent(db, orderId, userId, 'created', userId, `會員中心建立 ${tierName(tier)} ${months} 個月訂單`, {
    tier,
    months,
    amount: plan.amount,
    paymentProvider,
    termsVersion: ORDER_TERMS_VERSION,
    riskAcknowledged: true
  });
  await recordOrderEvent(db, orderId, userId, 'terms_accepted', userId, `會員同意服務條款與交易風險揭露 ${ORDER_TERMS_VERSION}`, {
    termsVersion: ORDER_TERMS_VERSION,
    clientHash
  });

  const user = await getUser(db, userId);
  let checkout = null;
  if (paymentProvider === 'stripe') {
    try {
      checkout = await createStripeCheckoutSession(env, {
        orderId,
        userId,
        tier,
        months,
        days: plan.days,
        amount: plan.amount
      }, user);
      await db.prepare(`
        UPDATE orders
        SET payment_session_id = ?, payment_url = ?, currency = ?
        WHERE order_id = ?
      `).bind(checkout.sessionId, checkout.checkoutUrl, checkout.currency.toUpperCase(), orderId).run();
      await recordOrderEvent(db, orderId, userId, 'stripe_session_created', 'stripe', 'Stripe Checkout Session 已建立', {
        sessionId: checkout.sessionId,
        currency: checkout.currency.toUpperCase()
      });
    } catch (e) {
      await db.prepare("UPDATE orders SET status = 'cancelled', payment_note = ? WHERE order_id = ?").bind(`Stripe 建立失敗：${e.message}`, orderId).run();
      await recordOrderEvent(db, orderId, userId, 'stripe_session_failed', 'stripe', e.message, { paymentProvider });
      throw e;
    }
  }

  for (const adminId of CONFIG.ADMIN_IDS) {
    await sendTg(adminId, `新會員中心訂單\n\n用戶：${escHtml(formatUserLabel(user, userId))}\nID：<code>${escHtml(userId)}</code>\n訂單：<code>${orderId}</code>\n方案：${tierName(tier)} ${months}個月\n金額：NT$${fmtNum(plan.amount)}\n付款：${escHtml(memberReceiptPaymentMethod({ payment_provider: paymentProvider }))}`);
  }

  await logAction(db, userId, 'member_order_create', orderId, `${tier} ${months}m ${paymentProvider}`);
  return {
    orderId,
    tier,
    months,
    days: plan.days,
    amount: plan.amount,
    status: 'pending',
    paymentProvider,
    checkoutUrl: checkout?.checkoutUrl || '',
    stripeSessionId: checkout?.sessionId || ''
  };
}

function memberPaymentNote(payload = {}) {
  const payer = String(payload.payer_name || payload.payerName || '').trim();
  const last5 = String(payload.transfer_last5 || payload.transferLast5 || '').trim();
  const network = String(payload.crypto_network || payload.cryptoNetwork || payload.network || '').trim();
  const txid = String(payload.crypto_txid || payload.cryptoTxid || payload.txid || '').trim();
  const cryptoAmount = String(payload.crypto_amount || payload.cryptoAmount || '').trim();
  const paidAt = String(payload.paid_at || payload.paidAt || '').trim();
  const note = String(payload.note || '').trim();
  const parts = [];
  if (payer) parts.push(`付款人：${payer}`);
  if (last5) parts.push(`後五碼：${last5}`);
  if (network) parts.push(`鏈別：${network}`);
  if (cryptoAmount) parts.push(`加密貨幣數量：${cryptoAmount}`);
  if (txid) parts.push(`TxID：${txid}`);
  if (paidAt) parts.push(`付款時間：${paidAt}`);
  if (note) parts.push(`備註：${note}`);
  return parts.join('\n') || '會員中心通知付款';
}

async function updateMemberOrderStatus(db, userId, orderId, action, payload = {}) {
  const normalizedOrderId = String(orderId || '').trim().toUpperCase();
  const order = await db.prepare('SELECT * FROM orders WHERE order_id = ? AND user_id = ?').bind(normalizedOrderId, userId).first();
  if (!order) throw new Error('找不到訂單');
  if (isOrderRefunded(order)) throw new Error('此訂單已退款，無法再操作');

  if (action === 'paid') {
    if (!['pending', 'paid'].includes(order.status)) throw new Error('此訂單狀態無法通知付款');
    if ((order.payment_provider || order.payment_method) === 'stripe') throw new Error('線上付款訂單請完成 Stripe Checkout');
    const paymentNote = memberPaymentNote(payload);
    await db.prepare("UPDATE orders SET status = 'paid', paid_at = COALESCE(paid_at, datetime('now')), payment_note = ? WHERE order_id = ?").bind(paymentNote, normalizedOrderId).run();
    await recordOrderEvent(db, normalizedOrderId, userId, 'paid_notice', userId, paymentNote, payload);
    for (const adminId of CONFIG.ADMIN_IDS) {
      await sendTg(adminId, `會員中心付款通知\n\n訂單：<code>${normalizedOrderId}</code>\n用戶：<code>${escHtml(userId)}</code>\n金額：NT$${fmtNum(order.amount)}\n\n${escHtml(paymentNote)}\n\n請至後台確認訂單。`);
    }
    await logAction(db, userId, 'member_order_paid', normalizedOrderId, paymentNote);
    return { orderId: normalizedOrderId, status: 'paid' };
  }

  if (action === 'cancel') {
    if (!['pending', 'paid'].includes(order.status)) throw new Error('此訂單狀態無法取消');
    await db.prepare("UPDATE orders SET status = 'cancelled' WHERE order_id = ?").bind(normalizedOrderId).run();
    await recordOrderEvent(db, normalizedOrderId, userId, 'cancelled', userId, '會員取消訂單', { previousStatus: order.status });
    await logAction(db, userId, 'member_order_cancel', normalizedOrderId, '');
    return { orderId: normalizedOrderId, status: 'cancelled' };
  }

  throw new Error('不支援的訂單操作');
}

function memberOrderStatusLabel(status) {
  const map = {
    pending: '待付款',
    paid: '待人工確認',
    confirmed: '已確認',
    rejected: '已拒絕',
    cancelled: '已取消'
  };
  return map[status] || status || '-';
}

function memberOrderEventLabel(type) {
  const map = {
    created: '建立訂單',
    terms_accepted: '同意條款',
    stripe_session_created: '建立線上付款',
    stripe_session_failed: '線上付款建立失敗',
    paid_notice: '付款通知',
    stripe_skipped: 'Stripe 尚未付款',
    confirmed: '訂單確認',
    rejected: '訂單拒絕',
    cancelled: '訂單取消',
    refunded: '訂單退款'
  };
  return map[type] || type || '紀錄';
}

function memberReceiptDate(value) {
  const parsed = parseDbTime(value);
  return parsed ? fmtDateTime(parsed) : '-';
}

function memberReceiptMoney(order) {
  const currency = String(order.currency || 'TWD').toUpperCase();
  return `${currency} ${fmtNum(Number(order.amount || 0))}`;
}

function memberReceiptPaymentMethod(order) {
  const method = String(order.payment_provider || order.payment_method || 'manual').toLowerCase();
  if (method === 'stripe') return '線上付款 Stripe Checkout';
  if (method === 'crypto') return '虛擬貨幣 / 人工確認';
  return '銀行轉帳 / 人工確認';
}

async function getMemberOrderReceipt(db, userId, orderId) {
  await ensureOrderPaymentSchema(db);
  const normalizedOrderId = String(orderId || '').trim().toUpperCase();
  if (!normalizedOrderId) return null;
  const order = await db.prepare(`
    SELECT o.*, u.username, u.first_name
    FROM orders o
    LEFT JOIN users u ON u.user_id = o.user_id
    WHERE o.order_id = ? AND o.user_id = ?
    LIMIT 1
  `).bind(normalizedOrderId, userId).first();
  if (!order) return null;
  const grouped = await getOrderEvents(db, [normalizedOrderId], 100);
  return { order, events: grouped[normalizedOrderId] || [] };
}

function receiptInfoRow(label, value) {
  return `<div class="info-row"><span>${escHtml(label)}</span><b>${escHtml(value || '-')}</b></div>`;
}

function renderMemberReceiptShell(title, body, status = 200) {
  return html(`<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escHtml(title)}</title>
  <style>
    :root{--bg:#f4f7f9;--panel:#fff;--ink:#101828;--muted:#667085;--line:#d9e3ea;--accent:#08a7b3;--green:#16845a;--amber:#b7791f;--red:#d1433f;--shadow:0 14px 34px rgba(15,23,42,.08)}
    *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    main{max-width:860px;margin:0 auto;padding:22px 16px 46px}.receipt{background:var(--panel);border:1px solid var(--line);border-radius:10px;box-shadow:var(--shadow);overflow:hidden}
    header{padding:20px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.brand{display:flex;gap:10px;align-items:center}.mark{width:38px;height:38px;border-radius:8px;background:linear-gradient(135deg,#12c6d0,#1796ff);display:grid;place-items:center;font-weight:900;color:#06111c}
    h1,h2,p{margin:0} h1{font-size:22px;line-height:1.15}.muted{color:var(--muted)}.chip{display:inline-flex;align-items:center;min-height:28px;border-radius:999px;background:#eef6f8;color:#475569;padding:4px 10px;font-size:12px;font-weight:900}.chip.green{background:#e8f7ef;color:var(--green)}.chip.amber{background:#fff7e6;color:var(--amber)}.chip.red{background:#fff0ef;color:var(--red)}
    .body{padding:20px;display:grid;gap:18px}.summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.info-row{border:1px solid var(--line);border-radius:8px;background:#f8fafc;padding:11px;display:grid;gap:5px;min-width:0}.info-row span{color:var(--muted);font-size:12px;font-weight:900}.info-row b{font-size:15px;word-break:break-word}
    .section{display:grid;gap:10px}.section h2{font-size:15px}.note{white-space:pre-wrap;border:1px solid var(--line);border-radius:8px;background:#f8fafc;padding:12px;color:#344054;line-height:1.55}.timeline{display:grid;gap:8px}.event{border:1px solid var(--line);border-radius:8px;padding:10px;display:grid;gap:4px;background:#fff}.event strong{font-size:13px}.event span{color:var(--muted);font-size:12px;line-height:1.45}
    .actions{display:flex;gap:8px;flex-wrap:wrap}.btn{border:1px solid var(--line);border-radius:7px;min-height:38px;padding:8px 12px;background:#fff;color:var(--ink);font-weight:900;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
    @media print{body{background:#fff}main{padding:0}.receipt{border:0;box-shadow:none}.actions{display:none}}@media(max-width:680px){header{display:grid}.summary{grid-template-columns:1fr}.body,header{padding:16px}}
  </style>
</head>
<body><main>${body}</main></body>
</html>`, status, { 'Cache-Control': 'no-store' });
}

function renderMemberReceiptPage(order, events = []) {
  const statusTone = order.refunded_at ? 'red' : order.status === 'confirmed' ? 'green' : order.status === 'paid' || order.status === 'pending' ? 'amber' : 'red';
  const title = order.refunded_at ? '退款收據' : order.status === 'confirmed' ? '付款收據' : '訂單明細';
  const note = order.payment_note ? `<div class="section"><h2>付款備註</h2><div class="note">${escHtml(order.payment_note)}</div></div>` : '';
  const refund = order.refunded_at ? `
        <section class="summary">
          ${receiptInfoRow('退款金額', orderRefundMoney(order))}
          ${receiptInfoRow('退款時間', memberReceiptDate(order.refunded_at))}
          ${receiptInfoRow('退款處理人', order.refunded_by || '-')}
        </section>
        <section class="section"><h2>退款原因</h2><div class="note">${escHtml(order.refund_note || '人工退款')}</div></section>
  ` : '';
  const timeline = events.length ? events.map((event) => `
      <div class="event"><strong>${escHtml(memberOrderEventLabel(event.event_type))}</strong><span>${escHtml(memberReceiptDate(event.created_at))}${event.actor_id ? ` · ${escHtml(event.actor_id)}` : ''}${event.message ? `<br>${escHtml(event.message)}` : ''}</span></div>
    `).join('') : '<div class="muted">尚無事件紀錄。</div>';

  return renderMemberReceiptShell(`DC Signals ${title} ${order.order_id}`, `
    <article class="receipt">
      <header>
        <div class="brand"><div class="mark">DC</div><div><h1>DC Trading Signals ${escHtml(title)}</h1><p class="muted">訂單 ${escHtml(order.order_id)}</p></div></div>
        <span class="chip ${statusTone}">${escHtml(memberOrderDisplayStatus(order))}</span>
      </header>
      <div class="body">
        <section class="summary">
          ${receiptInfoRow('會員', formatUserLabel(order, order.user_id))}
          ${receiptInfoRow('方案', `${tierName(order.tier)} ${order.months || 0} 個月 / ${order.days || 0} 天`)}
          ${receiptInfoRow('金額', memberReceiptMoney(order))}
          ${receiptInfoRow('付款方式', memberReceiptPaymentMethod(order))}
          ${receiptInfoRow('建立時間', memberReceiptDate(order.created_at))}
          ${receiptInfoRow('確認時間', memberReceiptDate(order.confirmed_at || order.paid_at))}
        </section>
        <section class="summary">
          ${receiptInfoRow('條款版本', order.terms_version || '-')}
          ${receiptInfoRow('同意條款時間', memberReceiptDate(order.terms_accepted_at))}
          ${receiptInfoRow('風險揭露時間', memberReceiptDate(order.risk_acknowledged_at))}
        </section>
        ${refund}
        ${note}
        <section class="section"><h2>訂單流程</h2><div class="timeline">${timeline}</div></section>
        <div class="actions"><a class="btn primary" href="${MEMBER_PORTAL_PATH}">返回會員中心</a><button class="btn" type="button" onclick="window.print()">列印 / 另存 PDF</button></div>
      </div>
    </article>
  `);
}

async function handleMemberReceiptPage(request, env, orderId) {
  const session = await readMemberSession(request, env);
  if (!session) {
    return renderMemberReceiptShell('請先登入', `
      <article class="receipt"><header><div class="brand"><div class="mark">DC</div><div><h1>請先登入會員中心</h1><p class="muted">登入後才能查看訂單明細與收據。</p></div></div></header><div class="body"><div class="actions"><a class="btn primary" href="${MEMBER_PORTAL_PATH}">前往登入</a></div></div></article>
    `, 401);
  }
  const receipt = await getMemberOrderReceipt(env.DB, session.userId, orderId);
  if (!receipt) {
    return renderMemberReceiptShell('找不到訂單', `
      <article class="receipt"><header><div class="brand"><div class="mark">DC</div><div><h1>找不到訂單</h1><p class="muted">此訂單不存在，或不屬於目前登入會員。</p></div></div></header><div class="body"><div class="actions"><a class="btn primary" href="${MEMBER_PORTAL_PATH}">返回會員中心</a></div></div></article>
    `, 404);
  }
  return renderMemberReceiptPage(receipt.order, receipt.events);
}

async function updateMemberSettings(db, userId, payload) {
  await getUserSettings(db, userId);
  const data = {};
  const symbols = (await db.prepare('SELECT symbol FROM symbols WHERE is_active = 1').all()).results?.map((row) => row.symbol) || [];
  if (Array.isArray(payload.subscribed_symbols)) {
    data.subscribed_symbols = JSON.stringify(payload.subscribed_symbols.map((s) => String(s).trim().toUpperCase()).filter((s) => symbols.includes(s)));
  }
  if (Array.isArray(payload.signal_types)) {
    data.signal_types = JSON.stringify(payload.signal_types.filter((type) => CONFIG.SIGNAL_TYPES[type]));
  }
  if (payload.capital !== undefined) {
    const capital = asNumber(payload.capital);
    if (capital === null || capital < 0) throw new Error('交易資金格式不正確');
    data.capital = capital;
  }
  if (payload.risk_percent !== undefined) {
    const risk = asNumber(payload.risk_percent);
    if (risk === null || risk < 0 || risk > 20) throw new Error('風險比例需介於 0 到 20');
    data.risk_percent = risk;
  }
  for (const key of ['notify_entry', 'notify_tp', 'notify_sl', 'notify_update', 'notify_daily_report', 'notify_announcement', 'notify_alert', 'paused']) {
    if (payload[key] !== undefined) data[key] = payload[key] ? 1 : 0;
  }
  if (payload.timezone !== undefined) data.timezone = String(payload.timezone || 'Asia/Taipei').trim() || 'Asia/Taipei';
  if (!Object.keys(data).length) throw new Error('沒有可更新的設定');
  await updateUserSettings(db, userId, data);
  return { updated: Object.keys(data) };
}

function supportStatusLabel(status) {
  const map = { open: '待回覆', pending: '已回覆', closed: '已結案' };
  return map[status] || status || '-';
}

function supportPriority(value) {
  const priority = String(value || 'normal').toLowerCase();
  return ['low', 'normal', 'high', 'urgent'].includes(priority) ? priority : 'normal';
}

async function getMemberSupportTickets(db, userId, limit = 8) {
  await ensureSupportSchema(db);
  const rows = await db.prepare(`
    SELECT ticket_id, subject, message, status, priority, last_reply, last_actor_id, closed_at, created_at, updated_at
    FROM support_tickets
    WHERE user_id = ?
    ORDER BY datetime(updated_at) DESC
    LIMIT ?
  `).bind(userId, limit).all();
  return attachSupportReplies(db, rows.results || [], 8);
}

async function getAdminSupportTickets(db, limit = 40, range = null) {
  await ensureSupportSchema(db);
  const supportWhere = adminDateWhere('t.updated_at', range || {}, false);
  const rows = await db.prepare(`
    SELECT t.*, u.username, u.first_name, u.tier
    FROM support_tickets t
    LEFT JOIN users u ON u.user_id = t.user_id
    ${supportWhere.clause}
    ORDER BY CASE t.status WHEN 'open' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
             datetime(t.updated_at) DESC
    LIMIT ?
  `).bind(...supportWhere.binds, limit).all();
  return attachSupportReplies(db, rows.results || [], 6);
}

async function attachSupportReplies(db, tickets, perTicket = 6) {
  const ids = Array.from(new Set((tickets || []).map((ticket) => String(ticket.ticket_id || '').toUpperCase()).filter(Boolean)));
  if (!ids.length) return tickets || [];
  const rows = await db.prepare(`
    SELECT ticket_id, actor_type, actor_id, message, created_at
    FROM support_replies
    WHERE ticket_id IN (${ids.map(() => '?').join(',')})
    ORDER BY datetime(created_at) ASC
    LIMIT ?
  `).bind(...ids, Math.max(ids.length * perTicket, perTicket)).all();
  const grouped = {};
  for (const row of rows.results || []) {
    const id = String(row.ticket_id || '').toUpperCase();
    if (!grouped[id]) grouped[id] = [];
    grouped[id].push(row);
  }
  return (tickets || []).map((ticket) => ({
    ...ticket,
    replies: (grouped[String(ticket.ticket_id || '').toUpperCase()] || []).slice(-perTicket)
  }));
}

function supportSubjectFromMessage(message) {
  return String(message || '').replace(/\s+/g, ' ').trim().slice(0, 42) || '客服問題';
}

async function createSupportTicket(db, env, userId, payload = {}, source = 'member-web') {
  await ensureSupportSchema(db);
  const message = String(payload.message || payload.text || payload.body || '').trim();
  if (message.length < 4) throw new Error('請輸入客服問題內容');
  if (message.length > 3000) throw new Error('客服問題最多 3000 字');
  const subject = String(payload.subject || '').trim().slice(0, 80) || supportSubjectFromMessage(message);
  const priority = supportPriority(payload.priority);
  const ticketId = genTicketId();
  await db.prepare(`
    INSERT INTO support_tickets (ticket_id, user_id, subject, message, status, priority, last_reply, last_actor_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'open', ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(ticketId, userId, subject, message, priority, message, userId).run();
  await db.prepare(`
    INSERT INTO support_replies (ticket_id, actor_type, actor_id, message, created_at)
    VALUES (?, 'user', ?, ?, datetime('now'))
  `).bind(ticketId, userId, message).run();
  const user = await getUser(db, userId);
  for (const adminId of CONFIG.ADMIN_IDS) {
    await sendTg(adminId, [
      '📨 <b>新客服工單</b>',
      '',
      `工單：<code>${ticketId}</code>`,
      `會員：${escHtml(formatUserLabel(user, userId))}`,
      `等級：${tierName(user.tier || 'free')}`,
      `主旨：${escHtml(subject)}`,
      '',
      escHtml(message),
      '',
      `回覆：/reply ${ticketId} 你的回覆`,
      `結案：/closeticket ${ticketId} 原因`
    ].join('\n'));
  }
  await logAction(db, userId, 'support_ticket_create', ticketId, source);
  return { ticketId, subject, status: 'open', priority, created_at: fmtTime() };
}

async function replySupportTicket(db, env, adminId, ticketId, message) {
  await ensureSupportSchema(db);
  const id = String(ticketId || '').trim().toUpperCase();
  const reply = String(message || '').trim();
  if (!id) throw new Error('請輸入工單 ID');
  if (reply.length < 2) throw new Error('請輸入回覆內容');
  const ticket = await db.prepare('SELECT * FROM support_tickets WHERE ticket_id = ?').bind(id).first();
  if (!ticket) throw new Error('找不到工單');
  if (ticket.status === 'closed') throw new Error('工單已結案');
  await db.prepare(`
    INSERT INTO support_replies (ticket_id, actor_type, actor_id, message, created_at)
    VALUES (?, 'admin', ?, ?, datetime('now'))
  `).bind(id, String(adminId), reply).run();
  await db.prepare(`
    UPDATE support_tickets
    SET status = 'pending',
        last_reply = ?,
        last_actor_id = ?,
        updated_at = datetime('now')
    WHERE ticket_id = ?
  `).bind(reply, String(adminId), id).run();
  await sendMemberNotice(ticket.user_id, [
    '💬 <b>客服已回覆</b>',
    '',
    `工單：<code>${escHtml(id)}</code>`,
    `主旨：${escHtml(ticket.subject)}`,
    '',
    escHtml(reply),
    '',
    '若仍需協助，請再次使用 /support 留下補充問題。'
  ].join('\n'), null, { db });
  await logAction(db, adminId, 'support_ticket_reply', id, reply.slice(0, 200));
  return { ticketId: id, status: 'pending' };
}

async function replyMemberSupportTicket(db, env, userId, ticketId, payload = {}) {
  await ensureSupportSchema(db);
  const id = String(ticketId || '').trim().toUpperCase();
  const message = String(payload.message || payload.text || payload.body || '').trim();
  if (!id) throw new Error('請輸入工單 ID');
  if (message.length < 2) throw new Error('請輸入補充內容');
  if (message.length > 3000) throw new Error('補充內容最多 3000 字');
  const ticket = await db.prepare('SELECT * FROM support_tickets WHERE ticket_id = ? AND user_id = ?').bind(id, userId).first();
  if (!ticket) throw new Error('找不到工單');
  if (ticket.status === 'closed') throw new Error('工單已結案，請建立新工單');
  await db.prepare(`
    INSERT INTO support_replies (ticket_id, actor_type, actor_id, message, created_at)
    VALUES (?, 'user', ?, ?, datetime('now'))
  `).bind(id, userId, message).run();
  await db.prepare(`
    UPDATE support_tickets
    SET status = 'open',
        last_reply = ?,
        last_actor_id = ?,
        updated_at = datetime('now')
    WHERE ticket_id = ?
  `).bind(message, userId, id).run();
  const user = await getUser(db, userId);
  for (const adminId of CONFIG.ADMIN_IDS) {
    await sendTg(adminId, [
      '📨 <b>會員補充客服工單</b>',
      '',
      `工單：<code>${id}</code>`,
      `會員：${escHtml(formatUserLabel(user, userId))}`,
      `主旨：${escHtml(ticket.subject)}`,
      '',
      escHtml(message),
      '',
      `回覆：/reply ${id} 你的回覆`
    ].join('\n'));
  }
  await logAction(db, userId, 'support_ticket_followup', id, message.slice(0, 200));
  return { ticketId: id, status: 'open' };
}

async function closeSupportTicket(db, env, adminId, ticketId, reason = '') {
  await ensureSupportSchema(db);
  const id = String(ticketId || '').trim().toUpperCase();
  if (!id) throw new Error('請輸入工單 ID');
  const note = String(reason || '客服已結案').trim() || '客服已結案';
  const ticket = await db.prepare('SELECT * FROM support_tickets WHERE ticket_id = ?').bind(id).first();
  if (!ticket) throw new Error('找不到工單');
  await db.prepare(`
    UPDATE support_tickets
    SET status = 'closed',
        last_reply = ?,
        last_actor_id = ?,
        closed_at = COALESCE(closed_at, datetime('now')),
        updated_at = datetime('now')
    WHERE ticket_id = ?
  `).bind(note, String(adminId), id).run();
  await db.prepare(`
    INSERT INTO support_replies (ticket_id, actor_type, actor_id, message, created_at)
    VALUES (?, 'system', ?, ?, datetime('now'))
  `).bind(id, String(adminId), note).run();
  await sendMemberNotice(ticket.user_id, `✅ <b>客服工單已結案</b>\n\n工單：<code>${escHtml(id)}</code>\n原因：${escHtml(note)}`, null, { db });
  await logAction(db, adminId, 'support_ticket_close', id, note.slice(0, 200));
  return { ticketId: id, status: 'closed' };
}

async function handleMemberApi(request, env, pathname) {
  const db = env.DB;
  const parts = pathname.split('/').filter(Boolean).slice(2);

  try {
    if (request.method === 'GET' && parts[0] === 'oauth' && parts[1] === 'providers') {
      return json({ ok: true, data: { providers: oauthPublicProviders(env) } });
    }

    if (request.method === 'POST' && parts[0] === 'login') {
      const verified = await verifyTelegramLoginPayload(await readJsonBody(request), env);
      await getUser(db, verified.userId);
      await saveUserInfo(db, verified.userId, verified.username, verified.firstName);
      const accountUserId = await resolveMemberUserId(db, verified.userId);
      const session = await createMemberSession(accountUserId, env);
      return new Response(JSON.stringify({ ok: true, data: await getMemberBootstrap(db, accountUserId, env) }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': memberCookie(session)
        }
      });
    }

    if (request.method === 'POST' && parts[0] === 'login-code') {
      await enforceRateLimit(
        db,
        await rateKey(['member_login_code_ip', requestClientIp(request)]),
        8,
        10 * 60,
        '登入嘗試過多，請稍後再試'
      );
      const login = await loginMemberWithCode(db, env, await readJsonBody(request));
      return new Response(JSON.stringify({ ok: true, data: login.data }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': memberCookie(login.session)
        }
      });
    }

    if (request.method === 'POST' && parts[0] === 'register') {
      await enforceRateLimit(
        db,
        await rateKey(['member_register_ip', requestClientIp(request)]),
        5,
        60 * 60,
        '註冊太頻繁，請稍後再試'
      );
      const login = await registerMemberWithPassword(db, env, await readJsonBody(request));
      return new Response(JSON.stringify({ ok: true, data: login.data }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': memberCookie(login.session)
        }
      });
    }

    if (request.method === 'POST' && parts[0] === 'password-login') {
      const payload = await readJsonBody(request);
      const emailForLimit = String(payload.email || '').trim().toLowerCase();
      await enforceRateLimit(
        db,
        await rateKey(['member_password_login_ip', requestClientIp(request)]),
        12,
        10 * 60,
        '登入嘗試過多，請稍後再試'
      );
      if (emailForLimit) {
        await enforceRateLimit(
          db,
          await rateKey(['member_password_login_email', emailForLimit]),
          8,
          10 * 60,
          '此 Email 登入嘗試過多，請稍後再試'
        );
      }
      const login = await loginMemberWithPassword(db, env, payload);
      return new Response(JSON.stringify({ ok: true, data: login.data }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': memberCookie(login.session)
        }
      });
    }

    if (request.method === 'POST' && parts[0] === 'logout') {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': memberCookie('', 0)
        }
      });
    }

    const session = await readMemberSession(request, env);
    if (!session) return json({ ok: false, error: 'Unauthorized' }, 401);

    if (request.method === 'GET' && parts[0] === 'me') {
      return json({ ok: true, data: await getMemberBootstrap(db, session.userId, env) });
    }

    if (request.method === 'GET' && parts[0] === 'signals') {
      const user = await getUser(db, session.userId);
      const settings = await getUserSettings(db, session.userId);
      return json({ ok: true, data: await getMemberSignals(db, user, settings, new URL(request.url).searchParams) });
    }

    if (request.method === 'PUT' && parts[0] === 'settings') {
      return json({ ok: true, data: await updateMemberSettings(db, session.userId, await readJsonBody(request)) });
    }

    if (request.method === 'POST' && parts[0] === 'password' && parts[1] === 'setup') {
      await enforceRateLimit(
        db,
        await rateKey(['member_password_setup', session.userId, requestClientIp(request)]),
        5,
        60 * 60,
        '備援帳號建立太頻繁，請稍後再試'
      );
      const account = await setupMemberPasswordBackup(db, session.userId, await readJsonBody(request));
      return json({ ok: true, data: { account, bootstrap: await getMemberBootstrap(db, session.userId, env) } });
    }

    if (request.method === 'POST' && parts[0] === 'password' && parts[1] === 'change') {
      await enforceRateLimit(
        db,
        await rateKey(['member_password_change', session.userId, requestClientIp(request)]),
        5,
        60 * 60,
        '密碼修改太頻繁，請稍後再試'
      );
      return json({ ok: true, data: await changeMemberPassword(db, session.userId, await readJsonBody(request)) });
    }

    if (request.method === 'POST' && parts[0] === 'telegram' && parts[1] === 'link') {
      await enforceRateLimit(
        db,
        await rateKey(['member_telegram_link', session.userId, requestClientIp(request)]),
        8,
        10 * 60,
        'Telegram 綁定嘗試過多，請稍後再試'
      );
      const result = await linkTelegramWithLoginCode(db, env, session.userId, await readJsonBody(request));
      const sessionToken = await createMemberSession(session.userId, env);
      return new Response(JSON.stringify({ ok: true, data: { ...result, bootstrap: await getMemberBootstrap(db, session.userId, env) } }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': memberCookie(sessionToken)
        }
      });
    }

    if (request.method === 'POST' && parts[0] === 'support' && parts.length === 1) {
      await enforceRateLimit(
        db,
        await rateKey(['member_support_create', session.userId, requestClientIp(request)]),
        5,
        60 * 60,
        '客服工單建立太頻繁，請稍後再試'
      );
      return json({ ok: true, data: await createSupportTicket(db, env, session.userId, await readJsonBody(request), 'member-web') });
    }

    if (request.method === 'POST' && parts[0] === 'support' && parts[1] && parts[2] === 'reply') {
      await enforceRateLimit(
        db,
        await rateKey(['member_support_reply', session.userId, requestClientIp(request)]),
        12,
        60 * 60,
        '客服工單回覆太頻繁，請稍後再試'
      );
      return json({ ok: true, data: await replyMemberSupportTicket(db, env, session.userId, parts[1], await readJsonBody(request)) });
    }

    if (request.method === 'POST' && parts[0] === 'orders' && parts.length === 1) {
      await enforceRateLimit(
        db,
        await rateKey(['member_order_create', session.userId]),
        6,
        60 * 60,
        '訂單建立太頻繁，請稍後再試'
      );
      return json({ ok: true, data: await createMemberOrder(db, env, session.userId, await readJsonBody(request), request) });
    }

    if (request.method === 'POST' && parts[0] === 'orders' && parts[1] && parts[2]) {
      return json({ ok: true, data: await updateMemberOrderStatus(db, session.userId, parts[1], parts[2], await readJsonBody(request)) });
    }

    return json({ ok: false, error: 'Not found' }, 404);
  } catch (e) {
    return json({ ok: false, error: e.message }, e.status || 400);
  }
}

function renderMemberCoreScript() {
  return `
(function(){
  window.DC_MEMBER_CORE_BOUND = true;
  function byId(id){ return document.getElementById(id); }
  function status(text,tone){
    var el = byId('loginStatus');
    if(!el) return;
    el.textContent = text || '';
    el.className = 'login-message ' + (tone || '');
  }
  function busy(id,on,text){
    var btn = byId(id);
    if(!btn) return;
    if(on){
      btn.dataset.coreText = btn.dataset.coreText || btn.textContent;
      btn.textContent = text || '處理中...';
      btn.disabled = true;
    }else{
      btn.textContent = btn.dataset.coreText || btn.textContent;
      btn.disabled = false;
    }
  }
  async function api(path, payload){
    var res = await fetch(path, { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload || {}) });
    var data = await res.json().catch(function(){ return {}; });
    if(!res.ok || !data.ok) throw new Error(data.error || ('HTTP ' + res.status));
    return data.data;
  }
  function reloadAfterLogin(message){
    status(message || '登入成功，正在載入會員中心','ok');
    setTimeout(function(){ location.reload(); }, 250);
  }
  function setAuthTab(tab){
    Array.prototype.slice.call(document.querySelectorAll('[data-auth-tab]')).forEach(function(btn){
      btn.classList.toggle('active', btn.dataset.authTab === tab);
    });
    var login = byId('passwordLoginForm');
    var register = byId('passwordRegisterForm');
    if(login) login.classList.toggle('hidden', tab !== 'login');
    if(register) register.classList.toggle('hidden', tab !== 'register');
    status('');
  }
  window.addEventListener('error', function(){
    var login = byId('loginView');
    if(!login || login.classList.contains('hidden')) return;
    status('部分會員功能載入異常，但登入仍可使用。請先使用 Email 或 Telegram 登入碼登入。','error');
  });
  window.addEventListener('unhandledrejection', function(event){
    var login = byId('loginView');
    if(!login || login.classList.contains('hidden')) return;
    var reason = event && event.reason && event.reason.message ? event.reason.message : '';
    if(reason) status(reason, 'error');
  });
  document.addEventListener('click', function(event){
    var tabBtn = event.target.closest('[data-auth-tab]');
    if(tabBtn){
      event.preventDefault();
      event.stopImmediatePropagation();
      setAuthTab(tabBtn.dataset.authTab || 'login');
      return;
    }
    var toggle = event.target.closest('[data-toggle-password]');
    if(toggle){
      event.preventDefault();
      event.stopImmediatePropagation();
      var input = byId(toggle.dataset.togglePassword);
      if(!input) return;
      var visible = input.type === 'text';
      input.type = visible ? 'password' : 'text';
      toggle.textContent = visible ? '顯示' : '隱藏';
      return;
    }
    var codeBtn = event.target.closest('#loginCodeButton');
    if(codeBtn){
      event.preventDefault();
      event.stopImmediatePropagation();
      submitCode();
    }
  }, true);
  var loginForm = byId('passwordLoginForm');
  if(loginForm) loginForm.addEventListener('submit', async function(event){
    event.preventDefault();
    event.stopImmediatePropagation();
    try{
      status('正在登入會員中心...');
      busy('passwordLoginButton', true, '登入中...');
      await api('/api/member/password-login', { email: (byId('loginEmailInput') || {}).value || '', password: (byId('loginPasswordInput') || {}).value || '' });
      if(byId('loginPasswordInput')) byId('loginPasswordInput').value = '';
      reloadAfterLogin('登入成功，正在載入會員中心');
    }catch(err){ status(err.message || '登入失敗','error'); }
    finally{ busy('passwordLoginButton', false); }
  }, true);
  var registerForm = byId('passwordRegisterForm');
  if(registerForm) registerForm.addEventListener('submit', async function(event){
    event.preventDefault();
    event.stopImmediatePropagation();
    try{
      status('正在建立會員帳號...');
      busy('passwordRegisterButton', true, '建立中...');
      await api('/api/member/register', { display_name: (byId('registerNameInput') || {}).value || '', email: (byId('registerEmailInput') || {}).value || '', password: (byId('registerPasswordInput') || {}).value || '' });
      if(byId('registerPasswordInput')) byId('registerPasswordInput').value = '';
      reloadAfterLogin('帳號已建立，正在載入會員中心');
    }catch(err){ status(err.message || '建立帳號失敗','error'); }
    finally{ busy('passwordRegisterButton', false); }
  }, true);
  async function submitCode(){
    var input = byId('loginCodeInput');
    var code = String((input && input.value) || '').replace(/\\D/g,'');
    try{
      status('正在驗證 Telegram 登入碼...');
      busy('loginCodeButton', true, '驗證中...');
      await api('/api/member/login-code', { code: code });
      if(input) input.value = '';
      reloadAfterLogin('登入成功，正在載入會員中心');
    }catch(err){ status(err.message || '登入碼驗證失敗','error'); }
    finally{ busy('loginCodeButton', false); }
  }
  var codeForm = byId('loginCodeForm');
  if(codeForm) codeForm.addEventListener('submit', function(event){
    event.preventDefault();
    event.stopImmediatePropagation();
    submitCode();
  }, true);
  window.onTelegramAuth = async function(user){
    try{
      status('正在驗證 Telegram 身分...');
      await api('/api/member/login', user || {});
      reloadAfterLogin('登入成功，正在載入會員中心');
    }catch(err){ status(err.message || 'Telegram 登入失敗','error'); }
  };
})();
  `;
}

function renderMemberPage() {
  const bot = escHtml(CONFIG.BOT_USERNAME || '');
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DC Signals 會員中心</title>
  <style>
    :root { --bg:#eef3f7; --panel:#fff; --ink:#0b1220; --muted:#64748b; --line:#d5dee8; --accent:#0e9aa7; --accent-2:#3157d8; --green:#16845a; --red:#d1433f; --amber:#b7791f; --soft:#eef7f8; --shadow:0 18px 46px rgba(15,23,42,.10); --shadow-soft:0 8px 22px rgba(15,23,42,.06); }
    * { box-sizing:border-box; }
    body { margin:0; font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background:linear-gradient(180deg,#eef3f7 0%,#f8fafc 42%,#edf3f7 100%); color:var(--ink); }
    button, input, select { font:inherit; }
    a { color:inherit; }
    .wrap { max-width:1240px; margin:0 auto; padding:18px 18px 38px; display:grid; gap:16px; }
    .top { display:flex; justify-content:space-between; gap:14px; align-items:center; position:sticky; top:0; z-index:18; margin:-18px -18px 0; padding:14px 18px; background:rgba(248,250,252,.88); backdrop-filter:blur(18px); border-bottom:1px solid rgba(213,222,232,.72); }
    .brand { display:flex; gap:10px; align-items:center; }
    .mark { width:38px; height:38px; border-radius:8px; background:linear-gradient(135deg,#12c6d0,#3157d8); display:grid; place-items:center; font-weight:900; color:#06111c; box-shadow:0 10px 22px rgba(49,87,216,.22); }
    h1, h2, h3, p { margin:0; }
    h1 { font-size:20px; }
    .muted { color:var(--muted); }
    .btn { border:1px solid var(--line); border-radius:7px; min-height:40px; padding:8px 12px; background:#fff; color:var(--ink); font-weight:850; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; gap:6px; box-shadow:0 2px 8px rgba(15,23,42,.04); }
    .btn.primary { background:linear-gradient(135deg,var(--accent),#087e90); border-color:transparent; color:#fff; box-shadow:0 10px 22px rgba(14,154,167,.20); }
    .btn.ghost { background:#fff; }
    .btn.mini { min-height:34px; padding:6px 10px; font-size:13px; }
    .hero { border:1px solid rgba(15,23,42,.08); border-radius:8px; background:linear-gradient(135deg,#0b1220 0%,#132136 62%,#123b46 100%); color:#f8fafc; padding:20px; box-shadow:var(--shadow); display:grid; grid-template-columns:minmax(0,1fr) auto; gap:18px; align-items:center; overflow:hidden; }
    .hero h2 { font-size:28px; line-height:1.12; }
    .hero p { color:#cbd5e1; margin-top:8px; }
    .grid { display:grid; gap:14px; }
    .grid.two { grid-template-columns: minmax(0,1fr) minmax(330px,.55fr); align-items:start; }
    .kpis { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }
    .panel, .kpi, .signal { background:rgba(255,255,255,.94); border:1px solid rgba(213,222,232,.92); border-radius:8px; box-shadow:var(--shadow-soft); }
    .kpi { padding:13px; position:relative; overflow:hidden; }
    .kpi::after { content:""; position:absolute; left:0; right:0; bottom:0; height:3px; background:linear-gradient(90deg,var(--accent),rgba(49,87,216,.72)); }
    .kpi span, label { display:block; color:var(--muted); font-size:12px; font-weight:800; }
    .kpi strong { display:block; margin-top:7px; font-size:22px; }
    .panel header { padding:14px 16px; border-bottom:1px solid rgba(213,222,232,.86); display:flex; justify-content:space-between; gap:10px; align-items:center; background:linear-gradient(180deg,#fff,#fbfdff); }
    .panel .body { padding:16px; }
    .stack { display:grid; gap:10px; }
    .tabs { display:flex; gap:6px; flex-wrap:wrap; }
    .tabs button { border:1px solid var(--line); border-radius:999px; background:#fff; min-height:32px; padding:5px 10px; color:var(--muted); font-size:12px; font-weight:900; cursor:pointer; }
    .tabs button.active { border-color:rgba(14,154,167,.36); background:#e6f8fa; color:#087e90; }
    .member-tab-rail { display:flex; gap:8px; overflow-x:auto; padding:4px; border:1px solid rgba(213,222,232,.88); border-radius:8px; background:rgba(255,255,255,.82); box-shadow:var(--shadow-soft); scrollbar-width:none; }
    .member-tab-rail::-webkit-scrollbar { display:none; }
    .member-tab-rail button { flex:1 0 150px; border:0; border-radius:7px; min-height:54px; background:transparent; color:var(--muted); cursor:pointer; text-align:left; padding:8px 10px; display:grid; gap:3px; font-weight:900; }
    .member-tab-rail button::before { content:attr(data-icon); font-size:13px; color:var(--accent); }
    .member-tab-rail button span { display:block; color:var(--muted); font-size:11px; font-weight:800; line-height:1.25; }
    .member-tab-rail button.active { background:#0f172a; color:#f8fafc; }
    .member-tab-rail button.active span, .member-tab-rail button.active::before { color:#99f6e4; }
    .member-smart-menu { display:grid; grid-template-columns:minmax(0,1fr) minmax(210px,260px); gap:12px; align-items:center; padding:14px; border:1px solid rgba(213,222,232,.9); border-radius:8px; background:linear-gradient(135deg,rgba(255,255,255,.96),rgba(240,249,250,.92)); box-shadow:var(--shadow-soft); }
    .member-smart-copy { display:grid; gap:4px; min-width:0; }
    .member-smart-copy span { color:var(--accent); font-size:12px; font-weight:900; }
    .member-smart-copy strong { font-size:18px; line-height:1.25; }
    .member-smart-copy p { color:var(--muted); line-height:1.45; font-size:13px; }
    .member-smart-select { width:100%; min-height:44px; border:1px solid var(--line); border-radius:8px; padding:8px 38px 8px 12px; background:#fff; color:var(--ink); font-weight:900; box-shadow:0 2px 8px rgba(15,23,42,.04); }
    .member-workspace { display:grid; gap:14px; align-items:start; }
    .member-workspace[data-section="settings"] { grid-template-columns:repeat(2,minmax(0,1fr)); }
    [data-member-panel] { display:none; }
    [data-member-panel].active { display:block; }
    .signal-toolbar { display:grid; grid-template-columns:minmax(0,1fr) auto auto; gap:8px; align-items:end; margin-bottom:12px; }
    .date-range { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
    .plan-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
    .plan { border:1px solid var(--line); border-radius:8px; padding:13px; display:grid; gap:10px; background:#fff; }
    .plan.vip { border-color:rgba(183,121,31,.35); background:#fffdf7; }
    .plan-head { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; }
    .plan-head strong { display:block; font-size:16px; }
    .plan-price { display:grid; gap:7px; }
    .plan-row { display:grid; grid-template-columns:1fr auto; gap:8px; align-items:center; border:1px solid var(--line); border-radius:7px; padding:8px; background:#f8fafc; }
    .plan-actions { display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end; }
    .plan-actions .btn { white-space:nowrap; }
    .payment-box { border:1px solid rgba(8,167,179,.24); background:#f4fbfc; border-radius:8px; padding:12px; display:grid; gap:7px; }
    .order-card { border:1px solid var(--line); border-radius:8px; padding:11px; display:grid; gap:8px; }
    .order-actions { display:flex; gap:7px; flex-wrap:wrap; }
    .order-timeline { border-top:1px solid var(--line); padding-top:8px; display:grid; gap:5px; }
    .order-timeline div { display:grid; grid-template-columns:auto minmax(0,1fr); gap:8px; align-items:start; color:var(--muted); font-size:12px; line-height:1.4; }
    .order-timeline b { color:var(--ink); font-size:12px; white-space:nowrap; }
    .support-thread { border-top:1px solid var(--line); padding-top:8px; display:grid; gap:7px; }
    .support-msg { border:1px solid var(--line); border-radius:7px; padding:8px; background:#f8fafc; font-size:13px; line-height:1.45; }
    .support-msg b { display:block; font-size:12px; margin-bottom:3px; color:var(--ink); }
    .support-msg.admin { border-color:rgba(8,167,179,.28); background:#f4fbfc; }
    .support-msg.system { border-color:rgba(183,121,31,.24); background:#fffdf5; }
    .support-followup { border:1px solid var(--line); border-radius:8px; padding:9px; background:#fff; }
    .support-followup summary { cursor:pointer; font-weight:900; }
    .support-followup form { display:grid; gap:8px; margin-top:8px; }
    .proof-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
    .security-grid { display:grid; gap:9px; }
    .security-meta { display:grid; gap:6px; padding:10px; border:1px solid var(--line); border-radius:8px; background:#f8fafc; font-size:13px; }
    .terms-box { border:1px solid rgba(183,121,31,.26); background:#fffdf5; border-radius:8px; padding:10px; display:grid; gap:8px; font-size:13px; line-height:1.5; }
    .chips { display:flex; gap:7px; flex-wrap:wrap; }
    .chip { display:inline-flex; align-items:center; gap:6px; min-height:28px; padding:4px 10px; border-radius:999px; background:var(--soft); color:#475569; font-size:12px; font-weight:800; }
    .chip.green { background:#e8f7ef; color:var(--green); }
    .chip.red { background:#fff0ef; color:var(--red); }
    .chip.amber { background:#fff7e6; color:var(--amber); }
    .signal { padding:14px; display:grid; gap:10px; border-left:4px solid var(--accent); }
    .signal-head { display:flex; justify-content:space-between; gap:10px; }
    .signal-head strong { display:block; font-size:17px; }
    .signal-meta { color:var(--muted); font-size:12px; line-height:1.45; margin-top:4px; }
    .levels { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
    .levels div { background:#f8fafc; border:1px solid rgba(213,222,232,.78); border-radius:7px; padding:9px; }
    .levels span { display:block; color:var(--muted); font-size:11px; font-weight:800; margin-bottom:4px; }
    .levels b { font-size:14px; }
    .signal-actions { display:flex; gap:7px; flex-wrap:wrap; }
    .signal-result { display:flex; gap:7px; flex-wrap:wrap; align-items:center; color:var(--muted); font-size:13px; }
    .form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
    .full { grid-column:1/-1; }
    input, textarea { width:100%; border:1px solid var(--line); border-radius:7px; min-height:40px; padding:8px 10px; background:#fff; color:var(--ink); outline:none; }
    input:focus, textarea:focus { border-color:var(--accent); box-shadow:0 0 0 3px rgba(14,154,167,.13); }
    textarea { min-height:92px; resize:vertical; }
    .check { display:flex; align-items:center; gap:8px; min-height:34px; color:var(--ink); font-size:14px; }
    .check input { width:auto; min-height:unset; }
    .login { min-height:100vh; padding:22px; display:grid; place-items:center; background:linear-gradient(135deg,#f8fafc 0%,#eef3f7 46%,#e8f2f5 100%); }
    .login-shell { width:min(1120px,100%); display:grid; grid-template-columns:minmax(360px,.88fr) minmax(420px,1fr); gap:18px; align-items:stretch; }
    .login-panel, .login-preview { background:rgba(255,255,255,.94); border:1px solid rgba(217,227,234,.92); border-radius:8px; box-shadow:var(--shadow); overflow:hidden; }
    .login-panel { padding:22px; display:grid; gap:14px; align-content:start; }
    .login-brand { display:flex; align-items:center; justify-content:space-between; gap:14px; }
    .login-title { display:grid; gap:6px; }
    .login-title h1 { font-size:25px; line-height:1.15; letter-spacing:0; }
    .login-title p { color:var(--muted); line-height:1.55; font-size:14px; }
    .login-badge { display:inline-flex; align-items:center; min-height:30px; padding:5px 10px; border-radius:999px; background:#ecfeff; color:#0e7490; font-size:12px; font-weight:900; white-space:nowrap; }
    .login-proof { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }
    .login-proof div { border:1px solid var(--line); border-radius:8px; padding:9px; background:#f8fafc; }
    .login-proof span { display:block; font-size:11px; font-weight:900; color:var(--muted); }
    .login-proof b { display:block; margin-top:4px; font-size:14px; }
    .login-code { display:grid; gap:9px; text-align:left; }
    .login-code button { width:100%; }
    .auth-tabs { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px; padding:4px; border:1px solid var(--line); border-radius:8px; background:#f8fafc; }
    .auth-tabs button { border:0; border-radius:6px; min-height:34px; background:transparent; color:var(--muted); font-weight:900; cursor:pointer; }
    .auth-tabs button.active { background:#fff; color:var(--ink); box-shadow:0 2px 8px rgba(15,23,42,.06); }
    .auth-form { display:grid; gap:10px; }
    .auth-form .btn { width:100%; }
    .field { display:grid; gap:6px; }
    .password-field { position:relative; }
    .password-field input { padding-right:72px; }
    .password-field button { position:absolute; right:6px; top:6px; min-height:28px; padding:4px 8px; border-radius:6px; border:1px solid var(--line); background:#fff; color:var(--muted); font-size:12px; font-weight:900; cursor:pointer; }
    .form-foot { display:flex; justify-content:space-between; gap:10px; align-items:center; color:var(--muted); font-size:13px; }
    .form-foot a { color:#087e90; font-weight:900; text-decoration:none; }
    .login-message { min-height:38px; border:1px solid var(--line); border-radius:8px; background:#f8fafc; color:var(--muted); padding:9px 10px; font-size:13px; line-height:1.45; display:flex; align-items:center; }
    .login-message:empty { display:none; }
    .login-message.error { border-color:rgba(209,67,63,.28); background:#fff5f5; color:var(--red); }
    .login-message.ok { border-color:rgba(22,132,90,.28); background:#effaf3; color:var(--green); }
    .login-switch { border:1px solid var(--line); border-radius:8px; padding:12px; text-align:left; display:grid; gap:9px; background:#fff; }
    .login-divider { display:flex; align-items:center; gap:10px; color:var(--muted); font-size:12px; font-weight:800; }
    .login-divider:before, .login-divider:after { content:""; height:1px; background:var(--line); flex:1; }
    .login-hint { font-size:13px; line-height:1.55; }
    .oauth-grid { display:grid; gap:8px; }
    .oauth-btn { width:100%; min-height:42px; justify-content:flex-start; padding-left:13px; }
    .oauth-icon { width:23px; height:23px; border-radius:6px; display:grid; place-items:center; background:#f8fafc; color:#101828; font-weight:900; font-size:13px; }
    .oauth-btn.google { border-color:#d6dee8; }
    .oauth-btn.google .oauth-icon { color:#4285f4; background:#fff; border:1px solid #e5e7eb; }
    .oauth-empty { border:1px dashed var(--line); border-radius:8px; padding:10px; color:var(--muted); font-size:13px; line-height:1.45; background:#f8fafc; }
    .login-widget { border:1px solid var(--line); border-radius:8px; padding:12px; text-align:left; display:grid; gap:9px; background:#fff; }
    .login-widget strong { display:block; font-size:15px; }
    .widget-box { display:grid; gap:8px; }
    .login-footer { display:flex; justify-content:center; gap:12px; flex-wrap:wrap; color:var(--muted); font-size:12px; }
    .login-footer a { color:var(--muted); text-decoration:none; font-weight:800; }
    .login-preview { background:linear-gradient(180deg,#0b1220,#111827); color:#f8fafc; padding:18px; display:grid; gap:14px; align-content:stretch; }
    .preview-head { display:flex; justify-content:space-between; align-items:center; gap:12px; }
    .preview-head h2 { font-size:20px; line-height:1.2; }
    .preview-head p { margin-top:5px; color:#94a3b8; font-size:13px; line-height:1.45; }
    .preview-status { border:1px solid rgba(148,163,184,.24); border-radius:999px; padding:6px 10px; color:#67e8f9; font-size:12px; font-weight:900; white-space:nowrap; }
    .chart-stage { border:1px solid rgba(148,163,184,.18); border-radius:8px; min-height:168px; padding:14px; background:linear-gradient(180deg,#111827,#0b1220); position:relative; overflow:hidden; }
    .chart-grid { position:absolute; inset:0; background-image:linear-gradient(rgba(148,163,184,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.08) 1px, transparent 1px); background-size:100% 34px, 58px 100%; }
    .chart-line { position:absolute; left:18px; right:18px; top:44px; height:74px; border-bottom:3px solid #22d3ee; transform:skewY(-8deg); opacity:.92; }
    .chart-line:before, .chart-line:after { content:""; position:absolute; border-radius:999px; background:#22d3ee; box-shadow:0 0 0 7px rgba(34,211,238,.12); }
    .chart-line:before { width:10px; height:10px; left:28%; bottom:-6px; }
    .chart-line:after { width:12px; height:12px; right:18%; bottom:-7px; background:#f43f5e; box-shadow:0 0 0 7px rgba(244,63,94,.12); }
    .chart-labels { position:relative; z-index:1; display:flex; gap:7px; flex-wrap:wrap; }
    .signal-preview-card { border:1px solid rgba(148,163,184,.22); border-radius:8px; padding:15px; background:rgba(15,23,42,.86); box-shadow:0 18px 42px rgba(0,0,0,.24); display:grid; gap:13px; }
    .signal-preview-head { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
    .signal-preview-head strong { display:block; font-size:22px; letter-spacing:0; }
    .signal-preview-head span { display:block; color:#94a3b8; font-size:12px; margin-top:4px; }
    .preview-levels { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
    .preview-levels div { border:1px solid rgba(148,163,184,.18); border-radius:8px; padding:9px; background:rgba(255,255,255,.04); }
    .preview-levels span { color:#94a3b8; font-size:11px; font-weight:900; }
    .preview-levels b { display:block; margin-top:4px; font-size:15px; }
    .login-checklist { display:grid; gap:8px; color:#cbd5e1; font-size:13px; line-height:1.45; }
    .login-checklist div { display:flex; gap:8px; align-items:flex-start; }
    .login-checklist b { color:#67e8f9; }
    .member-mobile-nav { display:none; }
    .hidden { display:none !important; }
    .toast { position:fixed; right:16px; bottom:16px; max-width:min(420px,calc(100vw - 32px)); background:#fff; border:1px solid var(--line); border-radius:8px; padding:10px 12px; box-shadow:var(--shadow); color:var(--muted); }
    .toast:empty { display:none; }
    @media (max-width:860px) { .login { padding:12px; align-items:start; } .login-shell { grid-template-columns:1fr; } .login-panel { order:1; } .login-preview { order:2; min-height:auto; } .chart-stage { min-height:116px; } .login-checklist { display:none; } }
    @media (max-width:760px) { .wrap { padding:12px 12px calc(92px + env(safe-area-inset-bottom)); } .top, .hero, .member-smart-menu { grid-template-columns:1fr; align-items:start; } .grid.two, .member-workspace[data-section="settings"], .levels, .form-grid, .plan-grid, .proof-grid, .signal-toolbar, .date-range, .plan-row, .preview-levels { grid-template-columns:1fr; } .top { margin:-12px -12px 0; padding:10px 12px; background:rgba(248,250,252,.94); } .hero { padding:14px; } .hero h2 { font-size:22px; } .hero p { display:none; } .member-tab-rail { display:none; } .member-smart-menu { gap:10px; padding:12px; } .member-smart-copy strong { font-size:17px; } .member-smart-copy p { font-size:12px; } .kpis { grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; } .kpi { min-height:76px; padding:11px; } .kpi strong { font-size:20px; } .panel header { align-items:flex-start; flex-direction:column; padding:12px; } .panel .body { padding:12px; } .tabs, .signal-actions, .plan-actions { width:100%; } .tabs button, .signal-actions .btn, .plan-actions .btn { flex:1; } input, textarea, .btn { min-height:46px; } .login { padding:10px; place-items:start center; } .login-shell { gap:10px; } .login-preview { display:none; } .login-panel { padding:16px; border-radius:8px; } .login-brand { align-items:flex-start; } .login-title h1 { font-size:22px; } .login-title p { font-size:13px; } .login-proof { grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; } .login-proof div { padding:8px 6px; } .login-proof b { font-size:12px; } .login-badge { display:none; } .member-mobile-nav { position:fixed; left:8px; right:8px; bottom:calc(8px + env(safe-area-inset-bottom)); display:flex; gap:4px; padding:7px; border:1px solid rgba(255,255,255,.62); border-radius:16px; background:rgba(11,18,32,.94); backdrop-filter:blur(18px); box-shadow:0 18px 42px rgba(15,23,42,.24); z-index:40; } .member-mobile-nav button { flex:1; border:0; border-radius:10px; background:transparent; min-height:50px; color:#cbd5e1; font-size:11px; font-weight:900; display:grid; place-items:center; gap:3px; } .member-mobile-nav button::before { content:attr(data-icon); color:#99f6e4; font-size:15px; line-height:1; } .member-mobile-nav button.active { background:rgba(20,184,166,.18); color:#99f6e4; } .toast { left:12px; right:12px; bottom:calc(86px + env(safe-area-inset-bottom)); max-width:none; } }
  </style>
</head>
<body>
  <section class="login" id="loginView">
    <div class="login-shell">
      <div class="login-panel">
        <div class="login-brand">
          <div class="brand"><div class="mark">DC</div><div><h1>DC Signals</h1><p class="muted">Trading Signals Portal</p></div></div>
          <div class="login-badge">會員專用</div>
        </div>
        <div class="login-title">
          <h1>登入會員中心</h1>
          <p>線上查看最新訊號、訂閱品種、會員方案、訂單付款與客服紀錄。</p>
        </div>
        <div class="login-proof">
          <div><span>訊號</span><b>即時 / 歷史</b></div>
          <div><span>通知</span><b>Telegram 綁定</b></div>
          <div><span>帳務</span><b>續費 / 訂單</b></div>
        </div>
        <div class="login-message" id="loginStatus"></div>
        <div class="auth-tabs">
          <button class="active" type="button" data-auth-tab="login">登入</button>
          <button type="button" data-auth-tab="register">註冊</button>
        </div>
        <form class="auth-form" id="passwordLoginForm">
          <div class="field">
            <label for="loginEmailInput">Email</label>
            <input id="loginEmailInput" type="email" autocomplete="email" placeholder="you@example.com" required>
          </div>
          <div class="field">
            <label for="loginPasswordInput">密碼</label>
            <div class="password-field"><input id="loginPasswordInput" type="password" autocomplete="current-password" placeholder="至少 8 碼" required><button type="button" data-toggle-password="loginPasswordInput">顯示</button></div>
          </div>
          <div class="form-foot"><span>安全登入，Cookie 僅用於會員驗證</span>${bot ? `<a href="https://t.me/${bot}" target="_blank" rel="noopener">需要協助？</a>` : `<a href="/terms">使用條款</a>`}</div>
          <button class="btn primary" type="submit" id="passwordLoginButton">登入會員中心</button>
        </form>
        <form class="auth-form hidden" id="passwordRegisterForm">
          <div class="field">
            <label for="registerNameInput">顯示名稱</label>
            <input id="registerNameInput" autocomplete="name" placeholder="例如 Juliot" required>
          </div>
          <div class="field">
            <label for="registerEmailInput">Email</label>
            <input id="registerEmailInput" type="email" autocomplete="email" placeholder="you@example.com" required>
          </div>
          <div class="field">
            <label for="registerPasswordInput">密碼</label>
            <div class="password-field"><input id="registerPasswordInput" type="password" autocomplete="new-password" placeholder="英文 + 數字，至少 8 碼" required><button type="button" data-toggle-password="registerPasswordInput">顯示</button></div>
          </div>
          <button class="btn primary" type="submit" id="passwordRegisterButton">建立並登入</button>
        </form>
        <div class="login-divider"><span>快速登入</span></div>
        <div class="oauth-grid" id="oauthLogin"><div class="oauth-empty">第三方登入尚未啟用，請使用 Email 密碼或 Telegram /login 登入碼。</div></div>
        <details class="login-switch" open>
          <summary>使用 Telegram /login 一次性登入碼</summary>
          <form class="login-code" id="loginCodeForm">
            <label for="loginCodeInput">6 位登入碼</label>
            <input id="loginCodeInput" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="輸入 Telegram 取得的 6 位碼">
            <button class="btn primary" type="submit" id="loginCodeButton">使用登入碼登入</button>
          </form>
          <p class="muted login-hint">在 Telegram 對 ${bot ? `<a href="https://t.me/${bot}" target="_blank" rel="noopener">@${bot}</a>` : '機器人'} 輸入 <b>/login</b>，系統會產生一次性登入碼。</p>
        </details>
        <div class="login-widget">
          <strong>Telegram 快速登入</strong>
          <div class="widget-box">
            <p class="muted login-hint">請使用上方 /login 一次性登入碼。Telegram Widget 需先在 BotFather 綁定正式網域，未綁定前系統不會顯示壞掉的按鈕。</p>
            ${bot ? `<a class="btn ghost" href="https://t.me/${bot}" target="_blank" rel="noopener">打開 Telegram 機器人</a>` : `<div class="chip amber">尚未設定 BOT_USERNAME</div>`}
          </div>
        </div>
        <div class="login-footer"><a href="/terms">服務條款</a><a href="/risk-disclosure">風險揭露</a><a href="/privacy">隱私權</a><a href="/refund">退款政策</a></div>
      </div>
      <aside class="login-preview" aria-label="訊號預覽">
        <div class="preview-head">
          <div><h2>會員訊號工作台</h2><p>登入後即可查看可訂閱品種、進出場點位、歷史訊號與付款狀態。</p></div>
          <div class="preview-status">Worker Online</div>
        </div>
        <div class="chart-stage">
          <div class="chart-grid"></div>
          <div class="chart-line"></div>
          <div class="chart-labels">${['USTEC','XAUUSD','NQ','GC'].map((item) => `<span class="chip">${item}</span>`).join('')}</div>
        </div>
        <div class="signal-preview-card">
          <div class="signal-preview-head">
            <div><strong>USTEC SHORT</strong><span>短線訊號 · TradingView Alert</span></div>
            <span class="chip red">進行中</span>
          </div>
          <div class="preview-levels">
            <div><span>進場</span><b>21,506.00</b></div>
            <div><span>止損</span><b>21,536.00</b></div>
            <div><span>TP1</span><b>21,476.00</b></div>
            <div><span>TP2 / TP3</span><b>21,446 / 21,416</b></div>
          </div>
        </div>
        <div class="login-checklist">
          <div><b>✓</b><span>Google 登入、Email 密碼與 Telegram 登入碼可並行使用。</span></div>
          <div><b>✓</b><span>登入後可直接管理訂閱、付款與客服，不必只靠 Telegram 指令。</span></div>
          <div><b>✓</b><span>所有交易資訊僅供參考，請先閱讀風險揭露。</span></div>
        </div>
      </aside>
    </div>
  </section>
  <main class="wrap hidden" id="appView">
    <div class="top">
      <div class="brand"><div class="mark">DC</div><div><h1>DC Signals</h1><p class="muted" id="memberName">會員中心</p></div></div>
      <div class="chips"><button class="btn" id="refreshBtn">重新整理</button><button class="btn" id="logoutBtn">登出</button></div>
    </div>
    <section class="hero">
      <div><h2 id="heroTitle">線上訊號工作台</h2><p id="heroCopy">同步 Telegram 會員資料、訂閱品種與訊號歷史。</p></div>
      <div class="chips" id="heroChips"></div>
    </section>
    <section class="kpis" id="kpis"></section>
    <section class="member-smart-menu" aria-label="會員智慧選單">
      <div class="member-smart-copy">
        <span id="memberSectionEyebrow">目前功能</span>
        <strong id="memberSectionTitle">線上訊號</strong>
        <p id="memberSectionCopy">查看進出場點位、TP 命中與歷史結算紀錄。</p>
      </div>
      <select class="member-smart-select" id="memberSectionSelect" aria-label="選擇會員功能">
        <option value="signals">線上訊號</option>
        <option value="events">財經日曆</option>
        <option value="plans">升級續費</option>
        <option value="settings">訂閱設定 / 帳號安全</option>
        <option value="orders">訂單紀錄</option>
        <option value="support">客服支援</option>
      </select>
    </section>
    <nav class="member-tab-rail" id="memberNavRail" aria-label="會員功能切換">
      <button type="button" class="active" data-member-section="signals" data-icon="↗">線上訊號<span>進出場與歷史紀錄</span></button>
      <button type="button" data-member-section="events" data-icon="📅">財經日曆<span>今日重要事件</span></button>
      <button type="button" data-member-section="plans" data-icon="$">升級續費<span>方案、付款與收據</span></button>
      <button type="button" data-member-section="settings" data-icon="⚙">訂閱設定<span>品種、通知與備援登入</span></button>
      <button type="button" data-member-section="orders" data-icon="▤">訂單紀錄<span>付款狀態與歷程</span></button>
      <button type="button" data-member-section="support" data-icon="?">客服支援<span>工單與回覆追蹤</span></button>
    </nav>
    <section class="member-workspace" id="memberWorkspace" data-section="signals">
      <section class="panel active" data-member-panel="signals"><header><h3>線上訊號</h3><div class="tabs" id="signalTabs"><button class="active" data-member-signal-filter="all" type="button">全部</button><button data-member-signal-filter="active" type="button">進行中</button><button data-member-signal-filter="history" type="button">歷史</button></div></header><div class="body"><div class="signal-toolbar"><div class="date-range"><div><label>起始時間</label><input id="signalStart" type="date"></div><div><label>結束時間</label><input id="signalEnd" type="date"></div></div><button class="btn ghost" id="clearSignalDates" type="button">清除</button><span class="muted" id="signalCount"></span></div><div class="stack" id="signals"></div></div></section>
      <section class="panel" data-member-panel="events"><header><h3>財經日曆</h3><span class="muted">台北 UTC+8</span></header><div class="body"><div class="stack" id="economicEvents"></div></div></section>
      <section class="panel" data-member-panel="plans"><header><h3>升級 / 續費</h3></header><div class="body"><div class="stack"><div class="plan-grid" id="plans"></div><div class="payment-box" id="paymentBox"></div></div></div></section>
      <section class="panel" data-member-panel="settings"><header><h3>訂閱設定</h3><button class="btn primary" id="saveBtn">儲存</button></header><div class="body"><form id="settingsForm" class="stack"></form></div></section>
      <section class="panel" data-member-panel="settings"><header><h3>帳號安全</h3></header><div class="body"><div id="securityBox" class="security-grid"></div></div></section>
      <section class="panel" data-member-panel="orders"><header><h3>訂單紀錄</h3></header><div class="body"><div class="stack" id="orders"></div></div></section>
      <section class="panel" id="support" data-member-panel="support"><header><h3>客服支援</h3></header><div class="body"><form id="supportForm" class="stack"><div><label>問題主旨</label><input name="subject" placeholder="例如：付款確認、訊號設定、帳號問題"></div><div><label>問題內容</label><textarea name="message" placeholder="請描述您遇到的狀況，客服會從後台或 Telegram 回覆。"></textarea></div><button class="btn primary" type="submit">送出客服工單</button></form><div class="stack" id="supportTickets"></div></div></section>
    </section>
    <nav class="member-mobile-nav" id="memberMobileNav">
      <button type="button" class="active" data-member-section="signals" data-icon="↗">訊號</button>
      <button type="button" data-member-section="events" data-icon="📅">事件</button>
      <button type="button" data-member-section="plans" data-icon="$">方案</button>
      <button type="button" data-member-section="settings" data-icon="⚙">設定</button>
      <button type="button" data-member-section="orders" data-icon="▤">訂單</button>
      <button type="button" data-member-section="support" data-icon="?">客服</button>
    </nav>
  </main>
  <div class="toast" id="toast"></div>
  <script>${renderMemberCoreScript()}</script>
  <script>
var state = null;
var memberSignalFilter = 'all';
var checkoutNoticeShown = false;
var signalLoadId = 0;
var memberActiveSection = 'signals';
var loginView = document.getElementById('loginView');
var appView = document.getElementById('appView');
var toast = document.getElementById('toast');
var memberMobileNav = document.getElementById('memberMobileNav');
var memberWorkspace = document.getElementById('memberWorkspace');
var memberSectionSelect = document.getElementById('memberSectionSelect');
var loginCodeForm = document.getElementById('loginCodeForm');
var loginCodeInput = document.getElementById('loginCodeInput');
var loginCodeButton = document.getElementById('loginCodeButton');
var passwordLoginForm = document.getElementById('passwordLoginForm');
var passwordRegisterForm = document.getElementById('passwordRegisterForm');
var oauthLogin = document.getElementById('oauthLogin');
var loginStatus = document.getElementById('loginStatus');
var MEMBER_SECTIONS = {
  signals: { title:'線上訊號', copy:'查看進出場點位、TP 命中、起訖時間與歷史結算紀錄。' },
  events: { title:'財經日曆', copy:'查看今日與近期高影響經濟事件，避開重大數據前後風險。' },
  plans: { title:'升級續費', copy:'選擇 Pro / VIP 方案，建立付款訂單並查看轉帳資訊。' },
  settings: { title:'訂閱設定 / 帳號安全', copy:'管理訂閱品種、通知偏好、Telegram 綁定與備援登入方式。' },
  orders: { title:'訂單紀錄', copy:'追蹤付款狀態、收據、退款與訂單歷程。' },
  support: { title:'客服支援', copy:'建立工單、補充付款或訊號問題，集中追蹤客服回覆。' }
};
function esc(value){ return String(value == null ? '' : value).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function money(value){ return 'NT$' + Number(value || 0).toLocaleString('zh-TW'); }
function price(value){ var n = Number(value); return isFinite(n) ? n.toFixed(2) : '-'; }
function dateText(value){ if(!value) return '-'; var text=String(value); var d=new Date(/(?:Z|[+-]\\d{2}:?\\d{2})$/i.test(text)?text:text.replace(' ','T')+'Z'); return isNaN(d.getTime())?'-':d.toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}); }
function chip(text,tone){ return '<span class="chip '+(tone||'')+'">'+esc(text)+'</span>'; }
function showToast(text,tone){ toast.textContent=text||''; toast.style.color=tone==='error'?'#d1433f':'#667085'; if(text) setTimeout(function(){ if(toast.textContent===text) toast.textContent=''; },3600); }
function setMemberSection(section, scrollTop){
  memberActiveSection = MEMBER_SECTIONS[section] ? section : 'signals';
  var meta = MEMBER_SECTIONS[memberActiveSection] || MEMBER_SECTIONS.signals;
  if(memberWorkspace) memberWorkspace.dataset.section = memberActiveSection;
  var title = document.getElementById('memberSectionTitle');
  var copy = document.getElementById('memberSectionCopy');
  if(title) title.textContent = meta.title;
  if(copy) copy.textContent = meta.copy;
  if(memberSectionSelect && memberSectionSelect.value !== memberActiveSection) memberSectionSelect.value = memberActiveSection;
  Array.prototype.slice.call(document.querySelectorAll('[data-member-panel]')).forEach(function(panel){
    panel.classList.toggle('active', panel.dataset.memberPanel === memberActiveSection);
  });
  Array.prototype.slice.call(document.querySelectorAll('[data-member-section]')).forEach(function(btn){
    btn.classList.toggle('active', btn.dataset.memberSection === memberActiveSection);
  });
  if(scrollTop && window.matchMedia && window.matchMedia('(max-width: 760px)').matches){
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
function showLoginMessage(text,tone){
  if(!loginStatus) return;
  loginStatus.textContent = text || '';
  loginStatus.className = 'login-message ' + (tone || '');
}
function setButtonBusy(buttonId,busy,text){
  var button = document.getElementById(buttonId);
  if(!button) return;
  if(busy){
    button.dataset.originalText = button.dataset.originalText || button.textContent;
    button.textContent = text || '處理中...';
    button.disabled = true;
  }else{
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}
async function api(path, options){ var res=await fetch(path,Object.assign({credentials:'same-origin',headers:{'Content-Type':'application/json'}},options||{})); var data=await res.json().catch(function(){return{};}); if(!res.ok||!data.ok) throw new Error(data.error||('HTTP '+res.status)); return data.data; }
function showCheckoutReturnToast(){
  if(checkoutNoticeShown) return;
  var params = new URLSearchParams(location.search);
  var status = params.get('checkout');
  if(!status) return;
  checkoutNoticeShown = true;
  if(status === 'success') showToast('付款完成，系統正在確認訂單');
  if(status === 'cancel') showToast('付款未完成，可在訂單紀錄繼續付款','error');
  history.replaceState(null, '', location.pathname);
}
async function loadOAuthProviders(){
  if(!oauthLogin) return;
  var fallback = '<div class="oauth-empty">第三方登入尚未啟用，請使用 Email 密碼或 Telegram /login 登入碼。</div>';
  oauthLogin.innerHTML = fallback;
  try{
    var timeout = new Promise(function(resolve){ setTimeout(function(){ resolve({ providers: [] }); }, 3500); });
    var data = await Promise.race([api('/api/member/oauth/providers'), timeout]);
    var providers = (data.providers || []).filter(function(provider){ return provider.enabled; });
    if(!providers.length){
      oauthLogin.innerHTML = fallback;
      return;
    }
    oauthLogin.innerHTML = providers.map(function(provider){
      return '<a class="btn oauth-btn google" href="/auth/'+esc(provider.id)+'/start"><span class="oauth-icon">G</span><span>使用 '+esc(provider.name)+' 登入</span></a>';
    }).join('');
  }catch(err){ oauthLogin.innerHTML = '<div class="oauth-empty">第三方登入狀態暫時無法取得，請改用 Email 或 Telegram 登入碼。</div>'; }
}
window.onTelegramAuth = async function(user){ try{ showLoginMessage('正在驗證 Telegram 身分...'); state = await api('/api/member/login',{method:'POST',body:JSON.stringify(user)}); showLoginMessage('登入成功，正在載入會員中心','ok'); render(); }catch(err){ showLoginMessage(err.message,'error'); showToast(err.message,'error'); } };
function setAuthTab(tab){
  Array.prototype.slice.call(document.querySelectorAll('[data-auth-tab]')).forEach(function(btn){ btn.classList.toggle('active', btn.dataset.authTab === tab); });
  passwordLoginForm.classList.toggle('hidden', tab !== 'login');
  passwordRegisterForm.classList.toggle('hidden', tab !== 'register');
  showLoginMessage('');
}
document.querySelector('.auth-tabs').addEventListener('click', function(event){
  var btn = event.target.closest('[data-auth-tab]');
  if(btn) setAuthTab(btn.dataset.authTab);
});
document.body.addEventListener('click', function(event){
  var toggle = event.target.closest('[data-toggle-password]');
  if(!toggle) return;
  var input = document.getElementById(toggle.dataset.togglePassword);
  if(!input) return;
  var visible = input.type === 'text';
  input.type = visible ? 'password' : 'text';
  toggle.textContent = visible ? '顯示' : '隱藏';
});
passwordLoginForm.addEventListener('submit', async function(event){
  event.preventDefault();
  try{
    showLoginMessage('正在登入會員中心...');
    setButtonBusy('passwordLoginButton', true, '登入中...');
    state = await api('/api/member/password-login',{method:'POST',body:JSON.stringify({
      email: document.getElementById('loginEmailInput').value,
      password: document.getElementById('loginPasswordInput').value
    })});
    document.getElementById('loginPasswordInput').value = '';
    showLoginMessage('登入成功，正在載入會員中心','ok');
    render();
  }catch(err){ showLoginMessage(err.message,'error'); showToast(err.message,'error'); }
  finally{ setButtonBusy('passwordLoginButton', false); }
});
passwordRegisterForm.addEventListener('submit', async function(event){
  event.preventDefault();
  try{
    showLoginMessage('正在建立會員帳號...');
    setButtonBusy('passwordRegisterButton', true, '建立中...');
    state = await api('/api/member/register',{method:'POST',body:JSON.stringify({
      display_name: document.getElementById('registerNameInput').value,
      email: document.getElementById('registerEmailInput').value,
      password: document.getElementById('registerPasswordInput').value
    })});
    document.getElementById('registerPasswordInput').value = '';
    showLoginMessage('帳號已建立，正在載入會員中心','ok');
    render();
  }catch(err){ showLoginMessage(err.message,'error'); showToast(err.message,'error'); }
  finally{ setButtonBusy('passwordRegisterButton', false); }
});
async function submitLoginCode(){
  var code = (loginCodeInput.value || '').replace(/\\D/g,'');
  try{
    showLoginMessage('正在驗證 Telegram 登入碼...');
    setButtonBusy('loginCodeButton', true, '驗證中...');
    state = await api('/api/member/login-code',{method:'POST',body:JSON.stringify({code:code})});
    loginCodeInput.value = '';
    showLoginMessage('登入成功，正在載入會員中心','ok');
    render();
  }catch(err){ showLoginMessage(err.message,'error'); showToast(err.message,'error'); }
  finally{ setButtonBusy('loginCodeButton', false); }
}
loginCodeForm.addEventListener('submit', async function(event){
  event.preventDefault();
  await submitLoginCode();
});
loginCodeButton.addEventListener('click', async function(event){
  event.preventDefault();
  await submitLoginCode();
});
async function load(){ try{ state = await api('/api/member/me'); render(); }catch(err){ loginView.classList.remove('hidden'); appView.classList.add('hidden'); showLoginMessage('請登入會員中心，或使用 Telegram /login 取得一次性登入碼。'); } }
function tierTone(tier){ return tier === 'vip' ? 'amber' : tier === 'pro' ? 'green' : ''; }
function memberDisplayName(u){ return u.username ? (String(u.username).indexOf('@') >= 0 ? u.username : '@' + u.username) : (u.first_name || u.user_id); }
function signalTone(sig){ return ''; }
function statusText(sig){
  if(sig.status === 'active') return '進行中';
  if(sig.status === 'closed') return sig.result === 'loss' ? '止損' : sig.result === 'breakeven' ? '保本' : '結案';
  if(sig.status === 'cancelled') return '已取消';
  return sig.status || '-';
}
function statusTone(sig){
  if(sig.status === 'active') return 'green';
  if(sig.status === 'cancelled' || sig.result === 'loss') return 'red';
  if(sig.result === 'win') return 'green';
  if(sig.result === 'breakeven') return 'amber';
  return '';
}
function actionText(sig){ return sig.action === 'LONG' ? '⬆️ 做多' : sig.action === 'SHORT' ? '⬇️ 做空' : (sig.action || '-'); }
function probabilityText(value){
  var n = Number(value);
  if(!isFinite(n) || n <= 0) return '-';
  if(n <= 1) n = n * 100;
  if(n > 100) return '-';
  return (Math.round(n * 100) / 100).toString().replace(/\.0+$/,'') + '%';
}
function tpHitText(sig){
  var count = Math.max(Number(sig.tp_hit_count || 0), sig.tp3_hit_at ? 3 : sig.tp2_hit_at ? 2 : sig.tp1_hit_at ? 1 : 0);
  var labels = [];
  if(count >= 1 && sig.tp1 != null) labels.push('TP1');
  if(count >= 2 && sig.tp2 != null) labels.push('TP2');
  if(count >= 3 && sig.tp3 != null) labels.push('TP3');
  return labels.join(' / ');
}
function signalCardUrl(sig){ return location.origin + '/signal-card/' + encodeURIComponent(sig.signal_uid) + '.svg'; }
function signalTime(sig){
  var start = dateText(sig.created_at);
  var end = sig.closed_at ? dateText(sig.closed_at) : '尚未結束';
  return start + ' → ' + end;
}
function signalPlainText(sig){
  var lines = [
    'DC Trading Signals',
    sig.ticker + ' ' + actionText(sig) + ' · ' + statusText(sig),
    '時間 ' + signalTime(sig),
    '進場 ' + price(sig.entry_price),
    '止損 ' + price(sig.stop_loss),
    'TP1 ' + price(sig.tp1),
    'TP2 ' + price(sig.tp2)
  ];
  if(sig.tp3 != null) lines.push('TP3 ' + price(sig.tp3));
  if(sig.probability != null) lines.push('機率 ' + probabilityText(sig.probability));
  if(tpHitText(sig)) lines.push('已達 ' + tpHitText(sig));
  if(sig.exit_price != null) lines.push('結案價 ' + price(sig.exit_price));
  if(sig.strategy_id) lines.push('策略 ' + sig.strategy_id);
  lines.push('#' + sig.signal_uid);
  return lines.join('\\n');
}
function parseMemberTime(value){
  if(!value) return 0;
  var text = String(value);
  var d = new Date(/(?:Z|[+-]\\d{2}:?\\d{2})$/i.test(text) ? text : text.replace(' ','T')+'Z');
  return d.getTime();
}
function filteredMemberSignals(){
  var list = (state && state.signals) || [];
  var startEl = document.getElementById('signalStart');
  var endEl = document.getElementById('signalEnd');
  var start = startEl && startEl.value ? new Date(startEl.value + 'T00:00:00+08:00').getTime() : null;
  var end = endEl && endEl.value ? new Date(endEl.value + 'T23:59:59+08:00').getTime() : null;
  return list.filter(function(sig){
    if(memberSignalFilter === 'active' && sig.status !== 'active') return false;
    if(memberSignalFilter === 'history' && sig.status === 'active') return false;
    var ts = parseMemberTime(sig.created_at);
    if(start && ts < start) return false;
    if(end && ts > end) return false;
    return true;
  });
}
function renderSignal(sig){
  var targets = [
    ['進場', sig.entry_price],
    ['止損', sig.stop_loss],
    ['TP1', sig.tp1],
    ['TP2', sig.tp2]
  ];
  if(sig.tp3 != null) targets.push(['TP3 VIP', sig.tp3]);
  if(sig.exit_price != null) targets.push(['結案價', sig.exit_price]);
  if(sig.probability != null) targets.push(['機率', sig.probability]);
  var levels = targets.map(function(row){
    var text = row[0] === '機率' ? probabilityText(row[1]) : price(row[1]);
    return '<div><span>'+esc(row[0])+'</span><b>'+esc(text)+'</b></div>';
  }).join('');
  var actions = '<div class="signal-actions">';
  if(sig.chart_url) actions += '<a class="btn mini primary" target="_blank" rel="noopener" href="'+esc(sig.chart_url)+'">開啟 TV</a>';
  actions += '<a class="btn mini ghost" target="_blank" rel="noopener" href="'+esc(signalCardUrl(sig))+'">訊號卡圖</a>';
  if(sig.snapshot_url) actions += '<a class="btn mini ghost" target="_blank" rel="noopener" href="'+esc(sig.snapshot_url)+'">原始截圖</a>';
  actions += '<button class="btn mini ghost" type="button" data-copy-signal="'+esc(sig.signal_uid)+'">複製文字</button>';
  actions += '</div>';
  var result = sig.pnl_points != null ? '<div class="signal-result">'+chip((Number(sig.pnl_points) >= 0 ? '+' : '') + price(sig.pnl_points) + ' 點', Number(sig.pnl_points) >= 0 ? 'green' : 'red')+(sig.exit_reason?'<span>'+esc(sig.exit_reason)+'</span>':'')+'</div>' : '';
  var hit = tpHitText(sig);
  if(!hit && sig.tp_hit_level > 0) hit = sig.tp_hit_level >= 2 ? 'TP2' : 'TP1';
  var partial = hit ? chip('已達 '+hit, 'green') : '';
  var hitHtml = hit ? '<div class="signal-result">'+partial+'</div>' : '';
  return '<article class="signal"><div class="signal-head"><div><strong>'+esc(sig.ticker+' '+actionText(sig))+'</strong><p class="signal-meta">'+esc(signalTime(sig))+'<br>'+esc(sig.signal_type || '-')+(sig.strategy_id?' · '+esc(sig.strategy_id):'')+'</p></div>'+chip(statusText(sig), statusTone(sig) || signalTone(sig))+'</div><div class="levels">'+levels+'</div>'+hitHtml+result+actions+'</article>';
}
function checkbox(name,label,checked){ return '<label class="check"><input type="checkbox" name="'+esc(name)+'" '+(checked?'checked':'')+'> '+esc(label)+'</label>'; }
function renderSettings(){
  var s=state.settings; var symbols=state.symbols||[]; var selected=s.subscribed_symbols||[]; var types=s.signal_types||[];
  document.getElementById('settingsForm').innerHTML =
    '<div class="form-grid"><div><label>交易資金</label><input name="capital" inputmode="decimal" value="'+esc(s.capital)+'"></div><div><label>每筆風險 %</label><input name="risk_percent" inputmode="decimal" value="'+esc(s.risk_percent)+'"></div></div>' +
    '<div><label>訂閱品種</label><div class="chips">'+symbols.map(function(sym){ return checkbox('sym_'+sym.symbol, sym.symbol, selected.includes(sym.symbol)); }).join('')+'</div></div>' +
    '<div><label>訊號類型</label><div class="chips">'+Object.keys(state.signalTypes||{}).map(function(type){ return checkbox('type_'+type, state.signalTypes[type].name, types.includes(type)); }).join('')+'</div></div>' +
    '<div><label>通知</label><div class="chips">'+
      checkbox('notify_entry','進場',s.notify_entry)+checkbox('notify_tp','TP',s.notify_tp)+checkbox('notify_sl','止損',s.notify_sl)+checkbox('notify_update','更新',s.notify_update)+checkbox('notify_alert','警報',s.notify_alert)+checkbox('paused','暫停接收',s.paused)+
    '</div></div>';
}
function renderSecurity(){
  var box = document.getElementById('securityBox');
  var security = state.security || {};
  var password = security.password_account || {};
  var oauth = security.oauth_identities || [];
  var telegram = security.telegram_link || {};
  var botName = state.botUsername ? '@' + state.botUsername : 'Telegram 機器人';
  var telegramBox = telegram.linked
    ? '<div class="security-meta">'+
        '<div>'+chip('Telegram 已綁定','green')+' <b>'+esc(telegram.telegram_user_id || '')+'</b></div>'+
        '<div class="muted">訊號推播、訂單通知與客服回覆會送到此 Telegram。'+(telegram.linked_at ? ' 綁定 '+dateText(telegram.linked_at) : '')+'</div>'+
      '</div>'
    : '<div class="security-meta">'+
        '<div>'+chip('Telegram 未綁定','amber')+' <b>尚未接收推播</b></div>'+
        '<div class="muted">在 '+esc(botName)+' 輸入 /login，將 6 位登入碼填入下方，即可把網站會員與 Telegram 推播綁定。</div>'+
        '<form id="telegramLinkForm" class="auth-form"><label>Telegram 6 位碼</label><input name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="輸入 /login 取得的 6 位碼"><button class="btn primary" type="submit">綁定 Telegram</button></form>'+
      '</div>';
  if(password.enabled){
    box.innerHTML =
      '<div class="security-meta">'+
        '<div>'+chip('網站帳號','green')+' <b>'+esc(password.email || state.user.username || '')+'</b></div>'+
        '<div class="muted">上次登入：'+esc(dateText(password.last_login_at))+'</div>'+
        '<div class="muted">密碼更新：'+esc(dateText(password.updated_at))+'</div>'+
      '</div>'+
      '<form id="changePasswordForm" class="auth-form">'+
        '<label>目前密碼</label><input name="current_password" type="password" autocomplete="current-password" placeholder="輸入目前密碼">'+
        '<label>新密碼</label><input name="new_password" type="password" autocomplete="new-password" placeholder="英文 + 數字，至少 8 碼">'+
        '<button class="btn primary" type="submit">更新密碼</button>'+
      '</form>'+
      telegramBox;
    return;
  }
  box.innerHTML =
    '<div class="security-meta">'+
      '<div>'+chip('外部登入','amber')+' <b>'+esc(oauth.length ? oauth.map(function(item){ return item.provider; }).join(', ') : 'Telegram / OAuth')+'</b></div>'+
      '<div class="muted">建議立即建立備援 Email + 密碼。之後即使 Telegram 換號、暫時收不到訊息，仍可登入會員中心處理訂閱與客服。</div>'+
    '</div>'+
    '<form id="backupPasswordForm" class="auth-form">'+
      '<label>Email</label><input name="email" type="email" autocomplete="email" placeholder="you@example.com">'+
      '<label>顯示名稱</label><input name="display_name" autocomplete="name" value="'+esc(state.user.first_name || '')+'" placeholder="會員名稱">'+
      '<label>登入密碼</label><input name="password" type="password" autocomplete="new-password" placeholder="英文 + 數字，至少 8 碼">'+
      '<button class="btn primary" type="submit">建立備援登入</button>'+
    '</form>'+
    telegramBox;
}
function supportStatusText(status){
  return status === 'open' ? '待回覆' : status === 'pending' ? '已回覆' : status === 'closed' ? '已結案' : (status || '-');
}
function supportTone(status){
  return status === 'open' ? 'amber' : status === 'pending' ? 'green' : status === 'closed' ? '' : '';
}
function supportActorText(reply){
  if(reply.actor_type === 'admin') return '客服';
  if(reply.actor_type === 'system') return '系統';
  return '我';
}
function renderSupport(){
  var list = state.supportTickets || [];
  document.getElementById('supportTickets').innerHTML = list.map(function(ticket){
    var thread = (ticket.replies || []).map(function(reply){
      return '<div class="support-msg '+esc(reply.actor_type || '')+'"><b>'+esc(supportActorText(reply))+' · '+dateText(reply.created_at)+'</b>'+esc(reply.message || '').replace(/\\n/g,'<br>')+'</div>';
    }).join('');
    var followup = ticket.status !== 'closed'
      ? '<details class="support-followup"><summary>補充內容</summary><form data-ticket-followup="'+esc(ticket.ticket_id)+'"><textarea name="message" placeholder="補充目前狀況或付款資訊"></textarea><button class="btn primary" type="submit">送出補充</button></form></details>'
      : '';
    return '<article class="order-card">'+
      '<div>'+chip(supportStatusText(ticket.status), supportTone(ticket.status))+' <b>'+esc(ticket.ticket_id)+'</b></div>'+
      '<div><b>'+esc(ticket.subject || '客服問題')+'</b></div>'+
      '<div class="muted">更新 '+dateText(ticket.updated_at)+' · '+esc(ticket.priority || 'normal')+'</div>'+
      (thread ? '<div class="support-thread">'+thread+'</div>' : (ticket.last_reply ? '<div class="muted">'+esc(ticket.last_reply)+'</div>' : ''))+
      followup+
    '</article>';
  }).join('') || '<div class="muted">尚無客服工單。</div>';
}
function renderPlans(){
  var plans = state.plans || {};
  var pay = state.payment || {};
  var stripeEnabled = !!pay.stripeEnabled;
  var manualEnabled = pay.manualEnabled !== false;
  var cryptoEnabled = !!pay.cryptoEnabled;
  var tiers = ['pro','vip'];
  document.getElementById('plans').innerHTML = tiers.map(function(tier){
    var plan = plans[tier];
    if(!plan) return '';
    var rows = [1,3,12].map(function(months){
      var item = plan.months[String(months)] || plan.months[months];
      if(!item) return '';
      var online = stripeEnabled ? '<button class="btn primary" data-buy-tier="'+esc(tier)+'" data-buy-months="'+esc(months)+'" data-buy-method="stripe">線上付款 '+money(item.amount)+'</button>' : '';
      var manual = manualEnabled ? '<button class="btn ghost" data-buy-tier="'+esc(tier)+'" data-buy-months="'+esc(months)+'" data-buy-method="manual">轉帳訂單</button>' : '';
      var crypto = cryptoEnabled ? '<button class="btn ghost" data-buy-tier="'+esc(tier)+'" data-buy-months="'+esc(months)+'" data-buy-method="crypto">'+esc(pay.cryptoAsset || 'USDT')+' 訂單</button>' : '';
      return '<div class="plan-row"><div><b>'+esc(months)+' 個月</b><div class="muted">'+esc(item.days)+' 天 · '+money(item.amount)+'</div></div><div class="plan-actions">'+online+manual+crypto+'</div></div>';
    }).join('');
    return '<article class="plan '+(tier==='vip'?'vip':'')+'"><div class="plan-head"><div><strong>'+esc(plan.name)+'</strong><p class="muted">'+(tier==='vip'?'含完整 TP3 與 VIP 訊號':'基礎付費訊號與 TP1/TP2')+'</p></div>'+chip(tier.toUpperCase(), tier==='vip'?'amber':'green')+'</div><div class="plan-price">'+rows+'</div></article>';
  }).join('');
  var bankInfo = manualEnabled
    ? '<div><b>銀行轉帳</b></div>' +
      '<div>銀行　'+esc(pay.bank || '-')+(pay.branch ? '　'+esc(pay.branch) : '')+'</div>' +
      '<div>帳號　<code>'+esc(pay.account || '-')+'</code></div>' +
      '<div>戶名　'+esc(pay.name || '-')+'</div>' +
      (pay.transferNote ? '<div class="muted">'+esc(pay.transferNote).replace(/\\n/g,'<br>')+'</div>' : '')
    : '<div>'+chip('銀行轉帳未開放','amber')+'</div>';
  var cryptoInfo = cryptoEnabled
    ? '<div><b>虛擬貨幣收款</b> '+chip(pay.cryptoAsset || 'USDT','green')+'</div>' +
      '<div>鏈別　'+esc(pay.cryptoNetwork || '-')+'</div>' +
      '<div>錢包　<code>'+esc(pay.cryptoWallet || '-')+'</code></div>' +
      (pay.cryptoMemo ? '<div>Memo / Tag　<code>'+esc(pay.cryptoMemo)+'</code></div>' : '') +
      '<div class="muted">'+esc(pay.cryptoRateNote || '')+'</div>' +
      (pay.cryptoNote ? '<div class="muted">'+esc(pay.cryptoNote).replace(/\\n/g,'<br>')+'</div>' : '')
    : '<div>'+chip('虛擬貨幣未開放','amber')+' <span class="muted">後台填入錢包地址後才會出現付款按鈕。</span></div>';
  document.getElementById('paymentBox').innerHTML =
    '<b>付款資訊</b>' +
    '<div>線上付款　' + (pay.stripeEnabled ? '<b>已啟用 ' + esc(pay.stripeCurrency || '') + '</b>' : '<span class="muted">尚未啟用</span>') + '</div>' +
    '<div class="security-meta">'+bankInfo+'</div>' +
    '<div class="security-meta">'+cryptoInfo+'</div>' +
    '<div class="terms-box">'+
      '<b>交易風險與服務條款</b>'+
      '<div>訊號僅供交易參考，不保證獲利；交易可能造成本金損失，請自行控管風險。</div>'+
      '<label class="check"><input id="acceptOrderTerms" type="checkbox"> 我已閱讀並同意 <a href="'+esc(pay.termsUrl || '/terms')+'" target="_blank" rel="noopener">服務條款</a>、<a href="'+esc(pay.riskUrl || '/risk-disclosure')+'" target="_blank" rel="noopener">風險揭露</a>、<a href="'+esc(pay.refundUrl || '/refund')+'" target="_blank" rel="noopener">退款政策</a> 與 <a href="'+esc(pay.privacyUrl || '/privacy')+'" target="_blank" rel="noopener">隱私權政策</a>（版本 '+esc(pay.termsVersion || '-')+'）</label>'+
    '</div>'+
    '<div class="muted">建立訂單後付款，再點「我已付款」通知客服確認。</div>';
}
function orderTone(status){ return status==='confirmed'?'green':status==='rejected'||status==='cancelled'?'red':status==='paid'?'amber':''; }
function orderStatusText(status){
  return status==='pending'?'待付款':status==='paid'?'待確認':status==='confirmed'?'已確認':status==='rejected'?'已拒絕':status==='cancelled'?'已取消':status;
}
function orderEventText(type){
  var map = { created:'建立', stripe_session_created:'Checkout', stripe_session_failed:'Checkout 失敗', paid_notice:'付款通知', stripe_skipped:'Stripe 待付款', confirmed:'已確認', rejected:'已拒絕', cancelled:'已取消', refunded:'已退款' };
  return map[type] || type || '紀錄';
}
function orderTimeline(events){
  events = events || [];
  if(!events.length) return '';
  return '<div class="order-timeline">' + events.slice(0,3).map(function(event){
    return '<div><b>'+esc(orderEventText(event.event_type))+'</b><span>'+esc(dateText(event.created_at))+(event.message?' · '+esc(event.message):'')+'</span></div>';
  }).join('') + '</div>';
}
function paymentNoteHtml(note){
  if(!note) return '';
  return '<div class="muted">'+esc(note).replace(/\\n/g,'<br>')+'</div>';
}
function renderOrder(o){
  var actions = '';
  var method = o.payment_provider || o.payment_method || 'manual';
  var refunded = !!o.refunded_at;
  var terms = o.terms_accepted_at ? '<div class="muted">條款版本 '+esc(o.terms_version || '-')+' · 同意 '+dateText(o.terms_accepted_at)+'</div>' : '';
  var refund = refunded ? '<div class="muted">退款 '+money(o.refund_amount || o.amount)+' · '+dateText(o.refunded_at)+(o.refund_note?' · '+esc(o.refund_note):'')+'</div>' : '';
  var receipt = '<a class="btn ghost" target="_blank" rel="noopener" href="/m/receipt/'+encodeURIComponent(o.order_id)+'">訂單明細</a>';
  if(!refunded && o.status === 'pending' && method === 'stripe') actions =
    '<div class="order-actions">' + (o.payment_url ? '<a class="btn primary" href="'+esc(o.payment_url)+'" target="_blank" rel="noopener">繼續付款</a>' : '') + '<button class="btn" data-order-cancel="'+esc(o.order_id)+'">取消</button>'+receipt+'</div>';
  if(!refunded && o.status === 'pending' && method === 'crypto') actions =
    '<div class="proof-grid">'+
      '<div><label>鏈別</label><input data-proof="crypto_network" placeholder="'+esc((state.payment && state.payment.cryptoNetwork) || 'TRC20')+'"></div>'+
      '<div><label>付款數量</label><input data-proof="crypto_amount" inputmode="decimal" placeholder="'+esc((state.payment && state.payment.cryptoAsset) || 'USDT')+' 數量"></div>'+
      '<div class="full"><label>TxID / Hash</label><input data-proof="crypto_txid" placeholder="貼上交易雜湊"></div>'+
      '<div class="full"><label>備註</label><input data-proof="note" placeholder="付款錢包、交易所或補充資訊"></div>'+
    '</div>'+
    '<div class="order-actions"><button class="btn primary" data-order-paid="'+esc(o.order_id)+'">我已付款</button><button class="btn" data-order-cancel="'+esc(o.order_id)+'">取消</button>'+receipt+'</div>';
  if(!refunded && o.status === 'pending' && method !== 'stripe' && method !== 'crypto') actions =
    '<div class="proof-grid">'+
      '<div><label>付款人</label><input data-proof="payer_name" placeholder="轉帳戶名"></div>'+
      '<div><label>帳號後五碼</label><input data-proof="transfer_last5" inputmode="numeric" placeholder="例如 12345"></div>'+
      '<div><label>付款時間</label><input data-proof="paid_at" placeholder="例如 6/13 18:30"></div>'+
      '<div><label>備註</label><input data-proof="note" placeholder="可填銀行、截圖連結等"></div>'+
    '</div>'+
    '<div class="order-actions"><button class="btn primary" data-order-paid="'+esc(o.order_id)+'">我已付款</button><button class="btn" data-order-cancel="'+esc(o.order_id)+'">取消</button>'+receipt+'</div>';
  if(!refunded && o.status === 'paid') actions = '<div class="order-actions"><button class="btn" data-order-cancel="'+esc(o.order_id)+'">取消</button>'+receipt+'</div>';
  if(!actions) actions = '<div class="order-actions">'+receipt+'</div>';
  return '<article class="order-card">'+
    '<div>'+chip(refunded ? '已退款' : orderStatusText(o.status), refunded ? 'red' : orderTone(o.status))+' <b>'+esc(o.order_id)+'</b></div>'+
    '<div class="muted">'+esc(String(o.tier || '').toUpperCase())+' '+esc(o.months)+' 月 · '+money(o.amount)+' · '+esc(method === 'stripe' ? '線上付款' : method === 'crypto' ? '虛擬貨幣' : '轉帳')+' · '+dateText(o.created_at)+'</div>'+
    terms+
    refund+
    paymentNoteHtml(o.payment_note)+
    orderTimeline(o.events)+
    actions+
  '</article>';
}
function renderSignalsOnly(){
  if(!state) return;
  var list = filteredMemberSignals();
  var total = (state.signals || []).length;
  var query = state.signal_query || state.signalQuery || {};
  document.getElementById('signalCount').textContent = list.length + ' / ' + total + ' 筆' + (query.hasMore ? ' +' : '');
  document.getElementById('signals').innerHTML = list.map(renderSignal).join('') || '<div class="muted">此條件下沒有可查看的訊號。</div>';
}
async function loadMemberSignals(){
  if(!state) return;
  if(!state.user || !state.user.can_receive){
    renderSignalsOnly();
    return;
  }
  var token = ++signalLoadId;
  var params = new URLSearchParams();
  params.set('status', memberSignalFilter);
  params.set('limit', '80');
  var start = document.getElementById('signalStart').value;
  var end = document.getElementById('signalEnd').value;
  if(start) params.set('start', start);
  if(end) params.set('end', end);
  document.getElementById('signals').innerHTML = '<div class="muted">載入訊號中...</div>';
  try{
    var data = await api('/api/member/signals?' + params.toString());
    if(token !== signalLoadId) return;
    state.signals = data.signals || [];
    state.signal_query = data.query || {};
    renderSignalsOnly();
  }catch(err){
    if(token !== signalLoadId) return;
    document.getElementById('signals').innerHTML = '<div class="muted">訊號載入失敗：'+esc(err.message)+'</div>';
  }
}
function render(){
  loginView.classList.add('hidden'); appView.classList.remove('hidden');
  var u=state.user; document.getElementById('memberName').textContent=memberDisplayName(u)+' · '+u.tier_name;
  document.getElementById('heroTitle').textContent = u.can_receive ? '會員訊號工作台' : '會員資格尚未啟用';
  document.getElementById('heroCopy').textContent = u.can_receive ? '可線上查看您訂閱品種的最新訊號與維護通知設定。' : '請先完成訂閱，完成後即可線上查看訊號。';
  document.getElementById('heroChips').innerHTML = chip(u.tier_name,tierTone(u.tier)) + chip(u.tier_expires_at ? '到期 '+dateText(u.tier_expires_at) : '無到期日', u.can_receive?'green':'amber');
  document.getElementById('kpis').innerHTML = [['會員等級',u.tier_name],['剩餘天數',u.tier_expires_at?Math.max(0,Math.ceil((new Date(u.tier_expires_at)-new Date())/86400000))+' 天':'-'],['已訂閱',state.settings.subscribed_symbols.length+' 個品種'],['累計消費',money(u.total_spent)]].map(function(k){return '<div class="kpi"><span>'+esc(k[0])+'</span><strong>'+esc(k[1])+'</strong></div>';}).join('');
  renderSignalsOnly();
  document.getElementById('orders').innerHTML = (state.orders||[]).map(renderOrder).join('') || '<div class="muted">尚無訂單。</div>';
  renderMemberEconomic();
  renderPlans();
  renderMemberEconomic();
  renderSettings();
  renderSecurity();
  renderSupport();
  setMemberSection(memberActiveSection || 'signals');
  showCheckoutReturnToast();
}
function memberEconImpact(impact){ var v=String(impact||'').toLowerCase(); if(v==='high') return chip('高','red'); if(v==='medium') return chip('中','amber'); if(v==='holiday') return chip('休市',''); return chip('低','green'); }
function memberEconTime(event){ var value=event && (event.event_time || event.event_at || event.event_date); try{ return new Date(value).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}); }catch(e){ return value || '待定'; } }
function renderMemberEconomic(){
  var box=document.getElementById('economicEvents'); if(!box) return;
  var events=state.economicEvents||[];
  box.innerHTML = events.map(function(ev){
    var meta=[]; if(ev.forecast) meta.push('預估 '+esc(ev.forecast)); if(ev.previous) meta.push('前值 '+esc(ev.previous)); if(ev.actual) meta.push('公布 '+esc(ev.actual));
    return '<div style="border:1px solid var(--line);border-radius:7px;padding:9px 11px"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><strong style="font-size:13px">'+esc(ev.title)+'</strong>'+memberEconImpact(ev.impact)+'</div><div class="muted" style="font-size:12px;margin-top:3px">'+esc(memberEconTime(ev))+' · '+esc(ev.currency||ev.country||'')+(meta.length?(' · '+meta.join(' · ')):'')+'</div></div>';
  }).join('') || '<div class="muted">近期沒有重要經濟事件。</div>';
}
appView.addEventListener('click', function(event){
  var btn = event.target.closest('[data-member-section]');
  if(!btn) return;
  setMemberSection(btn.dataset.memberSection, true);
});
if(memberSectionSelect){
  memberSectionSelect.addEventListener('change', function(event){
    setMemberSection(event.target.value, true);
  });
}
document.getElementById('saveBtn').addEventListener('click', async function(){
  try{
    var form=document.getElementById('settingsForm');
    var payload={ capital:Number(form.elements.capital.value||0), risk_percent:Number(form.elements.risk_percent.value||0), subscribed_symbols:[], signal_types:[] };
    (state.symbols||[]).forEach(function(sym){ if(form.elements['sym_'+sym.symbol]?.checked) payload.subscribed_symbols.push(sym.symbol); });
    Object.keys(state.signalTypes||{}).forEach(function(type){ if(form.elements['type_'+type]?.checked) payload.signal_types.push(type); });
    ['notify_entry','notify_tp','notify_sl','notify_update','notify_alert','paused'].forEach(function(key){ payload[key]=!!form.elements[key]?.checked; });
    await api('/api/member/settings',{method:'PUT',body:JSON.stringify(payload)});
    memberActiveSection = 'settings';
    showToast('設定已儲存'); await load();
  }catch(err){ showToast(err.message,'error'); }
});
document.getElementById('refreshBtn').addEventListener('click', load);
document.getElementById('logoutBtn').addEventListener('click', async function(){ await api('/api/member/logout',{method:'POST',body:'{}'}).catch(function(){}); location.reload(); });
document.getElementById('securityBox').addEventListener('submit', async function(event){
  var form = event.target.closest('#changePasswordForm');
  var backupForm = event.target.closest('#backupPasswordForm');
  var telegramForm = event.target.closest('#telegramLinkForm');
  if(!form && !backupForm && !telegramForm) return;
  event.preventDefault();
  if(telegramForm){
    try{
      var linked = await api('/api/member/telegram/link',{method:'POST',body:JSON.stringify({code:telegramForm.elements.code.value})});
      if(linked.bootstrap) state = linked.bootstrap;
      showToast('Telegram 已綁定');
      render();
    }catch(err){ showToast(err.message,'error'); }
    return;
  }
  if(backupForm){
    try{
      var setup = await api('/api/member/password/setup',{method:'POST',body:JSON.stringify({
        email: backupForm.elements.email.value,
        display_name: backupForm.elements.display_name.value,
        password: backupForm.elements.password.value
      })});
      if(setup.bootstrap) state = setup.bootstrap;
      backupForm.reset();
      showToast('備援 Email 登入已建立');
      render();
    }catch(err){ showToast(err.message,'error'); }
    return;
  }
  try{
    await api('/api/member/password/change',{method:'POST',body:JSON.stringify({
      current_password: form.elements.current_password.value,
      new_password: form.elements.new_password.value
    })});
    form.reset();
    showToast('密碼已更新');
    await load();
  }catch(err){ showToast(err.message,'error'); }
});
document.getElementById('supportForm').addEventListener('submit', async function(event){
  event.preventDefault();
  try{
    var form = event.target;
    var subject = form.elements.subject.value;
    var message = form.elements.message.value;
    await api('/api/member/support',{method:'POST',body:JSON.stringify({subject:subject,message:message})});
    form.reset();
    showToast('客服工單已送出');
    memberActiveSection = 'support';
    await load();
  }catch(err){ showToast(err.message,'error'); }
});
document.getElementById('supportTickets').addEventListener('submit', async function(event){
  var form = event.target.closest('[data-ticket-followup]');
  if(!form) return;
  event.preventDefault();
  try{
    var message = form.elements.message.value;
    await api('/api/member/support/'+encodeURIComponent(form.dataset.ticketFollowup)+'/reply',{method:'POST',body:JSON.stringify({message:message})});
    form.reset();
    showToast('補充內容已送出');
    memberActiveSection = 'support';
    await load();
  }catch(err){ showToast(err.message,'error'); }
});
document.getElementById('signalTabs').addEventListener('click', function(event){
  var btn = event.target.closest('[data-member-signal-filter]');
  if(!btn) return;
  memberSignalFilter = btn.dataset.memberSignalFilter;
  Array.prototype.slice.call(document.querySelectorAll('[data-member-signal-filter]')).forEach(function(el){ el.classList.toggle('active', el === btn); });
  loadMemberSignals();
});
document.getElementById('signalStart').addEventListener('change', loadMemberSignals);
document.getElementById('signalEnd').addEventListener('change', loadMemberSignals);
document.getElementById('clearSignalDates').addEventListener('click', function(){
  document.getElementById('signalStart').value = '';
  document.getElementById('signalEnd').value = '';
  loadMemberSignals();
});
document.body.addEventListener('click', async function(event){
  try{
    var copySignal = event.target.closest('[data-copy-signal]');
    if(copySignal){
      var sig = (state.signals || []).find(function(item){ return item.signal_uid === copySignal.dataset.copySignal; });
      if(sig && navigator.clipboard){
        await navigator.clipboard.writeText(signalPlainText(sig));
        showToast('訊號文字已複製');
      }else{
        showToast('無法複製此訊號','error');
      }
      return;
    }
    var buy = event.target.closest('[data-buy-tier]');
    if(buy){
      var accepted = !!document.getElementById('acceptOrderTerms')?.checked;
      if(!accepted){
        showToast('請先同意服務條款與交易風險揭露','error');
        return;
      }
      var order = await api('/api/member/orders',{method:'POST',body:JSON.stringify({tier:buy.dataset.buyTier,months:Number(buy.dataset.buyMonths),payment_provider:buy.dataset.buyMethod || 'manual',accept_terms:accepted,risk_acknowledged:accepted,terms_version:(state.payment && state.payment.termsVersion) || ''})});
      if(order.checkoutUrl){
        location.href = order.checkoutUrl;
        return;
      }
      showToast(order.paymentProvider === 'crypto' ? '訂單已建立，請依虛擬貨幣收款資訊付款' : '訂單已建立，請依付款資訊付款');
      memberActiveSection = 'orders';
      await load();
      return;
    }
    var paid = event.target.closest('[data-order-paid]');
    if(paid){
      var card = paid.closest('.order-card');
      var proof = {};
      if(card){
        card.querySelectorAll('[data-proof]').forEach(function(input){ proof[input.dataset.proof] = input.value; });
      }
      await api('/api/member/orders/'+encodeURIComponent(paid.dataset.orderPaid)+'/paid',{method:'POST',body:JSON.stringify(proof)});
      showToast('已通知客服確認付款');
      memberActiveSection = 'orders';
      await load();
      return;
    }
    var cancel = event.target.closest('[data-order-cancel]');
    if(cancel){
      await api('/api/member/orders/'+encodeURIComponent(cancel.dataset.orderCancel)+'/cancel',{method:'POST',body:'{}'});
      showToast('訂單已取消');
      memberActiveSection = 'orders';
      await load();
    }
  }catch(err){ showToast(err.message,'error'); }
});
load();
loadOAuthProviders();
  </script>
</body>
</html>`;
}

function legalSectionsHtml(sections) {
  return sections.map((section, index) => {
    const body = Array.isArray(section.body)
      ? `<ul>${section.body.map((item) => `<li>${escHtml(item)}</li>`).join('')}</ul>`
      : `<p>${escHtml(section.body)}</p>`;
    return `<h2>${index + 1}. ${escHtml(section.title)}</h2>${body}`;
  }).join('');
}

function renderLegalPage(title, subtitle, active, sections) {
  const nav = [
    ['/terms', '服務條款'],
    ['/risk-disclosure', '風險揭露'],
    ['/privacy', '隱私權'],
    ['/refund', '退款政策']
  ].map(([href, label]) => `<a class="${active === href ? 'active' : ''}" href="${href}">${label}</a>`).join('');
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escHtml(title)}</title>
  <style>
    body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f4f7f9;color:#101828;line-height:1.7}
    main{max-width:820px;margin:0 auto;padding:28px 18px 48px}
    article{background:#fff;border:1px solid #d9e3ea;border-radius:10px;padding:22px;box-shadow:0 14px 34px rgba(15,23,42,.08)}
    h1{font-size:28px;line-height:1.15;margin:0 0 8px} h2{font-size:18px;margin:22px 0 8px} p,li{color:#475467} a{color:#087e90;font-weight:800}
    nav{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}nav a{border:1px solid #d9e3ea;border-radius:8px;padding:7px 10px;background:#fff;text-decoration:none;font-size:13px}nav a.active{background:#0f766e;color:#fff;border-color:#0f766e}
    .meta{color:#667085;font-size:13px;margin-bottom:18px}.notice{border:1px solid rgba(183,121,31,.28);background:#fffdf5;border-radius:8px;padding:12px;margin:14px 0}
    .foot{display:flex;gap:12px;flex-wrap:wrap;margin-top:22px}
  </style>
</head>
<body>
  <main>
    <nav>${nav}</nav>
    <article>
      <h1>${escHtml(title)}</h1>
      <div class="meta">版本 ${escHtml(ORDER_TERMS_VERSION)} · DC Trading Signals</div>
      <div class="notice"><b>重要提醒：</b>${escHtml(subtitle)}</div>
      ${legalSectionsHtml(sections)}
      <div class="foot"><a href="${MEMBER_PORTAL_PATH}">返回會員中心</a><a href="/terms">查看服務條款</a><a href="${MEMBER_PORTAL_PATH}#support">聯繫客服</a></div>
    </article>
  </main>
</body>
</html>`;
}

function renderTermsPage() {
  return renderLegalPage('服務條款', '本服務提供交易訊號、策略資訊與會員工具，內容僅供參考，不構成投資建議、保證獲利或代客操作承諾。', '/terms', [
    { title: '服務內容', body: '會員可依訂閱等級查看訊號、歷史紀錄、訂閱品種、通知設定、付款紀錄與客服工單。訊號可能透過網站、Telegram 或其他系統管道提供。' },
    { title: '交易風險', body: ['金融商品交易具有高風險，可能發生虧損，包含本金損失。', '任何訊號、價格、停損、停利或績效紀錄都不保證未來結果。', '會員應自行評估資金、槓桿、口數、風險承受度與交易適合性。'] },
    { title: '會員責任', body: '會員需自行保管帳號密碼，不得轉售、公開散布或與未授權第三方分享訊號內容。若發現異常登入或帳號外流，應立即修改密碼或聯繫客服。' },
    { title: '付款與訂閱', body: '建立訂單前，會員需同意本條款、風險揭露、退款政策與隱私權政策。銀行轉帳與虛擬貨幣訂單需由客服確認入帳；線上付款訂單依第三方支付 webhook 結果自動或人工確認。' },
    { title: '系統限制', body: 'TradingView、Telegram、支付服務、網路連線或雲端平台可能發生延遲或中斷。系統會盡力保存紀錄與狀態，但不保證所有通知即時送達。' }
  ]);
}

function renderRiskDisclosurePage() {
  return renderLegalPage('交易風險揭露', '下單與使用訊號前，請確認您理解交易可能造成虧損，且平台不承諾獲利。', '/risk-disclosure', [
    { title: '非投資建議', body: '本服務提供的訊號、策略、圖表與價格資訊僅供研究與參考，不代表個人化投資建議、保證收益、代客操作或資產管理服務。' },
    { title: '市場與執行風險', body: ['行情快速波動、跳空、滑價、流動性不足或交易所規則可能造成實際成交與訊號點位不同。', '會員應自行確認交易商品、槓桿、保證金、手續費與平台規則。', '停損與停利不保證一定成交於指定價格。'] },
    { title: '資金控管', body: '會員應依自身財務狀況設定單筆風險、最大虧損與可承受槓桿。本系統提供的口數或風險試算僅為工具，不應取代會員自身判斷。' },
    { title: '歷史績效限制', body: '歷史訊號、回測或績效統計不代表未來結果。不同會員的進出場時間、商品合約、交易成本與執行紀律會導致不同結果。' }
  ]);
}

function renderPrivacyPage() {
  return renderLegalPage('隱私權政策', '本頁說明會員中心、Telegram Bot、付款與客服流程會處理哪些資料，以及資料如何被使用與保護。', '/privacy', [
    { title: '蒐集資料', body: ['帳號資料：Email、顯示名稱、Telegram ID、OAuth 識別碼與登入紀錄。', '會員資料：訂閱等級、到期日、訂閱品種、通知設定、客服工單與訊號執行紀錄。', '付款資料：訂單編號、付款狀態、金額、幣別、轉帳備註、虛擬貨幣鏈別/TxID、Stripe session 或 webhook 狀態。平台不保存完整信用卡資料。'] },
    { title: '使用目的', body: '資料會用於會員登入、權限控管、訊號推播、付款確認、客服回覆、退款紀錄、系統安全、營運分析與法令或爭議處理。' },
    { title: '第三方服務', body: '系統可能使用 Cloudflare、Telegram、TradingView、Stripe、Google OAuth 等第三方服務。第三方會依其服務條款與隱私政策處理必要資料。' },
    { title: '保存與刪除', body: '訂單、條款同意、退款與客服紀錄會保留作為售後、稽核與爭議處理依據。會員可聯繫客服申請更正或刪除不再必要的帳號資料；依法或營運必要需保留者除外。' },
    { title: '安全措施', body: '系統以 Cloudflare Worker 與 D1 保存資料，密碼以 PBKDF2 雜湊保存；管理端需授權登入。會員仍應妥善保管 Email、Telegram 與密碼。' }
  ]);
}

function renderRefundPolicyPage() {
  return renderLegalPage('退款政策', '退款規則用於處理重複付款、付款錯誤、服務異常與售後爭議，實際處理會保留訂單事件紀錄。', '/refund', [
    { title: '數位訂閱性質', body: '本服務為數位訊號與會員工具訂閱。訂單確認後，會員權限可能立即開通並可查看付費內容，因此不保證所有已開通訂單皆可無條件退款。' },
    { title: '可申請退款情境', body: ['重複付款或付款金額明顯錯誤。', '付款後尚未開通且會員主動取消。', '平台長時間重大異常，導致會員無法使用已付款服務。', '其他經客服審核合理的特殊情況。'] },
    { title: '不適用或可能部分退款', body: ['會員已大量查看付費訊號或已使用一段期間。', '因個人交易虧損、未依訊號操作、滑價、延遲、券商或交易平台問題而要求退款。', '違反服務條款、轉售或外流訊號內容。'] },
    { title: '處理方式', body: '退款由管理員於後台或 Telegram 管理指令記錄，會留下退款金額、原因、處理人、時間與會員通知。必要時會同步停用或調整會員期限。' },
    { title: '申請管道', body: '會員可在會員中心建立客服工單，或於 Telegram 使用 /support 說明訂單編號、付款方式與退款原因。' }
  ]);
}

function normalizeTvTicker(value) {
  const raw = String(value || '').trim().toUpperCase().split(':').pop().replace(/[^A-Z0-9]/g, '');
  const aliases = [
    ['ETHUSDT', 'ETH'],
    ['ETHUSD', 'ETH'],
    ['ETH', 'ETH'],
    ['USTEC', 'USTEC'],
    ['US100', 'USTEC'],
    ['NAS100', 'USTEC'],
    ['RTY', 'RTY'],
    ['NQ', 'NQ'],
    ['ES', 'ES'],
    ['YM', 'YM'],
    ['GC', 'GC'],
    ['SI', 'SI'],
    ['CL', 'CL'],
    ['NG', 'NG'],
    ['6E', '6E'],
    ['6J', '6J']
  ];
  const match = aliases.find(([prefix]) => raw.startsWith(prefix));
  return match ? match[1] : raw;
}

function firstTvValue(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (!text || text.startsWith('{{')) continue;
    return value;
  }
  return '';
}

function tvOrderId(payload) {
  return String(firstTvValue(payload.order_id, payload.orderId, payload.strategy_order_id, payload.strategyOrderId, payload.strategy?.order?.id, payload.id, payload.comment)).trim();
}

function tvOrderComment(payload) {
  return String(firstTvValue(payload.order_comment, payload.orderComment, payload.strategy_order_comment, payload.strategyOrderComment, payload.strategy?.order?.comment, payload.comment, payload.message)).trim();
}

function tvOrderPrice(payload) {
  return asNumber(firstTvValue(
    payload.order_price, payload.orderPrice,
    payload.strategy_order_price, payload.strategyOrderPrice,
    payload.strategy?.order?.price,
    payload.entry_price, payload.entry, payload.price, payload.close, payload.last
  ));
}

function tvNumberValue(value, fallback = null) {
  const direct = asNumber(value, null);
  if (direct !== null) return direct;
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').trim();
    if (/^-?\d+(?:\.\d+)?$/.test(cleaned)) return asNumber(cleaned, fallback);
    const match = cleaned.match(/(?:^|[:=|@\s])(-?\d+(?:\.\d+)?)(?:\s|$)/);
    if (match) return asNumber(match[1], fallback);
  }
  return fallback;
}

function tvExplicitNumber(...values) {
  return tvNumberValue(firstTvValue(...values), null);
}

function rawPlotProbabilityCandidate(value) {
  const raw = firstTvValue(value);
  if (raw === '') return '';
  const text = String(raw).replace(/,/g, '').trim();
  const match = text.match(/^-?\d+(?:\.\d+)?/);
  if (!match) return '';
  const n = Number(match[0]);
  if (!Number.isFinite(n) || n <= 0 || n === 1 || n > 100) return '';
  return n < 1 ? Number((n * 100).toFixed(2)) : Number(n.toFixed(2));
}

function tvRawPlotProbabilityValues(payload = {}) {
  const values = [];
  const pushCandidate = (value) => {
    const candidate = rawPlotProbabilityCandidate(value);
    if (candidate !== '') values.push(candidate);
  };
  pushCandidate(firstTvValue(
    payload.p9,
    payload.plot_9,
    payload.plots?.[9],
    payload.plots?.['9']
  ));
  for (let i = 0; i <= 17; i++) {
    if (i === 9) continue;
    pushCandidate(firstTvValue(
      payload[`p${i}`],
      payload[`plot_${i}`],
      payload.plots?.[i],
      payload.plots?.[String(i)]
    ));
  }
  return values;
}

function firstProbabilityValue(...values) {
  for (const value of values.flat()) {
    const normalized = normalizeProbabilityValue(value);
    if (normalized !== null) return normalized;
  }
  return null;
}

function tvProbabilityValues(payload, action = '') {
  const side = tvActionSide(action);
  const directional = side === 'long'
    ? [
        payload.long_probability, payload.longProbability,
        payload.long_prob, payload.longProb,
        payload.long_confidence, payload.longConfidence,
        payload.buy_probability, payload.buyProbability,
        payload.buy_prob, payload.buyProb,
        payload.bull_probability, payload.bullProbability,
        payload.probability_long, payload.probabilityLong,
        payload.confidence_long, payload.confidenceLong,
        payload.levels?.long_probability, payload.levels?.longProbability,
        payload.levels?.buy_probability, payload.levels?.buyProbability
      ]
    : side === 'short'
      ? [
          payload.short_probability, payload.shortProbability,
          payload.short_prob, payload.shortProb,
          payload.short_confidence, payload.shortConfidence,
          payload.sell_probability, payload.sellProbability,
          payload.sell_prob, payload.sellProb,
          payload.bear_probability, payload.bearProbability,
          payload.probability_short, payload.probabilityShort,
          payload.confidence_short, payload.confidenceShort,
          payload.levels?.short_probability, payload.levels?.shortProbability,
          payload.levels?.sell_probability, payload.levels?.sellProbability
        ]
      : [];
  return [
    ...directional,
    payload.probability, payload.prob,
    payload.confidence, payload.confidence_score, payload.confidenceScore,
    payload.score, payload.win_rate, payload.winRate,
    payload.success_rate, payload.successRate,
    payload.signal_probability, payload.signalProbability,
    payload.algo_probability, payload.algoProbability,
    payload.levels?.probability, payload.levels?.prob,
    payload.levels?.confidence, payload.levels?.win_rate, payload.levels?.winRate,
    payload.stats?.probability, payload.stats?.confidence,
    tvRawPlotProbabilityValues(payload),
    payload['機率'], payload['勝率'], payload['信心']
  ];
}

function tvProbability(payload, action = '') {
  return firstProbabilityValue(...tvProbabilityValues(payload, action));
}

function hasTvPlaceholder(value) {
  if (value == null) return false;
  if (Array.isArray(value)) return value.some(hasTvPlaceholder);
  if (typeof value === 'object') return Object.values(value).some(hasTvPlaceholder);
  return /\{\{\s*(?:plot|strategy\.order|close|time|ticker|exchange)/i.test(String(value));
}

function tvActionSide(action) {
  const value = String(action || '').trim().toUpperCase();
  if (value === 'LONG' || value === 'BUY') return 'long';
  if (value === 'SHORT' || value === 'SELL') return 'short';
  return '';
}

function tvEntryPrice(payload) {
  return tvExplicitNumber(
    payload.entry_price, payload.entryPrice,
    payload.entry, payload.entry_level, payload.entryLevel,
    payload.signal_price, payload.signalPrice,
    payload.order_price, payload.orderPrice,
    payload.strategy_order_price, payload.strategyOrderPrice,
    payload.strategy?.order?.price,
    payload.price, payload.close, payload.last
  );
}

function tvLevelTextSources(payload = {}) {
  return [
    payload.alert_message, payload.alertMessage,
    payload.message, payload.text, payload.note,
    payload.comment, payload.order_comment, payload.orderComment,
    payload.strategy_order_comment, payload.strategyOrderComment,
    payload.level_text, payload.levelText,
    payload.levels_text, payload.levelsText,
    payload.raw, payload.description
  ].filter((value) => value !== null && value !== undefined && !String(value).startsWith('{{'));
}

function tvTextNumberAfter(text, labels) {
  const body = String(text || '').replace(/,/g, '');
  for (const label of labels) {
    const escaped = String(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`${escaped}[^\\d\\-]{0,28}(-?\\d+(?:\\.\\d+)?)`, 'iu');
    const match = body.match(pattern);
    if (match) {
      const value = asNumber(match[1], null);
      if (value !== null) return value;
    }
  }
  return null;
}

function parseTvLevelsFromText(payload = {}) {
  const text = tvLevelTextSources(payload).join('\n');
  if (!text.trim()) return {};
  return {
    entry_price: tvTextNumberAfter(text, ['entry_price', 'entry price', 'entry', '進場價', '進場', '入場價', '入場']),
    stop_loss: tvTextNumberAfter(text, ['stop_loss', 'stop loss', 'stoploss', 'stop', 'sl', 'SL', '止損', '停損']),
    tp1: tvTextNumberAfter(text, ['take_profit_1', 'take profit 1', 'takeprofit1', 'target1', 'target 1', 'tp1', 'TP1', 'TP 1', '目標1', '止盈1', '止贏1']),
    tp2: tvTextNumberAfter(text, ['take_profit_2', 'take profit 2', 'takeprofit2', 'target2', 'target 2', 'tp2', 'TP2', 'TP 2', '目標2', '止盈2', '止贏2']),
    tp3: tvTextNumberAfter(text, ['take_profit_3', 'take profit 3', 'takeprofit3', 'target3', 'target 3', 'tp3', 'TP3', 'TP 3', '目標3', '止盈3', '止贏3']),
    probability: normalizeProbabilityValue(tvTextNumberAfter(text, ['probability', 'prob', 'confidence', 'confidence score', 'win rate', 'success rate', 'score', '機率', '勝率', '信心']))
  };
}

function tvPreferTextLevel(rawValue, textValue) {
  if (rawValue === null || rawValue === 0) return textValue !== null && textValue !== undefined ? textValue : rawValue;
  return rawValue;
}

function tvStopLossValues(payload, action = '') {
  const side = tvActionSide(action);
  const directional = side === 'long'
    ? [
        payload.long_stop_loss, payload.longStopLoss,
        payload.long_stop, payload.longStop,
        payload.long_sl, payload.longSL,
        payload.buy_stop_loss, payload.buyStopLoss,
        payload.buy_stop, payload.buyStop,
        payload.buy_sl, payload.buySL,
        payload.stop_loss_long, payload.stopLossLong,
        payload.stop_long, payload.stopLong,
        payload.sl_long, payload.slLong,
        payload.levels?.long_stop_loss, payload.levels?.longStopLoss,
        payload.levels?.long_stop, payload.levels?.longStop,
        payload.levels?.long_sl, payload.levels?.longSL,
        payload.levels?.buy_stop_loss, payload.levels?.buyStopLoss,
        payload.risk?.long_stop_loss, payload.risk?.longStopLoss,
        payload.risk?.long_sl, payload.risk?.longSL,
        payload.p5, payload.plot_5,
        payload.plots?.[5], payload.plots?.['5']
      ]
    : side === 'short'
      ? [
          payload.short_stop_loss, payload.shortStopLoss,
          payload.short_stop, payload.shortStop,
          payload.short_sl, payload.shortSL,
          payload.sell_stop_loss, payload.sellStopLoss,
          payload.sell_stop, payload.sellStop,
          payload.sell_sl, payload.sellSL,
          payload.stop_loss_short, payload.stopLossShort,
          payload.stop_short, payload.stopShort,
          payload.sl_short, payload.slShort,
          payload.levels?.short_stop_loss, payload.levels?.shortStopLoss,
          payload.levels?.short_stop, payload.levels?.shortStop,
          payload.levels?.short_sl, payload.levels?.shortSL,
          payload.levels?.sell_stop_loss, payload.levels?.sellStopLoss,
          payload.risk?.short_stop_loss, payload.risk?.shortStopLoss,
          payload.risk?.short_sl, payload.risk?.shortSL,
          payload.p6, payload.plot_6,
          payload.plots?.[6], payload.plots?.['6']
        ]
      : [];
  return [
    ...directional,
    payload.stop_loss, payload.stopLoss,
    payload.stop, payload.sl,
    payload.sl_price, payload.slPrice,
    payload.stop_price, payload.stopPrice,
    payload.stop_level, payload.stopLevel,
    payload.stoploss, payload.stopLossPrice,
    payload.levels?.stop_loss, payload.levels?.stopLoss,
    payload.levels?.stop, payload.levels?.sl,
    payload.risk?.stop_loss, payload.risk?.stopLoss, payload.risk?.sl,
    payload['止損'], payload['停損'], payload['SL']
  ];
}

function tvStopLoss(payload, action = '') {
  return tvExplicitNumber(
    ...tvStopLossValues(payload, action)
  );
}

function tvDirectionalTargetValues(payload, index, action = '') {
  const side = tvActionSide(action);
  const i = Number(index || 1);
  if (side === 'long') {
    return [
      payload[`long_tp${i}`], payload[`longTp${i}`],
      payload[`long_target${i}`], payload[`longTarget${i}`],
      payload[`long_take_profit_${i}`], payload[`longTakeProfit${i}`],
      payload[`buy_tp${i}`], payload[`buyTp${i}`],
      payload[`buy_target${i}`], payload[`buyTarget${i}`],
      payload[`tp${i}_long`], payload[`tp${i}Long`],
      payload[`target${i}_long`], payload[`target${i}Long`],
      payload.levels?.[`long_tp${i}`], payload.levels?.[`longTp${i}`],
      payload.levels?.[`long_target${i}`], payload.levels?.[`longTarget${i}`],
      payload.levels?.[`buy_tp${i}`], payload.levels?.[`buyTp${i}`],
      i === 1 ? payload.p7 : undefined,
      i === 1 ? payload.plot_7 : undefined,
      i === 1 ? payload.plots?.[7] : undefined,
      i === 1 ? payload.plots?.['7'] : undefined
    ];
  }
  if (side === 'short') {
    return [
      payload[`short_tp${i}`], payload[`shortTp${i}`],
      payload[`short_target${i}`], payload[`shortTarget${i}`],
      payload[`short_take_profit_${i}`], payload[`shortTakeProfit${i}`],
      payload[`sell_tp${i}`], payload[`sellTp${i}`],
      payload[`sell_target${i}`], payload[`sellTarget${i}`],
      payload[`tp${i}_short`], payload[`tp${i}Short`],
      payload[`target${i}_short`], payload[`target${i}Short`],
      payload.levels?.[`short_tp${i}`], payload.levels?.[`shortTp${i}`],
      payload.levels?.[`short_target${i}`], payload.levels?.[`shortTarget${i}`],
      payload.levels?.[`sell_tp${i}`], payload.levels?.[`sellTp${i}`],
      i === 1 ? payload.p8 : undefined,
      i === 1 ? payload.plot_8 : undefined,
      i === 1 ? payload.plots?.[8] : undefined,
      i === 1 ? payload.plots?.['8'] : undefined
    ];
  }
  return [];
}

function tvTargetValues(payload, index, action = '') {
  const i = Number(index || 1);
  const offset = i - 1;
  const direct = i === 1
    ? [
        payload.tp1, payload.tp_1,
        payload.target1, payload.target_1,
        payload.take_profit_1, payload.takeProfit1,
        payload.take_profit, payload.takeProfit,
        payload.target_price_1, payload.targetPrice1,
        payload.tp1_price, payload.tp1Price,
        payload.targets?.[0], payload.tps?.[0], payload.take_profits?.[0],
        payload.levels?.tp1, payload.levels?.target1, payload.levels?.take_profit_1,
        payload['TP1'], payload['TP 1'], payload['目標1'], payload['止盈1'], payload['止贏1']
      ]
    : i === 2
      ? [
          payload.tp2, payload.tp_2,
          payload.target2, payload.target_2,
          payload.take_profit_2, payload.takeProfit2,
          payload.target_price_2, payload.targetPrice2,
          payload.tp2_price, payload.tp2Price,
          payload.targets?.[1], payload.tps?.[1], payload.take_profits?.[1],
          payload.levels?.tp2, payload.levels?.target2, payload.levels?.take_profit_2,
          payload['TP2'], payload['TP 2'], payload['目標2'], payload['止盈2'], payload['止贏2']
        ]
      : [
          payload.tp3, payload.tp_3,
          payload.target3, payload.target_3,
          payload.take_profit_3, payload.takeProfit3,
          payload.target_price_3, payload.targetPrice3,
          payload.tp3_price, payload.tp3Price,
          payload.targets?.[2], payload.tps?.[2], payload.take_profits?.[2],
          payload.levels?.tp3, payload.levels?.target3, payload.levels?.take_profit_3,
          payload['TP3'], payload['TP 3'], payload['目標3'], payload['止盈3'], payload['止贏3']
        ];
  return [
    ...tvDirectionalTargetValues(payload, i, action),
    ...direct,
    payload.targets?.[offset],
    payload.tps?.[offset],
    payload.take_profits?.[offset]
  ];
}

function tvTargetPrice(payload, index, action = '') {
  return tvExplicitNumber(
    ...tvTargetValues(payload, index, action)
  );
}

function tvZeroLevelError(fields) {
  const labels = [...new Set((fields || []).filter(Boolean))];
  return `TradingView alert 的 ${labels.join('/')} 為 0，代表 Alert Message 的 plot 沒取到指標實際點位。請到 TradingView Data Window 確認 SL/TP 對應的 plot 名稱或 plot_序號後重新貼 Message。`;
}

function signalZeroLevelError(context, fields) {
  const labels = [...new Set((fields || []).filter(Boolean))];
  return `${context || '訊號'} 的 ${labels.join('/')} 不可為 0。為避免 TG 點位與圖上指標脫鉤，請先確認 TradingView 或手動輸入的進場、止損與 TP。`;
}

function assertNoZeroSignalLevels(context, levels = {}) {
  const zeroFields = [];
  [
    ['entry_price', levels.entry],
    ['stop_loss', levels.stopLoss],
    ['tp1', levels.tp1],
    ['tp2', levels.tp2],
    ['tp3', levels.tp3]
  ].forEach(([field, value]) => {
    if (value !== null && value !== undefined && Number(value) === 0) zeroFields.push(field);
  });
  if (zeroFields.length) throw new Error(signalZeroLevelError(context, zeroFields));
}

function tvExitPrice(payload, type = '', action = '') {
  const exitType = String(type || '').toUpperCase();
  const targetIndex = exitType === 'TP3' ? 3 : exitType === 'TP2' ? 2 : exitType === 'TP1' ? 1 : 0;
  const target = targetIndex ? tvTargetPrice(payload, targetIndex, action) : null;
  if (target !== null) return target;
  return tvExplicitNumber(
    payload.exit_price, payload.exitPrice,
    payload.fill_price, payload.fillPrice,
    payload.trigger_price, payload.triggerPrice,
    payload.order_price, payload.orderPrice,
    payload.strategy_order_price, payload.strategyOrderPrice,
    payload.strategy?.order?.price,
    payload.price, payload.close, payload.last,
    payload.entry_price, payload.entry
  );
}

function cleanUrl(value) {
  const explicit = String(firstTvValue(value)).trim();
  return /^https?:\/\//i.test(explicit) ? explicit : '';
}

function tvSnapshotUrl(payload) {
  return cleanUrl(firstTvValue(
    payload.snapshot_url, payload.snapshotUrl,
    payload.screenshot_url, payload.screenshotUrl,
    payload.image_url, payload.imageUrl
  ));
}

function tvChartUrl(payload, ticker) {
  const explicit = cleanUrl(firstTvValue(payload.chart_url, payload.chartUrl, payload.chart, payload.url));
  if (explicit) return explicit;
  const exchange = String(firstTvValue(payload.exchange, payload.tv_exchange, payload.tvExchange)).trim();
  const tvTicker = String(firstTvValue(payload.ticker, payload.symbol, ticker)).trim();
  const symbol = exchange && tvTicker && !tvTicker.includes(':') ? `${exchange}:${tvTicker}` : tvTicker;
  return symbol ? `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}` : '';
}

const TRADINGVIEW_WEBHOOK_IPS = new Set([
  '52.89.214.238',
  '34.212.75.30',
  '54.218.53.128',
  '52.32.178.7'
]);

function getRequestClientIps(request) {
  return [String(request.headers.get('cf-connecting-ip') || '').trim()].filter(Boolean);
}

function isTrustedTradingViewWebhook(request) {
  return getRequestClientIps(request).some((ip) => TRADINGVIEW_WEBHOOK_IPS.has(ip));
}

function inferTvEventKind(payload) {
  const text = [payload.event, payload.event_type, payload.type, tvOrderId(payload), tvOrderComment(payload), payload.market_position, payload.marketPosition]
    .map((value) => String(value || '').toLowerCase())
    .join(' ');
  const market = String(firstTvValue(payload.market_position, payload.marketPosition)).toLowerCase();
  const previous = String(firstTvValue(payload.prev_market_position, payload.prevMarketPosition, payload.previous_position, payload.previousPosition)).toLowerCase();
  if (market === 'flat' && ['long', 'short'].includes(previous)) return 'exit';
  if (/\b(exit|close|flat|tp|take profit|takeprofit|sl|stop|stop loss|stoploss)\b/.test(text)) return 'exit';
  return 'entry';
}

function inferTvExitType(payload) {
  const text = [payload.exit_type, payload.exitType, payload.event, payload.type, tvOrderId(payload), tvOrderComment(payload)]
    .map((value) => String(value || '').toLowerCase())
    .join(' ');
  if (/\btp3\b|take profit 3|takeprofit3/.test(text)) return 'TP3';
  if (/\btp2\b|take profit 2|takeprofit2/.test(text)) return 'TP2';
  if (/\btp1\b|\btp\b|take profit|takeprofit/.test(text)) return 'TP1';
  if (/\bsl\b|stop loss|stoploss|stop/.test(text)) return 'SL';
  return 'CLOSE';
}

function normalizeTvAction(payload) {
  const market = String(firstTvValue(payload.market_position, payload.marketPosition)).trim().toLowerCase();
  if (market === 'long') return 'LONG';
  if (market === 'short') return 'SHORT';
  const raw = String(firstTvValue(
    payload.action, payload.side, payload.direction, payload.signal,
    payload.order_action, payload.orderAction,
    payload.strategy_order_action, payload.strategyOrderAction,
    payload.strategy?.order?.action
  )).trim().toLowerCase();
  if (['long', 'buy', 'bull', 'up', '1'].includes(raw) || raw.includes('long') || raw.includes('buy')) return 'LONG';
  if (['short', 'sell', 'bear', 'down', '-1'].includes(raw) || raw.includes('short') || raw.includes('sell')) return 'SHORT';
  return null;
}

function inferTvSignalType(payload, source = null) {
  const direct = String(payload.signal_type || payload.signalType || payload.type || '').toLowerCase();
  if (CONFIG.SIGNAL_TYPES[direct]) return direct;
  if (source?.default_signal_type && CONFIG.SIGNAL_TYPES[source.default_signal_type]) return source.default_signal_type;
  const interval = String(payload.interval || payload.timeframe || payload.tf || '').toUpperCase();
  if (['D', '1D', 'W', '1W'].includes(interval)) return 'swing';
  const minutes = Number(interval.replace(/[^0-9.]/g, ''));
  if (Number.isFinite(minutes) && minutes >= 240) return 'swing';
  if (Number.isFinite(minutes) && minutes >= 30) return 'daytrade';
  return 'scalp';
}

function parseList(value) {
  if (Array.isArray(value)) return value.map(String).map((v) => v.trim()).filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String).map((v) => v.trim()).filter(Boolean);
  } catch {}
  return String(value).split(',').map((v) => v.trim()).filter(Boolean);
}

function parseObject(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function roundToTick(value, tickSize = 0.25) {
  const tick = Number(tickSize) || 0.25;
  const decimals = String(tick).split('.')[1]?.length || 0;
  return Number((Math.round(Number(value) / tick) * tick).toFixed(Math.min(decimals + 2, 8)));
}

async function getTradingViewSource(db, sourceId) {
  await ensureAdminSchema(db);
  return db.prepare('SELECT * FROM tradingview_sources WHERE source_id = ?').bind(sourceId).first();
}

async function selectTvStrategy(db, source, payload, ticker, signalType) {
  await ensureAdminSchema(db);
  const requested = String(payload.strategy || payload.strategy_id || payload.strategyId || '').trim();
  if (requested && requested.toLowerCase() !== 'auto') {
    const exact = await db.prepare('SELECT * FROM strategies WHERE strategy_id = ? AND is_active = 1').bind(slugify(requested, 'strategy')).first();
    if (exact) return exact;
  }

  const rows = await db.prepare('SELECT * FROM strategies WHERE is_active = 1 ORDER BY sort_order, strategy_id').all();
  const strategies = rows.results || [];
  if (!strategies.length) throw new Error('尚未建立策略');

  const scored = strategies.map((strategy) => {
    const symbols = parseList(strategy.symbols).map((s) => s.toUpperCase());
    const types = parseList(strategy.signal_types);
    let score = 0;
    if (!symbols.length || symbols.includes(ticker)) score += 50;
    if (!types.length || types.includes(signalType)) score += 30;
    if (source?.default_strategy_id === strategy.strategy_id) score += 20;
    if (strategy.tier === source?.target_group) score += 5;
    score -= Number(strategy.sort_order || 0) / 100;
    return { strategy, score };
  }).sort((a, b) => b.score - a.score);

  return scored[0].strategy;
}

// 依品種推算模式計算止損 / 止盈點位；目前只供後台補位預覽與人工備援，正式 TV webhook 仍要求指標回傳實際 SL/TP。
function deriveSignalLevels({ entry, action, tickSize, explicitStop, explicitTargets, symbol, rules }) {
  const tick = Number(tickSize) || 0.25;
  const signed = action === 'LONG' ? 1 : -1;
  const symbolStop = Number(symbol?.default_stop_points);
  const symbolTp = Number(symbol?.default_tp_spacing);
  const hasSymbolStop = Number.isFinite(symbolStop) && symbolStop > 0;
  const hasSymbolTp = Number.isFinite(symbolTp) && symbolTp > 0;
  const mode = ['auto', 'fixed', 'rmultiple'].includes(String(symbol?.default_level_mode || 'auto').toLowerCase())
    ? String(symbol?.default_level_mode || 'auto').toLowerCase()
    : 'auto';
  const targetR = Array.isArray(rules?.targetR) ? rules.targetR : Array.isArray(rules?.target_r) ? rules.target_r : [1, 2, 3];
  const ruleRisk = Number(rules?.riskPoints ?? rules?.risk_points);
  const cleanStop = explicitStop !== null && explicitStop !== undefined && Number(explicitStop) !== 0 ? Number(explicitStop) : null;
  const cleanTargets = (explicitTargets || []).slice(0, 3).map((target) => (
    target !== null && target !== undefined && Number(target) !== 0 ? Number(target) : null
  ));
  while (cleanTargets.length < 3) cleanTargets.push(null);

  // 風險點數：指標止損 > 品種固定止損 > 策略 riskPoints > tick × 120（保底，永不為 0）
  let riskPoints;
  if (cleanStop !== null) riskPoints = Math.abs(entry - cleanStop);
  else if (hasSymbolStop) riskPoints = symbolStop;
  else if (Number.isFinite(ruleRisk) && ruleRisk > 0) riskPoints = ruleRisk;
  else riskPoints = tick * 120;
  if (!Number.isFinite(riskPoints) || riskPoints <= 0) riskPoints = tick * 120;

  const stopLoss = cleanStop !== null ? cleanStop : roundToTick(entry - signed * riskPoints, tick);

  let fallbackTargets;
  let fallbackBasis;
  // fixed：強制固定間隔（沒設則退回 R 倍數）；rmultiple：強制 R 倍數；auto：有固定間隔用固定，否則 R 倍數
  const useFixed = mode === 'rmultiple' ? false : hasSymbolTp;
  if (useFixed) {
    fallbackTargets = [1, 2, 3].map((step) => roundToTick(entry + signed * symbolTp * step, tick));
    fallbackBasis = 'fixed';
  } else {
    fallbackTargets = targetR.slice(0, 3).map((r) => roundToTick(entry + signed * riskPoints * Number(r || 1), tick));
    while (fallbackTargets.length < 3) fallbackTargets.push(roundToTick(entry + signed * riskPoints * (fallbackTargets.length + 1), tick));
    fallbackBasis = 'rmultiple';
  }

  const targets = cleanTargets.map((target, index) => target !== null ? target : fallbackTargets[index]);
  const usedIndicator = cleanStop !== null || cleanTargets.some((target) => target !== null);
  const usedFallback = cleanStop === null || cleanTargets.some((target) => target === null);
  const basis = usedIndicator && usedFallback ? `mixed:${fallbackBasis}` : usedIndicator ? 'indicator' : fallbackBasis;
  const fallbackFields = [
    cleanStop === null ? 'stop_loss' : '',
    ...cleanTargets.map((target, index) => target === null ? `tp${index + 1}` : '')
  ].filter(Boolean);
  return { stopLoss, targets, riskPoints, mode, basis, fallbackBasis, fallbackFields };
}

async function buildTvSignalDraft(db, source, payload) {
  const ticker = normalizeTvTicker(firstTvValue(payload.ticker, payload.symbol, payload.syminfo, payload.source));
  const action = normalizeTvAction(payload);
  const textLevels = parseTvLevelsFromText(payload);
  const entryRaw = tvPreferTextLevel(tvEntryPrice(payload), textLevels.entry_price);
  if (!ticker) throw new Error('TradingView alert 缺少 ticker');
  if (!action) throw new Error('TradingView alert 缺少 action，請傳 LONG/SHORT 或 buy/sell');
  if (entryRaw === null) throw new Error('TradingView alert 缺少 entry_price / strategy.order.price / price / close');

  const allowed = parseList(source.allowed_symbols).map((s) => s.toUpperCase());
  if (allowed.length && !allowed.includes(ticker)) throw new Error(`${ticker} 不在此來源允許品種內`);

  const symbol = await db.prepare('SELECT * FROM symbols WHERE symbol = ?').bind(ticker).first();
  const signalType = inferTvSignalType(payload, source);
  const strategy = await selectTvStrategy(db, source, payload, ticker, signalType);
  const rules = parseObject(strategy.rules_json, { riskPoints: 30, targetR: [1, 2, 3], entryMode: 'close' });
  const entry = entryRaw;
  const rawStop = tvPreferTextLevel(tvStopLoss(payload, action), textLevels.stop_loss);
  const rawTargets = [
    tvPreferTextLevel(tvTargetPrice(payload, 1, action), textLevels.tp1),
    tvPreferTextLevel(tvTargetPrice(payload, 2, action), textLevels.tp2),
    tvPreferTextLevel(tvTargetPrice(payload, 3, action), textLevels.tp3)
  ];
  const probability = normalizeProbabilityValue(tvPreferTextLevel(tvProbability(payload, action), textLevels.probability));
  const explicitStop = rawStop !== null && rawStop !== 0 ? rawStop : null;
  const explicitTargets = rawTargets.map((target) => target !== null && target !== 0 ? target : null);
  const derived = deriveSignalLevels({
    entry,
    action,
    tickSize: symbol?.tick_size,
    explicitStop,
    explicitTargets,
    symbol,
    rules
  });
  const stopLoss = derived.stopLoss;
  const targets = derived.targets;
  assertNoZeroSignalLevels('TradingView alert', { entry, stopLoss, tp1: targets[0], tp2: targets[1], tp3: targets[2] });
  if (action === 'LONG' && stopLoss >= entry) throw new Error('TradingView 做多訊號的止損必須低於進場，請檢查指標輸出的 stop_loss。');
  if (action === 'SHORT' && stopLoss <= entry) throw new Error('TradingView 做空訊號的止損必須高於進場，請檢查指標輸出的 stop_loss。');
  const presentTargets = targets.filter((target) => target !== null);
  if (action === 'LONG' && presentTargets.some((target) => target <= entry)) throw new Error('TradingView 做多訊號的 TP 必須高於進場，請檢查指標輸出的 TP。');
  if (action === 'SHORT' && presentTargets.some((target) => target >= entry)) throw new Error('TradingView 做空訊號的 TP 必須低於進場，請檢查指標輸出的 TP。');
  const targetGroup = source.target_group || (strategy.tier === 'vip' ? 'vip' : 'pro');
  const chartUrl = tvChartUrl(payload, ticker);
  const snapshotUrl = tvSnapshotUrl(payload);
  const orderId = tvOrderId(payload);
  const orderComment = tvOrderComment(payload);
  const noteParts = [
    `TradingView: ${source.name}`,
    `策略: ${strategy.name}`,
    orderId ? `Order: ${orderId}` : '',
    orderComment ? `Comment: ${orderComment}` : '',
    payload.interval ? `週期: ${payload.interval}` : '',
    payload.time ? `時間: ${payload.time}` : '',
    probability !== null ? `機率: ${fmtProbability(probability)}` : '',
    `點位來源: ${derived.basis}`,
    derived.fallbackFields?.length ? `後台補位: ${derived.fallbackFields.join(',')}` : '',
    derived.fallbackFields?.length ? `TV原始: ${tvAlertLevelDebug(payload, action)}` : '',
    chartUrl ? `圖表: ${chartUrl}` : '',
    snapshotUrl ? `截圖: ${snapshotUrl}` : ''
  ].filter(Boolean);

  return {
    signal_uid: genUID(),
    ticker,
    action,
    signal_type: signalType,
    entry_price: entry,
    stop_loss: stopLoss,
    tp1: targets[0] !== null ? targets[0] : null,
    tp2: targets[1] !== null ? targets[1] : null,
    tp3: targets[2] !== null ? targets[2] : null,
    probability,
    note: noteParts.join(' / '),
    chart_url: chartUrl,
    snapshot_url: snapshotUrl,
    target_group: targetGroup,
    is_vip_only: targetGroup === 'vip' ? 1 : 0,
    strategy_id: strategy.strategy_id,
    source: source.source_id,
    strategy,
    rules
  };
}

async function createSignalFromTvDraft(db, draft, alertUid, autoSend, env = {}, options = {}) {
  const paused = await getConfig(db, 'signals_paused');
  const shouldSend = Boolean(autoSend) && paused !== '1';
  const deferDelivery = Boolean(options.deferDelivery && shouldSend);
  const autoClosed = shouldSend ? await closeActiveSignalsForReplacement(db, draft, `tv:${draft.source}`, env, !deferDelivery) : [];
  await db.prepare(`
    INSERT INTO signals (
      signal_uid, ticker, action, signal_type, entry_price, stop_loss,
      tp1, tp2, tp3, probability, note, chart_url, snapshot_url, target_group, is_vip_only, status,
      source, strategy_id, tv_alert_uid, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    draft.signal_uid, draft.ticker, draft.action, draft.signal_type, draft.entry_price, draft.stop_loss,
    draft.tp1, draft.tp2, draft.tp3, draft.probability, draft.note, draft.chart_url || null, draft.snapshot_url || null, draft.target_group, draft.is_vip_only,
    shouldSend ? 'active' : 'pending', draft.source, draft.strategy_id, alertUid
  ).run();

  let delivery = { sent: 0, queued: 0, skipped: 0, total: 0 };
  let autoTrade = { status: AUTO_TRADE_STATUS.skipped, reason: 'not_sent' };
  if (shouldSend) {
    if (deferDelivery) {
      delivery = { deferred: true, sent: 0, queued: 0, skipped: 0, total: 0 };
      autoTrade = { status: AUTO_TRADE_STATUS.queued, deferred: true };
    } else {
      delivery = await broadcastSignal(db, draft, env);
      await db.prepare('UPDATE signals SET sent_count = ? WHERE signal_uid = ?').bind(delivery.sent, draft.signal_uid).run();
      autoTrade = await dispatchAutoTradeForSignal(env, draft, { autoClosed });
    }
  }
  return { signalUid: draft.signal_uid, status: shouldSend ? 'active' : 'pending', delivery, paused: paused === '1', autoClosed, autoTrade, deferred: deferDelivery };
}

async function notifyAutoClosedSignals(env = {}, autoClosed = [], actorId = 'tv:background') {
  const db = env.DB;
  if (!db || !Array.isArray(autoClosed) || !autoClosed.length) return { sent: 0, failed: 0 };
  let sent = 0;
  let failed = 0;
  for (const closed of autoClosed) {
    try {
      const note = closed.tpHitsText ? `${closed.reason || '新訊號自動結束上一筆'}\n已達 ${closed.tpHitsText}` : (closed.reason || '新訊號自動結束上一筆');
      const delivery = await broadcastExit(db, 'AUTO', closed.ticker, closed.price, closed.pnl, note, closed.signalUid);
      sent += delivery?.sent || 0;
    } catch (e) {
      failed += 1;
      await logAction(db, actorId, 'auto_close_notify_failed', closed.signalUid || '', e?.message || String(e));
    }
  }
  return { sent, failed };
}

async function finalizeTvSignalDelivery(env = {}, signalUid, autoClosed = []) {
  const db = env.DB;
  if (!db || !signalUid) return { sent: 0, autoTrade: { status: AUTO_TRADE_STATUS.skipped } };
  const startedAt = Date.now();
  const signal = await db.prepare('SELECT * FROM signals WHERE signal_uid = ?').bind(signalUid).first();
  if (!signal || signal.status !== 'active') return { sent: 0, skipped: true };
  await notifyAutoClosedSignals(env, autoClosed, 'tv:background');
  const delivery = await broadcastSignal(db, signal, env);
  await db.prepare('UPDATE signals SET sent_count = ? WHERE signal_uid = ?').bind(delivery.sent || 0, signalUid).run();
  const autoTrade = await dispatchAutoTradeForSignal(env, signal, { autoClosed });
  await logAction(db, 'tv:background', 'tv_signal_delivery_done', signalUid, `sent ${delivery.sent || 0}, queued ${delivery.queued || 0}, skipped ${delivery.skipped || 0}, failed ${delivery.failed || 0}, total ${delivery.total || 0}, ms ${Date.now() - startedAt}`);
  return { delivery, autoTrade };
}

async function finalizeAdminSignalDelivery(env = {}, signalUid, autoClosed = [], actorId = 'web-admin') {
  const db = env.DB;
  if (!db || !signalUid) return { sent: 0, autoTrade: { status: AUTO_TRADE_STATUS.skipped } };
  const startedAt = Date.now();
  const signal = await db.prepare('SELECT * FROM signals WHERE signal_uid = ?').bind(signalUid).first();
  if (!signal || signal.status !== 'active') return { sent: 0, skipped: true };
  for (const closed of autoClosed || []) {
    try {
      const note = closed.tpHitsText ? `${closed.reason || '新訊號自動結束上一筆'}\n已達 ${closed.tpHitsText}` : (closed.reason || '新訊號自動結束上一筆');
      await broadcastExit(db, 'AUTO', closed.ticker, closed.price, closed.pnl, note, closed.signalUid);
    } catch (e) {
      await logAction(db, actorId || 'web-admin', 'admin_auto_close_notify_failed', closed.signalUid || '', e.message);
    }
  }
  const delivery = await broadcastSignal(db, signal, env);
  await db.prepare('UPDATE signals SET sent_count = ? WHERE signal_uid = ?').bind(delivery.sent || 0, signalUid).run();
  const autoTrade = await dispatchAutoTradeForSignal(env, signal, { autoClosed });
  await logAction(db, actorId || 'web-admin', 'admin_signal_delivery_done', signalUid, `sent ${delivery.sent || 0}, queued ${delivery.queued || 0}, skipped ${delivery.skipped || 0}, failed ${delivery.failed || 0}, total ${delivery.total || 0}, ms ${Date.now() - startedAt}`);
  return { delivery, autoTrade };
}

async function closeSignalFromTvExit(db, source, payload, alertUid) {
  const ticker = normalizeTvTicker(firstTvValue(payload.ticker, payload.symbol, payload.syminfo, payload.source));
  if (!ticker) throw new Error('TradingView exit alert 缺少 ticker');
  const type = inferTvExitType(payload);
  const payloadAction = normalizeTvAction(payload);
  let price = tvExitPrice(payload, type, payloadAction);
  if (price === null) throw new Error('TradingView exit alert 缺少 strategy.order.price / price / close');
  const requestedStrategy = String(firstTvValue(payload.strategy, payload.strategy_id, payload.strategyId)).trim();
  const reason = tvOrderComment(payload) || tvOrderId(payload) || `TradingView ${type}`;
  const query = requestedStrategy && requestedStrategy.toLowerCase() !== 'auto'
    ? db.prepare(`
        SELECT * FROM signals
        WHERE ticker = ? AND source = ? AND strategy_id = ? AND status = 'active'
        ORDER BY created_at DESC LIMIT 1
      `).bind(ticker, source.source_id, slugify(requestedStrategy, 'strategy'))
    : db.prepare(`
        SELECT * FROM signals
        WHERE ticker = ? AND source = ? AND status = 'active'
        ORDER BY created_at DESC LIMIT 1
      `).bind(ticker, source.source_id);
  const signal = await query.first();
  if (!signal) {
    return { status: 'exit_unmatched', ticker, type, price, reason, delivery: { sent: 0 } };
  }
  price = tvExitPrice(payload, type, signal.action) ?? price;
  if (type === 'TP1' || type === 'TP2') {
    const count = signalTpHitCountAtPrice(signal, price, type);
    const marked = await markSignalTpHits(db, signal.signal_uid, count);
    const tpHitsText = signalTpHitText({ ...signal, tp_hit_count: count });
    const delivery = source.auto_send && marked.updated
      ? await broadcastExit(db, type, ticker, price, signal.action === 'LONG' ? price - signal.entry_price : signal.entry_price - price, tpHitsText ? `已達 ${tpHitsText}` : reason, signal.signal_uid)
      : { sent: 0 };
    return { status: marked.updated ? 'tp_hit' : 'tp_duplicate', signalUid: signal.signal_uid, ticker, type, price, tpHitCount: marked.tpHitCount, previousTpHitCount: marked.previousTpHitCount, tpHitsText, delivery };
  }
  const result = await closeAdminSignal(db, `tv:${source.source_id}`, signal.signal_uid, {
    price,
    type,
    reason,
    notify: Boolean(source.auto_send)
  });
  return { ...result, status: result.status || 'closed', ticker, type, price, reason };
}

function tvAlertLevelDebug(payload, action = '') {
  const side = tvActionSide(action || normalizeTvAction(payload));
  const stopValue = side === 'long'
    ? firstTvValue(payload.stop_loss, payload.sl, payload.long_stop_loss, payload.longStopLoss, payload.p5, payload.plot_5, payload.plots?.[5], payload.plots?.['5'])
    : side === 'short'
      ? firstTvValue(payload.stop_loss, payload.sl, payload.short_stop_loss, payload.shortStopLoss, payload.p6, payload.plot_6, payload.plots?.[6], payload.plots?.['6'])
      : firstTvValue(payload.stop_loss, payload.sl, payload.long_stop_loss, payload.short_stop_loss);
  const tp1Value = side === 'long'
    ? firstTvValue(payload.tp1, payload.target1, payload.long_tp1, payload.longTp1, payload.p7, payload.plot_7, payload.plots?.[7], payload.plots?.['7'])
    : side === 'short'
      ? firstTvValue(payload.tp1, payload.target1, payload.short_tp1, payload.shortTp1, payload.p8, payload.plot_8, payload.plots?.[8], payload.plots?.['8'])
      : firstTvValue(payload.tp1, payload.target1, payload.long_tp1, payload.short_tp1);
  const rawPlots = [];
  for (let i = 0; i <= 17; i++) {
    const value = firstTvValue(payload[`p${i}`], payload[`plot_${i}`], payload.plots?.[i], payload.plots?.[String(i)]);
    if (value !== '' && value !== null && value !== undefined) rawPlots.push(`p${i}:${String(value).slice(0, 24)}`);
  }
  const fields = [
    ['entry', firstTvValue(payload.entry_price, payload.order_price, payload.price, payload.close)],
    ['sl', stopValue],
    ['tp1', tp1Value],
    ['tp2', firstTvValue(payload.tp2, payload.target2, payload.long_tp2, payload.short_tp2)],
    ['tp3', firstTvValue(payload.tp3, payload.target3, payload.long_tp3, payload.short_tp3)],
    ['prob', fmtProbability(tvProbability(payload, normalizeTvAction(payload) || ''))]
  ];
  const base = fields
    .map(([label, value]) => `${label}:${value === '' ? '-' : String(value).slice(0, 40)}`)
    .join(' · ');
  return rawPlots.length ? `${base} · raw:${rawPlots.join(',')}` : base;
}

async function notifyTradingViewAlertError(env = {}, source = {}, payload = {}, alertUid = '', error = '') {
  loadRuntimeConfig(env);
  const admins = CONFIG.ADMIN_IDS || [];
  if (!admins.length || !CONFIG.BOT_TOKEN) return { sent: 0, skipped: true };
  const ticker = normalizeTvTicker(firstTvValue(payload.ticker, payload.symbol, payload.syminfo, payload.source)) || '-';
  const action = normalizeTvAction(payload) || inferTvExitType(payload) || '-';
  const strategy = String(firstTvValue(payload.strategy, payload.strategy_id, payload.strategyId)).trim() || source.default_strategy_id || '-';
  const chartUrl = tvChartUrl(payload, ticker);
  const zeroHint = /\b0\b/.test(tvAlertLevelDebug(payload)) || String(error || '').includes('為 0')
    ? '\n\n重點：TV 目前回傳 SL/TP 為 0，請修正 alert message 的 plot 欄位；後端不會用推算點位代替。'
    : '';
  const msg =
    `⚠️ <b>TradingView Alert 未發送 TG</b>\n\n` +
    `來源：<code>${escHtml(source.source_id || '-')}</code>\n` +
    `品種：<b>${escHtml(ticker)}</b> ${escHtml(action)}\n` +
    `策略：<code>${escHtml(strategy)}</code>\n` +
    `Alert：<code>${escHtml(String(alertUid || '-').slice(0, 80))}</code>\n` +
    `點位：<code>${escHtml(tvAlertLevelDebug(payload))}</code>\n\n` +
    `原因：${escHtml(String(error || '解析失敗').slice(0, 600))}` +
    zeroHint +
    (chartUrl ? `\n\n圖表：${escHtml(chartUrl)}` : '');
  let sent = 0;
  for (const adminId of admins) {
    const result = await sendTg(adminId, msg);
    if (result?.ok) sent += 1;
  }
  return { sent };
}

async function upsertTradingViewSource(db, payload) {
  await ensureAdminSchema(db);
  const sourceId = slugify(payload.source_id || payload.sourceId || payload.name, 'tv');
  const existing = await db.prepare('SELECT * FROM tradingview_sources WHERE source_id = ?').bind(sourceId).first();
  const name = String(payload.name || existing?.name || sourceId).trim();
  const secret = String(payload.webhook_secret || payload.webhookSecret || existing?.webhook_secret || genUID()).trim();
  const defaultStrategyId = String(payload.default_strategy_id || payload.defaultStrategyId || existing?.default_strategy_id || '').trim() || null;
  const allowedSymbols = cleanListValue(payload.allowed_symbols ?? payload.allowedSymbols ?? existing?.allowed_symbols ?? []);
  const defaultSignalType = String(payload.default_signal_type || payload.defaultSignalType || existing?.default_signal_type || 'auto').trim() || 'auto';
  const targetGroup = String(payload.target_group || payload.targetGroup || existing?.target_group || 'pro').trim();
  // 預設自動發送：只有明確設為 false 才當草稿
  const autoSend = (payload.auto_send === false || payload.autoSend === false || payload.auto_send === 'false' || payload.autoSend === 'false') ? 0 : 1;
  const isActive = payload.is_active === false || payload.isActive === false || payload.is_active === 'false' || payload.isActive === 'false' ? 0 : 1;
  const notes = String(payload.notes || existing?.notes || '').trim();

  await db.prepare(`
    INSERT INTO tradingview_sources (
      source_id, name, webhook_secret, default_strategy_id, allowed_symbols,
      default_signal_type, target_group, auto_send, is_active, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(source_id) DO UPDATE SET
      name = excluded.name,
      webhook_secret = excluded.webhook_secret,
      default_strategy_id = excluded.default_strategy_id,
      allowed_symbols = excluded.allowed_symbols,
      default_signal_type = excluded.default_signal_type,
      target_group = excluded.target_group,
      auto_send = excluded.auto_send,
      is_active = excluded.is_active,
      notes = excluded.notes,
      updated_at = datetime('now')
  `).bind(sourceId, name, secret, defaultStrategyId, allowedSymbols, defaultSignalType, targetGroup, autoSend, isActive, notes).run();

  return { sourceId, secret };
}

async function previewTradingViewSignal(db, payload) {
  const sourceId = String(payload.source_id || payload.sourceId || 'default-tv');
  const source = await getTradingViewSource(db, sourceId);
  if (!source) throw new Error('找不到 TradingView 來源');
  const draft = await buildTvSignalDraft(db, source, payload);
  const proxies = await previewProxySignalsForDraft(db, draft);
  const probabilityGate = await signalProbabilityGate(db, draft);
  return {
    signal: {
      ticker: draft.ticker,
      action: draft.action,
      signal_type: draft.signal_type,
      entry_price: draft.entry_price,
      stop_loss: draft.stop_loss,
      tp1: draft.tp1,
      tp2: draft.tp2,
      tp3: draft.tp3,
      probability: draft.probability,
      target_group: draft.target_group,
      strategy_id: draft.strategy_id
    },
    probabilityGate,
    proxies,
    strategy: { id: draft.strategy.strategy_id, name: draft.strategy.name, rules: draft.rules }
  };
}

function normalizeProbabilityThreshold(value) {
  const n = normalizeProbabilityValue(value);
  return n !== null && n > 0 ? n : 0;
}

async function getSignalMinProbability(db) {
  return normalizeProbabilityThreshold(await getConfig(db, 'signal_min_probability'));
}

async function signalProbabilityGate(db, draft = {}) {
  const minProbability = await getSignalMinProbability(db);
  const probability = normalizeProbabilityValue(draft.probability);
  const missing = minProbability > 0 && probability === null;
  const below = minProbability > 0 && probability !== null && probability < minProbability;
  const ignored = missing || below;
  return {
    enabled: minProbability > 0,
    minProbability,
    probability,
    ignored,
    status: missing ? 'ignored_missing_probability' : below ? 'ignored_low_probability' : 'accepted',
    reason: missing
      ? `未收到機率，門檻為 ${fmtProbability(minProbability)}`
      : below ? `機率 ${fmtProbability(probability)} 低於門檻 ${fmtProbability(minProbability)}` : ''
  };
}

async function previewFallbackSignalLevels(db, payload = {}) {
  await ensureAdminSchema(db);
  const ticker = normalizeTvTicker(payload.ticker || payload.symbol || payload.instrument);
  const action = String(payload.action || '').toUpperCase();
  const entry = asNumber(payload.entry_price ?? payload.entry ?? payload.price);
  if (!ticker) throw new Error('請輸入品種');
  if (!['LONG', 'SHORT'].includes(action)) throw new Error('方向必須是 LONG 或 SHORT');
  if (entry === null || entry === 0) throw new Error('請輸入有效進場價');

  const symbol = await db.prepare('SELECT * FROM symbols WHERE symbol = ? AND is_active = 1').bind(ticker).first();
  if (!symbol) throw new Error(`${ticker} 尚未啟用，請先到品種管理新增或啟用`);
  const requestedStrategy = String(payload.strategy || payload.strategy_id || payload.strategyId || 'algo-pro-v1-4').trim();
  const strategy = await db.prepare('SELECT * FROM strategies WHERE strategy_id = ? AND is_active = 1').bind(slugify(requestedStrategy, 'algo-pro-v1-4')).first()
    || await db.prepare('SELECT * FROM strategies WHERE is_active = 1 ORDER BY sort_order, strategy_id LIMIT 1').first();
  if (!strategy) throw new Error('尚未建立策略');

  const explicitStop = asNumber(payload.stop_loss ?? payload.stop ?? payload.sl, null);
  const explicitTargets = [
    asNumber(payload.tp1 ?? payload.target1, null),
    asNumber(payload.tp2 ?? payload.target2, null),
    asNumber(payload.tp3 ?? payload.target3, null)
  ];
  const rules = parseObject(strategy.rules_json, { riskPoints: 30, targetR: [1, 2, 3] });
  const derived = deriveSignalLevels({
    entry,
    action,
    tickSize: symbol.tick_size,
    explicitStop,
    explicitTargets,
    symbol,
    rules
  });
  return {
    ticker,
    action,
    entry,
    stop_loss: derived.stopLoss,
    tp1: derived.targets[0] ?? null,
    tp2: derived.targets[1] ?? null,
    tp3: derived.targets[2] ?? null,
    riskPoints: derived.riskPoints,
    mode: derived.mode,
    basis: derived.basis,
    strategy: { id: strategy.strategy_id, name: strategy.name },
    liveStrict: true,
    warning: '此為後台補位預覽，只用來驗證 fallback 計算；正式 TradingView webhook 仍必須由 AlgoPro 指標至少回傳 SL 與 TP1，缺值或 0 不會推送會員。'
  };
}

async function smartConfigureTradingView(db, request, adminId, payload = {}) {
  await ensureAdminSchema(db);
  const activeRows = await db.prepare('SELECT symbol FROM symbols WHERE is_active = 1 ORDER BY sort_order, symbol').all();
  const activeSymbols = (activeRows.results || []).map((row) => normalizeTvTicker(row.symbol)).filter(Boolean);
  const requestedSymbols = parseList(payload.symbols || payload.allowed_symbols || payload.allowedSymbols)
    .map((symbol) => normalizeTvTicker(symbol))
    .filter(Boolean);
  const symbols = [...new Set((requestedSymbols.length ? requestedSymbols : activeSymbols).filter(Boolean))];
  if (!symbols.length) throw new Error('尚無可設定的啟用品種');

  const strategyId = slugify(payload.strategy_id || payload.strategyId || payload.strategy || 'algo-pro-v1-4', 'algo-pro-v1-4');
  const existingStrategy = await db.prepare('SELECT * FROM strategies WHERE strategy_id = ?').bind(strategyId).first();
  await upsertAdminStrategy(db, {
    strategy_id: strategyId,
    name: existingStrategy?.name || 'AlgoPro V1.4',
    description: existingStrategy?.description || '串接 TradingView 既有 AlgoPro 指標，使用智慧方向欄位回傳實際 SL/TP。',
    signal_types: existingStrategy?.signal_types || '["scalp","daytrade"]',
    symbols: JSON.stringify(symbols),
    tier: existingStrategy?.tier || 'pro',
    is_active: true,
    sort_order: existingStrategy?.sort_order ?? 2,
    rules_json: algoProSmartRulesString(existingStrategy?.rules_json || ''),
    tv_alert_template: algoProSmartTvTemplateString(),
    note: '智慧設定：來源允許全部啟用品種；AlgoPro 指標 alert 建議分別建立 Buy Signal 與 Sell Signal，後台會依方向產生對應 Message。'
  });

  const sourceId = slugify(payload.source_id || payload.sourceId || 'default-tv', 'default-tv');
  const existingSource = await db.prepare('SELECT * FROM tradingview_sources WHERE source_id = ?').bind(sourceId).first();
  const sourceResult = await upsertTradingViewSource(db, {
    source_id: sourceId,
    name: existingSource?.name || 'Default TradingView',
    webhook_secret: existingSource?.webhook_secret || '',
    default_strategy_id: strategyId,
    allowed_symbols: JSON.stringify(symbols),
    default_signal_type: payload.default_signal_type || payload.defaultSignalType || existingSource?.default_signal_type || 'auto',
    target_group: payload.target_group || payload.targetGroup || existingSource?.target_group || 'pro',
    auto_send: payload.auto_send === false || payload.autoSend === false ? false : true,
    is_active: true,
    notes: '智慧設定：全部啟用品種已允許；請在後台產生器分別複製 Buy Signal / Sell Signal Message 貼到 TradingView。'
  });

  const source = await getTradingViewSource(db, sourceResult.sourceId);
  const alertMessage = algoProSmartTvTemplateObject();
  alertMessage.secret = source.webhook_secret;
  alertMessage.source_id = source.source_id;
  alertMessage.strategy = strategyId;
  alertMessage.alert_id = `{{ticker}}-{{time}}-${strategyId}-{{strategy.order.id}}-{{strategy.order.comment}}`;
  const origin = new URL(request.url).origin;
  await logAction(db, adminId, 'tv_smart_config', source.source_id, `${strategyId} ${symbols.join(',')}`);
  return {
    sourceId: source.source_id,
    strategyId,
    symbols,
    autoSend: Boolean(source.auto_send),
    webhookUrl: `${origin}/tv/${source.source_id}`,
    alertMessage: JSON.stringify(alertMessage, null, 2)
  };
}

function tvImportAliases(symbol) {
  const s = String(symbol || '').toUpperCase();
  const aliases = new Set([s]);
  if (s === 'ETH') ['ETHUSD', 'ETHUSDT', 'ETHPERP', 'ETH.P', 'BINANCE:ETHUSDT', 'BYBIT:ETHUSDT', 'COINBASE:ETHUSD'].forEach((v) => aliases.add(v));
  if (s === 'USTEC') ['US100', 'NAS100', 'USTEC.F', 'BLACKBULL:USTEC.F', 'OANDA:NAS100USD'].forEach((v) => aliases.add(v));
  if (s === 'XAUUSD') ['XAU', 'GOLD', 'OANDA:XAUUSD', 'FX:XAUUSD'].forEach((v) => aliases.add(v));
  if (s === 'NQ') ['NQ1!', 'MNQ1!', 'CME_MINI:NQ1!', 'CME_MINI:MNQ1!'].forEach((v) => aliases.add(v));
  if (s === 'ES') ['ES1!', 'MES1!', 'CME_MINI:ES1!', 'CME_MINI:MES1!'].forEach((v) => aliases.add(v));
  if (s === 'GC') ['GC1!', 'MGC1!', 'COMEX:GC1!', 'COMEX:MGC1!'].forEach((v) => aliases.add(v));
  if (s === 'CL') ['CL1!', 'NYMEX:CL1!'].forEach((v) => aliases.add(v));
  return [...aliases].filter(Boolean);
}

function tvImportLineHasAlias(line, alias) {
  const raw = String(line || '').toUpperCase();
  const cleanRaw = raw.replace(/[^A-Z0-9]/g, '');
  const cleanAlias = String(alias || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!cleanAlias) return false;
  if (raw.includes(String(alias || '').toUpperCase())) return true;
  if (cleanAlias.length >= 4 && cleanRaw.includes(cleanAlias)) return true;
  return new RegExp(`(^|[^A-Z0-9])${cleanAlias}([^A-Z0-9]|$)`).test(cleanRaw);
}

async function smartImportTradingViewList(db, request, adminId, payload = {}) {
  await ensureAdminSchema(db);
  const activeRows = await db.prepare('SELECT symbol FROM symbols WHERE is_active = 1 ORDER BY sort_order, symbol').all();
  const activeSymbols = (activeRows.results || []).map((row) => normalizeTvTicker(row.symbol)).filter(Boolean);
  const strategies = (await db.prepare('SELECT strategy_id, name FROM strategies WHERE is_active = 1 ORDER BY sort_order, strategy_id').all()).results || [];
  const textLines = String(payload.text || payload.list || payload.raw || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const itemLines = Array.isArray(payload.items)
    ? payload.items.map((item) => typeof item === 'string' ? item : JSON.stringify(item)).filter(Boolean)
    : [];
  const lines = [...textLines, ...itemLines];
  if (!lines.length) throw new Error('請貼上 TradingView bot / alert 清單文字，或使用掃描助手複製清單');

  const matchedSymbols = new Set();
  const matches = [];
  const unresolved = [];
  for (const line of lines) {
    const lineSymbols = [];
    for (const symbol of activeSymbols) {
      if (tvImportAliases(symbol).some((alias) => tvImportLineHasAlias(line, alias))) {
        matchedSymbols.add(symbol);
        lineSymbols.push(symbol);
      }
    }
    if (lineSymbols.length) {
      matches.push({ line: line.slice(0, 240), symbols: [...new Set(lineSymbols)] });
    } else {
      unresolved.push(line.slice(0, 240));
    }
  }

  const requestedStrategy = String(payload.strategy || payload.strategy_id || payload.strategyId || '').trim();
  const lowerText = lines.join('\n').toLowerCase();
  const detectedStrategy = requestedStrategy || (strategies.find((strategy) => {
    return lowerText.includes(String(strategy.strategy_id || '').toLowerCase()) ||
      lowerText.includes(String(strategy.name || '').toLowerCase());
  })?.strategy_id) || 'algo-pro-v1-4';

  const sourceId = slugify(payload.source_id || payload.sourceId || 'default-tv', 'default-tv');
  const existingSource = await getTradingViewSource(db, sourceId);
  const existingSymbols = parseList(existingSource?.allowed_symbols || []);
  const symbols = [...new Set([...existingSymbols, ...matchedSymbols].map((symbol) => normalizeTvTicker(symbol)).filter(Boolean))];
  const configured = await smartConfigureTradingView(db, request, adminId, {
    ...payload,
    source_id: sourceId,
    strategy: detectedStrategy,
    symbols: symbols.length ? JSON.stringify(symbols) : JSON.stringify(activeSymbols)
  });
  await logAction(db, adminId, 'tv_smart_import', sourceId, `matched ${matchedSymbols.size}, unresolved ${unresolved.length}`);
  return {
    ...configured,
    importedSymbols: [...matchedSymbols],
    matches,
    unresolved,
    scanned: lines.length
  };
}

async function handleTradingViewWebhook(request, env, sourceId, url, ctx = null) {
  const db = env.DB;
  await ensureAdminSchema(db);
  const source = await getTradingViewSource(db, sourceId);
  if (!source || !source.is_active) return json({ ok: false, error: 'TradingView source not found or inactive' }, 404);

  let payload = {};
  const rawText = await request.text();
  try {
    payload = rawText ? JSON.parse(rawText) : {};
  } catch {
    payload = { message: rawText };
  }
  const providedSecret = String(payload.secret || request.headers.get('X-TradingView-Secret') || url.searchParams.get('secret') || '');
  if (providedSecret) {
    if (providedSecret !== source.webhook_secret) {
      return json({ ok: false, error: 'Invalid TradingView secret' }, 401);
    }
  } else if (!isTrustedTradingViewWebhook(request)) {
    return json({ ok: false, error: 'Invalid TradingView secret' }, 401);
  }

  const alertUid = String(payload.alert_uid || payload.alert_id || payload.id || [
    payload.time || Date.now(),
    payload.ticker || payload.symbol || 'alert',
    payload.event || payload.event_type || payload.type || '',
    payload.action || payload.side || '',
    payload.order_id || payload.orderId || '',
    payload.order_comment || payload.orderComment || ''
  ].join('-')).slice(0, 180);
  const existingLog = await db.prepare('SELECT * FROM tv_alert_logs WHERE source_id = ? AND alert_uid = ?').bind(source.source_id, alertUid).first();
  if (existingLog?.signal_uid) {
    return json({ ok: true, duplicate: true, signalUid: existingLog.signal_uid, status: existingLog.status });
  }
  const proxyCalibration = isProxyCalibrationPayload(payload);
  if (String(existingLog?.status || '').startsWith('ignored_')) {
    return json({ ok: true, duplicate: true, source: source.source_id, ignored: true, status: existingLog.status });
  }
  if (proxyCalibration && existingLog?.status && String(existingLog.status).startsWith('calibration')) {
    return json({ ok: true, duplicate: true, source: source.source_id, status: existingLog.status });
  }

  try {
    if (proxyCalibration) {
      const result = await handleProxyCalibrationPayload(db, payload, source, env);
      const calibration = result.calibration || {};
      await db.prepare(`
        INSERT OR REPLACE INTO tv_alert_logs (alert_uid, source_id, strategy_id, ticker, action, payload, signal_uid, status, error, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NULL, ?, NULL, datetime('now'))
      `).bind(
        alertUid,
        source.source_id,
        'proxy-weekly-offset',
        calibration.source_symbol && calibration.target_symbol ? `${calibration.source_symbol}->${calibration.target_symbol}` : null,
        'CALIBRATION',
        JSON.stringify(payload),
        result.status || 'calibration'
      ).run();
      return json({ ok: true, source: source.source_id, ...result });
    }

    if (inferTvEventKind(payload) === 'exit') {
      const result = await closeSignalFromTvExit(db, source, payload, alertUid);
      await db.prepare(`
        INSERT OR REPLACE INTO tv_alert_logs (alert_uid, source_id, strategy_id, ticker, action, payload, signal_uid, status, error, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, datetime('now'))
      `).bind(
        alertUid,
        source.source_id,
        String(firstTvValue(payload.strategy, payload.strategy_id, payload.strategyId)).trim() || null,
        result.ticker || null,
        result.type || 'EXIT',
        JSON.stringify(payload),
        result.signalUid || null,
        result.status
      ).run();
      return json({ ok: true, source: source.source_id, ...result });
    }

    const draft = await buildTvSignalDraft(db, source, payload);
    const probabilityGate = await signalProbabilityGate(db, draft);
    if (probabilityGate.ignored) {
      const paused = await getConfig(db, 'signals_paused');
      const shouldSettlePrevious = Boolean(source.auto_send) && paused !== '1';
      const canDeferCloseNotice = Boolean(ctx?.waitUntil && shouldSettlePrevious);
      const autoClosed = shouldSettlePrevious
        ? await closeActiveSignalsForReplacement(db, draft, `tv:${draft.source}:probability-gate`, env, !canDeferCloseNotice)
        : [];
      if (canDeferCloseNotice && autoClosed.length) {
        ctx.waitUntil(notifyAutoClosedSignals(env, autoClosed, 'tv:probability')
          .catch((e) => logAction(db, 'tv:probability', 'low_probability_close_notify_failed', alertUid, e?.message || String(e))));
      }
      await db.prepare(`
        INSERT OR REPLACE INTO tv_alert_logs (alert_uid, source_id, strategy_id, ticker, action, payload, signal_uid, status, error, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, datetime('now'))
      `).bind(
        alertUid,
        source.source_id,
        draft.strategy_id,
        draft.ticker,
        draft.action,
        JSON.stringify(payload),
        probabilityGate.status,
        probabilityGate.reason
      ).run();
      await logAction(db, 'tv:probability', 'tv_signal_ignored_probability_gate', alertUid, `${draft.ticker} ${draft.action} ${probabilityGate.reason}; closed ${autoClosed.length}`);
      return json({ ok: true, source: source.source_id, ignored: true, status: probabilityGate.status, probabilityGate, autoClosed, paused: paused === '1', signal: draft });
    }
    const canDeferDelivery = Boolean(ctx?.waitUntil && source.auto_send);
    const result = await createSignalFromTvDraft(db, draft, alertUid, source.auto_send, env, {
      deferDelivery: canDeferDelivery
    });
    await db.prepare(`
      INSERT OR REPLACE INTO tv_alert_logs (alert_uid, source_id, strategy_id, ticker, action, payload, signal_uid, status, error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, datetime('now'))
    `).bind(alertUid, source.source_id, draft.strategy_id, draft.ticker, draft.action, JSON.stringify(payload), result.signalUid, result.status).run();
    if (result.deferred) {
      ctx.waitUntil(finalizeTvSignalDelivery(env, result.signalUid, result.autoClosed)
        .catch((e) => logAction(db, 'tv:background', 'tv_signal_delivery_failed', result.signalUid, e?.message || String(e))));
    }
    let proxies = [];
    try {
      proxies = await createProxySignalsForDraft(db, draft, alertUid, source.auto_send, env, {
        deferDelivery: canDeferDelivery
      });
      if (ctx?.waitUntil) {
        for (const proxy of proxies) {
          if (proxy.deferred && proxy.signalUid) {
            ctx.waitUntil(finalizeTvSignalDelivery(env, proxy.signalUid, proxy.autoClosed)
              .catch((e) => logAction(db, 'tv:background', 'tv_proxy_delivery_failed', proxy.signalUid, e?.message || String(e))));
          }
        }
      }
    } catch (proxyError) {
      await logAction(db, 'signal:proxy', 'proxy_signal_error', draft.signal_uid, proxyError?.message || String(proxyError));
      proxies = [{ status: 'error', error: proxyError?.message || String(proxyError) }];
    }
    return json({ ok: true, source: source.source_id, ...result, proxies, signal: draft });
  } catch (e) {
    const errorTicker = normalizeTvTicker(firstTvValue(payload.ticker, payload.symbol, payload.syminfo, payload.source));
    const errorAction = normalizeTvAction(payload) || inferTvExitType(payload) || '';
    const errorStrategy = String(firstTvValue(payload.strategy, payload.strategy_id, payload.strategyId)).trim() || null;
    await db.prepare(`
      INSERT OR REPLACE INTO tv_alert_logs (alert_uid, source_id, strategy_id, ticker, action, payload, status, error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'error', ?, datetime('now'))
    `).bind(alertUid, source.source_id, errorStrategy, errorTicker || null, errorAction || null, JSON.stringify(payload), e.message).run();
    const notify = notifyTradingViewAlertError(env, source, payload, alertUid, e.message)
      .catch((notifyError) => logAction(db, 'tv:notify', 'tv_alert_error_notify_failed', alertUid, notifyError.message));
    if (ctx?.waitUntil) ctx.waitUntil(notify); else await notify;
    return json({ ok: false, error: e.message }, 400);
  }
}

async function handleAdminApi(request, env, pathname, ctx = null) {
  const auth = await requireAdminRequest(request, env, true);
  if (auth) return auth;

  const db = env.DB;
  const adminId = env.ADMIN_WEB_USER || 'web-admin';
  const parts = pathname.split('/').filter(Boolean).slice(2);

  try {
    if (parts[0] === 'economic-events') {
      const url = new URL(request.url);
      const dateKey = url.searchParams.get('date') || taipeiDateKey();

      if (request.method === 'GET' && parts.length === 1) {
        await ensureEconomicEventsSchema(db);
        const config = await getEconomicConfig(db, env);
        const events = await getEconomicEventsForDate(db, dateKey, config);
        return json({ ok: true, data: { date: dateKey, events, config } });
      }

      if (request.method === 'POST' && parts.length === 1) {
        const event = await upsertEconomicEvent(db, await readJsonBody(request), 'admin');
        await logAction(db, adminId, 'economic_event_upsert', event.event_uid, event.title);
        return json({ ok: true, data: event });
      }

      if (request.method === 'POST' && parts[1] === 'sync') {
        const body = await readJsonBody(request);
        const config = await getEconomicConfig(db, env);
        const result = await syncEconomicEventsRange(db, env, body.date || dateKey, body.days || config.lookaheadDays || 1);
        await logAction(db, adminId, 'economic_event_sync', body.date || dateKey, `${result.synced}/${result.total}`);
        return json({ ok: true, data: result });
      }

      if (request.method === 'POST' && parts[1] === 'remind') {
        const body = await readJsonBody(request);
        const result = await sendEconomicEventsReminder(env, { force: true, date: body.date || dateKey });
        await logAction(db, adminId, 'economic_event_remind', body.date || dateKey, `sent ${result.sent || 0}`);
        return json({ ok: true, data: result });
      }
    }

    if (request.method === 'GET' && parts[0] === 'bootstrap') {
      return json({ ok: true, data: await getAdminBootstrap(db, env, request) });
    }

    if (request.method === 'GET' && parts[0] === 'delivery' && parts[1] === 'diagnostics') {
      const url = new URL(request.url);
      return json({ ok: true, data: await getDeliveryDiagnostics(db, env, url.searchParams.get('limit') || 40) });
    }

    if (request.method === 'POST' && parts[0] === 'delivery' && parts[1] === 'test-admin') {
      return json({ ok: true, data: await sendAdminSignalTest(db, adminId, await readJsonBody(request), env) });
    }

    if (request.method === 'POST' && parts[0] === 'signals' && parts.length === 1) {
      const result = await createAdminSignal(db, adminId, await readJsonBody(request), env, { deferDelivery: Boolean(ctx?.waitUntil) });
      if (result.deferred && ctx?.waitUntil) {
        ctx.waitUntil(finalizeAdminSignalDelivery(env, result.signalUid, result.autoClosed, adminId)
          .catch((e) => logAction(db, adminId, 'admin_signal_delivery_failed', result.signalUid, e?.message || String(e))));
      }
      return json({ ok: true, data: result });
    }

    if (request.method === 'POST' && parts[0] === 'signals' && parts[1] === 'rebuild-performance') {
      const result = await rebuildSignalPerformance(db, adminId, await readJsonBody(request));
      return json({ ok: true, data: result });
    }

    if (request.method === 'POST' && parts[0] === 'signals' && parts[1] === 'purge') {
      const result = await purgeAdminSignals(db, adminId, await readJsonBody(request));
      return json({ ok: true, data: result });
    }

    if (request.method === 'POST' && parts[0] === 'signals' && parts[2] === 'close') {
      return json({ ok: true, data: await closeAdminSignal(db, adminId, parts[1], await readJsonBody(request)) });
    }

    if (request.method === 'POST' && parts[0] === 'signals' && parts[2] === 'delete') {
      return json({ ok: true, data: await deleteAdminSignal(db, adminId, parts[1], await readJsonBody(request)) });
    }

    if (request.method === 'POST' && parts[0] === 'signals' && parts[2] === 'send') {
      const result = await sendPendingAdminSignal(db, adminId, parts[1], env, { deferDelivery: Boolean(ctx?.waitUntil) });
      if (result.deferred && ctx?.waitUntil) {
        ctx.waitUntil(finalizeAdminSignalDelivery(env, result.signalUid, result.autoClosed, adminId)
          .catch((e) => logAction(db, adminId, 'admin_signal_delivery_failed', result.signalUid, e?.message || String(e))));
      }
      return json({ ok: true, data: result });
    }

    if (request.method === 'POST' && parts[0] === 'signals' && parts[2] === 'cancel') {
      const signal = await db.prepare('SELECT status FROM signals WHERE signal_uid = ?').bind(parts[1]).first();
      if (!signal) throw new Error('找不到訊號');
      if (signal.status !== 'pending') throw new Error('只有草稿訊號可以取消');
      await db.prepare("UPDATE signals SET status = 'cancelled', closed_at = datetime('now') WHERE signal_uid = ?").bind(parts[1]).run();
      await logAction(db, adminId, 'web_signal_cancel', parts[1], '');
      return json({ ok: true });
    }

    if (request.method === 'PUT' && parts[0] === 'config') {
      const body = await readJsonBody(request);
      const config = body.config || body;
      const updated = [];
      for (const key of ADMIN_CONFIG_KEYS) {
        if (config[key] !== undefined) {
          await setConfig(db, key, String(config[key]));
          updated.push(key);
        }
      }
      await logAction(db, adminId, 'web_config_update', updated.join(','), '');
      return json({ ok: true, data: { updated } });
    }

    if (request.method === 'POST' && parts[0] === 'symbols') {
      return json({ ok: true, data: await upsertAdminSymbol(db, await readJsonBody(request)) });
    }

    if (request.method === 'POST' && parts[0] === 'strategies') {
      return json({ ok: true, data: await upsertAdminStrategy(db, await readJsonBody(request)) });
    }

    if (request.method === 'POST' && parts[0] === 'economic' && parts[1] === 'sync') {
      const config = await getEconomicConfig(db, env);
      const result = await syncEconomicEventsRange(db, env, taipeiDateKey(), config.lookaheadDays || 1);
      await logAction(db, adminId, 'web_economic_sync', '', `synced ${result.synced}/${result.total}`);
      const events = await getUpcomingMarketEconomicEvents(db, config, { hours: 72, limit: 60 });
      return json({ ok: true, data: { ...result, fetched: result.total, events } });
    }

    if (request.method === 'POST' && parts[0] === 'tradingview' && parts[1] === 'sources') {
      return json({ ok: true, data: await upsertTradingViewSource(db, await readJsonBody(request)) });
    }

    if (request.method === 'POST' && parts[0] === 'tradingview' && parts[1] === 'smart-config') {
      return json({ ok: true, data: await smartConfigureTradingView(db, request, adminId, await readJsonBody(request)) });
    }

    if (request.method === 'POST' && parts[0] === 'tradingview' && parts[1] === 'smart-import') {
      return json({ ok: true, data: await smartImportTradingViewList(db, request, adminId, await readJsonBody(request)) });
    }

    if (request.method === 'POST' && parts[0] === 'tradingview' && parts[1] === 'preview') {
      return json({ ok: true, data: await previewTradingViewSignal(db, await readJsonBody(request)) });
    }

    if (request.method === 'POST' && parts[0] === 'tradingview' && parts[1] === 'fallback-preview') {
      return json({ ok: true, data: await previewFallbackSignalLevels(db, await readJsonBody(request)) });
    }

    if (request.method === 'POST' && parts[0] === 'users' && parts[1]) {
      return json({ ok: true, data: await updateAdminUser(db, adminId, decodeURIComponent(parts[1]), await readJsonBody(request)) });
    }

    if (request.method === 'POST' && parts[0] === 'orders' && parts[1] && parts[2]) {
      return json({ ok: true, data: await handleAdminOrderAction(db, adminId, parts[1], parts[2], await readJsonBody(request)) });
    }

    if (request.method === 'POST' && parts[0] === 'support' && parts[1] && parts[2] === 'reply') {
      const body = await readJsonBody(request);
      return json({ ok: true, data: await replySupportTicket(db, env, adminId, parts[1], body.message || body.reply || '') });
    }

    if (request.method === 'POST' && parts[0] === 'support' && parts[1] && parts[2] === 'close') {
      const body = await readJsonBody(request);
      return json({ ok: true, data: await closeSupportTicket(db, env, adminId, parts[1], body.reason || body.message || '') });
    }

    return json({ ok: false, error: 'Not found' }, 404);
  } catch (e) {
    return json({ ok: false, error: e.message }, 400);
  }
}

function renderAdminLoginPage(message = '', tone = '', username = '') {
  const safeMessage = escHtml(message || '');
  const statusClass = tone === 'error' ? 'error' : tone === 'ok' ? 'ok' : '';
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DC Signals 後台登入</title>
  <style>
    :root{--bg:#f3f6f8;--panel:#fff;--ink:#101828;--muted:#667085;--line:#d9e3ea;--accent:#08a7b3;--accent2:#087e90;--red:#d1433f;--green:#16845a;--shadow:0 18px 48px rgba(15,23,42,.12)}
    *{box-sizing:border-box}
    body{margin:0;min-height:100vh;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:radial-gradient(circle at 16% 16%,rgba(8,167,179,.16),transparent 30%),linear-gradient(135deg,#f8fbfc 0%,#eef5f8 46%,#f6f8fb 100%);color:var(--ink);display:grid;place-items:center;padding:18px}
    main{width:min(1040px,100%);display:grid;grid-template-columns:minmax(0,.85fr) minmax(390px,1fr);gap:16px;align-items:stretch}
    .panel,.brief{background:rgba(255,255,255,.95);border:1px solid rgba(217,227,234,.9);border-radius:12px;box-shadow:var(--shadow);overflow:hidden}
    .panel{padding:22px;display:grid;gap:16px;align-content:start}
    .brand{display:flex;align-items:center;justify-content:space-between;gap:12px}
    .brand-left{display:flex;align-items:center;gap:10px}
    .mark{width:42px;height:42px;border-radius:9px;background:linear-gradient(135deg,#12c6d0,#1796ff);display:grid;place-items:center;color:#06111c;font-weight:950}
    h1,h2,p{margin:0}
    h1{font-size:25px;line-height:1.12}
    .muted{color:var(--muted);font-size:13px;line-height:1.5}
    .badge{border:1px solid rgba(8,167,179,.24);background:#ecfeff;color:#087e90;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:900;white-space:nowrap}
    form{display:grid;gap:12px}
    label{display:grid;gap:6px;color:var(--muted);font-size:12px;font-weight:850}
    input{width:100%;border:1px solid var(--line);border-radius:8px;min-height:46px;padding:10px 12px;font:inherit;color:var(--ink);background:#fff;outline:none}
    input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(8,167,179,.14)}
    .btn{border:0;border-radius:8px;min-height:48px;background:var(--accent);color:#fff;font-weight:900;cursor:pointer}
    .btn:hover{background:var(--accent2)}
    .message{min-height:40px;border:1px solid var(--line);border-radius:8px;background:#f8fafc;color:var(--muted);padding:10px 12px;font-size:13px;line-height:1.4}
    .message:empty{display:none}.message.error{border-color:rgba(209,67,63,.28);background:#fff5f5;color:var(--red)}.message.ok{border-color:rgba(22,132,90,.28);background:#effaf3;color:var(--green)}
    .security{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .security div{border:1px solid var(--line);border-radius:9px;background:#f8fafc;padding:10px}
    .security b{display:block;font-size:13px}.security span{display:block;margin-top:4px;color:var(--muted);font-size:11px;line-height:1.35}
    .brief{background:#0d1824;color:#f8fafc;padding:20px;display:grid;gap:14px;align-content:space-between}
    .brief h2{font-size:24px;line-height:1.16}
    .brief p{color:#9fb2c3;font-size:13px;line-height:1.55}
    .brief-card{border:1px solid rgba(148,163,184,.18);border-radius:10px;padding:13px;background:rgba(255,255,255,.04);display:grid;gap:8px}
    .brief-row{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid rgba(148,163,184,.12);padding-bottom:8px;color:#dbeafe;font-size:13px}
    .brief-row:last-child{border-bottom:0;padding-bottom:0}
    .foot{display:flex;gap:10px;flex-wrap:wrap;color:var(--muted);font-size:12px}
    .foot a{color:var(--muted);text-decoration:none;font-weight:800}
    @media(max-width:760px){body{padding:10px;place-items:start center}main{grid-template-columns:1fr}.brief{display:none}.panel{padding:18px;border-radius:10px}.brand{align-items:flex-start}.badge{display:none}.security{grid-template-columns:1fr}h1{font-size:22px}input,.btn{min-height:48px}}
  </style>
</head>
<body>
  <main>
    <section class="panel">
      <div class="brand">
        <div class="brand-left"><div class="mark">DC</div><div><h1>後台安全登入</h1><p class="muted">DC Signals Admin Console</p></div></div>
        <span class="badge">Secure Session</span>
      </div>
      <p class="muted">登入後會建立 8 小時 HttpOnly session。請勿在共用裝置保存登入狀態，離開後使用登出。</p>
      <div class="message ${statusClass}">${safeMessage}</div>
      <form method="post" action="/admin/login" autocomplete="on">
        <label>管理員帳號
          <input name="username" autocomplete="username" value="${escHtml(username)}" placeholder="admin" required>
        </label>
        <label>管理員密碼
          <input name="password" type="password" autocomplete="current-password" placeholder="輸入後台密碼" required>
        </label>
        <button class="btn" type="submit">登入後台</button>
      </form>
      <div class="security">
        <div><b>Session Cookie</b><span>HttpOnly、SameSite Strict、逾時自動失效。</span></div>
        <div><b>CSRF Guard</b><span>後台 API 寫入操作需驗證 session token。</span></div>
        <div><b>Rate Limit</b><span>登入失敗會按 IP 與帳號限流。</span></div>
      </div>
      <div class="foot"><a href="/m">會員中心</a><a href="/terms">服務條款</a><a href="/risk-disclosure">風險揭露</a></div>
    </section>
    <aside class="brief" aria-label="後台安全提示">
      <div>
        <h2>Signal Operations Control</h2>
        <p>管理 TradingView alert、會員收費、訊號生命週期、Telegram 推播與經濟事件提醒。</p>
      </div>
      <div class="brief-card">
        <div class="brief-row"><span>登入保護</span><b>Session + CSRF</b></div>
        <div class="brief-row"><span>資料保護</span><b>No Store</b></div>
        <div class="brief-row"><span>框架限制</span><b>Frame Deny</b></div>
        <div class="brief-row"><span>建議操作</span><b>使用後登出</b></div>
      </div>
    </aside>
  </main>
</body>
</html>`;
}

async function handleAdminLogin(request, env) {
  if (!env.ADMIN_WEB_PASSWORD) {
    return adminHtmlResponse(renderAdminLoginPage('ADMIN_WEB_PASSWORD 尚未設定，請先設定 Worker secret。', 'error'), 503);
  }
  let username = '';
  let password = '';
  try {
    const form = await request.formData();
    username = String(form.get('username') || '').trim();
    password = String(form.get('password') || '');
  } catch {
    return adminHtmlResponse(renderAdminLoginPage('登入表單格式不正確，請重新送出。', 'error'), 400);
  }
  try {
    const key = await rateKey(['admin-login', requestClientIp(request), username.toLowerCase() || 'unknown']);
    await enforceRateLimit(env.DB, key, 8, 15 * 60, '後台登入嘗試過多');
  } catch (e) {
    return adminHtmlResponse(renderAdminLoginPage(e.message || '登入嘗試過多，請稍後再試。', 'error', username), 429);
  }
  if (!(await adminPasswordMatches(username, password, env))) {
    await logAction(env.DB, username || 'unknown', 'admin_login_failed', requestClientIp(request), 'bad credentials');
    return adminHtmlResponse(renderAdminLoginPage('帳號或密碼不正確。', 'error', username), 401);
  }
  const session = await createAdminSessionToken(username, env);
  await logAction(env.DB, username, 'admin_login_success', requestClientIp(request), 'web session');
  return new Response(null, {
    status: 303,
    headers: {
      Location: '/admin',
      'Set-Cookie': adminSessionCookie(session.token, request),
      'Cache-Control': 'no-store'
    }
  });
}

function renderAdminCoreScript() {
  return `
(function(){
  window.DC_ADMIN_CORE_BOUND = true;
  var titles = {
    overview: '營運總覽',
    signals: '訊號工作台',
    strategies: '策略實驗室',
    tradingview: 'TradingView Gateway',
    events: '經濟事件',
    symbols: '品種管理',
    users: '會員管理',
    orders: '訂單管理',
    support: '客服工單',
    economic: '財經提醒',
    billing: '收費設定'
  };
  function message(text,tone){
    var el = document.getElementById('message');
    if(!el) return;
    el.textContent = text || '';
    el.className = 'message ' + (tone || '');
  }
  function showView(view){
    var next = titles[view] ? view : 'overview';
    document.body.dataset.adminView = next;
    Array.prototype.slice.call(document.querySelectorAll('.view')).forEach(function(panel){
      panel.classList.toggle('active', panel.id === 'view-' + next);
    });
    Array.prototype.slice.call(document.querySelectorAll('[data-view]')).forEach(function(btn){
      var active = btn.dataset.view === next;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-current', active ? 'page' : 'false');
    });
    Array.prototype.slice.call(document.querySelectorAll('[data-view-target]')).forEach(function(btn){
      var active = btn.dataset.viewTarget === next;
      btn.classList.toggle('active', active);
      if(active) btn.setAttribute('aria-current', 'page'); else btn.removeAttribute('aria-current');
    });
    var title = document.getElementById('adminViewTitle');
    if(title) title.textContent = titles[next] || '後台';
  }
  window.DC_ADMIN_SHOW_VIEW = showView;
  document.addEventListener('click', function(event){
    var target = event.target.closest('[data-view-target]');
    if(target){
      showView(target.dataset.viewTarget);
      return;
    }
    var nav = event.target.closest('[data-view]');
    if(nav){
      event.preventDefault();
      showView(nav.dataset.view);
    }
  }, true);
  window.addEventListener('error', function(){
    message('部分後台模組載入異常，核心分頁仍可切換；請重新整理或回報錯誤。','error');
  });
  window.addEventListener('unhandledrejection', function(event){
    var reason = event && event.reason && event.reason.message ? event.reason.message : '部分後台資料載入異常';
    message(reason, 'error');
  });
})();
  `;
}

function renderAdminPage(csrfToken = '') {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DC Signals 後台</title>
  <style>
    :root {
      --bg: #eef3f7;
      --panel: #ffffff;
      --panel-2: #f7fafc;
      --ink: #0b1220;
      --muted: #64748b;
      --line: #d5dee8;
      --soft: #edf6f8;
      --nav: #0b1220;
      --nav-2: #111c2e;
      --accent: #0e9aa7;
      --accent-2: #087e90;
      --blue: #3157d8;
      --amber: #b7791f;
      --red: #d1433f;
      --green: #16845a;
      --shadow: 0 20px 50px rgba(15, 23, 42, 0.10);
      --shadow-soft: 0 8px 24px rgba(15, 23, 42, 0.06);
      --focus: 0 0 0 3px rgba(14,154,167,.14);
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: linear-gradient(180deg,#eef3f7 0%,#f8fafc 46%,#eef3f7 100%); color: var(--ink); overflow-x: hidden; }
    button, input, select, textarea { font: inherit; }
    .shell { min-height: 100vh; display: grid; grid-template-columns: 248px minmax(0, 1fr); }
    .sidebar { background: linear-gradient(180deg, var(--nav) 0%, var(--nav-2) 64%, #08111f 100%); color: #f8fafc; padding: 18px 12px; display: flex; flex-direction: column; gap: 16px; border-right:1px solid rgba(255,255,255,.08); }
    .brand { display: flex; align-items: center; gap: 11px; padding: 6px 8px 16px; border-bottom: 1px solid rgba(255,255,255,.10); }
    .mark { width: 38px; height: 38px; border-radius: 8px; display: grid; place-items: center; background: linear-gradient(135deg, #12c6d0, #3157d8); color: #06111c; font-weight: 900; letter-spacing: -0.5px; box-shadow:0 12px 28px rgba(18,198,208,.20); }
    .brand strong { display:block; font-size: 15px; line-height: 1.2; letter-spacing: .06em; }
    .brand span { display:block; color: #90a8ba; font-size: 12px; margin-top: 4px; }
    .nav { display: grid; gap: 5px; }
    .nav button { border: 1px solid transparent; width: 100%; color: #cbd7e4; background: transparent; display: flex; align-items: center; gap: 10px; height: 44px; padding: 0 12px; border-radius: 8px; cursor: pointer; text-align: left; font-size: 14px; font-weight: 750; }
    .nav button::before { content: attr(data-icon); width: 22px; height:22px; border-radius:6px; display:grid; place-items:center; color: #99f6e4; background:rgba(153,246,228,.08); font-weight: 900; text-align: center; font-size:12px; }
    .nav button.active, .nav button:hover { background: rgba(14, 154, 167, .18); border-color:rgba(153,246,228,.12); color: #fff; }
    .nav small { margin-left: auto; color: #93a0ad; }
    .main { min-width: 0; max-width: 100%; display: flex; flex-direction: column; }
    .topbar { min-height: 72px; background: rgba(248,250,252,.92); backdrop-filter: blur(18px); border-bottom: 1px solid rgba(213,222,232,.78); display:grid; grid-template-columns: minmax(220px, .7fr) minmax(260px, 1fr) auto; gap: 14px; align-items:center; padding: 12px 24px; position: sticky; top: 0; z-index: 5; box-shadow:0 1px 0 rgba(255,255,255,.62); }
    .topbar h1 { font-size: 20px; line-height: 1.15; margin: 0; letter-spacing: 0; }
    .topbar .muted { font-size: 12px; }
    .status { display:flex; gap: 8px; align-items:center; flex-wrap: wrap; }
    .pill { display:inline-flex; align-items:center; gap:6px; min-height: 28px; border:1px solid var(--line); border-radius: 999px; padding: 3px 10px; background:#fff; color: var(--muted); font-size: 12px; white-space: nowrap; box-shadow: var(--shadow-soft); font-weight:800; }
    .dot { width: 8px; height: 8px; border-radius: 99px; background: var(--green); }
    .content { min-width: 0; max-width: 100%; padding: 20px 22px 32px; display: grid; gap: 16px; }
    body:not([data-admin-view="overview"]) .overview-only { display: none !important; }
    .view { display: none; gap: 16px; }
    .view.active { display: grid; }
    .view, .grid { min-width: 0; max-width: 100%; }
    .grid { display:grid; gap: 16px; }
    .grid > *, .panel, .table-wrap { min-width: 0; max-width: 100%; }
    .grid.two { grid-template-columns: minmax(360px, 0.95fr) minmax(420px, 1.3fr); align-items: start; }
    .grid.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .kpis { display:grid; grid-template-columns: repeat(6, minmax(136px, 1fr)); gap: 12px; }
    .kpi, .panel { background: rgba(255,255,255,.96); border:1px solid rgba(213,222,232,.92); border-radius: 8px; box-shadow: var(--shadow-soft); }
    .kpi { padding: 14px; min-height: 92px; position: relative; overflow: hidden; }
    .kpi::after { content:''; position:absolute; inset:auto 0 0 0; height:3px; background: linear-gradient(90deg, var(--accent), rgba(49,87,216,.68), transparent); }
    .kpi span { color: var(--muted); font-size: 12px; font-weight: 700; }
    .kpi strong { display:block; margin-top: 8px; font-size: 27px; line-height:1; letter-spacing: 0; }
    .kpi small { display:block; margin-top: 9px; color: var(--muted); font-size: 12px; }
    .kpi .kpi-icon { width: 30px; height: 30px; border-radius: 7px; display:grid; place-items:center; background: #e7f9fb; color: var(--accent-2); margin-bottom: 8px; font-weight: 900; }
    .panel { overflow: hidden; }
    .panel header { min-height: 56px; padding: 14px 16px; border-bottom: 1px solid rgba(213,222,232,.88); display:flex; align-items:center; justify-content:space-between; gap: 12px; background:linear-gradient(180deg,#fff,#fbfdff); }
    .panel header h2 { margin:0; font-size: 15px; line-height:1.2; }
    .panel header p { margin: 4px 0 0; color: var(--muted); font-size: 12px; }
    .panel .body { padding: 16px; }
    label { display:block; font-size: 12px; color: var(--muted); margin: 0 0 6px; }
    input, select, textarea { width: 100%; border:1px solid var(--line); border-radius: 7px; min-height: 40px; padding: 8px 10px; background:#fff; color: var(--ink); outline: none; }
    textarea { min-height: 74px; resize: vertical; }
    input:focus, select:focus, textarea:focus { border-color: var(--accent); box-shadow: var(--focus); }
    .form-grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .form-grid .full { grid-column: 1 / -1; }
    .seg { display:grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
    .seg button, .btn { border:1px solid var(--line); border-radius: 7px; min-height: 40px; padding: 8px 11px; background:#fff; color: var(--ink); cursor:pointer; font-weight: 800; font-size: 13px; box-shadow:0 2px 8px rgba(15,23,42,.04); }
    .seg button.active { background: var(--accent); border-color: var(--accent); color:#fff; }
	    .seg button:disabled, .btn:disabled { opacity: .55; cursor: not-allowed; }
    .btn.primary { background: linear-gradient(135deg,var(--accent),#087e90); border-color: transparent; color:#fff; box-shadow:0 10px 22px rgba(14,154,167,.18); }
    .btn.primary:hover { background: var(--accent-2); }
    .btn.ghost { background:#fff; }
    .btn.warn { background:#fff7ed; border-color:#f2c580; color: var(--amber); }
    .btn.danger { background:#fff1f0; border-color:#efb4b0; color: var(--red); }
    .btn.mini { min-height: 30px; padding: 5px 9px; font-size: 12px; text-decoration: none; display:inline-flex; align-items:center; justify-content:center; }
    .actions { display:flex; gap: 8px; flex-wrap: wrap; align-items:center; }
    table { width:100%; border-collapse: collapse; }
    th, td { padding: 11px 12px; border-bottom:1px solid var(--line); text-align:left; font-size: 13px; vertical-align: middle; }
    th { color: var(--muted); font-weight: 750; background: #f8fafc; font-size: 12px; }
    tr:last-child td { border-bottom:0; }
    .table-wrap { overflow:auto; }
    .chip { display:inline-flex; align-items:center; gap:6px; min-height: 24px; padding: 2px 8px; border-radius: 999px; font-size: 12px; background: var(--soft); color:#475569; white-space:nowrap; }
    .chip.green { background:#e8f7ef; color: var(--green); }
    .chip.red { background:#fff0ef; color: var(--red); }
    .chip.amber { background:#fff7e6; color: var(--amber); }
    .muted { color: var(--muted); }
    .stack { display:grid; gap: 10px; }
    .message { position: fixed; right: 18px; bottom: 18px; z-index: 60; max-width: min(420px, calc(100vw - 36px)); min-height: 0; border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; background: rgba(255,255,255,.96); box-shadow: var(--shadow); font-size: 13px; color: var(--muted); }
    .message:empty { display: none; }
    .message.error { color: var(--red); border-color: rgba(209,67,63,.22); background: #fffafa; }
    .message.ok { color: var(--green); border-color: rgba(22,132,90,.22); background: #f6fffb; }
    .copybox { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; line-height: 1.45; min-height: 122px; }
    .readonly { background: #f8fafc; }
    .preview { border:1px solid var(--line); border-radius:6px; padding:10px; background:#f8fafc; display:grid; gap:6px; font-size:13px; }
    .preview b { font-size: 18px; }
    .preview.warn { border-color: rgba(183,121,31,.35); background:#fffaf0; }
    .preview.error { border-color: rgba(209,67,63,.26); background:#fff7f6; }
    .target-stack { display:grid; gap: 4px; white-space: nowrap; }
    .target-stack span { display:block; }
    .command-search { position: relative; }
    .command-search input { min-height: 44px; border-radius: 8px; padding-left: 40px; background: #fff; box-shadow: inset 0 1px 0 rgba(255,255,255,.65), 0 2px 10px rgba(15,23,42,.04); }
    .command-search span { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--muted); font-weight: 900; }
    .ops-hero { display:grid; grid-template-columns: minmax(0, 1fr) auto; gap: 20px; align-items:center; padding: 18px 20px; border: 1px solid rgba(15,23,42,.08); border-radius: 8px; background: linear-gradient(135deg,#0b1220 0%,#132136 62%,#123b46 100%); color:#f8fafc; box-shadow: var(--shadow); overflow:hidden; }
    .ops-hero h2 { margin: 0; font-size: 24px; line-height: 1.12; letter-spacing: 0; }
    .ops-hero p { margin: 8px 0 0; color: #cbd5e1; font-size: 13px; max-width: 760px; }
    .ops-summary { display:grid; grid-template-columns: repeat(4, minmax(116px, 1fr)); gap: 10px; min-width: 520px; }
    .ops-tile { border: 1px solid rgba(148,163,184,.22); border-radius: 8px; background: rgba(255,255,255,.08); padding: 11px; backdrop-filter:blur(12px); }
    .ops-tile span { display:block; color: #cbd5e1; font-size: 11px; font-weight: 850; }
    .ops-tile strong { display:block; margin-top: 6px; font-size: 18px; }
    .range-toolbar { display:grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items:end; padding: 13px 14px; border:1px solid rgba(213,222,232,.92); border-radius: 8px; background:rgba(255,255,255,.94); box-shadow: var(--shadow-soft); }
    .range-fields { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .range-actions { display:flex; gap: 7px; flex-wrap: wrap; justify-content:flex-end; }
    .range-summary { color: var(--muted); font-size: 12px; line-height:1.4; }
    .analytics-grid { display:grid; grid-template-columns: minmax(260px, .82fr) minmax(420px, 1.18fr); gap: 12px; align-items:start; }
    .metric-grid { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .metric-card { border:1px solid var(--line); border-radius:8px; background:#fff; padding:12px; box-shadow: var(--shadow-soft); min-width:0; }
    .metric-card span { display:block; color: var(--muted); font-size: 11px; font-weight: 850; }
    .metric-card strong { display:block; margin-top:6px; font-size: 22px; line-height:1.1; overflow-wrap:anywhere; }
    .metric-card small { display:block; margin-top:6px; color: var(--muted); font-size: 11px; line-height:1.35; }
    .rebuild-summary { margin-bottom: 12px; }
    .user-workbench { display:grid; gap: 12px; }
    .user-filter-panel { display:flex; gap: 8px; align-items:center; justify-content:space-between; flex-wrap:wrap; }
    .member-flags { display:flex; gap:6px; flex-wrap:wrap; margin-top:6px; }
    .rank-list { display:grid; gap: 8px; }
    .rank-row { display:grid; grid-template-columns: 84px minmax(0, 1fr) auto auto; gap: 8px; align-items:center; font-size: 12px; color: var(--muted); }
    .rank-row strong { color: var(--ink); font-size: 13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .rank-row .bar { height: 8px; }
    .daily-bars { display:flex; align-items:flex-end; gap:4px; min-height:96px; padding-top:8px; border-top:1px solid var(--line); overflow:hidden; }
    .daily-bars div { flex:1; min-width:6px; display:flex; flex-direction:column; justify-content:flex-end; gap:4px; }
    .daily-bars i { display:block; border-radius:999px 999px 0 0; background:linear-gradient(180deg, var(--accent), var(--blue)); min-height:3px; }
    .daily-bars span { color:var(--muted); font-size:10px; text-align:center; white-space:nowrap; transform:rotate(-45deg); transform-origin:center; margin-top:6px; }
    .daily-bars .loss i { background:linear-gradient(180deg, #ef4444, #b91c1c); }
    .ops-health-grid { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .health-card { border:1px solid var(--line); border-radius:8px; padding: 12px; background:#fff; display:grid; gap: 7px; border-left: 3px solid var(--accent); }
    .health-card strong { font-size: 14px; }
    .health-card p { margin:0; color: var(--muted); font-size: 12px; line-height: 1.45; }
    .health-card small { color: var(--muted); font-size: 11px; }
    .health-card.critical { border-left-color: var(--red); background:#fffafa; }
    .health-card.warning { border-left-color: var(--amber); background:#fffdf5; }
    .health-card.info { border-left-color: var(--blue); }
    .delivery-grid { display:grid; grid-template-columns: minmax(280px,.78fr) minmax(360px,1.22fr); gap:12px; align-items:start; }
    .delivery-metrics { display:grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap:8px; }
    .delivery-card { border:1px solid var(--line); border-radius:8px; background:#fff; padding:11px; display:grid; gap:6px; box-shadow:var(--shadow-soft); }
    .delivery-card span { color:var(--muted); font-size:11px; font-weight:850; }
    .delivery-card strong { font-size:22px; line-height:1; }
    .delivery-card small { color:var(--muted); font-size:11px; line-height:1.35; }
    .delivery-list { display:grid; gap:9px; max-height:520px; overflow:auto; padding-right:2px; }
    .delivery-item { border:1px solid var(--line); border-left:4px solid var(--accent); border-radius:8px; background:#fff; padding:11px; display:grid; gap:8px; }
    .delivery-item.red { border-left-color:var(--red); background:#fffafa; }
    .delivery-item.amber { border-left-color:var(--amber); background:#fffdf5; }
    .delivery-head { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; }
    .delivery-head strong { font-size:14px; }
    .delivery-head span { display:block; margin-top:3px; color:var(--muted); font-size:12px; }
    .level-pills { display:flex; gap:6px; flex-wrap:wrap; }
    .level-pills code { border:1px solid var(--line); border-radius:999px; padding:3px 7px; background:#f8fafc; font-size:11px; color:#334155; }
    .delivery-note { color:var(--muted); font-size:12px; line-height:1.45; }
    .panel-tools { display:flex; gap: 8px; align-items:center; flex-wrap: wrap; }
    .filter-tabs { display:flex; gap: 6px; flex-wrap: wrap; }
    .filter-tabs button { border: 1px solid var(--line); border-radius: 999px; background:#fff; min-height: 30px; padding: 4px 10px; color: var(--muted); font-size: 12px; font-weight: 800; cursor:pointer; }
    .filter-tabs button.active { background: #e6f8fa; border-color: rgba(8,167,179,.35); color: var(--accent-2); }
    .card-grid { display:grid; gap: 10px; }
    .card-grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .strategy-card, .source-card, .revenue-card { border: 1px solid var(--line); border-radius: 8px; padding: 12px; background: #fff; box-shadow: var(--shadow-soft); }
    .strategy-card { display:grid; gap: 10px; }
    .strategy-head, .source-head { display:flex; justify-content:space-between; gap: 10px; align-items:flex-start; }
    .strategy-head strong, .source-head strong { display:block; font-size: 14px; }
    .strategy-head span, .source-head span { display:block; margin-top: 3px; color: var(--muted); font-size: 12px; }
    .mini-stats { display:grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .mini-stats div { background: var(--panel-2); border-radius: 6px; padding: 8px; }
    .mini-stats span { display:block; color: var(--muted); font-size: 11px; }
    .mini-stats strong { display:block; margin-top: 4px; font-size: 14px; }
    .spark { height: 28px; display:flex; align-items:flex-end; gap: 3px; }
    .spark i { flex: 1; min-width: 4px; border-radius: 99px 99px 0 0; background: linear-gradient(180deg, #18c8d2, #0a8c96); }
    .source-card { display:grid; gap: 10px; border-left: 3px solid var(--accent); }
    .source-card.off { border-left-color: var(--red); }
    .source-meta { display:grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .source-meta div { background: var(--panel-2); border-radius: 6px; padding: 8px; font-size: 12px; }
    .source-meta span { display:block; color: var(--muted); font-size: 11px; margin-bottom: 4px; }
    .note-cell { min-width: 160px; white-space: normal; color: var(--muted); font-size: 12px; line-height: 1.45; }
    .order-event { margin-top: 5px; padding-top: 5px; border-top: 1px solid var(--line); color: var(--muted); font-size: 12px; line-height: 1.45; }
    .ticket-thread { display:grid; gap: 5px; min-width: 180px; max-width: 340px; }
    .ticket-msg { border:1px solid var(--line); border-radius:6px; background:#f8fafc; padding:7px; color:var(--muted); font-size:12px; line-height:1.45; }
    .ticket-msg b { display:block; color:var(--ink); font-size:11px; margin-bottom:2px; }
    .ticket-msg.admin { border-color:rgba(18,198,208,.28); background:#f4fbfc; }
    .ticket-msg.system { border-color:rgba(183,121,31,.22); background:#fffdf5; }
    .order-event b { color: var(--ink); }
    .copy-row { display:flex; gap: 8px; align-items:center; min-width:0; }
    .copy-row code { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; background:#f8fafc; border:1px solid var(--line); border-radius:6px; padding:8px; font-size: 12px; }
    .revenue-stack { display:grid; gap: 12px; }
    .revenue-total { display:flex; justify-content:space-between; align-items:flex-end; gap: 14px; }
    .revenue-total strong { font-size: 28px; }
    .mix-row { display:grid; grid-template-columns: 52px minmax(0, 1fr) 56px; gap: 8px; align-items:center; font-size: 12px; color: var(--muted); }
    .bar { height: 8px; background: #edf2f7; border-radius: 99px; overflow:hidden; }
    .bar i { display:block; height: 100%; background: linear-gradient(90deg, var(--accent), var(--blue)); border-radius: 99px; }
    .mobile-dock { display:none; }
    .mobile-list { display:none; }
    .mobile-quick { display:none; }
    .signal-card { border:1px solid var(--line); border-radius: 8px; background:#fff; padding: 12px; display:grid; gap: 10px; box-shadow: var(--shadow-soft); }
    .signal-card-head { display:flex; justify-content:space-between; gap: 10px; align-items:flex-start; }
    .signal-card-head strong { display:block; font-size: 15px; }
    .signal-card-head span { display:block; margin-top: 3px; font-size: 12px; color: var(--muted); }
    .signal-card-grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .signal-card-grid div { background: var(--panel-2); border-radius: 6px; padding: 8px; min-width: 0; }
    .signal-card-grid span { display:block; color: var(--muted); font-size: 11px; font-weight: 800; margin-bottom: 3px; }
    .signal-card-grid strong { display:block; font-size: 13px; word-break: break-word; }
    .record-card { border:1px solid var(--line); border-radius:8px; background:#fff; padding:12px; display:grid; gap:10px; box-shadow: var(--shadow-soft); }
    .record-card-head { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; }
    .record-card-head strong { display:block; font-size:15px; line-height:1.3; }
    .record-card-head span { display:block; margin-top:3px; color:var(--muted); font-size:12px; line-height:1.4; }
    .record-meta { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
    .record-meta div { background:var(--panel-2); border-radius:6px; padding:8px; min-width:0; }
    .record-meta span { display:block; color:var(--muted); font-size:11px; font-weight:800; margin-bottom:3px; }
    .record-meta strong { display:block; font-size:13px; line-height:1.35; word-break:break-word; }
    .record-note { border-top:1px solid var(--line); padding-top:8px; color:var(--muted); font-size:12px; line-height:1.45; }
    .event-list { display:grid; gap: 10px; }
    .event-card { border:1px solid var(--line); border-radius:8px; padding:12px; background:#fff; display:grid; gap:10px; box-shadow: var(--shadow-soft); border-left:3px solid var(--blue); }
    .event-card.high { border-left-color: var(--red); }
    .event-card.medium { border-left-color: var(--amber); }
    .event-card.low { border-left-color: var(--green); }
    .event-card-head { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; }
    .event-card-head strong { display:block; font-size:14px; line-height:1.35; }
    .event-card-head span { display:block; margin-top:3px; color:var(--muted); font-size:12px; }
    .event-meta { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap:8px; }
    .event-meta div { background:var(--panel-2); border-radius:6px; padding:8px; min-width:0; }
    .event-meta span { display:block; color:var(--muted); font-size:11px; font-weight:800; margin-bottom:3px; }
    .event-meta strong { display:block; font-size:13px; word-break:break-word; }
    .admin-modal { position: fixed; inset: 0; display:none; place-items:center; z-index: 80; padding: 18px; background: rgba(8, 14, 22, .46); backdrop-filter: blur(8px); }
    .admin-modal.open { display:grid; }
    .admin-modal-card { width: min(460px, 100%); border-radius: 10px; border:1px solid var(--line); background:#fff; box-shadow: 0 24px 70px rgba(15,23,42,.28); overflow:hidden; }
    .admin-modal-card header { padding: 16px; border-bottom:1px solid var(--line); }
    .admin-modal-card h3 { margin:0; font-size: 17px; }
    .admin-modal-card p { margin:6px 0 0; color:var(--muted); font-size: 13px; line-height:1.45; }
    .admin-modal-body { padding: 16px; display:grid; gap: 12px; }
    .check-row { display:flex; align-items:center; gap: 8px; color: var(--muted); font-size: 13px; }
    .check-row input { width:auto; min-height: unset; }
    .admin-modal-actions { padding: 12px 16px 16px; display:flex; gap: 8px; justify-content:flex-end; }
    .admin-foot { margin-top: auto; border: 1px solid rgba(255,255,255,.11); border-radius: 8px; padding: 12px; background: rgba(255,255,255,.05); }
    .admin-foot strong { display:block; font-size: 13px; }
    .admin-foot span { display:block; color:#90a8ba; font-size: 12px; margin-top: 4px; }
    .danger-zone { border-color: rgba(209,67,63,.25); background: #fffafa; }
    @media (max-width: 980px) {
      .shell { grid-template-columns: 1fr; }
      .sidebar { position: sticky; top: 0; z-index: 20; padding: 10px; gap: 10px; }
      .brand { padding-bottom: 8px; }
      .nav { display: flex; overflow-x: auto; gap: 6px; padding-bottom: 2px; -webkit-overflow-scrolling: touch; }
      .nav button { min-width: 92px; justify-content: center; min-height: 42px; padding: 0 12px; }
      .nav small { display: none; }
      .grid.two, .grid.three, .kpis { grid-template-columns: 1fr; }
      .topbar { grid-template-columns: 1fr; height: auto; min-height: 60px; align-items:stretch; padding: 12px 16px; }
      .content { padding: 16px; }
      .ops-hero { grid-template-columns: 1fr; }
      .ops-summary { min-width: 0; }
      .ops-health-grid { grid-template-columns: 1fr; }
    }
	    @media (max-width: 680px) {
	      .main { width: 100vw; max-width: 100vw; overflow-x: hidden; }
	      .content, .view, .grid, .panel, .table-wrap { width: 100%; max-width: 100%; }
	      .sidebar { display:flex; flex-direction: row; align-items:center; justify-content:space-between; padding: 8px 10px; gap: 8px; }
	      .brand { display:flex; border-bottom:0; padding:0; min-width:0; }
	      .brand span { display:none; }
	      .brand strong { font-size: 13px; white-space: nowrap; }
	      .mark { width: 34px; height: 34px; }
	      .nav { display: none; }
	      .admin-foot { display:none; }
      body { background:#eef3f7; }
      .shell { min-height:100svh; }
      .main { background:linear-gradient(180deg,#f8fbfd 0%,#edf3f8 100%); }
      .content { padding: 12px 12px calc(96px + env(safe-area-inset-bottom)); gap: 12px; }
      .topbar { padding: 10px 12px; gap: 10px; border-bottom-color:rgba(203,213,225,.72); }
      .topbar h1 { font-size: 18px; }
      .topbar .status { gap: 6px; }
      .topbar .pill { min-height: 26px; padding: 3px 8px; font-size: 11px; }
      .topbar .status .btn { flex: 1 1 calc(50% - 4px); min-height: 40px; text-align: center; justify-content: center; text-decoration: none; }
      .command-search input { min-height: 44px; }
      .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .kpi { min-height: 68px; padding: 10px; }
      .kpi .kpi-icon { width: 26px; height: 26px; margin-bottom: 6px; }
      .kpi strong { font-size: 21px; }
      .ops-hero { padding: 14px; }
      .ops-hero h2 { font-size: 20px; }
      .ops-hero p { display:none; }
      .ops-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .range-toolbar { grid-template-columns: 1fr; padding: 12px; }
      .range-fields { grid-template-columns: 1fr; }
      .range-actions { justify-content:stretch; }
      .range-actions .btn { flex: 1 1 calc(50% - 4px); }
      .analytics-grid, .metric-grid, .delivery-grid, .delivery-metrics { grid-template-columns: 1fr; }
      .rank-row { grid-template-columns: 76px minmax(0,1fr); }
      .rank-row span { grid-column: 1 / -1; }
      .mobile-quick { display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
      .mobile-quick button { border:1px solid var(--line); border-radius:8px; background:#fff; min-height:54px; padding:7px 5px; color:var(--ink); font-size:12px; font-weight:850; box-shadow: var(--shadow-soft); display:grid; place-items:center; gap:3px; }
      .mobile-quick button::before { content: attr(data-icon); color:var(--accent-2); font-size:15px; font-weight:900; line-height:1; }
      .view.active { gap: 12px; animation: viewIn .18s ease-out; }
      @keyframes viewIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
      body:not([data-admin-view="overview"]) .content { padding-top: 10px; }
      .panel header { align-items:flex-start; flex-direction:column; min-height: unset; }
      .panel header h2 { font-size: 16px; }
      .panel { border-color:rgba(203,213,225,.88); box-shadow:0 8px 22px rgba(15,23,42,.055); }
      .panel header { background:#fff; }
      .panel-tools { width:100%; align-items:stretch; }
      .panel-tools .btn { flex:1 1 120px; justify-content:center; }
      #signalAnalyticsBadge { display:flex; flex-wrap:wrap; gap:6px; }
      .panel .body { padding: 12px; }
      .form-grid { grid-template-columns: 1fr; }
      .card-grid.two, .mini-stats, .source-meta { grid-template-columns: 1fr; }
      .event-meta { grid-template-columns: 1fr; }
      .record-meta { grid-template-columns: 1fr; }
      input, select, textarea, .btn, .seg button { min-height: 44px; }
      .actions { align-items: stretch; }
      .actions .btn { flex: 1 1 120px; }
      .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .table-wrap table { min-width: 680px; }
      th, td { padding: 10px; }
      .has-mobile-cards .table-wrap { display:none; }
      .mobile-list { display:grid; gap: 10px; }
      .mobile-list .source-card, .mobile-list .record-card, .mobile-list .signal-card, .mobile-list .strategy-card { border-radius: 10px; }
      .signal-card-grid { grid-template-columns: 1fr; }
      .message { left: 12px; right: 12px; bottom: calc(82px + env(safe-area-inset-bottom)); max-width: none; }
      .mobile-dock { position: fixed; left: 8px; right: 8px; bottom: calc(8px + env(safe-area-inset-bottom)); display:flex; gap: 4px; padding: 7px; border:1px solid rgba(255,255,255,.45); border-radius: 16px; background: rgba(8,16,28,.94); backdrop-filter: blur(18px); z-index: 30; box-shadow: 0 18px 40px rgba(0,0,0,.25); overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; scroll-snap-type:x mandatory; }
      .mobile-dock::-webkit-scrollbar { display: none; }
	      .mobile-dock button { border:0; background: transparent; color:#a9bdc9; display:grid; place-items:center; gap: 3px; min-height: 50px; min-width: 60px; border-radius: 10px; font-size: 11px; font-weight: 800; scroll-snap-align:start; }
	      .mobile-dock button::before { content: attr(data-icon); display:block; color:#7af5ff; font-size: 13px; font-weight: 900; line-height: 1; }
	      .mobile-dock button.active { background: linear-gradient(180deg,rgba(18,198,208,.22),rgba(49,87,216,.18)); color: #f8feff; box-shadow: inset 0 0 0 1px rgba(122,245,255,.20); }
	    }
  </style>
</head>
<body data-admin-view="overview">
  <div class="shell">
    <aside class="sidebar">
      <div class="brand"><div class="mark">DC</div><div><strong>DC SIGNALS</strong><span>營運控制台</span></div></div>
      <nav class="nav" id="nav">
        <button data-view="overview" data-icon="⌂" class="active">總覽 <small>⌘1</small></button>
        <button data-view="signals" data-icon="↗">訊號工作台</button>
        <button data-view="strategies" data-icon="◇">策略實驗室</button>
        <button data-view="tradingview" data-icon="TV">TradingView</button>
        <button data-view="events" data-icon="!">經濟事件</button>
        <button data-view="symbols" data-icon="▦">品種管理</button>
        <button data-view="users" data-icon="◎">會員管理</button>
        <button data-view="orders" data-icon="$">訂單管理</button>
        <button data-view="support" data-icon="?">客服工單</button>
        <button data-view="billing" data-icon="⚙">收費設定</button>
      </nav>
      <div class="admin-foot"><strong>Dan_mix</strong><span>超級管理員</span></div>
    </aside>
    <main class="main">
      <div class="topbar">
        <div><h1 id="adminViewTitle">營運總覽</h1><div class="muted" id="serverTime">載入中</div></div>
        <div class="command-search"><span>⌕</span><input id="commandSearch" placeholder="搜尋訊號、會員、訂單、客服、品種、策略、TV"></div>
        <div class="status">
          <span class="pill"><span class="dot"></span>Worker 線上</span>
          <span class="pill" id="dbPill">D1 連線中</span>
          <button class="btn ghost" id="refreshBtn" type="button">重新整理</button>
          <a class="btn ghost" href="/admin/logout">登出</a>
        </div>
      </div>
      <section class="content">
        <section class="ops-hero overview-only">
          <div>
            <h2>營運總覽</h2>
            <p>交易訊號、TradingView alert、會員收費與策略風控集中在同一個可行動工作台。</p>
          </div>
          <div class="ops-summary" id="opsSummary"></div>
        </section>
        <section class="mobile-quick overview-only" aria-label="手機快速操作">
          <button type="button" data-view-target="signals" data-icon="↗">發訊</button>
          <button type="button" data-view-target="tradingview" data-icon="TV">TV</button>
          <button type="button" data-view-target="events" data-icon="!">事件</button>
          <button type="button" data-view-target="orders" data-icon="$">訂單</button>
          <button type="button" data-view-target="users" data-icon="◎">會員</button>
          <button type="button" data-view-target="support" data-icon="?">客服</button>
          <button type="button" data-view-target="strategies" data-icon="◇">策略</button>
          <button type="button" data-view-target="billing" data-icon="⚙">收費</button>
        </section>
        <section class="range-toolbar overview-only" aria-label="資料日期範圍">
          <div class="range-fields">
            <div><label>開始日期</label><input id="dateRangeStart" type="date"></div>
            <div><label>結束日期</label><input id="dateRangeEnd" type="date"></div>
            <div><label>載入筆數上限</label><select id="dateRangeLimit"><option value="300">300 筆</option><option value="500">500 筆</option><option value="1000">1000 筆</option></select></div>
          </div>
          <div>
            <div class="range-actions">
              <button class="btn ghost" type="button" data-range-preset="7">7天</button>
              <button class="btn ghost" type="button" data-range-preset="30">30天</button>
              <button class="btn ghost" type="button" data-range-preset="90">90天</button>
              <button class="btn ghost" type="button" data-range-preset="all">全部</button>
              <button class="btn primary" type="button" id="dateRangeApply">套用</button>
            </div>
            <div class="range-summary" id="dateRangeSummary">近 30 天資料</div>
          </div>
        </section>
        <section class="panel overview-only">
          <header><div><h2>營運健康檢查</h2><p>正式販售前後都要看的風險佇列</p></div><div id="opsHealthBadge"></div></header>
          <div class="body"><div class="ops-health-grid" id="opsHealthGrid"></div></div>
        </section>
        <div class="kpis overview-only" id="kpis"></div>
        <section class="panel overview-only">
          <header><div><h2>訊號統計儀表板</h2><p>依上方日期區間計算訊號、結算、TP 命中與績效</p></div><div class="panel-tools"><div id="signalAnalyticsBadge"></div><button class="btn ghost" type="button" id="rebuildPerformanceBtn">重建績效</button></div></header>
          <div class="body"><div id="signalAnalyticsDashboard"></div></div>
        </section>
        <div class="view active" id="view-overview">
          <div class="grid two">
            <section class="panel has-mobile-cards"><header><div><h2>即時訊號隊列</h2><p>草稿、已發送與待結案</p></div><div class="panel-tools"><button class="btn ghost" data-view-target="signals" type="button">查看全部</button></div></header><div class="table-wrap"><table><thead><tr><th>時間</th><th>品種</th><th>方向</th><th>價格</th><th>狀態</th><th></th></tr></thead><tbody id="recentSignals"></tbody></table></div><div class="mobile-list" id="recentSignalsCards"></div></section>
            <section class="panel"><header><div><h2>策略健康度</h2><p>風控規則與近期訊號覆蓋</p></div><button class="btn ghost" data-view-target="strategies" type="button">策略</button></header><div class="body"><div class="card-grid" id="strategyHealth"></div></div></section>
          </div>
          <div class="grid two">
            <section class="panel"><header><div><h2>TradingView Gateway</h2><p>來源狀態與 webhook 就緒度</p></div><button class="btn ghost" data-view-target="tradingview" type="button">設定</button></header><div class="body"><div class="card-grid" id="tvGateway"></div></div></section>
            <section class="panel"><header><div><h2>會員營收概況</h2><p>訂閱組成與待處理訂單</p></div><button class="btn ghost" data-view-target="billing" type="button">收費</button></header><div class="body"><div id="revenueSummary"></div></div></section>
          </div>
          <div class="grid">
            <section class="panel"><header><div><h2>今日重要經濟事件</h2><p>數據公布前後提醒會員控管點差與滑價</p></div><div class="panel-tools"><button class="btn ghost" data-view-target="events" type="button">事件管理</button></div></header><div class="body"><div class="event-list" id="overviewEconomicEvents"></div></div></section>
          </div>
          <div class="grid two">
            <section class="panel has-mobile-cards"><header><h2>待處理訂單</h2><button class="btn ghost" data-view-target="orders" type="button">查看訂單</button></header><div class="table-wrap"><table><thead><tr><th>訂單</th><th>用戶</th><th>方案</th><th>金額</th><th></th></tr></thead><tbody id="pendingOrders"></tbody></table></div><div class="mobile-list" id="pendingOrdersCards"></div></section>
            <section class="panel has-mobile-cards"><header><h2>最新 Alert 日誌</h2><button class="btn ghost" data-view-target="tradingview" type="button">查看全部</button></header><div class="table-wrap"><table><thead><tr><th>時間</th><th>來源</th><th>訊號</th><th>狀態</th></tr></thead><tbody id="overviewTvLogs"></tbody></table></div><div class="mobile-list" id="overviewTvLogsCards"></div></section>
          </div>
        </div>
        <div class="view" id="view-signals">
          <div class="grid two"><section class="panel"><header><div><h2>快速發訊</h2><p>手動建立訊號或儲存草稿</p></div><span class="chip green" id="signalMode">即時發送</span></header><div class="body">${renderSignalFormHtml()}</div></section><section class="panel has-mobile-cards"><header><div><h2>訊號工作台</h2><p>審核草稿、發送、結案與取消</p></div><div class="filter-tabs" id="signalFilters"><button data-filter="all" class="active">全部</button><button data-filter="pending">草稿</button><button data-filter="active">已發送</button><button data-filter="closed">結案</button><button data-filter="cancelled">取消</button></div></header><div class="table-wrap"><table><thead><tr><th>時間</th><th>UID</th><th>品種</th><th>方向</th><th>類型</th><th>進場/止損/目標</th><th>圖表</th><th>發送</th><th>狀態</th><th></th></tr></thead><tbody id="signalsTable"></tbody></table></div><div class="mobile-list" id="signalsCards"></div></section></div>
          <section class="panel"><header><div><h2>清理過時訊號</h2><p>刪除草稿、結案或取消紀錄；進行中訊號需先結案</p></div></header><div class="body stack"><div class="form-grid"><div><label>早於日期</label><input type="date" id="purgeSignalsBefore"></div><div><label>可清理狀態</label><input id="purgeSignalsStatuses" value="closed,cancelled" placeholder="closed,cancelled,pending"></div><div><label>最多筆數</label><input id="purgeSignalsLimit" inputmode="numeric" value="300"></div></div><div class="actions"><button class="btn ghost" type="button" id="previewPurgeSignalsBtn">預覽清理</button><button class="btn danger" type="button" id="purgeSignalsBtn">刪除過時紀錄</button></div><div class="preview signal-preview" id="purgeSignalsPreview"><b>尚未預覽</b><div>預設只處理 90 天以前的結案與取消訊號。</div></div></div></section>
        </div>
        <div class="view" id="view-strategies"><div class="grid two"><section class="panel has-mobile-cards"><header><h2>策略列表</h2></header><div class="table-wrap"><table><thead><tr><th>排序</th><th>策略</th><th>等級</th><th>品種</th><th>狀態</th><th></th></tr></thead><tbody id="strategiesTable"></tbody></table></div><div class="mobile-list" id="strategiesCards"></div></section><section class="panel"><header><h2>新增/更新策略</h2></header><div class="body">${renderStrategyFormHtml()}</div></section></div></div>
        <div class="view" id="view-tradingview">${renderTradingViewHtml()}</div>
        <div class="view" id="view-events">${renderEconomicEventsHtml()}</div>
        <div class="view" id="view-economic">${renderEconomicHtml()}</div>
        <div class="view" id="view-symbols"><div class="grid two"><section class="panel has-mobile-cards"><header><h2>品種列表</h2></header><div class="table-wrap"><table><thead><tr><th>排序</th><th>代碼</th><th>名稱</th><th>分類</th><th>Tick</th><th>預設SL/TP</th><th>狀態</th><th></th></tr></thead><tbody id="symbolsTable"></tbody></table></div><div class="mobile-list" id="symbolsCards"></div></section><section class="panel"><header><h2>新增/更新品種</h2></header><div class="body">${renderSymbolFormHtml()}</div></section></div></div>
        <div class="view" id="view-users"><div class="user-workbench"><section class="panel"><header><div><h2>會員管理儀表板</h2><p>會員資格、登入綁定、通知與訂閱狀態集中管理</p></div><div id="usersBadge"></div></header><div class="body stack"><div class="metric-grid" id="usersDashboard"></div><div class="user-filter-panel"><div class="filter-tabs" id="userFilters"><button data-user-filter="all" class="active">全部</button><button data-user-filter="paid">付費</button><button data-user-filter="vip">VIP</button><button data-user-filter="pro">Pro</button><button data-user-filter="expiring">7天到期</button><button data-user-filter="no-tg">未綁TG</button><button data-user-filter="paused">暫停接收</button><button data-user-filter="banned">封禁</button></div><span class="muted">目前載入最多依日期工具列筆數</span></div></div></section><section class="panel has-mobile-cards"><header><h2>會員維護</h2><span class="muted">可搜尋 ID、名稱、Email、Telegram、品種、備註</span></header><div class="table-wrap"><table><thead><tr><th>用戶</th><th>等級</th><th>到期/登入</th><th>訂閱設定</th><th>消費/狀態</th><th></th></tr></thead><tbody id="usersTable"></tbody></table></div><div class="mobile-list" id="usersCards"></div></section></div></div>
        <div class="view" id="view-orders"><section class="panel has-mobile-cards"><header><h2>訂單維護</h2></header><div class="table-wrap"><table><thead><tr><th>時間</th><th>訂單</th><th>用戶</th><th>方案</th><th>金額</th><th>付款備註</th><th>狀態</th><th></th></tr></thead><tbody id="ordersTable"></tbody></table></div><div class="mobile-list" id="ordersCards"></div></section></div>
        <div class="view" id="view-support"><section class="panel has-mobile-cards"><header><div><h2>客服工單</h2><p>會員問題、付款協助與售後追蹤</p></div><div id="supportBadge"></div></header><div class="table-wrap"><table><thead><tr><th>更新</th><th>工單</th><th>會員</th><th>主旨</th><th>最近內容</th><th>狀態</th><th></th></tr></thead><tbody id="supportTable"></tbody></table></div><div class="mobile-list" id="supportCards"></div></section></div>
        <div class="view" id="view-billing"><section class="panel"><header><h2>收費、付款與系統設定</h2></header><div class="body">${renderConfigFormHtml()}</div></section></div>
        <div class="message" id="message"></div>
      </section>
    </main>
  </div>
  <div class="admin-modal" id="adminModal" aria-hidden="true"></div>
	  <nav class="mobile-dock" id="mobileDock">
	    <button data-view-target="overview" data-icon="⌂" class="active">總覽</button>
	    <button data-view-target="signals" data-icon="↗">訊號</button>
	    <button data-view-target="strategies" data-icon="◇">策略</button>
	    <button data-view-target="tradingview" data-icon="▣">TV</button>
	    <button data-view-target="events" data-icon="!">事件</button>
	    <button data-view-target="symbols" data-icon="▦">品種</button>
	    <button data-view-target="users" data-icon="◎">會員</button>
	    <button data-view-target="orders" data-icon="$">訂單</button>
	    <button data-view-target="support" data-icon="?">客服</button>
	    <button data-view-target="billing" data-icon="⚙">收費</button>
	  </nav>
  <script>${renderAdminCoreScript()}</script>
  <script>window.ADMIN_CSRF_TOKEN=${JSON.stringify(csrfToken || '')};</script>
  <script>${renderAdminScript()}</script>
</body>
</html>`;
}

function renderSignalFormHtml() {
  return `<form id="signalForm" class="stack">
    <div class="form-grid">
	      <div><label>品種</label><select name="ticker" id="signalTicker" disabled><option value="">載入品種中...</option></select></div>
      <div><label>方向</label><div class="seg"><button type="button" class="active" data-action="LONG">做多</button><button type="button" data-action="SHORT">做空</button></div><input type="hidden" name="action" value="LONG"></div>
      <div><label>訊號類型</label><select name="signal_type"><option value="scalp">短線</option><option value="swing">波段</option><option value="daytrade">日內</option></select></div>
      <div><label>目標</label><select name="target_group"><option value="all">全部付費會員</option><option value="pro">Pro 以上</option><option value="vip">VIP 專屬</option></select></div>
      <div><label>進場</label><input name="entry_price" inputmode="decimal" required></div>
      <div><label>止損</label><input name="stop_loss" inputmode="decimal" required></div>
      <div><label>TP1</label><input name="tp1" inputmode="decimal" required></div>
      <div><label>TP2</label><input name="tp2" inputmode="decimal"></div>
      <div><label>TP3</label><input name="tp3" inputmode="decimal"></div>
      <div><label>機率 %（選填）</label><input name="probability" inputmode="decimal" placeholder="例如 68"></div>
      <div><label>發送模式</label><select name="send"><option value="true">立即發送</option><option value="false">只存草稿</option></select></div>
      <div class="full"><label>TradingView 圖表 URL</label><input name="chart_url" inputmode="url" placeholder="https://www.tradingview.com/chart/..."></div>
      <div class="full"><label>Telegram 截圖 / 快照 URL</label><input name="snapshot_url" inputmode="url" placeholder="https://... 可公開讀取的圖片 URL"></div>
      <div class="full"><label>備註</label><textarea name="note" placeholder="盤勢、策略、風險提醒"></textarea></div>
    </div>
    <div class="preview signal-preview warn" id="signalPreview">載入品種後可建立訊號。</div>
	    <div class="actions"><button class="btn primary" id="createSignalBtn" type="submit" disabled>建立訊號</button><button class="btn ghost" data-admin-test-signal type="button">測試發給管理員</button><button class="btn ghost" type="reset">清空</button></div>
	  </form>`;
}

function renderStrategyFormHtml() {
  return `<form id="strategyForm" class="stack">
    <div class="form-grid">
      <div><label>策略 ID</label><input name="strategy_id" placeholder="scalp-core"></div>
      <div><label>排序</label><input name="sort_order" inputmode="numeric" value="0"></div>
      <div class="full"><label>策略名稱</label><input name="name" required></div>
      <div><label>可用等級</label><select name="tier"><option value="pro">Pro</option><option value="vip">VIP</option><option value="free">Free</option></select></div>
      <div><label>狀態</label><select name="is_active"><option value="true">啟用</option><option value="false">停用</option></select></div>
      <div><label>訊號類型</label><input name="signal_types" placeholder="scalp,swing"></div>
      <div><label>品種</label><input name="symbols" placeholder="NQ,ES,GC"></div>
      <div class="full"><label>描述</label><textarea name="description"></textarea></div>
      <div class="full"><label>風控規則 JSON</label><textarea class="copybox" name="rules_json" placeholder='{"riskPoints":30,"targetR":[1,2,3],"entryMode":"close"}'></textarea></div>
      <div class="full"><label>TradingView 現有策略 Alert 範本</label><textarea class="copybox" name="tv_alert_template" placeholder='{"secret":"{{secret}}","strategy":"auto","ticker":"{{ticker}}","action":"{{strategy.order.action}}","order_price":"{{strategy.order.price}}","order_id":"{{strategy.order.id}}","market_position":"{{strategy.market_position}}","time":"{{time}}","interval":"{{interval}}"}'></textarea></div>
      <div class="full"><label>維護備註</label><textarea name="note"></textarea></div>
    </div>
    <button class="btn primary" type="submit">儲存策略</button>
  </form>`;
}

function renderTradingViewHtml() {
  return `<div class="grid">
    <section class="panel">
      <header>
        <div><h2>訊號投遞診斷中心</h2><p>追蹤 TV webhook、點位解析、TG 背景派送與管理員測試</p></div>
        <div class="panel-tools"><button class="btn ghost" type="button" id="deliveryRefreshBtn">刷新診斷</button><button class="btn primary" data-admin-test-signal type="button">測試發給管理員</button></div>
      </header>
      <div class="body">
        <div class="delivery-grid">
          <div class="stack">
            <div class="delivery-metrics" id="deliveryMetrics"></div>
            <div class="preview" id="adminTestResult"><b>尚未測試</b><div>填好左側快速發訊欄位後，可只發給 ADMIN_IDS 驗證 TG 延遲與格式，不會通知會員。</div></div>
          </div>
          <div class="delivery-list" id="deliveryDiagnostics"></div>
        </div>
      </div>
    </section>
  </div>
  <div class="grid">
    <section class="panel">
      <header><div><h2>TradingView Gateway</h2><p>多來源 webhook、secret、策略與發送模式</p></div><button class="btn primary" type="button" data-copy="tv-current">複製目前 Webhook</button></header>
      <div class="body"><div class="card-grid two" id="tvSourceCards"></div></div>
    </section>
  </div>
  <div class="grid">
    <section class="panel has-mobile-cards">
      <header><div><h2>Auto Trade Bridge</h2><p>TradingView 訊號轉成 Exness / MT5 交易指令</p></div><div id="autoTradeBadge"></div></header>
      <div class="body">${renderAutoTradeHtml()}</div>
    </section>
  </div>
  <div class="grid two">
    <section class="panel has-mobile-cards">
      <header><div><h2>來源維護</h2><p>新增/更新 TradingView alert 來源</p></div></header>
      <div class="table-wrap"><table><thead><tr><th>來源</th><th>策略</th><th>品種</th><th>目標</th><th>模式</th><th></th></tr></thead><tbody id="tvSourcesTable"></tbody></table></div>
      <div class="mobile-list" id="tvSourcesMobile"></div>
      <div class="body">${renderTradingViewSourceFormHtml()}</div>
    </section>
    <section class="panel">
	      <header><div><h2>AlgoPro Alert 產生器</h2><p>依方向產生指標 Buy/Sell alert；AUTO 才用 Strategy Order fills</p></div></header>
      <div class="body">${renderTradingViewGeneratorHtml()}</div>
    </section>
    <section class="panel" style="grid-column:1/-1">
      <header><div><h2>TV Bot 清單智慧匯入</h2><p>貼上 TradingView alert / bot 清單，系統會自動辨識品種並合併到來源設定</p></div><button class="btn ghost" type="button" id="tvCopyScanHelperBtn">複製掃描助手</button></header>
      <div class="body stack">
        <textarea class="copybox" id="tvImportText" placeholder="在 TradingView Alerts / Bots 清單頁執行掃描助手後貼上，或直接貼上清單文字。"></textarea>
        <div class="actions"><button class="btn primary" type="button" id="tvSmartImportBtn">智慧新增清單</button><button class="btn ghost" type="button" id="tvClearImportBtn">清空</button></div>
        <div class="preview" id="tvImportPreview"><b>尚未匯入</b><div>可辨識 ETHUSDT/ETHUSD、USTEC/US100/NAS100、XAUUSD/GOLD、NQ/ES/GC/CL 等常見寫法。</div></div>
      </div>
    </section>
    <section class="panel has-mobile-cards" style="grid-column:1/-1">
      <header><h2>Alert 日誌</h2></header>
      <div class="table-wrap"><table><thead><tr><th>時間</th><th>來源</th><th>策略</th><th>品種</th><th>方向</th><th>狀態</th><th>訊號</th></tr></thead><tbody id="tvLogsTable"></tbody></table></div>
      <div class="mobile-list" id="tvLogsMobile"></div>
    </section>
  </div>`;
}

function renderAutoTradeHtml() {
  return `<div class="grid two">
    <div class="stack">
      <div class="card-grid two" id="autoTradeCards"></div>
      <div class="table-wrap"><table><thead><tr><th>時間</th><th>訊號</th><th>品種</th><th>模式</th><th>口數</th><th>狀態</th></tr></thead><tbody id="autoTradeTable"></tbody></table></div>
      <div class="mobile-list" id="autoTradeMobile"></div>
    </div>
    <form id="autoTradeForm" class="stack">
      <div class="form-grid">
        <div><label>自動交易</label><select name="auto_trade_enabled"><option value="0">關閉</option><option value="1">啟用</option></select></div>
        <div><label>模式</label><select name="auto_trade_mode"><option value="paper">Paper 測試</option><option value="live">Live 實單</option></select></div>
        <div class="full"><label>Bridge URL</label><input name="auto_trade_bridge_url" inputmode="url" placeholder="外部 bridge 才需要；MT5 EA 輪詢可留空"></div>
        <div class="full"><label>Bridge Secret</label><input name="auto_trade_bridge_secret" type="password" autocomplete="off" placeholder="用於 HMAC 簽章"></div>
        <div><label>交易帳號標籤</label><input name="auto_trade_account" placeholder="Exness MT5 #..."></div>
        <div><label>預設口數</label><input name="auto_trade_default_volume" inputmode="decimal" placeholder="0.01"></div>
        <div><label>單筆風險 %</label><input name="auto_trade_risk_percent" inputmode="decimal" placeholder="1"></div>
        <div><label>每日上限</label><input name="auto_trade_max_orders_per_day" inputmode="numeric" placeholder="20"></div>
        <div class="full"><label>允許自動交易品種</label><input name="auto_trade_allowed_symbols" placeholder="XAUUSD,USTEC,NQ,ETH；空白代表全部"></div>
        <div class="full"><label>允許自動交易策略</label><input name="auto_trade_allowed_strategies" placeholder="algo-pro-v1-4；空白代表全部"></div>
      </div>
      <div class="health-card warning"><strong>正式交易保護</strong><p>Worker 只產生受控指令，不保存券商密碼。Exness 使用 MT5 EA 輪詢 /auto-trade/poll 後執行，或由你自己的 bridge 接收 webhook。</p><small>建議先 Paper 測通，再切 Live。MT5 EA 請把本網站加入 WebRequest 允許清單。</small></div>
      <div class="actions"><button class="btn primary" type="submit">儲存自動交易設定</button></div>
    </form>
  </div>`;
}

function renderTradingViewSourceFormHtml() {
  return `<form id="tvSourceForm" class="stack">
    <div class="form-grid">
      <div><label>來源 ID</label><input name="source_id" placeholder="default-tv"></div>
      <div><label>來源名稱</label><input name="name" placeholder="Main NQ Alerts"></div>
      <div class="full"><label>Secret</label><input name="webhook_secret" placeholder="留空會自動產生"></div>
      <div><label>預設策略</label><select name="default_strategy_id" id="tvDefaultStrategy"></select></div>
      <div><label>訊號類型</label><select name="default_signal_type"><option value="auto">自動</option><option value="scalp">短線</option><option value="daytrade">日內</option><option value="swing">波段</option></select></div>
      <div><label>發送目標</label><select name="target_group"><option value="pro">Pro 以上</option><option value="vip">VIP 專屬</option><option value="all">全部付費會員</option></select></div>
      <div><label>接收模式</label><select name="auto_send"><option value="true">自動發送</option><option value="false">先存草稿</option></select></div>
      <div><label>狀態</label><select name="is_active"><option value="true">啟用</option><option value="false">停用</option></select></div>
      <div class="full"><label>允許品種</label><input name="allowed_symbols" placeholder="NQ,ES,GC,CL"></div>
      <div class="full"><label>備註</label><textarea name="notes"></textarea></div>
    </div>
    <button class="btn primary" type="submit">儲存來源</button>
  </form>`;
}

function renderTradingViewGeneratorHtml() {
  return `<div class="stack">
    <div class="form-grid">
      <div><label>來源</label><select id="tvGenSource"></select></div>
      <div><label>策略</label><select id="tvGenStrategy"><option value="auto">自動選擇</option></select></div>
      <div><label>品種</label><select id="tvGenTicker"></select></div>
      <div><label>方向 / 模式</label><select id="tvGenAction"><option value="LONG">Buy Signal 做多</option><option value="SHORT">Sell Signal 做空</option><option value="AUTO">Strategy Order fills</option></select></div>
      <div><label>週期</label><input id="tvGenInterval" value="15"></div>
      <div><label>預覽價格</label><input id="tvGenPrice" inputmode="decimal" value="21500"></div>
      <div class="full"><label>Webhook URL</label><input class="readonly" id="tvWebhookUrl" readonly></div>
	      <div class="full"><label>TradingView Alert Message</label><textarea class="copybox readonly" id="tvAlertMessage" readonly></textarea></div>
    </div>
    <div class="preview" id="tvReadiness"></div>
    <div class="muted">TradingView 只要至少送入場、方向與品種，後端會優先使用 AlgoPro 指標實際 plot；若 SL/TP 沒抓到或只抓到局部價位，會依品種預設與策略規則自動補位後推送。AlgoPro V1.4 Add placeholder 順序已對應為 plot_5 Long SL、plot_6 Short SL、plot_7 Long TP、plot_8 Short TP，Message 也會帶 p0-p17 方便後續校正。</div>
    <div class="actions"><button class="btn primary" type="button" id="tvGenerateBtn">產生設定</button><button class="btn ghost" type="button" id="tvSmartConfigBtn">全部品種智慧設定</button><button class="btn ghost" type="button" data-copy-input="tvWebhookUrl">複製 Webhook</button><button class="btn ghost" type="button" data-copy-input="tvAlertMessage">複製 Message</button><button class="btn ghost" type="button" id="tvPreviewBtn">預覽點位</button><button class="btn ghost" type="button" id="tvFallbackPreviewBtn">測試補 SL/TP</button></div>
    <div class="preview" id="tvPreview"></div>
  </div>`;
}

function renderEconomicEventsHtml() {
  return `<div class="grid two">
    <section class="panel">
      <header>
        <div><h2>今日 / 近期事件</h2><p>只保留會明顯影響市場的事件，時間固定顯示台灣時間</p></div>
        <div class="panel-tools">
          <button class="btn ghost" type="button" id="syncEconomicBtn">同步來源</button>
          <button class="btn primary" type="button" id="sendEconomicBtn">推送提醒</button>
        </div>
      </header>
      <div class="body"><div class="event-list" id="economicEventCards"></div></div>
    </section>
    <section class="panel">
      <header><div><h2>新增 / 更新事件</h2><p>來源未設定時可手動維護今日重大數據</p></div></header>
      <div class="body">${renderEconomicEventFormHtml()}</div>
    </section>
  </div>
  <div class="grid two">
    <section class="panel">
      <header><div><h2>事件來源設定</h2><p>可接 JSON feed 或你自己的 TradingView calendar proxy</p></div></header>
      <div class="body">${renderEconomicConfigFormHtml()}</div>
    </section>
    <section class="panel">
      <header><div><h2>資料來源策略</h2><p>先穩定提醒，再視情況串 TV 資料</p></div></header>
      <div class="body stack">
        <div class="health-card info"><strong>最低成本做法</strong><p>用 JSON feed 同步事件，若來源對 Worker 回 429/403，系統會自動改用文字代理讀取 JSON，後台仍可人工補正。</p><small>避免直接抓 TradingView 動態頁面導致格式一改就壞。</small></div>
        <div class="health-card warning"><strong>TradingView 資料</strong><p>TradingView 經濟日曆適合作為人工核對來源；若要自動同步，建議另外做一個穩定 JSON proxy，再把 URL 貼到左側。</p><small>後端只認 JSON，避免在 Worker 解析完整網頁。</small></div>
      </div>
    </section>
  </div>`;
}

function renderEconomicEventFormHtml() {
  return `<form id="economicEventForm" class="stack">
    <div class="form-grid">
      <input type="hidden" name="event_uid">
      <div class="full"><label>事件名稱</label><input name="title" required placeholder="US Initial Jobless Claims"></div>
      <div><label>日期</label><input name="event_date" type="date"></div>
      <div><label>時間（台北）</label><input name="event_time" type="datetime-local"></div>
      <div><label>幣別</label><input name="currency" placeholder="USD"></div>
      <div><label>國家 / 地區</label><input name="country" placeholder="US"></div>
      <div><label>重要性</label><select name="impact"><option value="high">高</option><option value="medium">中</option><option value="low">低</option></select></div>
      <div><label>狀態</label><select name="status"><option value="scheduled">預定</option><option value="released">已公布</option><option value="cancelled">取消</option></select></div>
      <div><label>預期</label><input name="forecast"></div>
      <div><label>前值</label><input name="previous"></div>
      <div><label>實際</label><input name="actual"></div>
      <div class="full"><label>來源 URL</label><input name="source_url" inputmode="url"></div>
      <div class="full"><label>備註</label><textarea name="notes" placeholder="例如：美股開盤前公布，指數/黃金可能放大波動"></textarea></div>
    </div>
    <div class="actions"><button class="btn primary" type="submit">儲存事件</button><button class="btn ghost" type="reset">清空</button></div>
  </form>`;
}

function renderEconomicConfigFormHtml() {
  return `<form id="economicConfigForm" class="stack">
    <div class="form-grid">
      <div class="full"><label>JSON Feed URL</label><input name="economic_calendar_source_url" inputmode="url" placeholder="${DEFAULT_ECONOMIC_CALENDAR_SOURCE_URL}"></div>
      <div><label>來源名稱</label><input name="economic_calendar_source_name" placeholder="${DEFAULT_ECONOMIC_CALENDAR_SOURCE_NAME} / TradingView proxy"></div>
      <div><label>自動提醒</label><select name="economic_calendar_auto_remind"><option value="1">啟用</option><option value="0">停用</option></select></div>
      <div><label>提醒小時（台北）</label><input name="economic_calendar_remind_hour" inputmode="numeric" placeholder="8"></div>
      <div><label>提前提醒分鐘</label><input name="economic_calendar_pre_event_minutes" inputmode="numeric" placeholder="30"></div>
      <div><label>同步天數</label><input name="economic_calendar_lookahead_days" inputmode="numeric" placeholder="7"></div>
      <div><label>推送目標</label><select name="economic_calendar_target_group"><option value="paid">全部付費會員</option><option value="pro">Pro 以上</option><option value="vip">VIP</option><option value="all">全部會員</option></select></div>
      <div><label>重要性</label><input name="economic_calendar_impacts" placeholder="high"></div>
      <div><label>幣別篩選</label><input name="economic_calendar_currencies" placeholder="USD,EUR,GBP,JPY,CAD,AUD,CNY"></div>
      <div><label>國家篩選</label><input name="economic_calendar_countries" placeholder="US,EU,JP，可留空"></div>
      <div><label>市場事件過濾</label><select name="economic_calendar_market_only"><option value="1">只保留重要市場事件</option><option value="0">依重要性全列</option></select></div>
    </div>
    <button class="btn primary" type="submit">儲存事件設定</button>
  </form>`;
}

function renderSymbolFormHtml() {
  return `<form id="symbolForm" class="stack">
    <div class="form-grid">
      <div><label>代碼</label><input name="symbol" required placeholder="NQ"></div>
      <div><label>排序</label><input name="sort_order" inputmode="numeric" value="0"></div>
      <div><label>英文名稱</label><input name="name" required></div>
      <div><label>中文名稱</label><input name="name_zh"></div>
      <div><label>分類</label><select name="category"><option value="index">指數</option><option value="metal">貴金屬</option><option value="energy">能源</option><option value="forex">外匯</option><option value="crypto">加密貨幣</option></select></div>
      <div><label>狀態</label><select name="is_active"><option value="true">啟用</option><option value="false">停用</option></select></div>
      <div><label>Tick Size</label><input name="tick_size" inputmode="decimal" value="0.25"></div>
      <div><label>Tick Value</label><input name="tick_value" inputmode="decimal" value="5"></div>
      <div><label>預設止損點數</label><input name="default_stop_points" inputmode="decimal" placeholder="例：XAU 填 20"></div>
      <div><label>預設 TP 間隔點數</label><input name="default_tp_spacing" inputmode="decimal" placeholder="例：XAU 填 12"></div>
      <div><label>推算模式</label><select name="default_level_mode"><option value="auto">自動（有固定用固定，否則 R 倍數）</option><option value="fixed">固定點位</option><option value="rmultiple">riskPoints × targetR 倍數</option></select></div>
    </div>
    <p class="muted" style="margin:0;font-size:12px">當 TradingView 指標沒有帶入止損 / 止盈時的推算方式：<b>固定點位</b> = 進場 ± 止損點數、TP1~TP3 = 進場 ± 間隔×1/2/3；<b>R 倍數</b> = 依策略 riskPoints × targetR。<b>自動</b>：有設固定點位就用固定，否則退回 R 倍數。</p>
    <button class="btn primary" type="submit">儲存品種</button>
  </form>`;
}

function renderEconomicHtml() {
  return `<div class="grid two">
    <section class="panel">
      <header><div><h2>近期經濟事件</h2><p>真實來源：Forex Factory 每週財經日曆（時間為台北 UTC+8）</p></div>
        <div class="panel-tools"><button class="btn primary" type="button" id="econSyncBtn">立即同步</button></div></header>
      <div class="body"><div id="econStatus" class="muted" style="margin-bottom:10px"></div>
      <div class="table-wrap"><table><thead><tr><th>時間</th><th>幣別</th><th>事件</th><th>影響</th><th>預估</th><th>前值</th><th>公布</th></tr></thead><tbody id="economicTable"></tbody></table></div></div>
    </section>
    <section class="panel">
      <header><h2>提醒設定</h2></header>
      <div class="body">
        <form id="economicForm" class="stack">
          <div class="form-grid">
            <div><label>啟用提醒</label><select name="econ_enabled"><option value="1">啟用</option><option value="0">停用</option></select></div>
            <div><label>提前提醒（分鐘）</label><input name="econ_reminder_lead" inputmode="numeric" placeholder="60"></div>
            <div><label>關注幣別</label><input name="econ_currencies" placeholder="USD,EUR"></div>
            <div><label>關注影響等級</label><input name="econ_impacts" placeholder="High"></div>
          </div>
          <p class="muted" style="margin:0;font-size:12px">系統每小時自動同步並在事件前依「提前提醒」分鐘數推播給付費會員（需開啟「行情警報」通知）。幣別以逗號分隔，例：USD,EUR；影響等級可填 High,Medium,Low。</p>
          <button class="btn primary" type="submit">儲存提醒設定</button>
        </form>
      </div>
    </section>
  </div>`;
}

function renderConfigFormHtml() {
  return `<div class="stack">
  <div class="card-grid two" id="billingReadiness"></div>
  <div id="financeDashboard"></div>
  <form id="configForm" class="stack">
    <div class="form-grid">
      <div><label>Pro 月費</label><input name="pro_price_1m"></div>
      <div><label>VIP 月費</label><input name="vip_price_1m"></div>
      <div><label>Pro 季費</label><input name="pro_price_3m"></div>
      <div><label>VIP 季費</label><input name="vip_price_3m"></div>
      <div><label>Pro 年費</label><input name="pro_price_12m"></div>
      <div><label>VIP 年費</label><input name="vip_price_12m"></div>
      <div><label>試用天數</label><input name="trial_days"></div>
      <div><label>訊號狀態</label><select name="signals_paused"><option value="0">運行中</option><option value="1">暫停發訊</option></select></div>
      <div><label>最低機率 %</label><input name="signal_min_probability" inputmode="decimal" placeholder="60；低於門檻只結算上一筆"></div>
      <div class="full"><label>公開短網址 / 自訂網域</label><input name="public_base_url" inputmode="url" placeholder="https://dc-signals.com"></div>
      <div><label>客服 Telegram</label><input name="contact_telegram"></div>
      <div><label>客服 LINE</label><input name="contact_line"></div>
      <div><label>銀行轉帳</label><select name="payment_manual_enabled"><option value="1">開放</option><option value="0">關閉</option></select></div>
      <div><label>付款銀行</label><input name="payment_bank"></div>
      <div><label>分行 / 銀行代碼</label><input name="payment_bank_branch" placeholder="例如 013 / XX分行"></div>
      <div><label>付款帳號</label><input name="payment_account"></div>
      <div><label>付款戶名</label><input name="payment_name"></div>
      <div class="full"><label>轉帳付款說明</label><textarea name="payment_transfer_note" placeholder="例如：轉帳後請在訂單填寫後五碼與付款時間"></textarea></div>
      <div><label>虛擬貨幣收款</label><select name="payment_crypto_enabled"><option value="0">關閉</option><option value="1">開放</option></select></div>
      <div><label>收款幣種</label><input name="payment_crypto_asset" placeholder="USDT"></div>
      <div><label>鏈別</label><input name="payment_crypto_network" placeholder="TRC20 / ERC20 / Polygon"></div>
      <div><label>Memo / Tag</label><input name="payment_crypto_memo" placeholder="沒有可留空"></div>
      <div class="full"><label>收款錢包地址</label><input name="payment_crypto_wallet" placeholder="貼上 USDT 錢包地址"></div>
      <div class="full"><label>匯率與確認說明</label><textarea name="payment_crypto_rate_note" placeholder="例如：請依付款當下匯率換算，實收以客服確認為準"></textarea></div>
      <div class="full"><label>虛擬貨幣付款注意事項</label><textarea name="payment_crypto_note" placeholder="例如：請務必選擇正確鏈別，鏈別錯誤可能無法追回"></textarea></div>
      <div class="full"><label>訊號 Proxy 規則</label><textarea name="signal_proxy_rules" placeholder='[{"enabled":true,"source":"USTEC","target":"NQ","mode":"weekly_offset","beta":1,"target_group":"pro"}]'></textarea></div>
      <div class="full"><label>歡迎訊息</label><textarea name="welcome_message"></textarea></div>
    </div>
    <button class="btn primary" type="submit">儲存設定</button>
  </form>
  </div>`;
}

function renderAdminScript() {
  return `
function localDateKey(offsetDays) {
  var date = new Date(Date.now() + Number(offsetDays || 0) * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(date);
}
var state = {
  data: null,
  action: 'LONG',
  query: '',
  signalFilter: 'all',
  userFilter: 'all',
  rebuildResult: null,
  dateRange: { start: localDateKey(-29), end: localDateKey(0), limit: 300, all: false }
};
var views = Array.prototype.slice.call(document.querySelectorAll('.view'));
var navButtons = Array.prototype.slice.call(document.querySelectorAll('[data-view]'));
var dockButtons = Array.prototype.slice.call(document.querySelectorAll('#mobileDock [data-view-target]'));
var messageEl = document.getElementById('message');
var viewTitles = {
  overview: '營運總覽',
  signals: '訊號工作台',
  strategies: '策略實驗室',
  tradingview: 'TradingView Gateway',
  events: '經濟事件',
  symbols: '品種管理',
  users: '會員管理',
  orders: '訂單管理',
  support: '客服工單',
  economic: '財經提醒',
  billing: '收費設定'
};
function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]); }); }
function money(value) { return 'NT$' + Number(value || 0).toLocaleString('zh-TW'); }
function parseDbDate(value) {
  if (!value) return null;
  var text = String(value).trim();
  var normalized = /(?:Z|[+-]\\d{2}:?\\d{2})$/i.test(text) ? text : text.replace(' ', 'T') + 'Z';
  var parsed = new Date(normalized);
  return isNaN(parsed.getTime()) ? null : parsed;
}
function dateText(value) {
  var parsed = parseDbDate(value);
  return parsed ? parsed.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }) : '-';
}
function priceText(value) {
  var n = Number(value);
  return isFinite(n) ? n.toFixed(2) : '-';
}
function probabilityText(value) {
  var n = Number(value);
  if (!isFinite(n) || n <= 0) return '-';
  if (n <= 1) n = n * 100;
  if (n > 100) return '-';
  return (Math.round(n * 100) / 100).toString().replace(/\.0+$/, '') + '%';
}
function paymentMethodText(method) {
  method = String(method || 'manual').toLowerCase();
  if (method === 'stripe') return '線上付款';
  if (method === 'crypto') return '虛擬貨幣';
  return '銀行轉帳';
}
function chip(text, tone) { return '<span class="chip ' + (tone || '') + '">' + esc(text) + '</span>'; }
function setMessage(text, tone) {
  messageEl.textContent = text || '';
  messageEl.className = 'message ' + (tone || '');
  if (text && tone === 'ok') setTimeout(function () { if (messageEl.textContent === text) setMessage(''); }, 4200);
}
function showView(view) {
  var nextView = viewTitles[view] ? view : 'overview';
  document.body.dataset.adminView = nextView;
  views.forEach(function (el) { el.classList.toggle('active', el.id === 'view-' + nextView); });
  navButtons.forEach(function (btn) {
    var active = btn.dataset.view === nextView;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-current', active ? 'page' : 'false');
  });
  dockButtons.forEach(function (btn) {
    var active = btn.dataset.viewTarget === nextView;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-current', active ? 'page' : 'false');
  });
  var title = document.getElementById('adminViewTitle');
  if (title) title.textContent = viewTitles[nextView] || '後台';
  if (window.matchMedia && window.matchMedia('(max-width: 680px)').matches) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
async function api(path, options) {
  var opts = Object.assign({}, options || {});
  var headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  if (window.ADMIN_CSRF_TOKEN) headers['X-Admin-CSRF'] = window.ADMIN_CSRF_TOKEN;
  opts.credentials = 'same-origin';
  opts.headers = headers;
  var res = await fetch(path, opts);
  if (res.status === 401) { location.reload(); return; }
  var text = await res.text();
  var data;
  try { data = text ? JSON.parse(text) : {}; } catch (e) { throw new Error(text || ('HTTP ' + res.status)); }
  if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
  if (!data.ok) throw new Error(data.error || '操作失敗');
  return data.data;
}
function syncDateRangeInputs() {
  var start = document.getElementById('dateRangeStart');
  var end = document.getElementById('dateRangeEnd');
  var limit = document.getElementById('dateRangeLimit');
  if (start) start.value = state.dateRange.all ? '' : (state.dateRange.start || '');
  if (end) end.value = state.dateRange.all ? '' : (state.dateRange.end || '');
  if (limit) limit.value = String(state.dateRange.limit || 300);
}
function readDateRangeInputs() {
  var start = document.getElementById('dateRangeStart');
  var end = document.getElementById('dateRangeEnd');
  var limit = document.getElementById('dateRangeLimit');
  state.dateRange = {
    start: start ? start.value : state.dateRange.start,
    end: end ? end.value : state.dateRange.end,
    limit: Number(limit ? limit.value : state.dateRange.limit) || 300,
    all: false
  };
}
function setDateRangePreset(preset) {
  var value = String(preset || '30');
  if (value === 'all') {
    state.dateRange = { start: '', end: '', limit: state.dateRange.limit || 300, all: true };
  } else {
    var days = Math.max(1, Number(value) || 30);
    state.dateRange = { start: localDateKey(-(days - 1)), end: localDateKey(0), limit: state.dateRange.limit || 300, all: false };
  }
  syncDateRangeInputs();
}
function adminBootstrapPath() {
  var params = new URLSearchParams();
  params.set('limit', String(state.dateRange.limit || 300));
  if (state.dateRange.all) {
    params.set('all', '1');
  } else {
    if (state.dateRange.start) params.set('start', state.dateRange.start);
    if (state.dateRange.end) params.set('end', state.dateRange.end);
  }
  return '/api/admin/bootstrap?' + params.toString();
}
async function load() {
  setMessage('同步後台資料中...');
  state.data = await api(adminBootstrapPath());
  if (state.data.range) state.dateRange = Object.assign({}, state.dateRange, state.data.range);
  syncDateRangeInputs();
  renderAll();
  setMessage('已同步 ' + state.data.serverTime, 'ok');
}
function renderAll() {
  renderSignalSymbolOptions();
  renderOpsSummary();
  renderOpsHealth();
  renderKpis();
  renderDateRangeSummary();
  renderSignalAnalytics();
  renderConfigSummary();
  renderConfigForm();
  renderBillingReadiness();
  renderFinanceDashboard();
  renderSignals();
  renderOrders();
  renderSupport();
  renderUsers();
  renderSymbols();
  renderStrategies();
  renderEconomic();
  renderTradingView();
  renderDeliveryDiagnostics();
  renderStrategyHealth();
  renderTvGateway();
  renderRevenueSummary();
  renderOverviewTvLogs();
  renderEconomicEvents();
  updateSignalPreview();
  document.getElementById('serverTime').textContent = '最後同步 ' + state.data.serverTime;
  document.getElementById('dbPill').textContent = 'D1 dc-signals-v91-db';
}
function renderOpsSummary() {
  var s = state.data.stats;
  var ops = state.data.ops || {};
  var sources = state.data.tvSources || [];
  var signals = state.data.signals || [];
  var supportStats = state.data.supportStats || {};
  var activeSources = sources.filter(function (x) { return x.is_active; }).length;
  var drafts = signals.filter(function (x) { return x.status === 'pending'; }).length;
  var paused = ops.statusText || (s.paused ? '暫停發訊' : '正常運行');
  document.getElementById('opsSummary').innerHTML = [
    ['營運狀態', paused],
    ['待審草稿', drafts + ' 筆'],
    ['TV 來源', activeSources + '/' + sources.length],
    ['待處理訂單', s.pendingOrders + ' 筆'],
    ['客服待回覆', (supportStats.open || 0) + ' 件']
  ].map(function (item) {
    return '<div class="ops-tile"><span>' + esc(item[0]) + '</span><strong>' + esc(item[1]) + '</strong></div>';
  }).join('');
}
function renderOpsHealth() {
  var ops = state.data.ops || { status: 'ok', statusText: '正常', issues: [] };
  var integrations = state.data.integrations || ops.integrations || {};
  var stripe = integrations.stripe || {};
  var oauth = integrations.oauth || {};
  var passwordAuth = integrations.passwordAuth || {};
  var cron = integrations.cron || {};
  var badgeTone = ops.status === 'critical' ? 'red' : ops.status === 'warning' ? 'amber' : 'green';
  var badge = document.getElementById('opsHealthBadge');
  if (badge) badge.innerHTML = chip(ops.statusText || '正常', badgeTone);
  var cards = [];
  if (ops.issues && ops.issues.length) {
    cards = ops.issues.map(function (issue) {
      return '<article class="health-card ' + esc(issue.severity || 'info') + '">' +
        '<strong>' + esc(issue.title) + '</strong>' +
        '<p>' + esc(issue.detail || '') + '</p>' +
        '<small>' + esc(issue.action || '') + '</small>' +
      '</article>';
    });
  } else {
    cards.push('<article class="health-card"><strong>營運狀態正常</strong><p>目前沒有待處理的付款、發訊或 TradingView 錯誤。</p><small>最後同步 ' + esc(state.data.serverTime || '-') + '</small></article>');
  }
  cards.push('<article class="health-card ' + (stripe.enabled ? 'info' : 'warning') + '"><strong>線上付款</strong><p>' + (stripe.enabled ? 'Stripe Checkout 與 webhook 已完整啟用。' : '線上付款尚未完整啟用，會員目前不會看到線上付款按鈕。') + '</p><small>' + esc(stripe.mode || 'off') + ' · ' + esc(stripe.currency || '-') + '</small></article>');
  var oauthNames = (oauth.providers || []).filter(function (p) { return p.enabled; }).map(function (p) { return p.name; }).join(', ');
  cards.push('<article class="health-card ' + (oauth.enabledCount ? 'info' : 'warning') + '"><strong>Google 登入</strong><p>' + (oauth.enabledCount ? '已啟用 ' + esc(oauthNames) + '。' : '尚未啟用 Google，會員仍可用 Email 或 Telegram 登入碼。') + '</p><small>會員中心 ' + esc(integrations.memberUrl || '/m') + '</small></article>');
  cards.push('<article class="health-card ' + (passwordAuth.enabled ? 'info' : 'warning') + '"><strong>網站帳號登入</strong><p>' + (passwordAuth.enabled ? '會員可直接用 Email + 密碼註冊與登入會員中心。' : '網站帳號登入尚未啟用。') + '</p><small>' + esc(passwordAuth.registerUrl || integrations.memberUrl || '/m') + '</small></article>');
  cards.push('<article class="health-card ' + (cron.manualSecret ? 'info' : 'warning') + '"><strong>Cron 手動端點</strong><p>' + (cron.manualSecret ? '手動維運端點已由 CRON_SECRET 保護。' : '手動維運端點已鎖定；需設定 CRON_SECRET 才能外部觸發。') + '</p><small>Cloudflare scheduled cron 不受影響</small></article>');
  cards.push('<article class="health-card info"><strong>TradingView</strong><p>24H Alert ' + esc((ops.alertStats && ops.alertStats.total24) || 0) + ' 筆，錯誤 ' + esc((ops.alertStats && ops.alertStats.failed24) || 0) + ' 筆。</p><small>最新 ' + esc((ops.alertStats && ops.alertStats.latestAt) ? dateText(ops.alertStats.latestAt) : '尚無紀錄') + '</small></article>');
  cards.push('<article class="health-card info"><strong>會員安全</strong><p>登入碼與訂單建立已啟用速率限制。</p><small>目前限制中 ' + esc((ops.securityStats && ops.securityStats.activeRateLimits) || 0) + '，高頻 ' + esc((ops.securityStats && ops.securityStats.hotRateLimits) || 0) + '</small></article>');
  cards.push('<article class="health-card info"><strong>後台效能</strong><p>Bootstrap ' + esc(ops.bootstrapMs || '-') + 'ms。</p><small>待發佇列 ' + esc((ops.queueStats && ops.queueStats.due) || 0) + '，付款待確認 ' + esc((ops.orderStats && ops.orderStats.paid) || 0) + '</small></article>');
  document.getElementById('opsHealthGrid').innerHTML = cards.join('');
}
function renderKpis() {
  var s = state.data.stats;
  var ops = state.data.ops || {};
  var finance = state.data.finance || {};
  var sentToday = (state.data.signals || []).filter(function (sig) { return sig.status === 'active' || sig.status === 'closed'; }).length;
  var items = [
    ['↗', '今日訊號', s.todaySignals, '草稿/發送合計'],
    ['✓', '已發送', sentToday, '目前載入視窗'],
    ['◎', '會員總數', s.totalUsers, 'Pro ' + s.proUsers + ' / VIP ' + s.vipUsers],
    ['$', '淨營收', money(finance.netRevenue || 0), '30D ' + money(finance.netRevenue30 || 0)],
    ['%', '勝率', s.winRate + '%', '今日績效'],
    ['⚡', '系統延遲', (ops.bootstrapMs || '-') + 'ms', ops.statusText || (s.paused ? '發訊暫停' : 'API 正常')]
  ];
  document.getElementById('kpis').innerHTML = items.map(function (item) {
    return '<div class="kpi"><div class="kpi-icon">' + esc(item[0]) + '</div><span>' + esc(item[1]) + '</span><strong>' + esc(item[2]) + '</strong><small>' + esc(item[3]) + '</small></div>';
  }).join('');
}
function renderDateRangeSummary() {
  var el = document.getElementById('dateRangeSummary');
  if (!el) return;
  var range = state.data.range || state.dateRange || {};
  if (range.all) {
    el.textContent = '全部歷史資料 · 最多載入 ' + (range.limit || 300) + ' 筆';
  } else {
    el.textContent = (range.start || '-') + ' 到 ' + (range.end || '-') + ' · 最多載入 ' + (range.limit || 300) + ' 筆';
  }
}
function pointsText(value) {
  var n = Number(value || 0);
  return (n >= 0 ? '+' : '') + priceText(n) + ' 點';
}
function analyticsMetric(label, value, detail, tone) {
  return '<article class="metric-card">' +
    '<span>' + esc(label) + '</span>' +
    '<strong>' + esc(value) + '</strong>' +
    (detail ? '<small>' + detail + '</small>' : '') +
    (tone ? '<div style="margin-top:8px">' + chip(tone.text, tone.tone) + '</div>' : '') +
  '</article>';
}
function analyticsRankRow(label, row, maxTotal) {
  var width = Math.max(4, Math.round((Number(row.total || 0) / Math.max(1, maxTotal)) * 100));
  return '<div class="rank-row"><strong>' + esc(label) + '</strong><div class="bar"><i style="width:' + width + '%"></i></div><span>' + esc(row.total || 0) + ' 筆 · ' + esc(pctText(row.winRate || 0)) + '</span><span>' + esc(pointsText(row.netPnl || 0)) + '</span></div>';
}
function renderSignalAnalytics() {
  var box = document.getElementById('signalAnalyticsDashboard');
  if (!box) return;
  var analytics = state.data.signalAnalytics || {};
  var summary = analytics.summary || {};
  var badge = document.getElementById('signalAnalyticsBadge');
  if (badge) badge.innerHTML = chip((summary.total || 0) + ' 筆訊號', summary.total ? 'green' : '') + ' ' + chip('勝率 ' + pctText(summary.winRate || 0), summary.winRate >= 50 ? 'green' : 'amber');
  var tickerMax = Math.max(1, (analytics.byTicker || []).reduce(function (max, row) { return Math.max(max, Number(row.total || 0)); }, 0));
  var strategyMax = Math.max(1, (analytics.byStrategy || []).reduce(function (max, row) { return Math.max(max, Number(row.total || 0)); }, 0));
  var maxDaily = Math.max(1, (analytics.daily || []).reduce(function (max, row) { return Math.max(max, Math.abs(Number(row.netPnl || 0)), Number(row.total || 0)); }, 0));
  var dailyBars = (analytics.daily || []).slice(-45).map(function (row) {
    var height = Math.max(4, Math.round((Math.max(Math.abs(Number(row.netPnl || 0)), Number(row.total || 0)) / maxDaily) * 86));
    return '<div class="' + (Number(row.netPnl || 0) < 0 ? 'loss' : '') + '" title="' + esc(row.day + ' · ' + row.total + ' 筆 · ' + pointsText(row.netPnl || 0)) + '"><i style="height:' + height + 'px"></i><span>' + esc(String(row.day || '').slice(5)) + '</span></div>';
  }).join('');
  var rebuild = state.rebuildResult ? '<article class="health-card info rebuild-summary"><strong>績效已重建</strong><p>掃描 ' + esc(state.rebuildResult.scanned || 0) + ' 筆，補結案 ' + esc(state.rebuildResult.closedByNext || 0) + ' 筆，修復已結案 ' + esc(state.rebuildResult.repairedClosed || 0) + ' 筆。</p><small>TP 補記 ' + esc(state.rebuildResult.tpUpdated || 0) + ' 筆 · performance 重建 ' + esc(state.rebuildResult.performanceRows || 0) + ' 筆 · 略過 ' + esc(state.rebuildResult.skipped || 0) + ' 筆</small></article>' : '';
  box.innerHTML = rebuild + '<div class="analytics-grid">' +
    '<div class="metric-grid">' +
      analyticsMetric('區間訊號', summary.total || 0, '進行中 ' + esc(summary.active || 0) + ' · 草稿 ' + esc(summary.pending || 0)) +
      analyticsMetric('已結案 / 勝率', (summary.closed || 0) + ' / ' + pctText(summary.winRate || 0), '勝 ' + esc(summary.wins || 0) + ' · 敗 ' + esc(summary.losses || 0) + ' · 保本 ' + esc(summary.breakeven || 0)) +
      analyticsMetric('淨點數', pointsText(summary.netPnl || 0), '平均 ' + pointsText(summary.avgPnl || 0), { text: Number(summary.netPnl || 0) >= 0 ? '正收益' : '需檢查', tone: Number(summary.netPnl || 0) >= 0 ? 'green' : 'red' }) +
      analyticsMetric('TP 命中', 'TP1 ' + (summary.tp1Hits || 0), 'TP2 ' + esc(summary.tp2Hits || 0) + ' · TP3 ' + esc(summary.tp3Hits || 0)) +
      analyticsMetric('發送人次', summary.sentCount || 0, '依 signal.sent_count 加總') +
      analyticsMetric('取消/未完成', (summary.cancelled || 0), '仍在追蹤 ' + esc((summary.active || 0) + (summary.pending || 0)) + ' 筆') +
    '</div>' +
    '<div class="grid">' +
      '<article class="metric-card"><span>品種排行</span><div class="rank-list" style="margin-top:10px">' + ((analytics.byTicker || []).map(function (row) { return analyticsRankRow(row.ticker || '-', row, tickerMax); }).join('') || '<small>尚無品種統計</small>') + '</div></article>' +
      '<article class="metric-card"><span>策略排行</span><div class="rank-list" style="margin-top:10px">' + ((analytics.byStrategy || []).map(function (row) { return analyticsRankRow(row.strategy || '-', row, strategyMax); }).join('') || '<small>尚無策略統計</small>') + '</div></article>' +
      '<article class="metric-card"><span>每日訊號與淨點數</span><div class="daily-bars">' + (dailyBars || '<small>尚無每日資料</small>') + '</div></article>' +
    '</div>' +
  '</div>';
}
function renderConfigSummary() {
  var summary = document.getElementById('configSummary');
  if (!summary) return;
  var c = state.data.config;
  var integrations = state.data.integrations || {};
  var stripe = integrations.stripe || {};
  var oauth = integrations.oauth || {};
  var cryptoReady = c.payment_crypto_enabled === '1' && !!c.payment_crypto_wallet;
  var proxyEnabled = String(c.signal_proxy_rules || '').indexOf('"enabled":true') >= 0 || String(c.signal_proxy_rules || '').indexOf('"enabled": true') >= 0;
  var minProb = Number(c.signal_min_probability || 0);
  summary.innerHTML =
    '<div class="actions">' + (c.signals_paused === '1' ? chip('訊號暫停', 'amber') : chip('訊號運行中', 'green')) + chip(minProb > 0 ? '機率 >= ' + minProb + '%' : '機率不過濾', minProb > 0 ? 'green' : '') + chip('Pro ' + money(c.pro_price_1m), '') + chip('VIP ' + money(c.vip_price_1m), '') + chip(proxyEnabled ? 'USTEC→NQ 已啟用' : 'Proxy 未啟用', proxyEnabled ? 'green' : 'amber') + chip(stripe.enabled ? '線上付款已啟用' : '線上付款未啟用', stripe.enabled ? 'green' : 'amber') + chip(c.payment_manual_enabled === '0' ? '轉帳關閉' : '轉帳開放', c.payment_manual_enabled === '0' ? 'amber' : 'green') + chip(cryptoReady ? 'Crypto 已啟用' : 'Crypto 未完成', cryptoReady ? 'green' : 'amber') + chip(oauth.enabledCount ? 'Google 登入已啟用' : 'Google 登入未啟用', oauth.enabledCount ? 'green' : 'amber') + '</div>' +
    '<div class="muted">公開網址：' + esc(c.public_base_url || '-') + '</div>' +
    '<div class="muted">轉帳：' + esc(c.payment_bank || '-') + ' / ' + esc(c.payment_account || '-') + '</div>' +
    '<div class="muted">Crypto：' + esc(c.payment_crypto_asset || 'USDT') + ' ' + esc(c.payment_crypto_network || '-') + ' / ' + esc(c.payment_crypto_wallet || '未設定') + '</div>' +
    '<div class="muted">客服：' + esc(c.contact_telegram || '-') + ' / ' + esc(c.contact_line || '-') + '</div>';
}
function renderConfigForm() {
  var form = document.getElementById('configForm');
  if (!form) return;
  Object.keys(state.data.config).forEach(function (key) {
    if (form.elements[key]) form.elements[key].value = state.data.config[key] == null ? '' : state.data.config[key];
  });
}
function readinessCard(title, tone, body, small, copyValue) {
  return '<article class="health-card ' + esc(tone || 'info') + '">' +
    '<strong>' + esc(title) + '</strong>' +
    '<p>' + body + '</p>' +
    (small ? '<small>' + small + '</small>' : '') +
    (copyValue ? '<div class="copy-row"><code>' + esc(copyValue) + '</code><button class="btn ghost" type="button" data-copy-value="' + esc(copyValue) + '">複製</button></div>' : '') +
  '</article>';
}
function renderBillingReadiness() {
  var box = document.getElementById('billingReadiness');
  if (!box) return;
  var integrations = state.data.integrations || {};
  var stripe = integrations.stripe || {};
  var oauth = integrations.oauth || { providers: [] };
  var telegram = integrations.telegram || {};
  var passwordAuth = integrations.passwordAuth || {};
  var cron = integrations.cron || {};
  var oauthNames = (oauth.providers || []).filter(function (p) { return p.enabled; }).map(function (p) { return p.name; }).join(', ');
  var cards = [];
  cards.push(readinessCard(
    'Stripe 線上付款',
    stripe.enabled ? 'info' : 'warning',
    stripe.enabled ? '會員可用 Checkout 付款，webhook 會自動確認訂單。' : '需要同時設定 STRIPE_SECRET_KEY 與 STRIPE_WEBHOOK_SECRET，才會對會員開放線上付款。',
    esc((stripe.mode || 'off').toUpperCase()) + ' · ' + esc(stripe.currency || '-') + ' · secret ' + (stripe.secretKey ? 'OK' : 'missing') + ' · webhook ' + (stripe.webhookSecret ? 'OK' : 'missing'),
    stripe.webhookUrl || ''
  ));
  var config = state.data.config || {};
  var cryptoReady = config.payment_crypto_enabled === '1' && !!config.payment_crypto_wallet;
  cards.push(readinessCard(
    '虛擬貨幣收款',
    cryptoReady ? 'info' : 'warning',
    cryptoReady ? '會員可建立 ' + esc(config.payment_crypto_asset || 'USDT') + ' 訂單，付款後回填 TxID 由後台人工確認。' : '開啟 Crypto 收款前，請填入幣種、鏈別與收款錢包地址。',
    esc(config.payment_crypto_asset || 'USDT') + ' · ' + esc(config.payment_crypto_network || '-') + ' · wallet ' + (config.payment_crypto_wallet ? 'OK' : 'missing'),
    config.payment_crypto_wallet || ''
  ));
  cards.push(readinessCard(
    '公開短網址',
    config.public_base_url && !String(config.public_base_url).includes('workers.dev') ? 'info' : 'warning',
    config.public_base_url && !String(config.public_base_url).includes('workers.dev') ? '系統顯示與 callback URL 已使用自訂公開網址。' : '目前仍使用 workers.dev；請綁定 Cloudflare Custom Domain 後填入正式網址。',
    '會員中心 ' + esc(integrations.memberUrl || '/m'),
    integrations.memberUrl || ''
  ));
  cards.push(readinessCard(
    'Google 第三方登入',
    oauth.enabledCount ? 'info' : 'warning',
    oauth.enabledCount ? '已啟用 ' + esc(oauthNames) + '，純網站會員可直接登入會員中心。' : '尚未啟用 Google；會員仍可用 Email 或 Telegram /login 登入。',
    'Google callback 請貼到 OAuth 後台。',
    (oauth.callbackUrls && oauth.callbackUrls.google) || ''
  ));
  cards.push(readinessCard(
    '網站帳號註冊',
    passwordAuth.enabled ? 'info' : 'warning',
    passwordAuth.enabled ? 'Email + 密碼註冊已啟用，會員可不經 Telegram 直接使用會員中心。' : '網站帳號註冊尚未啟用。',
    '密碼以 PBKDF2 雜湊保存，登入與註冊已套用限流。',
    passwordAuth.registerUrl || integrations.memberUrl || ''
  ));
  cards.push(readinessCard(
    'Telegram 會員入口',
    telegram.botToken ? 'info' : 'critical',
    telegram.botToken ? 'Telegram 登入碼與推播可用。' : 'BOT_TOKEN 尚未設定，Telegram 推播與登入碼不可用。',
    'Bot ' + esc(telegram.botUsername || '-') + ' · 會員中心 ' + esc(integrations.memberUrl || '/m'),
    integrations.memberUrl || ''
  ));
  cards.push(readinessCard(
    'Cron 手動觸發',
    cron.manualSecret ? 'info' : 'warning',
    cron.manualSecret ? '已設定 CRON_SECRET，可安全手動觸發維運端點。' : '尚未設定 CRON_SECRET，手動 cron 端點會拒絕外部呼叫；Cloudflare 排程仍正常。',
    'Header: X-Cron-Secret',
    (cron.endpoints && cron.endpoints.queued) || ''
  ));
  box.innerHTML = cards.join('');
}
function renderSignalSymbolOptions() {
  var select = document.getElementById('signalTicker');
  var submit = document.getElementById('createSignalBtn');
  var activeSymbols = (state.data.symbols || []).filter(function (s) { return s.is_active; });
  if (!activeSymbols.length) {
    select.innerHTML = '<option value="">請先啟用品種</option>';
    select.disabled = true;
    if (submit) submit.disabled = true;
    return;
  }
  select.innerHTML = activeSymbols.map(function (s, index) {
    var selected = index === 0 ? ' selected' : '';
    return '<option value="' + esc(s.symbol) + '"' + selected + '>' + esc(s.symbol + ' - ' + (s.name_zh || s.name)) + '</option>';
  }).join('');
  select.disabled = false;
  if (submit) submit.disabled = false;
}
function signalMediaButtons(sig) {
  var links = [];
  if (sig.chart_url) links.push('<a class="btn ghost mini" href="' + esc(sig.chart_url) + '" target="_blank" rel="noopener">TV</a>');
  if (sig.signal_uid) links.push('<a class="btn ghost mini" href="' + esc(location.origin + '/signal-card/' + encodeURIComponent(sig.signal_uid) + '.svg') + '" target="_blank" rel="noopener">卡圖</a>');
  if (sig.snapshot_url) links.push('<a class="btn ghost mini" href="' + esc(sig.snapshot_url) + '" target="_blank" rel="noopener">截圖</a>');
  return links.length ? '<div class="actions">' + links.join('') + '</div>' : '<span class="muted">-</span>';
}
function actionText(action) {
  return action === 'LONG' ? '⬆️ 做多' : action === 'SHORT' ? '⬇️ 做空' : (action || '-');
}
function statusTone(status) {
  return status === 'active' ? 'green' : status === 'closed' ? '' : status === 'cancelled' ? 'red' : 'amber';
}
function statusText(sig) {
  if (sig.status === 'active') return '已發送';
  if (sig.status === 'pending') return '草稿';
  if (sig.status === 'closed') return sig.result === 'loss' ? '止損' : sig.result === 'breakeven' ? '保本' : '結案';
  if (sig.status === 'cancelled') return '取消';
  return sig.status || '-';
}
function tpHitText(sig) {
  var count = Math.max(Number(sig.tp_hit_count || 0), sig.tp3_hit_at ? 3 : sig.tp2_hit_at ? 2 : sig.tp1_hit_at ? 1 : 0);
  var labels = [];
  if (count >= 1 && sig.tp1 != null) labels.push('TP1');
  if (count >= 2 && sig.tp2 != null) labels.push('TP2');
  if (count >= 3 && sig.tp3 != null) labels.push('TP3');
  return labels.join(' / ');
}
function signalTargetHtml(sig) {
  var rows = [['進場', sig.entry_price], ['止損', sig.stop_loss], ['TP1', sig.tp1], ['TP2', sig.tp2], ['TP3', sig.tp3]]
    .filter(function (row, index) { return index < 2 || row[1] !== null && row[1] !== undefined && row[1] !== ''; });
  return '<div class="target-stack">' + rows.map(function (row) {
    return '<span>' + esc(row[0]) + ' ' + esc(priceText(row[1])) + '</span>';
  }).join('') + (sig.probability != null ? '<span>' + esc('機率 ' + probabilityText(sig.probability)) + '</span>' : '') + (tpHitText(sig) ? '<span>' + esc('已達 ' + tpHitText(sig)) + '</span>' : '') + '</div>';
}
function signalActionButtons(sig) {
  if (sig.status === 'active') return '<button class="btn warn" data-close="' + esc(sig.signal_uid) + '">結案</button>';
  var del = '<button class="btn danger" data-delete-signal="' + esc(sig.signal_uid) + '">刪除</button>';
  if (sig.status === 'pending') return '<button class="btn primary" data-send="' + esc(sig.signal_uid) + '">發送</button><button class="btn danger" data-cancel="' + esc(sig.signal_uid) + '">取消</button>' + del;
  return del;
}
function signalRow(sig, compact) {
  var tone = statusTone(sig.status);
  var targets = signalTargetHtml(sig);
  var media = signalMediaButtons(sig);
  var action = signalActionButtons(sig);
  if (compact) {
    return '<tr><td>' + esc(dateText(sig.created_at)) + '</td><td>' + esc(sig.ticker) + '</td><td>' + chip(actionText(sig.action), '') + '</td><td>' + targets + '</td><td>' + chip(statusText(sig), tone) + '</td><td class="actions">' + media + action + '</td></tr>';
  }
  return '<tr><td>' + esc(dateText(sig.created_at)) + '</td><td><code>' + esc(sig.signal_uid) + '</code><div class="muted">' + esc(sig.source || sig.strategy_id || '') + '</div></td><td>' + esc(sig.ticker) + '</td><td>' + chip(actionText(sig.action), '') + '</td><td>' + esc(sig.signal_type) + '</td><td>' + targets + '</td><td>' + media + '</td><td>' + esc(sig.sent_count || 0) + '</td><td>' + chip(statusText(sig), tone) + '</td><td class="actions">' + action + '</td></tr>';
}
function signalCard(sig) {
  return '<article class="signal-card">' +
    '<div class="signal-card-head"><div><strong>' + esc(sig.ticker) + ' ' + esc(actionText(sig.action)) + '</strong><span>' + esc(dateText(sig.created_at)) + ' · ' + esc(sig.signal_type || '-') + '</span></div>' + chip(statusText(sig), statusTone(sig.status)) + '</div>' +
    '<div class="signal-card-grid">' +
      '<div><span>進場</span><strong>' + esc(priceText(sig.entry_price)) + '</strong></div>' +
      '<div><span>止損</span><strong>' + esc(priceText(sig.stop_loss)) + '</strong></div>' +
      '<div><span>TP1</span><strong>' + esc(priceText(sig.tp1)) + '</strong></div>' +
      '<div><span>TP2 / TP3</span><strong>' + esc(priceText(sig.tp2)) + ' / ' + esc(priceText(sig.tp3)) + '</strong></div>' +
      '<div><span>機率</span><strong>' + esc(probabilityText(sig.probability)) + '</strong></div>' +
      '<div><span>TP 已達</span><strong>' + esc(tpHitText(sig) || '-') + '</strong></div>' +
      '<div><span>發送</span><strong>' + esc(sig.sent_count || 0) + ' 人</strong></div>' +
      '<div><span>單號</span><strong>' + esc(String(sig.signal_uid || '').slice(0, 8)) + '</strong></div>' +
    '</div>' +
    '<div class="actions">' + signalMediaButtons(sig) + signalActionButtons(sig) + '</div>' +
  '</article>';
}
function renderSignals() {
  var signals = filteredSignals();
  document.getElementById('recentSignals').innerHTML = signals.slice(0, 8).map(function (s) { return signalRow(s, true); }).join('') || '<tr><td colspan="6" class="muted">尚無訊號</td></tr>';
  var recentCards = document.getElementById('recentSignalsCards');
  if (recentCards) recentCards.innerHTML = signals.slice(0, 8).map(signalCard).join('') || '<div class="muted">尚無訊號</div>';
  document.getElementById('signalsTable').innerHTML = signals.map(function (s) { return signalRow(s, false); }).join('') || '<tr><td colspan="10" class="muted">尚無訊號</td></tr>';
  document.getElementById('signalsCards').innerHTML = signals.map(signalCard).join('') || '<div class="muted">尚無訊號</div>';
}
function queryText() {
  return (state.query || '').trim().toLowerCase();
}
function matchesQuery(row, fields) {
  var q = queryText();
  if (!q) return true;
  return fields.some(function (field) {
    var value = typeof field === 'function' ? field(row) : row[field];
    return String(value == null ? '' : value).toLowerCase().includes(q);
  });
}
function orderEventLabel(type) {
  var map = { created:'建立', stripe_session_created:'Checkout', stripe_session_failed:'Checkout 失敗', paid_notice:'付款通知', stripe_skipped:'Stripe 待付款', confirmed:'已確認', rejected:'已拒絕', cancelled:'已取消', refunded:'已退款' };
  return map[type] || type || '紀錄';
}
function latestOrderEvent(orderId) {
  var id = String(orderId || '').toUpperCase();
  return (state.data.orderEvents || []).find(function (event) { return String(event.order_id || '').toUpperCase() === id; });
}
function adminUserName(user) {
  var username = String(user && user.username || '').trim();
  if (username) return username.indexOf('@') >= 0 ? username : '@' + username;
  return (user && (user.first_name || user.user_id)) || '-';
}
function orderRow(order, compact) {
  var user = adminUserName(order);
  var refunded = !!order.refunded_at;
  var tone = refunded ? 'red' : order.status === 'paid' ? 'amber' : order.status === 'confirmed' ? 'green' : order.status === 'rejected' || order.status === 'cancelled' ? 'red' : '';
  var actions = '';
  if (!refunded && (order.status === 'pending' || order.status === 'paid')) actions += '<button class="btn primary" data-confirm-order="' + esc(order.order_id) + '">確認</button><button class="btn danger" data-reject-order="' + esc(order.order_id) + '">拒絕</button>';
  if (!refunded && (order.status === 'paid' || order.status === 'confirmed')) actions += '<button class="btn danger" data-refund-order="' + esc(order.order_id) + '">退款</button>';
  var method = order.payment_provider || order.payment_method || 'manual';
  var session = order.payment_session_id ? '<div class="muted"><code>' + esc(order.payment_session_id) + '</code></div>' : '';
  var lastEvent = latestOrderEvent(order.order_id);
  var eventHtml = lastEvent ? '<div class="order-event"><b>' + esc(orderEventLabel(lastEvent.event_type)) + '</b> ' + esc(dateText(lastEvent.created_at)) + (lastEvent.message ? '<br>' + esc(lastEvent.message) : '') + '</div>' : '';
  var terms = order.terms_accepted_at ? '<div class="muted">條款 ' + esc(order.terms_version || '-') + ' · ' + esc(dateText(order.terms_accepted_at)) + '</div>' : '<div class="muted">條款：未記錄</div>';
  var refund = refunded ? '<div><b>退款</b> ' + money(order.refund_amount || order.amount) + ' · ' + esc(dateText(order.refunded_at)) + (order.refund_note ? '<br>' + esc(order.refund_note) : '') + '</div>' : '';
  var note = '<b>' + esc(paymentMethodText(method)) + '</b>' + session + terms + refund + (order.payment_note ? '<div>' + esc(order.payment_note).replace(/\\n/g, '<br>') + '</div>' : '');
  note += eventHtml;
  if (!note) note = '<span class="muted">-</span>';
  if (compact) return '<tr><td><code>' + esc(order.order_id) + '</code><div class="note-cell">' + note + '</div></td><td>' + esc(user) + '</td><td>' + esc(order.tier) + ' ' + esc(order.months) + '月</td><td>' + money(order.amount) + '</td><td class="actions">' + actions + '</td></tr>';
  return '<tr><td>' + esc(dateText(order.created_at)) + '</td><td><code>' + esc(order.order_id) + '</code></td><td>' + esc(user) + '</td><td>' + esc(order.tier) + ' ' + esc(order.months) + '月</td><td>' + money(order.amount) + '</td><td class="note-cell">' + note + '</td><td>' + chip(refunded ? '已退款' : order.status, tone) + '</td><td class="actions">' + actions + '</td></tr>';
}
function orderCard(order) {
  var user = adminUserName(order);
  var refunded = !!order.refunded_at;
  var tone = refunded ? 'red' : order.status === 'paid' ? 'amber' : order.status === 'confirmed' ? 'green' : order.status === 'rejected' || order.status === 'cancelled' ? 'red' : '';
  var method = order.payment_provider || order.payment_method || 'manual';
  var actions = '';
  if (!refunded && (order.status === 'pending' || order.status === 'paid')) actions += '<button class="btn primary" data-confirm-order="' + esc(order.order_id) + '">確認</button><button class="btn danger" data-reject-order="' + esc(order.order_id) + '">拒絕</button>';
  if (!refunded && (order.status === 'paid' || order.status === 'confirmed')) actions += '<button class="btn danger" data-refund-order="' + esc(order.order_id) + '">退款</button>';
  var lastEvent = latestOrderEvent(order.order_id);
  var eventHtml = lastEvent ? '<div class="record-note"><b>' + esc(orderEventLabel(lastEvent.event_type)) + '</b> · ' + esc(dateText(lastEvent.created_at)) + (lastEvent.message ? '<br>' + esc(lastEvent.message) : '') + '</div>' : '';
  var note = order.payment_note ? '<div class="record-note">' + esc(order.payment_note).replace(/\\n/g, '<br>') + '</div>' : '';
  var refund = refunded ? '<div class="record-note"><b>退款</b> ' + money(order.refund_amount || order.amount) + ' · ' + esc(dateText(order.refunded_at)) + (order.refund_note ? '<br>' + esc(order.refund_note) : '') + '</div>' : '';
  return '<article class="record-card">' +
    '<div class="record-card-head"><div><strong>' + esc(order.order_id) + '</strong><span>' + esc(dateText(order.created_at)) + ' · ' + esc(user) + '</span></div>' + chip(refunded ? '已退款' : order.status, tone) + '</div>' +
    '<div class="record-meta">' +
      '<div><span>方案</span><strong>' + esc(String(order.tier || '').toUpperCase()) + ' ' + esc(order.months) + ' 月</strong></div>' +
      '<div><span>金額</span><strong>' + money(order.amount) + '</strong></div>' +
      '<div><span>付款</span><strong>' + esc(paymentMethodText(method)) + '</strong></div>' +
      '<div><span>會員 ID</span><strong>' + esc(order.user_id || '-') + '</strong></div>' +
    '</div>' +
    note + refund + eventHtml +
    (actions ? '<div class="actions">' + actions + '</div>' : '<div class="muted">沒有待執行動作</div>') +
  '</article>';
}
function renderOrders() {
  var orders = filteredOrders();
  var pending = orders.filter(function (o) { return o.status === 'pending' || o.status === 'paid'; });
  document.getElementById('pendingOrders').innerHTML = pending.slice(0, 8).map(function (o) { return orderRow(o, true); }).join('') || '<tr><td colspan="5" class="muted">沒有待處理訂單</td></tr>';
  var pendingCards = document.getElementById('pendingOrdersCards');
  if (pendingCards) pendingCards.innerHTML = pending.slice(0, 8).map(orderCard).join('') || '<div class="muted">沒有待處理訂單</div>';
  document.getElementById('ordersTable').innerHTML = orders.map(function (o) { return orderRow(o, false); }).join('') || '<tr><td colspan="8" class="muted">尚無訂單</td></tr>';
  document.getElementById('ordersCards').innerHTML = orders.map(orderCard).join('') || '<div class="muted">尚無訂單</div>';
}
function filteredOrders() {
  return (state.data.orders || []).filter(function (order) {
    return matchesQuery(order, ['order_id', 'user_id', 'username', 'first_name', 'tier', 'status', 'payment_method', 'payment_provider', 'payment_session_id', 'payment_note', 'refund_note']);
  });
}
function supportStatusLabel(status) {
  return status === 'open' ? '待回覆' : status === 'pending' ? '已回覆' : status === 'closed' ? '已結案' : (status || '-');
}
function supportStatusTone(status) {
  return status === 'open' ? 'amber' : status === 'pending' ? 'green' : status === 'closed' ? '' : '';
}
function supportActorText(reply) {
  if (reply.actor_type === 'admin') return '客服';
  if (reply.actor_type === 'system') return '系統';
  return '會員';
}
function supportRow(ticket) {
  var user = adminUserName(ticket);
  var actions = ticket.status !== 'closed'
    ? '<button class="btn primary" data-support-reply="' + esc(ticket.ticket_id) + '">回覆</button><button class="btn ghost" data-support-close="' + esc(ticket.ticket_id) + '">結案</button>'
    : '';
  var thread = (ticket.replies || []).slice(-4).map(function (reply) {
    return '<div class="ticket-msg ' + esc(reply.actor_type || '') + '"><b>' + esc(supportActorText(reply)) + ' · ' + esc(dateText(reply.created_at)) + '</b>' + esc(reply.message || '').replace(/\\n/g, '<br>') + '</div>';
  }).join('');
  if (!thread) thread = '<span class="muted">' + esc(ticket.last_reply || ticket.message || '-') + '</span>';
  return '<tr><td>' + esc(dateText(ticket.updated_at)) + '</td><td><code>' + esc(ticket.ticket_id) + '</code><div class="muted">' + esc(ticket.priority || 'normal') + '</div></td><td>' + esc(user) + '<div class="muted"><code>' + esc(ticket.user_id) + '</code></div></td><td>' + esc(ticket.subject || '-') + '</td><td class="note-cell"><div class="ticket-thread">' + thread + '</div></td><td>' + chip(supportStatusLabel(ticket.status), supportStatusTone(ticket.status)) + '</td><td class="actions">' + actions + '</td></tr>';
}
function supportCard(ticket) {
  var user = adminUserName(ticket);
  var actions = ticket.status !== 'closed'
    ? '<button class="btn primary" data-support-reply="' + esc(ticket.ticket_id) + '">回覆</button><button class="btn ghost" data-support-close="' + esc(ticket.ticket_id) + '">結案</button>'
    : '';
  var thread = (ticket.replies || []).slice(-2).map(function (reply) {
    return '<div class="ticket-msg ' + esc(reply.actor_type || '') + '"><b>' + esc(supportActorText(reply)) + ' · ' + esc(dateText(reply.created_at)) + '</b>' + esc(reply.message || '').replace(/\\n/g, '<br>') + '</div>';
  }).join('');
  return '<article class="record-card">' +
    '<div class="record-card-head"><div><strong>' + esc(ticket.subject || '客服工單') + '</strong><span>' + esc(ticket.ticket_id) + ' · ' + esc(dateText(ticket.updated_at)) + '</span></div>' + chip(supportStatusLabel(ticket.status), supportStatusTone(ticket.status)) + '</div>' +
    '<div class="record-meta">' +
      '<div><span>會員</span><strong>' + esc(user) + '</strong></div>' +
      '<div><span>優先度</span><strong>' + esc(ticket.priority || 'normal') + '</strong></div>' +
    '</div>' +
    (thread ? '<div class="ticket-thread">' + thread + '</div>' : '<div class="record-note">' + esc(ticket.last_reply || ticket.message || '-') + '</div>') +
    (actions ? '<div class="actions">' + actions + '</div>' : '<div class="muted">已結案</div>') +
  '</article>';
}
function renderSupport() {
  var tickets = filteredSupportTickets();
  var stats = state.data.supportStats || {};
  var badge = document.getElementById('supportBadge');
  if (badge) badge.innerHTML = chip((stats.open || 0) + ' 待回覆', stats.open ? 'amber' : 'green') + ' ' + chip((stats.pending || 0) + ' 已回覆', '') + (queryText() ? ' ' + chip(tickets.length + ' 筆符合搜尋', 'amber') : '');
  document.getElementById('supportTable').innerHTML = tickets.map(supportRow).join('') || '<tr><td colspan="7" class="muted">尚無客服工單</td></tr>';
  document.getElementById('supportCards').innerHTML = tickets.map(supportCard).join('') || '<div class="muted">尚無客服工單</div>';
}
function filteredSupportTickets() {
  return (state.data.supportTickets || []).filter(function (ticket) {
    return matchesQuery(ticket, ['ticket_id', 'user_id', 'username', 'first_name', 'subject', 'message', 'last_reply', 'priority', 'status', function (row) {
      return (row.replies || []).map(function (reply) { return reply.message; }).join(' ');
    }]);
  });
}
function renderUsers() {
  var users = filteredUsers();
  renderUsersDashboard(users);
  document.getElementById('usersTable').innerHTML = users.map(function (u) {
    var name = adminUserName(u);
    var status = u.is_banned ? chip('封禁', 'red') : u.is_active ? chip('啟用', 'green') : chip('停用', 'amber');
    var symbols = parseJsonList(u.subscribed_symbols).join(', ') || '全部';
    var types = parseJsonList(u.signal_types).join(', ') || '全部';
    var accountFlags = '<div class="member-flags">' + chip(u.telegram_user_id ? 'TG已綁' : '未綁TG', u.telegram_user_id ? 'green' : 'amber') + chip(String(u.username || '').includes('@') ? 'Email' : 'TG帳號', '') + (u.paused ? chip('暫停接收', 'amber') : chip('接收中', 'green')) + '</div>';
    var notify = [u.notify_entry ? '進場' : '', u.notify_tp ? 'TP' : '', u.notify_sl ? 'SL' : '', u.notify_alert ? '警報' : ''].filter(Boolean).join(' / ') || '未開啟';
    return '<tr><td><div>' + esc(name) + '</div><div class="muted"><code>' + esc(u.user_id) + '</code></div>' + accountFlags + (u.admin_note ? '<div class="muted">' + esc(u.admin_note).slice(0, 80) + '</div>' : '') + '</td><td>' + chip(u.tier, u.tier === 'vip' ? 'amber' : u.tier === 'pro' ? 'green' : '') + '</td><td>' + esc(u.tier_expires_at ? dateText(u.tier_expires_at) : '-') + '<div class="muted">最後 ' + esc(u.last_active_at ? dateText(u.last_active_at) : '-') + '</div></td><td><div>' + esc(symbols) + '</div><div class="muted">' + esc(types) + '</div><div class="muted">通知：' + esc(notify) + '</div></td><td>' + money(u.total_spent || 0) + '<div>' + status + '</div></td><td class="actions"><button class="btn primary" data-user-edit="' + esc(u.user_id) + '">編輯</button><button class="btn ghost" data-user-tier="' + esc(u.user_id) + '|pro">Pro+30</button><button class="btn ghost" data-user-tier="' + esc(u.user_id) + '|vip">VIP+30</button><button class="btn danger" data-user-ban="' + esc(u.user_id) + '|' + (u.is_banned ? '0' : '1') + '">' + (u.is_banned ? '解封' : '封禁') + '</button></td></tr>';
  }).join('') || '<tr><td colspan="6" class="muted">尚無會員</td></tr>';
  document.getElementById('usersCards').innerHTML = users.map(function (u) {
    var name = adminUserName(u);
    var status = u.is_banned ? chip('封禁', 'red') : u.is_active ? chip('啟用', 'green') : chip('停用', 'amber');
    var symbols = parseJsonList(u.subscribed_symbols).join(', ') || '全部';
    var types = parseJsonList(u.signal_types).join(', ') || '全部';
    var notify = [u.notify_entry ? '進場' : '', u.notify_tp ? 'TP' : '', u.notify_sl ? 'SL' : '', u.notify_alert ? '警報' : ''].filter(Boolean).join(' / ') || '未開啟';
    return '<article class="record-card">' +
      '<div class="record-card-head"><div><strong>' + esc(name) + '</strong><span>' + esc(u.user_id) + '</span></div>' + status + '</div>' +
      '<div class="member-flags">' + chip(u.telegram_user_id ? 'TG已綁' : '未綁TG', u.telegram_user_id ? 'green' : 'amber') + chip(String(u.username || '').includes('@') ? 'Email' : 'TG帳號', '') + (u.paused ? chip('暫停接收', 'amber') : chip('接收中', 'green')) + '</div>' +
      '<div class="record-meta">' +
        '<div><span>等級</span><strong>' + esc(String(u.tier || '-').toUpperCase()) + '</strong></div>' +
        '<div><span>到期</span><strong>' + esc(u.tier_expires_at ? dateText(u.tier_expires_at) : '-') + '</strong></div>' +
        '<div><span>消費</span><strong>' + money(u.total_spent || 0) + '</strong></div>' +
        '<div><span>Telegram</span><strong>' + esc(u.telegram_user_id || '-').slice(0, 20) + '</strong></div>' +
        '<div><span>訂閱品種</span><strong>' + esc(symbols) + '</strong></div>' +
        '<div><span>通知</span><strong>' + esc(notify) + '</strong></div>' +
      '</div>' +
      '<div class="record-note">類型：' + esc(types) + ' · 最後活動：' + esc(u.last_active_at ? dateText(u.last_active_at) : '-') + '</div>' +
      (u.admin_note ? '<div class="record-note">' + esc(u.admin_note).slice(0, 140) + '</div>' : '') +
      '<div class="actions"><button class="btn primary" data-user-edit="' + esc(u.user_id) + '">編輯</button><button class="btn ghost" data-user-tier="' + esc(u.user_id) + '|pro">Pro+30</button><button class="btn ghost" data-user-tier="' + esc(u.user_id) + '|vip">VIP+30</button><button class="btn danger" data-user-ban="' + esc(u.user_id) + '|' + (u.is_banned ? '0' : '1') + '">' + (u.is_banned ? '解封' : '封禁') + '</button></div>' +
    '</article>';
  }).join('') || '<div class="muted">尚無會員</div>';
}
function userDaysLeft(user) {
  if (!user.tier_expires_at) return null;
  var parsed = parseDbDate(user.tier_expires_at);
  if (!parsed) return null;
  return Math.ceil((parsed.getTime() - Date.now()) / 86400000);
}
function userMatchesFilter(user) {
  var filter = state.userFilter || 'all';
  if (filter === 'all') return true;
  if (filter === 'paid') return user.tier !== 'free';
  if (filter === 'vip') return user.tier === 'vip';
  if (filter === 'pro') return user.tier === 'pro';
  if (filter === 'expiring') { var days = userDaysLeft(user); return user.tier !== 'free' && days !== null && days >= 0 && days <= 7; }
  if (filter === 'no-tg') return !user.telegram_user_id;
  if (filter === 'paused') return !!user.paused;
  if (filter === 'banned') return !!user.is_banned;
  return true;
}
function renderUsersDashboard(filtered) {
  var summary = state.data.usersSummary || {};
  var loaded = state.data.users || [];
  var noTgLoaded = loaded.filter(function (u) { return !u.telegram_user_id; }).length;
  var pausedLoaded = loaded.filter(function (u) { return !!u.paused; }).length;
  var badge = document.getElementById('usersBadge');
  if (badge) badge.innerHTML = chip((filtered || []).length + ' 筆符合', queryText() || state.userFilter !== 'all' ? 'amber' : 'green');
  var box = document.getElementById('usersDashboard');
  if (!box) return;
  box.innerHTML =
    analyticsMetric('會員總數', summary.total || loaded.length || 0, '付費 ' + esc(summary.activePaid || 0) + ' · Free ' + esc(summary.free || 0)) +
    analyticsMetric('VIP / Pro', (summary.vip || 0) + ' / ' + (summary.pro || 0), '目前有效付費 ' + esc(summary.activePaid || 0)) +
    analyticsMetric('7天內到期', summary.expiring7 || 0, '需要續費跟進', { text: summary.expiring7 ? '需處理' : '穩定', tone: summary.expiring7 ? 'amber' : 'green' }) +
    analyticsMetric('封禁會員', summary.banned || 0, '風控與客服紀錄') +
    analyticsMetric('帳號綁定', 'TG ' + (summary.telegramLinked || 0), 'Email ' + esc(summary.emailLinked || 0) + ' · 載入未綁TG ' + esc(noTgLoaded)) +
    analyticsMetric('通知狀態', pausedLoaded + ' 暫停', '依目前載入名單計算') +
    analyticsMetric('累計消費', money(summary.totalSpent || 0), '全部會員總計');
}
function filteredUsers() {
  return (state.data.users || []).filter(function (user) {
    return userMatchesFilter(user) && matchesQuery(user, ['user_id', 'username', 'first_name', 'tier', 'admin_note', 'telegram_user_id', 'subscribed_symbols', 'signal_types']);
  });
}
function findUser(userId) {
  return (state.data.users || []).find(function (user) { return String(user.user_id || '') === String(userId || ''); }) || {};
}
function symbolCard(s) {
  return '<article class="record-card">' +
    '<div class="record-card-head"><div><strong>' + esc(s.symbol) + '</strong><span>' + esc(s.name_zh || s.name || '-') + '</span></div>' + (s.is_active ? chip('啟用','green') : chip('停用','red')) + '</div>' +
    '<div class="record-meta">' +
      '<div><span>分類</span><strong>' + esc(s.category || '-').toUpperCase() + '</strong></div>' +
      '<div><span>排序</span><strong>' + esc(s.sort_order || 0) + '</strong></div>' +
      '<div><span>Tick Size</span><strong>' + esc(s.tick_size || '-') + '</strong></div>' +
      '<div><span>Tick Value</span><strong>' + esc(s.tick_value || '-') + '</strong></div>' +
    '</div>' +
    '<div class="actions"><button class="btn ghost" data-edit-symbol="' + esc(s.symbol) + '">編輯品種</button></div>' +
  '</article>';
}
function renderSymbols() {
  var symbols = filteredSymbols();
  document.getElementById('symbolsTable').innerHTML = symbols.map(function (s) {
    var modeText = { auto: '自動', fixed: '固定', rmultiple: 'R倍數' }[s.default_level_mode || 'auto'] || '自動';
    var levels = (s.default_stop_points || s.default_tp_spacing) ? ('SL ' + esc(s.default_stop_points || '-') + ' / TP×' + esc(s.default_tp_spacing || '-') + ' · ' + esc(modeText)) : ('<span class="muted">' + esc(modeText) + '</span>');
    return '<tr><td>' + esc(s.sort_order) + '</td><td><code>' + esc(s.symbol) + '</code></td><td>' + esc(s.name_zh || s.name) + '</td><td>' + esc(s.category) + '</td><td>' + esc(s.tick_size) + ' / ' + esc(s.tick_value) + '</td><td>' + levels + '</td><td>' + (s.is_active ? chip('啟用','green') : chip('停用','red')) + '</td><td class="actions"><button class="btn ghost" data-edit-symbol="' + esc(s.symbol) + '">編輯</button></td></tr>';
  }).join('') || '<tr><td colspan="8" class="muted">尚無品種</td></tr>';
  var cards = document.getElementById('symbolsCards');
  if (cards) cards.innerHTML = symbols.map(symbolCard).join('') || '<div class="muted">尚無品種</div>';
}
function filteredSymbols() {
  return (state.data.symbols || []).filter(function (symbol) {
    return matchesQuery(symbol, ['symbol', 'name', 'name_zh', 'category']);
  });
}
function renderStrategies() {
  var strategies = filteredStrategies();
  document.getElementById('strategiesTable').innerHTML = strategies.map(function (s) {
    return '<tr><td>' + esc(s.sort_order) + '</td><td><div>' + esc(s.name) + '</div><div class="muted"><code>' + esc(s.strategy_id) + '</code></div></td><td>' + chip(s.tier, s.tier === 'vip' ? 'amber' : 'green') + '</td><td>' + esc(parseJsonList(s.symbols).join(', ')) + '</td><td>' + (s.is_active ? chip('啟用','green') : chip('停用','red')) + '</td><td class="actions"><button class="btn ghost" data-edit-strategy="' + esc(s.strategy_id) + '">編輯</button></td></tr>';
  }).join('') || '<tr><td colspan="6" class="muted">尚無策略</td></tr>';
  var cards = document.getElementById('strategiesCards');
  if (cards) cards.innerHTML = strategies.map(strategyEditCard).join('') || '<div class="muted">尚無策略</div>';
}
function econImpactChip(impact) {
  impact = String(impact || '').toLowerCase();
  if (impact === 'high') return chip('高', 'red');
  if (impact === 'medium') return chip('中', 'amber');
  if (impact === 'holiday') return chip('休市', '');
  return chip('低', 'green');
}
function econTaipei(iso) {
  try { return new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }); }
  catch (e) { return iso; }
}
function renderEconomic() {
  var table = document.getElementById('economicTable');
  if (table) {
    var events = state.data.economicEvents || [];
    table.innerHTML = events.map(function (ev) {
      return '<tr><td>' + esc(econTaipei(ev.event_time || ev.event_at)) + '</td><td>' + esc(ev.currency || ev.country || '-') + '</td><td>' + esc(ev.title) + '</td><td>' + econImpactChip(ev.impact) + '</td><td>' + esc(ev.forecast || '-') + '</td><td>' + esc(ev.previous || '-') + '</td><td>' + esc(ev.actual || '-') + '</td></tr>';
    }).join('') || '<tr><td colspan="7" class="muted">尚無事件，請點「立即同步」</td></tr>';
  }
  var status = document.getElementById('econStatus');
  var settings = state.data.economicSettings || {};
  if (status) {
    var last = settings.lastSync ? econTaipei(settings.lastSync) : '尚未同步';
    status.textContent = '最後同步：' + last + ' · 關注 ' + ((settings.currencies || []).join('/') || '全部') + ' · 影響 ' + ((settings.impacts || []).join('/') || '全部') + ' · 市場事件 ' + (settings.marketOnly ? '啟用' : '關閉') + ' · 提前 ' + (settings.leadMinutes || 30) + ' 分鐘';
  }
  var form = document.getElementById('economicForm');
  if (form) {
    if (form.elements.econ_enabled) form.elements.econ_enabled.value = settings.enabled === false ? '0' : '1';
    if (form.elements.econ_reminder_lead) form.elements.econ_reminder_lead.value = settings.leadMinutes || 60;
    if (form.elements.econ_currencies) form.elements.econ_currencies.value = (settings.currencies || []).join(',');
    if (form.elements.econ_impacts) form.elements.econ_impacts.value = (settings.impacts || []).join(',');
  }
}
function filteredStrategies() {
  return (state.data.strategies || []).filter(function (strategy) {
    return matchesQuery(strategy, ['strategy_id', 'name', 'description', 'signal_types', 'symbols', 'tier', 'rules_json', 'note']);
  });
}
function strategyEditCard(s) {
  var rules = parseObject(s.rules_json, {});
  return '<article class="record-card">' +
    '<div class="record-card-head"><div><strong>' + esc(s.name || s.strategy_id) + '</strong><span>' + esc(s.strategy_id || '-') + '</span></div>' + (s.is_active ? chip('啟用','green') : chip('停用','red')) + '</div>' +
    '<div class="record-meta">' +
      '<div><span>等級</span><strong>' + esc(String(s.tier || '-').toUpperCase()) + '</strong></div>' +
      '<div><span>訊號類型</span><strong>' + esc(parseJsonList(s.signal_types).join(', ') || '-') + '</strong></div>' +
      '<div><span>品種</span><strong>' + esc(parseJsonList(s.symbols).join(', ') || '全部') + '</strong></div>' +
      '<div><span>Risk</span><strong>' + esc(rules.riskPoints || rules.risk_points || '-') + '</strong></div>' +
    '</div>' +
    (s.note || s.description ? '<div class="record-note">' + esc(s.note || s.description).slice(0, 160) + '</div>' : '') +
    '<div class="actions"><button class="btn ghost" data-edit-strategy="' + esc(s.strategy_id) + '">編輯策略</button></div>' +
  '</article>';
}
function signalMatchesQuery(sig) {
  return matchesQuery(sig, ['signal_uid', 'ticker', 'action', 'signal_type', 'strategy_id', 'source', 'note', 'status']);
}
function filteredSignals() {
  return (state.data.signals || []).filter(function (sig) {
    var statusOk = state.signalFilter === 'all' || sig.status === state.signalFilter;
    return statusOk && signalMatchesQuery(sig);
  });
}
function maskedSecret(value) {
  var s = String(value || '');
  if (s.length <= 8) return s ? '••••' : '-';
  return s.slice(0, 4) + '••••' + s.slice(-4);
}
function spark(seed) {
  var base = Math.max(2, Number(seed || 1));
  return '<div class="spark">' + [2, 5, 3, 7, 4, 8, 6, 9].map(function (n, idx) {
    return '<i style="height:' + (10 + ((base + n + idx) % 18)) + 'px"></i>';
  }).join('') + '</div>';
}
function renderStrategyHealth() {
  var signals = state.data.signals || [];
  document.getElementById('strategyHealth').innerHTML = (state.data.strategies || []).map(function (strategy) {
    var rules = parseObject(strategy.rules_json, {});
    var count = signals.filter(function (sig) { return sig.strategy_id === strategy.strategy_id || (!sig.strategy_id && parseJsonList(strategy.symbols).includes(sig.ticker)); }).length;
    return '<div class="strategy-card">' +
      '<div class="strategy-head"><div><strong>' + esc(strategy.name) + '</strong><span><code>' + esc(strategy.strategy_id) + '</code></span></div>' + chip(strategy.tier, strategy.tier === 'vip' ? 'amber' : 'green') + '</div>' +
      '<div class="mini-stats"><div><span>Risk</span><strong>' + esc(rules.riskPoints || rules.risk_points || '-') + '</strong></div><div><span>訊號</span><strong>' + esc(count) + '</strong></div><div><span>品種</span><strong>' + esc(parseJsonList(strategy.symbols).length || 'All') + '</strong></div></div>' +
      spark(count + Number(strategy.sort_order || 0)) +
    '</div>';
  }).join('') || '<div class="muted">尚無策略</div>';
}
function renderTvGateway() {
  var sources = state.data.tvSources || [];
  document.getElementById('tvGateway').innerHTML = sources.slice(0, 3).map(function (source) {
    return tvSourceCard(source, true);
  }).join('') || '<div class="muted">尚無 TradingView 來源</div>';
}
function tvSourceCard(source, compact) {
  var webhook = location.origin + '/tv/' + source.source_id;
  var mode = source.auto_send ? '自動發送' : '草稿審核';
  return '<div class="source-card ' + (source.is_active ? '' : 'off') + '">' +
    '<div class="source-head"><div><strong>' + esc(source.name) + '</strong><span><code>' + esc(source.source_id) + '</code></span></div>' + (source.is_active ? chip('啟用','green') : chip('停用','red')) + '</div>' +
    '<div class="source-meta"><div><span>模式</span>' + esc(mode) + '</div><div><span>策略</span>' + esc(source.default_strategy_id || 'auto') + '</div><div><span>目標</span>' + esc(source.target_group || 'pro') + '</div><div><span>Secret</span>' + esc(maskedSecret(source.webhook_secret)) + '</div></div>' +
    (compact ? '' : '<div class="copy-row"><code>' + esc(webhook) + '</code><button class="btn ghost" data-copy-value="' + esc(webhook) + '" type="button">複製</button><button class="btn ghost" data-edit-tv-source="' + esc(source.source_id) + '" type="button">編輯</button></div>') +
  '</div>';
}
function tvLogCard(log) {
  var tone = log.status === 'error' ? 'red' : log.status === 'active' ? 'green' : 'amber';
  var diagnosis = tvLogDiagnosis(log);
  return '<article class="record-card">' +
    '<div class="record-card-head"><div><strong>' + esc((log.ticker || '-') + ' ' + (log.action || '')) + '</strong><span>' + esc(dateText(log.created_at)) + ' · ' + esc(log.source_id || '-') + '</span></div>' + chip(log.status || '-', tone) + '</div>' +
    '<div class="record-meta">' +
      '<div><span>策略</span><strong>' + esc(log.strategy_id || '-') + '</strong></div>' +
      '<div><span>訊號</span><strong>' + esc(log.signal_uid || '-') + '</strong></div>' +
    '</div>' +
    (diagnosis ? '<div class="record-note"><b>' + esc(diagnosis.title) + '</b><br>' + esc(diagnosis.action) + (log.error ? '<br><code>' + esc(log.error) + '</code>' : '') + '</div>' : '') +
  '</article>';
}
function renderRevenueSummary() {
  var finance = state.data.finance || {};
  var tiers = finance.tierRevenue || [];
  var tierTotal = Math.max(1, tiers.reduce(function (sum, row) { return sum + Number(row.net || 0); }, 0));
  document.getElementById('revenueSummary').innerHTML = '<div class="revenue-stack">' +
    '<div class="revenue-total"><div><span class="muted">訂單淨營收</span><strong>' + money(finance.netRevenue || 0) + '</strong><div class="muted">總收 ' + money(finance.grossRevenue || 0) + ' · 退款 ' + money(finance.refunds || 0) + '</div></div>' + chip('30D ' + money(finance.netRevenue30 || 0), finance.netRevenue30 ? 'green' : '') + '</div>' +
    '<div class="mini-stats">' +
      '<div><span>ARPU 30D</span><strong>' + money(finance.arpu30 || 0) + '</strong></div>' +
      '<div><span>LTV</span><strong>' + money(finance.ltv || 0) + '</strong></div>' +
      '<div><span>流失率</span><strong>' + pctText(finance.churnRate30) + '</strong></div>' +
    '</div>' +
    (tiers.map(function (row) { return mixRow(String(row.tier || '-').toUpperCase(), Number(row.net || 0), tierTotal, money(row.net || 0)); }).join('') || '<div class="muted">尚無已確認收入。</div>') +
  '</div>';
}
function pctText(value) {
  return Number(value || 0).toFixed(1) + '%';
}
function mixRow(label, value, total, display) {
  var pct = Math.round((value / total) * 100);
  return '<div class="mix-row"><span>' + esc(label) + '</span><div class="bar"><i style="width:' + pct + '%"></i></div><strong>' + esc(display || value) + ' (' + pct + '%)</strong></div>';
}
function financeMetricCard(label, value, detail, tone) {
  return '<article class="revenue-card">' +
    '<span class="muted">' + esc(label) + '</span>' +
    '<strong style="display:block;margin-top:6px;font-size:22px">' + esc(value) + '</strong>' +
    (detail ? '<small class="muted" style="display:block;margin-top:6px">' + detail + '</small>' : '') +
    (tone ? '<div style="margin-top:8px">' + chip(tone.text, tone.tone) + '</div>' : '') +
  '</article>';
}
function renderFinanceDashboard() {
  var box = document.getElementById('financeDashboard');
  if (!box) return;
  var finance = state.data.finance || {};
  var maxDaily = Math.max(1, (finance.dailyRevenue || []).reduce(function (max, row) { return Math.max(max, Number(row.net || 0)); }, 0));
  var daily = (finance.dailyRevenue || []).map(function (row) {
    var width = Math.max(3, Math.round((Number(row.net || 0) / maxDaily) * 100));
    return '<div class="mix-row"><span>' + esc(String(row.day || '').slice(5) || '-') + '</span><div class="bar"><i style="width:' + width + '%"></i></div><strong>' + money(row.net || 0) + '</strong></div>';
  }).join('') || '<div class="muted">近 14 日尚無確認收入。</div>';
  var tiers = (finance.tierRevenue || []).map(function (row) {
    return '<div class="source-meta"><div><span>方案</span>' + esc(String(row.tier || '-').toUpperCase()) + '</div><div><span>淨收入</span>' + money(row.net || 0) + '</div><div><span>訂單</span>' + esc(row.orders || 0) + '</div><div><span>退款</span>' + money(row.refunds || 0) + '</div></div>';
  }).join('') || '<div class="muted">尚無方案收入。</div>';
  box.innerHTML =
    '<section class="panel"><header><div><h2>財務營運指標</h2><p>以已確認訂單為收入來源，退款會扣回淨營收</p></div>' + chip('退款率 ' + pctText(finance.refundRate), finance.refundRate > 10 ? 'amber' : 'green') + '</header>' +
    '<div class="body stack">' +
      '<div class="card-grid two">' +
        financeMetricCard('淨營收', money(finance.netRevenue || 0), '總收 ' + money(finance.grossRevenue || 0) + ' · 退款 ' + money(finance.refunds || 0)) +
        financeMetricCard('30 日淨收', money(finance.netRevenue30 || 0), '7 日 ' + money(finance.netRevenue7 || 0) + ' · 今日 ' + money(finance.netRevenueToday || 0)) +
        financeMetricCard('ARPU 30D', money(finance.arpu30 || 0), '目前付費會員 ' + esc(finance.activePaidUsers || 0) + ' 位') +
        financeMetricCard('LTV', money(finance.ltv || 0), '付費客戶 ' + esc(finance.payingCustomers || 0) + ' 位 · 平均客單 ' + money(finance.avgOrderValue || 0)) +
        financeMetricCard('流失/到期 30D', pctText(finance.churnRate30), '流失 ' + esc(finance.expiredPaidUsers30 || 0) + ' 位 · 7 日內到期 ' + esc(finance.expiringPaidUsers7 || 0) + ' 位', { text: finance.expiringPaidUsers7 ? '需續費跟進' : '穩定', tone: finance.expiringPaidUsers7 ? 'amber' : 'green' }) +
        financeMetricCard('待處理訂單', money(finance.pendingOrderValue || 0), esc(finance.pendingOrderCount || 0) + ' 筆 pending/paid', { text: finance.pendingOrderCount ? '待處理' : '清空', tone: finance.pendingOrderCount ? 'amber' : 'green' }) +
      '</div>' +
      '<div class="grid two">' +
        '<article class="revenue-card"><strong>近 14 日淨收入</strong><div class="revenue-stack" style="margin-top:10px">' + daily + '</div></article>' +
        '<article class="revenue-card"><strong>方案收入拆分</strong><div class="revenue-stack" style="margin-top:10px">' + tiers + '</div></article>' +
      '</div>' +
    '</div></section>';
}
function renderOverviewTvLogs() {
  var logs = filteredTvLogs().slice(0, 6);
  document.getElementById('overviewTvLogs').innerHTML = logs.map(function (log) {
    var tone = log.status === 'error' ? 'red' : log.status === 'active' ? 'green' : 'amber';
    var diagnosis = tvLogDiagnosis(log);
    return '<tr><td>' + esc(dateText(log.created_at)) + '</td><td>' + esc(log.source_id) + '</td><td>' + esc((log.ticker || '-') + ' ' + (log.action || '')) + '</td><td>' + chip(diagnosis ? diagnosis.title : (log.error || log.status), tone) + (diagnosis ? '<div class="note-cell">' + esc(diagnosis.action) + '</div>' : '') + '</td></tr>';
  }).join('') || '<tr><td colspan="4" class="muted">尚無 alert</td></tr>';
  var overviewCards = document.getElementById('overviewTvLogsCards');
  if (overviewCards) overviewCards.innerHTML = logs.map(tvLogCard).join('') || '<div class="muted">尚無 alert</div>';
}
function eventImpactTone(impact) {
  impact = String(impact || '').toLowerCase();
  return impact === 'high' ? 'red' : impact === 'medium' ? 'amber' : impact === 'low' ? 'green' : '';
}
function eventImpactText(impact) {
  impact = String(impact || '').toLowerCase();
  return impact === 'high' ? '高' : impact === 'medium' ? '中' : impact === 'low' ? '低' : (impact || '中');
}
function eventTimeText(event) {
  if (!event || !event.event_time) return '待定';
  var parsed = parseDbDate(event.event_time);
  return parsed ? parsed.toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false }) : '待定';
}
function eventDateTimeText(event) {
  if (!event || !event.event_time) return (event && event.event_date) || '待定';
  var parsed = parseDbDate(event.event_time);
  return parsed ? parsed.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : (event.event_date || '待定');
}
function todayKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
}
function eventCard(event, compact) {
  var values = [
    ['預期', event.forecast || '-'],
    ['前值', event.previous || '-'],
    ['實際', event.actual || '-']
  ];
  return '<article class="event-card ' + esc(String(event.impact || 'medium').toLowerCase()) + '">' +
    '<div class="event-card-head"><div><strong>' + esc(eventDateTimeText(event) + ' ' + (event.currency || event.country || '-') + '｜' + event.title) + '</strong><span>台灣時間 UTC+8 · ' + esc(event.source || 'manual') + '</span></div>' + chip(eventImpactText(event.impact), eventImpactTone(event.impact)) + '</div>' +
    '<div class="event-meta">' + values.map(function (item) { return '<div><span>' + esc(item[0]) + '</span><strong>' + esc(item[1]) + '</strong></div>'; }).join('') + '</div>' +
    (compact ? '' : '<div class="muted">' + esc(event.notes || '') + '</div><div class="actions"><button class="btn ghost" type="button" data-edit-event="' + esc(event.event_uid) + '">編輯</button>' + (event.source_url ? '<a class="btn ghost mini" href="' + esc(event.source_url) + '" target="_blank" rel="noopener">來源</a>' : '') + '</div>') +
  '</article>';
}
function filteredEconomicEvents() {
  return (state.data.economicEvents || []).filter(function (event) {
    return matchesQuery(event, ['event_uid', 'event_date', 'currency', 'country', 'title', 'impact', 'actual', 'forecast', 'previous', 'source', 'notes']);
  });
}
function renderEconomicEvents() {
  var events = filteredEconomicEvents();
  var today = (state.data.economic && state.data.economic.today) || todayKey();
  var todayEvents = events.filter(function (event) { return event.event_date === today; });
  var overview = document.getElementById('overviewEconomicEvents');
  if (overview) {
    overview.innerHTML = todayEvents.slice(0, 4).map(function (event) { return eventCard(event, true); }).join('') ||
      '<div class="health-card warning"><strong>今日尚無事件資料</strong><p>可到事件管理手動新增，或設定 JSON Feed URL 後同步。</p><small>TradingView 經濟日曆可作為人工核對來源。</small></div>';
  }
  var cards = document.getElementById('economicEventCards');
  if (cards) {
    cards.innerHTML = events.map(function (event) { return eventCard(event, false); }).join('') ||
      '<div class="health-card warning"><strong>尚無事件資料</strong><p>請手動新增今日事件，或設定 JSON Feed URL 後按同步來源。</p><small>系統只會推送符合重要性/幣別/國家篩選的事件。</small></div>';
  }
  var form = document.getElementById('economicConfigForm');
  if (form && state.data.config) {
    [
      'economic_calendar_source_url',
      'economic_calendar_source_name',
      'economic_calendar_auto_remind',
      'economic_calendar_remind_hour',
      'economic_calendar_pre_event_minutes',
      'economic_calendar_lookahead_days',
      'economic_calendar_target_group',
      'economic_calendar_impacts',
      'economic_calendar_currencies',
      'economic_calendar_countries',
      'economic_calendar_market_only'
    ].forEach(function (key) {
      if (form.elements[key]) form.elements[key].value = state.data.config[key] == null ? '' : state.data.config[key];
    });
    if (!form.elements.economic_calendar_auto_remind.value) form.elements.economic_calendar_auto_remind.value = '1';
    if (!form.elements.economic_calendar_remind_hour.value) form.elements.economic_calendar_remind_hour.value = '8';
    if (!form.elements.economic_calendar_pre_event_minutes.value) form.elements.economic_calendar_pre_event_minutes.value = '30';
    if (!form.elements.economic_calendar_lookahead_days.value) form.elements.economic_calendar_lookahead_days.value = '7';
    if (!form.elements.economic_calendar_target_group.value) form.elements.economic_calendar_target_group.value = 'paid';
    if (!form.elements.economic_calendar_impacts.value) form.elements.economic_calendar_impacts.value = 'high';
    if (!form.elements.economic_calendar_currencies.value) form.elements.economic_calendar_currencies.value = 'USD,EUR,GBP,JPY,CAD,AUD,CNY';
    if (form.elements.economic_calendar_market_only && !form.elements.economic_calendar_market_only.value) form.elements.economic_calendar_market_only.value = '1';
  }
}
function editEconomicEvent(eventUid) {
  var event = (state.data.economicEvents || []).find(function (row) { return String(row.event_uid || '') === String(eventUid || ''); });
  if (!event) return;
  var localTime = '';
  var parsed = parseDbDate(event.event_time);
  if (parsed) {
    var parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(parsed).reduce(function (acc, part) { acc[part.type] = part.value; return acc; }, {});
    localTime = parts.year + '-' + parts.month + '-' + parts.day + 'T' + parts.hour + ':' + parts.minute;
  }
  fillForm('economicEventForm', {
    event_uid: event.event_uid || '',
    title: event.title || '',
    event_date: event.event_date || '',
    event_time: localTime,
    currency: event.currency || '',
    country: event.country || '',
    impact: event.impact || 'medium',
    status: event.status || 'scheduled',
    forecast: event.forecast || '',
    previous: event.previous || '',
    actual: event.actual || '',
    source_url: event.source_url || '',
    notes: event.notes || ''
  });
  setMessage('已帶入事件，修改後按儲存事件', 'ok');
}
function filteredTvLogs() {
  return (state.data.tvLogs || []).filter(function (log) {
    return matchesQuery(log, ['source_id', 'strategy_id', 'ticker', 'action', 'status', 'signal_uid', 'error', 'payload']);
  });
}
function tvLogDiagnosis(log) {
  if (!log) return null;
  var error = String(log.error || '').toLowerCase();
  var status = String(log.status || '').toLowerCase();
  if (!error && status !== 'error') return { title: log.status || '已接收', action: log.signal_uid ? '已建立訊號。' : '已記錄，等待後續處理。' };
  if (error.indexOf('為 0') >= 0 || error.indexOf('plot 沒取到') >= 0) {
    return { title: 'TV plot 回傳 0', action: 'TradingView 有觸發 alert，但 SL/TP plot 值是 0。請在 TV Data Window 核對實際 SL/TP plot 名稱或序號後重貼 Message。' };
  }
  if (error.indexOf('placeholder') >= 0 || error.indexOf('未解析') >= 0 || error.indexOf('plot_') >= 0) {
    return { title: 'TV plot 未解析', action: 'TradingView 沒有把 SL/TP placeholder 轉成數字。請依 Data Window 使用正確 plot 名稱或 plot_序號。' };
  }
  if (error.indexOf('stop_loss') >= 0 || error.indexOf('/sl') >= 0 || error.indexOf('止損') >= 0) {
    return { title: '缺少止損', action: 'TradingView Alert Message 必須帶 stop_loss 或 sl，並確認 plot 名稱與指標完全一致。' };
  }
  if (error.indexOf('tp1') >= 0 || error.indexOf('target1') >= 0 || error.indexOf('止盈') >= 0 || error.indexOf('止贏') >= 0) {
    return { title: '缺少 TP1', action: 'TradingView Alert Message 必須帶 tp1/target1；後端不會再自動推算假目標價。' };
  }
  if (error.indexOf('secret') >= 0 || error.indexOf('unauthorized') >= 0) {
    return { title: 'Webhook Secret 驗證失敗', action: '確認 TradingView webhook URL、source_id 與後台來源 secret 是否一致。' };
  }
  if (error.indexOf('ticker') >= 0 || error.indexOf('品種') >= 0) {
    return { title: '缺少或未允許品種', action: 'Alert Message 需帶 ticker/symbol，且該品種需在來源允許清單與品種管理中啟用。' };
  }
  if (error.indexOf('action') >= 0 || error.indexOf('方向') >= 0) {
    return { title: '缺少方向', action: 'Alert Message 需帶 action: buy/sell 或 LONG/SHORT。' };
  }
  if (error.indexOf('timeout') >= 0 || error.indexOf('took too long') >= 0) {
    return { title: 'TradingView 等待逾時', action: '已改為快速收件、背景推播；若仍出現，檢查 Worker 日誌與 Telegram API 是否異常。' };
  }
  return { title: 'Alert 錯誤', action: log.error || '請檢查 payload 格式。' };
}
function deliveryLevelText(levels) {
  levels = levels || {};
  return [
    ['Entry', levels.entry],
    ['SL', levels.stopLoss],
    ['TP1', levels.tp1],
    ['TP2', levels.tp2],
    ['TP3', levels.tp3],
    ['Prob', levels.probability]
  ].map(function (item) {
    var value = item[0] === 'Prob' ? probabilityText(item[1]) : priceText(item[1]);
    return '<code>' + esc(item[0] + ':' + (item[1] === null || item[1] === undefined || item[1] === '' ? '-' : value)) + '</code>';
  }).join('');
}
function deliveryItemCard(item) {
  var diagnosis = item.diagnosis || {};
  var tone = diagnosis.tone || (item.status === 'error' ? 'red' : 'green');
  var delivery = item.delivery || {};
  var title = diagnosis.title || item.status || 'Alert';
  var subtitle = [item.source_id || '-', item.strategy_id || '-', item.signal_uid || '無訊號'].join(' · ');
  var deliveryText = delivery.details ? '<div class="delivery-note">TG：' + esc(delivery.details) + ' · ' + esc(dateText(delivery.created_at)) + '</div>' : '';
  var errorText = item.error ? '<div class="delivery-note">錯誤：' + esc(item.error) + '</div>' : '';
  return '<article class="delivery-item ' + esc(tone) + '">' +
    '<div class="delivery-head"><div><strong>' + esc((item.ticker || '-') + ' ' + (item.action || '') + '｜' + title) + '</strong><span>' + esc(dateText(item.created_at)) + ' · ' + esc(subtitle) + '</span></div>' + chip(item.status || '-', tone) + '</div>' +
    '<div class="level-pills">' + deliveryLevelText(diagnosis.levels || {}) + '</div>' +
    '<div class="delivery-note">' + esc(diagnosis.action || '等待處理') + '</div>' +
    errorText + deliveryText +
  '</article>';
}
function renderDeliveryDiagnostics() {
  var diag = state.data.deliveryDiagnostics || {};
  var stats = diag.stats || {};
  var metrics = document.getElementById('deliveryMetrics');
  if (metrics) {
    metrics.innerHTML = [
      ['24h Alert', stats.alerts24 || 0, 'TradingView 進站'],
      ['24h 錯誤', stats.errors24 || 0, '解析或格式失敗'],
      ['SL/TP 為 0', stats.zero24 || 0, '已攔截不推會員'],
      ['TG 完成', stats.delivered24 || 0, '背景派送紀錄'],
      ['待補送', stats.queuedDue || 0, '安靜時段或重試佇列'],
      ['管理員', diag.adminTargets || 0, '可測試 TG 目標']
    ].map(function (item) {
      return '<div class="delivery-card"><span>' + esc(item[0]) + '</span><strong>' + esc(item[1]) + '</strong><small>' + esc(item[2]) + '</small></div>';
    }).join('');
  }
  var list = document.getElementById('deliveryDiagnostics');
  if (list) {
    list.innerHTML = (diag.items || []).slice(0, 18).map(deliveryItemCard).join('') ||
      '<div class="health-card warning"><strong>尚無投遞紀錄</strong><p>下一筆 TradingView alert 或後台發訊後，這裡會顯示完整生命線。</p></div>';
  }
}
function filteredTvSources() {
  return (state.data.tvSources || []).filter(function (source) {
    return matchesQuery(source, ['source_id', 'name', 'default_strategy_id', 'allowed_symbols', 'default_signal_type', 'target_group', 'notes']);
  });
}
function autoTradeStatusTone(status) {
  status = String(status || '');
  if (status === 'sent' || status === 'acked') return 'green';
  if (status === 'failed') return 'red';
  if (status === 'queued') return 'amber';
  return '';
}
function renderAutoTradeCard(row) {
  return '<article class="record-card">' +
    '<div class="record-card-head"><div><strong>' + esc((row.ticker || '-') + ' ' + (row.action || '')) + '</strong><span>' + esc(dateText(row.created_at)) + ' · ' + esc(row.command_id || '-') + '</span></div>' + chip(row.status || '-', autoTradeStatusTone(row.status)) + '</div>' +
    '<div class="record-meta">' +
      '<div><span>模式</span><strong>' + esc(row.mode || '-') + '</strong></div>' +
      '<div><span>口數</span><strong>' + esc(row.volume || '-') + '</strong></div>' +
      '<div><span>訊號</span><strong>' + esc(row.signal_uid || '-') + '</strong></div>' +
      '<div><span>嘗試</span><strong>' + esc(row.attempts || 0) + '</strong></div>' +
    '</div>' +
    (row.last_error ? '<div class="record-note">' + esc(row.last_error) + '</div>' : '') +
  '</article>';
}
function renderAutoTrade() {
  var panel = state.data.autoTrade || {};
  var cfg = panel.config || {};
  var summary = panel.summary || {};
  var recent = panel.recent || [];
  var badge = document.getElementById('autoTradeBadge');
  if (badge) badge.innerHTML = cfg.enabled ? chip(cfg.mode === 'live' ? 'Live 實單' : 'Paper 測試', cfg.mode === 'live' ? 'amber' : 'green') : chip('關閉', '');
  var cards = document.getElementById('autoTradeCards');
  if (cards) {
    cards.innerHTML =
      analyticsMetric('Bridge', cfg.bridgeConfigured ? '已設定' : '未設定', cfg.broker || 'exness-mt5') +
      analyticsMetric('今日/區間', String(summary.total || 0) + ' 筆', '送出 ' + esc(summary.sent || 0) + ' · 失敗 ' + esc(summary.failed || 0)) +
      analyticsMetric('風控', '口數 ' + esc(cfg.defaultVolume || 0.01), '風險 ' + esc(cfg.riskPercent || 1) + '% · 上限 ' + esc(cfg.maxDailyOrders || 20)) +
      analyticsMetric('允許品種', (cfg.allowedSymbols || []).join(', ') || '全部', (cfg.account || '未填帳號標籤') + ' · ' + esc(cfg.bridgeMode || 'mt5-poll')) +
      analyticsMetric('允許策略', (cfg.allowedStrategies || []).join(', ') || '全部', '非白名單策略不會送 MT5');
  }
  var form = document.getElementById('autoTradeForm');
  if (form && state.data.config) {
    [
      'auto_trade_enabled',
      'auto_trade_mode',
      'auto_trade_bridge_url',
      'auto_trade_bridge_secret',
      'auto_trade_account',
      'auto_trade_default_volume',
      'auto_trade_risk_percent',
      'auto_trade_max_orders_per_day',
      'auto_trade_allowed_symbols',
      'auto_trade_allowed_strategies'
    ].forEach(function (key) {
      if (form.elements[key]) form.elements[key].value = state.data.config[key] == null ? '' : state.data.config[key];
    });
    if (!form.elements.auto_trade_enabled.value) form.elements.auto_trade_enabled.value = cfg.enabled ? '1' : '0';
    if (!form.elements.auto_trade_mode.value) form.elements.auto_trade_mode.value = cfg.mode || 'paper';
  }
  var table = document.getElementById('autoTradeTable');
  if (table) {
    table.innerHTML = recent.map(function (row) {
      return '<tr><td>' + esc(dateText(row.created_at)) + '</td><td><code>' + esc(row.signal_uid || '-') + '</code></td><td>' + esc((row.ticker || '-') + ' ' + (row.action || '')) + '</td><td>' + esc(row.mode || '-') + '</td><td>' + esc(row.volume || '-') + '</td><td>' + chip(row.status || '-', autoTradeStatusTone(row.status)) + (row.last_error ? '<div class="note-cell">' + esc(row.last_error) + '</div>' : '') + '</td></tr>';
    }).join('') || '<tr><td colspan="6" class="muted">尚無自動交易指令</td></tr>';
  }
  var mobile = document.getElementById('autoTradeMobile');
  if (mobile) mobile.innerHTML = recent.map(renderAutoTradeCard).join('') || '<div class="muted">尚無自動交易指令</div>';
}
function renderTradingView() {
  var strategies = state.data.strategies || [];
  var allSources = state.data.tvSources || [];
  var sources = filteredTvSources();
  var symbols = state.data.symbols || [];
  var strategyOptions = '<option value="">自動選擇</option>' + strategies.map(function (s) {
    return '<option value="' + esc(s.strategy_id) + '">' + esc(s.name + ' (' + s.strategy_id + ')') + '</option>';
  }).join('');
  var genStrategyOptions = '<option value="auto">自動選擇</option>' + strategies.map(function (s) {
    return '<option value="' + esc(s.strategy_id) + '">' + esc(s.name) + '</option>';
  }).join('');
  var sourceOptions = allSources.map(function (s) {
    return '<option value="' + esc(s.source_id) + '">' + esc(s.name + ' (' + s.source_id + ')') + '</option>';
  }).join('');
  var symbolOptions = symbols.filter(function (s) { return s.is_active; }).map(function (s) {
    return '<option value="' + esc(s.symbol) + '">' + esc(s.symbol + ' - ' + (s.name_zh || s.name)) + '</option>';
  }).join('');

  document.getElementById('tvDefaultStrategy').innerHTML = strategyOptions;
  document.getElementById('tvGenStrategy').innerHTML = genStrategyOptions;
  document.getElementById('tvGenSource').innerHTML = sourceOptions;
  document.getElementById('tvGenTicker').innerHTML = symbolOptions;
  document.getElementById('tvSourcesTable').innerHTML = sources.map(function (s) {
    var symbolsText = parseJsonList(s.allowed_symbols).join(', ') || '全部';
    return '<tr><td><div>' + esc(s.name) + '</div><div class="muted"><code>' + esc(s.source_id) + '</code></div></td><td>' + esc(s.default_strategy_id || 'auto') + '</td><td>' + esc(symbolsText) + '</td><td>' + chip(s.target_group || 'pro', s.target_group === 'vip' ? 'amber' : 'green') + '</td><td>' + (s.auto_send ? chip('自動發送','green') : chip('草稿','amber')) + ' ' + (s.is_active ? chip('啟用','green') : chip('停用','red')) + '</td><td class="actions"><button class="btn ghost" data-edit-tv-source="' + esc(s.source_id) + '">編輯</button></td></tr>';
  }).join('') || '<tr><td colspan="6" class="muted">尚無來源</td></tr>';
  var mobileSources = document.getElementById('tvSourcesMobile');
  if (mobileSources) mobileSources.innerHTML = sources.map(function (s) { return tvSourceCard(s, false); }).join('') || '<div class="muted">尚無來源</div>';
  document.getElementById('tvSourceCards').innerHTML = sources.map(function (s) { return tvSourceCard(s, false); }).join('') || '<div class="muted">尚無來源</div>';
  var logs = filteredTvLogs();
  document.getElementById('tvLogsTable').innerHTML = logs.map(function (log) {
    var tone = log.status === 'error' ? 'red' : log.status === 'active' ? 'green' : 'amber';
    var diagnosis = tvLogDiagnosis(log);
    return '<tr><td>' + esc(dateText(log.created_at)) + '</td><td>' + esc(log.source_id) + '</td><td>' + esc(log.strategy_id || '-') + '</td><td>' + esc(log.ticker || '-') + '</td><td>' + esc(log.action || '-') + '</td><td>' + chip(diagnosis ? diagnosis.title : (log.error || log.status), tone) + (diagnosis ? '<div class="note-cell">' + esc(diagnosis.action) + '</div>' : '') + '</td><td><code>' + esc(log.signal_uid || '-') + '</code></td></tr>';
  }).join('') || '<tr><td colspan="7" class="muted">尚無 alert</td></tr>';
  var mobileLogs = document.getElementById('tvLogsMobile');
  if (mobileLogs) mobileLogs.innerHTML = logs.map(tvLogCard).join('') || '<div class="muted">尚無 alert</div>';
  renderAutoTrade();
  updateTradingViewGenerator();
}
function getSelectedTvSource() {
  var id = document.getElementById('tvGenSource').value;
  return (state.data.tvSources || []).find(function (s) { return s.source_id === id; }) || (state.data.tvSources || [])[0];
}
function getSelectedTvStrategy() {
  var id = document.getElementById('tvGenStrategy').value;
  if (!id || id === 'auto') return null;
  return (state.data.strategies || []).find(function (s) { return s.strategy_id === id; });
}
function getTvStrategyById(id) {
  var wanted = String(id || '').trim();
  if (!wanted) return null;
  return (state.data.strategies || []).find(function (s) { return s.strategy_id === wanted; }) || null;
}
function getEffectiveTvStrategy() {
  var selected = getSelectedTvStrategy();
  if (selected) return selected;
  var source = getSelectedTvSource();
  return getTvStrategyById(source && source.default_strategy_id) || getTvStrategyById('algo-pro-v1-4') || (state.data.strategies || [])[0] || null;
}
function effectiveTvStrategyId(strategy, source) {
  return (strategy && strategy.strategy_id) || (source && source.default_strategy_id) || 'algo-pro-v1-4';
}
function tvGeneratorLevels(strategy, action) {
  var id = String(strategy && strategy.strategy_id || '').toLowerCase();
  var side = String(action || '').toLowerCase();
  if (id.indexOf('algo-pro') >= 0 || id.indexOf('algopro') >= 0) {
    if (side === 'auto' || !side) {
      return {
        long_stop_loss: '{{plot_5}}',
        short_stop_loss: '{{plot_6}}',
        long_tp1: '{{plot_7}}',
        short_tp1: '{{plot_8}}',
        note: 'AlgoPro V1.4 Add placeholder mapping：plot_5 Long SL、plot_6 Short SL、plot_7 Long TP、plot_8 Short TP；後端會優先使用指標點位，缺少 TP2/TP3 時用後台品種/策略規則補位。'
      };
    }
    if (side === 'buy' || side === 'long') {
      return {
        stop_loss: '{{plot_5}}',
        tp1: '{{plot_7}}',
        note: 'AlgoPro V1.4 Data Window: plot_5 Long SL / plot_7 Long TP。TV 未提供的 TP2/TP3 由後台補位，p0-p17 會一併送回方便校正。'
      };
    }
    if (side === 'sell' || side === 'short') {
      return {
        stop_loss: '{{plot_6}}',
        tp1: '{{plot_8}}',
        note: 'AlgoPro V1.4 Data Window: plot_6 Short SL / plot_8 Short TP。TV 未提供的 TP2/TP3 由後台補位，p0-p17 會一併送回方便校正。'
      };
    }
  }
  if (id.indexOf('bb-squeeze') >= 0 || id.indexOf('squeeze') >= 0) {
    return {
      stop_loss: side === 'sell' || side === 'short' ? '{{plot_7}}' : '{{plot_6}}',
      tp1: 'ADD_TP1_PLOT_TO_PINE',
      tp2: 'ADD_TP2_PLOT_TO_PINE',
      tp3: 'ADD_TP3_PLOT_TO_PINE',
      note: 'BB Squeeze Data Window 目前只看到多頭/空頭止損，沒有 TP plot；需先在 Pine 補 TP1/TP2/TP3 hidden plots。'
    };
  }
  return {
    stop_loss: '{{plot("SL")}}',
    tp1: '{{plot("TP1")}}',
    tp2: '{{plot("TP2")}}',
    tp3: '{{plot("TP3")}}',
    probability: '{{plot("Probability")}}',
    note: '請確認 Data Window 內存在 SL/TP1/TP2/TP3；若不存在請改用 plot_序號。'
  };
}
function addAlgoProRawPlotPlaceholders(message) {
  for (var i = 0; i <= 17; i++) {
    var key = 'p' + i;
    if (!message[key]) message[key] = '{{plot_' + i + '}}';
  }
  return message;
}
function applySmartTradingViewTemplate(message, strategy, action) {
  var id = String(strategy && strategy.strategy_id || message.strategy || '').toLowerCase();
  if (id.indexOf('algo-pro') < 0 && id.indexOf('algopro') < 0) return message;
  addAlgoProRawPlotPlaceholders(message);
  if (!message.probability || String(message.probability || '').includes('plot("Probability")')) {
    message.probability = '{{plot_9}}';
  }
  var side = String(action || '').toUpperCase();
  var auto = side === 'AUTO' || !side;
  var pairs = [
    ['stop_loss', 'long_stop_loss', 'short_stop_loss', '{{plot_5}}', '{{plot_6}}'],
    ['tp1', 'long_tp1', 'short_tp1', '{{plot_7}}', '{{plot_8}}']
  ];
  pairs.forEach(function (pair) {
    var key = pair[0];
    var longKey = pair[1];
    var shortKey = pair[2];
    var longValue = pair[3];
    var shortValue = pair[4];
    if (auto) {
      if (!message[longKey]) message[longKey] = longValue;
      if (!message[shortKey]) message[shortKey] = shortValue;
    } else if (side === 'LONG' || side === 'BUY') {
      message[key] = message[longKey] || longValue;
      delete message[longKey];
      delete message[shortKey];
    } else if (side === 'SHORT' || side === 'SELL') {
      message[key] = message[shortKey] || shortValue;
      delete message[longKey];
      delete message[shortKey];
    }
  });
  if (!auto) {
    var sideAction = (side === 'LONG' || side === 'BUY') ? 'buy' : 'sell';
    var selectedTickerEl = document.getElementById('tvGenTicker');
    var selectedIntervalEl = document.getElementById('tvGenInterval');
    var selectedTicker = selectedTickerEl ? String(selectedTickerEl.value || '').trim() : '';
    var selectedInterval = selectedIntervalEl ? String(selectedIntervalEl.value || '').trim() : '';
    message.ticker = selectedTicker || message.ticker || '{{ticker}}';
    message.action = sideAction;
    if (!message.entry_price || String(message.entry_price || '').includes('strategy.order')) message.entry_price = '{{close}}';
    if (!message.order_price || String(message.order_price || '').includes('strategy.order')) message.order_price = '{{close}}';
    if (!message.price || String(message.price || '').includes('strategy.order')) message.price = '{{close}}';
    message.close = '{{close}}';
    message.alert_uid = [message.ticker || '{{ticker}}', selectedInterval || '{{interval}}', sideAction, '{{time}}'].join('-');
    delete message.alert_id;
    delete message.order_id;
    delete message.order_comment;
    delete message.contracts;
    delete message.market_position;
    delete message.prev_market_position;
    delete message.long_tp2;
    delete message.short_tp2;
    delete message.long_tp3;
    delete message.short_tp3;
  }
  if (!message.mapping_note) message.mapping_note = 'AlgoPro V1.4 Add placeholder mapping: plot_5 Long SL, plot_6 Short SL, plot_7 Long TP, plot_8 Short TP. p0-p17 are included for backend debug/fallback.';
  return message;
}
function renderTvTemplateString(template, source, strategy) {
  var text = String(template || '').trim();
  if (!text) return '';
  var strategyId = effectiveTvStrategyId(strategy, source);
  return text
    .replace(/\{\{\s*secret\s*\}\}/g, source && source.webhook_secret || '')
    .replace(/\{\{\s*source_id\s*\}\}/g, source && source.source_id || '')
    .replace(/\{\{\s*strategy_id\s*\}\}/g, strategyId)
    .replace(/\{\{\s*dc_strategy\s*\}\}/g, strategyId);
}
function mergeTradingViewTemplate(template, source, strategy, action) {
  var rendered = renderTvTemplateString(template, source, strategy);
  if (!rendered) return null;
  try {
    var message = JSON.parse(rendered);
    var strategyId = effectiveTvStrategyId(strategy, source);
    if (!message.secret) message.secret = source.webhook_secret || '';
    if (!message.source_id) message.source_id = source.source_id || '';
    if (!message.strategy || message.strategy === 'auto') message.strategy = strategyId;
    if (!message.ticker) message.ticker = '{{ticker}}';
    if (!message.exchange) message.exchange = '{{exchange}}';
    if (!message.time) message.time = '{{time}}';
    if (!message.interval) message.interval = '{{interval}}';
    if (!message.alert_id) message.alert_id = '{{ticker}}-{{time}}-' + strategyId + '-{{strategy.order.id}}-{{strategy.order.comment}}';
    return applySmartTradingViewTemplate(message, strategy, action);
  } catch (err) {
    return null;
  }
}
function buildTradingViewAlertMessage() {
  var source = getSelectedTvSource();
  if (!source) return '';
  var strategy = getEffectiveTvStrategy();
  var action = document.getElementById('tvGenAction').value;
  var templated = mergeTradingViewTemplate(strategy && strategy.tv_alert_template, source, strategy, action);
  if (templated) return JSON.stringify(templated, null, 2);
  var levels = tvGeneratorLevels(strategy, action);
  var isOrderFill = action === 'AUTO';
	  var message = {
	    secret: source.webhook_secret || '',
	    source_id: source.source_id || '',
		    strategy: effectiveTvStrategyId(strategy, source),
	    event: 'entry',
	    ticker: '{{ticker}}',
	    exchange: '{{exchange}}',
	    action: isOrderFill ? '{{strategy.order.action}}' : action,
	    order_id: '{{strategy.order.id}}',
	    order_comment: '{{strategy.order.comment}}',
	    entry_price: isOrderFill ? '{{strategy.order.price}}' : '{{close}}',
	    order_price: isOrderFill ? '{{strategy.order.price}}' : '{{close}}',
	    stop_loss: levels.stop_loss,
	    tp1: levels.tp1,
	    tp2: levels.tp2,
	    tp3: levels.tp3,
	    contracts: '{{strategy.order.contracts}}',
	    market_position: '{{strategy.market_position}}',
	    prev_market_position: '{{strategy.prev_market_position}}',
	    price: isOrderFill ? '{{strategy.order.price}}' : '{{close}}',
	    close: '{{close}}',
	    time: '{{time}}',
	    interval: '{{interval}}',
		    alert_id: '{{ticker}}-{{time}}-' + effectiveTvStrategyId(strategy, source) + '-{{strategy.order.id}}-{{strategy.order.comment}}',
	    mapping_note: levels.note
	  };
  Object.keys(levels).forEach(function (key) {
    if (key !== 'note' && message[key] === undefined && levels[key]) message[key] = levels[key];
  });
  if (String(effectiveTvStrategyId(strategy, source)).toLowerCase().indexOf('algo-pro') >= 0) {
    addAlgoProRawPlotPlaceholders(message);
    if (!message.mapping_note) message.mapping_note = 'AlgoPro V1.4 Add placeholder mapping: plot_5 Long SL, plot_6 Short SL, plot_7 Long TP, plot_8 Short TP. p0-p17 are included for backend debug/fallback.';
  }
  return JSON.stringify(message, null, 2);
}
function updateTradingViewGenerator() {
  var source = getSelectedTvSource();
  document.getElementById('tvWebhookUrl').value = source ? location.origin + '/tv/' + source.source_id : '';
  document.getElementById('tvAlertMessage').value = buildTradingViewAlertMessage();
  renderTradingViewReadiness();
}
function renderTradingViewReadiness() {
  var box = document.getElementById('tvReadiness');
  if (!box) return;
  var source = getSelectedTvSource();
  var strategy = getEffectiveTvStrategy();
  var selectedAction = document.getElementById('tvGenAction') ? document.getElementById('tvGenAction').value : 'LONG';
  var tickerEl = document.getElementById('tvGenTicker');
  var ticker = tickerEl ? tickerEl.value : '';
  var allowed = parseJsonList(source && source.allowed_symbols);
  var isAllowed = !!source && (!allowed.length || allowed.indexOf(ticker) >= 0);
  var message = document.getElementById('tvAlertMessage') ? document.getElementById('tvAlertMessage').value : '';
  var parsed = {};
  try { parsed = JSON.parse(message || '{}'); } catch (e) { parsed = {}; }
  var hasLevels = !!(
    parsed.stop_loss || parsed.sl || parsed.long_stop_loss || parsed.short_stop_loss
  ) && !!(
    parsed.tp1 || parsed.long_tp1 || parsed.short_tp1
  );
  var hasEntry = !!(parsed.entry_price || parsed.entry || parsed.order_price || parsed.price || parsed.close);
  var isOrderFill = String(parsed.action || '').indexOf('strategy.order.action') >= 0 || String(parsed.order_price || parsed.entry_price || '').indexOf('strategy.order.price') >= 0;
  var actionText = String(parsed.action || '').toLowerCase();
  var sideSpecific = selectedAction !== 'AUTO';
  var sideOk = sideSpecific
    ? ['buy', 'sell', 'long', 'short'].indexOf(actionText) >= 0 && hasEntry && !isOrderFill
    : isOrderFill;
  var ok = !!source && !!strategy && isAllowed && sideOk;
  box.className = 'preview ' + (ok ? '' : 'warn');
  box.innerHTML =
    '<div>' +
      chip(ticker || '-', ok ? 'green' : 'amber') + ' ' +
      chip(source && source.is_active ? '來源啟用' : '來源未啟用', source && source.is_active ? 'green' : 'red') + ' ' +
      chip(isAllowed ? '品種允許' : '品種未允許', isAllowed ? 'green' : 'red') + ' ' +
      chip(strategy ? strategy.strategy_id : '無策略', strategy ? 'green' : 'red') + ' ' +
      chip(sideSpecific ? '指標 Buy/Sell' : 'Strategy Order', sideOk ? 'green' : 'amber') +
    '</div>' +
    '<b>TradingView 實際設定檢查</b>' +
    '<div>' + (ok
      ? (sideSpecific
        ? '後台已可接收此品種；TV 端請在該圖表建立 AlgoPro 的 ' + (selectedAction === 'SHORT' ? 'Sell Signal' : 'Buy Signal') + ' alert，Webhook 與 Message 使用下方內容。'
        : '後台已可接收此品種；TV 端請建立 Strategy Order fills alert，Webhook 與 Message 使用下方內容。')
      : '此組設定尚未完整：請確認來源啟用、允許品種含 ' + esc(ticker || '該品種') + '、策略有效，且 Message 模式與 TradingView alert condition 一致，並含 entry/price/close。') + '</div>' +
    '<div class="muted">目前後台只能保證 webhook 與訊息格式；TradingView 端仍需實際有該品種 alert 才會送訊號。AlgoPro 指標 alert 請分別建立 Buy Signal 與 Sell Signal。' + (hasLevels ? '目前訊息含指標 SL/TP 欄位。' : '目前訊息未含完整 SL/TP 時，後端會用品種/策略規則補位。') + '</div>';
}
function setSelectValue(id, value) {
  var el = document.getElementById(id);
  if (!el) return;
  var wanted = String(value || '');
  var exists = Array.prototype.slice.call(el.options || []).some(function (option) { return option.value === wanted; });
  if (exists) el.value = wanted;
}
function sampleRiskForTicker(ticker, price) {
  var symbol = String(ticker || '').toUpperCase();
  if (symbol === 'ETH') return Math.max(10, Math.round(Number(price || 0) * 0.006));
  if (symbol === 'XAUUSD' || symbol === 'GC') return 30;
  if (symbol === 'USTEC' || symbol === 'NQ') return 30;
  if (symbol === 'ES') return 10;
  if (symbol === 'CL') return 0.8;
  return Math.max(1, Math.round(Number(price || 0) * 0.003));
}
function buildTradingViewPreviewPayload() {
  var actionValue = document.getElementById('tvGenAction').value;
  var action = actionValue === 'SHORT' ? 'SHORT' : 'LONG';
  var ticker = document.getElementById('tvGenTicker').value;
  var price = Number(document.getElementById('tvGenPrice').value || 0);
  var risk = sampleRiskForTicker(ticker, price);
  var dir = action === 'SHORT' ? -1 : 1;
  var source = getSelectedTvSource();
  var strategy = getEffectiveTvStrategy();
  return {
    source_id: document.getElementById('tvGenSource').value,
    strategy: effectiveTvStrategyId(strategy, source),
    ticker: ticker,
    action: action,
    entry_price: price,
    order_price: price,
    price: price,
    stop_loss: price - dir * risk,
    tp1: price + dir * risk,
    tp2: price + dir * risk * 2,
    tp3: price + dir * risk * 3,
    probability: 68,
    interval: document.getElementById('tvGenInterval').value,
    alert_id: 'admin-preview-' + ticker + '-' + Date.now()
  };
}
function tradingViewScanHelperScript() {
  return "(function(){var selectors='[role=row],[data-name*=alert],[class*=alert],[class*=Alert],div,span';var rows=Array.prototype.slice.call(document.querySelectorAll(selectors)).map(function(el){return (el.innerText||el.textContent||'').replace(/\\s+/g,' ').trim();}).filter(function(text){return text.length>8&&/(ETH|USDT|USTEC|US100|NAS100|XAU|GOLD|NQ|ES|GC|CL|RTY|YM|alert|strategy|bot)/i.test(text);});var uniq=[];rows.forEach(function(text){if(uniq.indexOf(text)<0)uniq.push(text);});var out=uniq.join('\\n');navigator.clipboard.writeText(out).then(function(){alert('已複製 TradingView 可見清單 '+uniq.length+' 行，回 DC 後台貼上即可智慧新增。');},function(){prompt('複製以下內容回 DC 後台：',out);});})();";
}
function renderTvImportPreview(result) {
  var box = document.getElementById('tvImportPreview');
  if (!box) return;
  var matched = result.importedSymbols || [];
  var examples = (result.matches || []).slice(0, 8).map(function (row) {
    return esc((row.symbols || []).join(', ') + ' · ' + row.line);
  }).join('<br>');
  box.className = 'preview ' + (matched.length ? '' : 'warn');
  box.innerHTML =
    '<b>' + esc('已辨識 ' + matched.length + ' 個品種，掃描 ' + (result.scanned || 0) + ' 行') + '</b>' +
    '<div>' + chip(result.strategyId || '-', 'green') + ' ' + chip((result.symbols || []).join(', '), '') + '</div>' +
    (examples ? '<div>' + examples + '</div>' : '<div>沒有從清單中辨識出新符號，已保留來源現有設定。</div>') +
    (result.unresolved && result.unresolved.length ? '<div class="muted">未辨識 ' + esc(result.unresolved.length) + ' 行，可手動檢查或加入品種別名。</div>' : '');
}
function parseJsonList(value) { try { var parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed : []; } catch (e) { return []; } }
function parseObject(value, fallback) { try { var parsed = typeof value === 'string' ? JSON.parse(value || '{}') : value; return parsed && typeof parsed === 'object' ? parsed : (fallback || {}); } catch (e) { return fallback || {}; } }
function formPayload(form) {
  var data = {};
  Array.prototype.slice.call(new FormData(form).entries()).forEach(function (pair) { data[pair[0]] = pair[1]; });
  ['entry_price','stop_loss','tp1','tp2','tp3','probability','tick_size','tick_value','sort_order','default_stop_points','default_tp_spacing'].forEach(function (key) { if (data[key] !== undefined && data[key] !== '') data[key] = Number(data[key]); });
  ['send','is_active','auto_send'].forEach(function (key) { if (data[key] !== undefined) data[key] = data[key] === 'true'; });
  return data;
}
function fillForm(formId, values) {
  var form = document.getElementById(formId);
  if (!form) return;
  Object.keys(values || {}).forEach(function (key) {
    var el = form.elements[key];
    if (!el) return;
    el.value = values[key] == null ? '' : values[key];
  });
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function listText(value) {
  return parseJsonList(value).join(', ');
}
function prettyJson(value, fallback) {
  var parsed = parseObject(value, fallback || {});
  return JSON.stringify(parsed, null, 2);
}
function editSymbol(symbolId) {
  var symbol = (state.data.symbols || []).find(function (row) { return String(row.symbol || '') === String(symbolId || ''); });
  if (!symbol) return;
  fillForm('symbolForm', {
    symbol: symbol.symbol,
    sort_order: symbol.sort_order || 0,
    name: symbol.name || '',
    name_zh: symbol.name_zh || '',
    category: symbol.category || 'index',
    is_active: symbol.is_active ? 'true' : 'false',
    tick_size: symbol.tick_size || 0.25,
    tick_value: symbol.tick_value || 5,
    default_stop_points: symbol.default_stop_points == null ? '' : symbol.default_stop_points,
    default_tp_spacing: symbol.default_tp_spacing == null ? '' : symbol.default_tp_spacing,
    default_level_mode: symbol.default_level_mode || 'auto'
  });
  setMessage('已帶入品種 ' + symbol.symbol + '，修改後按儲存品種', 'ok');
}
function editStrategy(strategyId) {
  var strategy = (state.data.strategies || []).find(function (row) { return String(row.strategy_id || '') === String(strategyId || ''); });
  if (!strategy) return;
  fillForm('strategyForm', {
    strategy_id: strategy.strategy_id,
    sort_order: strategy.sort_order || 0,
    name: strategy.name || '',
    tier: strategy.tier || 'pro',
    is_active: strategy.is_active ? 'true' : 'false',
    signal_types: listText(strategy.signal_types),
    symbols: listText(strategy.symbols),
    description: strategy.description || '',
    rules_json: prettyJson(strategy.rules_json, { riskPoints: 30, targetR: [1, 2, 3], entryMode: 'close' }),
    tv_alert_template: strategy.tv_alert_template || '',
    note: strategy.note || ''
  });
  setMessage('已帶入策略 ' + strategy.strategy_id + '，修改後按儲存策略', 'ok');
}
function editTvSource(sourceId) {
  var source = (state.data.tvSources || []).find(function (row) { return String(row.source_id || '') === String(sourceId || ''); });
  if (!source) return;
  fillForm('tvSourceForm', {
    source_id: source.source_id,
    name: source.name || '',
    webhook_secret: source.webhook_secret || '',
    default_strategy_id: source.default_strategy_id || '',
    default_signal_type: source.default_signal_type || 'auto',
    target_group: source.target_group || 'pro',
    auto_send: source.auto_send ? 'true' : 'false',
    is_active: source.is_active ? 'true' : 'false',
    allowed_symbols: listText(source.allowed_symbols),
    notes: source.notes || ''
  });
  setMessage('已帶入 TV 來源 ' + source.source_id + '，修改後按儲存來源', 'ok');
}
function currentSignalDraft() {
  var form = document.getElementById('signalForm');
  if (!form) return {};
  var data = formPayload(form);
  var select = document.getElementById('signalTicker');
  if (!data.ticker && select && select.value) data.ticker = select.value;
  ['entry_price','stop_loss','tp1','tp2','tp3','probability','signal_type','target_group','send','chart_url','snapshot_url','note'].forEach(function (key) {
    if ((data[key] === undefined || data[key] === '') && form.elements[key]) {
      data[key] = form.elements[key].value;
    }
  });
  ['entry_price','stop_loss','tp1','tp2','tp3','probability'].forEach(function (key) {
    if (data[key] !== undefined && data[key] !== '') data[key] = Number(data[key]);
  });
  if (data.send !== undefined && data.send !== '') data.send = data.send === true || data.send === 'true';
  if (!data.action) {
    var activeAction = document.querySelector('#signalForm [data-action].active');
    data.action = state.action || (activeAction && activeAction.dataset.action) || 'LONG';
  }
  return data;
}
function signalDraftError(data) {
  if (!data.ticker) return '請先選擇品種';
  if (!['LONG', 'SHORT'].includes(String(data.action || '').toUpperCase())) return '請選擇方向';
  if (!data.entry_price || !data.stop_loss || !data.tp1) return '進場、止損、TP1 為必填';
  if (data.action === 'LONG' && Number(data.stop_loss) >= Number(data.entry_price)) return '做多時止損應低於進場';
  if (data.action === 'SHORT' && Number(data.stop_loss) <= Number(data.entry_price)) return '做空時止損應高於進場';
  var targets = [data.tp1, data.tp2, data.tp3].filter(function (value) { return value !== undefined && value !== ''; }).map(Number);
  if (data.action === 'LONG' && targets.some(function (value) { return value <= Number(data.entry_price); })) return '做多時 TP 應高於進場';
  if (data.action === 'SHORT' && targets.some(function (value) { return value >= Number(data.entry_price); })) return '做空時 TP 應低於進場';
  if (data.probability !== undefined && data.probability !== '' && probabilityText(data.probability) === '-') return '機率需介於 0 到 100';
  return '';
}
function updateSignalPreview() {
  var preview = document.getElementById('signalPreview');
  var button = document.getElementById('createSignalBtn');
  var mode = document.getElementById('signalMode');
  if (!preview || !button) return;
  var data = currentSignalDraft();
  var error = signalDraftError(data);
  button.disabled = !!error;
  var sendText = data.send === false ? '只存草稿' : '即時發送';
  if (mode) {
    mode.textContent = sendText;
    mode.className = 'chip ' + (data.send === false ? 'amber' : 'green');
  }
  if (error) {
    preview.className = 'preview signal-preview warn';
    preview.innerHTML = '<b>待完成</b><div>' + esc(error) + '</div>';
    return;
  }
  var risk = Math.abs(Number(data.entry_price) - Number(data.stop_loss));
  var rr = risk > 0 ? (Math.abs(Number(data.tp1) - Number(data.entry_price)) / risk).toFixed(1) : '0.0';
  preview.className = 'preview signal-preview';
  preview.innerHTML =
    '<div>' + chip(sendText, data.send === false ? 'amber' : 'green') + ' ' + chip(data.target_group || 'all', data.target_group === 'vip' ? 'amber' : 'green') + '</div>' +
    '<b>' + esc(data.action + ' ' + data.ticker) + '</b>' +
    '<div>進場 ' + esc(priceText(data.entry_price)) + ' / 止損 ' + esc(priceText(data.stop_loss)) + '</div>' +
    '<div>TP ' + [data.tp1, data.tp2, data.tp3].filter(function (v) { return v !== undefined && v !== ''; }).map(priceText).join(' / ') + '</div>' +
    (data.probability !== undefined && data.probability !== '' ? '<div>機率 ' + esc(probabilityText(data.probability)) + '</div>' : '') +
    '<div class="muted">風險 ' + esc(priceText(risk)) + ' 點 · RR 1:' + esc(rr) + '</div>';
}
function signalPayload(form) {
  var data = formPayload(form);
  var select = document.getElementById('signalTicker');
  if (!data.ticker && select && select.value) data.ticker = select.value;
  ['entry_price','stop_loss','tp1','tp2','tp3','probability','signal_type','target_group','send','chart_url','snapshot_url','note'].forEach(function (key) {
    if ((data[key] === undefined || data[key] === '') && form.elements[key]) {
      data[key] = form.elements[key].value;
    }
  });
  ['entry_price','stop_loss','tp1','tp2','tp3','probability'].forEach(function (key) {
    if (data[key] !== undefined && data[key] !== '') data[key] = Number(data[key]);
  });
  if (data.send !== undefined && data.send !== '') data.send = data.send === true || data.send === 'true';
  if (!data.action) {
    var activeAction = document.querySelector('#signalForm [data-action].active');
    data.action = state.action || (activeAction && activeAction.dataset.action) || 'LONG';
  }
  if (!data.ticker) throw new Error('請先選擇品種');
  return data;
}
function renderAdminTestResult(result) {
  var box = document.getElementById('adminTestResult');
  if (!box) return;
  var ok = Number(result.sent || 0) > 0;
  box.className = 'preview ' + (ok ? '' : 'error');
  box.innerHTML =
    '<div>' + chip(ok ? '測試成功' : '測試失敗', ok ? 'green' : 'red') + ' ' + chip('耗時 ' + esc(result.ms || 0) + 'ms', '') + '</div>' +
    '<b>' + esc((result.sent || 0) + '/' + (result.total || 0) + ' 位管理員收到') + '</b>' +
    '<div class="muted">Signal ' + esc(result.signalUid || '-') + ' · 此訊息未發送給會員。</div>';
}
async function refreshDeliveryDiagnostics() {
  setMessage('刷新投遞診斷中...');
  state.data.deliveryDiagnostics = await api('/api/admin/delivery/diagnostics?limit=60');
  renderDeliveryDiagnostics();
  setMessage('投遞診斷已刷新', 'ok');
}
async function runAdminSignalTest() {
  var payload = currentSignalDraft();
  var error = signalDraftError(payload);
  if (error) throw new Error('測試前請先完成快速發訊欄位：' + error);
  var ok = await confirmAdminAction('測試發給管理員', '只會發送到 ADMIN_IDS，不會通知會員，也不會建立正式訊號。', '發送測試', 'primary');
  if (!ok) return;
  setMessage('發送管理員測試 TG 中...');
  var result = await api('/api/admin/delivery/test-admin', { method: 'POST', body: JSON.stringify(payload) });
  renderAdminTestResult(result);
  await refreshDeliveryDiagnostics();
  setMessage('管理員測試發送完成：' + (result.sent || 0) + '/' + (result.total || 0) + '，' + (result.ms || 0) + 'ms', result.sent ? 'ok' : 'error');
}
function showError(err, fallback) {
  setMessage((err && err.message) || fallback || '操作失敗', 'error');
}
function findSignal(uid) {
  return (state.data.signals || []).find(function (sig) { return sig.signal_uid === uid; }) || {};
}
function dialogField(field) {
  var label = '<label>' + esc(field.label || field.name) + '</label>';
  var value = field.value == null ? '' : String(field.value);
  if (field.type === 'select') {
    return '<div>' + label + '<select name="' + esc(field.name) + '">' + (field.options || []).map(function (option) {
      var optValue = typeof option === 'string' ? option : option.value;
      var optLabel = typeof option === 'string' ? option : option.label;
      var selected = String(optValue) === value ? ' selected' : '';
      return '<option value="' + esc(optValue) + '"' + selected + '>' + esc(optLabel) + '</option>';
    }).join('') + '</select></div>';
  }
  if (field.type === 'checkbox') {
    return '<label class="check-row"><input type="checkbox" name="' + esc(field.name) + '"' + (field.checked === false ? '' : ' checked') + '> ' + esc(field.label || field.name) + '</label>';
  }
  if (field.type === 'textarea') {
    return '<div>' + label + '<textarea name="' + esc(field.name) + '">' + esc(value) + '</textarea></div>';
  }
  return '<div>' + label + '<input name="' + esc(field.name) + '" inputmode="' + esc(field.inputmode || 'text') + '" value="' + esc(value) + '"></div>';
}
function adminDialog(options) {
  var modal = document.getElementById('adminModal');
  var fields = (options.fields || []).map(dialogField).join('');
  modal.innerHTML =
    '<form class="admin-modal-card">' +
      '<header><h3>' + esc(options.title || '確認操作') + '</h3>' + (options.body ? '<p>' + esc(options.body) + '</p>' : '') + '</header>' +
      '<div class="admin-modal-body">' + fields + '</div>' +
      '<div class="admin-modal-actions"><button class="btn ghost" type="button" data-modal-cancel>取消</button><button class="btn ' + esc(options.tone || 'primary') + '" type="submit">' + esc(options.confirmText || '確認') + '</button></div>' +
    '</form>';
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  return new Promise(function (resolve) {
    var form = modal.querySelector('form');
    function onBackdrop(event) {
      if (event.target === modal) done(null);
    }
    function done(value) {
      modal.removeEventListener('click', onBackdrop);
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      modal.innerHTML = '';
      resolve(value);
    }
    modal.querySelector('[data-modal-cancel]').addEventListener('click', function () { done(null); });
    modal.addEventListener('click', onBackdrop);
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var data = {};
      (options.fields || []).forEach(function (field) {
        var el = form.elements[field.name];
        data[field.name] = field.type === 'checkbox' ? !!(el && el.checked) : (el ? el.value : '');
      });
      done(data);
    });
    setTimeout(function () {
      var focusTarget = form.querySelector('input:not([type="checkbox"]), select, textarea, button[type="submit"]');
      if (focusTarget) focusTarget.focus();
    }, 0);
  });
}
function confirmAdminAction(title, body, confirmText, tone) {
  return adminDialog({ title: title, body: body, confirmText: confirmText || '確認', tone: tone || 'primary' });
}
document.getElementById('nav').addEventListener('click', function (event) { var btn = event.target.closest('[data-view]'); if (btn) showView(btn.dataset.view); });
document.body.addEventListener('click', async function (event) {
  try {
    var targetView = event.target.closest('[data-view-target]');
    if (targetView) showView(targetView.dataset.viewTarget);
    var copyBtn = event.target.closest('[data-copy], [data-copy-value], [data-copy-input]');
    if (copyBtn) {
      var value = copyBtn.dataset.copyValue || '';
      if (copyBtn.dataset.copy === 'tv-current') value = document.getElementById('tvWebhookUrl').value;
      if (copyBtn.dataset.copyInput) {
        var copyInput = document.getElementById(copyBtn.dataset.copyInput);
        value = copyInput ? copyInput.value : '';
      }
      if (value && navigator.clipboard) {
        await navigator.clipboard.writeText(value);
        setMessage('已複製到剪貼簿', 'ok');
      }
    }
    var editSymbolBtn = event.target.closest('[data-edit-symbol]');
    if (editSymbolBtn) {
      editSymbol(editSymbolBtn.dataset.editSymbol);
      return;
    }
    var editStrategyBtn = event.target.closest('[data-edit-strategy]');
    if (editStrategyBtn) {
      editStrategy(editStrategyBtn.dataset.editStrategy);
      return;
    }
    var editTvSourceBtn = event.target.closest('[data-edit-tv-source]');
    if (editTvSourceBtn) {
      editTvSource(editTvSourceBtn.dataset.editTvSource);
      return;
    }
    var editEventBtn = event.target.closest('[data-edit-event]');
    if (editEventBtn) {
      editEconomicEvent(editEventBtn.dataset.editEvent);
      return;
    }
    var adminTestSignalBtn = event.target.closest('[data-admin-test-signal]');
    if (adminTestSignalBtn) {
      await runAdminSignalTest();
      return;
    }
    var closeBtn = event.target.closest('[data-close]');
    if (closeBtn) {
      var closeSig = findSignal(closeBtn.dataset.close);
      var closeResult = await adminDialog({
        title: '結案訊號',
        body: (closeSig.ticker || '') + ' ' + actionText(closeSig.action) + ' · 進場 ' + priceText(closeSig.entry_price),
        confirmText: '送出結案',
        tone: 'warn',
        fields: [
          { name: 'price', label: '結案價格', inputmode: 'decimal', value: closeSig.tp1 || closeSig.entry_price || '' },
          { name: 'type', label: '結案類型', type: 'select', value: 'CLOSE', options: ['CLOSE', 'TP1', 'TP2', 'TP3', 'SL'] },
          { name: 'reason', label: '原因備註', value: '手動平倉' },
          { name: 'notify', label: '同步通知 Telegram 會員', type: 'checkbox', checked: true }
        ]
      });
      if (!closeResult) return;
      await api('/api/admin/signals/' + encodeURIComponent(closeBtn.dataset.close) + '/close', { method: 'POST', body: JSON.stringify({ price: Number(closeResult.price), type: closeResult.type, reason: closeResult.reason, notify: closeResult.notify }) });
      await load();
    }
    var sendBtn = event.target.closest('[data-send]');
    if (sendBtn) {
      var sendSig = findSignal(sendBtn.dataset.send);
      var sendOk = await confirmAdminAction('發送草稿訊號', (sendSig.ticker || '') + ' ' + actionText(sendSig.action) + ' 將推送給符合訂閱條件的會員。', '發送', 'primary');
      if (!sendOk) return;
      await api('/api/admin/signals/' + encodeURIComponent(sendBtn.dataset.send) + '/send', { method: 'POST', body: '{}' });
      await load();
    }
    var cancelBtn = event.target.closest('[data-cancel]');
    if (cancelBtn) {
      var cancelSig = findSignal(cancelBtn.dataset.cancel);
      var cancelOk = await confirmAdminAction('取消草稿訊號', (cancelSig.ticker || '') + ' ' + actionText(cancelSig.action) + ' 將標記為取消，不會推送會員。', '取消草稿', 'danger');
      if (!cancelOk) return;
      await api('/api/admin/signals/' + encodeURIComponent(cancelBtn.dataset.cancel) + '/cancel', { method: 'POST', body: '{}' });
      await load();
    }
    var deleteSignalBtn = event.target.closest('[data-delete-signal]');
    if (deleteSignalBtn) {
      var deleteSig = findSignal(deleteSignalBtn.dataset.deleteSignal);
      var deleteOk = await confirmAdminAction(
        '刪除訊號紀錄',
        (deleteSig.ticker || '') + ' ' + actionText(deleteSig.action) + ' · ' + statusText(deleteSig) + '。會一併清除佇列、績效、TV 日誌與自動交易關聯紀錄。',
        '永久刪除',
        'danger'
      );
      if (!deleteOk) return;
      await api('/api/admin/signals/' + encodeURIComponent(deleteSignalBtn.dataset.deleteSignal) + '/delete', { method: 'POST', body: '{}' });
      await load();
      setMessage('訊號紀錄已刪除', 'ok');
    }
    var confirmOrder = event.target.closest('[data-confirm-order]');
    if (confirmOrder) { var orderOk = await confirmAdminAction('確認訂單', '確認後會延長會員期限並通知用戶。', '確認入帳', 'primary'); if (!orderOk) return; await api('/api/admin/orders/' + encodeURIComponent(confirmOrder.dataset.confirmOrder) + '/confirm', { method: 'POST', body: '{}' }); await load(); }
    var rejectOrder = event.target.closest('[data-reject-order]');
    if (rejectOrder) { var reject = await adminDialog({ title: '拒絕訂單', body: '拒絕後會通知用戶原因。', confirmText: '拒絕訂單', tone: 'danger', fields: [{ name: 'reason', label: '拒絕原因', value: '付款未確認' }] }); if (!reject) return; await api('/api/admin/orders/' + encodeURIComponent(rejectOrder.dataset.rejectOrder) + '/reject', { method: 'POST', body: JSON.stringify({ reason: reject.reason }) }); await load(); }
    var refundOrder = event.target.closest('[data-refund-order]');
    if (refundOrder) {
      var refundId = refundOrder.dataset.refundOrder;
      var refundTarget = (state.data.orders || []).find(function (order) { return String(order.order_id || '') === String(refundId || ''); }) || {};
      var refund = await adminDialog({
        title: '記錄退款',
        body: '退款會留下訂單事件與會員通知，可選擇是否同步停用會員權限。',
        confirmText: '記錄退款',
        tone: 'danger',
        fields: [
          { name: 'amount', label: '退款金額', inputmode: 'decimal', value: refundTarget.amount || '' },
          { name: 'reason', label: '退款原因', type: 'textarea', value: '人工退款' },
          { name: 'revoke_access', label: '同步停用此訂單會員權限', type: 'checkbox', checked: true },
          { name: 'notify', label: '通知 Telegram 會員', type: 'checkbox', checked: true }
        ]
      });
      if (!refund) return;
      await api('/api/admin/orders/' + encodeURIComponent(refundId) + '/refund', { method: 'POST', body: JSON.stringify({ amount: Number(refund.amount), reason: refund.reason, revoke_access: refund.revoke_access, notify: refund.notify }) });
      await load();
    }
    var supportReply = event.target.closest('[data-support-reply]');
    if (supportReply) {
      var replyId = supportReply.dataset.supportReply;
      var reply = await adminDialog({
        title: '回覆客服工單',
        body: '回覆會同步通知可接收 Telegram 的會員，並保留在工單紀錄。',
        confirmText: '送出回覆',
        tone: 'primary',
        fields: [{ name: 'message', label: '回覆內容', type: 'textarea', value: '' }]
      });
      if (!reply) return;
      await api('/api/admin/support/' + encodeURIComponent(replyId) + '/reply', { method: 'POST', body: JSON.stringify({ message: reply.message }) });
      await load();
    }
    var supportClose = event.target.closest('[data-support-close]');
    if (supportClose) {
      var closeTicketId = supportClose.dataset.supportClose;
      var closeTicket = await adminDialog({
        title: '結案客服工單',
        body: '結案後會保留歷史紀錄，會員仍可重新建立新工單。',
        confirmText: '結案',
        tone: 'warn',
        fields: [{ name: 'reason', label: '結案原因', value: '客服已結案' }]
      });
      if (!closeTicket) return;
      await api('/api/admin/support/' + encodeURIComponent(closeTicketId) + '/close', { method: 'POST', body: JSON.stringify({ reason: closeTicket.reason }) });
      await load();
    }
    var userTier = event.target.closest('[data-user-tier]');
    if (userTier) { var parts = userTier.dataset.userTier.split('|'); var tierOk = await confirmAdminAction('調整會員等級', '將此用戶升級為 ' + parts[1].toUpperCase() + ' 並增加 30 天。', '套用', 'primary'); if (!tierOk) return; await api('/api/admin/users/' + encodeURIComponent(parts[0]), { method: 'POST', body: JSON.stringify({ tier: parts[1], days: 30 }) }); await load(); }
    var userEdit = event.target.closest('[data-user-edit]');
    if (userEdit) {
      var editUser = findUser(userEdit.dataset.userEdit);
      var edit = await adminDialog({
        title: '編輯會員',
        body: adminUserName(editUser) + ' · ' + (editUser.user_id || ''),
        confirmText: '儲存會員',
        tone: 'primary',
        fields: [
          { name: 'tier', label: '會員等級', type: 'select', value: editUser.tier || 'free', options: [{ value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }, { value: 'vip', label: 'VIP' }] },
          { name: 'days', label: '增加天數（可留空）', inputmode: 'numeric', value: '' },
          { name: 'subscribed_symbols', label: '訂閱品種（逗號分隔，空白代表全部）', type: 'textarea', value: parseJsonList(editUser.subscribed_symbols).join(', ') },
          { name: 'signal_types', label: '訊號類型（scalp, swing, daytrade；空白代表全部）', value: parseJsonList(editUser.signal_types).join(', ') },
          { name: 'notify_entry', label: '接收進場訊號', type: 'checkbox', checked: editUser.notify_entry !== 0 },
          { name: 'notify_tp', label: '接收 TP 通知', type: 'checkbox', checked: editUser.notify_tp !== 0 },
          { name: 'notify_sl', label: '接收止損通知', type: 'checkbox', checked: editUser.notify_sl !== 0 },
          { name: 'notify_alert', label: '接收警報/事件', type: 'checkbox', checked: editUser.notify_alert !== 0 },
          { name: 'paused', label: '暫停此會員接收通知', type: 'checkbox', checked: !!editUser.paused },
          { name: 'admin_note', label: '後台備註', type: 'textarea', value: editUser.admin_note || '' },
          { name: 'is_banned', label: '封禁此會員', type: 'checkbox', checked: !!editUser.is_banned }
        ]
      });
      if (!edit) return;
      await api('/api/admin/users/' + encodeURIComponent(editUser.user_id), { method: 'POST', body: JSON.stringify({ tier: edit.tier, days: Number(edit.days || 0), subscribed_symbols: edit.subscribed_symbols, signal_types: edit.signal_types, notify_entry: edit.notify_entry, notify_tp: edit.notify_tp, notify_sl: edit.notify_sl, notify_alert: edit.notify_alert, paused: edit.paused, admin_note: edit.admin_note, is_banned: edit.is_banned }) });
      await load();
    }
    var userBan = event.target.closest('[data-user-ban]');
    if (userBan) { var banParts = userBan.dataset.userBan.split('|'); var banOk = await confirmAdminAction(banParts[1] === '1' ? '封禁會員' : '解除封禁', '此操作會立即改變用戶狀態。', banParts[1] === '1' ? '封禁' : '解除', banParts[1] === '1' ? 'danger' : 'primary'); if (!banOk) return; await api('/api/admin/users/' + encodeURIComponent(banParts[0]), { method: 'POST', body: JSON.stringify({ is_banned: banParts[1] === '1' }) }); await load(); }
  } catch (err) {
    showError(err);
  }
});
function setSignalAction(action) {
  state.action = action === 'SHORT' ? 'SHORT' : 'LONG';
  var actionInput = document.querySelector('#signalForm [name="action"]');
  if (actionInput) actionInput.value = state.action;
  Array.prototype.slice.call(document.querySelectorAll('#signalForm [data-action]')).forEach(function (el) { el.classList.toggle('active', el.dataset.action === state.action); });
  updateSignalPreview();
}
document.querySelector('.seg').addEventListener('click', function (event) {
  var btn = event.target.closest('[data-action]');
  if (!btn) return;
  setSignalAction(btn.dataset.action);
});
document.getElementById('refreshBtn').addEventListener('click', function () { load().catch(showError); });
var deliveryRefreshBtn = document.getElementById('deliveryRefreshBtn');
if (deliveryRefreshBtn) {
  deliveryRefreshBtn.addEventListener('click', function () {
    refreshDeliveryDiagnostics().catch(function (err) { showError(err, '刷新投遞診斷失敗'); });
  });
}
var dateRangeApply = document.getElementById('dateRangeApply');
if (dateRangeApply) {
  dateRangeApply.addEventListener('click', function () {
    readDateRangeInputs();
    load().catch(showError);
  });
}
Array.prototype.slice.call(document.querySelectorAll('[data-range-preset]')).forEach(function (btn) {
  btn.addEventListener('click', function () {
    setDateRangePreset(btn.dataset.rangePreset);
    load().catch(showError);
  });
});
var rebuildPerformanceBtn = document.getElementById('rebuildPerformanceBtn');
if (rebuildPerformanceBtn) {
  rebuildPerformanceBtn.addEventListener('click', async function () {
    try {
      var range = state.dateRange || {};
      var label = range.all ? '全部歷史資料' : ((range.start || '-') + ' 到 ' + (range.end || '-'));
      var ok = await confirmAdminAction('重建績效與 TP 命中', '將依目前日期範圍重算 ' + label + ' 的訊號結算、TP 命中與 performance 表。最後一筆仍進行中的訊號不會被強制結案。', '開始重建', 'primary');
      if (!ok) return;
      setMessage('重建績效中...');
      var result = await api('/api/admin/signals/rebuild-performance', { method: 'POST', body: JSON.stringify({
        start: range.start || '',
        end: range.end || '',
        limit: range.all ? 5000 : (range.limit || 5000),
        all: !!range.all
      }) });
      state.rebuildResult = result;
      await load();
      state.rebuildResult = result;
      renderSignalAnalytics();
      setMessage('績效重建完成：補結案 ' + (result.closedByNext || 0) + '，TP 補記 ' + (result.tpUpdated || 0), 'ok');
    } catch (err) { showError(err, '重建績效失敗'); }
  });
}
var purgeSignalsBefore = document.getElementById('purgeSignalsBefore');
if (purgeSignalsBefore && !purgeSignalsBefore.value) {
  purgeSignalsBefore.value = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
}
function signalPurgePayload(dryRun) {
  var before = document.getElementById('purgeSignalsBefore');
  var statuses = document.getElementById('purgeSignalsStatuses');
  var limit = document.getElementById('purgeSignalsLimit');
  return {
    before: before ? before.value : '',
    statuses: statuses ? statuses.value : 'closed,cancelled',
    limit: Number(limit && limit.value ? limit.value : 300) || 300,
    dryRun: !!dryRun
  };
}
function renderSignalPurgePreview(result, dryRun) {
  var box = document.getElementById('purgeSignalsPreview');
  if (!box) return;
  var rows = (dryRun ? (result.signals || []) : (result.details || [])).slice(0, 12);
  box.className = 'preview signal-preview ' + ((result.matched || result.deleted) ? '' : 'warn');
  box.innerHTML =
    '<b>' + (dryRun ? '可清理 ' + esc(result.matched || 0) + ' 筆' : '已刪除 ' + esc(result.deleted || 0) + ' 筆') + '</b>' +
    '<div>' + (rows.length ? rows.map(function (row) {
      return esc((row.signal_uid || row.signalUid || '-') + ' · ' + (row.ticker || '-') + ' · ' + (row.status || '-'));
    }).join('<br>') : '沒有符合條件的過時訊號。') + '</div>';
}
async function runSignalPurge(dryRun) {
  var payload = signalPurgePayload(dryRun);
  if (!dryRun) {
    var ok = await confirmAdminAction('刪除過時訊號', '只會刪除符合狀態與日期條件的非進行中訊號，刪除後無法復原。', '確認刪除', 'danger');
    if (!ok) return;
  }
  setMessage(dryRun ? '預覽清理中...' : '清理過時訊號中...');
  var result = await api('/api/admin/signals/purge', { method: 'POST', body: JSON.stringify(payload) });
  renderSignalPurgePreview(result, dryRun);
  if (!dryRun) {
    await load();
    renderSignalPurgePreview(result, dryRun);
  }
  setMessage(dryRun ? '清理預覽完成' : '過時訊號清理完成', 'ok');
}
var previewPurgeSignalsBtn = document.getElementById('previewPurgeSignalsBtn');
if (previewPurgeSignalsBtn) {
  previewPurgeSignalsBtn.addEventListener('click', function () {
    runSignalPurge(true).catch(function (err) { showError(err, '預覽清理失敗'); });
  });
}
var purgeSignalsBtn = document.getElementById('purgeSignalsBtn');
if (purgeSignalsBtn) {
  purgeSignalsBtn.addEventListener('click', function () {
    runSignalPurge(false).catch(function (err) { showError(err, '清理過時訊號失敗'); });
  });
}
document.getElementById('commandSearch').addEventListener('input', function (event) {
  state.query = event.target.value;
  renderSignals();
  renderOrders();
  renderSupport();
  renderUsers();
  renderSymbols();
  renderStrategies();
  renderEconomicEvents();
  renderOverviewTvLogs();
  renderTradingView();
});
var userFilters = document.getElementById('userFilters');
if (userFilters) {
  userFilters.addEventListener('click', function (event) {
    var btn = event.target.closest('[data-user-filter]');
    if (!btn) return;
    state.userFilter = btn.dataset.userFilter || 'all';
    Array.prototype.slice.call(document.querySelectorAll('#userFilters [data-user-filter]')).forEach(function (el) { el.classList.toggle('active', el === btn); });
    renderUsers();
  });
}
document.getElementById('signalFilters').addEventListener('click', function (event) {
  var btn = event.target.closest('[data-filter]');
  if (!btn) return;
  state.signalFilter = btn.dataset.filter;
  Array.prototype.slice.call(document.querySelectorAll('#signalFilters [data-filter]')).forEach(function (el) { el.classList.toggle('active', el === btn); });
  renderSignals();
});
document.getElementById('signalForm').addEventListener('submit', async function (event) {
  event.preventDefault();
  try {
    var submitButton = document.getElementById('createSignalBtn');
    if (submitButton) submitButton.disabled = true;
    setMessage('建立訊號中...');
    await api('/api/admin/signals', { method: 'POST', body: JSON.stringify(signalPayload(event.target)) });
    event.target.reset();
    setSignalAction('LONG');
    await load();
    setMessage('訊號已建立', 'ok');
  } catch (err) { showError(err, '建立訊號失敗'); }
  updateSignalPreview();
});
document.getElementById('signalForm').addEventListener('reset', function () { setTimeout(function () { setSignalAction('LONG'); updateSignalPreview(); }, 0); });
document.getElementById('signalForm').addEventListener('input', updateSignalPreview);
document.getElementById('signalForm').addEventListener('change', updateSignalPreview);
document.getElementById('configForm').addEventListener('submit', async function (event) { event.preventDefault(); try { await api('/api/admin/config', { method: 'PUT', body: JSON.stringify({ config: formPayload(event.target) }) }); await load(); } catch (err) { showError(err, '儲存設定失敗'); } });
document.getElementById('symbolForm').addEventListener('submit', async function (event) { event.preventDefault(); try { await api('/api/admin/symbols', { method: 'POST', body: JSON.stringify(formPayload(event.target)) }); event.target.reset(); await load(); } catch (err) { showError(err, '儲存品種失敗'); } });
document.getElementById('economicForm').addEventListener('submit', async function (event) { event.preventDefault(); try { await api('/api/admin/config', { method: 'PUT', body: JSON.stringify({ config: formPayload(event.target) }) }); await load(); setMessage('經濟事件提醒設定已儲存', 'ok'); } catch (err) { showError(err, '儲存提醒設定失敗'); } });
document.getElementById('econSyncBtn').addEventListener('click', async function () { var btn = this; btn.disabled = true; setMessage('同步財經日曆中...'); try { var res = await api('/api/admin/economic/sync', { method: 'POST', body: '{}' }); await load(); setMessage('已同步 ' + ((res && (res.synced || res.fetched)) || 0) + '/' + ((res && res.total) || 0) + ' 筆重要事件', 'ok'); } catch (err) { showError(err, '同步財經日曆失敗'); } finally { btn.disabled = false; } });
document.getElementById('strategyForm').addEventListener('submit', async function (event) { event.preventDefault(); try { await api('/api/admin/strategies', { method: 'POST', body: JSON.stringify(formPayload(event.target)) }); event.target.reset(); await load(); } catch (err) { showError(err, '儲存策略失敗'); } });
document.getElementById('tvSourceForm').addEventListener('submit', async function (event) { event.preventDefault(); try { await api('/api/admin/tradingview/sources', { method: 'POST', body: JSON.stringify(formPayload(event.target)) }); event.target.reset(); await load(); } catch (err) { showError(err, '儲存 TradingView 來源失敗'); } });
document.getElementById('autoTradeForm').addEventListener('submit', async function (event) { event.preventDefault(); try { await api('/api/admin/config', { method: 'PUT', body: JSON.stringify({ config: formPayload(event.target) }) }); await load(); setMessage('自動交易設定已儲存', 'ok'); } catch (err) { showError(err, '儲存自動交易設定失敗'); } });
document.getElementById('economicEventForm').addEventListener('submit', async function (event) { event.preventDefault(); try { await api('/api/admin/economic-events', { method: 'POST', body: JSON.stringify(formPayload(event.target)) }); event.target.reset(); await load(); setMessage('事件已儲存', 'ok'); } catch (err) { showError(err, '儲存事件失敗'); } });
document.getElementById('economicConfigForm').addEventListener('submit', async function (event) { event.preventDefault(); try { await api('/api/admin/config', { method: 'PUT', body: JSON.stringify({ config: formPayload(event.target) }) }); await load(); setMessage('事件設定已儲存', 'ok'); } catch (err) { showError(err, '儲存事件設定失敗'); } });
document.getElementById('syncEconomicBtn').addEventListener('click', async function () {
  try {
    setMessage('同步經濟事件中...');
    var result = await api('/api/admin/economic-events/sync', { method: 'POST', body: JSON.stringify({ date: (state.data.economic && state.data.economic.today) || todayKey() }) });
    await load();
    setMessage('事件同步完成：' + (result.synced || 0) + '/' + (result.total || 0), 'ok');
  } catch (err) { showError(err, '同步事件失敗'); }
});
document.getElementById('sendEconomicBtn').addEventListener('click', async function () {
  try {
    var ok = await confirmAdminAction('推送今日重要事件', '會依事件設定推送給目標會員，請確認內容已檢查。', '推送', 'primary');
    if (!ok) return;
    var result = await api('/api/admin/economic-events/remind', { method: 'POST', body: JSON.stringify({ date: (state.data.economic && state.data.economic.today) || todayKey() }) });
    await load();
    setMessage('事件提醒已送出：' + (result.sent || 0) + ' 人', 'ok');
  } catch (err) { showError(err, '推送事件提醒失敗'); }
});
['tvGenSource','tvGenStrategy','tvGenTicker','tvGenAction','tvGenInterval','tvGenPrice'].forEach(function (id) {
  document.getElementById(id).addEventListener('change', updateTradingViewGenerator);
  document.getElementById(id).addEventListener('input', updateTradingViewGenerator);
});
document.getElementById('tvGenerateBtn').addEventListener('click', updateTradingViewGenerator);
document.getElementById('tvSmartConfigBtn').addEventListener('click', async function () {
  try {
    var ok = await confirmAdminAction('全部品種智慧設定', '會將目前 TradingView 來源設定為全部啟用品種、AlgoPro 智慧方向模板，並開啟自動發送。TradingView 仍需貼上產生的 Message。', '開始設定', 'primary');
    if (!ok) return;
    setMessage('套用全部品種智慧設定中...');
    var result = await api('/api/admin/tradingview/smart-config', {
      method: 'POST',
      body: JSON.stringify({
        source_id: document.getElementById('tvGenSource').value || 'default-tv',
        strategy: document.getElementById('tvGenStrategy').value && document.getElementById('tvGenStrategy').value !== 'auto' ? document.getElementById('tvGenStrategy').value : 'algo-pro-v1-4'
      })
    });
    await load();
    setSelectValue('tvGenSource', result.sourceId);
    setSelectValue('tvGenStrategy', result.strategyId);
    setSelectValue('tvGenTicker', (result.symbols || []).includes('ETH') ? 'ETH' : (result.symbols || [])[0]);
    setSelectValue('tvGenAction', 'LONG');
    updateTradingViewGenerator();
    document.getElementById('tvWebhookUrl').value = result.webhookUrl;
    document.getElementById('tvPreview').innerHTML =
      '<div>' + chip('智慧設定完成', 'green') + ' ' + chip((result.symbols || []).length + ' 個品種', '') + '</div>' +
      '<b>' + esc(result.strategyId) + '</b>' +
      '<div>來源已允許全部品種。請先複製 Buy Signal Message；切換成 Sell Signal 後再複製一次，分別貼到 TradingView 對應 alert。</div>';
    setMessage('全部品種智慧設定完成', 'ok');
  } catch (err) {
    showError(err, '智慧設定失敗');
  }
});
document.getElementById('tvCopyScanHelperBtn').addEventListener('click', async function () {
  try {
    var script = tradingViewScanHelperScript();
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(script);
      setMessage('已複製 TradingView 掃描助手。到 TV 清單頁貼到 Console 執行，再把結果貼回後台。', 'ok');
    } else {
      document.getElementById('tvImportText').value = script;
      setMessage('掃描助手已放入文字框，可手動複製。', 'ok');
    }
  } catch (err) {
    showError(err, '複製掃描助手失敗');
  }
});
document.getElementById('tvClearImportBtn').addEventListener('click', function () {
  document.getElementById('tvImportText').value = '';
  document.getElementById('tvImportPreview').innerHTML = '<b>尚未匯入</b><div>貼上 TradingView alert / bot 清單後可智慧新增。</div>';
});
document.getElementById('tvSmartImportBtn').addEventListener('click', async function () {
  try {
    var text = document.getElementById('tvImportText').value.trim();
    if (!text) throw new Error('請先貼上 TradingView bot / alert 清單');
    setMessage('解析 TradingView 清單中...');
    var result = await api('/api/admin/tradingview/smart-import', {
      method: 'POST',
      body: JSON.stringify({
        source_id: document.getElementById('tvGenSource').value || 'default-tv',
        strategy: document.getElementById('tvGenStrategy').value && document.getElementById('tvGenStrategy').value !== 'auto' ? document.getElementById('tvGenStrategy').value : 'algo-pro-v1-4',
        text: text
      })
    });
    await load();
    setSelectValue('tvGenSource', result.sourceId);
    setSelectValue('tvGenStrategy', result.strategyId);
    if ((result.importedSymbols || []).length) setSelectValue('tvGenTicker', result.importedSymbols[0]);
    setSelectValue('tvGenAction', 'LONG');
    updateTradingViewGenerator();
    document.getElementById('tvWebhookUrl').value = result.webhookUrl;
    renderTvImportPreview(result);
    setMessage('TV 清單智慧新增完成', 'ok');
  } catch (err) {
    showError(err, '智慧匯入失敗');
  }
});
document.getElementById('tvPreviewBtn').addEventListener('click', async function () {
  try {
    var payload = buildTradingViewPreviewPayload();
    var result = await api('/api/admin/tradingview/preview', { method: 'POST', body: JSON.stringify(payload) });
    var s = result.signal;
    document.getElementById('tvPreview').innerHTML =
      '<div>' + chip(result.strategy.name, s.target_group === 'vip' ? 'amber' : 'green') + ' ' + chip(s.signal_type, '') + '</div>' +
      '<b>' + esc(s.action + ' ' + s.ticker) + '</b>' +
      '<div>Entry ' + esc(s.entry_price) + ' / SL ' + esc(s.stop_loss) + ' / TP ' + esc([s.tp1, s.tp2, s.tp3].filter(Boolean).join(' / ')) + '</div>' +
      (s.probability != null ? '<div>Prob ' + esc(probabilityText(s.probability)) + '</div>' : '');
  } catch (err) {
    showError(err, '預覽 TradingView 訊號失敗');
  }
});
document.getElementById('tvFallbackPreviewBtn').addEventListener('click', async function () {
  try {
    var base = buildTradingViewPreviewPayload();
    delete base.stop_loss;
    delete base.tp1;
    delete base.tp2;
    delete base.tp3;
    var result = await api('/api/admin/tradingview/fallback-preview', { method: 'POST', body: JSON.stringify(base) });
    document.getElementById('tvPreview').innerHTML =
      '<div>' + chip('補位測試', 'amber') + ' ' + chip(result.basis || '-', result.basis === 'indicator' ? 'green' : 'amber') + ' ' + chip(result.mode || '-', '') + '</div>' +
      '<b>' + esc(result.action + ' ' + result.ticker) + '</b>' +
      '<div>Entry ' + esc(priceText(result.entry)) + ' / SL ' + esc(priceText(result.stop_loss)) + ' / TP ' + esc([result.tp1, result.tp2, result.tp3].filter(function (v) { return v != null; }).map(priceText).join(' / ')) + '</div>' +
      '<div class="muted">' + esc(result.warning || '') + '</div>';
  } catch (err) {
    showError(err, '補 SL/TP 測試失敗');
  }
});
load().catch(function (err) { setMessage(err.message, 'error'); });
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Cron Jobs
// ═══════════════════════════════════════════════════════════════════════════════

async function handleExpireCheck(env) {
  const db = env.DB;

  // 過期會員降級
  const expired = await db.prepare(`
    SELECT user_id FROM users
    WHERE tier != 'free' AND tier_expires_at < datetime('now') AND is_active = 1
  `).all();

  let count = 0;
  for (const user of expired.results || []) {
    await updateUser(db, user.user_id, { tier: 'free', tier_expires_at: null });
    await sendMemberNotice(user.user_id, `⚠️ 您的會員已到期\n\n已降為免費會員\n使用 /plans 續費`, null, { db });
    count++;
  }

  return { expired: count };
}

async function handleExpireReminder(env) {
  const db = env.DB;

  // 3天內到期提醒
  const expiring = await db.prepare(`
    SELECT user_id, tier, tier_expires_at FROM users
    WHERE tier != 'free'
      AND tier_expires_at > datetime('now')
      AND tier_expires_at < datetime('now', '+3 days')
      AND is_active = 1
  `).all();

  let count = 0;
  for (const user of expiring.results || []) {
    const days = daysLeft(user.tier_expires_at);
    await sendMemberNotice(user.user_id, `⏰ <b>會員即將到期</b>\n\n您的 ${tierName(user.tier)} 將在 <b>${days}</b> 天後到期\n\n👉 /renew 立即續費`, null, { db });
    count++;
  }

  return { reminded: count };
}

async function handleQueuedSignals(env) {
  const db = env.DB;
  await addColumnIfMissing(db, 'queued_signals', 'photo_url', 'TEXT');

  // 發送待發訊號
  const queued = await db.prepare(`
    SELECT * FROM queued_signals
    WHERE sent = 0 AND scheduled_at < datetime('now')
  `).all();

  let count = 0;
  for (const q of queued.results || []) {
    if (!isTelegramChatId(q.user_id)) {
      await db.prepare(`UPDATE queued_signals SET sent = 1 WHERE id = ?`).bind(q.id).run();
      continue;
    }
    let result = null;
    if (q.photo_url) {
      result = await sendTgPhoto(q.user_id, q.photo_url, q.message);
    }
    if (!result?.ok) result = await sendTg(q.user_id, q.message);
    if (result?.ok) {
      await db.prepare(`UPDATE queued_signals SET sent = 1 WHERE id = ?`).bind(q.id).run();
      count++;
    }
  }

  return { sent: count };
}

async function handleSecurityCleanup(env) {
  const db = env.DB;
  await ensureRateLimitSchema(db);
  const cutoff = Date.now() - 86400000;
  const result = await db.prepare('DELETE FROM rate_limits WHERE reset_at_ms < ?').bind(cutoff).run();
  return { rateLimitsDeleted: result?.meta?.changes || 0 };
}

async function handleEconomicEventsCron(env, options = {}) {
  let weekly;
  try {
    weekly = await maybeSyncWeeklyEconomicEvents(env, { date: options.date, force: options.force || options.forceWeekly });
  } catch (e) {
    weekly = { ok: false, error: e?.message || String(e) };
    await logAction(env.DB, 'economic:cron', 'economic_weekly_sync_failed', options.date || taipeiDateKey(), weekly.error);
  }
  const daily = await sendEconomicEventsReminder(env, options);
  const upcoming = await sendEconomicPreEventAlerts(env, options);
  return { weekly, daily, upcoming };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 主處理器
// ═══════════════════════════════════════════════════════════════════════════════

function webhookResponse(result) {
  return result instanceof Response ? result : json(result || { ok: true });
}

async function handleWebhook(request, env) {
  const db = env.DB;

  try {
    const update = await request.json();

    // 處理 Callback
    if (update.callback_query) {
      const cb = update.callback_query;
      const cid = cb.message?.chat?.id;
      const uid = String(cb.from?.id);
      const msgId = cb.message?.message_id;
      const data = cb.data;

      // 管理員 Callback
      if (isAdmin(uid) && (data.startsWith('a_') || data.startsWith('adm_'))) {
        return webhookResponse(await handleAdminCallback(cid, uid, msgId, data, env, cb.id));
      }

      // 用戶 Callback
      return webhookResponse(await handleUserCallback(cid, uid, msgId, data, env, cb.id));
    }

    // 處理訊息
    if (update.message?.text) {
      const msg = update.message;
      const cid = msg.chat.id;
      const uid = String(msg.from.id);
      const text = msg.text.trim();
      const username = msg.from.username;
      const firstName = msg.from.first_name;

      // 更新用戶資訊
      await getUser(db, uid);
      await saveUserInfo(db, uid, username, firstName);

      // 解析指令
      const parts = text.split(/\s+/);
      const cmd = parts[0].toLowerCase().split('@')[0];
      const args = parts.slice(1);
      const fullText = parts.slice(1).join(' ');

      // 管理員指令
      if (isAdmin(uid)) {
        const adminResult = await handleAdminCommand(cid, uid, cmd, args, fullText, env);
        if (adminResult) return webhookResponse(adminResult);
      }

      // 用戶指令
      const userResult = await handleUserCommand(cid, uid, cmd, args, env);
      if (userResult) return webhookResponse(userResult);
    }

    return json({ ok: true });
  } catch (e) {
    console.error('Webhook error:', e);
    return json({ error: e.message }, 500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Worker 入口
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  async fetch(request, env, ctx) {
    loadRuntimeConfig(env);
    const url = new URL(request.url);
    const cardMatch = url.pathname.match(/^\/signal-card\/([^/]+)\.svg$/);
    if (cardMatch) {
      return renderSignalCardResponse(env.DB, decodeURIComponent(cardMatch[1]));
    }

    const oauthMatch = url.pathname.match(/^\/auth\/(google)\/(start|callback)$/);
    if (oauthMatch && request.method === 'GET') {
      return oauthMatch[2] === 'start'
        ? handleOAuthStart(request, env, oauthMatch[1])
        : handleOAuthCallback(request, env, oauthMatch[1], url);
    }

    if (url.pathname === '/admin/logout') {
      return adminHtmlResponse(renderAdminLoginPage('已安全登出。', 'ok'), 200, {
        'Set-Cookie': clearAdminSessionCookie(request)
      });
    }

    if (url.pathname === '/admin/login' && request.method === 'POST') {
      return handleAdminLogin(request, env);
    }
    if (url.pathname === '/admin/login' && request.method === 'GET') {
      return adminHtmlResponse(renderAdminLoginPage(), 200);
    }

    if (url.pathname === '/admin' || url.pathname === '/admin/') {
      const auth = await requireAdminRequest(request, env);
      if (auth) return auth;
      const csrf = isAdminHttpRequest(request, env) ? 'basic' : (await verifyAdminSession(request, env))?.csrf || '';
      return adminHtmlResponse(renderAdminPage(csrf), 200, { 'Cache-Control': 'no-store' });
    }

    if (url.pathname.startsWith('/api/admin/')) {
      return handleAdminApi(request, env, url.pathname, ctx);
    }

    if (url.pathname === '/terms' || url.pathname === '/terms/') {
      return html(renderTermsPage(), 200, { 'Cache-Control': 'no-store' });
    }
    if (url.pathname === '/risk-disclosure' || url.pathname === '/risk-disclosure/' || url.pathname === '/risk' || url.pathname === '/risk/') {
      return html(renderRiskDisclosurePage(), 200, { 'Cache-Control': 'no-store' });
    }
    if (url.pathname === '/privacy' || url.pathname === '/privacy/') {
      return html(renderPrivacyPage(), 200, { 'Cache-Control': 'no-store' });
    }
    if (url.pathname === '/refund' || url.pathname === '/refund/') {
      return html(renderRefundPolicyPage(), 200, { 'Cache-Control': 'no-store' });
    }

    const memberReceiptMatch = url.pathname.match(/^\/(?:member|m)\/receipt\/([^/]+)$/);
    if (memberReceiptMatch && request.method === 'GET') {
      return handleMemberReceiptPage(request, env, decodeURIComponent(memberReceiptMatch[1]));
    }

    if (['/m', '/m/', '/member', '/member/', '/login', '/login/'].includes(url.pathname)) {
      return html(renderMemberPage(), 200, { 'Cache-Control': 'no-store' });
    }

    if (url.pathname.startsWith('/api/member/')) {
      return handleMemberApi(request, env, url.pathname);
    }

    if (url.pathname === '/webhook/stripe' && request.method === 'POST') {
      return handleStripeWebhook(request, env);
    }

    if (url.pathname === '/auto-trade/poll' && (request.method === 'GET' || request.method === 'POST')) {
      return handleAutoTradeBridgePoll(request, env);
    }

    if ((url.pathname === '/webhook/auto-trade' || url.pathname === '/auto-trade/ack') && request.method === 'POST') {
      return handleAutoTradeBridgeAck(request, env);
    }

    const tvMatch = url.pathname.match(/^\/(?:tv|tradingview|webhook\/tradingview)\/([A-Za-z0-9-]+)$/);
    if (tvMatch && request.method === 'POST') {
      return handleTradingViewWebhook(request, env, tvMatch[1], url, ctx);
    }

    if (url.pathname === '/' && (request.method === 'GET' || request.method === 'HEAD')) {
      return Response.redirect(`${url.origin}${MEMBER_PORTAL_PATH}`, 302);
    }

    // 健康檢查
    if (url.pathname === '/health') {
      return json({
        status: 'ok',
        version: CONFIG.VERSION,
        build: CONFIG.BUILD,
        time: fmtTime()
      });
    }

    // Webhook
    if (url.pathname === '/webhook' && request.method === 'POST') {
      return handleWebhook(request, env);
    }

    // Cron - 過期檢查
    if (url.pathname === '/cron/expire') {
      const auth = requireCronHttp(request, env, url);
      if (auth) return auth;
      const result = await handleExpireCheck(env);
      return json({ ok: true, ...result });
    }

    // Cron - 到期提醒
    if (url.pathname === '/cron/remind') {
      const auth = requireCronHttp(request, env, url);
      if (auth) return auth;
      const result = await handleExpireReminder(env);
      return json({ ok: true, ...result });
    }

    // Cron - 待發訊號
    if (url.pathname === '/cron/queued') {
      const auth = requireCronHttp(request, env, url);
      if (auth) return auth;
      const result = await handleQueuedSignals(env);
      return json({ ok: true, ...result });
    }

    if (url.pathname === '/cron/security-cleanup') {
      const auth = requireCronHttp(request, env, url);
      if (auth) return auth;
      const result = await handleSecurityCleanup(env);
      return json({ ok: true, ...result });
    }

    // Cron - 經濟事件同步與提醒
    if (url.pathname === '/cron/econ') {
      const auth = requireCronHttp(request, env, url);
      if (auth) return auth;
      const result = await handleEconomicEventsCron(env, {
        force: url.searchParams.get('force') === '1',
        date: url.searchParams.get('date') || taipeiDateKey()
      });
      return json({ ok: true, ...result });
    }

    if (url.pathname === '/cron/economic-events') {
      const auth = requireCronHttp(request, env, url);
      if (auth) return auth;
      const result = await handleEconomicEventsCron(env, {
        force: url.searchParams.get('force') === '1',
        date: url.searchParams.get('date') || taipeiDateKey()
      });
      return json({ ok: true, ...result });
    }

    return json({ error: 'Not found' }, 404);
  },

  async scheduled(event, env, ctx) {
    loadRuntimeConfig(env);
    // 每日 00:00 - 過期檢查
    // 每日 08:00 - 到期提醒
    // 每小時 - 待發訊號

    const hour = new Date().getUTCHours();

    if (hour === 16) { // UTC 16 = 台北 00:00
      await handleExpireCheck(env);
    }

    if (hour === 0) { // UTC 0 = 台北 08:00
      await handleExpireReminder(env);
    }

    await handleQueuedSignals(env);
    await handleSecurityCleanup(env);
    // 每小時同步財經日曆並在高影響事件前提醒付費會員
    try {
      await handleEconomicEventsCron(env);
    } catch (e) {
      // 新版經濟事件同步失敗不影響其他排程
    }
  }
};
