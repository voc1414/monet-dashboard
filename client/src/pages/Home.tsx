/*
 * Design: monet Brand Identity — 水彩ブルー × コンクリートモダン
 * Page: 店舗一覧（実データ連携 — 月末報告書 + NPS概要）
 * Colors: Warm white base, monet water-blue accent
 */
import { Link } from "wouter";
import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { MapPin, Users, TrendingUp, BarChart3, ArrowRight, Sparkles, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DashboardLayout from "@/components/DashboardLayout";
import { useNpsData, calculateStoreStats, filterByMonth, getAvailableMonths } from "@/hooks/useNpsData";
import { useMonthlyReport } from "@/hooks/useMonthlyReport";
import { getNpsClass, NPS_INDUSTRY_AVERAGE } from "@/lib/npsClass";

const HERO_IMAGE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663489426081/aLPZvLfFDC4rFYToBquZNR/monet-salon_83a99286.jpg";
const MONET_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663489426081/aLPZvLfFDC4rFYToBquZNR/monet-logo_cd6a82da.png";

const formatMonth = (ym: string) => {
  const [y, m] = ym.split("-");
  return `${y}年${parseInt(m)}月`;
};

const formatCurrency = (n: number) => {
  if (n === 0) return "—";
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

export default function Home() {
  const { records, loading: npsLoading, error: npsError, lastUpdated, refresh } = useNpsData();
  const { loading: reportLoading, error: reportError, getStoreMonthlyStats, availableMonths: reportMonths } = useMonthlyReport();

  const loading = npsLoading || reportLoading;
  const error = npsError || reportError;

  const allNpsMonths = useMemo(() => getAvailableMonths(records), [records]);

  const allMonths = useMemo(() => {
    const set = new Set([...allNpsMonths, ...reportMonths]);
    return Array.from(set).sort().reverse();
  }, [allNpsMonths, reportMonths]);

  const defaultMonth = useMemo(() => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const ym = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;
    return allMonths.includes(ym) ? ym : allMonths[0] || "all";
  }, [allMonths]);

  const [selectedMonth, setSelectedMonth] = useState<string>("__init__");

  useEffect(() => {
    if (selectedMonth === "__init__" && allMonths.length > 0) {
      setSelectedMonth(defaultMonth);
    }
  }, [allMonths, defaultMonth, selectedMonth]);

  const filteredRecords = useMemo(() => {
    if (selectedMonth === "all" || selectedMonth === "__init__") return records;
    return filterByMonth(records, selectedMonth);
  }, [records, selectedMonth]);

  const filteredStoreStats = calculateStoreStats(filteredRecords);

  const ALL_STORES = ["堀江院", "堀江院2nd", "福島院", "高槻院", "姪浜院", "楽々園院"];
  const storeStats = ALL_STORES.map((name) => {
    const nps = filteredStoreStats.find((s) => s.shortName === name);
    const activeMonth = selectedMonth === "all" || selectedMonth === "__init__" ? undefined : selectedMonth;
    const report = getStoreMonthlyStats(name, activeMonth);

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
      totalSales: report?.totalSales || 0,
      totalTechSales: report?.totalTechSales || 0,
      totalRetailSales: report?.totalRetailSales || 0,
      totalCustomers: report?.totalCustomers || 0,
      totalNewCustomers: report?.totalNewCustomers || 0,
      totalReturnCustomers: report?.totalReturnCustomers || 0,
      avgUnitPrice: report?.avgUnitPrice || 0,
      nextReservationRate: report?.nextReservationRate || 0,
      staffCount: report?.staffCount || 0,
      hasReportData: !!report,
      reportMonthLabel: report?.monthLabel || "",
    };
  });

  const storesWithNps = storeStats.filter((s) => s.totalResponses > 0);
  const totalResponses = storesWithNps.reduce((s, st) => s + st.totalResponses, 0);
  const totalPromoters = storesWithNps.reduce((s, st) => s + st.promoters, 0);
  const totalDetractors = storesWithNps.reduce((s, st) => s + st.detractors, 0);
  const overallNps = totalResponses > 0 ? Math.round(((totalPromoters - totalDetractors) / totalResponses) * 100) : 0;
  const overallAvg = totalResponses > 0 ? Math.round((filteredRecords.reduce((s, r) => s + r.npsScore, 0) / totalResponses) * 10) / 10 : 0;

  const storesWithReport = storeStats.filter((s) => s.hasReportData);
  const totalAllSales = storesWithReport.reduce((s, st) => s + st.totalSales, 0);
  const totalAllCustomers = storesWithReport.reduce((s, st) => s + st.totalCustomers, 0);
  const overallUnitPrice = totalAllCustomers > 0 ? Math.round(totalAllSales / totalAllCustomers) : 0;

  return (
    <DashboardLayout lastUpdated={lastUpdated} onRefresh={refresh} loading={loading}>
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
              五感を満たす唯一無二の美容室 — 店舗パフォーマンス管理
            </p>
          </motion.div>
        </div>
      </div>

      {/* Period Selector + Overall Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h2 className="text-xl font-bold text-foreground">
          全店舗サマリー
          {selectedMonth !== "all" && selectedMonth !== "__init__" && (
            <span className="text-xs font-normal text-muted-foreground ml-2">— {formatMonth(selectedMonth)}</span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Select value={selectedMonth === "__init__" ? "all" : selectedMonth} onValueChange={setSelectedMonth}>
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

      {/* 上段: NPS関連 4カード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {[
          { label: "全店舗NPS", value: `${overallNps > 0 ? "+" : ""}${overallNps}`, icon: TrendingUp, color: "text-[#2D9C8F]", extra: loading ? undefined : getNpsClass(overallNps) },
          { label: "業界平均NPS", value: `${NPS_INDUSTRY_AVERAGE}`, icon: BarChart3, color: "text-muted-foreground", extra: undefined },
          { label: "平均スコア", value: `${overallAvg}`, icon: Sparkles, color: "text-primary", extra: undefined },
          { label: "総回答数", value: `${totalResponses}`, icon: BarChart3, color: "text-sage", extra: undefined },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.05 }}
          >
            <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <div className="font-mono-data text-2xl md:text-3xl font-bold text-foreground mb-1">
                  {loading ? "..." : stat.value}
                </div>
                <div className="text-[11px] text-muted-foreground">{stat.label}</div>
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

      {/* 下段: 売上関連 3カード */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: "全店舗総売上", value: formatCurrency(totalAllSales), icon: TrendingUp, color: "text-[#2D9C8F]" },
          { label: "全店舗客単価", value: formatCurrency(overallUnitPrice), icon: BarChart3, color: "text-primary" },
          { label: "店舗数", value: `${storesWithNps.length > 0 ? storesWithNps.length : storesWithReport.length}`, icon: MapPin, color: "text-primary" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 + i * 0.05 }}
          >
            <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <div className="font-mono-data text-2xl md:text-3xl font-bold text-foreground mb-1">
                  {loading ? "..." : stat.value}
                </div>
                <div className="text-[11px] text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Store List */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-foreground">
          店舗一覧
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          各店舗の売上・NPS概要
          {selectedMonth !== "all" && selectedMonth !== "__init__" && (
            <span>（{formatMonth(selectedMonth)}）</span>
          )}
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-lg p-4 mb-6 text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-4">
        {(loading ? Array.from({ length: 4 }) : storeStats).map((store, i) => {
          if (loading) {
            return (
              <Card key={i} className="border-border/50 animate-pulse">
                <CardContent className="p-6">
                  <div className="h-6 bg-muted rounded w-32 mb-4" />
                  <div className="h-4 bg-muted rounded w-48" />
                </CardContent>
              </Card>
            );
          }

          const st = store as NonNullable<typeof storeStats>[number];

          return (
            <motion.div
              key={st.shortName}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.04 }}
            >
              <Link href={`/store/${encodeURIComponent(st.shortName)}`}>
                <Card className="border-border/50 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all cursor-pointer group">
                  <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row md:items-center">
                      {/* Store Info */}
                      <div className="flex-1 p-5 md:p-6">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <MapPin className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-bold text-foreground text-base group-hover:text-primary transition-colors">
                              {st.shortName}
                            </h3>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <Users className="w-3 h-3" />
                              <span>{st.staffCount > 0 ? `${st.staffCount}名` : "—"}</span>
                              {st.reportMonthLabel && (
                                <span className="text-primary">（{st.reportMonthLabel}分）</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Stats Row */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 mt-4">
                          <div>
                            <div className="text-[11px] text-muted-foreground mb-1">総売上</div>
                            <div className="font-mono-data text-sm md:text-base font-bold">
                              {st.hasReportData ? formatCurrency(st.totalSales) : "—"}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] text-muted-foreground mb-1">客単価</div>
                            <div className="font-mono-data text-sm md:text-base font-bold">
                              {st.hasReportData && st.avgUnitPrice > 0 ? formatCurrency(st.avgUnitPrice) : "—"}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] text-muted-foreground mb-1">総客数</div>
                            <div className="font-mono-data text-sm md:text-base font-bold">
                              {st.hasReportData ? `${st.totalCustomers}名` : "—"}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] text-muted-foreground mb-1">次回予約率</div>
                            <div className="font-mono-data text-sm md:text-base font-bold">
                              {st.hasReportData && st.nextReservationRate > 0 ? `${st.nextReservationRate}%` : "—"}
                            </div>
                          </div>
                        </div>

                        {/* NPS Row */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 mt-3 pt-3 border-t border-border/30">
                          <div>
                            <div className="text-[11px] text-muted-foreground mb-1">NPS回答数</div>
                            <div className="font-mono-data text-sm md:text-base font-bold">
                              {st.totalResponses > 0 ? `${st.totalResponses}件` : "—"}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] text-muted-foreground mb-1">平均スコア</div>
                            <div className="font-mono-data text-sm md:text-base font-bold">
                              {st.totalResponses > 0 ? st.avgScore : "—"}
                            </div>
                          </div>
                          <div className="col-span-2 sm:col-span-2" />
                        </div>
                      </div>

                      {/* NPS Score */}
                      <div className="flex items-center gap-4 px-5 pb-5 md:px-6 md:py-6 md:border-l border-border/40">
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
                              データなし
                            </span>
                          </div>
                        )}
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          );
        })}

        {!loading && storeStats.length === 0 && selectedMonth !== "all" && (
          <Card className="border-border/50">
            <CardContent className="p-8 text-center text-muted-foreground">
              この期間のデータはありません
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
