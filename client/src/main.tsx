import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError, type TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "../../server/routers";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";
import { IS_ADMIN_BUILD } from "@/lib/appRole";

// スタッフ向けは文字色を真っ黒から少し柔らかいダークグレーにする（index.css の [data-role="staff"]）
if (!IS_ADMIN_BUILD) document.documentElement.dataset.role = "staff";

const ADMIN_TOKEN_KEY = "monet_admin_token";

const queryClient = new QueryClient();

// Manus OAuth removed (B-1): no auto-redirect to an external login portal.
// Admin gating is handled by useAdminAuth + the /admin routes.
// GitHub Pages（本番）は静的配信でサーバAPIが無い。/api/trpc へ投げると毎画面 404 が3件出て
// コンソールに [API Query Error] が並ぶだけなので、通信せずにその場でエラーを返す
// （画面側の扱いは今までの 404 と同じ「データなし」。2026-11-28 点検）。
const NO_API = typeof window !== "undefined" && window.location.hostname.endsWith("github.io");
const noApiLink: TRPCLink<AppRouter> = () => () =>
  observable((observer) => {
    observer.error(new TRPCClientError("サーバAPIなし（GitHub Pages の静的配信）"));
  });

queryClient.getQueryCache().subscribe(event => {
  if (NO_API) return;
  if (event.type === "updated" && event.action.type === "error") {
    console.error("[API Query Error]", event.query.state.error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    console.error("[API Mutation Error]", event.mutation.state.error);
  }
});

const trpcClient = trpc.createClient({
  links: NO_API ? [noApiLink] : [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        const headers = new Headers((init as any)?.headers);
        // Attach admin token if present
        const adminToken = localStorage.getItem(ADMIN_TOKEN_KEY);
        if (adminToken) {
          headers.set("Authorization", `Bearer ${adminToken}`);
        }
        return globalThis.fetch(input, {
          ...(init ?? {}),
          headers,
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
