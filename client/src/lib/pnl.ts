export type PnlTrade = {
  id: number;
  symbol: string;
  status: string;
  pnlPercent: number | string | null | undefined;
  closedAt?: Date | string | number | null;
};

export type PnlRow = {
  date: string;
  symbol: string;
  pnl: number;
  cumulativePnl: number;
  count: number;
  wins: number;
  losses: number;
};

export function buildPnlRows(trades: PnlTrade[], startDate = "", endDate = "", asset = "all"): PnlRow[] {
  const grouped = new Map<string, PnlRow>();
  for (const trade of trades) {
    if (trade.status === "open" || !trade.closedAt) continue;
    const date = new Date(trade.closedAt).toISOString().slice(0, 10);
    const symbol = trade.symbol === "BTCUSDT" ? "BTC" : trade.symbol === "ETHUSDT" ? "ETH" : trade.symbol.replace("USDT", "");
    if ((asset !== "all" && symbol !== asset) || (startDate && date < startDate) || (endDate && date > endDate)) continue;
    const key = `${date}:${symbol}`;
    const row = grouped.get(key) ?? { date, symbol, pnl: 0, cumulativePnl: 0, count: 0, wins: 0, losses: 0 };
    row.pnl += Number(trade.pnlPercent ?? 0);
    row.count += 1;
    if (trade.status === "take_profit") row.wins += 1;
    if (trade.status === "stop_loss") row.losses += 1;
    grouped.set(key, row);
  }
  let cumulativePnl = 0;
  return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol)).map(row => {
    cumulativePnl += row.pnl;
    return { ...row, pnl: Number(row.pnl.toFixed(6)), cumulativePnl: Number(cumulativePnl.toFixed(6)) };
  });
}

function csvCell(value: string | number) {
  const text = String(value).replaceAll('"', '""');
  return /[",\n]/.test(text) ? `"${text}"` : text;
}

export function pnlRowsToCsv(rows: PnlRow[]) {
  const header = ["date", "asset", "pnl_percent", "cumulative_pnl_percent", "trade_count", "wins", "losses"];
  const body = rows.map(row => [row.date, row.symbol, row.pnl, row.cumulativePnl, row.count, row.wins, row.losses].map(csvCell).join(","));
  return [header.join(","), ...body].join("\n") + "\n";
}
