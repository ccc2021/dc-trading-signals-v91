# DC Trading Signals Pro v9.1

> 用戶自主訂閱系統 - 手機完成所有操作

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com/)
[![Telegram Bot](https://img.shields.io/badge/Telegram-Bot-blue)](https://telegram.org/)
[![D1 Database](https://img.shields.io/badge/D1-Database-green)](https://developers.cloudflare.com/d1/)

## 🎯 核心特色

- **📱 全手機操作** - 所有功能都在 Telegram 完成
- **🎯 自選品種** - 用戶選擇要接收哪些品種訊號
- **⚙️ 個人化設定** - 資金、風險、時區全可調
- **🌙 安靜時段** - 設定不接收通知的時間
- **📊 個人績效** - 追蹤自己的執行績效
- **📝 執行記錄** - 記錄已執行/跳過的訊號

## 💎 會員等級

| 功能 | 👤 Free | ⭐ Pro | 👑 VIP |
|------|:-------:|:------:|:------:|
| 接收訊號 | ❌ | ✅ | ✅ |
| 自選品種 | ❌ | ✅ | ✅ |
| 止盈目標 | - | 2個 | 3個 |
| VIP專屬訊號 | ❌ | ❌ | ✅ |
| 個人績效 | 摘要 | 完整 | 完整 |
| 資金計算 | ❌ | ✅ | ✅ |

## 📱 用戶功能

### 主選單 `/menu`
```
┌─────────────────────────────┐
│  📱 DC Trading Signals      │
├─────────────────────────────┤
│  [📊 最新訊號] [📈 我的績效] │
│  [🎯 訂閱設定] [⚙️ 個人設定] │
│  [💎 升級會員] [🎁 邀請好友] │
└─────────────────────────────┘
```

### 訂閱設定 `/subscribe`
- 選擇接收哪些品種（NQ、ES、GC、CL...）
- 選擇訊號類型（短線、波段、日內）

### 個人設定 `/settings`
- 🔔 通知設定 - 開關各種通知
- 🌙 安靜時段 - 設定不打擾時間
- 💰 資金設定 - 設定交易資金計算建議口數

### 執行記錄
收到訊號可點「✅ 已執行」或「⏭️ 跳過」追蹤績效

## 🚀 管理員功能

### 快速發訊
```bash
/long NQ 21500 21480 21520 21540
/short ES 5820 5835 5810 @vip
/scalp long NQ 21500 21480 21520
```

### 止盈止損
```bash
/tp1 NQ 21520
/sl NQ 21480
/close NQ 21510 獲利了結
```

### 廣播
```bash
/bc 系統通知
/bc @vip VIP專屬訊息
/announce 重要公告
```

## 🛠️ 部署

### 1. 建立 D1 資料庫
```bash
wrangler d1 create dc-signals-v91-db
```

### 2. 執行 Schema
```bash
wrangler d1 execute dc-signals-v91-db --remote --file=schema.sql
```

### 3. 設定 Bot Token
```bash
wrangler secret put BOT_TOKEN
```

`ADMIN_IDS` 與 `BOT_USERNAME` 由 `wrangler.toml` 的 `[vars]` 設定。

### 4. 部署 Worker
```bash
wrangler deploy
```

### 5. 設定 Webhook
```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-worker.workers.dev/webhook"
```

## 🗄️ 資料庫 (14表)

| 表名 | 用途 |
|------|------|
| `users` | 用戶資料 |
| `user_settings` | 用戶設定 |
| `user_executions` | 執行記錄 |
| `symbols` | 品種資訊 |
| `signals` | 訊號記錄 |
| `performance` | 績效統計 |
| `orders` | 訂單記錄 |
| `queued_signals` | 待發訊號 |

## 📋 指令統計

- **用戶指令**: 56 個
- **管理員指令**: 85 個
- **總計**: 141 個

## 📄 License

MIT License

## 📞 聯繫

- Telegram: @Dan_mix_bot
