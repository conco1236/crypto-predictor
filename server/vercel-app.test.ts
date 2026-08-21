import { createServer } from "http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "./vercel-app";

let server: ReturnType<typeof createServer>;
let baseUrl = "";

beforeAll(async () => {
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected a numeric local test port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

describe("Vercel Express export", () => {
  it("serves the public health route without managed OAuth or a port listener in source", async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, runtime: "vercel" });
  });
});
