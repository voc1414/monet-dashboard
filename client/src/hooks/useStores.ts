/**
 * useStores hook — fetches store master from DB via tRPC with hardcoded fallback.
 * All pages should use this instead of hardcoded AREA_STORES / ALL_STORES.
 * Also provides mapping helpers for NPS, monthly report, fankuru, and salon board.
 */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { openedAreaStores } from "@/data/storeMaster";

// DBが空/失敗のときのフォールバック。中身は Notion「DB_monet店舗一覧」から生成した
// client/src/data/storeMaster.ts。店舗を増やすときは Notion を編集して
// `npm run sync:stores` で再生成する（ここに直接書き足さない）。
//
// 開店日が未定の店（＝まだ開店していない）は含まれない。開店日を Notion に入れた
// 時点で自動的に並ぶ。開店日を過ぎたら勝手に出てくるので、開店のたびに
// コードを直す必要はない。

export interface StoreData {
  id: number;
  name: string;
  area: string;
  displayOrder: number;
  salonBoardSheetName: string | null;
  npsAlias: string | null;
  reportAliases: string | null;
  fankuruAliases: string | null;
  knownSince: string | null;
  isAutoDetected: boolean;
  rawNameVariants: string | null;
}

export function useStores() {
  const { data: storeList, isLoading, error } = trpc.stores.list.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
  });

  const { data: grouped } = trpc.stores.grouped.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const areaStores = useMemo(() => {
    if (grouped && grouped.length > 0) return grouped;
    return openedAreaStores();
  }, [grouped]);

  const allStores = useMemo(() => {
    return areaStores.flatMap((a) => a.stores);
  }, [areaStores]);

  /** NPS alias → store name mapping (e.g. "広島土橋院" → "広島土橋院") */
  const npsAliasMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (storeList) {
      for (const s of storeList) {
        if (s.npsAlias) {
          map[s.npsAlias] = s.name;
        }
      }
    }
    return map;
  }, [storeList]);

  /** Monthly report alias → store name mapping */
  const reportAliasMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (storeList) {
      for (const s of storeList) {
        if (s.reportAliases) {
          const aliases = s.reportAliases.split(",").map(a => a.trim());
          for (const alias of aliases) {
            map[alias] = s.name;
          }
        }
      }
    }
    return map;
  }, [storeList]);

  /** Fankuru alias → store name mapping */
  const fankuruAliasMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (storeList) {
      for (const s of storeList) {
        if (s.fankuruAliases) {
          const aliases = s.fankuruAliases.split(",").map(a => a.trim());
          for (const alias of aliases) {
            map[alias] = s.name;
          }
        }
      }
    }
    return map;
  }, [storeList]);

  /** Salon board sheet name → store name mapping */
  const salonBoardSheetMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (storeList) {
      for (const s of storeList) {
        if (s.salonBoardSheetName) {
          map[s.salonBoardSheetName] = s.name;
        }
      }
    }
    return map;
  }, [storeList]);

  /** Check if a store is "new" (knownSince within last 3 months) */
  const isNewStore = useMemo(() => {
    return (storeName: string): boolean => {
      if (!storeList) return false;
      const store = storeList.find(s => s.name === storeName);
      if (!store || !store.knownSince) return false;
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const knownDate = new Date(store.knownSince);
      return knownDate > threeMonthsAgo;
    };
  }, [storeList]);

  return {
    areaStores,
    allStores,
    storeList: (storeList || []) as StoreData[],
    npsAliasMap,
    reportAliasMap,
    fankuruAliasMap,
    salonBoardSheetMap,
    isNewStore,
    isLoading,
    error: error?.message || null,
  };
}
