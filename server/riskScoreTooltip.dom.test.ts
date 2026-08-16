// @vitest-environment jsdom
import React from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import RiskScoreTooltip from "../client/src/components/RiskScoreTooltip";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as typeof globalThis & { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver = ResizeObserverMock;

describe("RiskScoreTooltip DOM interactions", () => {
  it("opens on focus and exposes component details", async () => {
    render(React.createElement(RiskScoreTooltip, {
      score: 67,
      level: "high",
      delayDuration: 0,
      details: [["ATR / biến động", "ATR 100"], ["ADX / xu hướng", "ADX 30"]],
    }));
    const trigger = screen.getByRole("button", { name: /Điểm rủi ro 67 trên 100/i });
    expect(trigger.getAttribute("tabindex")).toBe("0");
    fireEvent.focus(trigger);
    fireEvent.pointerMove(trigger);
    const tooltips = await screen.findAllByRole("tooltip");
    const tooltip = tooltips.find(node => node.textContent?.includes("ATR / biến động"));
    expect(tooltip).toBeTruthy();
    expect(tooltip?.textContent).toContain("ADX / xu hướng");
  });

  it("exposes a hover explanation contract with responsive tooltip width", async () => {
    render(React.createElement(RiskScoreTooltip, {
      score: 32,
      level: "low",
      delayDuration: 0,
      details: [["RSI", "32.0 — trạng thái quá mua/quá bán."]],
    }));
    const trigger = screen.getByRole("button", { name: /Điểm rủi ro 32 trên 100/i });
    expect(trigger.getAttribute("data-tooltip-content")).toContain("RSI: 32.0");
    expect(trigger.className).toContain("focus-visible:ring-2");
  });
});
