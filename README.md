# DC Trading Signals Pro v9.1

> 用戶自主訂閱系統 - Telegram 與網站會員中心皆可手機操作

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com/)
[![Telegram Bot](https://img.shields.io/badge/Telegram-Bot-blue)](https://telegram.org/)
[![D1 Database](https://img.shields.io/badge/D1-Database-green)](https://developers.cloudflare.com/d1/)

## 🎯 核心特色

- **📱 全手機操作** - Telegram Bot 與網站會員中心都支援手機操作
- **🎯 自選品種** - 用戶選擇要接收哪些品種訊號
- **⚙️ 個人化設定** - 資金、風險、時區全可調
- **🌙 安靜時段** - 設定不接收通知的時間
- **📊 個人績效** - 追蹤自己的執行績效
- **📝 執行記錄** - 記錄已執行/跳過的訊號
- **🖥️ 線上後台** - 手機可操作的訊號、策略、會員、訂單與收費維護
- **🌐 會員中心** - 會員可直接在網站查看最新/歷史訊號、依起訖時間查詢、維護訂閱設定與續費
- **🔐 網站帳號登入** - 支援 Email + 密碼直接註冊、登入與修改密碼，並保留 Telegram 登入碼與 Google OAuth
- **🔔 Telegram 推播綁定** - 網站會員可用 Telegram `/login` 6 位碼綁定推播，之後訊號、訂單與客服通知會同步送達
- **🎧 線上客服工單** - 會員可在網站或 Telegram 建立工單、補充內容，後台可回覆與結案
- **🧾 訂單明細與條款紀錄** - 付費下單前記錄條款與風險揭露版本，會員可回看訂單明細/收據
- **📄 販售政策頁** - 內建服務條款、交易風險揭露、退款政策與隱私權政策公開入口
- **💳 Telegram 訂單查詢** - 會員可用 `/myorders` 與 `/receipt` 查詢付款狀態、流程與收據入口
- **💸 售後退款紀錄** - 後台與 Telegram 管理指令可記錄人工退款、同步會員權限並留下事件軌跡
- **📈 財務營運指標** - 後台與 Telegram 可查淨營收、退款率、ARPU、LTV、流失與待處理訂單
- **🔗 TradingView 綁定** - 多來源 webhook、策略自動選擇與點位推算

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

### 財務營運
```bash
/revenue   # 淨營收、30日收入、退款與待處理訂單
/arpu      # ARPU、平均客單與付費會員價值
/churn     # 30日流失率與 7 日內到期會員
/lifetime  # LTV 與付費客戶生命週期價值
```

### 線上後台

後台入口：

```text
https://your-worker.workers.dev/admin
```

後台使用 Basic Auth，部署前需設定：

```bash
wrangler secret put ADMIN_WEB_PASSWORD
```

預設帳號由 `wrangler.toml` 的 `ADMIN_WEB_USER` 設定，預設為 `admin`。

### TradingView Alert

每個來源都有自己的 webhook URL：

```text
https://your-worker.workers.dev/tv/default-tv
```

TradingView Alert Message 範例：

```json
{
  "secret": "來源 secret",
  "strategy": "auto",
  "ticker": "{{ticker}}",
  "action": "{{strategy.order.action}}",
  "price": "{{close}}",
  "time": "{{time}}",
  "interval": "{{interval}}",
  "alert_id": "{{ticker}}-{{time}}-auto"
}
```

Worker 會依來源、品種、週期與策略規則推算 entry、stop loss、TP1/TP2/TP3。來源可設定為自動發送或先存草稿。

## 🛠️ 部署

### 1. 建立 D1 資料庫
```bash
wrangler d1 create dc-signals-v91-db
```

### 2. 執行 Schema
```bash
wrangler d1 execute dc-signals-v91-db --remote --file=schema.sql
```

### 3. 設定 Bot Token 與後台密碼
```bash
wrangler secret put BOT_TOKEN
wrangler secret put ADMIN_WEB_PASSWORD
```

`ADMIN_IDS` 與 `BOT_USERNAME` 由 `wrangler.toml` 的 `[vars]` 設定。

### 3b. 選配第三方登入

會員中心短網址為 `/m`，舊的 `/member` 與 `/login` 仍保留相容。會員中心預設可用 Email + 密碼註冊登入，也可用 Telegram `/login` 一次性登入碼。網站會員登入後可在「帳號安全」輸入 Telegram `/login` 6 位碼，把網站帳號與 Telegram 推播綁在一起；綁定後，付費訊號、訂單通知與客服回覆會送到該 Telegram。若要啟用 Google 第三方登入，另外設定對應 OAuth secrets：

```bash
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
```

OAuth callback URL：

```text
https://your-worker.workers.dev/auth/google/callback
```

若有自訂網域，請設定 `PUBLIC_BASE_URL`，讓登入回呼與會員中心網址一致。

### 3c. 選配 Stripe 線上付款

會員中心會保留轉帳付款；`STRIPE_SECRET_KEY` 與 `STRIPE_WEBHOOK_SECRET` 都設定完成後，才會額外顯示「線上付款」並透過 Checkout 自動確認訂單。退款目前是人工退款紀錄與會員權限同步，不會自動呼叫 Stripe Refund API。

正式收費前請檢查公開政策頁：

```text
https://your-worker.workers.dev/terms
https://your-worker.workers.dev/risk-disclosure
https://your-worker.workers.dev/refund
https://your-worker.workers.dev/privacy
```

```bash
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
```

可選環境變數：

```text
STRIPE_CURRENCY=twd
PUBLIC_BASE_URL=https://your-worker.workers.dev
```

Stripe webhook endpoint：

```text
https://your-worker.workers.dev/webhook/stripe
```

建議訂閱事件：

```text
checkout.session.completed
checkout.session.async_payment_succeeded
```

### 3d. 選配手動 Cron 維運

Cloudflare scheduled cron 會自動處理到期提醒、過期降級、待發訊號與限流清理，不需要額外設定。若要從外部手動觸發 `/cron/*` 維運端點，請設定：

```bash
wrangler secret put CRON_SECRET
```

手動呼叫時需使用後台 Basic Auth，或附上：

```text
X-Cron-Secret: 你的 CRON_SECRET
```

未設定 `CRON_SECRET` 時，手動 `/cron/*` 端點會拒絕外部呼叫；排程 cron 不受影響。

### 4. 部署 Worker
```bash
wrangler deploy
```

### 5. 設定 Webhook
```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-worker.workers.dev/webhook"
```

## 🗄️ 主要資料表

| 表名 | 用途 |
|------|------|
| `users` | 用戶資料與網站會員 Telegram 綁定 |
| `user_settings` | 用戶設定 |
| `user_executions` | 執行記錄 |
| `symbols` | 品種資訊 |
| `signals` | 訊號記錄 |
| `strategies` | 策略與風控規則 |
| `tradingview_sources` | TradingView webhook 來源 |
| `tv_alert_logs` | TradingView alert 接收日誌 |
| `performance` | 績效統計 |
| `orders` | 訂單記錄 |
| `order_events` | 訂單狀態事件與客服追蹤紀錄 |
| `support_tickets` | 會員客服工單 |
| `support_replies` | 客服工單對話紀錄 |
| `member_login_codes` | 會員中心一次性登入碼 |
| `member_oauth_identities` | Google 第三方登入身份 |
| `member_password_accounts` | Email + 密碼網站會員帳號 |
| `rate_limits` | 會員登入與訂單建立速率限制 |
| `queued_signals` | 待發訊號 |

## 📋 指令統計

- **用戶指令**: 58 個
- **管理員指令**: 88 個
- **總計**: 146 個

## 📄 License

MIT License

## 📞 聯繫

- Telegram: @Dan_mix_bot
