import { afterEach, describe, expect, it, vi } from "vitest";
import { buildMomentumCriticalInlineKeyboard, buildSignalInlineKeyboard, formatMomentumCriticalAlert, formatOnDemandAiAnalysis, formatSignalAlert, sendTelegramMessage } from "./telegram";
import type { MarketAnalysis } from "../market/binance";

const sample = {
  exchange: "Binance",
  symbol: "BTCUSDT",
  interval: "1h",
  price: 65000,
  change24h: 2.5,
  candles: [],
  indicators: { label: "Bullish", score: 72, rsi: 61, adx: 28, atr: 400, volumeRatio: 1.4 },
  levels: { side: "LONG", entry: 64800, takeProfit1: 65400, takeProfit2: 66000, stopLoss: 64200 },
  updatedAt: Date.now(),
} as unknown as MarketAnalysis;

describe("telegram alerts", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("includes symbol, trend score and risk levels", () => {
    const message = formatSignalAlert(sample);
    expect(message).toContain("BTC");
    expect(message).toContain("Bullish");
    expect(message).toContain("72/100");
    expect(message).toContain("TP1");
    expect(message).toContain("SL");
    expect(message).toContain("không phải khuyến nghị đầu tư");
  });

  it("builds safe inline URLs for chart and liquidity checks", () => {
    const keyboard = buildSignalInlineKeyboard(sample);
    expect(keyboard.inline_keyboard[0][0].url).toContain("tradingview.com");
    expect(keyboard.inline_keyboard[0][1].url).toContain("focus=liquidity");
    expect(keyboard.inline_keyboard[0][1].url).not.toContain("token");
    expect(keyboard.inline_keyboard.flat().find(button => button.text === "Phân tích AI")?.callback_data).toBe("ai:analyze:Binance:BTCUSDT:1h");
  });

  it("formats an on-demand AI response safely without a trade action", () => {
    const message = formatOnDemandAiAnalysis({ exchange: "Binance", symbol: "BTCUSDT", interval: "1h", analysis: "RSI < 70; chờ xác nhận." });
    expect(message).toContain("Phân tích AI theo yêu cầu");
    expect(message).toContain("RSI &lt; 70");
    expect(message).toContain("Không tạo hoặc thay đổi lệnh giao dịch");
  });

  it("includes the AI analysis section when generated for a candle-close alert", () => {
    const message = formatSignalAlert(sample, "Xu hướng tăng được xác nhận; vô hiệu hóa nếu thủng SL.");
    expect(message).toContain("Phân tích AI");
    expect(message).toContain("Xu hướng tăng được xác nhận");
  });

  it("marks a sharp quality penalty as a Telegram warning", () => {
    const message = formatSignalAlert({ ...sample, signalQuality: { confidence: 45, penalty: 24, isTradeEligible: false, reasons: ["Thanh khoản chưa đạt"] } });
    expect(message).toContain("Quality alert");
    expect(message).toContain("24 điểm");
  });

  it("formats a Critical momentum alert as observation only, without trade controls", () => {
    const message = formatMomentumCriticalAlert({ exchange: "OKX", symbol: "ETHUSDT", interval: "4h", candleClosedAt: 1_700_000_000_000, previousConfidence: 76, confidence: 54, delta: -22, reason: "Confidence giảm đột ngột", penalty: 24, isTradeEligible: false });
    expect(message).toContain("Momentum Critical");
    expect(message).toContain("76.0/100 → 54.0/100");
    expect(message).toContain("không tự mở/đóng lệnh");
    expect(message).not.toContain("Mở paper trade");
  });

  it("adds a filtered Confidence Timeline link and safe inline observation button to a Critical alert", () => {
    const message = formatMomentumCriticalAlert({ exchange: "OKX", symbol: "ETHUSDT", interval: "4h", candleClosedAt: 1_700_000_000_000, previousConfidence: 76, confidence: 54, delta: -22, reason: "Confidence giảm đột ngột", penalty: 24, isTradeEligible: false });
    const keyboard = buildMomentumCriticalInlineKeyboard({ exchange: "OKX", symbol: "ETHUSDT", interval: "4h", targetCandleClosedAt: 1_700_000_000_000 });
    expect(message).toContain("page=confidence-timeline&exchange=OKX&symbol=ETHUSDT&interval=4h&target=1700000000000");
    expect(keyboard.inline_keyboard[0][0].url).toContain("page=confidence-timeline&exchange=OKX&symbol=ETHUSDT&interval=4h&target=1700000000000");
    expect(keyboard.inline_keyboard[0][0].url).not.toContain("token");
  });

  it("surfaces Telegram API description when delivery fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ ok: false, description: "chat not found" }) }));
    await expect(sendTelegramMessage("token", "chat", "hello")).rejects.toThrow("chat not found");
  });

  it("returns Telegram message id on successful delivery", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 42 } }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendTelegramMessage("token", "chat", "hello", { inline_keyboard: [[{ text: "Chart", url: "https://example.com" }]] })).resolves.toMatchObject({ ok: true, result: { message_id: 42 } });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).reply_markup.inline_keyboard[0][0].url).toBe("https://example.com");
  });
});
