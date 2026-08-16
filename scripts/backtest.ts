import { writeFile } from "node:fs/promises";
import { analyzeCandles, tradeLevels, type Candle } from "../server/market/indicators";
import { evaluateSignalOutcome, summarizeOutcomes, type SignalOutcome } from "../server/market/outcomes";
import { EXCHANGES, INTERVALS, SYMBOLS, fetchExchangeCandles, type ExchangeName, type IntervalName, type SymbolName } from "../server/market/binance";

const MAX_CANDLES = Number(process.env.BACKTEST_CANDLES ?? 300);
const FORWARD_CANDLES = Number(process.env.BACKTEST_FORWARD ?? 16);
const MIN_HISTORY = 50;

type Group = { exchange: ExchangeName; symbol: SymbolName; interval: IntervalName; outcomes: SignalOutcome[] };

async function runGroup(exchange: ExchangeName, symbol: SymbolName, interval: IntervalName): Promise<Group> {
  const candles = await fetchExchangeCandles(exchange, symbol, interval, MAX_CANDLES);
  const outcomes: SignalOutcome[] = [];
  for (let end = MIN_HISTORY; end + FORWARD_CANDLES < candles.length; end++) {
    const history: Candle[] = candles.slice(0, end);
    const future: Candle[] = candles.slice(end - 1, end + FORWARD_CANDLES);
    const indicators = analyzeCandles(history);
    if (indicators.label === "Neutral" || Math.abs(indicators.score) < 25) continue;
    const levels = tradeLevels(indicators, history);
    outcomes.push(evaluateSignalOutcome({ direction: indicators.label, entry: levels.entry, takeProfit: levels.takeProfit1, stopLoss: levels.stopLoss, signalCandleOpenTime: history.at(-1)!.openTime, maxCandles: FORWARD_CANDLES }, future));
  }
  return { exchange, symbol, interval, outcomes };
}

function flatten(groups: Group[]) {
  return groups.flatMap(group => group.outcomes.map(outcome => ({ ...outcome, exchange: group.exchange, symbol: group.symbol, interval: group.interval })));
}

async function main() {
  const groups: Group[] = [];
  for (const exchange of EXCHANGES) for (const symbol of SYMBOLS) for (const interval of INTERVALS) {
    try { groups.push(await runGroup(exchange, symbol, interval)); console.log(`完成 ${exchange} ${symbol} ${interval}`); }
    catch (error) { console.warn(`Bỏ qua ${exchange} ${symbol} ${interval}:`, error instanceof Error ? error.message : error); }
  }
  const rows = flatten(groups);
  const grouped = new Map<string, SignalOutcome[]>();
  for (const row of rows) { const key = `${row.exchange}:${row.symbol}:${row.interval}`; grouped.set(key, [...(grouped.get(key) ?? []), row]); }
  const report = [...grouped.entries()].map(([key, outcomes]) => ({ key, ...summarizeOutcomes(outcomes) }));
  const result = { generatedAt: new Date().toISOString(), candlesPerGroup: MAX_CANDLES, forwardCandles: FORWARD_CANDLES, minHistory: MIN_HISTORY, methodology: "Walk-forward: indicators use only candles before signal; future candles are used only for outcome evaluation; same-candle TP/SL uses conservative SL-first.", groups: report };
  await writeFile("backtest-results.json", JSON.stringify(result, null, 2));
  console.table(report.map(row => ({ group: row.key, total: row.total, resolved: row.resolved, hitRate: row.hitRate == null ? "—" : `${(row.hitRate * 100).toFixed(1)}%`, expectancy: row.expectancyPercent == null ? "—" : `${row.expectancyPercent.toFixed(2)}%`, maxDD: `${row.maxDrawdownPercent.toFixed(2)}%` })));
  console.log("Đã ghi backtest-results.json");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
