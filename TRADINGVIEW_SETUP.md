# TradingView 腳本接入指南（止盈止損以腳本為準）

本系統的後台訊號**完全以 TradingView 腳本送來的 alert 為準**。本文說明如何讓你的
Pine 腳本（例如 *ICT Advanced Silver Bullet*）把**止盈止損點位**與**腳本名稱**一起送進來，
讓訊號顯示「✅ 腳本點位」而不是「⚠️ 系統估算」。

---

## 1. Webhook 與來源

每個腳本建議綁一個來源（後台 → TradingView → 新增來源）。Webhook URL 形如：

```
https://你的Worker網址/tv/你的來源ID
```

在 TradingView 建立 Alert 時：

- **Condition**：你的策略
- **Webhook URL**：上面的網址
- **Alert message**：貼下面的 JSON（後台「Alert Message 產生器」可一鍵產生）

> ⏱️ Webhook 必須在數秒內回應，否則 TradingView 會顯示
> `request took too long and timed out`。本系統已將訊號廣播改成背景執行、
> webhook 立即回應，這個 timeout 問題已修正。

---

## 2. 把止盈止損送進來（兩種做法，擇一即可）

TradingView 的 alert **沒有內建 `{{stop_loss}}` / `{{take_profit}}` 變數**，
所以必須由你的 Pine 腳本主動輸出。以下兩種都支援。

### 做法 A：用 `plot()`（推薦，alert 乾淨）

在你的 Pine 腳本把點位畫出來（值會被 alert 的 `{{plot("標題")}}` 取用）：

```pine
//@version=5
// ... 你的策略邏輯，算出這幾個價位 ...
// entryPrice / slPrice / tp1Price / tp2Price / tp3Price

plot(slPrice,  "SL",  display = display.none)
plot(tp1Price, "TP1", display = display.none)
plot(tp2Price, "TP2", display = display.none)
plot(tp3Price, "TP3", display = display.none)
```

Alert message：

```json
{
  "secret": "你的來源 secret",
  "script": "ICT Silver Bullet",
  "strategy": "auto",
  "ticker": "{{ticker}}",
  "exchange": "{{exchange}}",
  "action": "{{strategy.order.action}}",
  "order_comment": "{{strategy.order.comment}}",
  "price": "{{strategy.order.price}}",
  "stop_loss": "{{plot(\"SL\")}}",
  "tp1": "{{plot(\"TP1\")}}",
  "tp2": "{{plot(\"TP2\")}}",
  "tp3": "{{plot(\"TP3\")}}",
  "market_position": "{{strategy.market_position}}",
  "prev_market_position": "{{strategy.prev_market_position}}",
  "time": "{{time}}",
  "interval": "{{interval}}",
  "alert_id": "{{ticker}}-{{time}}-silver-bullet"
}
```

### 做法 B：把點位塞進 `comment`（不必改 alert，只改下單註解）

如果不方便加 `plot`，可以在 `strategy.entry` / `strategy.exit` 的 `comment`
帶上點位字串，系統會自動從 `order_comment` 解析：

```pine
slTpComment = "Adv Short SL=" + str.tostring(slPrice) +
              " TP1=" + str.tostring(tp1Price) +
              " TP2=" + str.tostring(tp2Price) +
              " TP3=" + str.tostring(tp3Price)

strategy.entry("Adv Short", strategy.short, comment = slTpComment)
```

此時 alert 只要照舊帶 `"order_comment": "{{strategy.order.comment}}"` 即可，
系統會解析出 `SL / TP1 / TP2 / TP3`。支援的寫法很寬鬆，例如：

```
SL=4330.5 TP1=4300 TP2=4280 TP3=4260
sl:4330 tp1:4300 tp2:4280
stop 4330 TP 4300
```

---

## 3. 腳本名稱（訊號要顯示是哪個腳本發出的）

- 在 alert 加 `"script": "你的腳本名稱"`，訊號上就會顯示 `📜 你的腳本名稱`。
- 沒填時，系統會用該 webhook **來源的名稱**當作腳本名稱。

---

## 4. 進場 / 出場 / 方向

- 方向：系統優先看 `market_position`（`long` / `short`），其次 `action`（buy/sell）。
- 出場：當 `market_position = flat` 且前一筆是 long/short，或 comment 含
  `exit / close / TP / SL` 等字樣時，系統會把對應的進行中訊號結案並通知。

---

## 5. 點位來源標示對照

| 訊號標示 | 意義 |
|----------|------|
| ✅ 腳本點位 | 止損與止盈都來自 alert（欄位或 comment） |
| ⚠️ 系統估算 | 腳本沒送完整點位，後台用策略規則估算 |
| ✏️ 後台手動 | 後台 / Telegram 指令手動建立的訊號 |

> 目標：所有 TradingView 訊號都顯示「✅ 腳本點位」。若看到「⚠️ 系統估算」，
> 代表該 alert 沒帶 `stop_loss/tp` 或 comment 沒帶點位，回到第 2 步補上即可。

---

## 6. 部署（變更生效）

程式碼變更後需重新部署 Worker 才會生效（D1 新欄位會在第一個請求自動補上）：

```bash
wrangler deploy
```
