/**
 * Design: Atelier Blanc — クリーンアトリエ
 * Page: 顧客アンケート一覧（店舗リンク一覧）
 * Colors: Warm white base, monet water-blue accent
 */
import { useState, useMemo, createContext, useContext } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  ClipboardList, MapPin, ChevronRight, BarChart3, Star
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useMonthlyReport } from "@/hooks/useMonthlyReport";
import { useNpsData, getAvailableMonths } from "@/hooks/useNpsData";
import { useFankuruData } from "@/hooks/useFankuruData";
import { getNpsClass } from "@/lib/npsClass";
import { isNewStore } from "@/lib/newBadge";
import { PeriodSelector, getDefaultPeriodSelection, getFilterMonths, getPeriodLabel } from "@/components/PeriodSelector";
import type { PeriodSelection } from "@/components/PeriodSelector";

// エリア定義
const AREA_STORES: { area: string; stores: string[] }[] = [
  { area: "大阪エリア", stores: ["堀江院", "堀江院2nd", "福島院", "高槻院"] },
  { area: "福岡エリア", stores: ["姪浜院"] },
  { area: "広島エリア", stores: ["楽々園院"] },
];

// 期間フィルタのコンテキスト（StoreCardに渡すため）
const FilterContext = createContext<{ filterMonths: string[] | "all" }>({ filterMonths: "all" });

// 店舗カード
function StoreCard({ storeName }: { storeName: string }) {
  const { filterMonths } = useContext(FilterContext);
  const { records: npsRecords } = useNpsData();
  const { rawData } = useMonthlyReport();
  const { pdfs: fankuruPdfs } = useFankuruData(storeName);

  const isAllPeriod = filterMonths === "all";

  // NPSデータ（期間フィルタ連動）
  const storeNps = useMemo(() => {
    let filtered = npsRecords.filter(r => r.storeShort === storeName);
    if (!isAllPeriod) {
      filtered = filtered.filter(r => {
        if (!r.date) return false;
        const ym = r.date.substring(0, 7).replace(/\//g, "-");
        return (filterMonths as string[]).includes(ym);
      });
    }
    if (filtered.length === 0) return null;
    const total = filtered.length;
    const promoters = filtered.filter(r => r.npsScore >= 9).length;
    const detractors = filtered.filter(r => r.npsScore <= 6).length;
    const npsScore = Math.round(((promoters - detractors) / total) * 100);
    return { total, npsScore };
  }, [npsRecords, storeName, filterMonths, isAllPeriod]);

  // ファンくるコメント件数（月末報告書から — 期間フィルタ連動）
  const fankuruCommentCount = useMemo(() => {
    return rawData.filter(r => 
      r.storeNormalized === storeName && 
      (isAllPeriod || (filterMonths as string[]).includes(r.reportMonth)) &&
      r.fankuruComment && 
      r.fankuruComment.trim() !== "" && 
      r.fankuruComment.trim() !== "なし"
    ).length;
  }, [rawData, storeName, filterMonths, isAllPeriod]);

  // ファンくるPDF件数（期間フィルタ連動）
  const fankuruPdfCount = useMemo(() => {
    if (isAllPeriod) return fankuruPdfs.length;
    return fankuruPdfs.filter(p => (filterMonths as string[]).includes(p.yearMonth)).length;
  }, [fankuruPdfs, filterMonths, isAllPeriod]);

  const npsClass = storeNps ? getNpsClass(storeNps.npsScore) : null;

  return (
    <Link href={`/survey/${encodeURIComponent(storeName)}`}>
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="bg-card border border-border/50 rounded-xl p-4 hover:border-primary/30 hover:shadow-md transition-all cursor-pointer"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-base flex items-center gap-1.5">
                {storeName}
                {isNewStore(storeName) && (
                  <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1 py-0.5 leading-none">NEW</span>
                )}
              </h3>
              <div className="flex items-center gap-3 mt-1">
                {storeNps && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <BarChart3 className="w-3 h-3" />
                    NPS {storeNps.total}件
                  </span>
                )}
                {(fankuruPdfCount > 0 || fankuruCommentCount > 0) && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-500" />
                    ファンくる {fankuruPdfCount > 0 ? `${fankuruPdfCount}件` : `${fankuruCommentCount}件`}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {storeNps && npsClass && (
              <div className="flex flex-col items-center whitespace-nowrap rounded-xl px-3 py-1.5" style={{ backgroundColor: `${npsClass.color}10` }}>
                <span className="text-[9px] text-muted-foreground leading-none">NPSスコア</span>
                <span className="font-mono text-lg font-bold leading-tight" style={{ color: npsClass.color }}>
                  {storeNps.npsScore > 0 ? "+" : ""}{storeNps.npsScore}
                </span>
                <span className="text-[9px] font-semibold leading-none" style={{ color: npsClass.color }}>
                  {npsClass.label}
                </span>
              </div>
            )}
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export default function SurveyList() {
  const { records, loading: npsLoading, lastUpdated, refresh } = useNpsData();
  const { loading: monthlyLoading, availableMonths: reportMonths } = useMonthlyReport();
  const loading = npsLoading || monthlyLoading;

  // 全ページ共通の期間セレクタ用月リスト
  const npsMonths = useMemo(() => getAvailableMonths(records), [records]);
  const allMonths = useMemo(() => {
    const set = new Set([...npsMonths, ...reportMonths]);
    return Array.from(set).sort().reverse();
  }, [npsMonths, reportMonths]);

  const [periodSelection, setPeriodSelection] = useState<PeriodSelection>(getDefaultPeriodSelection());
  const filterMonths = useMemo(() => getFilterMonths(periodSelection, allMonths), [periodSelection, allMonths]);

  const breadcrumbs = [
    { label: "ホーム", href: "/" },
    { label: "顧客アンケート一覧" },
  ];

  return (
    <DashboardLayout
      breadcrumbs={breadcrumbs}
      lastUpdated={lastUpdated ?? undefined}
      onRefresh={refresh}
      loading={loading}
    >
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* ヘッダー + 期間セレクタ */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              顧客アンケート一覧
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              店舗を選択してNPS・ファンくる調査結果を確認
              <span className="ml-1 text-xs">— {getPeriodLabel(periodSelection)}</span>
            </p>
          </div>
          <PeriodSelector allMonths={allMonths} selection={periodSelection} onChange={setPeriodSelection} />
        </div>

        {/* ローディング */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">データを読み込み中...</span>
            </div>
          </div>
        )}

        {/* エリア別店舗一覧 */}
        {!loading && (
          <FilterContext.Provider value={{ filterMonths }}>
            <div className="space-y-6">
              {AREA_STORES.map(({ area, stores }) => (
                <div key={area}>
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-4 h-4 text-primary" />
                    <h2 className="font-semibold text-sm text-foreground">{area}</h2>
                    <span className="text-xs text-muted-foreground">{stores.length}店舗</span>
                  </div>
                  <div className="space-y-2">
                    {stores.map(store => (
                      <StoreCard key={store} storeName={store} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </FilterContext.Provider>
        )}
      </div>
    </DashboardLayout>
  );
}
