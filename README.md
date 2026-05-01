# DC Trading Signals Pro v9.1

> 用戶自主訂閱的 Telegram 交易訊號系統
> 全部跑在 Cloudflare Workers + D1，零伺服器、零月費起步

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com/)
[![D1 Database](https://img.shields.io/badge/D1-Database-green)](https://developers.cloudflare.com/d1/)
[![Telegram Bot](https://img.shields.io/badge/Telegram-Bot-blue)](https://core.telegram.org/bots)

---

## 📚 文件導覽

| 文件 | 適合對象 | 內容 |
|------|---------|------|
| **[DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md)** | 第一次部署 | 從 0 到上線的完整步驟（含 secrets 設定） |
| **[USER_GUIDE.md](./USER_GUIDE.md)** | 訂閱用戶 | 所有用戶指令、訂閱流程、設定教學 |
| **[ADMIN_GUIDE.md](./ADMIN_GUIDE.md)** | 管理員 | 發訊指令、用戶管理、訂單處理 |
| **[FULL_SPEC.md](./FULL_SPEC.md)** | 開發者 | 系統規格與架構 |

---

## 🎯 核心特色

- 📱 **全手機操作** — 用戶與管理員所有功能都在 Telegram 完成
- 🎯 **自選品種** — 用戶選擇要接收的期貨品種
- ⚙️ **個人化設定** — 資金、風險、時區、安靜時段全可調
- 🌙 **安靜時段** — 不打擾時段內的訊號排隊延後送出
- 📊 **個人績效** — 追蹤自己的執行率與模擬盈虧
- 📝 **執行記錄** — 每筆訊號可標記「已執行 / 跳過」
- 🛡️ **無伺服器** — Cloudflare Workers + D1，幾乎零維運

## 💎 會員等級

| 功能 | 👤 Free | ⭐ Pro | 👑 VIP |
|------|:-------:|:------:|:------:|
| 接收訊號 | ❌ | ✅ | ✅ |
| 自選品種 | ❌ | ✅ | ✅ |
| 止盈目標 | - | TP1/TP2 | TP1/TP2/TP3 |
| VIP 專屬訊號 | ❌ | ❌ | ✅ |
| 個人績效 | 摘要 | 完整 | 完整 |
| 資金/口數計算 | ❌ | ✅ | ✅ |

## 🏗️ 架構

```
Telegram User
      │
      ▼
[BotFather Webhook] ──HTTPS──▶ Cloudflare Workers (worker.js)
                                       │
                                       ├─▶ D1 Database (14 tables)
                                       ├─▶ Cron Triggers (3 排程)
                                       └─▶ Telegram Bot API
```

**檔案結構：**

```
.
├── worker.js              # 主程式 (~2900 行，單檔)
├── schema.sql             # D1 schema (冪等，可重複執行)
├── wrangler.toml          # Cloudflare Workers 設定
├── .dev.vars.example      # 本地開發機敏設定範例
├── README.md              # 你正在看的這份
├── DEPLOY_GUIDE.md        # 部署教學
├── USER_GUIDE.md          # 用戶指令參考
├── ADMIN_GUIDE.md         # 管理員指令參考
└── FULL_SPEC.md           # 系統完整規格
```

## 🚀 快速開始 (5 分鐘上線)

> 詳細逐步教學請看 **[DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md)**

```bash
# 1. 安裝 wrangler
npm install -g wrangler && wrangler login

# 2. 建立 D1 並寫入 schema
wrangler d1 create trading-signals-db
# 把回傳的 database_id 填到 wrangler.toml
wrangler d1 execute trading-signals-db --remote --file=schema.sql

# 3. 設定機敏 secrets
wrangler secret put BOT_TOKEN          # 從 @BotFather 取得
wrangler secret put WEBHOOK_SECRET     # 任意亂碼，可選

# 4. 編輯 wrangler.toml 的 [vars]
# ADMIN_IDS    = "你的 Telegram user_id"
# BOT_USERNAME = "你的 bot 用戶名"

# 5. 部署
wrangler deploy

# 6. 設定 webhook (有設 WEBHOOK_SECRET 時帶上 secret_token)
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://dc-signals-v91.<your>.workers.dev/webhook" \
  -d "secret_token=<WEBHOOK_SECRET>"
```

## 🗄️ 資料庫 (14 個資料表)

| 資料表 | 用途 |
|--------|------|
| `users` | 用戶基本資料、等級、積分 |
| `user_settings` | 訂閱品種、通知、安靜時段 |
| `user_executions` | 訊號執行記錄 |
| `signals` | 訊號內容、止盈止損、結果 |
| `performance` | 績效快照 |
| `symbols` | 期貨品種與 tick value |
| `groups` / `group_members` | 自訂廣播群組 |
| `orders` | 訂閱訂單 |
| `point_history` | 積分增減記錄 |
| `admin_logs` | 管理員操作稽核 |
| `system_config` | 系統設定 (價格/聯繫方式…) |
| `broadcasts` | 廣播歷史 |
| `queued_signals` | 安靜時段待發佇列 |

## 🔐 環境變數

| 變數 | 類型 | 說明 |
|------|------|------|
| `BOT_TOKEN` | secret | Telegram Bot Token (**必填**) |
| `ADMIN_IDS` | var | 管理員 user_id，逗號分隔 (**必填**) |
| `BOT_USERNAME` | var | Bot 用戶名，不含 @ (**必填**) |
| `WEBHOOK_SECRET` | secret | Webhook 驗證密鑰 (建議) |

⚠️ **絕對不要把 `BOT_TOKEN` 寫進原始碼或 commit 進 git**。本專案 `worker.js` 已改為從環境變數讀取。

## 📋 指令速查

### 用戶常用
```
/start /menu       主選單
/subscribe         選擇訂閱品種
/settings          個人設定 (通知/安靜時段/資金)
/signals           最新訊號
/mystats           我的績效
/plans             方案介紹
/checkin           每日簽到
/invite            邀請好友
/help              指令清單
```

### 管理員常用
```
/long  NQ 21500 21480 21520 21540        做多訊號
/short ES 5820 5835 5810  @vip            做空 (僅 VIP)
/scalp long NQ ...                        短線
/swing short ES ...                       波段
/tp1 /tp2 /tp3 NQ 21520                   止盈
/sl NQ 21480                              止損
/close NQ 21510 獲利了結                  手動平倉
/bc 系統公告                               廣播
/announce 重要公告                        重要公告
/admin                                     管理儀表板
/users /user /pro /vip /adddays           用戶管理
/orders /confirm /reject                   訂單處理
/setprice pro 1 299                        修改價格
```

完整清單見 [USER_GUIDE.md](./USER_GUIDE.md) 與 [ADMIN_GUIDE.md](./ADMIN_GUIDE.md)。

## 🔄 升級指引（從 v9.1.0 → v9.1.1）

v9.1.1 修正下列問題，**全部向下相容**，更新只需重新部署：

- 🔒 BOT_TOKEN/ADMIN_IDS 改由環境變數讀取（請先 `wrangler secret put BOT_TOKEN` 再部署）
- 🐛 修正非管理員可觸發 `adm_*` callback 的權限漏洞
- 🐛 修正所有品種 tick value 都被當成 5 的計算錯誤
- ✨ 新增 `/history` `/redeem` `/timezone` `/renew` 用戶指令
- ✨ 新增 `/setprice` `/setcontact` `/settrial` `/sendtest` 管理指令
- 🔁 schema.sql 改為冪等（`CREATE TABLE IF NOT EXISTS`），重新執行不會洗資料
- 🛡️ Webhook 支援 secret token 驗證

## 📄 License

MIT License

## 📞 聯繫

Telegram: 詳 system_config 內 `contact_telegram` (預設 `@Admin`)
