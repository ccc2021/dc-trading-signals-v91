// DC Signals Exness MT5 Bridge EA
// Install in MetaTrader 5: MQL5/Experts/DCSignalsExnessBridgeEA.mq5
// Add https://dc-signals-v91.cc559773.workers.dev to Tools > Options > Expert Advisors > Allow WebRequest.

#property strict
#property version   "1.00"
#property description "Polls DC Signals auto-trade queue and executes Exness MT5 orders."

#include <Trade/Trade.mqh>

input string BridgeBaseUrl = "https://dc-signals-v91.cc559773.workers.dev";
input string BridgeSecret = "";
input bool LiveTrading = false;
input int PollSeconds = 5;
input double FallbackVolume = 0.01;
input string AllowedStrategies = "algo-pro-v1-4";
input string SymbolSuffix = "";
input ulong MagicNumber = 910091;
input int DeviationPoints = 30;
input bool CloseOppositeBeforeEntry = true;

CTrade trade;

string Trim(string value)
{
   StringTrimLeft(value);
   StringTrimRight(value);
   return value;
}

string JsonEscape(string value)
{
   StringReplace(value, "\\", "\\\\");
   StringReplace(value, "\"", "\\\"");
   StringReplace(value, "\r", " ");
   StringReplace(value, "\n", " ");
   return value;
}

string Lower(string value)
{
   StringToLower(value);
   return value;
}

bool StrategyAllowed(const string strategyId)
{
   string allowed = Trim(AllowedStrategies);
   if(allowed == "")
      return true;
   string target = Trim(strategyId);
   if(target == "")
      return false;
   StringReplace(allowed, " ", "");
   string haystack = "," + Lower(allowed) + ",";
   string needle = "," + Lower(target) + ",";
   return StringFind(haystack, needle) >= 0;
}

int FindJsonValueStart(const string json, const string key)
{
   string pattern = "\"" + key + "\"";
   int p = StringFind(json, pattern);
   if(p < 0) return -1;
   p = StringFind(json, ":", p + StringLen(pattern));
   if(p < 0) return -1;
   p++;
   while(p < StringLen(json))
   {
      ushort c = StringGetCharacter(json, p);
      if(c != ' ' && c != '\t' && c != '\r' && c != '\n') break;
      p++;
   }
   return p;
}

string JsonString(const string json, const string key, const string fallback = "")
{
   int p = FindJsonValueStart(json, key);
   if(p < 0) return fallback;
   if(StringGetCharacter(json, p) == '"')
   {
      p++;
      string out = "";
      bool escaped = false;
      for(int i = p; i < StringLen(json); i++)
      {
         ushort c = StringGetCharacter(json, i);
         if(escaped)
         {
            out += ShortToString(c);
            escaped = false;
            continue;
         }
         if(c == '\\')
         {
            escaped = true;
            continue;
         }
         if(c == '"') return out;
         out += ShortToString(c);
      }
      return fallback;
   }
   int end = p;
   while(end < StringLen(json))
   {
      ushort c = StringGetCharacter(json, end);
      if(c == ',' || c == '}') break;
      end++;
   }
   return Trim(StringSubstr(json, p, end - p));
}

double JsonDouble(const string json, const string key, double fallback = 0.0)
{
   string value = JsonString(json, key, "");
   if(value == "" || value == "null") return fallback;
   return StringToDouble(value);
}

string FirstOrderObject(const string response)
{
   int orders = StringFind(response, "\"orders\"");
   if(orders < 0) return "";
   int start = StringFind(response, "{", orders);
   if(start < 0) return "";
   int depth = 0;
   bool inString = false;
   bool escaped = false;
   for(int i = start; i < StringLen(response); i++)
   {
      ushort c = StringGetCharacter(response, i);
      if(inString)
      {
         if(escaped) escaped = false;
         else if(c == '\\') escaped = true;
         else if(c == '"') inString = false;
         continue;
      }
      if(c == '"')
      {
         inString = true;
         continue;
      }
      if(c == '{') depth++;
      if(c == '}')
      {
         depth--;
         if(depth == 0) return StringSubstr(response, start, i - start + 1);
      }
   }
   return "";
}

bool HttpRequest(const string method, const string path, const string body, string &response)
{
   string base = BridgeBaseUrl;
   while(StringLen(base) > 0 && StringSubstr(base, StringLen(base) - 1, 1) == "/")
      base = StringSubstr(base, 0, StringLen(base) - 1);
   string url = base + path;
   string headers = "Content-Type: application/json\r\nX-Bridge-Secret: " + BridgeSecret + "\r\n";
   char data[];
   char result[];
   string resultHeaders;
   StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
   int code = WebRequest(method, url, headers, 10000, data, result, resultHeaders);
   response = CharArrayToString(result, 0, -1, CP_UTF8);
   if(code < 200 || code >= 300)
   {
      Print("DC bridge HTTP error ", code, ": ", response);
      return false;
   }
   return true;
}

bool Ack(const string commandId, const string status, const string message, const ulong ticket = 0)
{
   string body = "{\"command_id\":\"" + JsonEscape(commandId) + "\",\"status\":\"" + JsonEscape(status) + "\",\"ticket\":\"" + IntegerToString((long)ticket) + "\",\"message\":\"" + JsonEscape(message) + "\"}";
   string response = "";
   return HttpRequest("POST", "/auto-trade/ack", body, response);
}

string ResolveSymbol(const string brokerSymbol)
{
   string symbol = brokerSymbol;
   if(symbol == "") symbol = _Symbol;
   if(SymbolSuffix != "")
   {
      int suffixStart = StringLen(symbol) - StringLen(SymbolSuffix);
      if(suffixStart < 0 || StringFind(symbol, SymbolSuffix, suffixStart) < 0)
         symbol += SymbolSuffix;
   }
   return symbol;
}

void CloseOppositePositions(const string symbol, const string side)
{
   if(!CloseOppositeBeforeEntry) return;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket)) continue;
      if(PositionGetString(POSITION_SYMBOL) != symbol) continue;
      long type = PositionGetInteger(POSITION_TYPE);
      bool opposite = (side == "buy" && type == POSITION_TYPE_SELL) || (side == "sell" && type == POSITION_TYPE_BUY);
      if(opposite) trade.PositionClose(ticket);
   }
}

void ProcessOrder(const string orderJson)
{
   string commandId = JsonString(orderJson, "command_id");
   string side = JsonString(orderJson, "side");
   string strategyId = JsonString(orderJson, "strategy_id");
   string mode = JsonString(orderJson, "mode", "paper");
   string symbol = ResolveSymbol(JsonString(orderJson, "broker_symbol", JsonString(orderJson, "symbol", _Symbol)));
   double volume = JsonDouble(orderJson, "volume", FallbackVolume);
   double sl = JsonDouble(orderJson, "stop_loss", 0.0);
   double tp = JsonDouble(orderJson, "tp1", 0.0);

   if(commandId == "")
      return;
   if(side != "buy" && side != "sell")
   {
      Ack(commandId, "failed", "invalid side: " + side);
      return;
   }
   if(!StrategyAllowed(strategyId))
   {
      Ack(commandId, "failed", "strategy not allowed: " + strategyId);
      return;
   }
   if(!SymbolSelect(symbol, true))
   {
      Ack(commandId, "failed", "symbol not found: " + symbol);
      return;
   }
   if(mode != "live" || !LiveTrading)
   {
      Ack(commandId, "acked", "paper mode accepted: " + symbol + " " + side);
      return;
   }
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) || !MQLInfoInteger(MQL_TRADE_ALLOWED))
   {
      Ack(commandId, "failed", "terminal auto trading disabled");
      return;
   }

   trade.SetExpertMagicNumber((int)MagicNumber);
   trade.SetDeviationInPoints(DeviationPoints);
   CloseOppositePositions(symbol, side);

   bool ok = false;
   string comment = "DC " + commandId;
   if(side == "buy")
      ok = trade.Buy(volume, symbol, 0.0, sl, tp, comment);
   else
      ok = trade.Sell(volume, symbol, 0.0, sl, tp, comment);

   if(ok)
      Ack(commandId, "acked", "order placed", trade.ResultOrder());
   else
      Ack(commandId, "failed", "trade error " + IntegerToString(trade.ResultRetcode()) + ": " + trade.ResultRetcodeDescription());
}

int OnInit()
{
   if(BridgeSecret == "")
   {
      Print("BridgeSecret is required.");
      return INIT_FAILED;
   }
   trade.SetExpertMagicNumber((int)MagicNumber);
   EventSetTimer(MathMax(1, PollSeconds));
   Print("DC Signals Exness bridge started. LiveTrading=", LiveTrading ? "true" : "false");
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
}

void OnTimer()
{
   string response = "";
   if(!HttpRequest("GET", "/auto-trade/poll?limit=1", "", response))
      return;
   string order = FirstOrderObject(response);
   if(order == "")
      return;
   ProcessOrder(order);
}
