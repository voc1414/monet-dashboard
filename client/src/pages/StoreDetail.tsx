/*
 * Design: Atelier Blanc — クリーンアトリエ
 * Page: 店舗詳細（売上情報・在籍スタッフ・ファンくる調査・NPS調査結果）
 * Colors: Warm white base, monet water-blue accent, sage green secondary
 */
import { useParams, Link } from "wouter";
import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import {
  MapPin, Users, TrendingUp, BarChart3, ArrowRight, Calendar,
  DollarSign, Scissors, Star, MessageSquare, ChevronDown,
  Trophy, ThumbsUp, Target, AlertTriangle, AlertCircle,
  Lightbulb, CheckCircle2, ArrowUpRight,
  FileText, ExternalLink, Loader2, FolderOpen, Eye
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ScoreDetailModal from "@/components/ScoreDetailModal";
import DashboardLayout from "@/components/DashboardLayout";
import { useNpsData, calculateStoreStats, filterByMonth, getAvailableMonths } from "@/hooks/useNpsData";
import type { NpsRecord, StoreStats } from "@/hooks/useNpsData";
import { getNpsClass, NPS_INDUSTRY_AVERAGE } from "@/lib/npsClass";
import { generateStoreAdvice } from "@/lib/npsAdvice";
import type { NpsAdvice } from "@/lib/npsAdvice";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from "recharts";
import { useFankuruData } from "@/hooks/useFankuruData";
import { isNewStore, isNewStaff } from "@/lib/newBadge";
import { useStaffOverrides } from "@/hooks/useStaffOverrides";
import type { FankuruPdf } from "@/hooks/useFankuruData";
import { useMonthlyReport } from "@/hooks/useMonthlyReport";
import type { StaffReport, StaffMonthlyTrend } from "@/hooks/useMonthlyReport";
import { validateStoreReport, getAlertSummary } from "@/lib/reportValidation";
import type { ReportAlert } from "@/lib/reportValidation";

const NPS_HEADER_IMAGE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663489426081/aLPZvLfFDC4rFYToBquZNR/nps-header-6cTohzoTSmSjrDCLc4VzHg.webp";

const formatCurrency = (n: number) => {
  if (n === 0) return "—";
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
  const { records, loading: npsLoading, error: npsError, lastUpdated, refresh } = useNpsData();
  const { loading: reportLoading, error: reportError, getStoreMonthlyStats, availableMonths: reportMonths, getStaffTrend } = useMonthlyReport();
  const { getDisplayName } = useStaffOverrides();
  const loading = npsLoading || reportLoading;
  const error = npsError || reportError;
  const allNpsMonths = useMemo(() => getAvailableMonths(records), [records]);
  const allMonths = useMemo(() => {
    const set = new Set([...allNpsMonths, ...reportMonths]);
    return Array.from(set).sort().reverse();
  }, [allNpsMonths, reportMonths]);
  // デフォルト月: NPS月を優先
  const defaultMonth = useMemo(() => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const ym = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;
    if (allMonths.includes(ym)) return ym;
    if (allNpsMonths.length > 0) return allNpsMonths[0];
    return allMonths[0] || "all";
  }, [allMonths, allNpsMonths]);
  const [selectedMonth, setSelectedMonth] = useState<string>("__init__");
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [selectedPdf, setSelectedPdf] = useState<FankuruPdf | null>(null);
  const { pdfs: fankuruPdfs, loading: fankuruLoading, hasFolderMapping } = useFankuruData(storeId);

  // ファンくるPDFを選択月でフィルタリング
  const filteredFankuruPdfs = useMemo(() => {
    if (selectedMonth === "all" || selectedMonth === "__init__") return fankuruPdfs;
    return fankuruPdfs.filter(p => p.yearMonth === selectedMonth);
  }, [fankuruPdfs, selectedMonth]);

  // 全データの読み込みが完了してからデフォルト月を設定する
  useEffect(() => {
    if (selectedMonth === "__init__" && !npsLoading && !reportLoading && allMonths.length > 0) {
      setSelectedMonth(defaultMonth);
    }
  }, [allMonths, defaultMonth, selectedMonth, npsLoading, reportLoading]);

  const storeRecords = useMemo(() => {
    const filtered = records.filter((r) => r.storeShort === storeId);
    if (selectedMonth === "all") return filtered;
    return filterByMonth(filtered, selectedMonth);
  }, [records, storeId, selectedMonth]);

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

  // 月末報告書の実データ
  const activeMonth = selectedMonth === "all" || selectedMonth === "__init__" ? undefined : selectedMonth;
  const reportStats = useMemo(() => getStoreMonthlyStats(storeId, activeMonth), [getStoreMonthlyStats, storeId, activeMonth]);

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

        {/* Month Selector */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px] bg-white">
              <SelectValue placeholder="期間を選択" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全期間</SelectItem>
              {allMonths.map((m) => (
                <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
                      <span className="font-bold text-foreground">{getDisplayName(alert.staffName, storeId)}</span>
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
            {reportStats.staffReports.map((sr: StaffReport, i: number) => (
              <motion.div key={sr.answerId || i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.03 }}>
                <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-3 sm:w-48 shrink-0">
                        {sr.photoUrl2 ? (
                          <img src={sr.photoUrl2} alt={sr.name} className="w-10 h-10 rounded-full object-cover object-center shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-primary font-bold text-sm">{getDisplayName(sr.name, storeId).charAt(0)}</span>
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-sm text-foreground flex items-center gap-1.5">
                            {getDisplayName(sr.name, storeId)}
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
                          <div className="font-mono-data text-sm font-bold">{formatCurrency(sr.totalSales)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground">客単価</div>
                          <div className="font-mono-data text-sm font-bold">{formatCurrency(sr.unitPrice)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground">総客数</div>
                          <div className="font-mono-data text-sm font-bold">{sr.totalCustomers}名</div>
                          <div className="text-[9px] text-muted-foreground/70">新規{sr.newCustomers} / 再来{sr.returnCustomers}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground">次回予約率</div>
                          <div className="font-mono-data text-sm font-bold">{sr.nextReservationRate}%</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground">店販売上</div>
                          <div className="font-mono-data text-sm font-bold">{formatCurrency(sr.retailSales)}</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card className="border-border/50 border-dashed">
            <CardContent className="p-6 text-center text-muted-foreground">
              <Users className="w-6 h-6 mx-auto mb-2 opacity-40" />
              <p className="text-sm">この期間のスタッフ実績データはまだありません</p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* スタッフ別月次トレンド */}
      {(() => {
        const trendData = getStaffTrend(storeId);
        if (trendData.length === 0 || trendData[0]?.data.length < 2) return null;

        // スタッフ別の色パレット
        const STAFF_COLORS = [
          '#2D9C8F', '#E5B85C', '#6B8EAE', '#C75C5C', '#8B7EC8',
          '#D4845A', '#5BA88C', '#B07AA1', '#4E9FD5', '#E88E8E'
        ];

        // 月ラベル一覧（全スタッフ共通）
        const months = trendData[0].data.map(d => d.monthLabel);

        // 売上グラフ用データ: 各月にスタッフ名をキーとした売上を格納
        const salesChartData = months.map((label, mi) => {
          const point: Record<string, any> = { month: label };
          trendData.forEach(staff => {
            const d = staff.data[mi];
            point[staff.staffName] = d?.hasData ? d.sales : null;
          });
          return point;
        });

        // 客数グラフ用データ
        const customerChartData = months.map((label, mi) => {
          const point: Record<string, any> = { month: label };
          trendData.forEach(staff => {
            const d = staff.data[mi];
            point[staff.staffName] = d?.hasData ? d.customers : null;
          });
          return point;
        });

        // 前月比の計算
        const latestIdx = trendData[0].data.length - 1;
        const prevIdx = latestIdx - 1;

        return (
          <section className="mb-8 pt-6 border-t-2 border-primary/20">
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              スタッフ別月次トレンド
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-2">
                {months.length}ヶ月分
              </span>
            </h2>

            {/* 前月比サマリーカード */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
              {trendData.map((staff, si) => {
                const curr = staff.data[latestIdx];
                const prev = staff.data[prevIdx];
                if (!curr?.hasData) return null;
                const salesDiff = prev?.hasData ? curr.sales - prev.sales : null;
                const custDiff = prev?.hasData ? curr.customers - prev.customers : null;
                return (
                  <Card key={staff.staffName} className="border-border/50 shadow-sm">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: STAFF_COLORS[si % STAFF_COLORS.length] }} />
                        <span className="text-xs font-bold text-foreground truncate">{getDisplayName(staff.staffName, storeId)}</span>
                      </div>
                      <div className="space-y-1.5">
                        <div>
                          <div className="text-[10px] text-muted-foreground">売上</div>
                          <div className="flex items-center gap-1">
                            <span className="font-mono-data text-xs font-bold">{formatCurrency(curr.sales)}</span>
                            {salesDiff !== null && (
                              <span className={`text-[10px] font-mono-data font-semibold ${salesDiff >= 0 ? 'text-[#2D9C8F]' : 'text-[#C75C5C]'}`}>
                                {salesDiff >= 0 ? '+' : ''}{formatCurrency(salesDiff).replace('¥', '').replace('—', '0')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground">客数</div>
                          <div className="flex items-center gap-1">
                            <span className="font-mono-data text-xs font-bold">{curr.customers}名</span>
                            {custDiff !== null && (
                              <span className={`text-[10px] font-mono-data font-semibold ${custDiff >= 0 ? 'text-[#2D9C8F]' : 'text-[#C75C5C]'}`}>
                                {custDiff >= 0 ? '+' : ''}{custDiff}名
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 売上推移グラフ */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-primary" />
                    売上推移
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={salesChartData} margin={{ top: 10, right: 10, bottom: 5, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => v >= 10000 ? `${Math.round(v / 10000)}万` : `${v}`} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e5e5' }}
                        formatter={(value: number, name: string) => [value ? `¥${value.toLocaleString()}` : '—', name]}
                      />
                      {trendData.map((staff, si) => (
                        <Bar
                          key={staff.staffName}
                          dataKey={staff.staffName}
                          fill={STAFF_COLORS[si % STAFF_COLORS.length]}
                          radius={[2, 2, 0, 0]}
                          stackId="sales"
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                  {/* Legend */}
                  <div className="flex flex-wrap gap-3 mt-3 justify-center">
                    {trendData.map((staff, si) => (
                      <div key={staff.staffName} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: STAFF_COLORS[si % STAFF_COLORS.length] }} />
                        <span className="text-[10px] text-muted-foreground">{getDisplayName(staff.staffName, storeId)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 客数推移グラフ */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#6B8EAE]" />
                    客数推移
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={customerChartData} margin={{ top: 10, right: 10, bottom: 5, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e5e5' }}
                        formatter={(value: number, name: string) => [value !== null ? `${value}名` : '—', name]}
                      />
                      {trendData.map((staff, si) => (
                        <Line
                          key={staff.staffName}
                          type="monotone"
                          dataKey={staff.staffName}
                          stroke={STAFF_COLORS[si % STAFF_COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 4, fill: STAFF_COLORS[si % STAFF_COLORS.length] }}
                          activeDot={{ r: 6 }}
                          connectNulls={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                  {/* Legend */}
                  <div className="flex flex-wrap gap-3 mt-3 justify-center">
                    {trendData.map((staff, si) => (
                      <div key={staff.staffName} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STAFF_COLORS[si % STAFF_COLORS.length] }} />
                        <span className="text-[10px] text-muted-foreground">{getDisplayName(staff.staffName, storeId)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        );
      })()}

      {/* NPS Survey Results */}
      <section className="mb-8 pt-6 border-t-2 border-[#2D9C8F]/20">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#2D9C8F]" />
            NPS調査結果
            {selectedMonth !== "all" && (
              <span className="text-xs font-normal text-muted-foreground">— {formatMonth(selectedMonth)}</span>
            )}
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
              {selectedMonth !== "all" ? "この期間のデータはありません" : "データがありません"}
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
      <section className="mb-8 pt-6 border-t-2 border-sage/20">
        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-sage" />
          ファンくる調査結果
          {filteredFankuruPdfs.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-2">{filteredFankuruPdfs.length}件</span>
          )}
        </h2>

        {!hasFolderMapping ? (
          <Card className="border-border/50 border-dashed">
            <CardContent className="p-8 text-center text-muted-foreground">
              <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">この店舗のファンくるフォルダはまだ設定されていません</p>
            </CardContent>
          </Card>
        ) : fankuruLoading ? (
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
              <p className="text-sm">この月のファンくるデータはありません</p>
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

      {/* 店舗売上サマリ */}
      <section className="mb-8 pt-6 border-t-2 border-primary/20">
        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" />
          店舗売上サマリ
          {reportStats && reportStats.monthLabel && (
            <span className="text-xs font-normal text-muted-foreground">— {reportStats.monthLabel}分</span>
          )}
        </h2>
        {reportStats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "総売上", value: formatCurrency(reportStats.totalSales), sub: `技術: ${formatCurrency(reportStats.totalTechSales)} / 店販: ${formatCurrency(reportStats.totalRetailSales)}`, icon: DollarSign },
              { label: "客単価", value: formatCurrency(reportStats.avgUnitPrice), sub: `総売上 ÷ 総客数`, icon: Scissors },
              { label: "総客数", value: `${reportStats.totalCustomers}名`, sub: `新規: ${reportStats.totalNewCustomers} / 再来: ${reportStats.totalReturnCustomers}`, icon: Users },
              { label: "次回予約率", value: `${reportStats.nextReservationRate}%`, sub: `予約: ${reportStats.totalNextReservation} / 総客: ${reportStats.totalCustomers}`, icon: TrendingUp },
            ].map((item, i) => (
              <motion.div key={item.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.04 }}>
                <Card className="border-border/50 shadow-sm">
                  <CardContent className="p-4">
                    <item.icon className="w-4 h-4 text-primary mb-2" />
                    <div className="font-mono-data text-lg md:text-xl font-bold">{item.value}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">{item.label}</div>
                    <div className="text-[9px] text-muted-foreground/70 mt-0.5">{item.sub}</div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card className="border-border/50 border-dashed">
            <CardContent className="p-6 text-center text-muted-foreground">
              <DollarSign className="w-6 h-6 mx-auto mb-2 opacity-40" />
              <p className="text-sm">この期間の売上データはまだありません</p>
            </CardContent>
          </Card>
        )}
      </section>
    </DashboardLayout>
  );
}
