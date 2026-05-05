/**
 * StoreDataProvider — DB店舗マスタデータを各フックのmodule-level setterに注入する
 *
 * useStoresフックからDBデータが読み込まれた時に:
 * - setReportAliasMap → useMonthlyReport.tsの正規化マッピングを更新
 * - setSalonBoardSheetMap → useSalonBoardData.tsのシートマッピングを更新
 * - setFankuruAliasMap → useFankuruData.tsの正規化マッピングを更新
 *
 * App.tsxの上位に配置し、子コンポーネントがフックを使う前にデータを注入する。
 */
import { useEffect } from "react";
import { useStores } from "@/hooks/useStores";
import { setReportAliasMap } from "@/hooks/useMonthlyReport";
import { setSalonBoardSheetMap } from "@/hooks/useSalonBoardData";
import { setFankuruAliasMap } from "@/hooks/useFankuruData";

export function StoreDataProvider({ children }: { children: React.ReactNode }) {
  const { reportAliasMap, salonBoardSheetMap, fankuruAliasMap } = useStores();

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

  return <>{children}</>;
}
