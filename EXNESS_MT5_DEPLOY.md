# Exness MT5 Auto Trade Deployment

This project does not store Exness passwords in Cloudflare. The live execution path is:

TradingView alert -> DC Signals Worker -> `auto_trade_orders` queue -> MT5 EA polls `/auto-trade/poll` -> MT5 places order -> EA posts `/auto-trade/ack`.

Official Exness retail trading runs through MetaTrader platforms, so the practical deployment is an MT5 Expert Advisor bridge.

## 1. Worker Settings

Open `/admin` -> TradingView -> Auto Trade Bridge.

Use these first:

- Auto trade: enabled
- Mode: `paper`
- Bridge URL: leave empty for MT5 polling
- Bridge Secret: create a long random secret
- Account label: your Exness MT5 account label
- Default volume: start with `0.01`
- Risk percent: start with `1`
- Daily max orders: start with `5`
- Allowed symbols: `XAUUSD,USTEC,NQ,ETH`
- Allowed strategies: `algo-pro-v1-4`

Keep `paper` until the MT5 EA can poll and acknowledge commands.

## 2. Install the MT5 EA

1. Open MetaTrader 5 signed in to the Exness account.
2. Open `File -> Open Data Folder`.
3. Copy `mt5/DCSignalsExnessBridgeEA.mq5` into `MQL5/Experts/`.
4. Open MetaEditor and compile the EA.
5. In MT5, open `Tools -> Options -> Expert Advisors`.
6. Enable algorithmic trading.
7. Enable WebRequest and add:

```text
https://dc-signals-v91.cc559773.workers.dev
```

## 3. Attach the EA

Attach `DCSignalsExnessBridgeEA` to a chart.

Recommended first inputs:

- `BridgeBaseUrl`: `https://dc-signals-v91.cc559773.workers.dev`
- `BridgeSecret`: same secret as admin
- `LiveTrading`: `false`
- `PollSeconds`: `5`
- `FallbackVolume`: `0.01`
- `AllowedStrategies`: `algo-pro-v1-4`
- `SymbolSuffix`: empty, or your Exness suffix such as `m`

For ETH, Worker sends `broker_symbol = ETHUSD`. If Exness shows `ETHUSDm`, set `SymbolSuffix = m`.

The EA reads `strategy_id` from the Worker command. If it is not in `AllowedStrategies`, the EA acknowledges the command as failed and does not place an order.

## 4. Paper Test

Send a TradingView alert or manual signal while auto trade is enabled in `paper` mode.

Expected result:

- Admin Auto Trade list shows a command.
- EA polls it.
- EA sends ack.
- Admin command status becomes `acked`.
- No real order is placed while Worker mode is `paper` or EA `LiveTrading` is `false`.

## 5. Live Switch

Only after paper ack works:

1. Set Worker Auto Trade mode to `live`.
2. Keep low volume and low daily limit.
3. Set EA `LiveTrading = true`.
4. Confirm MT5 top toolbar algorithmic trading is enabled.
5. Send one small test signal.

Live order placement requires both Worker mode `live` and EA `LiveTrading = true`.

## 6. Emergency Stop

Use any one of these:

- Admin Auto Trade: set Auto trade to disabled.
- MT5: remove the EA from chart.
- MT5: turn off algorithmic trading.
- Admin TradingView source: turn off auto send.
