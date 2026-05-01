// ═══════════════════════════════════════════════════════════════════════════════
// DC Trading Signals Pro v9.1
// 用戶自主訂閱系統 - 手機完成所有操作
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  VERSION: '9.1.1',
  BUILD: 'UserSubscribe',

  // ⚠️ 機敏資訊請以 wrangler secret/vars 注入，請勿寫死於原始碼。
  // 必填 vars/secrets (見 wrangler.toml 與 DEPLOY_GUIDE.md):
  //   BOT_TOKEN       Telegram Bot Token        (secret)
  //   ADMIN_IDS       逗號分隔的管理員 user_id   (var)
  //   BOT_USERNAME    Bot 用戶名 (不含 @)       (var)
  //   WEBHOOK_SECRET  (可選) webhook 驗證密鑰    (secret)
  BOT_TOKEN: '',
  ADMIN_IDS: [],
  BOT_USERNAME: '',
  WEBHOOK_SECRET: '',

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
  },

  // 內建 fallback tick value（品種表查不到時用）
  DEFAULT_TICK_VALUE: {
    NQ: 5, ES: 12.5, YM: 5, RTY: 5,
    GC: 10, SI: 25,
    CL: 10, NG: 10,
    '6E': 6.25, '6J': 6.25
  }
};

function initConfig(env) {
  CONFIG.BOT_TOKEN = env.BOT_TOKEN || CONFIG.BOT_TOKEN;
  CONFIG.BOT_USERNAME = env.BOT_USERNAME || CONFIG.BOT_USERNAME;
  CONFIG.WEBHOOK_SECRET = env.WEBHOOK_SECRET || CONFIG.WEBHOOK_SECRET;
  if (env.ADMIN_IDS) {
    CONFIG.ADMIN_IDS = String(env.ADMIN_IDS)
      .split(',').map(s => s.trim()).filter(Boolean);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 工具函數
// ═══════════════════════════════════════════════════════════════════════════════
const TG = () => `https://api.telegram.org/bot${CONFIG.BOT_TOKEN}`;
const json = (d, s = 200) => new Response(JSON.stringify(d), { 
  status: s, 
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
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
const daysLeft = (d) => d ? Math.max(0, Math.ceil((new Date(d) - new Date()) / 86400000)) : 0;
const parseJSON = (s, def = []) => { try { return JSON.parse(s) || def; } catch { return def; } };

// ═══════════════════════════════════════════════════════════════════════════════
// Telegram API
// ═══════════════════════════════════════════════════════════════════════════════
async function sendTg(chatId, text, kb = null) {
  const body = { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true };
  if (kb) body.reply_markup = kb;
  try {
    const res = await fetch(`${TG()}/sendMessage`, {
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
    await fetch(`${TG()}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) {}
}

async function answerCb(cbId, text = '', showAlert = false) {
  try {
    await fetch(`${TG()}/answerCallbackQuery`, {
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
      subscribed_symbols: '["NQ","ES","GC"]',
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

function formatSignalCard(signal, userSettings = null, isVip = false, symbolMeta = null) {
  const { ticker, action, entry_price, stop_loss, tp1, tp2, tp3, signal_type } = signal;
  const actionInfo = CONFIG.ACTIONS[action] || { emoji: '📊', name: action };
  const typeInfo = CONFIG.SIGNAL_TYPES[signal_type] || { emoji: '📊', name: '' };

  const risk = Math.abs(entry_price - stop_loss);
  const reward1 = tp1 ? Math.abs(tp1 - entry_price) : 0;
  const rr = risk > 0 ? (reward1 / risk).toFixed(1) : '0';

  // tick value 優先順序: symbols 表 -> 內建表 -> 5 (NQ 預設)
  const tickValue = symbolMeta?.tick_value
    ?? CONFIG.DEFAULT_TICK_VALUE[ticker]
    ?? 5;
  
  let msg = '';
  
  // VIP 標籤
  if (signal.is_vip_only) {
    msg += `╔═══════════════════════════╗\n`;
    msg += `║  👑 VIP 專屬訊號          ║\n`;
    msg += `╠═══════════════════════════╣\n`;
  } else {
    msg += `┏━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\n`;
  }
  
  msg += `┃  ${actionInfo.emoji} <b>${action}</b>  ${ticker}\n`;
  if (typeInfo.name) msg += `┃  ${typeInfo.emoji} ${typeInfo.name}\n`;
  msg += `┣━━━━━━━━━━━━━━━━━━━━━━━━━━━┫\n`;
  msg += `┃\n`;
  msg += `┃  💰 進場  │ <code>${fmtPrice(entry_price)}</code>\n`;
  msg += `┃  🛑 止損  │ <code>${fmtPrice(stop_loss)}</code>\n`;
  msg += `┃  ─────────────────────\n`;
  if (tp1) msg += `┃  🎯 TP1   │ <code>${fmtPrice(tp1)}</code>\n`;
  if (tp2) msg += `┃  🎯 TP2   │ <code>${fmtPrice(tp2)}</code>\n`;
  if (tp3 && isVip) msg += `┃  🎯 TP3   │ <code>${fmtPrice(tp3)}</code>  👑\n`;
  msg += `┃\n`;
  msg += `┣━━━━━━━━━━━━━━━━━━━━━━━━━━━┫\n`;
  msg += `┃  📊 風險 ${fmtPrice(risk)} 點\n`;
  msg += `┃  🎯 報酬 1:${rr}\n`;
  
  // 個人化交易建議
  if (userSettings && userSettings.capital > 0) {
    const riskAmount = userSettings.capital * (userSettings.risk_percent / 100);
    const contracts = risk > 0 ? (riskAmount / (risk * tickValue)).toFixed(2) : 0;
    
    msg += `┣━━━━━━━━━━━━━━━━━━━━━━━━━━━┫\n`;
    msg += `┃  📊 您的交易參考\n`;
    msg += `┃  ─────────────────────\n`;
    msg += `┃  風險金額  │ $${fmtNum(riskAmount.toFixed(0))} (${userSettings.risk_percent}%)\n`;
    msg += `┃  建議口數  │ ${contracts} 口\n`;
  }
  
  msg += `┣━━━━━━━━━━━━━━━━━━━━━━━━━━━┫\n`;
  msg += `┃  ⏰ ${fmtTime()}\n`;
  msg += `┃  🔖 #${signal.signal_uid}\n`;
  
  if (signal.is_vip_only) {
    msg += `╚═══════════════════════════╝`;
  } else {
    msg += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`;
  }
  
  return msg;
}

function formatExitCard(type, ticker, price, pnl, note = '') {
  const icons = {
    TP1: { emoji: '🎯', title: '止盈1達成！', color: '✅' },
    TP2: { emoji: '🎯', title: '止盈2達成！', color: '✅' },
    TP3: { emoji: '🎯', title: '止盈3達成！', color: '✅' },
    SL: { emoji: '🛑', title: '止損觸發', color: '❌' },
    CLOSE: { emoji: '⬜', title: '手動平倉', color: pnl >= 0 ? '✅' : '❌' },
    BE: { emoji: '🔄', title: '移至成本', color: '⚪' }
  };
  
  const info = icons[type] || { emoji: '📊', title: type, color: '⚪' };
  const pnlSign = pnl >= 0 ? '+' : '';
  
  let msg = `┏━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\n`;
  msg += `┃  ${info.emoji} <b>${info.title}</b>\n`;
  msg += `┣━━━━━━━━━━━━━━━━━━━━━━━━━━━┫\n`;
  msg += `┃\n`;
  msg += `┃  ${ticker}  │  ${type}\n`;
  msg += `┃  ─────────────────────\n`;
  msg += `┃  📍 成交  │ <code>${fmtPrice(price)}</code>\n`;
  if (pnl !== null) {
    msg += `┃  ${info.color} ${pnl >= 0 ? '獲利' : '虧損'}  │ ${pnlSign}${fmtPrice(pnl)} 點\n`;
  }
  if (note) msg += `┃  📝 ${note}\n`;
  msg += `┃\n`;
  msg += `┣━━━━━━━━━━━━━━━━━━━━━━━━━━━┫\n`;
  msg += `┃  ⏰ ${fmtTime()}\n`;
  msg += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`;
  
  return msg;
}

function formatUpdateCard(message) {
  let msg = `┏━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\n`;
  msg += `┃  📝 <b>訊號更新</b>\n`;
  msg += `┣━━━━━━━━━━━━━━━━━━━━━━━━━━━┫\n`;
  msg += `┃\n`;
  msg += `┃  ${message}\n`;
  msg += `┃\n`;
  msg += `┣━━━━━━━━━━━━━━━━━━━━━━━━━━━┫\n`;
  msg += `┃  ⏰ ${fmtTime()}\n`;
  msg += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`;
  return msg;
}

function formatAlertCard(message) {
  let msg = `┏━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\n`;
  msg += `┃  ⚠️ <b>交易警報</b>\n`;
  msg += `┣━━━━━━━━━━━━━━━━━━━━━━━━━━━┫\n`;
  msg += `┃\n`;
  msg += `┃  ${message}\n`;
  msg += `┃\n`;
  msg += `┣━━━━━━━━━━━━━━━━━━━━━━━━━━━┫\n`;
  msg += `┃  ⏰ ${fmtTime()}\n`;
  msg += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`;
  return msg;
}

function formatDailyReport(stats) {
  let msg = `╔═══════════════════════════╗\n`;
  msg += `║  📊 <b>每日績效報告</b>\n`;
  msg += `║  ${new Date().toLocaleDateString('zh-TW')}\n`;
  msg += `╠═══════════════════════════╣\n`;
  msg += `║\n`;
  msg += `║  📈 今日戰績\n`;
  msg += `║  ─────────────────────\n`;
  msg += `║  總交易  │ ${stats.total || 0} 筆\n`;
  msg += `║  獲利    │ ${stats.wins || 0} 筆  ✅\n`;
  msg += `║  虧損    │ ${stats.losses || 0} 筆  ❌\n`;
  const winRate = stats.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(1) : 0;
  msg += `║  勝率    │ ${winRate}%  ${winRate >= 60 ? '🔥' : ''}\n`;
  msg += `║\n`;
  msg += `╠═══════════════════════════╣\n`;
  msg += `║\n`;
  msg += `║  💰 盈虧統計\n`;
  msg += `║  ─────────────────────\n`;
  msg += `║  淨盈虧  │ ${stats.pnl >= 0 ? '+' : ''}${fmtPrice(stats.pnl || 0)} 點\n`;
  msg += `║\n`;
  msg += `╚═══════════════════════════╝`;
  return msg;
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

async function broadcastSignal(db, signal) {
  // 取得品種 metadata（tick_value 等）
  const symbolMeta = await db.prepare('SELECT * FROM symbols WHERE symbol = ?')
    .bind(signal.ticker).first();

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
    const msg = formatSignalCard(signal, user, isVip, symbolMeta);
    
    // 檢查安靜時段
    if (await isInQuietHours(user)) {
      // 加入待發佇列
      const quietEnd = user.quiet_end;
      await db.prepare(`
        INSERT INTO queued_signals (user_id, signal_uid, message, scheduled_at)
        VALUES (?, ?, ?, datetime('now', '+8 hours'))
      `).bind(user.user_id, signal.signal_uid, msg).run();
      queued++;
      continue;
    }
    
    // 發送訊號
    const kb = {
      inline_keyboard: [[
        { text: '✅ 已執行', callback_data: `exec_${signal.signal_uid}` },
        { text: '⏭️ 跳過', callback_data: `skip_${signal.signal_uid}` }
      ]]
    };
    
    const r = await sendTg(user.user_id, msg, kb);
    if (r?.ok) {
      sent++;
      // 累計接收數，作為試用判斷的旁證
      try {
        await db.prepare('UPDATE users SET total_signals = total_signals + 1 WHERE user_id = ?')
          .bind(user.user_id).run();
      } catch (e) {}
    } else skipped++;

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
    
    const dl = user.tier !== 'free' ? daysLeft(user.tier_expires_at) : 0;
    
    let m = `┌─────────────────────────────┐\n`;
    m += `│  📱 <b>DC Trading Signals</b>\n`;
    m += `│  ────────────────────────\n`;
    m += `│  ${user.first_name || '用戶'}  │  ${tierName(user.tier)}\n`;
    if (user.tier !== 'free') {
      m += `│  📅 剩餘 ${dl} 天\n`;
    }
    m += `└─────────────────────────────┘`;
    
    const kb = {
      inline_keyboard: [
        [
          { text: '📊 最新訊號', callback_data: 'u_signals' },
          { text: '📈 我的績效', callback_data: 'u_mystats' }
        ],
        [
          { text: '🎯 訂閱設定', callback_data: 'u_subscribe' },
          { text: '⚙️ 個人設定', callback_data: 'u_settings' }
        ],
        [
          { text: '💎 升級會員', callback_data: 'u_plans' },
          { text: '🎁 邀請好友', callback_data: 'u_invite' }
        ],
        [
          { text: '📞 聯繫客服', callback_data: 'u_contact' },
          { text: '❓ 幫助說明', callback_data: 'u_help' }
        ]
      ]
    };
    
    return sendTg(cid, m, kb);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 訂閱設定 /subscribe
  // ═══════════════════════════════════════════════════════════════════════════
  if (cmd === '/subscribe' || cmd === '/symbols') {
    if (user.tier === 'free') {
      return sendTg(cid, `❌ 此功能需要訂閱會員\n\n使用 /plans 查看方案`);
    }
    
    const symbols = await getSymbols(db);
    const subscribedSymbols = parseJSON(settings.subscribed_symbols, []);
    const categories = await getSymbolsByCategory(db);
    
    let m = `┌─────────────────────────────┐\n`;
    m += `│  🎯 <b>訂閱設定</b>\n`;
    m += `│  選擇您想接收的訊號品種\n`;
    m += `└─────────────────────────────┘\n\n`;
    
    // 建立按鈕
    const buttons = [];
    
    for (const [cat, catSymbols] of Object.entries(categories)) {
      const catInfo = CONFIG.SYMBOL_CATEGORIES[cat] || { emoji: '📊', name: cat };
      m += `${catInfo.emoji} <b>${catInfo.name}</b>\n`;
      
      const row = [];
      for (const s of catSymbols) {
        const isSubbed = subscribedSymbols.includes(s.symbol);
        const icon = isSubbed ? '✅' : '⬜';
        row.push({ text: `${icon} ${s.symbol}`, callback_data: `toggle_sym_${s.symbol}` });
        if (row.length === 2) {
          buttons.push([...row]);
          row.length = 0;
        }
      }
      if (row.length > 0) buttons.push([...row]);
      m += '\n';
    }
    
    m += `\n已選擇: ${subscribedSymbols.length} 個品種`;
    
    buttons.push([{ text: '💾 儲存設定', callback_data: 'save_symbols' }]);
    buttons.push([{ text: '« 返回', callback_data: 'u_menu' }]);
    
    return sendTg(cid, m, { inline_keyboard: buttons });
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 訊號類型偏好 /signaltype
  // ═══════════════════════════════════════════════════════════════════════════
  if (cmd === '/signaltype') {
    if (user.tier === 'free') {
      return sendTg(cid, `❌ 此功能需要訂閱會員`);
    }
    
    const signalTypes = parseJSON(settings.signal_types, []);
    
    let m = `┌─────────────────────────────┐\n`;
    m += `│  📊 <b>訊號類型偏好</b>\n`;
    m += `└─────────────────────────────┘\n\n`;
    m += `選擇您想接收的訊號類型：\n\n`;
    
    const buttons = [];
    for (const [type, info] of Object.entries(CONFIG.SIGNAL_TYPES)) {
      const isSelected = signalTypes.includes(type);
      const icon = isSelected ? '✅' : '⬜';
      buttons.push([{ text: `${icon} ${info.emoji} ${info.name}`, callback_data: `toggle_type_${type}` }]);
      m += `${info.emoji} <b>${info.name}</b>\n`;
      m += `   ${info.desc}\n\n`;
    }
    
    buttons.push([{ text: '💾 儲存設定', callback_data: 'save_types' }]);
    buttons.push([{ text: '« 返回', callback_data: 'u_subscribe' }]);
    
    return sendTg(cid, m, { inline_keyboard: buttons });
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 個人設定 /settings
  // ═══════════════════════════════════════════════════════════════════════════
  if (cmd === '/settings') {
    let m = `┌─────────────────────────────┐\n`;
    m += `│  ⚙️ <b>個人設定</b>\n`;
    m += `└─────────────────────────────┘\n`;
    
    const kb = {
      inline_keyboard: [
        [{ text: '🔔 通知設定', callback_data: 'u_notify' }],
        [{ text: '🌙 安靜時段', callback_data: 'u_quiet' }],
        [{ text: '💰 資金設定', callback_data: 'u_capital' }],
        [{ text: '🌍 時區設定', callback_data: 'u_timezone' }],
        [{ text: '« 返回', callback_data: 'u_menu' }]
      ]
    };
    
    return sendTg(cid, m, kb);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 通知設定 /notify
  // ═══════════════════════════════════════════════════════════════════════════
  if (cmd === '/notify') {
    let m = `┌─────────────────────────────┐\n`;
    m += `│  🔔 <b>通知設定</b>\n`;
    m += `└─────────────────────────────┘\n\n`;
    
    m += `<b>訊號通知</b>\n`;
    const buttons = [
      [
        { text: (settings.notify_entry ? '✅' : '⬜') + ' 進場訊號', callback_data: 'toggle_notify_entry' },
        { text: (settings.notify_tp ? '✅' : '⬜') + ' 止盈通知', callback_data: 'toggle_notify_tp' }
      ],
      [
        { text: (settings.notify_sl ? '✅' : '⬜') + ' 止損通知', callback_data: 'toggle_notify_sl' },
        { text: (settings.notify_update ? '✅' : '⬜') + ' 訊號更新', callback_data: 'toggle_notify_update' }
      ]
    ];
    
    m += `\n<b>系統通知</b>\n`;
    buttons.push([
      { text: (settings.notify_daily_report ? '✅' : '⬜') + ' 每日報告', callback_data: 'toggle_notify_daily' },
      { text: (settings.notify_announcement ? '✅' : '⬜') + ' 重要公告', callback_data: 'toggle_notify_announce' }
    ]);
    buttons.push([
      { text: (settings.notify_alert ? '✅' : '⬜') + ' 行情警報', callback_data: 'toggle_notify_alert' }
    ]);
    
    buttons.push([{ text: '« 返回', callback_data: 'u_settings' }]);
    
    return sendTg(cid, m, { inline_keyboard: buttons });
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 安靜時段 /quiet
  // ═══════════════════════════════════════════════════════════════════════════
  if (cmd === '/quiet') {
    let m = `┌─────────────────────────────┐\n`;
    m += `│  🌙 <b>安靜時段</b>\n`;
    m += `│  此時段內不會收到通知\n`;
    m += `└─────────────────────────────┘\n\n`;
    
    m += `狀態：${settings.quiet_enabled ? '✅ 已啟用' : '⬜ 未啟用'}\n\n`;
    m += `開始時間：${settings.quiet_start}\n`;
    m += `結束時間：${settings.quiet_end}\n\n`;
    m += `📝 安靜時段的訊號會在結束後推送\n`;
    
    const buttons = [
      [{ text: settings.quiet_enabled ? '🔕 關閉安靜時段' : '🔔 啟用安靜時段', callback_data: 'toggle_quiet' }],
      [
        { text: '⏰ 設定開始時間', callback_data: 'set_quiet_start' },
        { text: '⏰ 設定結束時間', callback_data: 'set_quiet_end' }
      ],
      [{ text: '« 返回', callback_data: 'u_settings' }]
    ];
    
    return sendTg(cid, m, { inline_keyboard: buttons });
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
    
    const riskAmount = settings.capital * (settings.risk_percent / 100);
    
    let m = `┌─────────────────────────────┐\n`;
    m += `│  💰 <b>資金設定</b>\n`;
    m += `└─────────────────────────────┘\n\n`;
    m += `交易資金：$${fmtNum(settings.capital)}\n`;
    m += `風險比例：${settings.risk_percent}%\n`;
    m += `單筆風險：$${fmtNum(riskAmount.toFixed(0))}\n\n`;
    m += `📝 設定後訊號會顯示建議口數\n`;
    
    const buttons = [
      [
        { text: '$1,000', callback_data: 'set_cap_1000' },
        { text: '$5,000', callback_data: 'set_cap_5000' },
        { text: '$10,000', callback_data: 'set_cap_10000' }
      ],
      [
        { text: '$25,000', callback_data: 'set_cap_25000' },
        { text: '$50,000', callback_data: 'set_cap_50000' },
        { text: '$100,000', callback_data: 'set_cap_100000' }
      ],
      [
        { text: '0.5%', callback_data: 'set_risk_0.5' },
        { text: '1%', callback_data: 'set_risk_1' },
        { text: '1.5%', callback_data: 'set_risk_1.5' },
        { text: '2%', callback_data: 'set_risk_2' }
      ],
      [{ text: '« 返回', callback_data: 'u_settings' }]
    ];
    
    m += `\n指令：\n/capital [金額] - 設定資金\n/risk [比例] - 設定風險%`;
    
    return sendTg(cid, m, { inline_keyboard: buttons });
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 會員狀態 /status
  // ═══════════════════════════════════════════════════════════════════════════
  if (cmd === '/status' || cmd === '/me') {
    const dl = user.tier !== 'free' ? daysLeft(user.tier_expires_at) : 0;
    const subscribedSymbols = parseJSON(settings.subscribed_symbols, []);
    
    let m = `┌─────────────────────────────┐\n`;
    m += `│  👤 <b>會員狀態</b>\n`;
    m += `└─────────────────────────────┘\n\n`;
    m += `${tierName(user.tier)}\n`;
    
    if (user.tier !== 'free') {
      m += `到期日：${fmtDate(user.tier_expires_at)}\n`;
      m += `剩餘：${dl} 天\n\n`;
    } else {
      m += `\n`;
    }
    
    m += `📊 訂閱品種：${subscribedSymbols.join(', ') || '未設定'}\n`;
    m += `💰 交易資金：$${fmtNum(settings.capital)}\n`;
    m += `📈 風險比例：${settings.risk_percent}%\n\n`;
    m += `🎁 積分：${user.points || 0}\n`;
    m += `👥 推薦：${user.referral_count || 0} 人\n`;
    m += `📋 推薦碼：<code>${user.referral_code}</code>\n`;
    
    const buttons = [
      [
        { text: '🔄 續費', callback_data: 'u_renew' },
        { text: '👑 升級VIP', callback_data: 'u_upgrade' }
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
    
    let m = `┌─────────────────────────────┐\n`;
    m += `│  💎 <b>會員方案</b>\n`;
    m += `└─────────────────────────────┘\n\n`;
    
    m += `⭐ <b>Pro 會員</b>\n`;
    m += `─────────────────────\n`;
    m += `• 即時接收所有訊號\n`;
    m += `• 2個止盈目標\n`;
    m += `• 自選訂閱品種\n`;
    m += `• 個人化資金計算\n`;
    m += `• 完整績效統計\n\n`;
    m += `NT$ ${proPrices[1]}/月\n`;
    m += `NT$ ${proPrices[3]}/季 (省10%)\n`;
    m += `NT$ ${proPrices[12]}/年 (省20%)\n\n`;
    
    m += `👑 <b>VIP 會員</b>\n`;
    m += `─────────────────────\n`;
    m += `• Pro全部功能\n`;
    m += `• 3個止盈目標\n`;
    m += `• VIP專屬訊號\n`;
    m += `• 提前行情提醒\n`;
    m += `• 優先客服\n\n`;
    m += `NT$ ${vipPrices[1]}/月\n`;
    m += `NT$ ${vipPrices[3]}/季 (省10%)\n`;
    m += `NT$ ${vipPrices[12]}/年 (省20%)\n`;
    
    const buttons = [
      [{ text: '🎁 申請7天試用', callback_data: 'u_trial' }],
      [
        { text: '⭐ 訂閱Pro', callback_data: 'order_pro' },
        { text: '👑 訂閱VIP', callback_data: 'order_vip' }
      ],
      [{ text: '📞 聯繫客服', callback_data: 'u_contact' }],
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

    // 透過 admin_logs 紀錄判斷是否用過試用（避免 total_signals 計數副作用）
    const used = await db.prepare(
      `SELECT id FROM admin_logs WHERE action = 'trial_granted' AND target = ? LIMIT 1`
    ).bind(uid).first();
    if (used) {
      return sendTg(cid, `您已使用過試用\n\n使用 /plans 查看正式方案`);
    }

    const trialDays = parseInt(await getConfig(db, 'trial_days') || '7');
    const expires = new Date(Date.now() + trialDays * 86400000).toISOString();

    await updateUser(db, uid, { tier: 'pro', tier_expires_at: expires });
    await logAction(db, 'SYSTEM', 'trial_granted', uid, `${trialDays} days`);
    
    let m = `🎉 <b>試用已開通！</b>\n\n`;
    m += `等級：⭐ Pro會員\n`;
    m += `天數：${trialDays} 天\n`;
    m += `到期：${fmtDate(expires)}\n\n`;
    m += `現在請先設定您的訂閱偏好：\n`;
    
    const kb = {
      inline_keyboard: [
        [{ text: '🎯 設定訂閱品種', callback_data: 'u_subscribe' }],
        [{ text: '💰 設定交易資金', callback_data: 'u_capital' }],
        [{ text: '📊 查看訊號', callback_data: 'u_signals' }]
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
    
    let m = `📊 <b>最新訊號</b>\n\n`;
    
    for (const sig of signals.results) {
      const emoji = CONFIG.ACTIONS[sig.action]?.emoji || '📊';
      const status = sig.status === 'active' ? '🟢' : sig.result === 'win' ? '✅' : sig.result === 'loss' ? '❌' : '⚪';
      m += `${status}${emoji} ${sig.ticker} ${sig.action} @ ${fmtPrice(sig.entry_price)}\n`;
    }
    
    m += `\n已訂閱：${subscribedSymbols.join(', ')}`;
    
    const kb = {
      inline_keyboard: [
        [{ text: '📜 歷史訊號', callback_data: 'u_history' }],
        [{ text: '🎯 修改訂閱', callback_data: 'u_subscribe' }],
        [{ text: '« 返回', callback_data: 'u_menu' }]
      ]
    };
    
    return sendTg(cid, m, kb);
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
    
    let m = `┌─────────────────────────────┐\n`;
    m += `│  📊 <b>我的績效</b>\n`;
    m += `│  近30天\n`;
    m += `└─────────────────────────────┘\n\n`;
    m += `📈 執行統計\n`;
    m += `─────────────────────\n`;
    m += `已執行    │ ${total} 筆\n`;
    m += `獲利      │ ${wins} 筆  ✅\n`;
    m += `虧損      │ ${total - wins} 筆  ❌\n`;
    m += `勝率      │ ${winRate}%\n\n`;
    m += `💰 模擬盈虧\n`;
    m += `─────────────────────\n`;
    m += `總點數    │ ${totalPnl >= 0 ? '+' : ''}${fmtPrice(totalPnl)} 點\n`;
    m += `預估盈虧  │ $${fmtNum(estimatedPnl.toFixed(0))}\n`;
    
    const kb = {
      inline_keyboard: [
        [{ text: '📊 按品種分析', callback_data: 'mystats_symbol' }],
        [{ text: '📅 選擇月份', callback_data: 'mystats_month' }],
        [{ text: '« 返回', callback_data: 'u_menu' }]
      ]
    };
    
    return sendTg(cid, m, kb);
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
    
    return sendTg(cid, `✅ <b>簽到成功！</b>\n\n獲得 <b>+${checkinPoints}</b> 積分\n目前積分：<b>${newPoints}</b>`);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 邀請好友 /invite
  // ═══════════════════════════════════════════════════════════════════════════
  if (cmd === '/invite') {
    const refLink = `https://t.me/${CONFIG.BOT_USERNAME}?start=ref_${user.referral_code}`;
    const refPoints = await getConfig(db, 'referral_points') || '50';
    const refPaidPoints = await getConfig(db, 'referral_paid_points') || '100';
    
    let m = `┌─────────────────────────────┐\n`;
    m += `│  🎁 <b>邀請好友</b>\n`;
    m += `└─────────────────────────────┘\n\n`;
    m += `您的專屬邀請連結：\n`;
    m += `<code>${refLink}</code>\n\n`;
    m += `📊 邀請統計\n`;
    m += `─────────────────────\n`;
    m += `已邀請    │ ${user.referral_count || 0} 人\n\n`;
    m += `🎁 邀請獎勵\n`;
    m += `─────────────────────\n`;
    m += `好友註冊  │ +${refPoints}點\n`;
    m += `好友付費  │ +${refPaidPoints}點\n`;
    
    const kb = {
      inline_keyboard: [
        [{ text: '📋 複製連結', callback_data: 'copy_ref' }],
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
    
    let m = `┌─────────────────────────────┐\n`;
    m += `│  🎁 <b>積分中心</b>\n`;
    m += `└─────────────────────────────┘\n\n`;
    m += `目前積分：<b>${user.points || 0}</b>\n`;
    m += `可兌換：${redeemableDays} 天會員\n\n`;
    
    if (history.results && history.results.length > 0) {
      m += `📜 最近記錄\n`;
      m += `─────────────────────\n`;
      for (const h of history.results.slice(0, 5)) {
        const sign = h.points > 0 ? '+' : '';
        m += `${sign}${h.points} - ${h.reason}\n`;
      }
    }
    
    const kb = {
      inline_keyboard: [
        [{ text: '✅ 立即簽到', callback_data: 'u_checkin' }],
        [{ text: '🎁 兌換會員', callback_data: 'u_redeem' }],
        [{ text: '« 返回', callback_data: 'u_menu' }]
      ]
    };
    
    return sendTg(cid, m, kb);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 聯繫客服 /contact
  // ═══════════════════════════════════════════════════════════════════════════
  if (cmd === '/contact') {
    const tg = await getConfig(db, 'contact_telegram') || '@Admin';
    const line = await getConfig(db, 'contact_line');
    
    let m = `┌─────────────────────────────┐\n`;
    m += `│  📞 <b>聯繫客服</b>\n`;
    m += `└─────────────────────────────┘\n\n`;
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

  // ═══════════════════════════════════════════════════════════════════════════
  // 歷史訊號 /history
  // ═══════════════════════════════════════════════════════════════════════════
  if (cmd === '/history') {
    if (user.tier === 'free') {
      return sendTg(cid, `❌ 此功能需要訂閱會員`);
    }

    const subscribedSymbols = parseJSON(settings.subscribed_symbols, []);
    let symbolFilter = '';
    if (subscribedSymbols.length > 0) {
      const safeList = subscribedSymbols
        .filter(s => /^[A-Z0-9]{1,10}$/.test(s))
        .map(s => `'${s}'`).join(',');
      if (safeList) symbolFilter = `AND ticker IN (${safeList})`;
    }

    const rows = await db.prepare(`
      SELECT * FROM signals
      WHERE status = 'closed' ${symbolFilter}
      ORDER BY closed_at DESC LIMIT 15
    `).all();

    if (!rows.results || rows.results.length === 0) {
      return sendTg(cid, `📜 尚無歷史訊號`);
    }

    let m = `📜 <b>歷史訊號 (近15筆)</b>\n\n`;
    for (const s of rows.results) {
      const arrow = s.action === 'LONG' ? '🟢' : '🔴';
      const tag = s.result === 'win' ? '✅' : s.result === 'loss' ? '❌' : '⚪';
      const pnl = s.pnl_points != null
        ? ` ${s.pnl_points >= 0 ? '+' : ''}${fmtPrice(s.pnl_points)}` : '';
      m += `${tag}${arrow} ${s.ticker} ${fmtPrice(s.entry_price)} →${pnl}\n`;
    }
    return sendTg(cid, m, { inline_keyboard: [[{ text: '« 返回', callback_data: 'u_menu' }]] });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 兌換會員 /redeem
  // ═══════════════════════════════════════════════════════════════════════════
  if (cmd === '/redeem') {
    const pointsPerDay = parseInt(await getConfig(db, 'points_per_day') || '100');
    const days = Math.floor((user.points || 0) / pointsPerDay);

    if (args[0]) {
      const want = parseInt(args[0]);
      if (!want || want <= 0) return sendTg(cid, `用法：/redeem [天數]`);
      if (want > days) return sendTg(cid, `❌ 積分不足\n目前可兌換 ${days} 天`);

      const cost = want * pointsPerDay;
      const baseExpiry = user.tier_expires_at && new Date(user.tier_expires_at) > new Date()
        ? new Date(user.tier_expires_at).getTime()
        : Date.now();
      const newExpiry = new Date(baseExpiry + want * 86400000).toISOString();
      const tier = user.tier === 'free' ? 'pro' : user.tier;

      await updateUser(db, uid, { tier, tier_expires_at: newExpiry, points: (user.points || 0) - cost });
      await db.prepare(`INSERT INTO point_history (user_id, points, reason, created_at)
        VALUES (?, ?, ?, datetime('now'))`).bind(uid, -cost, `兌換 ${want} 天會員`).run();

      return sendTg(cid, `✅ 兌換成功\n+${want} 天 ${tierName(tier)}\n到期：${fmtDate(newExpiry)}`);
    }

    let m = `🎁 <b>積分兌換會員</b>\n\n`;
    m += `目前積分：<b>${user.points || 0}</b>\n`;
    m += `匯率：${pointsPerDay} 點 = 1 天\n`;
    m += `可兌換：<b>${days}</b> 天\n\n`;
    m += `用法：/redeem [天數]\n例如：/redeem 7`;
    return sendTg(cid, m);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 時區設定 /timezone
  // ═══════════════════════════════════════════════════════════════════════════
  if (cmd === '/timezone') {
    if (args[0]) {
      const tz = args[0];
      try {
        new Date().toLocaleString('en-US', { timeZone: tz });
      } catch {
        return sendTg(cid, `❌ 無效的時區\n範例：Asia/Taipei、America/New_York`);
      }
      await updateUserSettings(db, uid, { timezone: tz });
      return sendTg(cid, `✅ 時區已設為 ${tz}`);
    }

    let m = `🌍 <b>時區設定</b>\n\n目前：${settings.timezone || 'Asia/Taipei'}\n\n常用時區：`;
    const kb = {
      inline_keyboard: [
        [{ text: '🇹🇼 台北 (UTC+8)', callback_data: 'tz_Asia/Taipei' }],
        [{ text: '🇯🇵 東京 (UTC+9)', callback_data: 'tz_Asia/Tokyo' }],
        [{ text: '🇺🇸 紐約 (UTC-5/4)', callback_data: 'tz_America/New_York' }],
        [{ text: '🇬🇧 倫敦 (UTC+0/1)', callback_data: 'tz_Europe/London' }],
        [{ text: '« 返回', callback_data: 'u_settings' }]
      ]
    };
    return sendTg(cid, m, kb);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 續費 /renew (alias to /plans)
  // ═══════════════════════════════════════════════════════════════════════════
  if (cmd === '/renew') {
    return handleUserCommand(cid, uid, '/plans', [], env);
  }

  return null;
}
// ═══════════════════════════════════════════════════════════════════════════════
// 用戶 Callback 處理
// ═══════════════════════════════════════════════════════════════════════════════

async function handleUserCallback(cid, uid, msgId, data, env) {
  const db = env.DB;
  const user = await getUser(db, uid);
  const settings = await getUserSettings(db, uid);
  
  // 返回主選單
  if (data === 'u_menu') {
    const dl = user.tier !== 'free' ? daysLeft(user.tier_expires_at) : 0;
    let m = `┌─────────────────────────────┐\n`;
    m += `│  📱 <b>DC Trading Signals</b>\n`;
    m += `│  ────────────────────────\n`;
    m += `│  ${user.first_name || '用戶'}  │  ${tierName(user.tier)}\n`;
    if (user.tier !== 'free') m += `│  📅 剩餘 ${dl} 天\n`;
    m += `└─────────────────────────────┘`;
    
    const kb = {
      inline_keyboard: [
        [
          { text: '📊 最新訊號', callback_data: 'u_signals' },
          { text: '📈 我的績效', callback_data: 'u_mystats' }
        ],
        [
          { text: '🎯 訂閱設定', callback_data: 'u_subscribe' },
          { text: '⚙️ 個人設定', callback_data: 'u_settings' }
        ],
        [
          { text: '💎 升級會員', callback_data: 'u_plans' },
          { text: '🎁 邀請好友', callback_data: 'u_invite' }
        ],
        [
          { text: '📞 聯繫客服', callback_data: 'u_contact' },
          { text: '❓ 幫助說明', callback_data: 'u_help' }
        ]
      ]
    };
    return editTg(cid, msgId, m, kb);
  }
  
  // 訂閱設定
  if (data === 'u_subscribe') {
    if (user.tier === 'free') {
      return answerCb(null, '此功能需要訂閱會員', true);
    }
    
    const symbols = await getSymbols(db);
    const subscribedSymbols = parseJSON(settings.subscribed_symbols, []);
    const categories = await getSymbolsByCategory(db);
    
    let m = `┌─────────────────────────────┐\n`;
    m += `│  🎯 <b>訂閱設定</b>\n`;
    m += `│  選擇您想接收的訊號品種\n`;
    m += `└─────────────────────────────┘\n\n`;
    
    const buttons = [];
    for (const [cat, catSymbols] of Object.entries(categories)) {
      const catInfo = CONFIG.SYMBOL_CATEGORIES[cat] || { emoji: '📊', name: cat };
      m += `${catInfo.emoji} <b>${catInfo.name}</b>\n`;
      
      const row = [];
      for (const s of catSymbols) {
        const isSubbed = subscribedSymbols.includes(s.symbol);
        const icon = isSubbed ? '✅' : '⬜';
        row.push({ text: `${icon} ${s.symbol}`, callback_data: `sym_${s.symbol}` });
        if (row.length === 2) {
          buttons.push([...row]);
          row.length = 0;
        }
      }
      if (row.length > 0) buttons.push([...row]);
      m += '\n';
    }
    
    m += `已選擇: ${subscribedSymbols.length} 個品種`;
    
    buttons.push([{ text: '📊 訊號類型', callback_data: 'u_signaltype' }]);
    buttons.push([{ text: '« 返回', callback_data: 'u_menu' }]);
    
    return editTg(cid, msgId, m, { inline_keyboard: buttons });
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
    
    // 重新顯示訂閱設定
    const symbols = await getSymbols(db);
    const categories = await getSymbolsByCategory(db);
    
    let m = `┌─────────────────────────────┐\n`;
    m += `│  🎯 <b>訂閱設定</b>\n`;
    m += `│  選擇您想接收的訊號品種\n`;
    m += `└─────────────────────────────┘\n\n`;
    
    const buttons = [];
    for (const [cat, catSymbols] of Object.entries(categories)) {
      const catInfo = CONFIG.SYMBOL_CATEGORIES[cat] || { emoji: '📊', name: cat };
      m += `${catInfo.emoji} <b>${catInfo.name}</b>\n`;
      
      const row = [];
      for (const s of catSymbols) {
        const isSubbed = subscribedSymbols.includes(s.symbol);
        const icon = isSubbed ? '✅' : '⬜';
        row.push({ text: `${icon} ${s.symbol}`, callback_data: `sym_${s.symbol}` });
        if (row.length === 2) {
          buttons.push([...row]);
          row.length = 0;
        }
      }
      if (row.length > 0) buttons.push([...row]);
      m += '\n';
    }
    
    m += `已選擇: ${subscribedSymbols.length} 個品種`;
    
    buttons.push([{ text: '📊 訊號類型', callback_data: 'u_signaltype' }]);
    buttons.push([{ text: '« 返回', callback_data: 'u_menu' }]);
    
    return editTg(cid, msgId, m, { inline_keyboard: buttons });
  }
  
  // 訊號類型設定
  if (data === 'u_signaltype') {
    const signalTypes = parseJSON(settings.signal_types, []);
    
    let m = `┌─────────────────────────────┐\n`;
    m += `│  📊 <b>訊號類型偏好</b>\n`;
    m += `└─────────────────────────────┘\n\n`;
    m += `選擇您想接收的訊號類型：\n\n`;
    
    const buttons = [];
    for (const [type, info] of Object.entries(CONFIG.SIGNAL_TYPES)) {
      const isSelected = signalTypes.includes(type);
      const icon = isSelected ? '✅' : '⬜';
      buttons.push([{ text: `${icon} ${info.emoji} ${info.name}`, callback_data: `type_${type}` }]);
      m += `${info.emoji} <b>${info.name}</b>\n`;
      m += `   ${info.desc}\n\n`;
    }
    
    buttons.push([{ text: '« 返回', callback_data: 'u_subscribe' }]);
    
    return editTg(cid, msgId, m, { inline_keyboard: buttons });
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
    
    // 重新顯示
    let m = `┌─────────────────────────────┐\n`;
    m += `│  📊 <b>訊號類型偏好</b>\n`;
    m += `└─────────────────────────────┘\n\n`;
    m += `選擇您想接收的訊號類型：\n\n`;
    
    const buttons = [];
    for (const [t, info] of Object.entries(CONFIG.SIGNAL_TYPES)) {
      const isSelected = signalTypes.includes(t);
      const icon = isSelected ? '✅' : '⬜';
      buttons.push([{ text: `${icon} ${info.emoji} ${info.name}`, callback_data: `type_${t}` }]);
      m += `${info.emoji} <b>${info.name}</b>\n`;
      m += `   ${info.desc}\n\n`;
    }
    
    buttons.push([{ text: '« 返回', callback_data: 'u_subscribe' }]);
    
    return editTg(cid, msgId, m, { inline_keyboard: buttons });
  }
  
  // 個人設定
  if (data === 'u_settings') {
    let m = `┌─────────────────────────────┐\n`;
    m += `│  ⚙️ <b>個人設定</b>\n`;
    m += `└─────────────────────────────┘\n`;
    
    const kb = {
      inline_keyboard: [
        [{ text: '🔔 通知設定', callback_data: 'u_notify' }],
        [{ text: '🌙 安靜時段', callback_data: 'u_quiet' }],
        [{ text: '💰 資金設定', callback_data: 'u_capital' }],
        [{ text: settings.paused ? '▶️ 恢復接收訊號' : '⏸️ 暫停接收訊號', callback_data: 'toggle_pause' }],
        [{ text: '« 返回', callback_data: 'u_menu' }]
      ]
    };
    
    return editTg(cid, msgId, m, kb);
  }
  
  // 暫停/恢復
  if (data === 'toggle_pause') {
    const newPaused = settings.paused ? 0 : 1;
    await updateUserSettings(db, uid, { paused: newPaused });
    
    await answerCb(null, newPaused ? '已暫停接收訊號' : '已恢復接收訊號');
    
    // 返回設定頁
    let m = `┌─────────────────────────────┐\n`;
    m += `│  ⚙️ <b>個人設定</b>\n`;
    m += `└─────────────────────────────┘\n`;
    
    const kb = {
      inline_keyboard: [
        [{ text: '🔔 通知設定', callback_data: 'u_notify' }],
        [{ text: '🌙 安靜時段', callback_data: 'u_quiet' }],
        [{ text: '💰 資金設定', callback_data: 'u_capital' }],
        [{ text: newPaused ? '▶️ 恢復接收訊號' : '⏸️ 暫停接收訊號', callback_data: 'toggle_pause' }],
        [{ text: '« 返回', callback_data: 'u_menu' }]
      ]
    };
    
    return editTg(cid, msgId, m, kb);
  }
  
  // 通知設定
  if (data === 'u_notify') {
    let m = `┌─────────────────────────────┐\n`;
    m += `│  🔔 <b>通知設定</b>\n`;
    m += `└─────────────────────────────┘\n\n`;
    m += `點擊切換開關：\n`;
    
    const buttons = [
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
    ];
    
    return editTg(cid, msgId, m, { inline_keyboard: buttons });
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
      
      let m = `┌─────────────────────────────┐\n`;
      m += `│  🔔 <b>通知設定</b>\n`;
      m += `└─────────────────────────────┘\n\n`;
      m += `點擊切換開關：\n`;
      
      const buttons = [
        [
          { text: (newSettings.notify_entry ? '✅' : '⬜') + ' 進場訊號', callback_data: 'ntf_entry' },
          { text: (newSettings.notify_tp ? '✅' : '⬜') + ' 止盈通知', callback_data: 'ntf_tp' }
        ],
        [
          { text: (newSettings.notify_sl ? '✅' : '⬜') + ' 止損通知', callback_data: 'ntf_sl' },
          { text: (newSettings.notify_update ? '✅' : '⬜') + ' 訊號更新', callback_data: 'ntf_update' }
        ],
        [
          { text: (newSettings.notify_daily_report ? '✅' : '⬜') + ' 每日報告', callback_data: 'ntf_daily' },
          { text: (newSettings.notify_announcement ? '✅' : '⬜') + ' 公告', callback_data: 'ntf_announce' }
        ],
        [{ text: (newSettings.notify_alert ? '✅' : '⬜') + ' 行情警報', callback_data: 'ntf_alert' }],
        [{ text: '« 返回', callback_data: 'u_settings' }]
      ];
      
      return editTg(cid, msgId, m, { inline_keyboard: buttons });
    }
  }
  
  // 安靜時段
  if (data === 'u_quiet') {
    let m = `┌─────────────────────────────┐\n`;
    m += `│  🌙 <b>安靜時段</b>\n`;
    m += `│  此時段內不會收到通知\n`;
    m += `└─────────────────────────────┘\n\n`;
    m += `狀態：${settings.quiet_enabled ? '✅ 已啟用' : '⬜ 未啟用'}\n\n`;
    m += `開始時間：${settings.quiet_start}\n`;
    m += `結束時間：${settings.quiet_end}\n\n`;
    m += `📝 安靜時段的訊號會在結束後推送`;
    
    const buttons = [
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
    ];
    
    return editTg(cid, msgId, m, { inline_keyboard: buttons });
  }
  
  // 切換安靜時段
  if (data === 'toggle_quiet') {
    const newValue = settings.quiet_enabled ? 0 : 1;
    await updateUserSettings(db, uid, { quiet_enabled: newValue });
    await answerCb(null, newValue ? '安靜時段已啟用' : '安靜時段已關閉');
    
    // 重新顯示
    const newSettings = await getUserSettings(db, uid);
    let m = `┌─────────────────────────────┐\n`;
    m += `│  🌙 <b>安靜時段</b>\n`;
    m += `│  此時段內不會收到通知\n`;
    m += `└─────────────────────────────┘\n\n`;
    m += `狀態：${newSettings.quiet_enabled ? '✅ 已啟用' : '⬜ 未啟用'}\n\n`;
    m += `開始時間：${newSettings.quiet_start}\n`;
    m += `結束時間：${newSettings.quiet_end}\n`;
    
    const buttons = [
      [{ text: newSettings.quiet_enabled ? '🔕 關閉' : '🔔 啟用', callback_data: 'toggle_quiet' }],
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
    ];
    
    return editTg(cid, msgId, m, { inline_keyboard: buttons });
  }
  
  // 設定安靜時段時間
  if (data.startsWith('quiet_s_')) {
    const hour = data.replace('quiet_s_', '');
    await updateUserSettings(db, uid, { quiet_start: `${hour}:00` });
    await answerCb(null, `開始時間設為 ${hour}:00`);
    return;
  }
  
  if (data.startsWith('quiet_e_')) {
    const hour = data.replace('quiet_e_', '');
    await updateUserSettings(db, uid, { quiet_end: `${hour}:00` });
    await answerCb(null, `結束時間設為 ${hour}:00`);
    return;
  }
  
  // 資金設定
  if (data === 'u_capital') {
    const riskAmount = settings.capital * (settings.risk_percent / 100);
    
    let m = `┌─────────────────────────────┐\n`;
    m += `│  💰 <b>資金設定</b>\n`;
    m += `└─────────────────────────────┘\n\n`;
    m += `交易資金：<b>$${fmtNum(settings.capital)}</b>\n`;
    m += `風險比例：<b>${settings.risk_percent}%</b>\n`;
    m += `單筆風險：<b>$${fmtNum(riskAmount.toFixed(0))}</b>\n\n`;
    m += `📝 設定後訊號會顯示建議口數\n`;
    
    const buttons = [
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
    ];
    
    return editTg(cid, msgId, m, { inline_keyboard: buttons });
  }
  
  // 設定資金
  if (data.startsWith('cap_')) {
    const value = parseInt(data.replace('cap_', ''));
    await updateUserSettings(db, uid, { capital: value });
    await answerCb(null, `交易資金設為 $${fmtNum(value)}`);
    
    const newSettings = await getUserSettings(db, uid);
    const riskAmount = newSettings.capital * (newSettings.risk_percent / 100);
    
    let m = `┌─────────────────────────────┐\n`;
    m += `│  💰 <b>資金設定</b>\n`;
    m += `└─────────────────────────────┘\n\n`;
    m += `交易資金：<b>$${fmtNum(newSettings.capital)}</b>\n`;
    m += `風險比例：<b>${newSettings.risk_percent}%</b>\n`;
    m += `單筆風險：<b>$${fmtNum(riskAmount.toFixed(0))}</b>\n`;
    
    const buttons = [
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
    ];
    
    return editTg(cid, msgId, m, { inline_keyboard: buttons });
  }
  
  // 設定風險
  if (data.startsWith('risk_')) {
    const value = parseFloat(data.replace('risk_', ''));
    await updateUserSettings(db, uid, { risk_percent: value });
    await answerCb(null, `風險比例設為 ${value}%`);
    return;
  }
  
  // 訊號執行記錄
  if (data.startsWith('exec_')) {
    const signalUid = data.replace('exec_', '');
    
    await db.prepare(`
      INSERT OR REPLACE INTO user_executions (user_id, signal_uid, status, created_at)
      VALUES (?, ?, 'executed', datetime('now'))
    `).bind(uid, signalUid).run();
    
    await answerCb(null, '✅ 已記錄為已執行');
    return;
  }
  
  if (data.startsWith('skip_')) {
    const signalUid = data.replace('skip_', '');
    
    await db.prepare(`
      INSERT OR REPLACE INTO user_executions (user_id, signal_uid, status, created_at)
      VALUES (?, ?, 'skipped', datetime('now'))
    `).bind(uid, signalUid).run();
    
    await answerCb(null, '⏭️ 已記錄為跳過');
    return;
  }
  
  // 其他頁面跳轉
  if (data === 'u_signals') return handleUserCommand(cid, uid, '/signals', [], env);
  if (data === 'u_mystats') return handleUserCommand(cid, uid, '/mystats', [], env);
  if (data === 'u_plans') return handleUserCommand(cid, uid, '/plans', [], env);
  if (data === 'u_invite') return handleUserCommand(cid, uid, '/invite', [], env);
  if (data === 'u_contact') return handleUserCommand(cid, uid, '/contact', [], env);
  if (data === 'u_help') return handleUserCommand(cid, uid, '/help', [], env);
  if (data === 'u_checkin') return handleUserCommand(cid, uid, '/checkin', [], env);
  if (data === 'u_trial') return handleUserCommand(cid, uid, '/trial', [], env);
  if (data === 'u_points') return handleUserCommand(cid, uid, '/points', [], env);
  if (data === 'u_history') return handleUserCommand(cid, uid, '/history', [], env);
  if (data === 'u_status' || data === 'u_renew' || data === 'u_upgrade')
    return handleUserCommand(cid, uid, '/status', [], env);
  if (data === 'u_redeem') return handleUserCommand(cid, uid, '/redeem', [], env);
  if (data === 'u_timezone') return handleUserCommand(cid, uid, '/timezone', [], env);

  // 安靜時段時間設定提示
  if (data === 'set_quiet_start' || data === 'set_quiet_end') {
    await answerCb(null, '請選擇下方按鈕的預設時段');
    return;
  }

  // 績效篩選佔位 (避免按鈕無回應)
  if (data === 'mystats_symbol' || data === 'mystats_month') {
    await answerCb(null, '此功能即將推出');
    return;
  }

  // 複製邀請連結
  if (data === 'copy_ref') {
    await answerCb(null, '請長按上方連結複製', true);
    return;
  }

  // 時區快選
  if (data.startsWith('tz_')) {
    const tz = data.slice(3);
    try { new Date().toLocaleString('en-US', { timeZone: tz }); }
    catch { await answerCb(null, '無效時區', true); return; }
    await updateUserSettings(db, uid, { timezone: tz });
    await answerCb(null, `已設為 ${tz}`);
    return;
  }
  
  // 訂閱方案
  if (data === 'order_pro' || data === 'order_vip') {
    const tier = data === 'order_pro' ? 'pro' : 'vip';
    
    let m = `┌─────────────────────────────┐\n`;
    m += `│  💳 <b>訂閱 ${tierName(tier)}</b>\n`;
    m += `└─────────────────────────────┘\n\n`;
    m += `選擇訂閱時長：\n`;
    
    const prices = {
      1: await getConfig(db, `${tier}_price_1m`),
      3: await getConfig(db, `${tier}_price_3m`),
      12: await getConfig(db, `${tier}_price_12m`)
    };
    
    const buttons = [
      [{ text: `📅 1個月 NT$${prices[1]}`, callback_data: `buy_${tier}_1` }],
      [{ text: `📅 3個月 NT$${prices[3]} (省10%)`, callback_data: `buy_${tier}_3` }],
      [{ text: `📅 12個月 NT$${prices[12]} (省20%)`, callback_data: `buy_${tier}_12` }],
      [{ text: '« 返回', callback_data: 'u_plans' }]
    ];
    
    return editTg(cid, msgId, m, { inline_keyboard: buttons });
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
    
    const bank = await getConfig(db, 'payment_bank');
    const account = await getConfig(db, 'payment_account');
    const name = await getConfig(db, 'payment_name');
    const contact = await getConfig(db, 'contact_telegram');
    
    let m = `┌─────────────────────────────┐\n`;
    m += `│  📋 <b>訂單確認</b>\n`;
    m += `└─────────────────────────────┘\n\n`;
    m += `訂單編號：<code>${orderId}</code>\n`;
    m += `方案：${tierName(tier)} ${months}個月\n`;
    m += `金額：<b>NT$ ${fmtNum(price)}</b>\n\n`;
    m += `💳 付款方式\n`;
    m += `─────────────────────\n`;
    m += `🏦 銀行：${bank}\n`;
    m += `📝 帳號：<code>${account}</code>\n`;
    m += `👤 戶名：${name}\n\n`;
    m += `⚠️ 付款後請點擊下方按鈕通知客服\n`;
    
    const buttons = [
      [{ text: '✅ 我已付款', callback_data: `paid_${orderId}` }],
      [{ text: '❌ 取消訂單', callback_data: `cancel_${orderId}` }],
      [{ text: '📞 聯繫客服', callback_data: 'u_contact' }]
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
    
    await db.prepare(`UPDATE orders SET status = 'paid', payment_note = '用戶已通知付款' WHERE order_id = ?`).bind(orderId).run();
    
    // 通知管理員
    for (const adminId of CONFIG.ADMIN_IDS) {
      await sendTg(adminId, `💰 用戶已付款通知！\n\n訂單：<code>${orderId}</code>\n用戶：<code>${uid}</code>\n\n請確認後使用 /confirm ${orderId}`);
    }
    
    await answerCb(null, '已通知客服，請稍候', true);
    
    let m = `✅ <b>付款通知已送出</b>\n\n`;
    m += `訂單編號：<code>${orderId}</code>\n\n`;
    m += `客服確認付款後會自動開通會員\n`;
    m += `請稍候，通常10分鐘內處理完成`;
    
    return editTg(cid, msgId, m, { inline_keyboard: [[{ text: '« 返回', callback_data: 'u_menu' }]] });
  }
  
  // 取消訂單
  if (data.startsWith('cancel_')) {
    const orderId = data.replace('cancel_', '');
    await db.prepare(`UPDATE orders SET status = 'cancelled' WHERE order_id = ?`).bind(orderId).run();
    await answerCb(null, '訂單已取消');
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
    const result = await broadcastSignal(db, signal);
    
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
    
    const result = await broadcastSignal(db, signal);
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
    
    const formattedMsg = `📢 <b>公告</b>\n━━━━━━━━━━━━━━━━━━\n${message}\n━━━━━━━━━━━━━━━━━━\n⏰ ${fmtTime()}`;
    
    const result = await broadcastMessage(db, formattedMsg, targetGroup, 'announcement');
    
    await db.prepare(`INSERT INTO broadcasts (message, target_group, sent_count, created_by, created_at) VALUES (?, ?, ?, ?, datetime('now'))`).bind(message, targetGroup, result.sent, uid).run();
    await logAction(db, uid, 'broadcast', targetGroup, message.substring(0, 50));
    
    return sendTg(cid, `✅ 廣播已發送\n目標：@${targetGroup}\n成功：${result.sent} 人`);
  }
  
  // /announce 重要公告
  if (cmd === '/announce') {
    if (!fullText) return sendTg(cid, `用法：/announce [公告內容]`);
    
    const msg = `╔═══════════════════════════╗\n║  🔔 <b>重要公告</b>\n╠═══════════════════════════╣\n║\n║  ${fullText}\n║\n╠═══════════════════════════╣\n║  ⏰ ${fmtTime()}\n╚═══════════════════════════╝`;
    
    const result = await broadcastMessage(db, msg, 'all', 'announcement');
    await logAction(db, uid, 'announce', '', fullText.substring(0, 50));
    
    return sendTg(cid, `✅ 重要公告已發送 | ${result.sent} 人`);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 管理儀表板
  // ═══════════════════════════════════════════════════════════════════════════
  
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
    
    let m = `╔═══════════════════════════════════╗\n`;
    m += `║  📊 <b>DC Signals 管理儀表板</b>\n`;
    m += `║  v${CONFIG.VERSION} ${CONFIG.BUILD}\n`;
    m += `╠═══════════════════════════════════╣\n`;
    m += `║\n`;
    m += `║  👥 用戶\n`;
    m += `║  ─────────────────────────\n`;
    m += `║  總計 │ ${totalUsers?.c || 0}\n`;
    m += `║  ⭐ Pro │ ${proUsers?.c || 0}\n`;
    m += `║  👑 VIP │ ${vipUsers?.c || 0}\n`;
    m += `║\n`;
    m += `╠═══════════════════════════════════╣\n`;
    m += `║\n`;
    m += `║  📊 今日訊號\n`;
    m += `║  ─────────────────────────\n`;
    m += `║  發送 │ ${todaySignals?.c || 0} 筆\n`;
    const winRate = todayPerf?.total > 0 ? ((todayPerf.wins / todayPerf.total) * 100).toFixed(0) : 0;
    m += `║  勝率 │ ${winRate}%\n`;
    m += `║  盈虧 │ ${(todayPerf?.pnl || 0) >= 0 ? '+' : ''}${fmtPrice(todayPerf?.pnl || 0)} 點\n`;
    m += `║\n`;
    
    if (pendingOrders?.c > 0) {
      m += `╠═══════════════════════════════════╣\n`;
      m += `║  ⚠️ 待處理訂單：${pendingOrders.c}\n`;
    }
    
    m += `╠═══════════════════════════════════╣\n`;
    m += `║  ${paused === '1' ? '⏸️ 已暫停' : '🟢 運行中'}\n`;
    m += `║  ⏰ ${fmtTime()}\n`;
    m += `╚═══════════════════════════════════╝`;
    
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
    
    let m = `👤 <b>用戶詳情</b>\n━━━━━━━━━━━━━━━━━━\n`;
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
    
    await sendTg(userId, `🎉 恭喜！您已升級為 ${tierName(tier)}\n\n天數：${days} 天\n到期：${fmtDate(expires)}\n\n請使用 /subscribe 設定您想接收的品種`);
    
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
    
    await sendTg(userId, `🎉 您的會員已延長 <b>${days}</b> 天！\n新到期日：${fmtDate(newExpiry)}`);
    
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
    const result = await sendTg(userId, `📬 <b>管理員訊息</b>\n━━━━━━━━━━━━━━━━━━\n${message}`);
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
      m += `└ NT$${fmtNum(o.amount)}\n\n`;
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
    
    const expires = new Date(Date.now() + order.days * 86400000).toISOString();
    const user = await getUser(db, order.user_id);
    
    let newExpiry = expires;
    if (user.tier === order.tier && user.tier_expires_at && new Date(user.tier_expires_at) > new Date()) {
      newExpiry = new Date(new Date(user.tier_expires_at).getTime() + order.days * 86400000).toISOString();
    }
    
    await updateUser(db, order.user_id, { tier: order.tier, tier_expires_at: newExpiry, total_spent: (user.total_spent || 0) + order.amount });
    await db.prepare(`UPDATE orders SET status = 'confirmed', confirmed_by = ?, confirmed_at = datetime('now') WHERE order_id = ?`).bind(uid, orderId).run();
    
    // 推薦人獎勵
    if (user.referred_by) {
      const refPaidPoints = parseInt(await getConfig(db, 'referral_paid_points') || '100');
      await addPoints(db, user.referred_by, refPaidPoints, '被推薦人付費');
    }
    
    await logAction(db, uid, 'confirm_order', orderId, `${order.tier} ${order.days}d`);
    
    await sendTg(order.user_id, `🎉 <b>訂單已確認！</b>\n\n訂單：${orderId}\n方案：${tierName(order.tier)}\n天數：${order.days} 天\n到期：${fmtDate(newExpiry)}\n\n請使用 /subscribe 設定訂閱品種`);
    
    return sendTg(cid, `✅ 訂單 ${orderId} 已確認\n用戶已升級為 ${tierName(order.tier)}`);
  }
  
  if (cmd === '/reject') {
    if (!args[0]) return sendTg(cid, `用法：/reject [訂單ID] [原因]`);
    
    const orderId = args[0].toUpperCase();
    const reason = args.slice(1).join(' ') || '未說明';
    
    await db.prepare(`UPDATE orders SET status = 'rejected' WHERE order_id = ?`).bind(orderId).run();
    
    const order = await db.prepare('SELECT user_id FROM orders WHERE order_id = ?').bind(orderId).first();
    if (order) {
      await sendTg(order.user_id, `❌ <b>訂單已取消</b>\n\n訂單：${orderId}\n原因：${reason}`);
    }
    
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
    
    let m = `📈 <b>績效統計</b> (${days}天)\n━━━━━━━━━━━━━━━━━━\n\n`;
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
    
    let m = `⚙️ <b>系統設定</b>\n━━━━━━━━━━━━━━━━━━\n\n`;
    m += `<b>價格</b>\n`;
    m += `├ Pro月費：NT$${proPrice}\n`;
    m += `└ VIP月費：NT$${vipPrice}\n\n`;
    m += `<b>其他</b>\n`;
    m += `├ 試用天數：${trialDays}\n`;
    m += `├ 聯繫方式：${contact}\n`;
    m += `└ 訊號狀態：${paused === '1' ? '已暫停' : '運行中'}\n\n`;
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

  // /setprice [pro|vip] [1|3|12] [金額]
  if (cmd === '/setprice') {
    if (args.length < 3) {
      return sendTg(cid, `用法：/setprice [pro|vip] [1|3|12] [金額]\n例：/setprice pro 1 299`);
    }
    const tier = args[0].toLowerCase();
    const months = args[1];
    const price = String(parseInt(args[2]) || 0);
    if (!['pro', 'vip'].includes(tier) || !['1', '3', '12'].includes(months)) {
      return sendTg(cid, `❌ 參數錯誤`);
    }
    const key = `${tier}_price_${months}m`;
    await setConfig(db, key, price);
    await logAction(db, uid, 'setprice', key, price);
    return sendTg(cid, `✅ ${key} = NT$ ${price}`);
  }

  // /setcontact [tg|line] [值]
  if (cmd === '/setcontact') {
    if (args.length < 2) return sendTg(cid, `用法：/setcontact [tg|line] [@帳號]`);
    const k = args[0] === 'tg' ? 'contact_telegram' : args[0] === 'line' ? 'contact_line' : null;
    if (!k) return sendTg(cid, `❌ 參數錯誤`);
    await setConfig(db, k, args.slice(1).join(' '));
    return sendTg(cid, `✅ 已更新 ${k}`);
  }

  // /settrial [天數]
  if (cmd === '/settrial') {
    const days = parseInt(args[0]);
    if (!days || days < 0) return sendTg(cid, `用法：/settrial [天數]`);
    await setConfig(db, 'trial_days', String(days));
    return sendTg(cid, `✅ 試用天數已設為 ${days} 天`);
  }

  // /sendtest 把最近一筆訊號重發給自己（debug）
  if (cmd === '/sendtest') {
    const sig = await db.prepare(`SELECT * FROM signals ORDER BY created_at DESC LIMIT 1`).first();
    if (!sig) return sendTg(cid, `❌ 沒有訊號可測試`);
    const meta = await db.prepare('SELECT * FROM symbols WHERE symbol = ?').bind(sig.ticker).first();
    const settings = await getUserSettings(db, uid);
    const msg = formatSignalCard(sig, settings, true, meta);
    return sendTg(cid, msg);
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
    m += `/dash /perf /config`;
    
    return sendTg(cid, m);
  }
  
  return null;
}
// ═══════════════════════════════════════════════════════════════════════════════
// 管理員 Callback 處理
// ═══════════════════════════════════════════════════════════════════════════════

async function handleAdminCallback(cid, uid, msgId, data, env) {
  const db = env.DB;
  
  // 幫助提示
  if (data === 'a_help_long') {
    await answerCb(null, '');
    return sendTg(cid, `🟢 <b>做多訊號</b>\n\n<code>/long NQ 21500 21480 21520 21540</code>\n\n參數：品種 進場 止損 TP1 [TP2] [TP3] [@群組]`);
  }
  
  if (data === 'a_help_short') {
    await answerCb(null, '');
    return sendTg(cid, `🔴 <b>做空訊號</b>\n\n<code>/short ES 5820 5835 5810 5800</code>\n\n參數：品種 進場 止損 TP1 [TP2] [TP3] [@群組]`);
  }
  
  if (data === 'a_help_bc') {
    await answerCb(null, '');
    return sendTg(cid, `📢 <b>廣播</b>\n\n<code>/bc 訊息內容</code>\n<code>/bc @vip VIP專屬訊息</code>\n<code>/announce 重要公告</code>`);
  }
  
  if (data === 'a_help_alert') {
    await answerCb(null, '');
    return sendTg(cid, `⚠️ <b>警報</b>\n\n<code>/alert 今晚20:30 CPI數據</code>\n<code>/update 移動止損到21510</code>`);
  }
  
  // 頁面跳轉
  if (data === 'a_users') return handleAdminCommand(cid, uid, '/users', [], '', env);
  if (data === 'a_perf') return handleAdminCommand(cid, uid, '/perf', ['7'], '', env);
  if (data === 'a_orders') return handleAdminCommand(cid, uid, '/orders', [], '', env);
  if (data === 'a_config') return handleAdminCommand(cid, uid, '/config', [], '', env);
  
  // 用戶操作
  if (data.startsWith('adm_pro_')) {
    const userId = data.replace('adm_pro_', '');
    const expires = new Date(Date.now() + 30 * 86400000).toISOString();
    await updateUser(db, userId, { tier: 'pro', tier_expires_at: expires });
    await logAction(db, uid, 'set_pro', userId, '30 days');
    await sendTg(userId, `🎉 恭喜！您已升級為 ⭐ Pro會員\n天數：30天\n到期：${fmtDate(expires)}`);
    await answerCb(null, '已設為Pro 30天');
    return;
  }
  
  if (data.startsWith('adm_vip_')) {
    const userId = data.replace('adm_vip_', '');
    const expires = new Date(Date.now() + 30 * 86400000).toISOString();
    await updateUser(db, userId, { tier: 'vip', tier_expires_at: expires });
    await logAction(db, uid, 'set_vip', userId, '30 days');
    await sendTg(userId, `🎉 恭喜！您已升級為 👑 VIP會員\n天數：30天\n到期：${fmtDate(expires)}`);
    await answerCb(null, '已設為VIP 30天');
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
    await sendTg(userId, `🎉 您的會員已延長 7 天！\n新到期日：${fmtDate(newExpiry)}`);
    await answerCb(null, '已延長7天');
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
    await sendTg(userId, `🎉 您的會員已延長 30 天！\n新到期日：${fmtDate(newExpiry)}`);
    await answerCb(null, '已延長30天');
    return;
  }
  
  if (data.startsWith('adm_ban_')) {
    const userId = data.replace('adm_ban_', '');
    await updateUser(db, userId, { is_banned: 1 });
    await logAction(db, uid, 'ban', userId, '');
    await answerCb(null, '已封禁');
    return;
  }
  
  if (data.startsWith('adm_msg_')) {
    const userId = data.replace('adm_msg_', '');
    await answerCb(null, '');
    return sendTg(cid, `💬 發送私訊\n\n<code>/msg ${userId} 您的訊息內容</code>`);
  }
  
  return null;
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
    await sendTg(user.user_id, `⚠️ 您的會員已到期\n\n已降為免費會員\n使用 /plans 續費`);
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
    await sendTg(user.user_id, `⏰ <b>會員即將到期</b>\n\n您的 ${tierName(user.tier)} 將在 <b>${days}</b> 天後到期\n\n👉 /renew 立即續費`);
    count++;
  }
  
  return { reminded: count };
}

async function handleQueuedSignals(env) {
  const db = env.DB;
  
  // 發送待發訊號
  const queued = await db.prepare(`
    SELECT * FROM queued_signals 
    WHERE sent = 0 AND scheduled_at < datetime('now')
  `).all();
  
  let count = 0;
  for (const q of queued.results || []) {
    const result = await sendTg(q.user_id, q.message);
    if (result?.ok) {
      await db.prepare(`UPDATE queued_signals SET sent = 1 WHERE id = ?`).bind(q.id).run();
      count++;
    }
  }
  
  return { sent: count };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 主處理器
// ═══════════════════════════════════════════════════════════════════════════════

async function handleWebhook(request, env) {
  const db = env.DB;

  // Webhook secret 驗證 (若設定 WEBHOOK_SECRET)
  if (CONFIG.WEBHOOK_SECRET) {
    const got = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (got !== CONFIG.WEBHOOK_SECRET) {
      return json({ error: 'unauthorized' }, 401);
    }
  }

  try {
    const update = await request.json();
    
    // 處理 Callback
    if (update.callback_query) {
      const cb = update.callback_query;
      const cid = cb.message?.chat?.id;
      const uid = String(cb.from?.id);
      const msgId = cb.message?.message_id;
      const data = cb.data;
      
      await answerCb(cb.id);
      
      // 管理員 Callback (限管理員觸發，避免一般用戶呼叫到 adm_ 操作)
      if (isAdmin(uid) && (data.startsWith('a_') || data.startsWith('adm_'))) {
        return await handleAdminCallback(cid, uid, msgId, data, env);
      }
      
      // 用戶 Callback
      return await handleUserCallback(cid, uid, msgId, data, env);
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
        if (adminResult) return adminResult;
      }
      
      // 用戶指令
      const userResult = await handleUserCommand(cid, uid, cmd, args, env);
      if (userResult) return userResult;
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
    initConfig(env);
    const url = new URL(request.url);

    // 健康檢查
    if (url.pathname === '/' || url.pathname === '/health') {
      return json({
        status: 'ok',
        version: CONFIG.VERSION,
        build: CONFIG.BUILD,
        time: fmtTime(),
        ready: Boolean(CONFIG.BOT_TOKEN && CONFIG.ADMIN_IDS.length)
      });
    }
    
    // Webhook
    if (url.pathname === '/webhook' && request.method === 'POST') {
      return handleWebhook(request, env);
    }
    
    // Cron - 過期檢查
    if (url.pathname === '/cron/expire') {
      const result = await handleExpireCheck(env);
      return json({ ok: true, ...result });
    }
    
    // Cron - 到期提醒
    if (url.pathname === '/cron/remind') {
      const result = await handleExpireReminder(env);
      return json({ ok: true, ...result });
    }
    
    // Cron - 待發訊號
    if (url.pathname === '/cron/queued') {
      const result = await handleQueuedSignals(env);
      return json({ ok: true, ...result });
    }
    
    return json({ error: 'Not found' }, 404);
  },
  
  async scheduled(event, env, ctx) {
    initConfig(env);
    // 對應 wrangler.toml 的 cron triggers (UTC):
    //   "0 16 * * *"  → 台北 00:00 過期檢查
    //   "0 0 * * *"   → 台北 08:00 到期提醒
    //   "0 * * * *"   → 每小時跑一次待發訊號

    const hour = new Date().getUTCHours();

    if (hour === 16) await handleExpireCheck(env);
    if (hour === 0)  await handleExpireReminder(env);

    await handleQueuedSignals(env);
  }
};
