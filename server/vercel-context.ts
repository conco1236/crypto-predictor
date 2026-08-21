import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../drizzle/schema";

export type VercelTrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

/**
 * The Vercel export deliberately keeps the market dashboard public.
 * Managed OAuth is not imported into this runtime; setup actions are instead
 * protected by server-only deployment secrets.
 */
export function createVercelContext(opts: CreateExpressContextOptions): VercelTrpcContext {
  return { req: opts.req, res: opts.res, user: null };
}
