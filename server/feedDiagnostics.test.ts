import { describe, expect, it } from "vitest";
import { resolveFeedSource } from "../client/src/lib/feedDiagnostics";

describe("feed diagnostics", () => {
  it("uses websocket only for a fresh connected feed", () => {
    expect(resolveFeedSource("connected", [2_000, 8_000], true)).toMatchObject({ source: "websocket", label: "WebSocket live" });
  });

  it("uses a transparent REST snapshot fallback for stale or blocked WebSocket", () => {
    expect(resolveFeedSource("error", [Infinity, Infinity], true)).toMatchObject({ source: "rest_snapshot", label: "REST snapshot" });
  });

  it("does not claim a live source when neither feed exists", () => {
    expect(resolveFeedSource("error", [Infinity, Infinity], false)).toMatchObject({ source: "unavailable", label: "Không có feed" });
  });
});
