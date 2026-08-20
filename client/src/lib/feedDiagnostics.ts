export type FeedSource = "websocket" | "rest_snapshot" | "unavailable";

export function resolveFeedSource(status: string, tickerAges: number[], hasSnapshot: boolean) {
  const fresh = tickerAges.length > 0 && tickerAges.every(age => Number.isFinite(age) && age <= 35_000);
  if (status === "connected" && fresh) return { source: "websocket" as FeedSource, label: "WebSocket live", tone: "emerald" };
  if (hasSnapshot) return { source: "rest_snapshot" as FeedSource, label: "REST snapshot", tone: "cyan" };
  if (status === "reconnecting" || status === "connecting") return { source: "unavailable" as FeedSource, label: "Đang kết nối", tone: "amber" };
  return { source: "unavailable" as FeedSource, label: "Không có feed", tone: "rose" };
}
