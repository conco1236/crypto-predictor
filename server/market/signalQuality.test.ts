import { describe, expect, it } from "vitest";
import { assessSignalQuality } from "./signalQuality";

const healthy = { baseConfidence: 78, sourceLatencyMs: 900, dataWarnings: [], liquidityValid: true, crossExchangeVolumeAgreement: true, priceDeviationBps: 6, directionalAgreement: 3, conflictingExchanges: 0 };

describe("signal quality guardrail", () => {
  it("preserves a healthy multi-exchange confidence score", () => {
    expect(assessSignalQuality(healthy)).toMatchObject({ confidence: 78, penalty: 0, isTradeEligible: true });
  });

  it("lowers confidence when source and cross-exchange quality degrade", () => {
    const result = assessSignalQuality({ ...healthy, sourceLatencyMs: 9_500, priceDeviationBps: 24, crossExchangeVolumeAgreement: false });
    expect(result.confidence).toBeLessThan(healthy.baseConfidence);
    expect(result.reasons.join(" ")).toContain("lệch");
  });

  it("blocks Trade eligibility for invalid liquidity or conflicting exchange direction", () => {
    const result = assessSignalQuality({ ...healthy, liquidityValid: false, directionalAgreement: 1, conflictingExchanges: 1 });
    expect(result.isTradeEligible).toBe(false);
    expect(result.reasons.join(" ")).toContain("Quality gate");
  });
});
