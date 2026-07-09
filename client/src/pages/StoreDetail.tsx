/*
 * Design: Atelier Blanc — クリーンアトリエ
 * Page: 店舗詳細（売上情報・在籍スタッフ・ファンくる調査・NPS調査結果）
 * Colors: Warm white base, monet water-blue accent, sage green secondary
 */
import { useParams, Link } from "wouter";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  MapPin, Users, TrendingUp, BarChart3, ArrowRight,
  DollarSign, Scissors, Star, MessageSquare, ChevronDown,
  Trophy, ThumbsUp, Target, AlertTriangle, AlertCircle,
  Lightbulb, CheckCircle2, ArrowUpRight,
  FileText, ExternalLink, Loader2, FolderOpen, Eye,
  CircleCheck, Sparkles
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PeriodSelector, getDefaultPeriodSelection, getFilterMonths, getPeriodLabel } from "@/components/PeriodSelector";
import type { PeriodSelection } from "@/components/PeriodSelector";
import ScoreDetailModal from "@/components/ScoreDetailModal";
import DashboardLayout from "@/components/DashboardLayout";
import { useNpsData, calculateStoreStats, getAvailableMonths } from "@/hooks/useNpsData";
import type { NpsRecord, StoreStats } from "@/hooks/useNpsData";
import { getNpsClass, NPS_INDUSTRY_AVERAGE } from "@/lib/npsClass";
import { generateStoreAdvice } from "@/lib/npsAdvice";
import type { NpsAdvice } from "@/lib/npsAdvice";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { useFankuruData } from "@/hooks/useFankuruData";
import { isNewStaff, isRetiredStaff } from "@/lib/newBadge";
import { useStores } from "@/hooks/useStores";
import { calculateUtilizationRate } from "@/lib/utilizationRate";
import { calculateCompositeScore, getCompositeRank } from "@/lib/compositeScore";
import type { CompositeScoreResult } from "@/lib/compositeScore";
import type { FankuruPdf } from "@/hooks/useFankuruData";
import { useMonthlyReport } from "@/hooks/useMonthlyReport";
import { useSalonBoardData } from "@/hooks/useSalonBoardData";
import { useSalonBoardStylistData } from "@/hooks/useSalonBoardStylistData";
import type { StaffReport } from "@/hooks/useMonthlyReport";
import { validateStoreReport, getAlertSummary } from "@/lib/reportValidation";
import type { ReportAlert } from "@/lib/reportValidation";

const NPS_HEADER_IMAGE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663489426081/aLPZvLfFDC4rFYToBquZNR/nps-header-6cTohzoTSmSjrDCLc4VzHg.webp";

const formatCurrency = (n: number) => {
  return `¥${n.toLocaleString()}`;
};

const NPS_COLORS = {
  promoter: "#2D9C8F",
  passive: "#E5B85C",
  detractor: "#C75C5C",
};

function NpsGauge({ score, size = "lg" }: { score: number; size?: "sm" | "lg" }) {
  const npsClass = getNpsClass(score);
  const sizeClass = size === "lg" ? "w-28 h-28" : "w-16 h-16";
  const textClass = size === "lg" ? "text-3xl" : "text-lg";

  return (
    <div className="flex flex-col items-center">
      <div className={`${sizeClass} rounded-full border-4 flex items-center justify-center`} style={{ borderColor: npsClass.color }}>
        <div className="text-center">
          <div className={`font-mono-data ${textClass} font-bold`} style={{ color: npsClass.color }}>
            {score > 0 ? "+" : ""}{score}
          </div>
          {size === "lg" && <div className="text-[10px] text-muted-foreground uppercase tracking-wider">NPS</div>}
        </div>
      </div>
      {size === "lg" && (
        <div className="mt-2 flex flex-col items-center gap-1">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ color: npsClass.color, backgroundColor: npsClass.bgColor, border: `1px solid ${npsClass.borderColor}` }}
          >
            {npsClass.label}
          </span>
          <span className="text-[10px] text-muted-foreground">
            業界平均: {NPS_INDUSTRY_AVERAGE}
          </span>
        </div>
      )}
    </div>
  );
}

function CategoryAnalysis({ records, field, label }: { records: NpsRecord[]; field: keyof NpsRecord; label: string }) {
  const analysis = useMemo(() => {
    const counts: Record<string, number> = {};
    records.forEach((r) => {
      const val = r[field] as string;
      if (!val) return;
      // Split multiple selections
      val.split(",").forEach((v) => {
        const trimmed = v.trim();
        if (trimmed) {
          counts[trimmed] = (counts[trimmed] || 0) + 1;
        }
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value, pct: Math.round((value / records.length) * 100) }));
  }, [records, field]);

  if (analysis.length === 0) return null;

  return (
    <div>
      <h4 className="text-sm font-medium text-foreground mb-3">{label}</h4>
      <div className="space-y-2">
        {analysis.map((item) => (
          <div key={item.name} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground truncate">{item.name}</span>
                <span className="text-xs font-mono-data text-foreground ml-2">{item.pct}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/60 transition-all duration-500"
                  style={{ width: `${item.pct}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const ADVICE_ICONS = {
  trophy: Trophy,
  thumbsUp: ThumbsUp,
  target: Target,
  alertTriangle: AlertTriangle,
  alertCircle: AlertCircle,
};

function AdviceSection({ stats, records }: { stats: StoreStats; records: NpsRecord[] }) {
  const advice = useMemo(() => generateStoreAdvice(stats, records), [stats, records]);
  const npsClass = getNpsClass(stats.npsScore);
  const IconComponent = ADVICE_ICONS[advice.icon];

  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
        <Lightbulb className="w-5 h-5 text-[#E5B85C]" />
        総合アドバイス
      </h2>
      <Card className="border-border/50 shadow-sm overflow-hidden">
        {/* Summary Banner */}
        <div className="px-5 py-4 flex items-start gap-3" style={{ backgroundColor: npsClass.bgColor }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: npsClass.color + "18" }}>
            <IconComponent className="w-5 h-5" style={{ color: npsClass.color }} />
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">{advice.summary}</p>
        </div>

        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Strengths */}
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <CheckCircle2 className="w-4 h-4 text-[#2D9C8F]" />
                <h4 className="text-sm font-semibold text-foreground">強み</h4>
              </div>
              <ul className="space-y-2">
                {advice.strengths.map((s, i) => (
                  <li key={i} className="text-xs text-muted-foreground leading-relaxed flex gap-2">
                    <span className="w-1 h-1 rounded-full bg-[#2D9C8F] mt-1.5 shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            {/* Improvements */}
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <Target className="w-4 h-4 text-[#E5B85C]" />
                <h4 className="text-sm font-semibold text-foreground">改善ポイント</h4>
              </div>
              <ul className="space-y-2">
                {advice.improvements.map((s, i) => (
                  <li key={i} className="text-xs text-muted-foreground leading-relaxed flex gap-2">
                    <span className="w-1 h-1 rounded-full bg-[#E5B85C] mt-1.5 shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            {/* Action Items */}
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <ArrowUpRight className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-semibold text-foreground">アクションプラン</h4>
              </div>
              <ul className="space-y-2">
                {advice.actionItems.map((s, i) => (
                  <li key={i} className="text-xs text-muted-foreground leading-relaxed flex gap-2">
                    <span className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export default function StoreDetail() {
  const params = useParams<{ storeId: string }>();
  const storeId = decodeURIComponent(params.storeId || "");
  const { npsAliasMap, isNewStore } = useStores();
  const { records, loading: npsLoading, error: npsError, lastUpdated, refresh } = useNpsData(npsAliasMap);
  const { rawData, loading: reportLoading, error: reportError, getStoreMonthlyStats, availableMonths: reportMonths } = useMonthlyReport();
  const { loading: sbLoading, error: sbError, getStoreMonth, getStoreMonthsAggregated, hasData: hasSbData } = useSalonBoardData();
  const { getStylistMonth: getSbStylistMonth } = useSalonBoardStylistData();
  const loading = npsLoading || reportLoading || sbLoading;
  const error = npsError || reportError || sbError;
  const allNpsMonths = useMemo(() => getAvailableMonths(records), [records]);
  const { availableMonths: sbMonths } = useSalonBoardData();
  const allMonths = useMemo(() => {
    const set = new Set([...allNpsMonths, ...reportMonths, ...sbMonths]);
    return Array.from(set).sort().reverse();
  }, [allNpsMonths, reportMonths, sbMonths]);
  const [periodSelection, setPeriodSelection] = useState<PeriodSelection>(getDefaultPeriodSelection());

  /** 選択された期間に含まれる月リスト（"all" = 全期間） */
  const activeFilterMonths = useMemo(
    () => getFilterMonths(periodSelection, allMonths),
    [periodSelection, allMonths]
  );


  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [selectedPdf, setSelectedPdf] = useState<FankuruPdf | null>(null);
  const { pdfs: fankuruPdfs, loading: fankuruLoading, hasFolderMapping } = useFankuruData(storeId);

  // ファンくるPDFを選択月でフィルタリング
  const filteredFankuruPdfs = useMemo(() => {
    if (activeFilterMonths === "all") return fankuruPdfs;
    return fankuruPdfs.filter(p => activeFilterMonths.includes(p.yearMonth));
  }, [fankuruPdfs, activeFilterMonths]);

  const storeRecords = useMemo(() => {
    const filtered = records.filter((r: any) => r.storeShort === storeId);
    if (activeFilterMonths === "all") return filtered;
    return filtered.filter((r: any) => {
      const d = new Date(r.date);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return activeFilterMonths.includes(ym);
    });
  }, [records, storeId, activeFilterMonths]);

  const storeStats = useMemo(() => {
    if (storeRecords.length === 0) return null;
    const stats = calculateStoreStats(storeRecords);
    return stats.find((s) => s.shortName === storeId) || null;
  }, [storeRecords, storeId]);


  const scoreDistribution = useMemo(() => {
    const dist: Record<number, number> = {};
    for (let i = 0; i <= 10; i++) dist[i] = 0;
    storeRecords.forEach((r) => {
      if (r.npsScore >= 0 && r.npsScore <= 10) dist[r.npsScore]++;
    });
    return Object.entries(dist).map(([score, count]) => ({
      score: parseInt(score),
      count,
      fill: parseInt(score) >= 9 ? NPS_COLORS.promoter : parseInt(score) >= 7 ? NPS_COLORS.passive : NPS_COLORS.detractor,
    }));
  }, [storeRecords]);

  const pieData = useMemo(() => {
    if (!storeStats) return [];
    return [
      { name: "推奨者 (9-10)", value: storeStats.promoters, fill: NPS_COLORS.promoter },
      { name: "中立者 (7-8)", value: storeStats.passives, fill: NPS_COLORS.passive },
      { name: "批判者 (0-6)", value: storeStats.detractors, fill: NPS_COLORS.detractor },
    ];
  }, [storeStats]);

  // 月末報告書の実データ—選択月リストを使って正確にフィルタリング
  const selectedMonthsList = useMemo(() => {
    if (activeFilterMonths === "all") return undefined;
    return activeFilterMonths;
  }, [activeFilterMonths]);

  const activeMonth = useMemo(() => {
    if (!selectedMonthsList) return undefined;
    if (selectedMonthsList.length === 1) return selectedMonthsList[0];
    return undefined;
  }, [selectedMonthsList]);

  const reportStats = useMemo(() => {
    if (!selectedMonthsList) {
      // 全期間
      return getStoreMonthlyStats(storeId, undefined);
    } else if (selectedMonthsList.length === 1) {
      // 単月
      return getStoreMonthlyStats(storeId, selectedMonthsList[0]);
    } else {
      // 複数月: 各月ごとに取得して合算
      const monthReports = selectedMonthsList
        .map(m => getStoreMonthlyStats(storeId, m))
        .filter((r): r is NonNullable<typeof r> => r !== null);
      if (monthReports.length === 0) return null;
      const totalTechSales = monthReports.reduce((s, r) => s + r.totalTechSales, 0);
      const totalRetailSales = monthReports.reduce((s, r) => s + r.totalRetailSales, 0);
      const totalSales = totalTechSales + totalRetailSales;
      const totalNewCustomers = monthReports.reduce((s, r) => s + r.totalNewCustomers, 0);
      const totalReturnCustomers = monthReports.reduce((s, r) => s + r.totalReturnCustomers, 0);
      const totalCustomers = totalNewCustomers + totalReturnCustomers;
      const avgUnitPrice = totalCustomers > 0 ? Math.round(totalSales / totalCustomers) : 0;
      const totalNextReservation = monthReports.reduce((s, r) => s + (r.totalNextReservation || 0), 0);
      const nextReservationRate = totalCustomers > 0 ? Math.round((totalNextReservation / totalCustomers) * 1000) / 10 : 0;
      return {
        ...monthReports[0],
        totalSales, totalTechSales, totalRetailSales,
        totalCustomers, totalNewCustomers, totalReturnCustomers,
        avgUnitPrice, totalNextReservation, nextReservationRate,
        staffCount: monthReports.reduce((s, r) => s + r.staffCount, 0),
        monthLabel: "",
      };
    }
  }, [getStoreMonthlyStats, storeId, selectedMonthsList]);

  // 異常値検出
  const reportAlerts = useMemo(() => validateStoreReport(reportStats), [reportStats]);
  const alertSummary = useMemo(() => getAlertSummary(reportAlerts), [reportAlerts]);
  const [showAlerts, setShowAlerts] = useState(false);

  const formatMonth = (ym: string) => {
    const [y, m] = ym.split("-");
    return `${y}年${parseInt(m)}月`;
  };

  return (
    <DashboardLayout
      breadcrumbs={[{ label: storeId }]}
      lastUpdated={lastUpdated}
      onRefresh={refresh}
      loading={loading}
    >
      {/* Store Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <MapPin className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
                {storeId}
                {isNewStore(storeId) && (
                  <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1 py-0.5 leading-none">NEW</span>
                )}
              </h1>
              <p className="text-xs text-muted-foreground">monet 白髪染めと髪質改善のサロン</p>
            </div>
          </div>
        </div>

        {/* Period Selector */}
        <PeriodSelector
          allMonths={allMonths}
          selection={periodSelection}
          onChange={setPeriodSelection}
        />
      </div>

      {/* 入力値異常アラート */}
      {reportAlerts.length > 0 && (
        <section className="mb-6">
          <button
            onClick={() => setShowAlerts(!showAlerts)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors hover:bg-accent/30"
            style={{
              borderColor: alertSummary.errors > 0 ? '#ef4444' : alertSummary.warnings > 0 ? '#f59e0b' : '#3b82f6',
              backgroundColor: alertSummary.errors > 0 ? '#fef2f2' : alertSummary.warnings > 0 ? '#fffbeb' : '#eff6ff',
            }}
          >
            <AlertTriangle
              className="w-5 h-5 shrink-0"
              style={{ color: alertSummary.errors > 0 ? '#ef4444' : alertSummary.warnings > 0 ? '#f59e0b' : '#3b82f6' }}
            />
            <div className="flex-1 text-left">
              <span className="text-sm font-bold" style={{ color: alertSummary.errors > 0 ? '#dc2626' : alertSummary.warnings > 0 ? '#d97706' : '#2563eb' }}>
                月末報告書の入力値に{reportAlerts.length}件の注意点があります
              </span>
              <span className="text-xs text-muted-foreground ml-2">
                {alertSummary.errors > 0 && `エラー${alertSummary.errors}件`}
                {alertSummary.errors > 0 && alertSummary.warnings > 0 && " / "}
                {alertSummary.warnings > 0 && `警告${alertSummary.warnings}件`}
                {(alertSummary.errors > 0 || alertSummary.warnings > 0) && alertSummary.infos > 0 && " / "}
                {alertSummary.infos > 0 && `情報${alertSummary.infos}件`}
              </span>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showAlerts ? 'rotate-180' : ''}`} />
          </button>

          {showAlerts && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 space-y-2"
            >
              {reportAlerts.map((alert, i) => (
                <div
                  key={`${alert.staffName}-${alert.field}-${i}`}
                  className="flex items-start gap-3 px-4 py-3 rounded-lg border text-sm"
                  style={{
                    borderColor: alert.severity === 'error' ? '#fecaca' : alert.severity === 'warning' ? '#fde68a' : '#bfdbfe',
                    backgroundColor: alert.severity === 'error' ? '#fef2f2' : alert.severity === 'warning' ? '#fffbeb' : '#eff6ff',
                  }}
                >
                  {alert.severity === 'error' ? (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                  ) : alert.severity === 'warning' ? (
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                  ) : (
                    <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-foreground">{alert.staffName}</span>
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{
                          color: alert.severity === 'error' ? '#dc2626' : alert.severity === 'warning' ? '#d97706' : '#2563eb',
                          backgroundColor: alert.severity === 'error' ? '#fee2e2' : alert.severity === 'warning' ? '#fef3c7' : '#dbeafe',
                        }}
                      >
                        {alert.severity === 'error' ? 'エラー' : alert.severity === 'warning' ? '警告' : '情報'}
                      </span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{alert.message}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </section>
      )}

      {/* 店舗内月間表彰セクション — 総合点ランキング */}
      {(() => {
        // この店舗のスタッフのみフィルタ
        const storeRawData = rawData.filter(r => r.storeNormalized === storeId);
        if (storeRawData.length === 0 || loading) return null;

        let filtered: typeof storeRawData;
        if (activeFilterMonths === "all") {
          const map = new Map<string, typeof storeRawData[0]>();
          for (const r of storeRawData) {
            const existing = map.get(r.name);
            if (!existing || r.reportMonth > existing.reportMonth) {
              map.set(r.name, r);
            }
          }
          filtered = Array.from(map.values());
        } else if (activeFilterMonths.length === 1) {
          filtered = storeRawData.filter(r => r.reportMonth === activeFilterMonths[0]);
        } else {
          const monthSet = new Set(activeFilterMonths);
          const inRange = storeRawData.filter(r => monthSet.has(r.reportMonth));
          const map = new Map<string, typeof storeRawData[0]>();
          for (const r of inRange) {
            const existing = map.get(r.name);
            if (!existing || r.reportMonth > existing.reportMonth) {
              map.set(r.name, r);
            }
          }
          filtered = Array.from(map.values());
        }

        // スタッフごとに総合点を計算
        const staffScores = filtered
          .filter(r => !isRetiredStaff(r.name, r.storeNormalized, r.reportMonth))
          .map(r => {
            const utilRate = calculateUtilizationRate(r.totalCustomers, r.employmentType);
            // NPS: storeRecordsからスタッフ名でフィルタ（スペース正規化して比較）
            const normName = r.name.replace(/[\s\u3000]/g, "").toLowerCase();
            const staffNpsRecords = storeRecords.filter((nr: any) => {
              const nrStaff = nr.staff?.trim();
              return nrStaff && nrStaff.replace(/[\s\u3000]/g, "").toLowerCase() === normName;
            });
            let npsScore: number | null = null;
            let npsResponseCount = 0;
            if (staffNpsRecords.length > 0) {
              npsResponseCount = staffNpsRecords.length;
              const promoters = staffNpsRecords.filter((nr: any) => nr.npsScore >= 9).length;
              const detractors = staffNpsRecords.filter((nr: any) => nr.npsScore <= 6).length;
              npsScore = Math.round(((promoters - detractors) / npsResponseCount) * 100);
            }

            const scoreResult = calculateCompositeScore({
              npsScore,
              npsResponseCount,
              nextReservationRate: r.nextReservationRate,
              utilizationRate: utilRate,
            });

            return {
              name: r.name,
              store: r.storeNormalized,
              score: scoreResult.total,
              rank: scoreResult.rank,
            };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);

        if (staffScores.length === 0) return null;

        return (
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-sm">
                <Trophy className="w-3 h-3 text-white" />
              </div>
              <h2 className="text-base font-bold text-foreground">月間表彰</h2>
              <span className="text-[10px] text-muted-foreground">総合点TOP5（{getPeriodLabel(periodSelection)}）</span>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-50/40 via-yellow-50/20 to-amber-50/40 rounded-xl" />
              <div className="relative border border-amber-200/50 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span className="font-bold text-xs text-foreground">総合点ランキング</span>
                </div>
                <div className="space-y-0.5">
                  {staffScores.map((staff, i) => (
                    <Link key={`award-${staff.name}`} href={`/staff/${encodeURIComponent(staff.store)}/${encodeURIComponent(staff.name)}`}>
                      <div className="flex items-center gap-1.5 py-1 px-1.5 rounded-md hover:bg-amber-100/40 transition-colors cursor-pointer group">
                        <span className={`w-4 text-[10px] font-bold text-center shrink-0 ${i === 0 ? "text-amber-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-700" : "text-muted-foreground"}`}>{i + 1}</span>
                        <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors truncate flex-1">{staff.name}</span>
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-600 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300/80 rounded-full px-1.5 py-px shadow-sm shrink-0">
                          {i === 0 && <Trophy className="w-2 h-2 text-amber-500" />}
                          {staff.score}点
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* スタッフ総合点ランキング */}
      {reportStats && reportStats.staffReports.length > 0 && (() => {
        const rankings = reportStats.staffReports
          .filter((sr: StaffReport) => !isRetiredStaff(sr.name, storeId, sr.reportMonth))
          .map((sr: StaffReport) => {
            const utilRate = calculateUtilizationRate(sr.totalCustomers, sr.employmentType);
            // NPS: storeRecordsからスタッフ名でフィルタ（スペース正規化して比較）
            const normSrName = sr.name.replace(/[\s\u3000]/g, "").toLowerCase();
            const staffNpsRecords = storeRecords.filter((r: any) => {
              const staffName = r.staff?.trim();
              return staffName && staffName.replace(/[\s\u3000]/g, "").toLowerCase() === normSrName;
            });
            let npsScore: number | null = null;
            let npsResponseCount = 0;
            if (staffNpsRecords.length > 0) {
              npsResponseCount = staffNpsRecords.length;
              const promoters = staffNpsRecords.filter((r: any) => r.npsScore >= 9).length;
              const detractors = staffNpsRecords.filter((r: any) => r.npsScore <= 6).length;
              npsScore = Math.round(((promoters - detractors) / npsResponseCount) * 100);
            }

            const scoreResult = calculateCompositeScore({
              npsScore,
              npsResponseCount,
              nextReservationRate: sr.nextReservationRate,
              utilizationRate: utilRate,
            });
            return { staff: sr, scoreResult };
          })
          .sort((a, b) => b.scoreResult.total - a.scoreResult.total);

        if (rankings.length === 0) return null;

        return (
          <section className="mb-8 pt-6 border-t-2 border-primary/20">
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              スタッフ総合点ランキング
            </h2>
            <div className="space-y-2">
              {rankings.map(({ staff: sr, scoreResult }, i) => (
                <motion.div key={sr.answerId || i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}>
                  <Link href={`/staff/${encodeURIComponent(storeId)}/${encodeURIComponent(sr.name)}`}>
                    <Card className="border-border/50 shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group">
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-center gap-3">
                          {/* ランク番号 */}
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${
                            i === 0 ? "bg-amber-100 text-amber-700 border border-amber-300" :
                            i === 1 ? "bg-gray-100 text-gray-600 border border-gray-300" :
                            i === 2 ? "bg-orange-50 text-orange-600 border border-orange-200" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {i + 1}
                          </div>
                          {/* アバター */}
                          {sr.photoUrl2 ? (
                            <img src={sr.photoUrl2} alt={sr.name} className="w-9 h-9 rounded-full object-cover object-center shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-primary font-bold text-sm">{sr.name.charAt(0)}</span>
                            </div>
                          )}
                          {/* 名前 */}
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{sr.name}</span>
                            <div className="text-[10px] text-muted-foreground">{sr.employmentType}</div>
                          </div>
                          {/* スコアバッジ */}
                          <div className="flex flex-col items-end gap-0.5 shrink-0">
                            <span
                              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono-data font-bold border"
                              style={{ backgroundColor: scoreResult.rank.bgColor, color: scoreResult.rank.color, borderColor: scoreResult.rank.borderColor }}
                            >
                              {scoreResult.total}点
                            </span>
                            <span className="text-[9px] font-medium" style={{ color: scoreResult.rank.color }}>
                              {scoreResult.rank.label}
                            </span>
                          </div>
                          {/* アロー */}
                          <ChevronDown className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity -rotate-90 shrink-0" />
                        </div>
                        {/* スコア内訳（コンパクト） */}
                        <div className="flex items-center gap-2 mt-2 ml-10 flex-wrap">
                          {scoreResult.available.nps && (
                            <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">NPS {scoreResult.rawValues.npsScore! > 0 ? "+" : ""}{scoreResult.rawValues.npsScore}</span>
                          )}
                          {scoreResult.available.reservation && (
                            <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">予約率 {scoreResult.rawValues.nextReservationRate!.toFixed(1)}%</span>
                          )}
                          {scoreResult.available.utilization && (
                            <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">稼働率 {scoreResult.rawValues.utilizationRate!.toFixed(1)}%</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>
        );
      })()}

      {/* スタッフ個人実績 */}
      <section className="mb-8 pt-6 border-t-2 border-primary/20">
        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          スタッフ個人実績
          {reportStats && (
            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-2">{reportStats.staffCount}名</span>
          )}
        </h2>
        {reportStats && reportStats.staffReports.length > 0 ? (
          <div className="grid gap-3">
            {reportStats.staffReports.map((sr: StaffReport, i: number) => {
              // 実績はサロンボード優先（無ければ月末報告書）。新規はサロンボードのみ（無ければ0）。
              const sb = getSbStylistMonth(sr.storeNormalized, sr.name, sr.reportMonth);
              const m = {
                totalSales: sb ? sb.sales : sr.totalSales,
                totalCustomers: sb ? sb.customers : sr.totalCustomers,
                unitPrice: sb ? sb.unitPrice : sr.unitPrice,
                newCustomers: sb ? sb.newCustomers : 0,
                returnCustomers: sb ? sb.returnCustomers : sr.returnCustomers,
                retailSales: sb ? sb.retailSales : sr.retailSales,
              };
              return (
              <motion.div key={sr.answerId || i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.03 }}>
                <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-3 sm:w-48 shrink-0">
                        {sr.photoUrl2 ? (
                          <img src={sr.photoUrl2} alt={sr.name} className="w-10 h-10 rounded-full object-cover object-center shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-primary font-bold text-sm">{sr.name.charAt(0)}</span>
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-sm text-foreground flex items-center gap-1.5">
                            {sr.name}
                            {isNewStaff(sr.name, storeId) && (
                              <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1 py-0.5 leading-none">NEW</span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground">{sr.employmentType}</div>
                        </div>
                      </div>
                      <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <div>
                          <div className="text-[10px] text-muted-foreground">総売上</div>
                          <div className="font-mono-data text-sm font-bold">{formatCurrency(m.totalSales)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground">客単価</div>
                          <div className="font-mono-data text-sm font-bold">{formatCurrency(m.unitPrice)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground">総客数</div>
                          <div className="font-mono-data text-sm font-bold">{m.totalCustomers}名</div>
                          <div className="text-[9px] text-muted-foreground/70">新規{m.newCustomers} / 再来{m.returnCustomers}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground">次回予約率</div>
                          <div className="font-mono-data text-sm font-bold flex items-center gap-1">
                            <span className={sr.nextReservationRate >= 85 ? "text-[#2D9C8F]" : sr.nextReservationRate >= 70 ? "text-[#E5B85C]" : "text-[#C75C5C]"}>
                              {sr.nextReservationRate}%
                            </span>
                            {sr.nextReservationRate <= 69 && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-1 py-0.5" title="要改善">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                要改善
                              </span>
                            )}
                            {sr.nextReservationRate >= 85 && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-600 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300 rounded-full px-1.5 py-0.5 shadow-sm">
                                <Trophy className="w-2.5 h-2.5 text-amber-500" />
                                <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                              </span>
                            )}
                            {sr.nextReservationRate >= 70 && sr.nextReservationRate <= 84 && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-[#E5B85C] bg-amber-50/60 border border-amber-200/60 rounded-full px-1.5 py-0.5">
                                <CircleCheck className="w-2.5 h-2.5 text-[#E5B85C]" />
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground">店販売上</div>
                          <div className="font-mono-data text-sm font-bold">{formatCurrency(m.retailSales)}</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
              );
            })}
          </div>
        ) : (
          <Card className="border-border/50 border-dashed">
            <CardContent className="p-6 text-center text-muted-foreground">
              <Users className="w-6 h-6 mx-auto mb-2 opacity-40" />
              <p className="text-sm">この期間のスタッフ実績データはありません</p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* NPS Survey Results */}
      <section className="mb-8 pt-6 border-t-2 border-[#2D9C8F]/20">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#2D9C8F]" />
            NPS調査結果
            <span className="text-xs font-normal text-muted-foreground">— {getPeriodLabel(periodSelection)}</span>
          </h2>
          <Link href={`/store/${encodeURIComponent(storeId)}/nps`}>
            <span className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors cursor-pointer">
              詳細を見る
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-border/50 animate-pulse">
                <CardContent className="p-6"><div className="h-32 bg-muted rounded" /></CardContent>
              </Card>
            ))}
          </div>
        ) : storeStats ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* NPS Score Card */}
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-6 flex flex-col items-center justify-center">
                <NpsGauge score={storeStats.npsScore} />
                <div className="mt-4 grid grid-cols-3 gap-4 w-full text-center">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">推奨者</div>
                    <div className="font-mono-data text-sm md:text-base font-bold text-[#2D9C8F]">{storeStats.promoterPct}%</div>
                    <div className="text-[10px] text-muted-foreground">{storeStats.promoters}件</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">中立者</div>
                    <div className="font-mono-data text-sm md:text-base font-bold text-[#B8922A]">{storeStats.passivePct}%</div>
                    <div className="text-[10px] text-muted-foreground">{storeStats.passives}件</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">批判者</div>
                    <div className="font-mono-data text-sm md:text-base font-bold text-[#C75C5C]">{storeStats.detractorPct}%</div>
                    <div className="text-[10px] text-muted-foreground">{storeStats.detractors}件</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Score Distribution */}
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-foreground">スコア分布</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={scoreDistribution} margin={{ top: 5, right: 5, bottom: 5, left: -20 }} style={{ cursor: "pointer" }} onClick={(state: any) => { if (state && state.activePayload && state.activePayload[0]) { const d = state.activePayload[0].payload; if (d.count > 0) setSelectedScore(d.score); } }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                    <XAxis dataKey="score" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e5e5" }}
                      formatter={(value: number) => [`${value}件`, "回答数"]}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} cursor="pointer">
                      {scoreDistribution.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} className="hover:opacity-80 transition-opacity" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-[10px] text-muted-foreground text-center mt-1">棒グラフをタップで該当アンケートを表示</p>
              </CardContent>
            </Card>

            {/* Pie Chart */}
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-foreground">回答者構成</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e5e5" }}
                      formatter={(value: number, name: string) => [`${value}件`, name]}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 11 }}
                      iconType="circle"
                      iconSize={8}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="border-border/50">
            <CardContent className="p-8 text-center text-muted-foreground">
              この期間のNPSデータはありません
            </CardContent>
          </Card>
        )}
      </section>

      {/* NPS Advice Section */}
      {storeStats && storeRecords.length > 0 && (
        <AdviceSection stats={storeStats} records={storeRecords} />
      )}

      {/* Category Analysis */}
      {storeRecords.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            カテゴリ別評価
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-5">
                <CategoryAnalysis records={storeRecords} field="priceComment" label="金額について" />
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-5">
                <CategoryAnalysis records={storeRecords} field="spaceComment" label="空間について" />
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-5">
                <CategoryAnalysis records={storeRecords} field="staffComment" label="スタッフについて" />
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-5">
                <CategoryAnalysis records={storeRecords} field="finishComment" label="仕上がりについて" />
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Recent Reviews */}
      {storeRecords.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-[#E5B85C]" />
            最新レビュー
          </h2>
          <div className="space-y-3">
            {storeRecords
              .filter((r) => r.review)
              .slice(0, 8)
              .map((r, i) => (
                <motion.div
                  key={r.no + "-" + i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i }}
                >
                  <Card className="border-border/50 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-mono-data font-bold"
                            style={{
                              backgroundColor:
                                r.npsScore >= 9 ? NPS_COLORS.promoter : r.npsScore >= 7 ? NPS_COLORS.passive : NPS_COLORS.detractor,
                            }}
                          >
                            {r.npsScore}
                          </div>
                          <span className="text-xs text-muted-foreground">{r.menu}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{r.date.split(" ")[0]}</span>
                      </div>
                      <p className="text-sm text-foreground/80 leading-relaxed">{r.review}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
          </div>
        </section>
      )}

      {/* Score Detail Modal */}
      <ScoreDetailModal
        selectedScore={selectedScore}
        onClose={() => setSelectedScore(null)}
        records={storeRecords}
      />

      {/* ファンくる調査結果 */}
      {hasFolderMapping && (
      <section className="mb-8 pt-6 border-t-2 border-sage/20">
        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-sage" />
          ファンくる調査結果
          {filteredFankuruPdfs.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-2">{filteredFankuruPdfs.length}件</span>
          )}
        </h2>

        {fankuruLoading ? (
          <Card className="border-border/50">
            <CardContent className="p-8 text-center text-muted-foreground">
              <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin opacity-50" />
              <p className="text-sm">ファンくるデータを読み込み中...</p>
            </CardContent>
          </Card>
        ) : filteredFankuruPdfs.length === 0 ? (
          <Card className="border-border/50 border-dashed">
            <CardContent className="p-8 text-center text-muted-foreground">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">この期間のファンくるデータはありません</p>
              <p className="text-xs mt-1 opacity-70">Google Driveにファイルが追加されると自動的に表示されます</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* PDF List */}
            <div className="grid gap-3">
              {filteredFankuruPdfs.map((pdf, i) => (
                <motion.div
                  key={pdf.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i }}
                >
                  <Card
                    className={`border-border/50 shadow-sm hover:shadow-md transition-all cursor-pointer group ${
                      selectedPdf?.id === pdf.id ? "ring-2 ring-sage/40 border-sage/30" : ""
                    }`}
                    onClick={() => setSelectedPdf(selectedPdf?.id === pdf.id ? null : pdf)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-sage/10 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-sage" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-foreground group-hover:text-sage transition-colors">
                            {pdf.displayName}
                            {pdf.stylist && (
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                担当: {pdf.stylist}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            フォルダ: {pdf.folder || "ルート"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            selectedPdf?.id === pdf.id
                              ? "bg-sage text-white"
                              : "bg-sage/10 text-sage group-hover:bg-sage/20"
                          }`}>
                            <Eye className="w-3 h-3" />
                            {selectedPdf?.id === pdf.id ? "閉じる" : "詳細を見る"}
                          </span>
                          <a
                            href={pdf.viewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                            onClick={(e) => e.stopPropagation()}
                            title="Google Driveで開く"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* PDF Preview */}
            {selectedPdf && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4"
              >
                <Card className="border-border/50 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between bg-sage/5">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-sage" />
                      <span className="text-sm font-medium text-foreground">{selectedPdf.displayName}</span>
                    </div>
                    <a
                      href={selectedPdf.viewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-sage hover:text-sage/80 transition-colors"
                    >
                      Google Driveで開く
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="w-full" style={{ height: "80vh", minHeight: "500px" }}>
                    <iframe
                      src={selectedPdf.previewUrl}
                      className="w-full h-full border-0"
                      title={selectedPdf.displayName}
                      allow="autoplay"
                    />
                  </div>
                </Card>
              </motion.div>
            )}
          </>
        )}
      </section>
      )}

      {/* 店舗売上サマリ（売上は【サロンボードのみ】。林さんの指示により月末報告書は使わない） */}
      {(() => {
        // サロンボードデータ—単月・複数月・全期間すべて対応
        const sbData = selectedMonthsList
          ? (selectedMonthsList.length === 1
              ? getStoreMonth(storeId, selectedMonthsList[0])
              : getStoreMonthsAggregated(storeId, selectedMonthsList))
          : getStoreMonthsAggregated(storeId); // 全期間
        const hasSb = !!sbData;

        // 店舗レベルの数値: サロンボードのみ。無ければ月末報告書へフォールバックせず 0（売上に月末報告書を混ぜない）
        const storeTotalSales = hasSb ? (sbData?.totalSales || 0) : 0;
        const storeTechSales = hasSb ? (sbData?.techSales || 0) : 0;
        const storeRetailSales = hasSb ? (sbData?.retailSales || 0) : 0;
        const storeUnitPrice = hasSb ? (sbData?.unitPrice || 0) : 0;
        const storeTotalCustomers = hasSb ? (sbData?.totalCustomers || 0) : 0;
        const storeNewCustomers = hasSb ? (sbData?.newCustomers || 0) : 0;
        const storeReturnCustomers = hasSb ? (sbData?.returnCustomers || 0) : 0;
        // 次回予約率は常に月末報告書から（サロンボードにはない）
        const nextReservationRate = reportStats?.nextReservationRate || 0;
        const nextReservation = reportStats?.totalNextReservation || 0;

        const hasAnyData = hasSb || !!reportStats;
        const monthLabel = reportStats?.monthLabel || (activeMonth ? `${parseInt(activeMonth.split("-")[1])}月` : "");

        return (
          <section className="mb-8 pt-6 border-t-2 border-primary/20">
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              店舗売上サマリ
              {monthLabel && (
                <span className="text-xs font-normal text-muted-foreground">— {monthLabel}分</span>
              )}
              {hasSb && (
                <span className="text-[10px] font-medium text-primary/70 bg-primary/5 border border-primary/20 rounded px-1.5 py-0.5">SalonBoard</span>
              )}
            </h2>
            {hasAnyData ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "総売上", value: formatCurrency(storeTotalSales), sub: `技術: ${formatCurrency(storeTechSales)} / 店販: ${formatCurrency(storeRetailSales)}`, icon: DollarSign },
                  { label: "客単価", value: formatCurrency(storeUnitPrice), sub: `総売上 ÷ 総客数`, icon: Scissors },
                  { label: "総客数", value: `${storeTotalCustomers}名`, sub: `新規: ${storeNewCustomers} / 再来: ${storeReturnCustomers}`, icon: Users },
                  { label: "次回予約率", value: `${nextReservationRate}%`, sub: `予約: ${nextReservation} / 総客: ${storeTotalCustomers}`, icon: TrendingUp, warn: nextReservationRate <= 69, excellent: nextReservationRate >= 85, adequate: nextReservationRate >= 70 && nextReservationRate <= 84 },
                ].map((item, i) => (
                  <motion.div key={item.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.04 }}>
                    <Card className="border-border/50 shadow-sm">
                      <CardContent className="p-4">
                        <item.icon className="w-4 h-4 text-primary mb-2" />
                        <div className="font-mono-data text-lg md:text-xl font-bold">{item.value}</div>
                        <div className="text-[10px] text-muted-foreground mt-1">{item.label}</div>
                        <div className="text-[9px] text-muted-foreground/70 mt-0.5">{item.sub}</div>
                        {('warn' in item) && item.warn && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 mt-1.5" title="要改善">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            要改善
                          </span>
                        )}
                        {('excellent' in item) && item.excellent && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-600 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300 rounded-full px-1.5 py-0.5 shadow-sm mt-1.5">
                            <Trophy className="w-2.5 h-2.5 text-amber-500" />
                            エクセレント！
                            <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                          </span>
                        )}
                        {('adequate' in item) && item.adequate && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-[#E5B85C] bg-amber-50/60 border border-amber-200/60 rounded-full px-1.5 py-0.5 mt-1.5">
                            <CircleCheck className="w-2.5 h-2.5 text-[#E5B85C]" />
                            適正
                          </span>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <Card className="border-border/50 border-dashed">
                <CardContent className="p-6 text-center text-muted-foreground">
                  <DollarSign className="w-6 h-6 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">この期間の売上データはありません</p>
                </CardContent>
              </Card>
            )}
          </section>
        );
      })()}
    </DashboardLayout>
  );
}
