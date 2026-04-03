import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useMemo } from "react";

const ADMIN_TOKEN_KEY = "monet_admin_token";

type UseAdminAuthOptions = {
  redirectOnUnauthenticated?: boolean;
};

export function useAdminAuth(options?: UseAdminAuthOptions) {
  const { redirectOnUnauthenticated = false } = options ?? {};

  const meQuery = trpc.admin.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logout = useCallback(() => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    window.location.href = "/admin/login";
  }, []);

  const state = useMemo(() => {
    return {
      admin: meQuery.data ?? null,
      loading: meQuery.isLoading,
      error: meQuery.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [meQuery.data, meQuery.error, meQuery.isLoading]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || meQuery.isFetching) return;
    if (state.admin) return;
    // Not authenticated, redirect to login
    window.location.href = "/admin/login";
  }, [
    redirectOnUnauthenticated,
    meQuery.isLoading,
    meQuery.isFetching,
    state.admin,
  ]);

  return {
    ...state,
    logout,
    refresh: () => meQuery.refetch(),
  };
}
