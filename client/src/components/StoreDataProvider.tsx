/**
 * StoreDataProvider — DB店舗マスタデータ & スタッフ初登場月マップを各フックのmodule-level setterに注入する
 *
 * useStoresフックからDBデータが読み込まれた時に:
 * - setReportAliasMap → useMonthlyReport.tsの正規化マッピングを更新
 * - setSalonBoardSheetMap → useSalonBoardData.tsのシートマッピングを更新
 * - setFankuruAliasMap → useFankuruData.tsの正規化マッピングを更新
 *
 * useMonthlyReportのrawDataが読み込まれた時に:
 * - buildStaffFirstAppearanceMap → スタッフ初登場月マップを構築
 * - setStaffFirstAppearanceMap → newBadge.tsに注入（isNewStaff判定に使用）
 *
 * App.tsxの上位に配置し、子コンポーネントがフックを使う前にデータを注入する。
 */
import { useEffect } from "react";
import { useStores } from "@/hooks/useStores";
import { useMonthlyReport } from "@/hooks/useMonthlyReport";
import { setReportAliasMap } from "@/hooks/useMonthlyReport";
import { setSalonBoardSheetMap } from "@/hooks/useSalonBoardData";
import { setFankuruAliasMap, setStylistAliasMapFromDb } from "@/hooks/useFankuruData";
import { buildStaffFirstAppearanceMap, setStaffFirstAppearanceMap } from "@/lib/newBadge";
import { trpc } from "@/lib/trpc";

export function StoreDataProvider({ children }: { children: React.ReactNode }) {
  const { reportAliasMap, salonBoardSheetMap, fankuruAliasMap } = useStores();
  const { rawData } = useMonthlyReport();
  const stylistAliasQuery = trpc.admin.getStylistAliases.useQuery(undefined, {
    retry: 1,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (Object.keys(reportAliasMap).length > 0) {
      setReportAliasMap(reportAliasMap);
    }
  }, [reportAliasMap]);

  useEffect(() => {
    if (Object.keys(salonBoardSheetMap).length > 0) {
      setSalonBoardSheetMap(salonBoardSheetMap);
    }
  }, [salonBoardSheetMap]);

  useEffect(() => {
    if (Object.keys(fankuruAliasMap).length > 0) {
      setFankuruAliasMap(fankuruAliasMap);
    }
  }, [fankuruAliasMap]);

  // 月末報告書データからスタッフ初登場月マップを構築・注入
  useEffect(() => {
    if (rawData && rawData.length > 0) {
      const map = buildStaffFirstAppearanceMap(rawData);
      setStaffFirstAppearanceMap(map);
    }
  }, [rawData]);

  // DBスタイリストエイリアスをモジュールレベルに注入
  useEffect(() => {
    if (stylistAliasQuery.data && stylistAliasQuery.data.length > 0) {
      setStylistAliasMapFromDb(stylistAliasQuery.data);
    }
  }, [stylistAliasQuery.data]);

  return <>{children}</>;
}
