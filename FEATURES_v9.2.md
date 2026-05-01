# v9.2 特色功能總覽 + 煙霧測試手冊

> 從 v9.1.1 升上來的所有新東西，與部署後一條條驗證的清單。

## 🆕 新指令一覽

### 用戶端

| 指令 | 用途 |
|------|------|
| `/size <品種> <進場> <止損>` | 用我的資金/風險算建議口數 |
| `/rr <進場> <止損> <目標>` | 純報酬風險比計算機（免會員） |
| `/setlimit <點數>` | 每日虧損上限，0 = 不限 |
| `/setbe on\|off` | TP1 達成自動 BE 偏好 |
| `/setmax <N>` | 同品種最多同時持倉提醒 |
| `/img on\|off` | 訊號改用圖片版（QuickChart 圖表） |

### 管理員

| 指令 | 用途 |
|------|------|
| `/daily` / `/weekly` | 立刻廣播每日 / 週績效報告 |
| `/note <user_id> <text>` | 設定用戶 admin_note |
| `/exec <signal_uid> <user_id> <entry> <contracts> [exit] [pnl] [notes]` | 寫入 user_executions.actual_* |
| `/daytrade <long\|short> <品種> <進場> <止損> <TP1>...` | 日內訊號 |
| `/be <品種>` | 把該品種最新 active 訊號的止損移到 entry，廣播通知 |
| `/groupnew <name> [desc]` | 建立自訂群組 |
| `/grouplist` / `/groupinfo <name>` | 群組總覽 / 詳情 |
| `/groupadd <user_id> <group>` | 加人到群組 |
| `/grouprm <user_id> <group>` | 從群組移除 |
| `/groupdel <name>` | 刪除群組 |
| `/synccmds` | 把指令清單推到 Telegram bot menu |
| `/selftest` | 自檢環境變數 / D1 / 表 / 欄位 / webhook |

### 新 callback / UI

- 通知設定多了「📊 每週報告」開關
- `/mystats` 子頁「📊 按品種分析」現在會出真正的數字
- `/mystats` 子頁「📅 選擇月份」變成最近 6 個月柱狀圖

## 🔌 新外部端點

| 路由 | 方法 | 用途 |
|------|------|------|
| `POST /webhook/tv` | 從 TradingView 發 alert 直接建訊號 |
| `GET /stats` | 公開 HTML 績效面板（不含個人資料） |
| `GET /api/stats` | 同樣資料的 JSON |
| `POST /cron/daily` / `/cron/weekly` | 手動觸發 cron |

詳情請看 [INTEGRATIONS.md](./INTEGRATIONS.md)。

## 🔐 新 secrets / vars

| 名稱 | 類型 | 說明 |
|------|------|------|
| `TV_WEBHOOK_SECRET` | secret | 設定後 `/webhook/tv` 必須帶 `X-TV-Secret` header |

## 🗄️ 新欄位 / 系統設定

`user_settings` 新增：
- `auto_be` — TP1 後自動建議 BE
- `daily_loss_limit` — 每日虧損上限（點數）
- `max_concurrent` — 同品種最大同時持倉
- `use_photo` — 訊號是否用圖片版

`system_config` 新 key：
- `global_be_on_tp1` — 0/1，全域開關 TP1 達成自動發 BE
- `pin_channel_id` — 公告頻道 ID，發訊時自動 pin（空字串=不啟用）

## ⏰ Cron 變更

新增第 4 個 cron：

```
"0 16 * * *"  →  台北 00:00  會員過期檢查
"0 0  * * *"  →  台北 08:00  到期提醒 + 每日報告
"0 1  * * 0"  →  週日台北 09:00  每週報告 ★ 新
"0 *  * * *"  →  每小時  安靜時段補送
```

## 🧪 單元測試

```bash
npm install
npm run test:run    # 70 個 test cases，全部需綠
```

## 📋 部署後煙霧測試（14 條）

按順序執行，每條都應該回應預期的訊息。

### 系統與 schema
1. `wrangler d1 execute trading-signals-db --remote --file=migrations.sql` → 補欄位（重複欄位錯誤可忽略）
2. Bot 對管理員 → `/selftest` → 全綠（環境變數、D1、14 表、欄位、webhook）

### 用戶端新指令
3. `/rr 21500 21480 21540` → 顯示 `R:R 1:2.00 🔥`
4. `/size NQ 21500 21480` → 顯示 `建議口數 1.00 口` (預設 capital=10000、risk=1%)
5. `/setlimit 50` → 顯示 `✅ 每日虧損上限設為 50 點`
6. `/setbe on` → 顯示 `✅ Auto-BE 已啟用`
7. `/img on` 後再叫管理員 `/sendtest` → 你應該收到圖片版訊號
8. 通知設定 → 多了「📊 每週報告」按鈕，能切換

### 管理員新功能
9. `/groupnew test01 測試` → ✅，再 `/grouplist` 看到列表
10. `/groupadd <你的id> test01`，再 `/bc @test01 測試訊息` → 你會收到
11. `/daytrade long NQ 21500 21480 21520` → 收到 🎯 日內訊號
12. `/be NQ` → 廣播「止損移至成本」更新卡
13. `/daily` / `/weekly` → 立刻廣播報告
14. `/synccmds` → 回 ✅，Telegram 輸入 `/` 時看到指令選單

### 外部端點（瀏覽器）
- `/health` 應回 `ready: true`
- `/stats` HTML 面板正常顯示
- `/api/stats` JSON 結構完整

### TradingView (選用)
1. `wrangler secret put TV_WEBHOOK_SECRET` 注入密鑰
2. TV alert webhook URL = `https://<your>.workers.dev/webhook/tv`
3. Alert message body = `{"action":"long","ticker":"NQ","entry":{{close}},"sl":21480,"tp1":21520}`
4. Header 設 `X-TV-Secret: <你的密鑰>`
5. 觸發後應收到訊號廣播

## 🛡️ 風控展示

1. 設 `/setlimit 30` 後，當你已執行的虧損達 30 點，下次訊號卡末會印「⚠️ 已達每日虧損上限」
2. 設 `/setmax 1` 後，同品種已有未平倉時，下一張訊號卡末印「⚠️ NQ 已有 1 張未平倉」
3. `system_config.global_be_on_tp1=1` 開啟後，每次 `/tp1` 自動廣播一張更新卡，把止損移到 entry

## 📦 升級步驟（從 v9.1.1）

```bash
# 1. 拉新版
git pull

# 2. 套用 schema 變更（idempotent，重複欄位錯誤可忽略）
npm run db:migrate

# 3. 注入新 secret（可選）
wrangler secret put TV_WEBHOOK_SECRET

# 4. 部署
npm run deploy

# 5. Bot 內驗證
/selftest
/synccmds   # 同步 Bot menu

# 6. 跑單元測試
npm run test:run
```
