import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";
import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET_KEY = new TextEncoder().encode(ENV.cookieSecret || "monet-admin-secret-key");

async function createAdminToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(JWT_SECRET_KEY);
}

async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return payload.role === "admin";
  } catch {
    return false;
  }
}

function getTokenFromRequest(req: any): string | undefined {
  const authHeader = req.headers?.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return undefined;
}

export const adminRouter = router({
  login: publicProcedure
    .input(z.object({
      username: z.string(),
      password: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { username, password } = input;

      if (username !== ENV.adminUsername || password !== ENV.adminPassword) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "IDまたはパスワードが正しくありません",
        });
      }

      const token = await createAdminToken();
      return { success: true, token };
    }),

  me: publicProcedure.query(async ({ ctx }) => {
    const token = getTokenFromRequest(ctx.req);
    if (!token) return null;

    const isValid = await verifyAdminToken(token);
    if (!isValid) return null;

    return { role: "admin" as const, username: ENV.adminUsername };
  }),

  logout: publicProcedure.mutation(() => {
    // Client-side will clear localStorage
    return { success: true };
  }),
});

// 管理者認証ミドルウェア
export async function requireAdmin(ctx: { req: any }): Promise<boolean> {
  const token = getTokenFromRequest(ctx.req);
  if (!token) return false;
  return verifyAdminToken(token);
}
