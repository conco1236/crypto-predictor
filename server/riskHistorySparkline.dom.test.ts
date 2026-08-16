// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  LineChart: ({ data, children }: { data: Array<{ score: number; candleClosedAt: number }>; children: React.ReactNode }) => {
    const line = React.Children.toArray(children).find(child => React.isValidElement(child) && "dot" in child.props) as React.ReactElement<{ dot?: (props: any) => React.ReactElement; }> | undefined;
    const dot = line?.props.dot;
    const references = React.Children.toArray(children).filter(child => React.isValidElement(child) && "y" in child.props).map(child => React.isValidElement(child) ? React.cloneElement(child) : null);
    return React.createElement("svg", null, references, dot ? data.map((point, index) => React.createElement(React.Fragment, { key: index }, dot({ cx: 16 + index * 28, cy: 20 + index, index, payload: point }))) : null);
  },
  Line: (props: any) => React.createElement("line-test", props),
  Tooltip: () => null,
  YAxis: () => null,
  ReferenceLine: ({ y, label }: { y: number; label?: { value?: string } }) => React.createElement("line", { "data-risk-reference": y, "aria-label": `Mức tham chiếu rủi ro ${label?.value ?? y}` }),
}));

import RiskHistorySparkline from "../client/src/components/RiskHistorySparkline";

describe("RiskHistorySparkline DOM interactions", () => {
  afterEach(() => cleanup());
  const points = [
    { score: 42, candleClosedAt: Date.parse("2026-08-16T05:00:00.000Z") },
    { score: 68, candleClosedAt: Date.parse("2026-08-16T06:00:00.000Z") },
  ];

  it("exposes focusable points with accessible labels and opens detail tooltip on focus", () => {
    render(React.createElement(RiskHistorySparkline, { points, level: "medium" }));
    const point = screen.getByRole("img", { name: /điểm rủi ro 68\/100/i });
    expect(point.getAttribute("tabindex")).toBe("0");
    fireEvent.focus(point);
    expect(screen.getByRole("tooltip").textContent).toContain("68/100");
    expect(screen.getByRole("tooltip").textContent).toContain("Nến đóng");
    expect(screen.getByRole("tooltip").className).toContain("max-w-[calc(100vw-2rem)]");
    expect(screen.getByRole("tooltip").className).toContain("break-words");
  });

  it("renders reference lines at risk 33 and 66 with an accessible implementation label", () => {
    render(React.createElement(RiskHistorySparkline, { points, level: "medium" }));
    expect(screen.getByLabelText(/đường tham chiếu mức 33 và 66/i)).toBeTruthy();
    expect(document.querySelector('[data-risk-reference="33"]')?.getAttribute("aria-label")).toContain("33");
    expect(document.querySelector('[data-risk-reference="66"]')?.getAttribute("aria-label")).toContain("66");
  });

  it("keeps both reference lines and accessible chart label across mobile, tablet and desktop widths", () => {
    for (const width of [375, 768, 1280]) {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
      render(React.createElement(RiskHistorySparkline, { points, level: "medium" }));
      expect(screen.getByLabelText(/đường tham chiếu mức 33 và 66/i)).toBeTruthy();
      expect(document.querySelectorAll("[data-risk-reference]")).toHaveLength(2);
      cleanup();
    }
  });

  it("opens the same detailed tooltip when hovering an individual point", () => {
    render(React.createElement(RiskHistorySparkline, { points, level: "high" }));
    fireEvent.mouseEnter(screen.getByRole("img", { name: /điểm rủi ro 42\/100/i }));
    expect(screen.getByRole("tooltip").textContent).toContain("42/100");
  });
});
