import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  // Manus OAuth removed. Admin auth is handled separately via Bearer token
  // (see server/routers/admin.ts). No cookie/OAuth user is populated here.
  return {
    req: opts.req,
    res: opts.res,
    user: null,
  };
}
