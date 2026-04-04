/**
 * useStaffOverrides — DBのスタッフ名オーバーライドをダッシュボード全体で利用するフック
 *
 * CSVの元名（originalName + store）→ 表示名（displayName）のマッピングを提供する。
 * 管理者ページで変更した内容がダッシュボード全体に反映される。
 */
import { useState, useEffect, useMemo, useCallback } from "react";

export interface StaffOverrideEntry {
  id: number;
  originalName: string;
  store: string;
  displayName: string;
  hidden: number;
  retiredMonth: string | null;
}

// モジュールレベルキャッシュ（セッション中に1回だけ取得、5分キャッシュ）
let cachedOverrides: StaffOverrideEntry[] | null = null;
let cacheTimestamp = 0;
let fetchPromise: Promise<StaffOverrideEntry[]> | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5分

async function fetchOverrides(): Promise<StaffOverrideEntry[]> {
  const now = Date.now();
  if (cachedOverrides && now - cacheTimestamp < CACHE_TTL) {
    return cachedOverrides;
  }
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      // tRPCのバッチエンドポイントを直接呼び出す
      const resp = await fetch("/api/trpc/admin.staffOverrides", {
        credentials: "include",
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      // tRPCレスポンス形式: { result: { data: { json: [...] } } }
      const data = json?.result?.data?.json || [];
      cachedOverrides = data;
      cacheTimestamp = Date.now();
      return data;
    } catch (err) {
      console.warn("[staffOverrides] Failed to fetch overrides:", err);
      return cachedOverrides || [];
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

/** キャッシュをクリアして再取得を強制する */
export function invalidateStaffOverridesCache() {
  cachedOverrides = null;
  cacheTimestamp = 0;
  fetchPromise = null;
}

/**
 * スタッフ名オーバーライドを取得するフック
 */
export function useStaffOverrides() {
  const [overrides, setOverrides] = useState<StaffOverrideEntry[]>(cachedOverrides || []);
  const [loading, setLoading] = useState(!cachedOverrides);

  const refresh = useCallback(async () => {
    invalidateStaffOverridesCache();
    setLoading(true);
    const data = await fetchOverrides();
    setOverrides(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchOverrides().then((data) => {
      if (!cancelled) {
        setOverrides(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // originalName + store → displayName のマップ
  const overrideMap = useMemo(() => {
    const map = new Map<string, StaffOverrideEntry>();
    for (const o of overrides) {
      map.set(`${o.originalName}__${o.store}`, o);
    }
    return map;
  }, [overrides]);

  /**
   * CSVの元名を表示名に変換する
   * @param originalName CSVの元のスタッフ名
   * @param store 正規化された店舗名
   * @returns 表示名（オーバーライドがなければ元名をそのまま返す）
   */
  const getDisplayName = useCallback(
    (originalName: string, store: string): string => {
      const key = `${originalName}__${store}`;
      const override = overrideMap.get(key);
      return override ? override.displayName : originalName;
    },
    [overrideMap]
  );

  /**
   * スタッフが非表示設定かどうか
   */
  const isHidden = useCallback(
    (originalName: string, store: string): boolean => {
      const key = `${originalName}__${store}`;
      const override = overrideMap.get(key);
      return override ? override.hidden === 1 : false;
    },
    [overrideMap]
  );

  /**
   * スタッフの退社月を取得（DBオーバーライド優先）
   */
  const getRetiredMonth = useCallback(
    (originalName: string, store: string): string | null => {
      const key = `${originalName}__${store}`;
      const override = overrideMap.get(key);
      return override?.retiredMonth ?? null;
    },
    [overrideMap]
  );

  return {
    overrides,
    loading,
    refresh,
    getDisplayName,
    isHidden,
    getRetiredMonth,
    overrideMap,
  };
}
