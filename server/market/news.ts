export type NewsItem = {
  title: string;
  source: string;
  url: string;
  publishedAt: number;
  summary?: string;
};

const FEEDS = [
  { source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { source: "Crypto Briefing", url: "https://cryptobriefing.com/feed/" },
] as const;

const timeoutSignal = (ms: number) => AbortSignal.timeout(ms);
const decodeXml = (value: string) => value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
const tag = (xml: string, name: string) => decodeXml(xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"))?.[1] ?? "");
const stripHtml = (value: string) => value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export function parseRssItems(xml: string, source: string, now = Date.now(), maxAgeMs = 6 * 60 * 60 * 1000): NewsItem[] {
  return Array.from(xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)).map(match => match[1]).map(item => {
    const title = tag(item, "title");
    const url = tag(item, "link") || tag(item, "guid");
    const publishedAt = Date.parse(tag(item, "pubDate") || tag(item, "published") || tag(item, "updated"));
    const summary = stripHtml(tag(item, "description") || tag(item, "content:encoded"));
    return { title, source, url, publishedAt: Number.isFinite(publishedAt) ? publishedAt : now, summary: summary.slice(0, 240) };
  }).filter(item => item.title && item.url && now - item.publishedAt >= 0 && now - item.publishedAt <= maxAgeMs);
}

export async function fetchRelevantNews(symbol: "BTCUSDT" | "ETHUSDT", now = Date.now()): Promise<NewsItem[]> {
  const terms = symbol === "BTCUSDT" ? ["bitcoin", "btc"] : ["ethereum", "eth"];
  const results = await Promise.all(FEEDS.map(async feed => {
    try {
      const response = await fetch(feed.url, { signal: timeoutSignal(3500), headers: { accept: "application/rss+xml, application/xml, text/xml" } });
      if (!response.ok) return [];
      return parseRssItems(await response.text(), feed.source, now).filter(item => terms.some(term => `${item.title} ${item.summary ?? ""}`.toLowerCase().includes(term)));
    } catch (error) {
      console.warn(`[News] ${feed.source} unavailable`, error instanceof Error ? error.message : String(error));
      return [];
    }
  }));
  return results.flat().sort((a, b) => b.publishedAt - a.publishedAt).filter((item, index, all) => all.findIndex(other => other.url === item.url) === index).slice(0, 5);
}
