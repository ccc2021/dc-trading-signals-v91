# 管理員指南 — DC Trading Signals Pro v9.1

> 給管理員（ADMIN_IDS 中的 user）使用的完整指令參考。
> 一般用戶看不到這些指令；非管理員執行會直接無回應。

---

## 🚨 開始之前

確認你的 Telegram user_id 已經寫進 `wrangler.toml`：

```toml
[vars]
ADMIN_IDS = "你的_user_id"      # 多管理員以逗號分隔
```

並重新部署：`wrangler deploy`。

驗證：在 bot 發送 `/admin`，能看到儀表板就成功。

---

## 📊 管理儀表板 `/admin` `/dash`

```
╔═══════════════════════════════════╗
║  📊 DC Signals 管理儀表板         ║
║  v9.1.1 UserSubscribe              ║
╠═══════════════════════════════════╣
║  👥 用戶
║    總計 │ 123     ⭐ Pro │ 45     👑 VIP │ 12
║
║  📊 今日訊號
║    發送 │ 8 筆    勝率 │ 75%    盈虧 │ +120 點
║
║  ⚠️ 待處理訂單：3
║  🟢 運行中
║  ⏰ 2026/05/01 21:35
╚═══════════════════════════════════╝
```

按鈕快捷：做多 / 做空 / 廣播 / 警報 / 用戶 / 績效 / 訂單 / 設定。

---

## 📤 發訊指令

### 做多 / 做空

```
/long  品種 進場 止損 [TP1] [TP2] [TP3] [@群組]
/short 品種 進場 止損 [TP1] [TP2] [TP3] [@群組]
```

範例：

```
/long NQ 21500 21480 21520 21540              # 全付費會員
/short ES 5820 5835 5810 5800 @vip            # 只 VIP
/long GC 2050.5 2045 2058 2065  @beta         # 只 beta 群組
```

支援的群組標記：
- `@all` 所有人（含免費）
- `@paid` 付費會員（預設 = 不指定時的目標）
- `@vip` 只 VIP（自動標記為 VIP 專屬）
- `@pro` Pro + VIP
- `@群組名` 自訂群組（例如 `@beta`、`@vvip`）

### 指定訊號類型

```
/scalp long  NQ 21500 21480 21520        # 短線
/swing short ES 5820 5835 5810           # 波段
```

未指定時預設為 `scalp`。

### 止盈

```
/tp1 NQ 21520    # 第 1 止盈（不平倉）
/tp2 NQ 21540    # 第 2 止盈
/tp3 NQ 21560    # 第 3 止盈（VIP）
/tp NQ 1 21520   # 等同 /tp1
```

止盈會自動找到該品種**最近的 active 訊號**並計算盈虧點數。

### 止損

```
/sl NQ 21480
```

止損會把訊號標記為 `closed` 並記錄為 loss。

### 手動平倉

```
/close NQ 21510 獲利了結
/close ES 5825
```

依與進場價的差距自動判定 win / loss / breakeven。

### 訊號更新（不平倉）

```
/update 移動 NQ 止損到 21510，已 +20 點獲利
```

純文字廣播給所有付費會員，會顯示在「訊號更新」卡片裡。

### 行情警報

```
/alert 今晚 20:30 CPI 數據公布，注意波動
```

---

## 📢 廣播

### 一般廣播 `/bc`

```
/bc 系統維護將於今晚 23:00 進行     # 預設給所有付費會員
/bc @all 大家好                       # 給所有人 (含免費)
/bc @vip VIP 專屬訊息                 # 只 VIP
/bc @beta 測試訊息                    # 只 beta 群組
```

### 重要公告 `/announce`

```
/announce 假日休市，週一恢復發訊
```

醒目樣式（雙線框），給所有用戶（不分等級）。

---

## 👥 用戶管理

```
/users [頁碼]                 # 用戶列表 (一頁 20 人)
/user <ID 或 @用戶名>          # 用戶詳情 + 操作按鈕
```

`/user` 卡片附帶按鈕：⭐ Pro 30 天 / 👑 VIP 30 天 / +7 天 / +30 天 / 私訊 / 封禁。

### 直接操作

```
/pro <ID> [天數]              # 設為 Pro，預設 30 天
/vip <ID> [天數]              # 設為 VIP
/adddays <ID> <天數>          # 在現有到期日上加 N 天
/ban <ID>                     # 封禁
/unban <ID>                   # 解封
/msg <ID> <訊息>              # 私訊用戶
```

範例：

```
/pro 810479094 30
/vip 810479094 365
/adddays 810479094 14
/msg 810479094 您的訂單已升級
```

---

## 💰 訂單管理

```
/orders                   # 待處理訂單列表
/confirm <訂單ID>         # 確認付款，自動開通
/reject <訂單ID> <原因>   # 拒絕訂單（會通知用戶）
```

訂單流程：

```
用戶下單 (status=pending)
  ↓ 用戶點「✅ 我已付款」
status=paid                ← 你會收到通知
  ↓ /confirm <ID>
status=confirmed           ← 自動延長/設定會員
                              推薦人自動加 100 點
```

---

## 📈 績效查詢

```
/perf [天數]      # 系統整體績效，預設 7 天
```

範例：

```
/perf       # 近 7 天
/perf 30    # 近 30 天
/perf 1     # 今天
```

回傳：總交易數、勝率、平均獲利/虧損、總盈虧。

---

## ⚙️ 系統設定

```
/config                              # 顯示目前設定
/pause                               # 暫停所有訊號廣播
/resume                              # 恢復
/setprice <pro|vip> <1|3|12> <金額>  # 修改價格
/setcontact <tg|line> <@帳號>        # 修改聯繫方式
/settrial <天數>                      # 修改試用天數
/sendtest                            # 把最近一筆訊號重發給自己 (debug)
```

範例：

```
/setprice pro 1 399
/setprice vip 12 6000
/setcontact tg @MySupport
/settrial 14
```

> 這些指令直接寫進 D1 的 `system_config`，**不需重新部署 worker**。

---

## 🔍 進階維護

### 查 logs

```bash
wrangler tail
wrangler tail --format=pretty
```

### 直接查 D1

```bash
wrangler d1 execute trading-signals-db --remote \
  --command="SELECT tier, COUNT(*) FROM users GROUP BY tier"

wrangler d1 execute trading-signals-db --remote \
  --command="SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT 20"
```

### 備份

```bash
wrangler d1 export trading-signals-db --remote --output=backup.sql
```

### 重新部署（程式有改）

```bash
wrangler deploy
```

### 套用 schema 變更（idempotent）

```bash
wrangler d1 execute trading-signals-db --remote --file=schema.sql
```

---

## 🛡️ 權限與安全

- **管理員指令權限**：透過 `wrangler.toml [vars] ADMIN_IDS` 控制
- **Webhook 防偽**：建議設定 `WEBHOOK_SECRET`，可阻擋假冒的 Telegram 請求
- **Bot Token**：**只能**用 `wrangler secret put BOT_TOKEN` 注入，**不可**寫進原始碼
- **管理操作稽核**：所有管理員行為都記錄在 `admin_logs` 表

查最近 50 筆管理操作：

```bash
wrangler d1 execute trading-signals-db --remote \
  --command="SELECT created_at, admin_id, action, target FROM admin_logs ORDER BY created_at DESC LIMIT 50"
```

---

## 🆕 v9.2 新管理員指令

### 報告

```
/daily        立刻廣播當日績效報告
/weekly       立刻廣播週報 (含各品種拆分)
```

兩者也都有 cron 自動觸發（每日 08:00 / 週日 09:00 台北時間）。

### 用戶資料

```
/note <user_id> <備註>     設定 admin_note
/exec <signal_uid> <user_id> <entry> <contracts> [exit] [pnl] [notes]
                          手動補登用戶實際成交資料
```

### 群組管理

```
/groupnew  <name> [描述]              建立群組
/grouplist                            列出全部群組
/groupinfo <name>                     看成員（最多 50）
/groupadd  <user_id> <name>           加人
/grouprm   <user_id> <name>           移除
/groupdel  <name>                     刪除整個群組
```

群組建立後可在發訊 / 廣播時用 `@群組名` 指定，例：
```
/long NQ 21500 21480 21520 @beta
/bc @beta 測試訊息
```

### 風控

```
/be <品種>    把該品種最新 active 訊號的止損移到 entry，並廣播通知
/daytrade <long|short> <品種> <進場> <止損> <TP1>...   日內訊號 (signal_type=daytrade)
```

### 系統

```
/synccmds     把指令清單推到 Telegram bot menu
/selftest     系統自檢 (env / D1 / 表 / 欄位 / webhook)
```

### 全域設定

直接改 D1 的 `system_config`（或寫個自訂指令）：

| key | 用途 |
|-----|------|
| `global_be_on_tp1` | `1` 開啟 = 每次 `/tp1` 自動廣播 BE 更新 |
| `pin_channel_id` | 公告頻道 ID，發訊時自動 pin |

```bash
wrangler d1 execute trading-signals-db --remote \
  --command="UPDATE system_config SET value='1' WHERE key='global_be_on_tp1'"
```

## 📋 快速速查

```
發訊      /long /short /scalp /swing /daytrade
止盈損    /tp1 /tp2 /tp3 /sl /close /update /be
廣播      /bc /announce /alert  /daily /weekly
用戶      /users /user /pro /vip /adddays /ban /unban /msg /note /exec
群組      /groupnew /grouplist /groupinfo /groupadd /grouprm /groupdel
訂單      /orders /confirm /reject
系統      /admin /dash /perf /config /pause /resume /selftest /synccmds
設定      /setprice /setcontact /settrial /sendtest
```

需要新增功能或回報問題，請開 issue 或聯繫開發者。
