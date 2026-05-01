# 外部整合指南

## TradingView Webhook

讓 TradingView 的 alert 直接在 Bot 廣播訊號，不用人工敲指令。

### 1. 注入密鑰

```bash
wrangler secret put TV_WEBHOOK_SECRET
# 任意亂碼，例：sk_tv_8K3xR9Lz2wQpBvYn
wrangler deploy
```

⚠️ 不設 `TV_WEBHOOK_SECRET` 時 `/webhook/tv` 直接回 503，不接受任何請求。

### 2. TradingView 設定

在 alert 編輯介面：

- **Webhook URL**：`https://<your>.workers.dev/webhook/tv`
- **Headers** (Pro Plus / Premium 才支援自訂 header)：
  ```
  X-TV-Secret: <你剛 put 的密鑰>
  ```
- **Message** (JSON body)：

```json
{
  "action": "long",
  "ticker": "NQ",
  "entry": {{close}},
  "sl": 21480,
  "tp1": 21520,
  "tp2": 21540,
  "type": "scalp",
  "target": "all"
}
```

### 3. 欄位說明

| 欄位 | 必填 | 型別 | 說明 |
|------|:----:|------|------|
| `action` | ✅ | string | `long` 或 `short`（不分大小寫） |
| `ticker` | ✅ | string | 1–10 個英數字元 |
| `entry` | ✅ | number | 進場價 |
| `sl` | ✅ | number | 止損價 |
| `tp1` | | number | 止盈 1 |
| `tp2` | | number | 止盈 2 |
| `tp3` | | number | 止盈 3（VIP 才看得到） |
| `type` | | string | `scalp` / `swing` / `daytrade`，預設 `scalp` |
| `target` | | string | `all` / `paid` / `pro` / `vip` / 自訂群組名，預設 `all`；`vip` 會自動標記為 VIP 專屬 |

### 4. 回傳格式

成功：

```json
{ "ok": true, "signal_uid": "LZ8X9", "sent": 12, "queued": 0, "skipped": 3, "total": 15 }
```

錯誤狀態碼：

| Status | 意義 |
|-------:|------|
| 400 | body 無法解析或欄位不合法 |
| 401 | 缺 `X-TV-Secret` 或不對 |
| 423 | 系統 `/pause` 暫停中 |
| 503 | `TV_WEBHOOK_SECRET` 未設定 |

### 5. 測試

不靠 TV，直接 curl：

```bash
curl -X POST https://<your>.workers.dev/webhook/tv \
  -H "Content-Type: application/json" \
  -H "X-TV-Secret: <你的密鑰>" \
  -d '{"action":"long","ticker":"NQ","entry":21500,"sl":21480,"tp1":21520}'
```

---

## 公開績效面板

### `/stats` (HTML)

直接在瀏覽器打開 `https://<your>.workers.dev/stats`，會看到一個自包含的暗色面板：

- 近 1 / 7 / 30 / 90 日勝率與淨點數
- 近 30 日各品種績效

5 分鐘 CDN cache，**不**洩漏任何個別用戶資訊。

### `/api/stats` (JSON)

```bash
curl https://<your>.workers.dev/api/stats
```

```json
{
  "version": "9.2.0",
  "generated_at": "2026-05-01T13:35:00.000Z",
  "summary": {
    "d1":  { "total": 5,  "wins": 3, "losses": 2, "pnl": 12.5, "win_rate": 60.0 },
    "d7":  { "total": 32, "wins": 21, "losses": 11, "pnl": 88.0, "win_rate": 65.6 },
    "d30": { ... },
    "d90": { ... }
  },
  "by_symbol": [
    { "ticker": "NQ", "total": 18, "wins": 12, "win_rate": 66.7, "pnl": 60.5 },
    ...
  ]
}
```

可以拿來：
- 嵌進你自己的官網
- 給合作夥伴 API
- 餵給其他 dashboard 工具

---

## Bot Menu 同步

```
/synccmds
```

把指令清單推到 Telegram bot，使用者輸入 `/` 時會直接看到下拉選單。

只要 USER_GUIDE 改了想露出的指令，再跑一次 `/synccmds` 即可，不必重新部署。

---

## Pin 訊號到頻道

讓所有訊號都自動 pin 到一個公告頻道。

1. 把 Bot 加入頻道，給 admin 權限
2. 取得頻道 ID（用 @userinfobot 或 `/getUpdates`，格式像 `-1001234567890`）
3. 在 Bot 設定（直接打 SQL 或建一個 admin 指令）：

```bash
wrangler d1 execute trading-signals-db --remote \
  --command="UPDATE system_config SET value='-1001234567890' WHERE key='pin_channel_id'"
```

之後每張訊號都會：
1. 推到頻道
2. 自動 pin 起來

清掉就把 `value` 設回空字串。

---

## Inline Mode 分享訊號

需要先在 BotFather 啟用：

1. `@BotFather`
2. `/mybots` → 選你的 bot → **Bot Settings** → **Inline Mode** → **Turn on**
3. `/setinlinegeotype`（選用）：設定 inline placeholder 文字

之後在任何聊天打 `@your_bot_username`，會出現最近 5 筆訊號可以一鍵插入。

適合你想跟朋友 / 在群組裡分享某張訊號時用。
