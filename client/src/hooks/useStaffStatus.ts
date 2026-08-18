/**
 * useStaffStatus — DB-backed staff status hook
 *
 * Fetches staff statuses from the backend (staffStatus table) and provides
 * a function to check if a staff member is retired for a given month.
 * This replaces the hardcoded RETIRED_STAFF map in newBadge.ts.
 */
import { trpc } from "@/lib/trpc";
import { useMemo, useEffect } from "react";
import { setRetiredStaffMap, isRetiredStaff } from "@/lib/newBadge";

export type StaffStatusRecord = {
  staffName: string;
  storeName: string;
  status: "active" | "retired";
  retiredMonth: string | null;
};

/**
 * Hook to fetch and expose staff status data from the database.
 * Returns:
 * - statuses: array of all staff status records
 * - isRetired(staffName, storeName?, month?): check if a staff member is retired
 * - loading: whether the query is still loading
 * - statusMap: Map<"name|store", StaffStatusRecord> for direct lookups
 */
export function useStaffStatus() {
  const query = trpc.admin.getStaffStatuses.useQuery(undefined, {
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const statusMap = useMemo(() => {
    const map = new Map<string, StaffStatusRecord>();
    if (query.data) {
      for (const s of query.data) {
        map.set(`${s.staffName}|${s.storeName}`, {
          staffName: s.staffName,
          storeName: s.storeName,
          status: s.status,
          retiredMonth: s.retiredMonth,
        });
      }
    }
    return map;
  }, [query.data]);

  /**
   * Check if a staff member is retired.
   * Falls back to the hardcoded RETIRED_STAFF if DB has no data.
   * @param staffName Staff display name
   * @param storeName Store name (optional, for disambiguation)
   * @param month Target month "YYYY-MM" (optional, defaults to current month)
   */
  function isRetired(staffName: string, storeName?: string, month?: string): boolean {
    const targetMonth = month || getCurrentYearMonth();

    // If DB has data, use it
    if (statusMap.size > 0) {
      // Try exact match first
      if (storeName) {
        const key = `${staffName}|${storeName}`;
        const record = statusMap.get(key);
        if (record) {
          if (record.status !== "retired") return false;
          if (record.retiredMonth) return targetMonth >= record.retiredMonth;
          return true;
        }
      }

      // Try name-only match (case-insensitive)
      const nameLower = staffName.trim().toLowerCase();
      for (const [, record] of Array.from(statusMap.entries())) {
        if (record.staffName.trim().toLowerCase() === nameLower) {
          if (storeName && record.storeName !== storeName) continue;
          if (record.status !== "retired") return false;
          if (record.retiredMonth) return targetMonth >= record.retiredMonth;
          return true;
        }
      }

      // Not found in DB = not retired (active by default)
      return false;
    }

    // Fallback to hardcoded data if DB is empty/unavailable
    return hardcodedIsRetired(staffName, storeName, month);
  }

  // Sync DB status to the global newBadge.ts isRetiredStaff function
  useEffect(() => {
    if (statusMap.size > 0) {
      const retiredMap = new Map<string, { status: "active" | "retired"; retiredMonth: string | null }>();
      for (const [key, record] of Array.from(statusMap.entries())) {
        retiredMap.set(key, { status: record.status, retiredMonth: record.retiredMonth });
      }
      setRetiredStaffMap(retiredMap);
    }
    return () => {
      // Cleanup on unmount (revert to hardcoded fallback)
      setRetiredStaffMap(null);
    };
  }, [statusMap]);

  return {
    statuses: query.data || [],
    statusMap,
    isRetired,
    loading: query.isLoading,
    refetch: query.refetch,
  };
}

/**
 * StaffStatusProvider — App最上位で呼び出し、
 * DBのスタッフステータスをnewBadge.tsのisRetiredStaffに注入する。
 * レンダリングはnull（非表示コンポーネント）。
 */
export function StaffStatusProvider() {
  useStaffStatus(); // This triggers the useEffect that syncs to newBadge.ts
  return null;
}

// ─── Hardcoded fallback (same as original newBadge.ts) ───

function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * 退社スタッフの内蔵表は newBadge.ts の RETIRED_STAFF に一本化した（2026-08-18）。
 * 以前はここにも別表があり、実際に中身がズレていた（池内・満川・佐々木が欠落）。
 * DB が空のときだけ呼ばれるので、newBadge 側もフォールバック経路に入る（循環しない）。
 */
function hardcodedIsRetired(staffName: string, storeName?: string, month?: string): boolean {
  return isRetiredStaff(staffName, storeName, month);
}
