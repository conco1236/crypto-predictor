export const TIMEFRAMES = ["1m", "15m", "1h", "4h", "1d"] as const;
export const SYMBOLS = ["BTCUSDT", "ETHUSDT"] as const;

export type Timeframe = (typeof TIMEFRAMES)[number];
export type MarketSymbol = (typeof SYMBOLS)[number];
export type SignalStatus = "Bullish" | "Bearish" | "Neutral" | "No Trade";
export type RiskScore = "Low" | "Medium" | "High";

export type SignalSnapshot = {
  symbol: MarketSymbol;
  timeframe: Timeframe;
  candleOpenTime: number;
  candleCloseTime: number;
  currentPrice: number;
  status: SignalStatus;
  riskScore: RiskScore;
  confluenceScore: number;
  indicators: {
    ema9: number | null;
    ema21: number | null;
    ema50: number | null;
    ema200: number | null;
    rsi14: number | null;
    macd: number | null;
    macdSignal: number | null;
    macdHistogram: number | null;
    bollingerUpper: number | null;
    bollingerMiddle: number | null;
    bollingerLower: number | null;
    adx14: number | null;
    atr14: number | null;
    volumeRatio: number | null;
    support: number | null;
    resistance: number | null;
  };
  plan: {
    direction: "Long" | "Short" | null;
    entryLow: number | null;
    entryHigh: number | null;
    takeProfit: number | null;
    stopLoss: number | null;
  };
  freshness: {
    stale: boolean;
    expectedNextCandleCloseTime: number;
    observedAt: number;
    lagMs: number;
  };
  reasons: string[];
};

export const coinName = (symbol: MarketSymbol) => (symbol === "BTCUSDT" ? "BTC" : "ETH");

export const formatPrice = (value: number | null, compact = false) => {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: compact ? 1 : 2,
    minimumFractionDigits: compact ? 0 : 2,
  });
};

export const formatIndicator = (value: number | null, digits = 2) =>
  value === null || !Number.isFinite(value) ? "—" : value.toLocaleString("en-US", { maximumFractionDigits: digits });
