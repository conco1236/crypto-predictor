import { describe, expect, it } from "vitest";
import { parseRssItems } from "./news";

const now = Date.parse("2026-08-16T12:00:00Z");

describe("news RSS context", () => {
  it("parses recent RSS items with source, URL and timestamp", () => {
    const xml = `<rss><channel><item><title><![CDATA[Bitcoin market update]]></title><link>https://example.com/btc</link><pubDate>Sun, 16 Aug 2026 11:30:00 GMT</pubDate><description>BTC analysis</description></item></channel></rss>`;
    expect(parseRssItems(xml, "Test Source", now)).toMatchObject([{ title: "Bitcoin market update", source: "Test Source", url: "https://example.com/btc", publishedAt: Date.parse("2026-08-16T11:30:00Z") }]);
  });
  it("drops stale and future items", () => {
    const xml = `<rss><item><title>Old</title><link>https://example.com/old</link><pubDate>Sun, 16 Aug 2026 01:00:00 GMT</pubDate></item><item><title>Future</title><link>https://example.com/future</link><pubDate>Sun, 16 Aug 2026 13:00:00 GMT</pubDate></item></rss>`;
    expect(parseRssItems(xml, "Test Source", now)).toHaveLength(0);
  });
});
