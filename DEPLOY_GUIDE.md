# DC Trading Signals Pro v9.1 完整部署教學

## 📋 目錄

1. [前置準備](#1-前置準備)
2. [安裝工具](#2-安裝工具)
3. [建立 Cloudflare 帳號](#3-建立-cloudflare-帳號)
4. [建立 D1 資料庫](#4-建立-d1-資料庫)
5. [部署 Worker](#5-部署-worker)
6. [設定 Telegram Bot](#6-設定-telegram-bot)
7. [測試系統](#7-測試系統)
8. [常見問題](#8-常見問題)

---

## 1. 前置準備

### 你需要：
- ✅ Windows 10/11 或 Mac
- ✅ 網路連線
- ✅ Cloudflare 帳號（免費）
- ✅ Telegram 帳號

### 預計時間：15-30 分鐘

---

## 2. 安裝工具

### 步驟 2.1：安裝 Node.js

1. 打開 https://nodejs.org/
2. 下載 **LTS 版本**（綠色按鈕）
3. 執行安裝程式，一直點「下一步」
4. 安裝完成後重啟電腦

**驗證安裝：**
```
打開「命令提示字元」或「終端機」輸入：
node --version
```
應該顯示類似 `v20.x.x`

---

### 步驟 2.2：安裝 Wrangler（Cloudflare CLI）

打開「命令提示字元」（Windows）或「終端機」（Mac）：

```bash
npm install -g wrangler
```

**驗證安裝：**
```bash
wrangler --version
```
應該顯示類似 `3.x.x`

---

### 步驟 2.3：安裝 Git

**Windows：**
1. 打開 https://git-scm.com/download/win
2. 下載並安裝，全部預設選項

**Mac：**
```bash
xcode-select --install
```

---

## 3. 建立 Cloudflare 帳號

### 步驟 3.1：註冊帳號

1. 打開 https://dash.cloudflare.com/sign-up
2. 輸入 Email 和密碼
3. 驗證 Email

### 步驟 3.2：登入 Wrangler

打開命令提示字元：

```bash
wrangler login
```

會自動打開瀏覽器，點擊「Allow」授權。

看到 `Successfully logged in` 就成功了！

---

## 4. 建立 D1 資料庫

### 步驟 4.1：下載專案

```bash
# 進入你想存放的目錄（例如桌面）
cd Desktop

# 下載專案
git clone https://github.com/ccc2021/dc-trading-signals-v91.git

# 進入專案目錄
cd dc-trading-signals-v91
```

---

### 步驟 4.2：建立資料庫

```bash
wrangler d1 create dc-signals-v91-db
```

**重要！** 執行後會顯示類似：

```
✅ Successfully created DB 'dc-signals-v91-db'

[[d1_databases]]
binding = "DB"
database_name = "dc-signals-v91-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  ← 複製這個！
```

**複製 `database_id` 的值！**

---

### 步驟 4.3：更新設定檔

1. 用記事本打開 `wrangler.toml`
2. 找到這行：
   ```
   database_id = "YOUR_DATABASE_ID"
   ```
3. 把 `YOUR_DATABASE_ID` 改成你剛才複製的 ID
4. 儲存檔案

**修改後應該像這樣：**
```toml
name = "dc-signals-v91"
main = "worker.js"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "dc-signals-v91-db"
database_id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

---

### 步驟 4.4：建立資料表

```bash
wrangler d1 execute dc-signals-v91-db --remote --file=schema.sql
```

看到一堆 `CREATE TABLE` 的輸出就成功了！

---

## 5. 部署 Worker

### 步驟 5.1：修改 Bot Token（重要！）

1. 取得 Bot Token（見下一章節）
2. 在終端機執行：
   ```bash
   wrangler secret put BOT_TOKEN
   ```
3. 貼上 Token 後按 Enter。Token 會存進 Cloudflare Worker Secret，不需要寫進 `worker.js`。
4. 用記事本打開 `wrangler.toml`，在 `[vars]` 裡確認：
   ```toml
   ADMIN_IDS = "810479094"
   BOT_USERNAME = "Dan_mix_bot"
   ```
5. 把 `ADMIN_IDS` 改成你的 Telegram ID；多位管理員可用逗號分隔。

**如何取得你的 Telegram ID：**
1. 在 Telegram 搜尋 `@userinfobot`
2. 發送 `/start`
3. 它會回覆你的 ID（純數字）

---

### 步驟 5.2：部署

```bash
wrangler deploy
```

**成功會顯示：**
```
Uploaded dc-signals-v91 (1.23 sec)
Published dc-signals-v91 (0.45 sec)
  https://dc-signals-v91.你的帳號.workers.dev
```

**複製這個網址！**

---

## 6. 設定 Telegram Bot

### 步驟 6.1：建立 Bot

1. 在 Telegram 搜尋 `@BotFather`
2. 發送 `/newbot`
3. 輸入 Bot 名稱（例如：`DC Trading Signals`）
4. 輸入 Bot 用戶名（例如：`dc_signals_bot`，必須以 `bot` 結尾）
5. BotFather 會給你一個 **Token**，格式像這樣：
   ```
   1234567890:ABCDefGHIjklMNOpqrsTUVwxyz
   ```
6. **複製這個 Token**

---

### 步驟 6.2：設定 Token 並重新部署

1. 執行：
   ```bash
   wrangler secret put BOT_TOKEN
   wrangler secret put ADMIN_WEB_PASSWORD
   ```
2. 先貼上 BotFather 給你的 Token，再設定後台登入密碼
3. 重新部署：
   ```bash
   wrangler deploy
   ```

---

### 步驟 6.3：設定 Webhook

把以下網址貼到瀏覽器（記得替換）：

```
https://api.telegram.org/bot你的TOKEN/setWebhook?url=你的Worker網址/webhook
```

**範例：**
```
https://api.telegram.org/bot1234567890:ABCDefGHI/setWebhook?url=https://dc-signals-v91.abc123.workers.dev/webhook
```

**成功會顯示：**
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

---

### 步驟 6.4：選配手動 Cron Secret

系統排程會由 Cloudflare scheduled cron 自動執行，不需要手動呼叫網址。若之後要從瀏覽器、curl 或外部監控工具手動觸發 `/cron/expire`、`/cron/remind`、`/cron/queued`、`/cron/security-cleanup`，請設定：

```bash
wrangler secret put CRON_SECRET
```

手動呼叫時使用後台 Basic Auth，或在 request header 加上：

```text
X-Cron-Secret: 你的 CRON_SECRET
```

未設定 `CRON_SECRET` 時，手動 `/cron/*` 端點會拒絕外部呼叫；Cloudflare scheduled cron 不受影響。

---

## 7. 測試系統

### 步驟 7.1：測試 Bot

1. 在 Telegram 搜尋你剛建立的 Bot
2. 點擊「開始」或發送 `/start`
3. 應該會看到主選單！

### 步驟 7.2：測試管理員功能

發送：
```
/admin
```
應該會看到管理儀表板。

### 步驟 7.3：測試線上後台

開啟：
```
https://你的Worker網址/admin
```

登入帳號預設為 `admin`，密碼是 `ADMIN_WEB_PASSWORD`。

後台可維護：
- 訊號與結案
- 策略與風控規則
- TradingView webhook 來源
- 會員等級與到期日
- 訂單確認、拒絕、退款紀錄與收費設定
- 淨營收、退款率、ARPU、LTV、流失率與 7 日內到期會員

### 步驟 7.3b：測試會員中心

開啟：
```
https://你的Worker網址/member
```

會員可直接用 Email + 密碼建立網站帳號並登入，並可在「帳號安全」修改密碼。登入後可線上查看最新/進行中/歷史訊號，使用起訖日期查詢，維護訂閱品種，建立轉帳或線上付款訂單；每筆訂單都會提供「訂單明細」頁，可回看付款狀態、條款同意時間與流程紀錄。會員也可在線上建立客服工單、查看對話歷程並補充內容。下單前需同意服務條款與交易風險揭露，若已設定 Stripe secrets，會員也會看到線上付款按鈕。

若會員是先用網站帳號註冊，請到 Telegram 對 Bot 輸入 `/login`，再把 6 位碼填入會員中心「帳號安全」的 Telegram 綁定欄位。綁定後，該網站會員仍可直接線上查看訊號，同時也會在 Telegram 收到付費訊號、訂單狀態與客服回覆。

正式販售前也要確認公開政策頁可開啟：`/terms`、`/risk-disclosure`、`/refund`、`/privacy`。會員下單同意區會連到這些頁面，訂單會記錄當下條款版本。

Telegram 會員也可用 `/myorders` 查詢最近訂單、用 `/receipt 訂單ID` 取得單筆訂單明細，或用 `/support 問題內容` 建立客服工單。建立訂單、付款通知、取消、確認與退款後都會提供對應的訂單明細按鈕。管理員可在後台按「退款」或「客服工單」處理售後，也可用 `/refund 訂單ID 金額 原因`、`/tickets`、`/reply`、`/closeticket` 維護紀錄。

### 步驟 7.4：綁定 TradingView

後台會自動建立 `default-tv` 來源。進入 TradingView 分頁後複製：

```text
Webhook URL: https://你的Worker網址/tv/default-tv
```

Alert Message 範例：

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

如果 TradingView alert 不是 strategy alert，請在後台產生器把方向改成 `LONG` 或 `SHORT`，避免 `{{strategy.order.action}}` 沒有值。

### 步驟 7.5：測試發訊號

發送：
```
/long NQ 21500 21480 21520
```

---

## 8. 常見問題

### Q: `wrangler: command not found`
**A:** Node.js 沒安裝好。重新安裝 Node.js 後重開命令提示字元。

### Q: `Error: Authentication required`
**A:** 執行 `wrangler login` 重新登入。

### Q: Bot 沒有回應
**A:** 檢查：
1. Webhook 設定正確嗎？
2. Token 有更新嗎？
3. Worker 部署成功嗎？

### Q: `D1_ERROR: no such table: users`
**A:** Schema 沒執行成功。重新執行：
```bash
wrangler d1 execute dc-signals-v91-db --remote --file=schema.sql
```

### Q: 如何查看錯誤日誌？
**A:** 
```bash
wrangler tail
```
會即時顯示 Worker 的執行日誌。

---

## 📞 需要幫助？

如果遇到問題，請提供：
1. 錯誤訊息截圖
2. 你執行的指令
3. 目前卡在哪一步

---

## 🎉 恭喜完成！

你現在擁有一個完整的交易訊號系統：

- ✅ 用戶自主訂閱品種
- ✅ 個人化資金計算
- ✅ 安靜時段設定
- ✅ 會員管理系統
- ✅ 績效追蹤

**管理員指令速查：**
```
/long NQ 21500 21480 21520 21540   # 做多訊號
/short ES 5820 5835 5810           # 做空訊號
/tp1 NQ 21520                      # 止盈1
/sl NQ 21480                       # 止損
/bc 系統公告                        # 廣播
/admin                              # 管理儀表板
/users                              # 用戶列表
/orders                             # 待處理訂單
/tickets                            # 客服工單
/reply TKTxxxx 回覆內容              # 回覆客服工單
/closeticket TKTxxxx 結案原因        # 結案客服工單
/refund ORDxxxx 299 退款原因         # 記錄人工退款
/revenue                            # 財務營收總覽
/arpu                               # ARPU / 平均客單
/churn                              # 流失與到期追蹤
/lifetime                           # LTV / 付費客戶價值
```

**用戶指令速查：**
```
/menu      # 主選單
/subscribe # 訂閱設定
/settings  # 個人設定
/mystats   # 我的績效
/checkin   # 每日簽到
/plans     # 方案介紹
/support   # 建立客服工單
/mytickets # 我的客服工單
```
