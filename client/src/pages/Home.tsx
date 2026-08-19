/*
 * Design: monet Brand Identity — 水彩ブルー × コンクリートモダン
 * Page: 店舗一覧（実データ連携 — 月末報告書 + NPS概要）
 * Colors: Warm white base, monet water-blue accent
 */
import { Link } from "wouter";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { MapPin, Users, TrendingUp, BarChart3, ArrowRight, DollarSign, Scissors, ShoppingBag, ChevronDown, AlertTriangle, CircleCheck, Trophy, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PeriodSelector, getDefaultPeriodSelection, getFilterMonths, getPeriodLabel } from "@/components/PeriodSelector";
import type { PeriodSelection } from "@/components/PeriodSelector";
import DashboardLayout from "@/components/DashboardLayout";
import DataHealthPanel from "@/components/DataHealthPanel";
import { useNpsData, calculateStoreStats, getAvailableMonths } from "@/hooks/useNpsData";
import { useMonthlyReport } from "@/hooks/useMonthlyReport";
import { useSalonBoardData } from "@/hooks/useSalonBoardData";
import { getNpsClass, NPS_INDUSTRY_AVERAGE } from "@/lib/npsClass";

import { validateStoreReport, getAlertSummary } from "@/lib/reportValidation";
import { useStores } from "@/hooks/useStores";

const HERO_IMAGE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663489426081/aLPZvLfFDC4rFYToBquZNR/monet-salon_83a99286.jpg";

const formatMonth = (ym: string) => {
  const [y, m] = ym.split("-");
  return `${y}年${parseInt(m)}月`;
};

const formatCurrency = (n: number) => {
  return `¥${n.toLocaleString()}`;
};

function NpsScoreBadge({ score }: { score: number }) {
  const npsClass = getNpsClass(score);
  return (
    <div className="flex flex-col items-end gap-1">
      <span
        className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-mono-data font-bold border"
        style={{ backgroundColor: npsClass.bgColor, color: npsClass.color, borderColor: npsClass.borderColor }}
      >
        NPS {score > 0 ? "+" : ""}{score}
      </span>
      <span
        className="text-[10px] font-medium px-1.5 py-0.5 rounded"
        style={{ color: npsClass.color }}
      >
        {npsClass.label}
      </span>
    </div>
  );
}

/* エリア定義: フォールバック用（useStoresがDBから取得できない場合のみ使用） */

export default function Home() {
  const { areaStores: AREA_STORES, allStores: ALL_STORES, npsAliasMap, isNewStore } = useStores();
  const { records, loading: npsLoading, error: npsError, lastUpdated, refresh } = useNpsData(npsAliasMap);
  const { loading: reportLoading, error: reportError, getStoreMonthlyStats, availableMonths: reportMonths } = useMonthlyReport();
  const { loading: sbLoading, error: sbError, getStoreMonth, getStoreMonthsAggregated, availableMonths: sbMonths, hasData: hasSbData } = useSalonBoardData();

  const loading = npsLoading || reportLoading || sbLoading;
  const error = npsError || reportError || sbError;

  const allNpsMonths = useMemo(() => getAvailableMonths(records), [records]);

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

  /** 後方互換: 単月の場合の selectedMonth 文字列 */
  const selectedMonth = useMemo(() => {
    if (activeFilterMonths === "all") return "all";
    if (activeFilterMonths.length === 1) return activeFilterMonths[0];
    return "multi";
  }, [activeFilterMonths]);

  const filteredRecords = useMemo(() => {
    if (activeFilterMonths === "all") return records;
    return records.filter((r) => {
      const d = new Date(r.date);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return activeFilterMonths.includes(ym);
    });
  }, [records, activeFilterMonths]);

  const filteredStoreStats = calculateStoreStats(filteredRecords, ALL_STORES);

  /** 選択された月リスト（配列形式）— 全期間の場合は undefined */
  const selectedMonthsList = useMemo(() => {
    if (activeFilterMonths === "all") return undefined;
    return activeFilterMonths;
  }, [activeFilterMonths]);

  const storeStats = ALL_STORES.map((name) => {
    const nps = filteredStoreStats.find((s) => s.shortName === name);

    // 月末報告書: 単月の場合はその月、複数月の場合は各月ごとに取得して合算、全期間は undefined
    let report;
    if (!selectedMonthsList) {
      // 全期間
      report = getStoreMonthlyStats(name, undefined);
    } else if (selectedMonthsList.length === 1) {
      // 単月
      report = getStoreMonthlyStats(name, selectedMonthsList[0]);
    } else {
      // 複数月: 各月ごとに取得して合算
      const monthReports = selectedMonthsList
        .map(m => getStoreMonthlyStats(name, m))
        .filter((r): r is NonNullable<typeof r> => r !== null);
      if (monthReports.length === 0) {
        report = null;
      } else {
        const totalTechSales = monthReports.reduce((s, r) => s + r.totalTechSales, 0);
        const totalRetailSales = monthReports.reduce((s, r) => s + r.totalRetailSales, 0);
        const totalSales = totalTechSales + totalRetailSales;
        const totalNewCustomers = monthReports.reduce((s, r) => s + r.totalNewCustomers, 0);
        const totalReturnCustomers = monthReports.reduce((s, r) => s + r.totalReturnCustomers, 0);
        const totalCustomers = totalNewCustomers + totalReturnCustomers;
        const avgUnitPrice = totalCustomers > 0 ? Math.round(totalSales / totalCustomers) : 0;
        const totalNextReservation = monthReports.reduce((s, r) => s + (r.totalNextReservation || 0), 0);
        const nextReservationRate = totalCustomers > 0 ? Math.round((totalNextReservation / totalCustomers) * 1000) / 10 : 0;
        report = {
          ...monthReports[0],
          totalSales, totalTechSales, totalRetailSales,
          totalCustomers, totalNewCustomers, totalReturnCustomers,
          avgUnitPrice, totalNextReservation, nextReservationRate,
          staffCount: monthReports.reduce((s, r) => s + r.staffCount, 0),
          monthLabel: "",
        };
      }
    }

    // サロンボードデータ（店舗レベルの数値）— 単月・複数月・全期間すべて対応
    const sbData = selectedMonthsList
      ? (selectedMonthsList.length === 1
          ? getStoreMonth(name, selectedMonthsList[0])
          : getStoreMonthsAggregated(name, selectedMonthsList))
      : getStoreMonthsAggregated(name); // 全期間
    const hasSb = !!sbData;

    const alerts = validateStoreReport(report);
    const alertSummary = getAlertSummary(alerts);

    // 店舗レベルの数値: サロンボードデータを優先、なければ月末報告書にフォールバック
    const storeTotalSales = hasSb ? (sbData?.totalSales || 0) : (report?.totalSales || 0);
    const storeTechSales = hasSb ? (sbData?.techSales || 0) : (report?.totalTechSales || 0);
    const storeRetailSales = hasSb ? (sbData?.retailSales || 0) : (report?.totalRetailSales || 0);
    const storeTotalCustomers = hasSb ? (sbData?.totalCustomers || 0) : (report?.totalCustomers || 0);
    const storeNewCustomers = hasSb ? (sbData?.newCustomers || 0) : 0;
    const storeReturnCustomers = hasSb ? (sbData?.returnCustomers || 0) : (report?.totalReturnCustomers || 0);
    const storeUnitPrice = hasSb ? (sbData?.unitPrice || 0) : (report?.avgUnitPrice || 0);

    return {
      shortName: name,
      totalResponses: nps?.totalResponses || 0,
      avgScore: nps?.avgScore || 0,
      npsScore: nps?.npsScore || 0,
      promoters: nps?.promoters || 0,
      passives: nps?.passives || 0,
      detractors: nps?.detractors || 0,
      promoterPct: nps?.promoterPct || 0,
      passivePct: nps?.passivePct || 0,
      detractorPct: nps?.detractorPct || 0,
      totalSales: storeTotalSales,
      totalTechSales: storeTechSales,
      totalRetailSales: storeRetailSales,
      totalCustomers: storeTotalCustomers,
      totalNewCustomers: storeNewCustomers,
      totalReturnCustomers: storeReturnCustomers,
      avgUnitPrice: storeUnitPrice,
      nextReservationRate: report?.nextReservationRate || 0,
      staffCount: report?.staffCount || 0,
      hasReportData: hasSb || !!report,
      reportMonthLabel: report?.monthLabel || "",
      alertCount: alertSummary.total,
      alertErrors: alertSummary.errors,
      alertWarnings: alertSummary.warnings,
      dataSource: hasSb ? "salonboard" as const : "report" as const,
    };
  });

  /* 全店舗サマリー集計 */
  const storesWithNps = storeStats.filter((s) => s.totalResponses > 0);
  const totalResponses = storesWithNps.reduce((s, st) => s + st.totalResponses, 0);
  const totalPromoters = storesWithNps.reduce((s, st) => s + st.promoters, 0);
  const totalDetractors = storesWithNps.reduce((s, st) => s + st.detractors, 0);
  const overallNps = totalResponses > 0 ? Math.round(((totalPromoters - totalDetractors) / totalResponses) * 100) : 0;

  const storesWithReport = storeStats.filter((s) => s.hasReportData);
  const totalAllSales = storesWithReport.reduce((s, st) => s + st.totalSales, 0);
  const totalAllTechSales = storesWithReport.reduce((s, st) => s + st.totalTechSales, 0);
  const totalAllRetailSales = storesWithReport.reduce((s, st) => s + st.totalRetailSales, 0);
  const totalAllCustomers = storesWithReport.reduce((s, st) => s + st.totalCustomers, 0);
  const overallUnitPrice = totalAllCustomers > 0 ? Math.round(totalAllSales / totalAllCustomers) : 0;
  const storeCount = Math.max(storesWithNps.length, storesWithReport.length, ALL_STORES.length);

  /* エリアトグル状態（デフォルト全開 — closedAreasで管理） */
  const [closedAreas, setClosedAreas] = useState<Set<string>>(new Set());
  const toggleArea = (area: string) => {
    setClosedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(area)) next.delete(area);
      else next.add(area);
      return next;
    });
  };

  return (
    <DashboardLayout lastUpdated={lastUpdated} onRefresh={refresh} loading={loading}>
      {/* データ点検（「今日直すことがあるか」を先に一言） */}
      <DataHealthPanel />

      {/* Hero Section */}
      <div className="relative rounded-2xl overflow-hidden mb-8">
        <div className="absolute inset-0">
          <img
            src={HERO_IMAGE}
            alt="monet salon"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1a2a3a]/70 via-[#1a2a3a]/45 to-transparent" />
        </div>
        <div className="relative px-6 md:px-8 py-8 md:py-12">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
              monet Dashboard
            </h1>
            <p className="text-white/80 text-xs md:text-sm max-w-lg">
              五感を満たす唯一無二の美容室 — 店舗データ
            </p>
          </motion.div>
        </div>
      </div>

      {/* Period Selector + Overall Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h2 className="text-xl font-bold text-foreground">
          全店舗サマリー
          <span className="text-xs font-normal text-muted-foreground ml-2">— {getPeriodLabel(periodSelection)}</span>
        </h2>
        <PeriodSelector
          allMonths={allMonths}
          selection={periodSelection}
          onChange={setPeriodSelection}
        />
      </div>

      {/* KPIカード 6項目: NPSスコア、全店総合売上、全店総合技術売上、全店総合店販売上、全店売上単価、店舗数 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {[
          { label: "NPSスコア", value: totalResponses > 0 ? `${overallNps > 0 ? "+" : ""}${overallNps}` : "—", icon: TrendingUp, color: "text-[#2D9C8F]", extra: loading ? undefined : (totalResponses > 0 ? getNpsClass(overallNps) : undefined) },
          { label: "全店総合売上", value: storesWithReport.length > 0 ? formatCurrency(totalAllSales) : "—", icon: DollarSign, color: "text-primary" },
          { label: "全店総合技術売上", value: storesWithReport.length > 0 ? formatCurrency(totalAllTechSales) : "—", icon: Scissors, color: "text-primary" },
          { label: "全店総合店販売上", value: storesWithReport.length > 0 ? formatCurrency(totalAllRetailSales) : "—", icon: ShoppingBag, color: "text-primary" },
          { label: "全店売上単価", value: storesWithReport.length > 0 ? formatCurrency(overallUnitPrice) : "—", icon: BarChart3, color: "text-primary" },
          { label: "店舗数", value: `${storeCount}`, icon: MapPin, color: "text-primary" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.05 }}
          >
            <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow h-full overflow-hidden">
              <CardContent className="p-3 lg:p-4">
                <div className="flex items-start justify-between mb-1.5">
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <div className="font-mono-data text-lg lg:text-xl font-bold text-foreground mb-1 truncate">
                  {loading ? "..." : stat.value}
                </div>
                <div className="text-[10px] text-muted-foreground leading-tight truncate">{stat.label}</div>
                {stat.extra && (
                  <div className="mt-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded inline-block" style={{ color: stat.extra.color, backgroundColor: stat.extra.bgColor }}>
                    {stat.extra.label}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Store List Header */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-foreground">
          店舗一覧
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          各店舗の売上・NPS概要
          <span>（{getPeriodLabel(periodSelection)}）</span>
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-lg p-4 mb-6 text-sm">
          {error}
        </div>
      )}

      {/* エリア別トグル店舗一覧 */}
      <div className="space-y-3">
        {AREA_STORES.map((areaGroup) => {
          const isOpen = !closedAreas.has(areaGroup.area);
          const areaStores = storeStats.filter((s) => areaGroup.stores.includes(s.shortName));

          return (
            <div key={areaGroup.area} className="border border-border/50 rounded-xl overflow-hidden bg-card">
              {/* Area Toggle Header */}
              <button
                onClick={() => toggleArea(areaGroup.area)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="font-bold text-sm text-foreground">{areaGroup.area}</span>
                  <span className="text-xs text-muted-foreground">{areaGroup.stores.length}店舗</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
              </button>

              {/* Area Content */}
              {isOpen && (
                <div className="border-t border-border/30">
                  {loading ? (
                    <div className="p-4 space-y-3">
                      {areaGroup.stores.map((_, idx) => (
                        <div key={idx} className="animate-pulse">
                          <div className="h-6 bg-muted rounded w-32 mb-2" />
                          <div className="h-4 bg-muted rounded w-48" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="divide-y divide-border/30">
                      {areaStores.map((st, i) => (
                        <motion.div
                          key={st.shortName}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.05 * i }}
                        >
                          <Link href={`/store/${encodeURIComponent(st.shortName)}`}>
                            <div className="flex flex-col md:flex-row md:items-center hover:bg-accent/30 transition-colors cursor-pointer group">
                              {/* Store Info */}
                              <div className="flex-1 p-4 md:p-5">
                                <div className="flex items-center gap-3 mb-3">
                                  <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0">
                                    <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663489426081/aLPZvLfFDC4rFYToBquZNR/monet-parasol_bfd1d990.jpg" alt="monet" className="w-full h-full object-cover" />
                                  </div>
                                  <div>
                                    <h3 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors flex items-center gap-1.5">
                                      {st.shortName}
                                      {isNewStore(st.shortName) && (
                                        <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1 py-0.5 leading-none">NEW</span>
                                      )}
                                      {st.alertCount > 0 && (
                                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold rounded px-1.5 py-0.5 leading-none"
                                          style={{
                                            color: st.alertErrors > 0 ? '#dc2626' : '#d97706',
                                            backgroundColor: st.alertErrors > 0 ? '#fee2e2' : '#fef3c7',
                                            border: `1px solid ${st.alertErrors > 0 ? '#fecaca' : '#fde68a'}`,
                                          }}
                                        >
                                          <AlertTriangle className="w-3 h-3" />
                                          {st.alertCount}
                                        </span>
                                      )}
                                    </h3>
                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                      <Users className="w-3 h-3" />
                                      <span>{st.staffCount > 0 ? `${st.staffCount}名` : "—"}</span>
                                      {st.reportMonthLabel && (
                                        <span className="text-primary">（{st.reportMonthLabel}分）</span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Stats Row */}
                                <div className="grid grid-cols-3 sm:grid-cols-5 gap-x-4 gap-y-2">
                                  <div>
                                    <div className="text-[10px] text-muted-foreground mb-0.5">総売上</div>
                                    <div className="font-mono-data text-sm font-bold">
                                      {st.hasReportData ? formatCurrency(st.totalSales) : "—"}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-[10px] text-muted-foreground mb-0.5">客単価</div>
                                    <div className="font-mono-data text-sm font-bold">
                                      {st.hasReportData ? formatCurrency(st.avgUnitPrice) : "—"}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-[10px] text-muted-foreground mb-0.5">総客数</div>
                                    <div className="font-mono-data text-sm font-bold">
                                      {st.hasReportData ? `${st.totalCustomers}名` : "—"}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-[10px] text-muted-foreground mb-0.5">新規数</div>
                                    <div className="font-mono-data text-sm font-bold">
                                      {st.hasReportData ? `${st.totalNewCustomers}名` : "—"}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-[10px] text-muted-foreground mb-0.5">次回予約率</div>
                                    <div className="font-mono-data text-sm font-bold flex items-center gap-1">
                                      {st.hasReportData ? (
                                        st.nextReservationRate > 0 ? (
                                          <>
                                            <span className={st.nextReservationRate >= 85 ? "text-[#2D9C8F]" : st.nextReservationRate >= 70 ? "text-[#E5B85C]" : "text-[#C75C5C]"}>
                                              {st.nextReservationRate}%
                                            </span>
                                            {st.nextReservationRate <= 69 && (
                                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-1 py-0.5" title="要改善">
                                                <AlertTriangle className="w-2.5 h-2.5" />
                                                要改善
                                              </span>
                                            )}
                                            {st.nextReservationRate >= 85 && (
                                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-600 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300 rounded-full px-1.5 py-0.5 shadow-sm">
                                                <Trophy className="w-2.5 h-2.5 text-amber-500" />
                                                <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                                              </span>
                                            )}
                                            {st.nextReservationRate >= 70 && st.nextReservationRate <= 84 && (
                                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-[#E5B85C] bg-amber-50/60 border border-amber-200/60 rounded-full px-1.5 py-0.5">
                                                <CircleCheck className="w-2.5 h-2.5 text-[#E5B85C]" />
                                              </span>
                                            )}
                                          </>
                                        ) : "0%"
                                      ) : "—"}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* NPS Score */}
                              <div className="flex items-center gap-4 px-4 pb-4 md:px-5 md:py-5 md:border-l border-border/30">
                                {st.totalResponses > 0 ? (
                                  <div className="text-center">
                                    <NpsScoreBadge score={st.npsScore} />
                                    <div className="mt-2 flex gap-1">
                                      <div className="h-1.5 rounded-full bg-[#2D9C8F]" style={{ width: `${Math.max(st.promoterPct * 0.6, 4)}px` }} />
                                      <div className="h-1.5 rounded-full bg-[#E5B85C]" style={{ width: `${Math.max(st.passivePct * 0.6, 4)}px` }} />
                                      <div className="h-1.5 rounded-full bg-[#C75C5C]" style={{ width: `${Math.max(st.detractorPct * 0.6, 4)}px` }} />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-center">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium text-muted-foreground bg-muted/50 border border-border/50">
                                      NPS —
                                    </span>
                                  </div>
                                )}
                                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors group-hover:translate-x-0.5" />
                              </div>
                            </div>
                          </Link>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {!loading && storeStats.length === 0 && selectedMonth !== "all" && (
          <Card className="border-border/50">
            <CardContent className="p-8 text-center text-muted-foreground">
              この期間の店舗データはありません
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
