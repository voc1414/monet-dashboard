/**
 * useStores hook — fetches store master from DB via tRPC with hardcoded fallback.
 * All pages should use this instead of hardcoded AREA_STORES / ALL_STORES.
 */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";

// Hardcoded fallback (used when DB query fails or returns empty)
const FALLBACK_AREA_STORES: { area: string; stores: string[] }[] = [
  { area: "大阪エリア", stores: ["堀江院", "堀江院2nd", "福島院", "高槻院"] },
  { area: "福岡エリア", stores: ["姪浜院"] },
  { area: "広島エリア", stores: ["楽々園院"] },
];

const FALLBACK_ALL_STORES = FALLBACK_AREA_STORES.flatMap((a) => a.stores);

export function useStores() {
  const { data: grouped, isLoading, error } = trpc.stores.grouped.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
  });

  const areaStores = useMemo(() => {
    if (grouped && grouped.length > 0) return grouped;
    return FALLBACK_AREA_STORES;
  }, [grouped]);

  const allStores = useMemo(() => {
    return areaStores.flatMap((a) => a.stores);
  }, [areaStores]);

  return {
    areaStores,
    allStores,
    isLoading,
    error: error?.message || null,
  };
}
