import { systemRouter } from "./_core/systemRouter";
import { router } from "./_core/trpc";
import { adminRouter } from "./routers/admin";
import { fankuruRouter } from "./routers/fankuru";
import { storesRouter } from "./routers/stores";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  admin: adminRouter,
  fankuru: fankuruRouter,
  stores: storesRouter,
});

export type AppRouter = typeof appRouter;
