export type DeliveryRow = { status: "pending" | "sent" | "failed"; attempts: number; createdAt: Date | string };
export type PaperTradeRow = { status: string; pnlPercent: number | null };

export function summarizeDelivery(rows: DeliveryRow[]) {
  const sent = rows.filter(row => row.status === "sent").length;
  const failed = rows.filter(row => row.status === "failed").length;
  const pending = rows.filter(row => row.status === "pending").length;
  return { total: rows.length, sent, failed, pending, deliveryRate: rows.length ? Math.round((sent / rows.length) * 100) : null };
}

export function summarizePaperPnL(rows: PaperTradeRow[]) {
  const closed = rows.filter(row => row.status !== "open" && Number.isFinite(row.pnlPercent));
  const pnlPercent = closed.reduce((sum, row) => sum + Number(row.pnlPercent ?? 0), 0);
  const wins = closed.filter(row => Number(row.pnlPercent) > 0).length;
  return { closed: closed.length, pnlPercent, wins, losses: closed.length - wins };
}
