import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";
import { SignJWT, jwtVerify } from "jose";
import { getAllStaffOverrides, upsertStaffOverride, deleteStaffOverride } from "../db";

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

/** 管理者認証済みプロシージャ */
const adminProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const token = getTokenFromRequest(ctx.req);
  if (!token) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "管理者認証が必要です" });
  }
  const isValid = await verifyAdminToken(token);
  if (!isValid) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "管理者トークンが無効です" });
  }
  return next({ ctx });
});

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

  // ===== スタッフオーバーライド CRUD =====

  /** 全スタッフオーバーライドを取得（公開API — ダッシュボード側でも使用） */
  staffOverrides: publicProcedure.query(async () => {
    return getAllStaffOverrides();
  }),

  /** スタッフオーバーライドを作成/更新（管理者のみ） */
  upsertStaffOverride: adminProcedure
    .input(z.object({
      originalName: z.string().min(1),
      store: z.string().min(1),
      displayName: z.string().min(1),
      hidden: z.number().optional(),
      retiredMonth: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      await upsertStaffOverride(input);
      return { success: true };
    }),

  /** スタッフオーバーライドを削除（管理者のみ） */
  deleteStaffOverride: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteStaffOverride(input.id);
      return { success: true };
    }),
});

// 管理者認証ミドルウェア
export async function requireAdmin(ctx: { req: any }): Promise<boolean> {
  const token = getTokenFromRequest(ctx.req);
  if (!token) return false;
  return verifyAdminToken(token);
}
