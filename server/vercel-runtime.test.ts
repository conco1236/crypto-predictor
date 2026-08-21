import { describe, expect, it, vi } from "vitest";
import { isAuthorizedVercelSetup } from "./vercel-admin";
import { isAuthorizedVercelCron } from "./vercel-scheduled";

describe("Vercel runtime guards", () => {
  it("accepts only the exact Bearer value emitted for Vercel Cron", () => {
    expect(isAuthorizedVercelCron("Bearer cron-secret", "cron-secret")).toBe(true);
    expect(isAuthorizedVercelCron("Bearer wrong", "cron-secret")).toBe(false);
    expect(isAuthorizedVercelCron(undefined, "cron-secret")).toBe(false);
  });

  it("requires an independent deployment setup token for Telegram registration", () => {
    expect(isAuthorizedVercelSetup("Bearer setup-secret", "setup-secret")).toBe(true);
    expect(isAuthorizedVercelSetup("Bearer cron-secret", "setup-secret")).toBe(false);
    expect(isAuthorizedVercelSetup("Bearer setup-secret", "")).toBe(false);
  });
});
