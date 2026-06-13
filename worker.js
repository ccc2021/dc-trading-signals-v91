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
    forex: { name: '外匯', emoji: '💱' }
  },
  
  // 訊號類型
  SIGNAL_TYPES: {
    scalp: { name: '短線訊號', emoji: '⚡', desc: '持倉數分鐘~數小時' },
    swing: { name: '波段訊號', emoji: '📈', desc: '持倉數小時~數天' },
    daytrade: { name: '日內訊號', emoji: '🎯', desc: '當日開平倉' }
  },
  
  // 訊號動作
  ACTIONS: {
    LONG:  { emoji: '🟢', name: '做多' },
    SHORT: { emoji: '🔴', name: '做空' }
  }
};

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
const isAdmin = (id) => CONFIG.ADMIN_IDS.includes(String(id));
const tierName = (t) => (CONFIG.TIERS[t]?.emoji || '👤') + ' ' + (CONFIG.TIERS[t]?.name || '免費會員');
const tierEmoji = (t) => CONFIG.TIERS[t]?.emoji || '👤';
const fmtNum = (n) => n?.toLocaleString() || '0';
const fmtPrice = (n) => n?.toFixed(2) || '0.00';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('zh-TW') : '-';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '-';
const fmtTime = () => new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
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

async function sendMemberNotice(userId, text, kb = null, options = {}) {
  if (!isTelegramChatId(userId)) return { ok: false, skipped: true };
  return sendTg(userId, text, kb, options);
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
      subscribed_symbols: '["NQ","ES","GC","USTEC","XAUUSD"]',
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

async function setConfig(db, key, value) {
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

  let msg = `${actionInfo.emoji || ''} <b>${escHtml(action)} ${escHtml(ticker)}</b>\n`;
  msg += `${typeInfo.emoji || ''} ${escHtml(typeInfo.name || signal_type)} · ${escHtml(tierLine)}\n\n`;

  msg += `💰 進場　<code>${fmtPrice(entry_price)}</code>\n`;
  msg += `🛑 止損　<code>${fmtPrice(stop_loss)}</code>\n\n`;

  if (tp1) msg += `🎯 TP1　<code>${fmtPrice(tp1)}</code>\n`;
  if (tp2) msg += `🎯 TP2　<code>${fmtPrice(tp2)}</code>\n`;
  if (tp3 && isVip) msg += `🎯 TP3　<code>${fmtPrice(tp3)}</code>　VIP\n`;
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
  return signalMediaUrl(signal) ? { disablePreview: false } : {};
}

function publicBaseUrl(env = {}) {
  return String(env.PUBLIC_BASE_URL || env.MEMBER_WEB_URL || env.PUBLIC_MEMBER_URL || 'https://dc-signals-v91.cc559773.workers.dev').replace(/\/+$/, '');
}

function signalCardPublicUrl(signal, env = {}) {
  if (!signal?.signal_uid) return '';
  return `${publicBaseUrl(env)}/signal-card/${encodeURIComponent(signal.signal_uid)}.svg`;
}

function signalMediaUrl(signal) {
  return firstUrl(signal?.snapshot_url) || firstUrl(signal?.chart_url) || firstUrl(signal?.note);
}

function signalPhotoUrl(signal, env = {}) {
  return firstUrl(signal?.snapshot_url) || signalCardPublicUrl(signal, env);
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
  m += `選擇訂閱時長，系統會建立付款訂單。`;
  const buttons = [
    [{ text: `1個月 NT$${prices[1]}`, callback_data: `buy_${tier}_1` }],
    [{ text: `3個月 NT$${prices[3]} (省10%)`, callback_data: `buy_${tier}_3` }],
    [{ text: `12個月 NT$${prices[12]} (省20%)`, callback_data: `buy_${tier}_12` }],
    [{ text: '« 返回', callback_data: 'u_plans' }]
  ];
  return editTg(cid, msgId, m, { inline_keyboard: buttons });
}

function renderUserMenuText(user) {
  const dl = user.tier !== 'free' ? daysLeft(user.tier_expires_at) : 0;
  let m = `<b>DC Trading Signals</b>\n\n`;
  m += `${escHtml(user.first_name || '用戶')} · ${tierName(user.tier)}\n`;
  if (user.tier !== 'free') m += `剩餘 <b>${dl}</b> 天\n`;
  m += `\n選擇要操作的功能。`;
  return m;
}

function renderUserMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '最新訊號', callback_data: 'u_signals' },
        { text: '我的績效', callback_data: 'u_mystats' }
      ],
      [
        { text: '訂閱設定', callback_data: 'u_subscribe' },
        { text: '個人設定', callback_data: 'u_settings' }
      ],
      [
        { text: '升級會員', callback_data: 'u_plans' },
        { text: '邀請好友', callback_data: 'u_invite' }
      ],
      [
        { text: '會員中心', callback_data: 'u_login' }
      ],
      [
        { text: '聯繫客服', callback_data: 'u_contact' },
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
  const side = sig.action === 'LONG' ? 'LONG' : sig.action === 'SHORT' ? 'SHORT' : sig.action;
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

async function broadcastSignal(db, signal, env = {}) {
  await addColumnIfMissing(db, 'queued_signals', 'photo_url', 'TEXT');
  // 取得所有付費會員
  const users = await db.prepare(`
    SELECT u.user_id, u.tier, us.*
    FROM users u
    LEFT JOIN user_settings us ON u.user_id = us.user_id
    WHERE u.is_active = 1 AND u.is_banned = 0 AND u.tier != 'free'
      AND (u.tier_expires_at IS NULL OR u.tier_expires_at > datetime('now'))
  `).all();
  
  let sent = 0, queued = 0, skipped = 0;
  
  for (const user of users.results || []) {
    if (!isTelegramChatId(user.user_id)) {
      skipped++;
      continue;
    }

    // 檢查是否應該收到
    const shouldReceive = await shouldReceiveSignal(db, user.user_id, signal);
    if (!shouldReceive) {
      skipped++;
      continue;
    }
    
    // 檢查通知設定
    if (!user.notify_entry) {
      skipped++;
      continue;
    }
    
    // 格式化訊號（個人化）
    const isVip = user.tier === 'vip';
    const msg = formatSignalCard(signal, user, isVip);
    
    // 檢查安靜時段
    if (await isInQuietHours(user)) {
      // 加入待發佇列
      const quietEnd = user.quiet_end;
      await db.prepare(`
        INSERT INTO queued_signals (user_id, signal_uid, message, photo_url, scheduled_at)
        VALUES (?, ?, ?, ?, datetime('now', '+8 hours'))
      `).bind(user.user_id, signal.signal_uid, msg, signalPhotoUrl(signal, env) || null).run();
      queued++;
      continue;
    }
    
    // 發送訊號
    const kb = {
      inline_keyboard: [[
        { text: '已執行', callback_data: `exec_${signal.signal_uid}` },
        { text: '跳過', callback_data: `skip_${signal.signal_uid}` }
      ]]
    };
    
	    const r = await sendSignalTg(user.user_id, signal, msg, kb, env);
    if (r?.ok) sent++; else skipped++;
    
    // 避免頻率限制
    if (sent % 20 === 0) await new Promise(r => setTimeout(r, 100));
  }
  
  return { sent, queued, skipped, total: (users.results || []).length };
}

async function broadcastExit(db, type, ticker, price, pnl, note, signalUid) {
  const users = await db.prepare(`
    SELECT u.user_id, us.notify_tp, us.notify_sl
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
    
    const r = await sendTg(user.user_id, msg);
    if (r?.ok) sent++;
    
    if (sent % 20 === 0) await new Promise(r => setTimeout(r, 100));
  }
  
  return { sent };
}

async function broadcastMessage(db, message, targetGroup = 'all', notifyType = 'announcement') {
  let query = `
    SELECT u.user_id, us.*
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
      const r = await sendTg(m.user_id, message);
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
    
    const r = await sendTg(user.user_id, message);
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
    
    return sendTg(cid, renderUserMenuText(user), renderUserMenuKeyboard());
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
  if (cmd === '/mystats' || cmd === '/perf') {
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
    m += `\n我們會盡快回覆您！`;
    
    return sendTg(cid, m);
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
    m += `/contact - 聯繫客服\n\n`;
    
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
    m += `/mystats - 我的績效\n\n`;
    
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
  const user = await getUser(db, uid);
  const settings = await getUserSettings(db, uid);
  data = normalizeUserCallback(data);
  await answerCb(cbId);
  
  // 返回主選單
  if (data === 'u_menu') {
    return editTg(cid, msgId, renderUserMenuText(user), renderUserMenuKeyboard());
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
  if (data === 'u_active') return handleUserCommand(cid, uid, '/active', [], env);
  if (data === 'u_mystats') return handleUserCommand(cid, uid, '/mystats', [], env);
  if (data === 'u_plans') return handleUserCommand(cid, uid, '/plans', [], env);
  if (data === 'u_login') return handleUserCommand(cid, uid, '/login', [], env);
  if (data === 'u_status') return handleUserCommand(cid, uid, '/status', [], env);
  if (data === 'u_invite') return handleUserCommand(cid, uid, '/invite', [], env);
  if (data === 'u_contact') return handleUserCommand(cid, uid, '/contact', [], env);
  if (data === 'u_help') return handleUserCommand(cid, uid, '/help', [], env);
  if (data === 'u_checkin') return handleUserCommand(cid, uid, '/checkin', [], env);
  if (data === 'u_trial') return handleUserCommand(cid, uid, '/trial', [], env);
  if (data === 'u_points') return handleUserCommand(cid, uid, '/points', [], env);
  if (data === 'u_history') return handleUserCommand(cid, uid, '/history', [], env);
  if (data === 'u_renew') return handleUserCommand(cid, uid, '/renew', [], env);
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
    
    await db.prepare(`
      INSERT INTO orders (order_id, user_id, tier, months, days, amount, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(orderId, uid, tier, months, days, price).run();
    await recordOrderEvent(db, orderId, uid, 'created', uid, `Telegram 建立 ${tierName(tier)} ${months} 個月訂單`, {
      tier,
      months,
      amount: price,
      paymentProvider: 'manual'
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
      [{ text: '取消訂單', callback_data: `cancel_${orderId}` }],
      [{ text: '聯繫客服', callback_data: 'u_contact' }]
    ];
    
    // 通知管理員
    for (const adminId of CONFIG.ADMIN_IDS) {
      await sendTg(adminId, `📋 新訂單！\n\n用戶：${user.username ? '@' + user.username : user.first_name || uid}\nID：<code>${uid}</code>\n訂單：<code>${orderId}</code>\n方案：${tierName(tier)} ${months}個月\n金額：NT$${price}`);
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
    await db.prepare(`UPDATE orders SET status = 'paid', payment_note = '用戶已通知付款' WHERE order_id = ?`).bind(orderId).run();
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
    
    return editTg(cid, msgId, m, { inline_keyboard: [[{ text: '« 返回', callback_data: 'u_menu' }]] });
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
    return editTg(cid, msgId, `❌ 訂單已取消\n\n如需重新訂閱，請使用 /plans`, { inline_keyboard: [[{ text: '« 返回', callback_data: 'u_menu' }]] });
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
      `${CONFIG.ACTIONS[action].emoji} ${action} ${ticker}\n` +
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
      `${CONFIG.ACTIONS[action].emoji} ${action} ${ticker}\n` +
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
    
    // 找到對應訊號
    const signal = await db.prepare(`
      SELECT * FROM signals WHERE ticker = ? AND action IN ('LONG', 'SHORT') AND status = 'active' 
      ORDER BY created_at DESC LIMIT 1
    `).bind(ticker).first();
    
    let pnl = null;
    if (signal) {
      pnl = signal.action === 'LONG' ? price - signal.entry_price : signal.entry_price - price;
      
      // 記錄績效
      await db.prepare(`
        INSERT INTO performance (signal_uid, ticker, direction, signal_type, entry_price, exit_price, pnl_points, result, exit_reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'win', ?, datetime('now'))
      `).bind(signal.signal_uid, ticker, signal.action, signal.signal_type, signal.entry_price, price, pnl, type).run();
    }
    
    const result = await broadcastExit(db, type, ticker, price, pnl, '恭喜獲利！🎉', signal?.signal_uid);
    
    await logAction(db, uid, type, ticker, `${fmtPrice(price)}`);
    
    return sendTg(cid, `✅ ${type} 已發送\n${ticker} @ ${fmtPrice(price)}\n盈虧：${pnl !== null ? (pnl >= 0 ? '+' : '') + fmtPrice(pnl) + '點' : '-'}\n發送：${result.sent} 人`);
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
      pnl = signal.action === 'LONG' ? price - signal.entry_price : signal.entry_price - price;
      
      await db.prepare(`UPDATE signals SET status = 'closed', exit_price = ?, pnl_points = ?, result = 'loss', closed_at = datetime('now') WHERE signal_uid = ?`).bind(price, pnl, signal.signal_uid).run();
      
      await db.prepare(`
        INSERT INTO performance (signal_uid, ticker, direction, signal_type, entry_price, exit_price, pnl_points, result, exit_reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'loss', 'SL', datetime('now'))
      `).bind(signal.signal_uid, ticker, signal.action, signal.signal_type, signal.entry_price, price, pnl).run();
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
      pnl = signal.action === 'LONG' ? price - signal.entry_price : signal.entry_price - price;
      resultType = pnl > 0.5 ? 'win' : pnl < -0.5 ? 'loss' : 'breakeven';
      
      await db.prepare(`UPDATE signals SET status = 'closed', exit_price = ?, pnl_points = ?, result = ?, exit_reason = ?, closed_at = datetime('now') WHERE signal_uid = ?`).bind(price, pnl, resultType, reason, signal.signal_uid).run();
      
      await db.prepare(`
        INSERT INTO performance (signal_uid, ticker, direction, signal_type, entry_price, exit_price, pnl_points, result, exit_reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CLOSE', datetime('now'))
      `).bind(signal.signal_uid, ticker, signal.action, signal.signal_type, signal.entry_price, price, pnl, resultType).run();
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
          { text: '🟢 做多', callback_data: 'a_help_long' },
          { text: '🔴 做空', callback_data: 'a_help_short' }
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
          { text: '🩺 營運', callback_data: 'a_ops' }
        ],
        [
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
    
    await sendMemberNotice(userId, `🎉 恭喜！您已升級為 ${tierName(tier)}\n\n天數：${days} 天\n到期：${fmtDate(expires)}\n\n請使用 /subscribe 設定您想接收的品種`);
    
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
    
    await sendMemberNotice(userId, `🎉 您的會員已延長 <b>${days}</b> 天！\n新到期日：${fmtDate(newExpiry)}`);
    
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
    const result = await sendMemberNotice(userId, `<b>管理員訊息</b>\n\n${escHtml(message)}`);
    return sendTg(cid, result?.ok ? `✅ 訊息已發送給 <code>${userId}</code>` : `❌ 發送失敗`);
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
    m += `拒絕：/reject [訂單ID]`;
    
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
    await sendMemberNotice(order.user_id, `❌ <b>訂單已取消</b>\n\n訂單：${orderId}\n原因：${reason}`);
    
    return sendTg(cid, `✅ 訂單 ${orderId} 已拒絕`);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 績效統計
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (cmd === '/perf') {
    const days = parseInt(args[0]) || 7;
    
    const stats = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) as losses,
        SUM(pnl_points) as total_pnl,
        AVG(CASE WHEN result = 'win' THEN pnl_points END) as avg_win,
        AVG(CASE WHEN result = 'loss' THEN pnl_points END) as avg_loss
      FROM performance 
      WHERE created_at > datetime('now', '-${days} days')
    `).first();
    
    const winRate = stats?.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(1) : '0';
    
    let m = `<b>績效統計</b> (${days}天)\n\n`;
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
    m += `/bc /announce /update /alert\n\n`;
    m += `<b>管理</b>\n`;
    m += `/users /user /pro /vip /adddays\n`;
    m += `/orders /confirm /reject\n`;
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
    return sendTg(cid, `🟢 <b>做多訊號</b>\n\n<code>/long NQ 21500 21480 21520 21540</code>\n\n參數：品種 進場 止損 TP1 [TP2] [TP3] [@群組]`);
  }
  
  if (data === 'a_help_short') {
    await answerCb(cbId, '');
    return sendTg(cid, `🔴 <b>做空訊號</b>\n\n<code>/short ES 5820 5835 5810 5800</code>\n\n參數：品種 進場 止損 TP1 [TP2] [TP3] [@群組]`);
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
  if (data === 'a_ops') return handleAdminCommand(cid, uid, '/ops', [], '', env);
  if (data === 'a_config') return handleAdminCommand(cid, uid, '/config', [], '', env);
  
  // 用戶操作
  if (data.startsWith('adm_pro_')) {
    const userId = data.replace('adm_pro_', '');
    const expires = new Date(Date.now() + 30 * 86400000).toISOString();
    await updateUser(db, userId, { tier: 'pro', tier_expires_at: expires });
    await logAction(db, uid, 'set_pro', userId, '30 days');
    await sendMemberNotice(userId, `🎉 恭喜！您已升級為 ⭐ Pro會員\n天數：30天\n到期：${fmtDate(expires)}`);
    await answerCb(cbId, '已設為Pro 30天');
    return;
  }
  
  if (data.startsWith('adm_vip_')) {
    const userId = data.replace('adm_vip_', '');
    const expires = new Date(Date.now() + 30 * 86400000).toISOString();
    await updateUser(db, userId, { tier: 'vip', tier_expires_at: expires });
    await logAction(db, uid, 'set_vip', userId, '30 days');
    await sendMemberNotice(userId, `🎉 恭喜！您已升級為 👑 VIP會員\n天數：30天\n到期：${fmtDate(expires)}`);
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
    await sendMemberNotice(userId, `🎉 您的會員已延長 7 天！\n新到期日：${fmtDate(newExpiry)}`);
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
    await sendMemberNotice(userId, `🎉 您的會員已延長 30 天！\n新到期日：${fmtDate(newExpiry)}`);
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
  'contact_telegram', 'contact_line',
  'payment_bank', 'payment_account', 'payment_name',
  'welcome_message'
];

const adminHtmlResponse = (body, status = 200, headers = {}) => new Response(body, {
  status,
  headers: { 'Content-Type': 'text/html; charset=utf-8', ...headers }
});

function unauthorizedAdminResponse(message = '需要後台登入') {
  return adminHtmlResponse(message, 401, {
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
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_strategies_active ON strategies(is_active)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_strategies_tier ON strategies(tier)').run();
  await db.prepare(`
    INSERT OR IGNORE INTO strategies (strategy_id, name, description, signal_types, symbols, tier, sort_order, rules_json, tv_alert_template) VALUES
    ('scalp-core', '短線核心策略', '盤中短線訊號，重視進出場速度與風險控制。', '["scalp"]', '["NQ","ES","GC","USTEC","XAUUSD"]', 'pro', 1, '{"riskPoints":30,"targetR":[1,2,3],"entryMode":"close","timeframes":["1","3","5","15"]}', '{"strategy":"scalp-core","ticker":"{{ticker}}","action":"{{strategy.order.action}}","price":"{{close}}","time":"{{time}}","interval":"{{interval}}"}'),
    ('swing-trend', '波段趨勢策略', '順勢波段訊號，適合可持倉數小時到數天的會員。', '["swing"]', '["NQ","ES","GC","CL","USTEC","XAUUSD"]', 'pro', 2, '{"riskPoints":75,"targetR":[1,2,3],"entryMode":"close","timeframes":["60","120","240","D"]}', '{"strategy":"swing-trend","ticker":"{{ticker}}","action":"{{strategy.order.action}}","price":"{{close}}","time":"{{time}}","interval":"{{interval}}"}'),
    ('vip-momentum', 'VIP 動能策略', '高動能與關鍵行情提醒，含第三止盈目標。', '["scalp","daytrade"]', '["NQ","GC","CL","USTEC","XAUUSD"]', 'vip', 3, '{"riskPoints":45,"targetR":[1,2,3.5],"entryMode":"close","timeframes":["5","15","30","60"]}', '{"strategy":"vip-momentum","ticker":"{{ticker}}","action":"{{strategy.order.action}}","price":"{{close}}","time":"{{time}}","interval":"{{interval}}"}')
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
    `).bind('default-tv', 'Default TradingView', genUID(), 'scalp-core', '["NQ","ES","GC","CL","USTEC","XAUUSD"]', 'auto', 'pro', 0, '預設來源，先以草稿模式接收 alert。確認規則後可改為自動發送。').run();
  }
}

function hoursSinceDbTime(value) {
  const parsed = parseDbTime(value);
  if (!parsed) return null;
  return Math.max(0, Math.round((Date.now() - parsed.getTime()) / 36e5));
}

function opsIssue(severity, title, detail, action, view = 'overview') {
  return { severity, title, detail, action, view };
}

async function getOperationalHealth(db, config = {}, startedAt = Date.now(), env = {}) {
  const integrations = integrationReadiness(env);
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
    issues.push(opsIssue('info', '第三方登入尚未啟用', '會員仍可用 Telegram 登入碼，但 Google / LINE 按鈕不會顯示。', '設定 Google 或 LINE OAuth secret。', 'billing'));
  }
  if (!integrations.telegram.botToken) {
    issues.push(opsIssue('critical', 'Telegram Bot Token 未設定', '會員登入碼與 Telegram 推播都無法使用。', '設定 BOT_TOKEN secret。', 'billing'));
  }
  if (!integrations.cron.manualSecret) {
    issues.push(opsIssue('info', '手動 Cron 端點已鎖定', '尚未設定 CRON_SECRET，外部無法手動觸發維運端點；Cloudflare 排程仍會正常執行。', '如需手動測試 cron，設定 CRON_SECRET。', 'billing'));
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

async function getAdminBootstrap(db, env = {}) {
  const startedAt = Date.now();
  await ensureAdminSchema(db);
  await ensureOrderPaymentSchema(db);

  const [
    totalUsers, proUsers, vipUsers, todaySignals, activeSignals, pendingOrders,
    todayPerf, configRows, symbols, strategies, signals, orders, orderEvents, users, tvSources, tvLogs
  ] = await Promise.all([
    db.prepare('SELECT COUNT(*) as c FROM users').first(),
    db.prepare("SELECT COUNT(*) as c FROM users WHERE tier = 'pro' AND is_active = 1").first(),
    db.prepare("SELECT COUNT(*) as c FROM users WHERE tier = 'vip' AND is_active = 1").first(),
    db.prepare("SELECT COUNT(*) as c FROM signals WHERE DATE(created_at) = DATE('now')").first(),
    db.prepare("SELECT COUNT(*) as c FROM signals WHERE status = 'active'").first(),
    db.prepare("SELECT COUNT(*) as c FROM orders WHERE status IN ('pending', 'paid')").first(),
    db.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
             SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) as losses,
             SUM(pnl_points) as pnl
      FROM performance
      WHERE DATE(created_at) = DATE('now')
    `).first(),
    db.prepare(`SELECT key, value FROM system_config WHERE key IN (${ADMIN_CONFIG_KEYS.map(() => '?').join(',')}) ORDER BY key`).bind(...ADMIN_CONFIG_KEYS).all(),
    db.prepare('SELECT * FROM symbols ORDER BY sort_order, symbol').all(),
    db.prepare('SELECT * FROM strategies ORDER BY sort_order, strategy_id').all(),
    db.prepare('SELECT * FROM signals ORDER BY created_at DESC LIMIT 30').all(),
    db.prepare(`
      SELECT o.*, u.username, u.first_name FROM orders o
      LEFT JOIN users u ON o.user_id = u.user_id
      ORDER BY o.created_at DESC LIMIT 30
    `).all(),
    db.prepare(`
      SELECT order_id, user_id, event_type, actor_id, message, metadata, created_at
      FROM order_events
      ORDER BY created_at DESC LIMIT 80
    `).all(),
    db.prepare(`
      SELECT user_id, username, first_name, tier, tier_expires_at, points, total_spent,
             is_active, is_banned, last_active_at, admin_note, created_at
      FROM users ORDER BY created_at DESC LIMIT 50
    `).all(),
    db.prepare('SELECT * FROM tradingview_sources ORDER BY created_at DESC').all(),
    db.prepare('SELECT * FROM tv_alert_logs ORDER BY created_at DESC LIMIT 30').all()
  ]);

  const config = {};
  for (const row of configRows.results || []) config[row.key] = row.value;
  const winRate = todayPerf?.total > 0 ? Math.round(((todayPerf.wins || 0) / todayPerf.total) * 100) : 0;
  const ops = await getOperationalHealth(db, config, startedAt, env);

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
    config,
    symbols: symbols.results || [],
    strategies: strategies.results || [],
    signals: signals.results || [],
    orders: orders.results || [],
    orderEvents: orderEvents.results || [],
    users: users.results || [],
    tvSources: tvSources.results || [],
    tvLogs: tvLogs.results || [],
    integrations: ops.integrations,
    ops,
    serverTime: fmtTime()
  };
}

async function createAdminSignal(db, adminId, payload, env = {}) {
  const ticker = String(payload.ticker || payload.symbol || payload.instrument || '').trim().toUpperCase();
  const action = String(payload.action || '').toUpperCase();
  const signalType = String(payload.signal_type || payload.signalType || 'scalp').toLowerCase();
  const entry = asNumber(payload.entry_price ?? payload.entry);
  const stopLoss = asNumber(payload.stop_loss ?? payload.stop);
  const tp1 = asNumber(payload.tp1);
  const tp2 = asNumber(payload.tp2);
  const tp3 = asNumber(payload.tp3);

  if (!ticker) throw new Error('請輸入品種');
  if (!['LONG', 'SHORT'].includes(action)) throw new Error('方向必須是 LONG 或 SHORT');
  if (!CONFIG.SIGNAL_TYPES[signalType]) throw new Error('訊號類型不正確');
  if (entry === null || stopLoss === null || tp1 === null) throw new Error('進場、止損、TP1 為必填數字');
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
  await db.prepare(`
    INSERT INTO signals (
      signal_uid, ticker, action, signal_type, entry_price, stop_loss,
      tp1, tp2, tp3, note, chart_url, snapshot_url, target_group, is_vip_only, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    signalUid, ticker, action, signalType, entry, stopLoss,
    tp1, tp2, tp3, payload.note || null, chartUrl || null, snapshotUrl || null, targetGroup, isVipOnly ? 1 : 0, sendNow ? 'active' : 'pending'
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
    note: payload.note || '',
    chart_url: chartUrl,
    snapshot_url: snapshotUrl,
    target_group: targetGroup,
    is_vip_only: isVipOnly ? 1 : 0
  };

  let delivery = { sent: 0, queued: 0, skipped: 0, total: 0 };
  if (sendNow) {
    delivery = await broadcastSignal(db, signal, env);
    await db.prepare('UPDATE signals SET sent_count = ? WHERE signal_uid = ?').bind(delivery.sent, signalUid).run();
  }
  await logAction(db, adminId, sendNow ? 'web_signal_send' : 'web_signal_draft', signalUid, `${action} ${ticker} @${targetGroup}`);
  return { signalUid, delivery };
}

async function closeAdminSignal(db, adminId, signalUid, payload) {
  const signal = await db.prepare('SELECT * FROM signals WHERE signal_uid = ?').bind(signalUid).first();
  if (!signal) throw new Error('找不到訊號');
  if (signal.status !== 'active') throw new Error('只有已發送且進行中的訊號可以結案');

  const price = asNumber(payload.price);
  if (price === null) throw new Error('請輸入結案價格');

  const type = String(payload.type || 'CLOSE').toUpperCase();
  if (!['CLOSE', 'TP1', 'TP2', 'TP3', 'SL'].includes(type)) throw new Error('結案類型不正確');
  const reason = String(payload.reason || (type === 'SL' ? '止損觸發' : '手動平倉')).trim();
  const pnl = signal.action === 'LONG' ? price - signal.entry_price : signal.entry_price - price;
  const result = type === 'SL' ? 'loss' : pnl > 0.5 ? 'win' : pnl < -0.5 ? 'loss' : 'breakeven';

  await db.prepare(`
    UPDATE signals
    SET status = 'closed', exit_price = ?, pnl_points = ?, result = ?, exit_reason = ?, closed_at = datetime('now')
    WHERE signal_uid = ?
  `).bind(price, pnl, result, reason || type, signalUid).run();

  await db.prepare(`
    INSERT INTO performance (signal_uid, ticker, direction, signal_type, entry_price, exit_price, pnl_points, result, exit_reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(signal.signal_uid, signal.ticker, signal.action, signal.signal_type, signal.entry_price, price, pnl, result, type).run();

  let delivery = { sent: 0 };
  if (payload.notify !== false) {
    delivery = await broadcastExit(db, type, signal.ticker, price, pnl, reason, signalUid);
  }
  await logAction(db, adminId, 'web_signal_close', signalUid, `${type} ${price}`);
  return { signalUid, pnl, result, delivery };
}

async function sendPendingAdminSignal(db, adminId, signalUid, env = {}) {
  const signal = await db.prepare('SELECT * FROM signals WHERE signal_uid = ?').bind(signalUid).first();
  if (!signal) throw new Error('找不到訊號');
  if (signal.status !== 'pending') throw new Error('只有草稿訊號可以發送');

  const paused = await getConfig(db, 'signals_paused');
  if (paused === '1') throw new Error('訊號目前已暫停，請先恢復發訊');

  const delivery = await broadcastSignal(db, signal, env);
  await db.prepare(`
    UPDATE signals
    SET status = 'active', sent_count = ?, created_at = datetime('now')
    WHERE signal_uid = ?
  `).bind(delivery.sent, signalUid).run();
  await db.prepare("UPDATE tv_alert_logs SET status = 'active' WHERE signal_uid = ?").bind(signalUid).run();
  await logAction(db, adminId, 'web_signal_release', signalUid, `${signal.action} ${signal.ticker}`);
  return { signalUid, delivery };
}

async function upsertAdminSymbol(db, payload) {
  const symbol = String(payload.symbol || '').trim().toUpperCase();
  if (!symbol) throw new Error('請輸入品種代碼');
  const name = String(payload.name || symbol).trim();
  const nameZh = String(payload.name_zh || payload.nameZh || '').trim() || null;
  const category = String(payload.category || 'index').trim();
  const tickSize = asNumber(payload.tick_size ?? payload.tickSize, 0.25);
  const tickValue = asNumber(payload.tick_value ?? payload.tickValue, 5);
  const isActive = payload.is_active === false || payload.isActive === false ? 0 : 1;
  const sortOrder = asNumber(payload.sort_order ?? payload.sortOrder, 0);

  await db.prepare(`
    INSERT INTO symbols (symbol, name, name_zh, category, tick_size, tick_value, is_active, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(symbol) DO UPDATE SET
      name = excluded.name,
      name_zh = excluded.name_zh,
      category = excluded.category,
      tick_size = excluded.tick_size,
      tick_value = excluded.tick_value,
      is_active = excluded.is_active,
      sort_order = excluded.sort_order
  `).bind(symbol, name, nameZh, category, tickSize, tickValue, isActive, sortOrder).run();
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
  if (Object.keys(data).length === 0) throw new Error('沒有可更新的用戶欄位');
  await updateUser(db, userId, data);
  await logAction(db, adminId, 'web_user_update', userId, JSON.stringify(data));
  return { userId };
}

async function handleAdminOrderAction(db, adminId, orderId, action, payload = {}) {
  const normalizedOrderId = String(orderId || '').toUpperCase();
  const order = await db.prepare('SELECT * FROM orders WHERE order_id = ?').bind(normalizedOrderId).first();
  if (!order) throw new Error('找不到訂單');

  if (action === 'confirm') {
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
    if (payload.notify !== false) await sendMemberNotice(order.user_id, `❌ <b>訂單已取消</b>\n\n訂單：${normalizedOrderId}\n原因：${reason}`);
    await logAction(db, adminId, 'web_order_reject', normalizedOrderId, reason);
    return { orderId: normalizedOrderId, status: 'rejected' };
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

function memberPortalUrl(env = {}) {
  return `${publicBaseUrl(env)}/member`;
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

async function ensureOrderPaymentSchema(db) {
  await addColumnIfMissing(db, 'orders', 'payment_provider', 'TEXT');
  await addColumnIfMissing(db, 'orders', 'payment_session_id', 'TEXT');
  await addColumnIfMissing(db, 'orders', 'payment_url', 'TEXT');
  await addColumnIfMissing(db, 'orders', 'currency', 'TEXT');
  await addColumnIfMissing(db, 'orders', 'paid_at', 'TEXT');
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_orders_payment_provider ON orders(payment_provider)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_orders_payment_session ON orders(payment_session_id)').run();
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
    },
    {
      id: 'line',
      name: 'LINE',
      clientId: env.LINE_CLIENT_ID || env.OAUTH_LINE_CLIENT_ID || '',
      clientSecret: env.LINE_CLIENT_SECRET || env.OAUTH_LINE_CLIENT_SECRET || '',
      authUrl: 'https://access.line.me/oauth2/v2.1/authorize',
      tokenUrl: 'https://api.line.me/oauth2/v2.1/token',
      userInfoUrl: 'https://api.line.me/v2/profile',
      scope: 'profile openid email'
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
  return html(`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>登入失敗</title><style>body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#f4f7f9;color:#101828;display:grid;place-items:center;min-height:100vh;padding:24px}.card{max-width:420px;background:#fff;border:1px solid #d9e3ea;border-radius:12px;padding:22px;box-shadow:0 14px 34px rgba(15,23,42,.08)}a{color:#087e90;font-weight:800}</style></head><body><main class="card"><h1>登入失敗</h1><p>${escHtml(message)}</p><p><a href="/member">返回會員中心</a></p></main></body></html>`, 400, { 'Cache-Control': 'no-store' });
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
  if (provider.id === 'line') {
    return {
      provider: provider.id,
      providerUserId: String(data.userId || ''),
      email: '',
      displayName: String(data.displayName || 'LINE 會員'),
      avatarUrl: String(data.pictureUrl || '')
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

function integrationReadiness(env = {}) {
  const baseUrl = publicBaseUrl(env);
  const providers = oauthPublicProviders(env);
  const enabledProviders = providers.filter((provider) => provider.enabled);
  const stripeKey = String(env.STRIPE_SECRET_KEY || '');
  const stripeMode = stripeKey.startsWith('sk_live_') ? 'live' : stripeKey.startsWith('sk_test_') ? 'test' : stripeConfigured(env) ? 'custom' : 'off';
  return {
    memberUrl: `${baseUrl}/member`,
    telegram: {
      botToken: Boolean(env.BOT_TOKEN || CONFIG.BOT_TOKEN),
      botUsername: CONFIG.BOT_USERNAME || '',
      loginCodeEnabled: Boolean(env.BOT_TOKEN || CONFIG.BOT_TOKEN)
    },
    oauth: {
      enabledCount: enabledProviders.length,
      providers,
      callbackUrls: {
        google: `${baseUrl}/auth/google/callback`,
        line: `${baseUrl}/auth/line/callback`
      }
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
        securityCleanup: `${baseUrl}/cron/security-cleanup`
      }
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
    await sendMemberNotice(order.user_id, `🎉 <b>訂單已確認！</b>\n\n訂單：${orderId}\n方案：${tierName(order.tier)}\n天數：${order.days} 天\n到期：${fmtDate(newExpiry)}`);
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
  return {
    bank: await getConfig(db, 'payment_bank') || '',
    account: await getConfig(db, 'payment_account') || '',
    name: await getConfig(db, 'payment_name') || '',
    contactTelegram: await getConfig(db, 'contact_telegram') || '',
    contactLine: await getConfig(db, 'contact_line') || '',
    stripeEnabled: stripeEnabledPublic(env),
    stripeCurrency: stripeCurrency(env).toUpperCase()
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
    status: sig.status,
    result: sig.result,
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
    strategy_id: sig.strategy_id
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

async function getMemberBootstrap(db, userId, env = {}) {
  await ensureOrderPaymentSchema(db);
  const user = await getUser(db, userId);
  const settings = await getUserSettings(db, userId);
  const symbols = (await db.prepare('SELECT * FROM symbols WHERE is_active = 1 ORDER BY sort_order, symbol').all()).results || [];
  const subscribedSymbols = parseJSON(settings.subscribed_symbols, []);
  const signalTypes = parseJSON(settings.signal_types, []);

  let signals = [];
  if (memberCanReceive(user)) {
    const rows = await db.prepare(`
      SELECT * FROM signals
      WHERE status IN ('active','closed','cancelled')
      ORDER BY created_at DESC
      LIMIT 60
    `).all();
    signals = (rows.results || [])
      .filter((sig) => (!subscribedSymbols.length || subscribedSymbols.includes(sig.ticker)))
      .filter((sig) => (!signalTypes.length || signalTypes.includes(sig.signal_type)))
      .filter((sig) => memberCanViewSignal(user, sig))
      .slice(0, 30)
      .map((sig) => signalDto(sig, user.tier));
  }

  const orders = (await db.prepare(`
    SELECT order_id, tier, months, days, amount, status, payment_method, payment_provider, payment_url, payment_note, currency, paid_at, created_at, confirmed_at
    FROM orders WHERE user_id = ?
    ORDER BY created_at DESC LIMIT 10
  `).bind(userId).all()).results || [];
  const orderEvents = await getOrderEvents(db, orders.map((order) => order.order_id), 80);
  for (const order of orders) {
    order.events = (orderEvents[String(order.order_id || '').toUpperCase()] || []).slice(0, 8);
  }

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
    orders,
    plans: await getMemberPlans(db),
    payment: await getMemberPaymentInfo(db, env),
    botUsername: CONFIG.BOT_USERNAME,
    serverTime: fmtTime()
  };
}

async function createMemberOrder(db, env, userId, payload) {
  await ensureOrderPaymentSchema(db);
  const tier = String(payload.tier || '').trim().toLowerCase();
  const months = Number(payload.months || 0);
  const paymentProvider = String(payload.payment_provider || payload.paymentProvider || payload.method || 'manual').trim().toLowerCase();
  if (!['pro', 'vip'].includes(tier)) throw new Error('方案不正確');
  if (![1, 3, 12].includes(months)) throw new Error('訂閱月份不正確');
  if (!['manual', 'stripe'].includes(paymentProvider)) throw new Error('付款方式不正確');
  if (paymentProvider === 'stripe' && !stripeEnabledPublic(env)) throw new Error('線上付款尚未完整啟用，請先設定 Stripe secret 與 webhook secret，或改用轉帳付款');

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
  await db.prepare(`
    INSERT INTO orders (order_id, user_id, tier, months, days, amount, payment_method, payment_provider, currency, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(orderId, userId, tier, months, plan.days, plan.amount, paymentProvider, paymentProvider, stripeCurrency(env).toUpperCase()).run();
  await recordOrderEvent(db, orderId, userId, 'created', userId, `會員中心建立 ${tierName(tier)} ${months} 個月訂單`, {
    tier,
    months,
    amount: plan.amount,
    paymentProvider
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
    await sendTg(adminId, `新會員中心訂單\n\n用戶：${user.username ? '@' + user.username : user.first_name || userId}\nID：<code>${escHtml(userId)}</code>\n訂單：<code>${orderId}</code>\n方案：${tierName(tier)} ${months}個月\n金額：NT$${fmtNum(plan.amount)}\n付款：${paymentProvider === 'stripe' ? 'Stripe Checkout' : '轉帳'}`);
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
  const paidAt = String(payload.paid_at || payload.paidAt || '').trim();
  const note = String(payload.note || '').trim();
  const parts = [];
  if (payer) parts.push(`付款人：${payer}`);
  if (last5) parts.push(`後五碼：${last5}`);
  if (paidAt) parts.push(`付款時間：${paidAt}`);
  if (note) parts.push(`備註：${note}`);
  return parts.join('\n') || '會員中心通知付款';
}

async function updateMemberOrderStatus(db, userId, orderId, action, payload = {}) {
  const normalizedOrderId = String(orderId || '').trim().toUpperCase();
  const order = await db.prepare('SELECT * FROM orders WHERE order_id = ? AND user_id = ?').bind(normalizedOrderId, userId).first();
  if (!order) throw new Error('找不到訂單');

  if (action === 'paid') {
    if (!['pending', 'paid'].includes(order.status)) throw new Error('此訂單狀態無法通知付款');
    if ((order.payment_provider || order.payment_method) === 'stripe') throw new Error('線上付款訂單請完成 Stripe Checkout');
    const paymentNote = memberPaymentNote(payload);
    await db.prepare("UPDATE orders SET status = 'paid', payment_note = ? WHERE order_id = ?").bind(paymentNote, normalizedOrderId).run();
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
      const session = await createMemberSession(verified.userId, env);
      return new Response(JSON.stringify({ ok: true, data: await getMemberBootstrap(db, verified.userId, env) }), {
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

    if (request.method === 'PUT' && parts[0] === 'settings') {
      return json({ ok: true, data: await updateMemberSettings(db, session.userId, await readJsonBody(request)) });
    }

    if (request.method === 'POST' && parts[0] === 'orders' && parts.length === 1) {
      await enforceRateLimit(
        db,
        await rateKey(['member_order_create', session.userId]),
        6,
        60 * 60,
        '訂單建立太頻繁，請稍後再試'
      );
      return json({ ok: true, data: await createMemberOrder(db, env, session.userId, await readJsonBody(request)) });
    }

    if (request.method === 'POST' && parts[0] === 'orders' && parts[1] && parts[2]) {
      return json({ ok: true, data: await updateMemberOrderStatus(db, session.userId, parts[1], parts[2], await readJsonBody(request)) });
    }

    return json({ ok: false, error: 'Not found' }, 404);
  } catch (e) {
    return json({ ok: false, error: e.message }, e.status || 400);
  }
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
    :root { --bg:#f4f7f9; --panel:#fff; --ink:#101828; --muted:#667085; --line:#d9e3ea; --accent:#08a7b3; --green:#16845a; --red:#d1433f; --amber:#b7791f; --soft:#eef6f8; --shadow:0 14px 34px rgba(15,23,42,.08); }
    * { box-sizing:border-box; }
    body { margin:0; font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background:var(--bg); color:var(--ink); }
    button, input { font:inherit; }
    a { color:inherit; }
    .wrap { max-width:1180px; margin:0 auto; padding:18px 18px 38px; display:grid; gap:16px; }
    .top { display:flex; justify-content:space-between; gap:14px; align-items:center; }
    .brand { display:flex; gap:10px; align-items:center; }
    .mark { width:38px; height:38px; border-radius:8px; background:linear-gradient(135deg,#12c6d0,#1796ff); display:grid; place-items:center; font-weight:900; color:#06111c; }
    h1, h2, h3, p { margin:0; }
    h1 { font-size:20px; }
    .muted { color:var(--muted); }
    .btn { border:1px solid var(--line); border-radius:7px; min-height:40px; padding:8px 12px; background:#fff; color:var(--ink); font-weight:800; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; gap:6px; }
    .btn.primary { background:var(--accent); border-color:var(--accent); color:#fff; }
    .btn.ghost { background:#fff; }
    .btn.mini { min-height:34px; padding:6px 10px; font-size:13px; }
    .hero { border:1px solid var(--line); border-radius:10px; background:linear-gradient(135deg,#fff 0%,#f3fbfc 55%,#eef6ff 100%); padding:20px; box-shadow:var(--shadow); display:grid; grid-template-columns:minmax(0,1fr) auto; gap:18px; align-items:center; }
    .hero h2 { font-size:28px; line-height:1.12; }
    .hero p { color:var(--muted); margin-top:8px; }
    .grid { display:grid; gap:14px; }
    .grid.two { grid-template-columns: minmax(0,1fr) minmax(330px,.55fr); align-items:start; }
    .kpis { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }
    .panel, .kpi, .signal { background:var(--panel); border:1px solid var(--line); border-radius:8px; box-shadow:0 4px 16px rgba(15,23,42,.04); }
    .kpi { padding:13px; }
    .kpi span, label { display:block; color:var(--muted); font-size:12px; font-weight:800; }
    .kpi strong { display:block; margin-top:7px; font-size:22px; }
    .panel header { padding:14px 16px; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; gap:10px; align-items:center; }
    .panel .body { padding:16px; }
    .stack { display:grid; gap:10px; }
    .tabs { display:flex; gap:6px; flex-wrap:wrap; }
    .tabs button { border:1px solid var(--line); border-radius:999px; background:#fff; min-height:32px; padding:5px 10px; color:var(--muted); font-size:12px; font-weight:900; cursor:pointer; }
    .tabs button.active { border-color:rgba(8,167,179,.36); background:#e6f8fa; color:#087e90; }
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
    .payment-box { border:1px solid rgba(8,167,179,.24); background:#f4fbfc; border-radius:8px; padding:12px; display:grid; gap:7px; }
    .order-card { border:1px solid var(--line); border-radius:8px; padding:11px; display:grid; gap:8px; }
    .order-actions { display:flex; gap:7px; flex-wrap:wrap; }
    .order-timeline { border-top:1px solid var(--line); padding-top:8px; display:grid; gap:5px; }
    .order-timeline div { display:grid; grid-template-columns:auto minmax(0,1fr); gap:8px; align-items:start; color:var(--muted); font-size:12px; line-height:1.4; }
    .order-timeline b { color:var(--ink); font-size:12px; white-space:nowrap; }
    .proof-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
    .chips { display:flex; gap:7px; flex-wrap:wrap; }
    .chip { display:inline-flex; align-items:center; gap:6px; min-height:28px; padding:4px 10px; border-radius:999px; background:var(--soft); color:#475569; font-size:12px; font-weight:800; }
    .chip.green { background:#e8f7ef; color:var(--green); }
    .chip.red { background:#fff0ef; color:var(--red); }
    .chip.amber { background:#fff7e6; color:var(--amber); }
    .signal { padding:14px; display:grid; gap:10px; }
    .signal-head { display:flex; justify-content:space-between; gap:10px; }
    .signal-head strong { display:block; font-size:17px; }
    .signal-meta { color:var(--muted); font-size:12px; line-height:1.45; margin-top:4px; }
    .levels { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
    .levels div { background:#f8fafc; border-radius:7px; padding:9px; }
    .levels span { display:block; color:var(--muted); font-size:11px; font-weight:800; margin-bottom:4px; }
    .levels b { font-size:14px; }
    .signal-actions { display:flex; gap:7px; flex-wrap:wrap; }
    .signal-result { display:flex; gap:7px; flex-wrap:wrap; align-items:center; color:var(--muted); font-size:13px; }
    .form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
    .full { grid-column:1/-1; }
    input { width:100%; border:1px solid var(--line); border-radius:7px; min-height:40px; padding:8px 10px; }
    .check { display:flex; align-items:center; gap:8px; min-height:34px; color:var(--ink); font-size:14px; }
    .check input { width:auto; min-height:unset; }
    .login { min-height:70vh; display:grid; place-items:center; padding:20px; }
    .login-card { width:min(460px,100%); background:#fff; border:1px solid var(--line); border-radius:12px; padding:24px; box-shadow:var(--shadow); display:grid; gap:14px; text-align:center; }
    .login-code { display:grid; gap:8px; text-align:left; }
    .login-code button { width:100%; }
    .login-divider { display:flex; align-items:center; gap:10px; color:var(--muted); font-size:12px; font-weight:800; }
    .login-divider:before, .login-divider:after { content:""; height:1px; background:var(--line); flex:1; }
    .login-hint { font-size:13px; line-height:1.55; }
    .oauth-grid { display:grid; gap:8px; }
    .oauth-grid:empty { display:none; }
    .oauth-btn { width:100%; min-height:42px; }
    .oauth-btn.google { border-color:#d6dee8; }
    .oauth-btn.line { background:#06c755; border-color:#06c755; color:#fff; }
    .login-widget { border:1px solid var(--line); border-radius:8px; padding:10px 12px; text-align:left; }
    .login-widget summary { cursor:pointer; font-weight:900; list-style:none; }
    .login-widget summary::-webkit-details-marker { display:none; }
    .widget-box { margin-top:12px; display:grid; justify-items:center; gap:8px; }
    .hidden { display:none !important; }
    .toast { position:fixed; right:16px; bottom:16px; max-width:min(420px,calc(100vw - 32px)); background:#fff; border:1px solid var(--line); border-radius:8px; padding:10px 12px; box-shadow:var(--shadow); color:var(--muted); }
    .toast:empty { display:none; }
    @media (max-width:760px) { .wrap { padding:12px 12px 28px; } .top, .hero { grid-template-columns:1fr; align-items:start; } .grid.two, .kpis, .levels, .form-grid, .plan-grid, .proof-grid, .signal-toolbar, .date-range, .plan-row { grid-template-columns:1fr; } .hero h2 { font-size:23px; } .panel header { align-items:flex-start; flex-direction:column; } .tabs, .signal-actions, .plan-actions { width:100%; } .tabs button, .signal-actions .btn, .plan-actions .btn { flex:1; } }
  </style>
</head>
<body>
  <section class="login" id="loginView">
    <div class="login-card">
      <div class="mark" style="margin:0 auto">DC</div>
      <h1>DC Signals 會員中心</h1>
      <p class="muted">登入後可線上查看訊號、維護訂閱品種與處理續費。</p>
      <form class="login-code" id="loginCodeForm">
        <label for="loginCodeInput">一次性登入碼</label>
        <input id="loginCodeInput" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="輸入 6 位碼">
        <button class="btn primary" type="submit">登入會員中心</button>
      </form>
      <p class="muted login-hint">在 Telegram 對 ${bot ? `<a href="https://t.me/${bot}" target="_blank" rel="noopener">@${bot}</a>` : '機器人'} 輸入 <b>/login</b> 取得登入碼。</p>
      <div class="oauth-grid" id="oauthLogin"></div>
      <div class="login-divider"><span>Telegram</span></div>
      <details class="login-widget">
        <summary>Telegram 一鍵登入</summary>
        <div class="widget-box">
          ${bot ? `<script async src="https://telegram.org/js/telegram-widget.js?22" data-telegram-login="${bot}" data-size="large" data-userpic="false" data-request-access="write" data-onauth="onTelegramAuth(user)"></script>` : `<div class="chip amber">尚未設定 BOT_USERNAME</div>`}
        </div>
      </details>
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
    <section class="grid two">
      <div class="grid">
        <section class="panel"><header><h3>線上訊號</h3><div class="tabs" id="signalTabs"><button class="active" data-member-signal-filter="all" type="button">全部</button><button data-member-signal-filter="active" type="button">進行中</button><button data-member-signal-filter="history" type="button">歷史</button></div></header><div class="body"><div class="signal-toolbar"><div class="date-range"><div><label>起始時間</label><input id="signalStart" type="date"></div><div><label>結束時間</label><input id="signalEnd" type="date"></div></div><button class="btn ghost" id="clearSignalDates" type="button">清除</button><span class="muted" id="signalCount"></span></div><div class="stack" id="signals"></div></div></section>
      </div>
      <aside class="grid">
        <section class="panel"><header><h3>升級 / 續費</h3></header><div class="body"><div class="stack"><div class="plan-grid" id="plans"></div><div class="payment-box" id="paymentBox"></div></div></div></section>
        <section class="panel"><header><h3>訂閱設定</h3><button class="btn primary" id="saveBtn">儲存</button></header><div class="body"><form id="settingsForm" class="stack"></form></div></section>
        <section class="panel"><header><h3>訂單紀錄</h3></header><div class="body"><div class="stack" id="orders"></div></div></section>
      </aside>
    </section>
  </main>
  <div class="toast" id="toast"></div>
  <script>
var state = null;
var memberSignalFilter = 'all';
var checkoutNoticeShown = false;
var loginView = document.getElementById('loginView');
var appView = document.getElementById('appView');
var toast = document.getElementById('toast');
var loginCodeForm = document.getElementById('loginCodeForm');
var loginCodeInput = document.getElementById('loginCodeInput');
var oauthLogin = document.getElementById('oauthLogin');
function esc(value){ return String(value == null ? '' : value).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function money(value){ return 'NT$' + Number(value || 0).toLocaleString('zh-TW'); }
function price(value){ var n = Number(value); return isFinite(n) ? n.toFixed(2) : '-'; }
function dateText(value){ if(!value) return '-'; var text=String(value); var d=new Date(/(?:Z|[+-]\\d{2}:?\\d{2})$/i.test(text)?text:text.replace(' ','T')+'Z'); return isNaN(d.getTime())?'-':d.toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}); }
function chip(text,tone){ return '<span class="chip '+(tone||'')+'">'+esc(text)+'</span>'; }
function showToast(text,tone){ toast.textContent=text||''; toast.style.color=tone==='error'?'#d1433f':'#667085'; if(text) setTimeout(function(){ if(toast.textContent===text) toast.textContent=''; },3600); }
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
  try{
    var data = await api('/api/member/oauth/providers');
    var providers = (data.providers || []).filter(function(provider){ return provider.enabled; });
    oauthLogin.innerHTML = providers.map(function(provider){
      var cls = provider.id === 'line' ? 'line' : 'google';
      return '<a class="btn oauth-btn '+esc(cls)+'" href="/auth/'+esc(provider.id)+'/start">使用 '+esc(provider.name)+' 登入</a>';
    }).join('');
  }catch(err){ oauthLogin.innerHTML = ''; }
}
window.onTelegramAuth = async function(user){ try{ state = await api('/api/member/login',{method:'POST',body:JSON.stringify(user)}); render(); }catch(err){ showToast(err.message,'error'); } };
loginCodeForm.addEventListener('submit', async function(event){
  event.preventDefault();
  var code = (loginCodeInput.value || '').replace(/\\D/g,'');
  try{
    state = await api('/api/member/login-code',{method:'POST',body:JSON.stringify({code:code})});
    loginCodeInput.value = '';
    render();
  }catch(err){ showToast(err.message,'error'); }
});
async function load(){ try{ state = await api('/api/member/me'); render(); }catch(err){ loginView.classList.remove('hidden'); appView.classList.add('hidden'); } }
function tierTone(tier){ return tier === 'vip' ? 'amber' : tier === 'pro' ? 'green' : ''; }
function signalTone(sig){ return sig.action === 'LONG' ? 'green' : 'red'; }
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
function actionText(sig){ return sig.action === 'LONG' ? '做多' : sig.action === 'SHORT' ? '做空' : (sig.action || '-'); }
function signalCardUrl(sig){ return location.origin + '/signal-card/' + encodeURIComponent(sig.signal_uid) + '.svg'; }
function signalTime(sig){
  var start = dateText(sig.created_at);
  var end = sig.closed_at ? dateText(sig.closed_at) : '尚未結束';
  return start + ' → ' + end;
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
  var levels = targets.map(function(row){ return '<div><span>'+esc(row[0])+'</span><b>'+esc(price(row[1]))+'</b></div>'; }).join('');
  var actions = '<div class="signal-actions">';
  if(sig.chart_url) actions += '<a class="btn mini primary" target="_blank" rel="noopener" href="'+esc(sig.chart_url)+'">開啟 TV</a>';
  actions += '<a class="btn mini ghost" target="_blank" rel="noopener" href="'+esc(signalCardUrl(sig))+'">訊號卡圖</a>';
  if(sig.snapshot_url) actions += '<a class="btn mini ghost" target="_blank" rel="noopener" href="'+esc(sig.snapshot_url)+'">原始截圖</a>';
  actions += '</div>';
  var result = sig.pnl_points != null ? '<div class="signal-result">'+chip((Number(sig.pnl_points) >= 0 ? '+' : '') + price(sig.pnl_points) + ' 點', Number(sig.pnl_points) >= 0 ? 'green' : 'red')+(sig.exit_reason?'<span>'+esc(sig.exit_reason)+'</span>':'')+'</div>' : '';
  return '<article class="signal"><div class="signal-head"><div><strong>'+esc(sig.ticker+' '+actionText(sig))+'</strong><p class="signal-meta">'+esc(signalTime(sig))+'<br>'+esc(sig.signal_type || '-')+(sig.strategy_id?' · '+esc(sig.strategy_id):'')+'</p></div>'+chip(statusText(sig), statusTone(sig) || signalTone(sig))+'</div><div class="levels">'+levels+'</div>'+result+actions+'</article>';
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
function renderPlans(){
  var plans = state.plans || {};
  var stripeEnabled = !!(state.payment && state.payment.stripeEnabled);
  var tiers = ['pro','vip'];
  document.getElementById('plans').innerHTML = tiers.map(function(tier){
    var plan = plans[tier];
    if(!plan) return '';
    var rows = [1,3,12].map(function(months){
      var item = plan.months[String(months)] || plan.months[months];
      if(!item) return '';
      var online = stripeEnabled ? '<button class="btn primary" data-buy-tier="'+esc(tier)+'" data-buy-months="'+esc(months)+'" data-buy-method="stripe">線上付款 '+money(item.amount)+'</button>' : '';
      return '<div class="plan-row"><div><b>'+esc(months)+' 個月</b><div class="muted">'+esc(item.days)+' 天 · '+money(item.amount)+'</div></div><div class="plan-actions">'+online+'<button class="btn ghost" data-buy-tier="'+esc(tier)+'" data-buy-months="'+esc(months)+'" data-buy-method="manual">轉帳訂單</button></div></div>';
    }).join('');
    return '<article class="plan '+(tier==='vip'?'vip':'')+'"><div class="plan-head"><div><strong>'+esc(plan.name)+'</strong><p class="muted">'+(tier==='vip'?'含完整 TP3 與 VIP 訊號':'基礎付費訊號與 TP1/TP2')+'</p></div>'+chip(tier.toUpperCase(), tier==='vip'?'amber':'green')+'</div><div class="plan-price">'+rows+'</div></article>';
  }).join('');
  var pay = state.payment || {};
  document.getElementById('paymentBox').innerHTML =
    '<b>付款資訊</b>' +
    '<div>線上付款　' + (pay.stripeEnabled ? '<b>已啟用 ' + esc(pay.stripeCurrency || '') + '</b>' : '<span class="muted">尚未啟用</span>') + '</div>' +
    '<div>銀行　'+esc(pay.bank || '-')+'</div>' +
    '<div>帳號　<code>'+esc(pay.account || '-')+'</code></div>' +
    '<div>戶名　'+esc(pay.name || '-')+'</div>' +
    '<div class="muted">建立訂單後付款，再點「我已付款」通知客服確認。</div>';
}
function orderTone(status){ return status==='confirmed'?'green':status==='rejected'||status==='cancelled'?'red':status==='paid'?'amber':''; }
function orderStatusText(status){
  return status==='pending'?'待付款':status==='paid'?'待確認':status==='confirmed'?'已確認':status==='rejected'?'已拒絕':status==='cancelled'?'已取消':status;
}
function orderEventText(type){
  var map = { created:'建立', stripe_session_created:'Checkout', stripe_session_failed:'Checkout 失敗', paid_notice:'付款通知', stripe_skipped:'Stripe 待付款', confirmed:'已確認', rejected:'已拒絕', cancelled:'已取消' };
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
  if(o.status === 'pending' && method === 'stripe') actions =
    '<div class="order-actions">' + (o.payment_url ? '<a class="btn primary" href="'+esc(o.payment_url)+'" target="_blank" rel="noopener">繼續付款</a>' : '') + '<button class="btn" data-order-cancel="'+esc(o.order_id)+'">取消</button></div>';
  if(o.status === 'pending' && method !== 'stripe') actions =
    '<div class="proof-grid">'+
      '<div><label>付款人</label><input data-proof="payer_name" placeholder="轉帳戶名"></div>'+
      '<div><label>帳號後五碼</label><input data-proof="transfer_last5" inputmode="numeric" placeholder="例如 12345"></div>'+
      '<div><label>付款時間</label><input data-proof="paid_at" placeholder="例如 6/13 18:30"></div>'+
      '<div><label>備註</label><input data-proof="note" placeholder="可填銀行、截圖連結等"></div>'+
    '</div>'+
    '<div class="order-actions"><button class="btn primary" data-order-paid="'+esc(o.order_id)+'">我已付款</button><button class="btn" data-order-cancel="'+esc(o.order_id)+'">取消</button></div>';
  if(o.status === 'paid') actions = '<div class="order-actions"><button class="btn" data-order-cancel="'+esc(o.order_id)+'">取消</button></div>';
  return '<article class="order-card">'+
    '<div>'+chip(orderStatusText(o.status), orderTone(o.status))+' <b>'+esc(o.order_id)+'</b></div>'+
    '<div class="muted">'+esc(String(o.tier || '').toUpperCase())+' '+esc(o.months)+' 月 · '+money(o.amount)+' · '+esc(method === 'stripe' ? '線上付款' : '轉帳')+' · '+dateText(o.created_at)+'</div>'+
    paymentNoteHtml(o.payment_note)+
    orderTimeline(o.events)+
    actions+
  '</article>';
}
function renderSignalsOnly(){
  if(!state) return;
  var list = filteredMemberSignals();
  var total = (state.signals || []).length;
  document.getElementById('signalCount').textContent = list.length + ' / ' + total + ' 筆';
  document.getElementById('signals').innerHTML = list.map(renderSignal).join('') || '<div class="muted">此條件下沒有可查看的訊號。</div>';
}
function render(){
  loginView.classList.add('hidden'); appView.classList.remove('hidden');
  var u=state.user; document.getElementById('memberName').textContent=(u.username?'@'+u.username:(u.first_name||u.user_id))+' · '+u.tier_name;
  document.getElementById('heroTitle').textContent = u.can_receive ? '會員訊號工作台' : '會員資格尚未啟用';
  document.getElementById('heroCopy').textContent = u.can_receive ? '可線上查看您訂閱品種的最新訊號與維護通知設定。' : '請先完成訂閱，完成後即可線上查看訊號。';
  document.getElementById('heroChips').innerHTML = chip(u.tier_name,tierTone(u.tier)) + chip(u.tier_expires_at ? '到期 '+dateText(u.tier_expires_at) : '無到期日', u.can_receive?'green':'amber');
  document.getElementById('kpis').innerHTML = [['會員等級',u.tier_name],['剩餘天數',u.tier_expires_at?Math.max(0,Math.ceil((new Date(u.tier_expires_at)-new Date())/86400000))+' 天':'-'],['已訂閱',state.settings.subscribed_symbols.length+' 個品種'],['累計消費',money(u.total_spent)]].map(function(k){return '<div class="kpi"><span>'+esc(k[0])+'</span><strong>'+esc(k[1])+'</strong></div>';}).join('');
  renderSignalsOnly();
  document.getElementById('orders').innerHTML = (state.orders||[]).map(renderOrder).join('') || '<div class="muted">尚無訂單。</div>';
  renderPlans();
  renderSettings();
  showCheckoutReturnToast();
}
document.getElementById('saveBtn').addEventListener('click', async function(){
  try{
    var form=document.getElementById('settingsForm');
    var payload={ capital:Number(form.elements.capital.value||0), risk_percent:Number(form.elements.risk_percent.value||0), subscribed_symbols:[], signal_types:[] };
    (state.symbols||[]).forEach(function(sym){ if(form.elements['sym_'+sym.symbol]?.checked) payload.subscribed_symbols.push(sym.symbol); });
    Object.keys(state.signalTypes||{}).forEach(function(type){ if(form.elements['type_'+type]?.checked) payload.signal_types.push(type); });
    ['notify_entry','notify_tp','notify_sl','notify_update','notify_alert','paused'].forEach(function(key){ payload[key]=!!form.elements[key]?.checked; });
    await api('/api/member/settings',{method:'PUT',body:JSON.stringify(payload)});
    showToast('設定已儲存'); await load();
  }catch(err){ showToast(err.message,'error'); }
});
document.getElementById('refreshBtn').addEventListener('click', load);
document.getElementById('logoutBtn').addEventListener('click', async function(){ await api('/api/member/logout',{method:'POST',body:'{}'}).catch(function(){}); location.reload(); });
document.getElementById('signalTabs').addEventListener('click', function(event){
  var btn = event.target.closest('[data-member-signal-filter]');
  if(!btn) return;
  memberSignalFilter = btn.dataset.memberSignalFilter;
  Array.prototype.slice.call(document.querySelectorAll('[data-member-signal-filter]')).forEach(function(el){ el.classList.toggle('active', el === btn); });
  renderSignalsOnly();
});
document.getElementById('signalStart').addEventListener('change', renderSignalsOnly);
document.getElementById('signalEnd').addEventListener('change', renderSignalsOnly);
document.getElementById('clearSignalDates').addEventListener('click', function(){
  document.getElementById('signalStart').value = '';
  document.getElementById('signalEnd').value = '';
  renderSignalsOnly();
});
document.body.addEventListener('click', async function(event){
  try{
    var buy = event.target.closest('[data-buy-tier]');
    if(buy){
      var order = await api('/api/member/orders',{method:'POST',body:JSON.stringify({tier:buy.dataset.buyTier,months:Number(buy.dataset.buyMonths),payment_provider:buy.dataset.buyMethod || 'manual'})});
      if(order.checkoutUrl){
        location.href = order.checkoutUrl;
        return;
      }
      showToast('訂單已建立，請依付款資訊轉帳');
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
      await load();
      return;
    }
    var cancel = event.target.closest('[data-order-cancel]');
    if(cancel){
      await api('/api/member/orders/'+encodeURIComponent(cancel.dataset.orderCancel)+'/cancel',{method:'POST',body:'{}'});
      showToast('訂單已取消');
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

function normalizeTvTicker(value) {
  const raw = String(value || '').trim().toUpperCase().split(':').pop().replace(/[^A-Z0-9]/g, '');
  const aliases = [
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

async function buildTvSignalDraft(db, source, payload) {
  const ticker = normalizeTvTicker(firstTvValue(payload.ticker, payload.symbol, payload.syminfo, payload.source));
  const action = normalizeTvAction(payload);
  const entryRaw = tvOrderPrice(payload);
  if (!ticker) throw new Error('TradingView alert 缺少 ticker');
  if (!action) throw new Error('TradingView alert 缺少 action，請傳 LONG/SHORT 或 buy/sell');
  if (entryRaw === null) throw new Error('TradingView alert 缺少 strategy.order.price / price / close');

  const allowed = parseList(source.allowed_symbols).map((s) => s.toUpperCase());
  if (allowed.length && !allowed.includes(ticker)) throw new Error(`${ticker} 不在此來源允許品種內`);

  const symbol = await db.prepare('SELECT * FROM symbols WHERE symbol = ?').bind(ticker).first();
  const signalType = inferTvSignalType(payload, source);
  const strategy = await selectTvStrategy(db, source, payload, ticker, signalType);
  const rules = parseObject(strategy.rules_json, { riskPoints: 30, targetR: [1, 2, 3], entryMode: 'close' });
  const tickSize = Number(symbol?.tick_size || 0.25);
  const entry = roundToTick(entryRaw, tickSize);
  const explicitStop = asNumber(firstTvValue(payload.stop_loss, payload.stopLoss, payload.stop, payload.sl, payload.stop_price, payload.stopPrice));
  const riskPoints = explicitStop !== null
    ? Math.abs(entry - explicitStop)
    : Number(rules.riskPoints || rules.risk_points || tickSize * 120);
  if (!Number.isFinite(riskPoints) || riskPoints <= 0) throw new Error('策略風控 riskPoints 不正確');

  const targetR = Array.isArray(rules.targetR) ? rules.targetR : Array.isArray(rules.target_r) ? rules.target_r : [1, 2, 3];
  const signed = action === 'LONG' ? 1 : -1;
  const stopLoss = explicitStop !== null ? roundToTick(explicitStop, tickSize) : roundToTick(entry - signed * riskPoints, tickSize);
  const explicitTargets = [
    asNumber(firstTvValue(payload.tp1, payload.take_profit_1, payload.takeProfit1)),
    asNumber(firstTvValue(payload.tp2, payload.take_profit_2, payload.takeProfit2)),
    asNumber(firstTvValue(payload.tp3, payload.take_profit_3, payload.takeProfit3))
  ];
  const targets = explicitTargets.some((target) => target !== null)
    ? explicitTargets.map((target) => target === null ? null : roundToTick(target, tickSize))
    : targetR.slice(0, 3).map((r) => roundToTick(entry + signed * riskPoints * Number(r || 1), tickSize));
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
    tp1: targets[0] || null,
    tp2: targets[1] || null,
    tp3: targets[2] || null,
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

async function createSignalFromTvDraft(db, draft, alertUid, autoSend, env = {}) {
  const paused = await getConfig(db, 'signals_paused');
  const shouldSend = Boolean(autoSend) && paused !== '1';
  await db.prepare(`
    INSERT INTO signals (
      signal_uid, ticker, action, signal_type, entry_price, stop_loss,
      tp1, tp2, tp3, note, chart_url, snapshot_url, target_group, is_vip_only, status,
      source, strategy_id, tv_alert_uid, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    draft.signal_uid, draft.ticker, draft.action, draft.signal_type, draft.entry_price, draft.stop_loss,
    draft.tp1, draft.tp2, draft.tp3, draft.note, draft.chart_url || null, draft.snapshot_url || null, draft.target_group, draft.is_vip_only,
    shouldSend ? 'active' : 'pending', draft.source, draft.strategy_id, alertUid
  ).run();

  let delivery = { sent: 0, queued: 0, skipped: 0, total: 0 };
  if (shouldSend) {
    delivery = await broadcastSignal(db, draft, env);
    await db.prepare('UPDATE signals SET sent_count = ? WHERE signal_uid = ?').bind(delivery.sent, draft.signal_uid).run();
  }
  return { signalUid: draft.signal_uid, status: shouldSend ? 'active' : 'pending', delivery, paused: paused === '1' };
}

async function closeSignalFromTvExit(db, source, payload, alertUid) {
  const ticker = normalizeTvTicker(firstTvValue(payload.ticker, payload.symbol, payload.syminfo, payload.source));
  if (!ticker) throw new Error('TradingView exit alert 缺少 ticker');
  const price = tvOrderPrice(payload);
  if (price === null) throw new Error('TradingView exit alert 缺少 strategy.order.price / price / close');
  const requestedStrategy = String(firstTvValue(payload.strategy, payload.strategy_id, payload.strategyId)).trim();
  const type = inferTvExitType(payload);
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
  const result = await closeAdminSignal(db, `tv:${source.source_id}`, signal.signal_uid, {
    price,
    type,
    reason,
    notify: Boolean(source.auto_send)
  });
  return { ...result, status: 'closed', ticker, type, price, reason };
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
  const autoSend = payload.auto_send === true || payload.autoSend === true || payload.auto_send === 'true' || payload.autoSend === 'true' ? 1 : 0;
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
      target_group: draft.target_group,
      strategy_id: draft.strategy_id
    },
    strategy: { id: draft.strategy.strategy_id, name: draft.strategy.name, rules: draft.rules }
  };
}

async function handleTradingViewWebhook(request, env, sourceId, url) {
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

  const alertUid = String(payload.alert_uid || payload.alert_id || payload.id || `${payload.time || Date.now()}-${payload.ticker || payload.symbol || 'alert'}-${payload.action || payload.side || ''}`).slice(0, 180);
  const existingLog = await db.prepare('SELECT * FROM tv_alert_logs WHERE source_id = ? AND alert_uid = ?').bind(source.source_id, alertUid).first();
  if (existingLog?.signal_uid) {
    return json({ ok: true, duplicate: true, signalUid: existingLog.signal_uid, status: existingLog.status });
  }

  try {
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
    const result = await createSignalFromTvDraft(db, draft, alertUid, source.auto_send, env);
    await db.prepare(`
      INSERT OR REPLACE INTO tv_alert_logs (alert_uid, source_id, strategy_id, ticker, action, payload, signal_uid, status, error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, datetime('now'))
    `).bind(alertUid, source.source_id, draft.strategy_id, draft.ticker, draft.action, JSON.stringify(payload), result.signalUid, result.status).run();
    return json({ ok: true, source: source.source_id, ...result, signal: draft });
  } catch (e) {
    await db.prepare(`
      INSERT OR REPLACE INTO tv_alert_logs (alert_uid, source_id, payload, status, error, created_at)
      VALUES (?, ?, ?, 'error', ?, datetime('now'))
    `).bind(alertUid, source.source_id, JSON.stringify(payload), e.message).run();
    return json({ ok: false, error: e.message }, 400);
  }
}

async function handleAdminApi(request, env, pathname) {
  const auth = requireAdminHttp(request, env, true);
  if (auth) return auth;

  const db = env.DB;
  const adminId = env.ADMIN_WEB_USER || 'web-admin';
  const parts = pathname.split('/').filter(Boolean).slice(2);

  try {
    if (request.method === 'GET' && parts[0] === 'bootstrap') {
      return json({ ok: true, data: await getAdminBootstrap(db, env) });
    }

    if (request.method === 'POST' && parts[0] === 'signals' && parts.length === 1) {
      return json({ ok: true, data: await createAdminSignal(db, adminId, await readJsonBody(request), env) });
    }

    if (request.method === 'POST' && parts[0] === 'signals' && parts[2] === 'close') {
      return json({ ok: true, data: await closeAdminSignal(db, adminId, parts[1], await readJsonBody(request)) });
    }

    if (request.method === 'POST' && parts[0] === 'signals' && parts[2] === 'send') {
      return json({ ok: true, data: await sendPendingAdminSignal(db, adminId, parts[1], env) });
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

    if (request.method === 'POST' && parts[0] === 'tradingview' && parts[1] === 'sources') {
      return json({ ok: true, data: await upsertTradingViewSource(db, await readJsonBody(request)) });
    }

    if (request.method === 'POST' && parts[0] === 'tradingview' && parts[1] === 'preview') {
      return json({ ok: true, data: await previewTradingViewSignal(db, await readJsonBody(request)) });
    }

    if (request.method === 'POST' && parts[0] === 'users' && parts[1]) {
      return json({ ok: true, data: await updateAdminUser(db, adminId, decodeURIComponent(parts[1]), await readJsonBody(request)) });
    }

    if (request.method === 'POST' && parts[0] === 'orders' && parts[1] && parts[2]) {
      return json({ ok: true, data: await handleAdminOrderAction(db, adminId, parts[1], parts[2], await readJsonBody(request)) });
    }

    return json({ ok: false, error: 'Not found' }, 404);
  } catch (e) {
    return json({ ok: false, error: e.message }, 400);
  }
}

function renderAdminPage() {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DC Signals 後台</title>
  <style>
    :root {
      --bg: #f3f6f8;
      --panel: #ffffff;
      --panel-2: #f8fafc;
      --ink: #111827;
      --muted: #667085;
      --line: #d9e1ea;
      --soft: #edf3f7;
      --nav: #0d1824;
      --nav-2: #122638;
      --accent: #08a7b3;
      --accent-2: #087e90;
      --blue: #2368d9;
      --amber: #b7791f;
      --red: #d1433f;
      --green: #16845a;
      --shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
      --shadow-soft: 0 4px 16px rgba(15, 23, 42, 0.05);
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: var(--bg); color: var(--ink); overflow-x: hidden; }
    button, input, select, textarea { font: inherit; }
    .shell { min-height: 100vh; display: grid; grid-template-columns: 256px minmax(0, 1fr); }
    .sidebar { background: linear-gradient(180deg, #0d1824 0%, #102233 60%, #0b1420 100%); color: #f8fafc; padding: 20px 14px; display: flex; flex-direction: column; gap: 18px; }
    .brand { display: flex; align-items: center; gap: 11px; padding: 6px 8px 18px; border-bottom: 1px solid rgba(255,255,255,.11); }
    .mark { width: 38px; height: 38px; border-radius: 8px; display: grid; place-items: center; background: linear-gradient(135deg, #12c6d0, #1796ff); color: #06111c; font-weight: 900; letter-spacing: -0.5px; }
    .brand strong { display:block; font-size: 15px; line-height: 1.2; letter-spacing: .06em; }
    .brand span { display:block; color: #90a8ba; font-size: 12px; margin-top: 4px; }
    .nav { display: grid; gap: 4px; }
    .nav button { border: 0; width: 100%; color: #cbd7e4; background: transparent; display: flex; align-items: center; gap: 10px; height: 42px; padding: 0 12px; border-radius: 7px; cursor: pointer; text-align: left; font-size: 14px; font-weight: 650; }
    .nav button::before { content: attr(data-icon); width: 20px; color: #69d3dc; font-weight: 800; text-align: center; }
    .nav button.active, .nav button:hover { background: rgba(8, 167, 179, .18); color: #fff; }
    .nav small { margin-left: auto; color: #93a0ad; }
    .main { min-width: 0; max-width: 100%; display: flex; flex-direction: column; }
    .topbar { min-height: 72px; background: rgba(255,255,255,.9); backdrop-filter: blur(16px); border-bottom: 1px solid var(--line); display:grid; grid-template-columns: minmax(220px, .7fr) minmax(260px, 1fr) auto; gap: 14px; align-items:center; padding: 12px 24px; position: sticky; top: 0; z-index: 5; }
    .topbar h1 { font-size: 20px; line-height: 1.15; margin: 0; letter-spacing: 0; }
    .topbar .muted { font-size: 12px; }
    .status { display:flex; gap: 8px; align-items:center; flex-wrap: wrap; }
    .pill { display:inline-flex; align-items:center; gap:6px; min-height: 28px; border:1px solid var(--line); border-radius: 999px; padding: 3px 10px; background:#fff; color: var(--muted); font-size: 12px; white-space: nowrap; box-shadow: var(--shadow-soft); }
    .dot { width: 8px; height: 8px; border-radius: 99px; background: var(--green); }
    .content { min-width: 0; max-width: 100%; padding: 20px 22px 32px; display: grid; gap: 16px; }
    .view { display: none; gap: 16px; }
    .view.active { display: grid; }
    .view, .grid { min-width: 0; max-width: 100%; }
    .grid { display:grid; gap: 16px; }
    .grid > *, .panel, .table-wrap { min-width: 0; max-width: 100%; }
    .grid.two { grid-template-columns: minmax(360px, 0.95fr) minmax(420px, 1.3fr); align-items: start; }
    .grid.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .kpis { display:grid; grid-template-columns: repeat(6, minmax(136px, 1fr)); gap: 12px; }
    .kpi, .panel { background: var(--panel); border:1px solid var(--line); border-radius: 8px; box-shadow: var(--shadow-soft); }
    .kpi { padding: 14px; min-height: 92px; position: relative; overflow: hidden; }
    .kpi::after { content:''; position:absolute; inset:auto 0 0 0; height:3px; background: linear-gradient(90deg, var(--accent), transparent); }
    .kpi span { color: var(--muted); font-size: 12px; font-weight: 700; }
    .kpi strong { display:block; margin-top: 8px; font-size: 27px; line-height:1; letter-spacing: 0; }
    .kpi small { display:block; margin-top: 9px; color: var(--muted); font-size: 12px; }
    .kpi .kpi-icon { width: 30px; height: 30px; border-radius: 7px; display:grid; place-items:center; background: #e7f9fb; color: var(--accent-2); margin-bottom: 8px; font-weight: 900; }
    .panel { overflow: hidden; }
    .panel header { min-height: 56px; padding: 14px 16px; border-bottom: 1px solid var(--line); display:flex; align-items:center; justify-content:space-between; gap: 12px; }
    .panel header h2 { margin:0; font-size: 15px; line-height:1.2; }
    .panel header p { margin: 4px 0 0; color: var(--muted); font-size: 12px; }
    .panel .body { padding: 16px; }
    label { display:block; font-size: 12px; color: var(--muted); margin: 0 0 6px; }
    input, select, textarea { width: 100%; border:1px solid var(--line); border-radius: 6px; min-height: 38px; padding: 8px 10px; background:#fff; color: var(--ink); outline: none; }
    textarea { min-height: 74px; resize: vertical; }
    input:focus, select:focus, textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(15,159,154,.12); }
    .form-grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .form-grid .full { grid-column: 1 / -1; }
    .seg { display:grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
    .seg button, .btn { border:1px solid var(--line); border-radius: 6px; min-height: 38px; padding: 8px 11px; background:#fff; color: var(--ink); cursor:pointer; font-weight: 750; font-size: 13px; }
	    .seg button.active { background: var(--accent); border-color: var(--accent); color:#fff; }
	    .seg button:disabled, .btn:disabled { opacity: .55; cursor: not-allowed; }
    .btn.primary { background: var(--accent); border-color: var(--accent); color:#fff; }
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
    .command-search input { min-height: 42px; border-radius: 8px; padding-left: 40px; background: #f8fafc; box-shadow: inset 0 1px 0 rgba(255,255,255,.65); }
    .command-search span { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--muted); font-weight: 900; }
    .ops-hero { display:grid; grid-template-columns: minmax(0, 1fr) auto; gap: 20px; align-items:center; padding: 18px 20px; border: 1px solid var(--line); border-radius: 10px; background: linear-gradient(135deg, #ffffff 0%, #f4fbfc 52%, #eef6ff 100%); box-shadow: var(--shadow); }
    .ops-hero h2 { margin: 0; font-size: 24px; line-height: 1.12; letter-spacing: 0; }
    .ops-hero p { margin: 8px 0 0; color: var(--muted); font-size: 13px; max-width: 760px; }
    .ops-summary { display:grid; grid-template-columns: repeat(4, minmax(116px, 1fr)); gap: 10px; min-width: 520px; }
    .ops-tile { border: 1px solid rgba(8, 126, 144, .18); border-radius: 8px; background: rgba(255,255,255,.74); padding: 11px; }
    .ops-tile span { display:block; color: var(--muted); font-size: 11px; font-weight: 800; }
    .ops-tile strong { display:block; margin-top: 6px; font-size: 18px; }
    .ops-health-grid { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .health-card { border:1px solid var(--line); border-radius:8px; padding: 12px; background:#fff; display:grid; gap: 7px; border-left: 3px solid var(--accent); }
    .health-card strong { font-size: 14px; }
    .health-card p { margin:0; color: var(--muted); font-size: 12px; line-height: 1.45; }
    .health-card small { color: var(--muted); font-size: 11px; }
    .health-card.critical { border-left-color: var(--red); background:#fffafa; }
    .health-card.warning { border-left-color: var(--amber); background:#fffdf5; }
    .health-card.info { border-left-color: var(--blue); }
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
    .signal-card { border:1px solid var(--line); border-radius: 8px; background:#fff; padding: 12px; display:grid; gap: 10px; box-shadow: var(--shadow-soft); }
    .signal-card-head { display:flex; justify-content:space-between; gap: 10px; align-items:flex-start; }
    .signal-card-head strong { display:block; font-size: 15px; }
    .signal-card-head span { display:block; margin-top: 3px; font-size: 12px; color: var(--muted); }
    .signal-card-grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .signal-card-grid div { background: var(--panel-2); border-radius: 6px; padding: 8px; min-width: 0; }
    .signal-card-grid span { display:block; color: var(--muted); font-size: 11px; font-weight: 800; margin-bottom: 3px; }
    .signal-card-grid strong { display:block; font-size: 13px; word-break: break-word; }
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
	      .content { padding: 12px 12px 86px; gap: 12px; }
      .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .kpi { min-height: 68px; padding: 10px; }
      .kpi strong { font-size: 21px; }
      .ops-hero { padding: 14px; }
      .ops-hero h2 { font-size: 20px; }
      .ops-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .panel header { align-items:flex-start; flex-direction:column; min-height: unset; }
      .panel .body { padding: 12px; }
      .form-grid { grid-template-columns: 1fr; }
      .card-grid.two, .mini-stats, .source-meta { grid-template-columns: 1fr; }
      input, select, textarea, .btn, .seg button { min-height: 44px; }
      .actions { align-items: stretch; }
      .actions .btn { flex: 1 1 120px; }
      .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .table-wrap table { min-width: 680px; }
      th, td { padding: 10px; }
      .has-mobile-cards .table-wrap { display:none; }
      .mobile-list { display:grid; gap: 10px; }
      .signal-card-grid { grid-template-columns: 1fr; }
      .message { left: 12px; right: 12px; bottom: 78px; max-width: none; }
      .mobile-dock { position: fixed; left: 10px; right: 10px; bottom: 10px; display:flex; gap: 4px; padding: 8px; border:1px solid rgba(255,255,255,.45); border-radius: 16px; background: rgba(13,24,36,.94); backdrop-filter: blur(18px); z-index: 30; box-shadow: 0 18px 40px rgba(0,0,0,.25); overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
      .mobile-dock::-webkit-scrollbar { display: none; }
	      .mobile-dock button { border:0; background: transparent; color:#a9bdc9; display:grid; place-items:center; gap: 3px; min-height: 48px; min-width: 62px; border-radius: 10px; font-size: 11px; font-weight: 800; }
	      .mobile-dock button::before { content: attr(data-icon); display:block; color:#7af5ff; font-size: 13px; font-weight: 900; line-height: 1; }
	      .mobile-dock button.active { background: rgba(18,198,208,.18); color: #7af5ff; }
	    }
  </style>
</head>
<body>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand"><div class="mark">DC</div><div><strong>DC SIGNALS</strong><span>營運控制台</span></div></div>
      <nav class="nav" id="nav">
        <button data-view="overview" data-icon="⌂" class="active">總覽 <small>⌘1</small></button>
        <button data-view="signals" data-icon="↗">訊號工作台</button>
        <button data-view="strategies" data-icon="◇">策略實驗室</button>
        <button data-view="tradingview" data-icon="TV">TradingView</button>
        <button data-view="symbols" data-icon="▦">品種管理</button>
        <button data-view="users" data-icon="◎">會員管理</button>
        <button data-view="orders" data-icon="$">訂單管理</button>
        <button data-view="billing" data-icon="⚙">收費設定</button>
      </nav>
      <div class="admin-foot"><strong>Dan_mix</strong><span>超級管理員</span></div>
    </aside>
    <main class="main">
      <div class="topbar">
        <div><h1>自動交易訊號營運台</h1><div class="muted" id="serverTime">載入中</div></div>
        <div class="command-search"><span>⌕</span><input id="commandSearch" placeholder="搜尋訊號 UID、用戶、品種、策略"></div>
        <div class="status">
          <span class="pill"><span class="dot"></span>Worker 線上</span>
          <span class="pill" id="dbPill">D1 連線中</span>
          <button class="btn ghost" id="refreshBtn" type="button">重新整理</button>
        </div>
      </div>
      <section class="content">
        <section class="ops-hero">
          <div>
            <h2>Live Signal Operations</h2>
            <p>交易訊號、TradingView alert、會員收費與策略風控集中在同一個可行動工作台。</p>
          </div>
          <div class="ops-summary" id="opsSummary"></div>
        </section>
        <section class="panel">
          <header><div><h2>營運健康檢查</h2><p>正式販售前後都要看的風險佇列</p></div><div id="opsHealthBadge"></div></header>
          <div class="body"><div class="ops-health-grid" id="opsHealthGrid"></div></div>
        </section>
        <div class="kpis" id="kpis"></div>
        <div class="view active" id="view-overview">
          <div class="grid two">
            <section class="panel"><header><div><h2>即時訊號隊列</h2><p>草稿、已發送與待結案</p></div><div class="panel-tools"><button class="btn ghost" data-view-target="signals" type="button">查看全部</button></div></header><div class="table-wrap"><table><thead><tr><th>時間</th><th>品種</th><th>方向</th><th>價格</th><th>狀態</th><th></th></tr></thead><tbody id="recentSignals"></tbody></table></div></section>
            <section class="panel"><header><div><h2>策略健康度</h2><p>風控規則與近期訊號覆蓋</p></div><button class="btn ghost" data-view-target="strategies" type="button">策略</button></header><div class="body"><div class="card-grid" id="strategyHealth"></div></div></section>
          </div>
          <div class="grid two">
            <section class="panel"><header><div><h2>TradingView Gateway</h2><p>來源狀態與 webhook 就緒度</p></div><button class="btn ghost" data-view-target="tradingview" type="button">設定</button></header><div class="body"><div class="card-grid" id="tvGateway"></div></div></section>
            <section class="panel"><header><div><h2>會員營收概況</h2><p>訂閱組成與待處理訂單</p></div><button class="btn ghost" data-view-target="billing" type="button">收費</button></header><div class="body"><div id="revenueSummary"></div></div></section>
          </div>
          <div class="grid two">
            <section class="panel"><header><h2>待處理訂單</h2><button class="btn ghost" data-view-target="orders" type="button">查看訂單</button></header><div class="table-wrap"><table><thead><tr><th>訂單</th><th>用戶</th><th>方案</th><th>金額</th><th></th></tr></thead><tbody id="pendingOrders"></tbody></table></div></section>
            <section class="panel"><header><h2>最新 Alert 日誌</h2><button class="btn ghost" data-view-target="tradingview" type="button">查看全部</button></header><div class="table-wrap"><table><thead><tr><th>時間</th><th>來源</th><th>訊號</th><th>狀態</th></tr></thead><tbody id="overviewTvLogs"></tbody></table></div></section>
          </div>
        </div>
        <div class="view" id="view-signals"><div class="grid two"><section class="panel"><header><div><h2>快速發訊</h2><p>手動建立訊號或儲存草稿</p></div><span class="chip green" id="signalMode">即時發送</span></header><div class="body">${renderSignalFormHtml()}</div></section><section class="panel has-mobile-cards"><header><div><h2>訊號工作台</h2><p>審核草稿、發送、結案與取消</p></div><div class="filter-tabs" id="signalFilters"><button data-filter="all" class="active">全部</button><button data-filter="pending">草稿</button><button data-filter="active">已發送</button><button data-filter="closed">結案</button><button data-filter="cancelled">取消</button></div></header><div class="table-wrap"><table><thead><tr><th>時間</th><th>UID</th><th>品種</th><th>方向</th><th>類型</th><th>進場/止損/目標</th><th>圖表</th><th>發送</th><th>狀態</th><th></th></tr></thead><tbody id="signalsTable"></tbody></table></div><div class="mobile-list" id="signalsCards"></div></section></div></div>
        <div class="view" id="view-strategies"><div class="grid two"><section class="panel"><header><h2>策略列表</h2></header><div class="table-wrap"><table><thead><tr><th>排序</th><th>策略</th><th>等級</th><th>品種</th><th>狀態</th></tr></thead><tbody id="strategiesTable"></tbody></table></div></section><section class="panel"><header><h2>新增/更新策略</h2></header><div class="body">${renderStrategyFormHtml()}</div></section></div></div>
        <div class="view" id="view-tradingview">${renderTradingViewHtml()}</div>
        <div class="view" id="view-symbols"><div class="grid two"><section class="panel"><header><h2>品種列表</h2></header><div class="table-wrap"><table><thead><tr><th>排序</th><th>代碼</th><th>名稱</th><th>分類</th><th>Tick</th><th>狀態</th></tr></thead><tbody id="symbolsTable"></tbody></table></div></section><section class="panel"><header><h2>新增/更新品種</h2></header><div class="body">${renderSymbolFormHtml()}</div></section></div></div>
        <div class="view" id="view-users"><section class="panel"><header><h2>會員維護</h2><span class="muted">最近 50 位用戶</span></header><div class="table-wrap"><table><thead><tr><th>用戶</th><th>等級</th><th>到期</th><th>消費</th><th>狀態</th><th></th></tr></thead><tbody id="usersTable"></tbody></table></div></section></div>
        <div class="view" id="view-orders"><section class="panel"><header><h2>訂單維護</h2></header><div class="table-wrap"><table><thead><tr><th>時間</th><th>訂單</th><th>用戶</th><th>方案</th><th>金額</th><th>付款備註</th><th>狀態</th><th></th></tr></thead><tbody id="ordersTable"></tbody></table></div></section></div>
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
	    <button data-view-target="symbols" data-icon="▦">品種</button>
	    <button data-view-target="users" data-icon="◎">會員</button>
	    <button data-view-target="orders" data-icon="$">訂單</button>
	    <button data-view-target="billing" data-icon="⚙">收費</button>
	  </nav>
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
      <div><label>發送模式</label><select name="send"><option value="true">立即發送</option><option value="false">只存草稿</option></select></div>
      <div class="full"><label>TradingView 圖表 URL</label><input name="chart_url" inputmode="url" placeholder="https://www.tradingview.com/chart/..."></div>
      <div class="full"><label>Telegram 截圖 / 快照 URL</label><input name="snapshot_url" inputmode="url" placeholder="https://... 可公開讀取的圖片 URL"></div>
      <div class="full"><label>備註</label><textarea name="note" placeholder="盤勢、策略、風險提醒"></textarea></div>
    </div>
    <div class="preview signal-preview warn" id="signalPreview">載入品種後可建立訊號。</div>
	    <div class="actions"><button class="btn primary" id="createSignalBtn" type="submit" disabled>建立訊號</button><button class="btn ghost" type="reset">清空</button></div>
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
      <header><div><h2>TradingView Gateway</h2><p>多來源 webhook、secret、策略與發送模式</p></div><button class="btn primary" type="button" data-copy="tv-current">複製目前 Webhook</button></header>
      <div class="body"><div class="card-grid two" id="tvSourceCards"></div></div>
    </section>
  </div>
  <div class="grid two">
    <section class="panel">
      <header><div><h2>來源維護</h2><p>新增/更新 TradingView alert 來源</p></div></header>
      <div class="table-wrap"><table><thead><tr><th>來源</th><th>策略</th><th>品種</th><th>目標</th><th>模式</th></tr></thead><tbody id="tvSourcesTable"></tbody></table></div>
      <div class="body">${renderTradingViewSourceFormHtml()}</div>
    </section>
    <section class="panel">
	      <header><div><h2>現有策略 Alert 產生器</h2><p>給 TradingView Strategy Order fills alert 使用</p></div></header>
      <div class="body">${renderTradingViewGeneratorHtml()}</div>
    </section>
    <section class="panel" style="grid-column:1/-1">
      <header><h2>Alert 日誌</h2></header>
      <div class="table-wrap"><table><thead><tr><th>時間</th><th>來源</th><th>策略</th><th>品種</th><th>方向</th><th>狀態</th><th>訊號</th></tr></thead><tbody id="tvLogsTable"></tbody></table></div>
    </section>
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
      <div><label>接收模式</label><select name="auto_send"><option value="false">先存草稿</option><option value="true">自動發送</option></select></div>
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
      <div><label>方向</label><select id="tvGenAction"><option value="AUTO">TradingView 帶入</option><option value="LONG">做多</option><option value="SHORT">做空</option></select></div>
      <div><label>週期</label><input id="tvGenInterval" value="15"></div>
      <div><label>預覽價格</label><input id="tvGenPrice" inputmode="decimal" value="21500"></div>
      <div class="full"><label>Webhook URL</label><input class="readonly" id="tvWebhookUrl" readonly></div>
	      <div class="full"><label>TradingView Alert Message</label><textarea class="copybox readonly" id="tvAlertMessage" readonly></textarea></div>
    </div>
    <div class="actions"><button class="btn primary" type="button" id="tvGenerateBtn">產生設定</button><button class="btn ghost" type="button" data-copy-input="tvWebhookUrl">複製 Webhook</button><button class="btn ghost" type="button" data-copy-input="tvAlertMessage">複製 Message</button><button class="btn ghost" type="button" id="tvPreviewBtn">預覽點位</button></div>
    <div class="preview" id="tvPreview"></div>
  </div>`;
}

function renderSymbolFormHtml() {
  return `<form id="symbolForm" class="stack">
    <div class="form-grid">
      <div><label>代碼</label><input name="symbol" required placeholder="NQ"></div>
      <div><label>排序</label><input name="sort_order" inputmode="numeric" value="0"></div>
      <div><label>英文名稱</label><input name="name" required></div>
      <div><label>中文名稱</label><input name="name_zh"></div>
      <div><label>分類</label><select name="category"><option value="index">指數</option><option value="metal">貴金屬</option><option value="energy">能源</option><option value="forex">外匯</option></select></div>
      <div><label>狀態</label><select name="is_active"><option value="true">啟用</option><option value="false">停用</option></select></div>
      <div><label>Tick Size</label><input name="tick_size" inputmode="decimal" value="0.25"></div>
      <div><label>Tick Value</label><input name="tick_value" inputmode="decimal" value="5"></div>
    </div>
    <button class="btn primary" type="submit">儲存品種</button>
  </form>`;
}

function renderConfigFormHtml() {
  return `<div class="stack">
  <div class="card-grid two" id="billingReadiness"></div>
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
      <div><label>客服 Telegram</label><input name="contact_telegram"></div>
      <div><label>客服 LINE</label><input name="contact_line"></div>
      <div><label>付款銀行</label><input name="payment_bank"></div>
      <div><label>付款帳號</label><input name="payment_account"></div>
      <div><label>付款戶名</label><input name="payment_name"></div>
      <div class="full"><label>歡迎訊息</label><textarea name="welcome_message"></textarea></div>
    </div>
    <button class="btn primary" type="submit">儲存設定</button>
  </form>
  </div>`;
}

function renderAdminScript() {
  return `
var state = { data: null, action: 'LONG', query: '', signalFilter: 'all' };
var views = Array.prototype.slice.call(document.querySelectorAll('.view'));
var navButtons = Array.prototype.slice.call(document.querySelectorAll('[data-view]'));
var dockButtons = Array.prototype.slice.call(document.querySelectorAll('#mobileDock [data-view-target]'));
var messageEl = document.getElementById('message');
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
function chip(text, tone) { return '<span class="chip ' + (tone || '') + '">' + esc(text) + '</span>'; }
function setMessage(text, tone) {
  messageEl.textContent = text || '';
  messageEl.className = 'message ' + (tone || '');
  if (text && tone === 'ok') setTimeout(function () { if (messageEl.textContent === text) setMessage(''); }, 4200);
}
function showView(view) {
  views.forEach(function (el) { el.classList.toggle('active', el.id === 'view-' + view); });
  navButtons.forEach(function (btn) { btn.classList.toggle('active', btn.dataset.view === view); });
  dockButtons.forEach(function (btn) { btn.classList.toggle('active', btn.dataset.viewTarget === view); });
}
async function api(path, options) {
  var res = await fetch(path, Object.assign({ credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }, options || {}));
  if (res.status === 401) { location.reload(); return; }
  var text = await res.text();
  var data;
  try { data = text ? JSON.parse(text) : {}; } catch (e) { throw new Error(text || ('HTTP ' + res.status)); }
  if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
  if (!data.ok) throw new Error(data.error || '操作失敗');
  return data.data;
}
async function load() {
  setMessage('同步後台資料中...');
  state.data = await api('/api/admin/bootstrap');
  renderAll();
  setMessage('已同步 ' + state.data.serverTime, 'ok');
}
function renderAll() {
  renderSignalSymbolOptions();
  renderOpsSummary();
  renderOpsHealth();
  renderKpis();
  renderConfigSummary();
  renderConfigForm();
  renderBillingReadiness();
  renderSignals();
  renderOrders();
  renderUsers();
  renderSymbols();
  renderStrategies();
  renderTradingView();
  renderStrategyHealth();
  renderTvGateway();
  renderRevenueSummary();
  renderOverviewTvLogs();
  updateSignalPreview();
  document.getElementById('serverTime').textContent = '最後同步 ' + state.data.serverTime;
  document.getElementById('dbPill').textContent = 'D1 dc-signals-v91-db';
}
function renderOpsSummary() {
  var s = state.data.stats;
  var ops = state.data.ops || {};
  var sources = state.data.tvSources || [];
  var signals = state.data.signals || [];
  var activeSources = sources.filter(function (x) { return x.is_active; }).length;
  var drafts = signals.filter(function (x) { return x.status === 'pending'; }).length;
  var paused = ops.statusText || (s.paused ? '暫停發訊' : '正常運行');
  document.getElementById('opsSummary').innerHTML = [
    ['營運狀態', paused],
    ['待審草稿', drafts + ' 筆'],
    ['TV 來源', activeSources + '/' + sources.length],
    ['待處理訂單', s.pendingOrders + ' 筆']
  ].map(function (item) {
    return '<div class="ops-tile"><span>' + esc(item[0]) + '</span><strong>' + esc(item[1]) + '</strong></div>';
  }).join('');
}
function renderOpsHealth() {
  var ops = state.data.ops || { status: 'ok', statusText: '正常', issues: [] };
  var integrations = state.data.integrations || ops.integrations || {};
  var stripe = integrations.stripe || {};
  var oauth = integrations.oauth || {};
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
  cards.push('<article class="health-card ' + (oauth.enabledCount ? 'info' : 'warning') + '"><strong>第三方登入</strong><p>' + (oauth.enabledCount ? '已啟用 ' + esc(oauthNames) + '。' : '尚未啟用 Google / LINE，會員仍可用 Telegram 登入碼。') + '</p><small>會員中心 ' + esc(integrations.memberUrl || '/member') + '</small></article>');
  cards.push('<article class="health-card ' + (cron.manualSecret ? 'info' : 'warning') + '"><strong>Cron 手動端點</strong><p>' + (cron.manualSecret ? '手動維運端點已由 CRON_SECRET 保護。' : '手動維運端點已鎖定；需設定 CRON_SECRET 才能外部觸發。') + '</p><small>Cloudflare scheduled cron 不受影響</small></article>');
  cards.push('<article class="health-card info"><strong>TradingView</strong><p>24H Alert ' + esc((ops.alertStats && ops.alertStats.total24) || 0) + ' 筆，錯誤 ' + esc((ops.alertStats && ops.alertStats.failed24) || 0) + ' 筆。</p><small>最新 ' + esc((ops.alertStats && ops.alertStats.latestAt) ? dateText(ops.alertStats.latestAt) : '尚無紀錄') + '</small></article>');
  cards.push('<article class="health-card info"><strong>會員安全</strong><p>登入碼與訂單建立已啟用速率限制。</p><small>目前限制中 ' + esc((ops.securityStats && ops.securityStats.activeRateLimits) || 0) + '，高頻 ' + esc((ops.securityStats && ops.securityStats.hotRateLimits) || 0) + '</small></article>');
  cards.push('<article class="health-card info"><strong>後台效能</strong><p>Bootstrap ' + esc(ops.bootstrapMs || '-') + 'ms。</p><small>待發佇列 ' + esc((ops.queueStats && ops.queueStats.due) || 0) + '，付款待確認 ' + esc((ops.orderStats && ops.orderStats.paid) || 0) + '</small></article>');
  document.getElementById('opsHealthGrid').innerHTML = cards.join('');
}
function renderKpis() {
  var s = state.data.stats;
  var ops = state.data.ops || {};
  var users = state.data.users || [];
  var revenue = users.reduce(function (sum, u) { return sum + Number(u.total_spent || 0); }, 0);
  var sentToday = (state.data.signals || []).filter(function (sig) { return sig.status === 'active' || sig.status === 'closed'; }).length;
  var items = [
    ['↗', '今日訊號', s.todaySignals, '草稿/發送合計'],
    ['✓', '已發送', sentToday, '目前載入視窗'],
    ['◎', '會員總數', s.totalUsers, 'Pro ' + s.proUsers + ' / VIP ' + s.vipUsers],
    ['$', '營收累計', money(revenue), '可見會員統計'],
    ['%', '勝率', s.winRate + '%', '今日績效'],
    ['⚡', '系統延遲', (ops.bootstrapMs || '-') + 'ms', ops.statusText || (s.paused ? '發訊暫停' : 'API 正常')]
  ];
  document.getElementById('kpis').innerHTML = items.map(function (item) {
    return '<div class="kpi"><div class="kpi-icon">' + esc(item[0]) + '</div><span>' + esc(item[1]) + '</span><strong>' + esc(item[2]) + '</strong><small>' + esc(item[3]) + '</small></div>';
  }).join('');
}
function renderConfigSummary() {
  var summary = document.getElementById('configSummary');
  if (!summary) return;
  var c = state.data.config;
  var integrations = state.data.integrations || {};
  var stripe = integrations.stripe || {};
  var oauth = integrations.oauth || {};
  summary.innerHTML =
    '<div class="actions">' + (c.signals_paused === '1' ? chip('訊號暫停', 'amber') : chip('訊號運行中', 'green')) + chip('Pro ' + money(c.pro_price_1m), '') + chip('VIP ' + money(c.vip_price_1m), '') + chip(stripe.enabled ? '線上付款已啟用' : '線上付款未啟用', stripe.enabled ? 'green' : 'amber') + chip((oauth.enabledCount || 0) + ' 個第三方登入', oauth.enabledCount ? 'green' : 'amber') + '</div>' +
    '<div class="muted">付款：' + esc(c.payment_bank || '-') + ' / ' + esc(c.payment_account || '-') + '</div>' +
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
  cards.push(readinessCard(
    '會員第三方登入',
    oauth.enabledCount ? 'info' : 'warning',
    oauth.enabledCount ? '已啟用 ' + esc(oauthNames) + '，純網站會員可直接登入會員中心。' : '尚未啟用 Google / LINE；會員仍可由 Telegram /login 取得一次性登入碼。',
    'Google callback 與 LINE callback 請分別貼到 OAuth 後台。',
    (oauth.callbackUrls && oauth.callbackUrls.google) || ''
  ));
  cards.push(readinessCard(
    'LINE OAuth Callback',
    (oauth.providers || []).some(function (p) { return p.id === 'line' && p.enabled; }) ? 'info' : 'warning',
    'LINE 登入啟用時使用此 callback URL。',
    '若暫時不用 LINE，可先保持未設定。',
    (oauth.callbackUrls && oauth.callbackUrls.line) || ''
  ));
  cards.push(readinessCard(
    'Telegram 會員入口',
    telegram.botToken ? 'info' : 'critical',
    telegram.botToken ? 'Telegram 登入碼與推播可用。' : 'BOT_TOKEN 尚未設定，Telegram 推播與登入碼不可用。',
    'Bot ' + esc(telegram.botUsername || '-') + ' · 會員中心 ' + esc(integrations.memberUrl || '/member'),
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
  return action === 'LONG' ? '做多' : action === 'SHORT' ? '做空' : (action || '-');
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
function signalTargetHtml(sig) {
  var rows = [['進場', sig.entry_price], ['止損', sig.stop_loss], ['TP1', sig.tp1], ['TP2', sig.tp2], ['TP3', sig.tp3]]
    .filter(function (row, index) { return index < 2 || row[1] !== null && row[1] !== undefined && row[1] !== ''; });
  return '<div class="target-stack">' + rows.map(function (row) {
    return '<span>' + esc(row[0]) + ' ' + esc(priceText(row[1])) + '</span>';
  }).join('') + '</div>';
}
function signalActionButtons(sig) {
  if (sig.status === 'active') return '<button class="btn warn" data-close="' + esc(sig.signal_uid) + '">結案</button>';
  if (sig.status === 'pending') return '<button class="btn primary" data-send="' + esc(sig.signal_uid) + '">發送</button><button class="btn danger" data-cancel="' + esc(sig.signal_uid) + '">取消</button>';
  return '';
}
function signalRow(sig, compact) {
  var tone = statusTone(sig.status);
  var targets = signalTargetHtml(sig);
  var media = signalMediaButtons(sig);
  var action = signalActionButtons(sig);
  if (compact) {
    return '<tr><td>' + esc(dateText(sig.created_at)) + '</td><td>' + esc(sig.ticker) + '</td><td>' + chip(actionText(sig.action), sig.action === 'LONG' ? 'green' : 'red') + '</td><td>' + targets + '</td><td>' + chip(statusText(sig), tone) + '</td><td class="actions">' + media + action + '</td></tr>';
  }
  return '<tr><td>' + esc(dateText(sig.created_at)) + '</td><td><code>' + esc(sig.signal_uid) + '</code><div class="muted">' + esc(sig.source || sig.strategy_id || '') + '</div></td><td>' + esc(sig.ticker) + '</td><td>' + chip(actionText(sig.action), sig.action === 'LONG' ? 'green' : 'red') + '</td><td>' + esc(sig.signal_type) + '</td><td>' + targets + '</td><td>' + media + '</td><td>' + esc(sig.sent_count || 0) + '</td><td>' + chip(statusText(sig), tone) + '</td><td class="actions">' + action + '</td></tr>';
}
function signalCard(sig) {
  return '<article class="signal-card">' +
    '<div class="signal-card-head"><div><strong>' + esc(sig.ticker) + ' ' + esc(actionText(sig.action)) + '</strong><span>' + esc(dateText(sig.created_at)) + ' · ' + esc(sig.signal_type || '-') + '</span></div>' + chip(statusText(sig), statusTone(sig.status)) + '</div>' +
    '<div class="signal-card-grid">' +
      '<div><span>進場</span><strong>' + esc(priceText(sig.entry_price)) + '</strong></div>' +
      '<div><span>止損</span><strong>' + esc(priceText(sig.stop_loss)) + '</strong></div>' +
      '<div><span>TP1</span><strong>' + esc(priceText(sig.tp1)) + '</strong></div>' +
      '<div><span>TP2 / TP3</span><strong>' + esc(priceText(sig.tp2)) + ' / ' + esc(priceText(sig.tp3)) + '</strong></div>' +
      '<div><span>發送</span><strong>' + esc(sig.sent_count || 0) + ' 人</strong></div>' +
      '<div><span>單號</span><strong>' + esc(String(sig.signal_uid || '').slice(0, 8)) + '</strong></div>' +
    '</div>' +
    '<div class="actions">' + signalMediaButtons(sig) + signalActionButtons(sig) + '</div>' +
  '</article>';
}
function renderSignals() {
  var signals = filteredSignals();
  document.getElementById('recentSignals').innerHTML = signals.slice(0, 8).map(function (s) { return signalRow(s, true); }).join('') || '<tr><td colspan="6" class="muted">尚無訊號</td></tr>';
  document.getElementById('signalsTable').innerHTML = signals.map(function (s) { return signalRow(s, false); }).join('') || '<tr><td colspan="10" class="muted">尚無訊號</td></tr>';
  document.getElementById('signalsCards').innerHTML = signals.map(signalCard).join('') || '<div class="muted">尚無訊號</div>';
}
function orderEventLabel(type) {
  var map = { created:'建立', stripe_session_created:'Checkout', stripe_session_failed:'Checkout 失敗', paid_notice:'付款通知', stripe_skipped:'Stripe 待付款', confirmed:'已確認', rejected:'已拒絕', cancelled:'已取消' };
  return map[type] || type || '紀錄';
}
function latestOrderEvent(orderId) {
  var id = String(orderId || '').toUpperCase();
  return (state.data.orderEvents || []).find(function (event) { return String(event.order_id || '').toUpperCase() === id; });
}
function orderRow(order, compact) {
  var user = order.username ? '@' + order.username : (order.first_name || order.user_id);
  var tone = order.status === 'paid' ? 'amber' : order.status === 'confirmed' ? 'green' : order.status === 'rejected' ? 'red' : '';
  var actions = order.status === 'pending' || order.status === 'paid'
    ? '<button class="btn primary" data-confirm-order="' + esc(order.order_id) + '">確認</button><button class="btn danger" data-reject-order="' + esc(order.order_id) + '">拒絕</button>'
    : '';
  var method = order.payment_provider || order.payment_method || 'manual';
  var session = order.payment_session_id ? '<div class="muted"><code>' + esc(order.payment_session_id) + '</code></div>' : '';
  var lastEvent = latestOrderEvent(order.order_id);
  var eventHtml = lastEvent ? '<div class="order-event"><b>' + esc(orderEventLabel(lastEvent.event_type)) + '</b> ' + esc(dateText(lastEvent.created_at)) + (lastEvent.message ? '<br>' + esc(lastEvent.message) : '') + '</div>' : '';
  var note = (method === 'stripe' ? '<b>Stripe</b>' + session : '') + (order.payment_note ? '<div>' + esc(order.payment_note).replace(/\\n/g, '<br>') + '</div>' : '');
  note += eventHtml;
  if (!note) note = '<span class="muted">-</span>';
  if (compact) return '<tr><td><code>' + esc(order.order_id) + '</code><div class="note-cell">' + note + '</div></td><td>' + esc(user) + '</td><td>' + esc(order.tier) + ' ' + esc(order.months) + '月</td><td>' + money(order.amount) + '</td><td class="actions">' + actions + '</td></tr>';
  return '<tr><td>' + esc(dateText(order.created_at)) + '</td><td><code>' + esc(order.order_id) + '</code></td><td>' + esc(user) + '</td><td>' + esc(order.tier) + ' ' + esc(order.months) + '月</td><td>' + money(order.amount) + '</td><td class="note-cell">' + note + '</td><td>' + chip(order.status, tone) + '</td><td class="actions">' + actions + '</td></tr>';
}
function renderOrders() {
  var orders = state.data.orders || [];
  var pending = orders.filter(function (o) { return o.status === 'pending' || o.status === 'paid'; });
  document.getElementById('pendingOrders').innerHTML = pending.slice(0, 8).map(function (o) { return orderRow(o, true); }).join('') || '<tr><td colspan="5" class="muted">沒有待處理訂單</td></tr>';
  document.getElementById('ordersTable').innerHTML = orders.map(function (o) { return orderRow(o, false); }).join('') || '<tr><td colspan="8" class="muted">尚無訂單</td></tr>';
}
function renderUsers() {
  var users = state.data.users || [];
  document.getElementById('usersTable').innerHTML = users.map(function (u) {
    var name = u.username ? '@' + u.username : (u.first_name || u.user_id);
    var status = u.is_banned ? chip('封禁', 'red') : u.is_active ? chip('啟用', 'green') : chip('停用', 'amber');
    return '<tr><td><div>' + esc(name) + '</div><div class="muted"><code>' + esc(u.user_id) + '</code></div></td><td>' + chip(u.tier, u.tier === 'vip' ? 'amber' : u.tier === 'pro' ? 'green' : '') + '</td><td>' + esc(u.tier_expires_at ? dateText(u.tier_expires_at) : '-') + '</td><td>' + money(u.total_spent || 0) + '</td><td>' + status + '</td><td class="actions"><button class="btn ghost" data-user-tier="' + esc(u.user_id) + '|pro">Pro+30</button><button class="btn ghost" data-user-tier="' + esc(u.user_id) + '|vip">VIP+30</button><button class="btn danger" data-user-ban="' + esc(u.user_id) + '|' + (u.is_banned ? '0' : '1') + '">' + (u.is_banned ? '解封' : '封禁') + '</button></td></tr>';
  }).join('') || '<tr><td colspan="6" class="muted">尚無會員</td></tr>';
}
function renderSymbols() {
  document.getElementById('symbolsTable').innerHTML = (state.data.symbols || []).map(function (s) {
    return '<tr><td>' + esc(s.sort_order) + '</td><td><code>' + esc(s.symbol) + '</code></td><td>' + esc(s.name_zh || s.name) + '</td><td>' + esc(s.category) + '</td><td>' + esc(s.tick_size) + ' / ' + esc(s.tick_value) + '</td><td>' + (s.is_active ? chip('啟用','green') : chip('停用','red')) + '</td></tr>';
  }).join('') || '<tr><td colspan="6" class="muted">尚無品種</td></tr>';
}
function renderStrategies() {
  document.getElementById('strategiesTable').innerHTML = (state.data.strategies || []).map(function (s) {
    return '<tr><td>' + esc(s.sort_order) + '</td><td><div>' + esc(s.name) + '</div><div class="muted"><code>' + esc(s.strategy_id) + '</code></div></td><td>' + chip(s.tier, s.tier === 'vip' ? 'amber' : 'green') + '</td><td>' + esc(parseJsonList(s.symbols).join(', ')) + '</td><td>' + (s.is_active ? chip('啟用','green') : chip('停用','red')) + '</td></tr>';
  }).join('') || '<tr><td colspan="5" class="muted">尚無策略</td></tr>';
}
function signalMatchesQuery(sig) {
  var q = (state.query || '').trim().toLowerCase();
  if (!q) return true;
  return [sig.signal_uid, sig.ticker, sig.action, sig.signal_type, sig.strategy_id, sig.source, sig.note].some(function (value) {
    return String(value || '').toLowerCase().includes(q);
  });
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
    (compact ? '' : '<div class="copy-row"><code>' + esc(webhook) + '</code><button class="btn ghost" data-copy-value="' + esc(webhook) + '" type="button">複製</button></div>') +
  '</div>';
}
function renderRevenueSummary() {
  var users = state.data.users || [];
  var pro = users.filter(function (u) { return u.tier === 'pro'; }).length;
  var vip = users.filter(function (u) { return u.tier === 'vip'; }).length;
  var free = users.filter(function (u) { return u.tier === 'free'; }).length;
  var total = Math.max(1, users.length);
  var spent = users.reduce(function (sum, u) { return sum + Number(u.total_spent || 0); }, 0);
  document.getElementById('revenueSummary').innerHTML = '<div class="revenue-stack">' +
    '<div class="revenue-total"><div><span class="muted">可見會員累計消費</span><strong>' + money(spent) + '</strong></div>' + chip('訂單 ' + state.data.stats.pendingOrders, state.data.stats.pendingOrders ? 'amber' : 'green') + '</div>' +
    mixRow('VIP', vip, total) + mixRow('Pro', pro, total) + mixRow('Free', free, total) +
  '</div>';
}
function mixRow(label, value, total) {
  var pct = Math.round((value / total) * 100);
  return '<div class="mix-row"><span>' + esc(label) + '</span><div class="bar"><i style="width:' + pct + '%"></i></div><strong>' + esc(value) + ' (' + pct + '%)</strong></div>';
}
function renderOverviewTvLogs() {
  document.getElementById('overviewTvLogs').innerHTML = (state.data.tvLogs || []).slice(0, 6).map(function (log) {
    var tone = log.status === 'error' ? 'red' : log.status === 'active' ? 'green' : 'amber';
    return '<tr><td>' + esc(dateText(log.created_at)) + '</td><td>' + esc(log.source_id) + '</td><td>' + esc((log.ticker || '-') + ' ' + (log.action || '')) + '</td><td>' + chip(log.error || log.status, tone) + '</td></tr>';
  }).join('') || '<tr><td colspan="4" class="muted">尚無 alert</td></tr>';
}
function renderTradingView() {
  var strategies = state.data.strategies || [];
  var sources = state.data.tvSources || [];
  var symbols = state.data.symbols || [];
  var strategyOptions = '<option value="">自動選擇</option>' + strategies.map(function (s) {
    return '<option value="' + esc(s.strategy_id) + '">' + esc(s.name + ' (' + s.strategy_id + ')') + '</option>';
  }).join('');
  var genStrategyOptions = '<option value="auto">自動選擇</option>' + strategies.map(function (s) {
    return '<option value="' + esc(s.strategy_id) + '">' + esc(s.name) + '</option>';
  }).join('');
  var sourceOptions = sources.map(function (s) {
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
    return '<tr><td><div>' + esc(s.name) + '</div><div class="muted"><code>' + esc(s.source_id) + '</code></div></td><td>' + esc(s.default_strategy_id || 'auto') + '</td><td>' + esc(symbolsText) + '</td><td>' + chip(s.target_group || 'pro', s.target_group === 'vip' ? 'amber' : 'green') + '</td><td>' + (s.auto_send ? chip('自動發送','green') : chip('草稿','amber')) + ' ' + (s.is_active ? chip('啟用','green') : chip('停用','red')) + '</td></tr>';
  }).join('') || '<tr><td colspan="5" class="muted">尚無來源</td></tr>';
  document.getElementById('tvSourceCards').innerHTML = sources.map(function (s) { return tvSourceCard(s, false); }).join('') || '<div class="muted">尚無來源</div>';
  document.getElementById('tvLogsTable').innerHTML = (state.data.tvLogs || []).map(function (log) {
    var tone = log.status === 'error' ? 'red' : log.status === 'active' ? 'green' : 'amber';
    return '<tr><td>' + esc(dateText(log.created_at)) + '</td><td>' + esc(log.source_id) + '</td><td>' + esc(log.strategy_id || '-') + '</td><td>' + esc(log.ticker || '-') + '</td><td>' + esc(log.action || '-') + '</td><td>' + chip(log.error || log.status, tone) + '</td><td><code>' + esc(log.signal_uid || '-') + '</code></td></tr>';
  }).join('') || '<tr><td colspan="7" class="muted">尚無 alert</td></tr>';
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
function buildTradingViewAlertMessage() {
  var source = getSelectedTvSource();
  if (!source) return '';
  var strategy = getSelectedTvStrategy();
  var action = document.getElementById('tvGenAction').value;
	  var message = {
	    strategy: strategy ? strategy.strategy_id : 'auto',
	    ticker: '{{ticker}}',
	    exchange: '{{exchange}}',
	    action: action === 'AUTO' ? '{{strategy.order.action}}' : action,
	    order_id: '{{strategy.order.id}}',
	    order_comment: '{{strategy.order.comment}}',
	    order_price: '{{strategy.order.price}}',
	    contracts: '{{strategy.order.contracts}}',
	    market_position: '{{strategy.market_position}}',
	    prev_market_position: '{{strategy.prev_market_position}}',
	    price: '{{strategy.order.price}}',
	    close: '{{close}}',
	    time: '{{time}}',
	    interval: '{{interval}}',
	    chart_url: 'https://www.tradingview.com/chart/?symbol={{exchange}}:{{ticker}}',
	    snapshot_url: '',
	    alert_id: '{{ticker}}-{{time}}-' + (strategy ? strategy.strategy_id : 'auto')
	  };
  return JSON.stringify(message, null, 2);
}
function updateTradingViewGenerator() {
  var source = getSelectedTvSource();
  document.getElementById('tvWebhookUrl').value = source ? location.origin + '/tv/' + source.source_id : '';
  document.getElementById('tvAlertMessage').value = buildTradingViewAlertMessage();
}
function parseJsonList(value) { try { var parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed : []; } catch (e) { return []; } }
function parseObject(value, fallback) { try { var parsed = typeof value === 'string' ? JSON.parse(value || '{}') : value; return parsed && typeof parsed === 'object' ? parsed : (fallback || {}); } catch (e) { return fallback || {}; } }
function formPayload(form) {
  var data = {};
  Array.prototype.slice.call(new FormData(form).entries()).forEach(function (pair) { data[pair[0]] = pair[1]; });
  ['entry_price','stop_loss','tp1','tp2','tp3','tick_size','tick_value','sort_order'].forEach(function (key) { if (data[key] !== undefined && data[key] !== '') data[key] = Number(data[key]); });
  ['send','is_active','auto_send'].forEach(function (key) { if (data[key] !== undefined) data[key] = data[key] === 'true'; });
  return data;
}
function currentSignalDraft() {
  var form = document.getElementById('signalForm');
  if (!form) return {};
  var data = formPayload(form);
  var select = document.getElementById('signalTicker');
  if (!data.ticker && select && select.value) data.ticker = select.value;
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
    '<div class="muted">風險 ' + esc(priceText(risk)) + ' 點 · RR 1:' + esc(rr) + '</div>';
}
function signalPayload(form) {
  var data = formPayload(form);
  var select = document.getElementById('signalTicker');
  if (!data.ticker && select && select.value) data.ticker = select.value;
  if (!data.ticker) throw new Error('請先選擇品種');
  return data;
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
    var confirmOrder = event.target.closest('[data-confirm-order]');
    if (confirmOrder) { var orderOk = await confirmAdminAction('確認訂單', '確認後會延長會員期限並通知用戶。', '確認入帳', 'primary'); if (!orderOk) return; await api('/api/admin/orders/' + encodeURIComponent(confirmOrder.dataset.confirmOrder) + '/confirm', { method: 'POST', body: '{}' }); await load(); }
    var rejectOrder = event.target.closest('[data-reject-order]');
    if (rejectOrder) { var reject = await adminDialog({ title: '拒絕訂單', body: '拒絕後會通知用戶原因。', confirmText: '拒絕訂單', tone: 'danger', fields: [{ name: 'reason', label: '拒絕原因', value: '付款未確認' }] }); if (!reject) return; await api('/api/admin/orders/' + encodeURIComponent(rejectOrder.dataset.rejectOrder) + '/reject', { method: 'POST', body: JSON.stringify({ reason: reject.reason }) }); await load(); }
    var userTier = event.target.closest('[data-user-tier]');
    if (userTier) { var parts = userTier.dataset.userTier.split('|'); var tierOk = await confirmAdminAction('調整會員等級', '將此用戶升級為 ' + parts[1].toUpperCase() + ' 並增加 30 天。', '套用', 'primary'); if (!tierOk) return; await api('/api/admin/users/' + encodeURIComponent(parts[0]), { method: 'POST', body: JSON.stringify({ tier: parts[1], days: 30 }) }); await load(); }
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
document.getElementById('commandSearch').addEventListener('input', function (event) { state.query = event.target.value; renderSignals(); });
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
document.getElementById('strategyForm').addEventListener('submit', async function (event) { event.preventDefault(); try { await api('/api/admin/strategies', { method: 'POST', body: JSON.stringify(formPayload(event.target)) }); event.target.reset(); await load(); } catch (err) { showError(err, '儲存策略失敗'); } });
document.getElementById('tvSourceForm').addEventListener('submit', async function (event) { event.preventDefault(); try { await api('/api/admin/tradingview/sources', { method: 'POST', body: JSON.stringify(formPayload(event.target)) }); event.target.reset(); await load(); } catch (err) { showError(err, '儲存 TradingView 來源失敗'); } });
['tvGenSource','tvGenStrategy','tvGenTicker','tvGenAction','tvGenInterval','tvGenPrice'].forEach(function (id) {
  document.getElementById(id).addEventListener('change', updateTradingViewGenerator);
  document.getElementById(id).addEventListener('input', updateTradingViewGenerator);
});
document.getElementById('tvGenerateBtn').addEventListener('click', updateTradingViewGenerator);
document.getElementById('tvPreviewBtn').addEventListener('click', async function () {
  try {
    var action = document.getElementById('tvGenAction').value;
    var payload = {
      source_id: document.getElementById('tvGenSource').value,
      strategy: document.getElementById('tvGenStrategy').value,
      ticker: document.getElementById('tvGenTicker').value,
      action: action === 'AUTO' ? 'LONG' : action,
      price: Number(document.getElementById('tvGenPrice').value || 0),
      interval: document.getElementById('tvGenInterval').value
    };
    var result = await api('/api/admin/tradingview/preview', { method: 'POST', body: JSON.stringify(payload) });
    var s = result.signal;
    document.getElementById('tvPreview').innerHTML =
      '<div>' + chip(result.strategy.name, s.target_group === 'vip' ? 'amber' : 'green') + ' ' + chip(s.signal_type, '') + '</div>' +
      '<b>' + esc(s.action + ' ' + s.ticker) + '</b>' +
      '<div>Entry ' + esc(s.entry_price) + ' / SL ' + esc(s.stop_loss) + ' / TP ' + esc([s.tp1, s.tp2, s.tp3].filter(Boolean).join(' / ')) + '</div>';
  } catch (err) {
    showError(err, '預覽 TradingView 訊號失敗');
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
    await sendMemberNotice(user.user_id, `⚠️ 您的會員已到期\n\n已降為免費會員\n使用 /plans 續費`);
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
    await sendMemberNotice(user.user_id, `⏰ <b>會員即將到期</b>\n\n您的 ${tierName(user.tier)} 將在 <b>${days}</b> 天後到期\n\n👉 /renew 立即續費`);
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

    const oauthMatch = url.pathname.match(/^\/auth\/(google|line)\/(start|callback)$/);
    if (oauthMatch && request.method === 'GET') {
      return oauthMatch[2] === 'start'
        ? handleOAuthStart(request, env, oauthMatch[1])
        : handleOAuthCallback(request, env, oauthMatch[1], url);
    }

    if (url.pathname === '/admin/logout') {
      return unauthorizedAdminResponse('已登出');
    }

    if (url.pathname === '/admin' || url.pathname === '/admin/') {
      const auth = requireAdminHttp(request, env);
      if (auth) return auth;
      return adminHtmlResponse(renderAdminPage(), 200, { 'Cache-Control': 'no-store' });
    }

    if (url.pathname.startsWith('/api/admin/')) {
      return handleAdminApi(request, env, url.pathname);
    }

    if (url.pathname === '/member' || url.pathname === '/member/' || url.pathname === '/login' || url.pathname === '/login/') {
      return html(renderMemberPage(), 200, { 'Cache-Control': 'no-store' });
    }

    if (url.pathname.startsWith('/api/member/')) {
      return handleMemberApi(request, env, url.pathname);
    }

    if (url.pathname === '/webhook/stripe' && request.method === 'POST') {
      return handleStripeWebhook(request, env);
    }

    const tvMatch = url.pathname.match(/^\/(?:tv|tradingview|webhook\/tradingview)\/([A-Za-z0-9-]+)$/);
    if (tvMatch && request.method === 'POST') {
      return handleTradingViewWebhook(request, env, tvMatch[1], url);
    }
    
    // 健康檢查
    if (url.pathname === '/' || url.pathname === '/health') {
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
  }
};
