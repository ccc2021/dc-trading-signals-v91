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
wrangler d1 create trading-signals-db
```

**重要！** 執行後會顯示類似：

```
✅ Successfully created DB 'trading-signals-db'

[[d1_databases]]
binding = "DB"
database_name = "trading-signals-db"
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
database_name = "trading-signals-db"
database_id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

---

### 步驟 4.4：建立資料表

```bash
wrangler d1 execute trading-signals-db --remote --file=schema.sql
```

看到一堆 `CREATE TABLE` 的輸出就成功了！

---

## 5. 部署 Worker

### 步驟 5.1：修改 Bot Token（重要！）

1. 用記事本打開 `worker.js`
2. 找到這行（大約在第 10 行）：
   ```javascript
   BOT_TOKEN: '8514506641:AAEx72ChhsQKD0OFz4XykgXGgj4E3va_54w',
   ```
3. 把 Token 改成你自己的（見下一章節如何取得）
4. 找到這行：
   ```javascript
   ADMIN_IDS: ['810479094'],
   ```
5. 把數字改成你自己的 Telegram ID
6. 儲存檔案

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

### 步驟 6.2：更新 Token 並重新部署

1. 用記事本打開 `worker.js`
2. 把 `BOT_TOKEN` 改成你的新 Token
3. 儲存
4. 重新部署：
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

### 步驟 7.3：測試發訊號

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
wrangler d1 execute trading-signals-db --remote --file=schema.sql
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
```

**用戶指令速查：**
```
/menu      # 主選單
/subscribe # 訂閱設定
/settings  # 個人設定
/mystats   # 我的績效
/checkin   # 每日簽到
/plans     # 方案介紹
```
