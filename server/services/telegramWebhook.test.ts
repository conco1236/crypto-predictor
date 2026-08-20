import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  analyzeAllMarkets: vi.fn(),
  fetchRelevantNews: vi.fn(),
  getTelegramSettingsByChatId: vi.fn(),
  getLastSignal: vi.fn(),
  getRecentReanalysis: vi.fn(),
  createReanalysisRequest: vi.fn(),
  updateReanalysisRequest: vi.fn(),
  getNewsAiSettings: vi.fn(),
  saveAiAnalysis: vi.fn(),
  saveNewsItem: vi.fn(),
  sendTelegramMessage: vi.fn(),
  answerTelegramCallbackQuery: vi.fn(),
  generateSignalAiAnalysis: vi.fn(),
  formatOnDemandAiAnalysis: vi.fn(),
  formatOnDemandNewsSummary: vi.fn(),
}));

vi.mock("../market/binance", () => ({ analyzeAllMarkets: mocks.analyzeAllMarkets }));
vi.mock("../market/news", () => ({ fetchRelevantNews: mocks.fetchRelevantNews }));
vi.mock("../db", () => ({
  createPaperBotAudit: vi.fn(), createPaperTrade: vi.fn(), createReanalysisRequest: mocks.createReanalysisRequest,
  getLastSignal: mocks.getLastSignal, getNewsAiSettings: mocks.getNewsAiSettings, getPaperTrades: vi.fn(),
  getRecentReanalysis: mocks.getRecentReanalysis, getTelegramSettingsByChatId: mocks.getTelegramSettingsByChatId,
  saveAiAnalysis: mocks.saveAiAnalysis, saveNewsItem: mocks.saveNewsItem, updatePaperTrade: vi.fn(), updateReanalysisRequest: mocks.updateReanalysisRequest,
}));
vi.mock("./telegram", () => ({
  answerTelegramCallbackQuery: mocks.answerTelegramCallbackQuery, buildPaperTradeInlineKeyboard: vi.fn(() => ({ inline_keyboard: [] })), buildSandboxConfirmationKeyboard: vi.fn(() => ({ inline_keyboard: [] })),
  formatOnDemandAiAnalysis: mocks.formatOnDemandAiAnalysis, formatOnDemandNewsSummary: mocks.formatOnDemandNewsSummary, generateSignalAiAnalysis: mocks.generateSignalAiAnalysis, sendTelegramMessage: mocks.sendTelegramMessage,
}));

import { clearNewsSummaryCallbackRateLimitForTests, handleTelegramPaperWebhook, parseAiAnalysisCallback, parseNewsSummaryCallback } from "./telegramWebhook";

const callback = { callback_query: { id: "callback-1", data: "ai:analyze:Binance:BTCUSDT:1h", message: { chat: { id: "chat-1" } } } };
const analysis = { exchange: "Binance", symbol: "BTCUSDT", interval: "1h", indicators: {}, levels: {} };

describe("Telegram AI analysis callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearNewsSummaryCallbackRateLimitForTests();
    mocks.getTelegramSettingsByChatId.mockResolvedValue({ userId: 7, botToken: "bot-token" });
    mocks.getLastSignal.mockResolvedValue({ id: 81 });
    mocks.getRecentReanalysis.mockResolvedValue(undefined);
    mocks.createReanalysisRequest.mockResolvedValue(901);
    mocks.getNewsAiSettings.mockResolvedValue({ rssSources: "[]", newsLookbackHours: 6 });
    mocks.fetchRelevantNews.mockResolvedValue([]);
    mocks.analyzeAllMarkets.mockResolvedValue([analysis]);
    mocks.generateSignalAiAnalysis.mockResolvedValue("Xu hướng tăng được xác nhận bởi dữ liệu hiện hành.");
    mocks.formatOnDemandAiAnalysis.mockReturnValue("<b>Phân tích AI theo yêu cầu</b>");
    mocks.formatOnDemandNewsSummary.mockReturnValue("<b>Tóm tắt tin tức 1h</b>");
    mocks.sendTelegramMessage.mockResolvedValue({ ok: true });
  });

  it("parses only allowlisted AI callback targets", () => {
    expect(parseAiAnalysisCallback("ai:analyze:OKX:ETHUSDT:4h")).toEqual({ exchange: "OKX", symbol: "ETHUSDT", interval: "4h" });
    expect(parseAiAnalysisCallback("ai:analyze:Unknown:BTCUSDT:1h")).toBeUndefined();
    expect(parseAiAnalysisCallback("ai:analyze:Binance:BTCUSDT:5m")).toBeUndefined();
  });

  it("uses user-owned snapshot, persists audit and sends AI analysis without trade controls", async () => {
    await expect(handleTelegramPaperWebhook(callback)).resolves.toMatchObject({ ok: true, handled: true });
    expect(mocks.answerTelegramCallbackQuery).toHaveBeenCalledWith("bot-token", "callback-1", "Đang tạo phân tích AI…");
    expect(mocks.getLastSignal).toHaveBeenCalledWith(7, "Binance", "BTCUSDT", "1h");
    expect(mocks.createReanalysisRequest).toHaveBeenCalledWith(7, 81);
    expect(mocks.saveAiAnalysis).toHaveBeenCalledWith(7, expect.objectContaining({ snapshotId: 81, symbol: "BTCUSDT", interval: "1h" }));
    expect(mocks.updateReanalysisRequest).toHaveBeenCalledWith(901, { status: "completed" });
    expect(mocks.sendTelegramMessage).toHaveBeenCalledWith("bot-token", "chat-1", "<b>Phân tích AI theo yêu cầu</b>", undefined);
  });

  it("enforces the 15-minute per-snapshot limit before consuming AI", async () => {
    mocks.getRecentReanalysis.mockResolvedValue({ id: 22 });
    await handleTelegramPaperWebhook(callback);
    expect(mocks.createReanalysisRequest).not.toHaveBeenCalled();
    expect(mocks.generateSignalAiAnalysis).not.toHaveBeenCalled();
    expect(mocks.sendTelegramMessage).toHaveBeenCalledWith("bot-token", "chat-1", expect.stringContaining("15 phút"), undefined);
  });

  it("allows news callbacks only for an allowlisted 1h signal", () => {
    expect(parseNewsSummaryCallback("news:summary:Bybit:ETHUSDT:1h")).toEqual({ exchange: "Bybit", symbol: "ETHUSDT", interval: "1h" });
    expect(parseNewsSummaryCallback("news:summary:Bybit:ETHUSDT:4h")).toBeUndefined();
    expect(parseNewsSummaryCallback("news:summary:Unknown:BTCUSDT:1h")).toBeUndefined();
  });

  it("collects and persists sourced RSS items for a user-owned 1h snapshot without calling AI", async () => {
    mocks.fetchRelevantNews.mockResolvedValue([{ source: "CoinDesk", title: "BTC update", url: "https://example.com/btc", summary: "Context", publishedAt: 1_700_000_000_000 }]);
    const newsCallback = { callback_query: { id: "callback-news", data: "news:summary:Binance:BTCUSDT:1h", message: { chat: { id: "chat-1" } } } };
    await handleTelegramPaperWebhook(newsCallback);
    expect(mocks.answerTelegramCallbackQuery).toHaveBeenCalledWith("bot-token", "callback-news", "Đang tổng hợp tin RSS…");
    expect(mocks.fetchRelevantNews).toHaveBeenCalledWith("BTCUSDT", expect.any(Number), { sources: [], lookbackHours: 6 });
    expect(mocks.saveNewsItem).toHaveBeenCalledWith(7, expect.objectContaining({ symbol: "BTCUSDT", url: "https://example.com/btc" }));
    expect(mocks.formatOnDemandNewsSummary).toHaveBeenCalledWith(expect.objectContaining({ exchange: "Binance", symbol: "BTCUSDT", lookbackHours: 6 }));
    expect(mocks.generateSignalAiAnalysis).not.toHaveBeenCalled();
    expect(mocks.sendTelegramMessage).toHaveBeenCalledWith("bot-token", "chat-1", "<b>Tóm tắt tin tức 1h</b>", undefined);
  });

  it("rate limits repeated news summaries for the same user-owned snapshot", async () => {
    const newsCallback = { callback_query: { id: "callback-news", data: "news:summary:Binance:BTCUSDT:1h", message: { chat: { id: "chat-1" } } } };
    await handleTelegramPaperWebhook(newsCallback);
    await handleTelegramPaperWebhook(newsCallback);
    expect(mocks.fetchRelevantNews).toHaveBeenCalledTimes(1);
    expect(mocks.sendTelegramMessage).toHaveBeenLastCalledWith("bot-token", "chat-1", expect.stringContaining("5 phút"), undefined);
  });
});
