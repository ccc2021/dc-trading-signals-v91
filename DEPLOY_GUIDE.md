# 部署完整教學 — DC Trading Signals Pro v9.2

> 從零開始，把這套系統部署到 Cloudflare 上。預計 **15–30 分鐘**。

## 📋 目錄

1. [前置準備](#1-前置準備)
2. [安裝工具](#2-安裝工具)
3. [建立 Telegram Bot](#3-建立-telegram-bot)
4. [取得你的 Telegram ID](#4-取得你的-telegram-id)
5. [建立 Cloudflare 帳號 / 登入 wrangler](#5-cloudflare--wrangler)
6. [下載專案](#6-下載專案)
7. [建立 D1 資料庫](#7-建立-d1-資料庫)
8. [設定機敏資訊（secrets）](#8-設定機敏資訊secrets)
9. [部署 Worker](#9-部署-worker)
10. [設定 Telegram Webhook](#10-設定-telegram-webhook)
11. [驗證部署](#11-驗證部署)
12. [常見問題](#12-常見問題)
13. [更新與重新部署](#13-更新與重新部署)

---

## 1. 前置準備

你需要：

- 一台可上網的電腦（Windows 10/11、macOS、或 Linux）
- 一個 **Telegram** 帳號
- 一個 **Cloudflare** 帳號（免費方案夠用）
- 約 30 分鐘

**整個系統的免費額度可承載：**

- 每天 100,000 次 Worker 執行（綽綽有餘）
- D1 每天 5,000,000 次讀取 + 100,000 次寫入

---

## 2. 安裝工具

### 2.1 安裝 Node.js

下載 LTS 版：<https://nodejs.org/>，一路按下一步即可。

驗證：

```bash
node --version
# 應顯示 v18.x.x 或更新
```

### 2.2 安裝 Wrangler（Cloudflare CLI）

```bash
npm install -g wrangler
wrangler --version
# 應顯示 3.x.x 或更新
```

### 2.3 安裝 Git

- **Windows**：<https://git-scm.com/download/win>
- **macOS**：`xcode-select --install`
- **Linux**：`sudo apt install git`

---

## 3. 建立 Telegram Bot

1. 打開 Telegram，搜尋 **@BotFather**
2. 發送 `/newbot`
3. 輸入 Bot 名稱（例：`DC Trading Signals`）
4. 輸入 Bot 用戶名（例：`my_dc_signals_bot`，必須以 `bot` 結尾）
5. BotFather 會回覆你一段 **Token**，格式像：
   ```
   1234567890:ABCDefGHIjklMNOpqrsTUVwxyz
   ```
6. **把 Token 抄下來**，下方會用到 → 對應 `BOT_TOKEN`
7. **記下你的 Bot 用戶名**（不含 @）→ 對應 `BOT_USERNAME`

> ⚠️ Token 等同於 Bot 的密碼，**絕對不要**貼到截圖、聊天室、或公開 repo。

可選：在 BotFather 裡設定：

- `/setdescription` 設定簡介
- `/setcommands` 設定指令選單（內容可從 [USER_GUIDE.md](./USER_GUIDE.md) 複製）

---

## 4. 取得你的 Telegram ID

管理員 ID 是純數字。

1. 在 Telegram 搜尋 **@userinfobot**
2. 發送 `/start`
3. 它會回覆你的 ID（例如 `810479094`） → 對應 `ADMIN_IDS`

要多管理員？用逗號分隔：`111111,222222`

---

## 5. Cloudflare + wrangler

### 5.1 註冊 Cloudflare 帳號

<https://dash.cloudflare.com/sign-up>，免信用卡。

### 5.2 登入 wrangler

```bash
wrangler login
```

會自動開瀏覽器，點 **Allow**。看到 `Successfully logged in.` 就完成。

---

## 6. 下載專案

```bash
git clone https://github.com/ccc2021/dc-trading-signals-v91.git
cd dc-trading-signals-v91
```

---

## 7. 建立 D1 資料庫

### 7.1 建立 D1 instance

```bash
wrangler d1 create trading-signals-db
```

輸出會像：

```
✅ Successfully created DB 'trading-signals-db'

[[d1_databases]]
binding       = "DB"
database_name = "trading-signals-db"
database_id   = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"  ← 複製這個
```

### 7.2 把 database_id 填到 wrangler.toml

打開 `wrangler.toml`，找到：

```toml
[[d1_databases]]
binding       = "DB"
database_name = "trading-signals-db"
database_id   = "YOUR_DATABASE_ID"
```

把 `YOUR_DATABASE_ID` 換成剛才複製的值。

### 7.3 順手調整 [vars]

```toml
[vars]
ADMIN_IDS    = "你的 Telegram user_id"   # 例如 "810479094"
BOT_USERNAME = "你的 bot 用戶名"          # 不含 @，例如 "my_dc_signals_bot"
```

### 7.4 寫入資料表

```bash
wrangler d1 execute trading-signals-db --remote --file=schema.sql
```

第一次會建立全部 14 個資料表 + 預設資料。
> 本檔案是「冪等」(idempotent)：重複執行不會洗掉用戶資料，只會跳過已存在的表。

---

## 8. 設定機敏資訊（secrets）

⚠️ **不要把 `BOT_TOKEN` 寫進 `wrangler.toml` 或 `worker.js`**，請用 secret 注入。

### 8.1 BOT_TOKEN（必填）

```bash
wrangler secret put BOT_TOKEN
# 貼上 BotFather 給你的 Token，按 Enter
```

### 8.2 WEBHOOK_SECRET（強烈建議）

可避免別人猜到你的 Worker URL 後送假 webhook。

```bash
# 任意亂碼，建議 32+ 字元
wrangler secret put WEBHOOK_SECRET
# 例：sk_r2dY7fP_9xK3Lq8nAH6vBwG4Tj1MzCsXuQpEvNyZ
```

設定後務必記得在第 10 步 setWebhook 帶上同樣的值。

### 8.3 確認 secrets 已設定

```bash
wrangler secret list
```

---

## 9. 部署 Worker

```bash
wrangler deploy
```

成功後會看到：

```
Uploaded dc-signals-v91 (1.23 sec)
Deployed dc-signals-v91 triggers (0.45 sec)
  https://dc-signals-v91.<your-account>.workers.dev
```

**把這個網址抄下來** → 後面叫做 `<WORKER_URL>`。

### 9.1 健康檢查

打開瀏覽器訪問 `<WORKER_URL>/health`，應該看到：

```json
{
  "status": "ok",
  "version": "9.1.1",
  "build": "UserSubscribe",
  "time": "...",
  "ready": true
}
```

`ready: true` 表示 BOT_TOKEN 與 ADMIN_IDS 都讀到了。如果 `ready: false`，回頭檢查第 7.3、8 步。

---

## 10. 設定 Telegram Webhook

把 Telegram 的訊息「轉接」到你的 Worker。

### 10.1 沒設定 WEBHOOK_SECRET 時

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=<WORKER_URL>/webhook"
```

### 10.2 有設定 WEBHOOK_SECRET 時（建議）

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  --data-urlencode "url=<WORKER_URL>/webhook" \
  --data-urlencode "secret_token=<WEBHOOK_SECRET>"
```

成功會回：

```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

### 10.3 確認 webhook

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

`url` 應該是你的 `<WORKER_URL>/webhook`，`pending_update_count` 通常為 0。

---

## 11. 驗證部署

### 11.1 一般用戶測試

1. 打開 Telegram，搜尋你的 Bot 用戶名
2. 點 **Start** 或發送 `/start`
3. 應該收到主選單

### 11.2 管理員測試

發送：

```
/admin
```

應該看到管理儀表板。看不到 → `ADMIN_IDS` 沒設對，回到第 7.3 修改後 `wrangler deploy` 重新部署。

### 11.3 發訊測試

```
/long NQ 21500 21480 21520
```

應該看到「✅ 訊號已發送」並同時把訊號廣播給所有付費會員（如果你目前一個都沒有，就會顯示 0 人）。

### 11.4 看 Logs

即時查看 Worker 執行 log：

```bash
wrangler tail
```

---

## 12. 常見問題

### Q1. `wrangler: command not found`
A. Node.js 沒裝好，或 `npm` 全域路徑不在 PATH 上。重灌 Node.js 再試一次。

### Q2. `Authentication required` / 401
A. `wrangler login` 重新登入。

### Q3. `D1_ERROR: no such table: users`
A. 第 7.4 步沒做或失敗。重新跑：
```bash
wrangler d1 execute trading-signals-db --remote --file=schema.sql
```

### Q4. Bot 沒反應
A. 依序檢查：
1. `<WORKER_URL>/health` 是否回 `ready: true`
2. `getWebhookInfo` 的 `url` 是否正確
3. `getWebhookInfo` 的 `last_error_message` 有沒有錯
4. `wrangler tail` 看有沒有錯誤
5. 有設 `WEBHOOK_SECRET` 但 setWebhook 沒帶 → webhook 會被 401 擋下，重設

### Q5. 健康檢查 `ready: false`
A. 表示 `BOT_TOKEN` 或 `ADMIN_IDS` 沒讀到：
- `wrangler secret list` 確認 `BOT_TOKEN` 有
- 看 `wrangler.toml` 的 `[vars]` 是否寫了 `ADMIN_IDS` 和 `BOT_USERNAME`
- 重新 `wrangler deploy`

### Q6. Cron 沒跑
A. Workers Free 方案 cron 最低粒度 1 分鐘，不過至少要部署過一次才會啟用。
```bash
wrangler tail --format=pretty
```
觀察 scheduled 事件。

### Q7. 想改價格 / 試用天數 / 客服聯繫
A. 不需重新部署，直接從 Bot 用管理員指令：
```
/setprice pro 1 299
/setprice vip 12 5748
/settrial 14
/setcontact tg @YourSupport
```

### Q8. 想新增管理員
A. 改 `wrangler.toml` 的 `[vars] ADMIN_IDS = "111,222,333"`，然後 `wrangler deploy`。

### Q9. 想在本地除錯（不部署）
A. 複製 `.dev.vars.example` → `.dev.vars`，填入真實值，然後：
```bash
wrangler dev
```

---

## 13. 更新與重新部署

修改程式或 schema 之後：

```bash
# 程式碼有改 → 重新部署 worker
npm run deploy           # 等同 wrangler deploy

# schema.sql 有改 → 套用新表/欄位 (idempotent，安全)
npm run db:init          # 等同 wrangler d1 execute --remote --file=schema.sql

# 既有 DB 升版 → 跑 migrations
npm run db:migrate       # 等同 wrangler d1 execute --remote --file=migrations.sql

# secrets 要改
wrangler secret put BOT_TOKEN
wrangler secret put TV_WEBHOOK_SECRET   # v9.2 新增 (可選)
```

> ### 升級到 v9.2.0
> 1. `git pull && npm install`
> 2. `npm run db:migrate` （重複欄位錯誤可忽略，那只代表欄位已存在）
> 3. `npm run deploy`
> 4. Bot 內：`/selftest` 應全綠；`/synccmds` 同步 Bot menu
> 5. （選用）`wrangler secret put TV_WEBHOOK_SECRET` 啟用 TradingView 整合
> 6. `npm run test:run` 跑 70 個單元測試確認核心邏輯
>
> ### 升級到 v9.1.1（從 v9.1.0）
> 1. `wrangler secret put BOT_TOKEN` → 貼上舊 Token
> 2. 把 `wrangler.toml [vars]` 補上 `ADMIN_IDS` 和 `BOT_USERNAME`
> 3. `wrangler deploy`

---

## 🎉 完成！

可以開始發訊號了：

```
/long NQ 21500 21480 21520 21540        # 做多
/short ES 5820 5835 5810  @vip            # 做空 (VIP only)
/tp1 NQ 21520                             # 止盈 1
/sl NQ 21480                              # 止損
/bc 系統公告                               # 廣播
/admin                                     # 管理儀表板
```

完整指令參考：

- 用戶端 → [USER_GUIDE.md](./USER_GUIDE.md)
- 管理員 → [ADMIN_GUIDE.md](./ADMIN_GUIDE.md)
