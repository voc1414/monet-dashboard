import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";
import { SignJWT, jwtVerify } from "jose";
import { getAllStaffStatus, upsertStaffStatus, insertStaffStatusHistory, getAllStaffStatusHistory, getStaffStatusByKey, getRetirementCountByPeriod, getReactivationCountByPeriod, getAllStylistAliases, addStylistAlias, deleteStylistAlias } from "../db";
import { suggestStaffMatches } from "../nameSuggest";

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

/** Middleware: require valid admin token */
async function requireAdminFromCtx(ctx: { req: any }): Promise<void> {
  const token = getTokenFromRequest(ctx.req);
  if (!token) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "管理者認証が必要です" });
  }
  const valid = await verifyAdminToken(token);
  if (!valid) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "管理者トークンが無効です" });
  }
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

  // ─── Staff Status endpoints ───

  /** Get all staff status records (public - used by frontend to filter retired staff) */
  getStaffStatuses: publicProcedure.query(async () => {
    const statuses = await getAllStaffStatus();
    return statuses;
  }),

  /** Update staff status (admin only) — also records change in history */
  updateStaffStatus: publicProcedure
    .input(z.object({
      staffName: z.string().min(1),
      storeName: z.string().min(1),
      status: z.enum(["active", "retired"]),
      retiredMonth: z.string().regex(/^\d{4}-\d{2}$/).optional().nullable(),
      note: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAdminFromCtx(ctx);

      // Get the previous status before updating
      const existing = await getStaffStatusByKey(input.staffName, input.storeName);
      const previousStatus = existing?.status || "active";

      // Update the status
      await upsertStaffStatus({
        staffName: input.staffName,
        storeName: input.storeName,
        status: input.status,
        retiredMonth: input.status === "retired" ? (input.retiredMonth || getCurrentYearMonth()) : null,
      });

      // Record the change in history
      await insertStaffStatusHistory({
        staffName: input.staffName,
        storeName: input.storeName,
        previousStatus,
        newStatus: input.status,
        changeMonth: input.status === "retired" ? (input.retiredMonth || getCurrentYearMonth()) : null,
        changedBy: ENV.adminUsername || "admin",
        note: input.note ?? null,
      });

      return { success: true };
    }),

  /** Get all staff status change history (admin only) */
  getStaffStatusHistory: publicProcedure
    .query(async ({ ctx }) => {
      await requireAdminFromCtx(ctx);
      return getAllStaffStatusHistory();
    }),

  /** Get staff HR stats for a given period (admin only) */
  getStaffStats: publicProcedure
    .input(z.object({
      /** Start date as ISO string (inclusive). Omit for "all time". */
      startDate: z.string().optional().nullable(),
      /** End date as ISO string (inclusive). Omit for "all time". */
      endDate: z.string().optional().nullable(),
    }).optional())
    .query(async ({ ctx, input }) => {
      await requireAdminFromCtx(ctx);

      const allStatuses = await getAllStaffStatus();
      const totalActive = allStatuses.filter(s => s.status === "active").length;
      const totalRetired = allStatuses.filter(s => s.status === "retired").length;
      const totalAll = allStatuses.length;

      const startDate = input?.startDate ? new Date(input.startDate) : undefined;
      const endDate = input?.endDate ? new Date(input.endDate) : undefined;

      const retirementCount = await getRetirementCountByPeriod(startDate, endDate);
      const reactivationCount = await getReactivationCountByPeriod(startDate, endDate);

      return {
        totalActive,
        totalRetired,
        totalAll,
        periodRetirements: retirementCount,
        periodReactivations: reactivationCount,
      };
    }),

  // ─── Stylist Aliases endpoints ───

  /** Get all stylist aliases (public - used by frontend to normalize names) */
  getStylistAliases: publicProcedure.query(async () => {
    return getAllStylistAliases();
  }),

  /** Add a new stylist alias (admin only) */
  addStylistAlias: publicProcedure
    .input(z.object({
      canonicalName: z.string().min(1),
      alias: z.string().min(1),
      storeName: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAdminFromCtx(ctx);
      await addStylistAlias(input.canonicalName, input.alias, input.storeName);
      return { success: true };
    }),

  /** Delete a stylist alias (admin only) */
  deleteStylistAlias: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAdminFromCtx(ctx);
      await deleteStylistAlias(input.id);
      return { success: true };
    }),

  /** 未マッチ名の候補推定（読み仮名ベース・admin only）。確定はせず候補提示のみ */
  suggestStaffMatches: publicProcedure
    .input(z.object({
      names: z.array(z.string()).max(200),
      roster: z.array(z.string()).max(500),
    }))
    .query(async ({ ctx, input }) => {
      await requireAdminFromCtx(ctx);
      return suggestStaffMatches(input);
    }),

  /** Bulk initialize staff statuses (admin only) - seed from hardcoded data */
  bulkInitStaffStatuses: publicProcedure
    .input(z.object({
      staffList: z.array(z.object({
        staffName: z.string(),
        storeName: z.string(),
        status: z.enum(["active", "retired"]),
        retiredMonth: z.string().optional().nullable(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAdminFromCtx(ctx);

      for (const staff of input.staffList) {
        await upsertStaffStatus({
          staffName: staff.staffName,
          storeName: staff.storeName,
          status: staff.status,
          retiredMonth: staff.retiredMonth ?? null,
        });
      }

      return { success: true, count: input.staffList.length };
    }),
});

function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// 管理者認証ミドルウェア
export async function requireAdmin(ctx: { req: any }): Promise<boolean> {
  const token = getTokenFromRequest(ctx.req);
  if (!token) return false;
  return verifyAdminToken(token);
}
