import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { notifyOwner } from "./notification";
import { publicProcedure, router } from "./trpc";
import { requireAdmin } from "../routers/admin";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: publicProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Admin-only via Bearer token (Manus OAuth/adminProcedure removed in B-1).
      if (!(await requireAdmin(ctx))) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "管理者認証が必要です" });
      }
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
