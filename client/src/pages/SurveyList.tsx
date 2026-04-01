/**
 * Design: Atelier Blanc — クリーンアトリエ
 * Page: 顧客アンケート一覧（店舗リンク一覧）
 * Colors: Warm white base, monet water-blue accent
 */
import { useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  ClipboardList, MapPin, ChevronRight, BarChart3, Star, MessageSquare
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useMonthlyReport } from "@/hooks/useMonthlyReport";
import { useNpsData, filterByMonth, getAvailableMonths } from "@/hooks/useNpsData";
import { useFankuruData } from "@/hooks/useFankuruData";
import { getNpsClass } from "@/lib/npsClass";
import { isNewStore } from "@/lib/newBadge";

// エリア定義
const AREA_STORES: { area: string; stores: string[] }[] = [
  { area: "大阪エリア", stores: ["堀江院", "堀江院2nd", "福島院", "高槻院"] },
  { area: "福岡エリア", stores: ["姪浜院"] },
  { area: "広島エリア", stores: ["楽々園院"] },
];

// 店舗カード
function StoreCard({ storeName }: { storeName: string }) {
  const { records: npsRecords } = useNpsData();
  const { rawData } = useMonthlyReport();
  const { pdfs: fankuruPdfs, hasFolderMapping } = useFankuruData(storeName);

  // 最新月のNPSデータ
  const latestMonth = useMemo(() => {
    const months = getAvailableMonths(npsRecords);
    return months[0] || "";
  }, [npsRecords]);

  const storeNps = useMemo(() => {
    const filtered = filterByMonth(npsRecords, latestMonth).filter(r => r.storeShort === storeName);
    if (filtered.length === 0) return null;
    const total = filtered.length;
    const promoters = filtered.filter(r => r.npsScore >= 9).length;
    const detractors = filtered.filter(r => r.npsScore <= 6).length;
    const npsScore = Math.round(((promoters - detractors) / total) * 100);
    return { total, npsScore };
  }, [npsRecords, latestMonth, storeName]);

  // ファンくるコメント件数（月末報告書から）
  const fankuruCommentCount = useMemo(() => {
    return rawData.filter(r => 
      r.storeNormalized === storeName && 
      r.fankuruComment && 
      r.fankuruComment.trim() !== "" && 
      r.fankuruComment.trim() !== "なし"
    ).length;
  }, [rawData, storeName]);

  // ファンくるPDF件数
  const fankuruPdfCount = fankuruPdfs.length;

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
                {!hasFolderMapping && fankuruCommentCount === 0 && (
                  <span className="text-xs text-muted-foreground/50">ファンくる未設定</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {storeNps && npsClass && (
              <div className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1" style={{ backgroundColor: `${npsClass.color}12` }}>
                <span className="font-mono text-sm font-bold" style={{ color: npsClass.color }}>
                  {storeNps.npsScore > 0 ? "+" : ""}{storeNps.npsScore}
                </span>
                <span className="text-[10px] font-semibold" style={{ color: npsClass.color }}>
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
  const { loading: monthlyLoading } = useMonthlyReport();
  const { loading: npsLoading, lastUpdated, refresh } = useNpsData();

  const loading = monthlyLoading || npsLoading;

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
        {/* ヘッダー */}
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            顧客アンケート一覧
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            店舗を選択してNPS・ファンくる調査結果を確認
          </p>
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
        )}
      </div>
    </DashboardLayout>
  );
}
