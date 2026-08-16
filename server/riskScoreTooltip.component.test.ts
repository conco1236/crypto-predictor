import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import RiskScoreTooltip from "../client/src/components/RiskScoreTooltip";

describe("RiskScoreTooltip component", () => {
  it("renders an accessible focusable trigger with tooltip content contract", () => {
    const html = renderToStaticMarkup(React.createElement(RiskScoreTooltip, {
      score: 67,
      level: "high",
      details: [["ATR / biến động", "ATR 100"], ["ADX / xu hướng", "ADX 30"]],
    }));
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain("Điểm rủi ro 67 trên 100");
    expect(html).toContain("focus-visible:ring-2");
    expect(html).toContain("ATR / biến động: ATR 100");
    expect(html).toContain("ADX / xu hướng: ADX 30");
    expect(html).toContain("bg-rose-300");
  });
});
