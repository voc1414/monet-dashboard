/**
 * Design: monet Brand Identity — 水彩ブルー × コンクリートモダン
 * Page: スタッフ一覧（全店舗横断・総売上順）
 * Columns: 氏名、総売上、配属店舗、雇用形態、次回予約率
 * Feature: 名前タップで詳細展開（売上内訳・NPS情報）
 */
import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Calendar, Building2, ArrowRight, ChevronDown, ChevronUp,
  DollarSign, UserCheck, Scissors, TrendingUp, BarChart3
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DashboardLayout from "@/components/DashboardLayout";
import { useMonthlyReport } from "@/hooks/useMonthlyReport";
import { useNpsData, filterByMonth } from "@/hooks/useNpsData";
import type { StaffReport } from "@/hooks/useMonthlyReport";
import { isNewStaff, isNewStore } from "@/lib/newBadge";

const formatCurrency = (n: number) => {
  if (n === 0) return "—";
  return `¥${n.toLocaleString()}`;
};

const formatMonth = (m: string) => {
  const [y, mo] = m.split("-");
  return `${y}年${parseInt(mo)}月`;
};

const NPS_COLORS = {
  promoter: "#2D9C8F",
  passive: "#E5B85C",
  detractor: "#C75C5C",
};

interface StaffNpsInfo {
  totalResponses: number;
  avgScore: number;
  npsScore: number;
  promoters: number;
  passives: number;
  detractors: number;
}

export default function StaffList() {
  const { rawData, loading, error, availableMonths } = useMonthlyReport();
  const { records: npsRecords, loading: npsLoading } = useNpsData();

  // デフォルトは先月
  const defaultMonth = useMemo(() => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>("__init__");
  const [expandedStaff, setExpandedStaff] = useState<string | null>(null);

  useEffect(() => {
    if (availableMonths.length > 0 && selectedMonth === "__init__") {
      const hasDefault = availableMonths.includes(defaultMonth);
      setSelectedMonth(hasDefault ? defaultMonth : availableMonths[0]);
    }
  }, [availableMonths, defaultMonth, selectedMonth]);

  const activeMonth = selectedMonth === "__init__" ? defaultMonth : selectedMonth;

  // 選択月のスタッフデータを総売上順でソート
  const staffList = useMemo(() => {
    if (!rawData.length) return [];
    let filtered: StaffReport[];
    if (activeMonth === "all") {
      const map = new Map<string, StaffReport>();
      for (const r of rawData) {
        const key = `${r.name}__${r.storeNormalized}`;
        const existing = map.get(key);
        if (!existing || r.reportMonth > existing.reportMonth) {
          map.set(key, r);
        }
      }
      filtered = Array.from(map.values());
    } else {
      filtered = rawData.filter((r) => r.reportMonth === activeMonth);
    }
    return [...filtered].sort((a, b) => b.totalSales - a.totalSales);
  }, [rawData, activeMonth]);

  // スタッフごとのNPS情報を計算
  const staffNpsMap = useMemo(() => {
    const map = new Map<string, StaffNpsInfo>();
    if (!npsRecords.length) return map;

    // 期間フィルタリング
    const filteredNps = activeMonth === "all" ? npsRecords : filterByMonth(npsRecords, activeMonth);

    // スタッフ名でグルーピング
    const grouped = new Map<string, number[]>();
    for (const r of filteredNps) {
      const staffName = r.staff?.trim();
      if (!staffName) continue;
      if (!grouped.has(staffName)) grouped.set(staffName, []);
      grouped.get(staffName)!.push(r.npsScore);
    }

    for (const [name, scores] of Array.from(grouped.entries())) {
      const total = scores.length;
      const avg = scores.reduce((a: number, b: number) => a + b, 0) / total;
      const promoters = scores.filter((s: number) => s >= 9).length;
      const passives = scores.filter((s: number) => s >= 7 && s <= 8).length;
      const detractors = scores.filter((s: number) => s <= 6).length;
      const npsScore = Math.round(((promoters - detractors) / total) * 100);
      map.set(name, { totalResponses: total, avgScore: Math.round(avg * 10) / 10, npsScore, promoters, passives, detractors });
    }
    return map;
  }, [npsRecords, activeMonth]);

  const monthLabel = activeMonth === "all" ? "全期間" : formatMonth(activeMonth);

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  useEffect(() => {
    if (rawData.length > 0) setLastUpdated(new Date());
  }, [rawData]);

  const toggleExpand = (id: string) => {
    setExpandedStaff((prev) => (prev === id ? null : id));
  };

  return (
    <DashboardLayout
      breadcrumbs={[{ label: "スタッフ一覧" }]}
      lastUpdated={lastUpdated}
      loading={loading}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            スタッフ一覧
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            全店舗のスタッフ個人実績（総売上順）
            {staffList.length > 0 && ` — ${staffList.length}名`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/">
            <span className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors cursor-pointer">
              <Building2 className="w-4 h-4" />
              店舗一覧へ
            </span>
          </Link>
          <Select value={activeMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <Calendar className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="期間を選択" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全期間</SelectItem>
              {availableMonths.map((m) => (
                <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="border-border/50 animate-pulse">
              <CardContent className="p-4"><div className="h-16 bg-muted rounded" /></CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-center text-red-600 text-sm">
            データの読み込みに失敗しました: {error}
          </CardContent>
        </Card>
      )}

      {/* Empty */}
      {!loading && !error && staffList.length === 0 && (
        <Card className="border-border/50 border-dashed">
          <CardContent className="p-8 text-center text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">
              {activeMonth === "all"
                ? "スタッフデータはまだありません"
                : `${monthLabel}のスタッフデータはまだありません`}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Staff List */}
      {!loading && staffList.length > 0 && (
        <>
          {/* Table Header (desktop) */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-[10px] text-muted-foreground font-medium uppercase tracking-wider border-b border-border/40 mb-2">
            <div className="col-span-3">氏名</div>
            <div className="col-span-3 text-right">総売上</div>
            <div className="col-span-2">配属店舗</div>
            <div className="col-span-2">雇用形態</div>
            <div className="col-span-2 text-right">次回予約率</div>
          </div>

          <div className="space-y-2">
            {staffList.map((staff, i) => {
              const staffKey = `${staff.answerId}-${i}`;
              const isExpanded = expandedStaff === staffKey;
              const npsInfo = staffNpsMap.get(staff.name);

              return (
                <motion.div
                  key={staffKey}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.02 * i }}
                >
                  <Card className={`border-border/50 shadow-sm transition-all ${isExpanded ? "ring-2 ring-primary/30 shadow-md" : "hover:shadow-md"}`}>
                    <CardContent className="p-0">
                      {/* Clickable Row */}
                      <div
                        className="p-4 cursor-pointer select-none"
                        onClick={() => toggleExpand(staffKey)}
                      >
                        {/* Desktop Layout */}
                        <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                          <div className="col-span-3 flex items-center gap-3">
                            {staff.photoUrl2 ? (
                              <img src={staff.photoUrl2} alt={staff.name} className="w-9 h-9 rounded-full object-cover object-center shrink-0" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="text-primary font-bold text-sm">{staff.name.charAt(0)}</span>
                              </div>
                            )}
                            <span className="font-bold text-sm text-foreground hover:text-primary transition-colors">{staff.name}</span>
                            {isNewStaff(staff.name, staff.storeNormalized) && (
                              <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1 py-0.5 leading-none">NEW</span>
                            )}
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="col-span-3 text-right">
                            <span className="font-mono-data text-base font-bold text-foreground">{formatCurrency(staff.totalSales)}</span>
                          </div>
                          <div className="col-span-2">
                            <Link href={`/store/${encodeURIComponent(staff.storeNormalized)}`}>
                              <span className="text-sm text-primary hover:text-primary/80 transition-colors cursor-pointer flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                {staff.storeNormalized}
                                <ArrowRight className="w-3 h-3" />
                              </span>
                            </Link>
                          </div>
                          <div className="col-span-2">
                            <span className="text-sm text-muted-foreground">{staff.employmentType}</span>
                          </div>
                          <div className="col-span-2 text-right">
                            <span className={`font-mono-data text-base font-bold ${
                              staff.nextReservationRate >= 80 ? "text-[#2D9C8F]" :
                              staff.nextReservationRate >= 60 ? "text-[#E5B85C]" :
                              "text-[#C75C5C]"
                            }`}>
                              {staff.nextReservationRate}%
                            </span>
                          </div>
                        </div>

                        {/* Mobile Layout */}
                        <div className="md:hidden">
                          <div className="flex items-center gap-3">
                            {staff.photoUrl2 ? (
                              <img src={staff.photoUrl2} alt={staff.name} className="w-8 h-8 rounded-full object-cover object-center shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="text-primary font-bold text-xs">{staff.name.charAt(0)}</span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-sm text-foreground">{staff.name}</span>
                                  {isNewStaff(staff.name, staff.storeNormalized) && (
                                    <span className="text-[9px] font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1 py-0.5 leading-none">NEW</span>
                                  )}
                                  <span className="text-[10px] text-muted-foreground">({staff.employmentType})</span>
                                  {isExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                                </div>
                                <span className="font-mono-data text-sm font-bold text-foreground shrink-0 ml-2">{formatCurrency(staff.totalSales)}</span>
                              </div>
                              <div className="flex items-center justify-between mt-1">
                                <Link href={`/store/${encodeURIComponent(staff.storeNormalized)}`}>
                                  <span className="text-[11px] text-primary hover:text-primary/80 transition-colors cursor-pointer flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    <Building2 className="w-3 h-3" />
                                    {staff.storeNormalized}
                                  </span>
                                </Link>
                                <span className={`text-[11px] font-mono-data font-bold shrink-0 ${
                                  staff.nextReservationRate >= 80 ? "text-[#2D9C8F]" :
                                  staff.nextReservationRate >= 60 ? "text-[#E5B85C]" :
                                  "text-[#C75C5C]"
                                }`}>
                                  次回予約 {staff.nextReservationRate}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Detail */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 pt-2 border-t border-border/40">
                              {/* 売上内訳 */}
                              <div className="mb-4">
                                <h4 className="text-xs font-bold text-muted-foreground mb-3 flex items-center gap-1.5">
                                  <DollarSign className="w-3.5 h-3.5" />
                                  売上内訳
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                                  <div className="bg-muted/40 rounded-lg p-3">
                                    <div className="text-[10px] text-muted-foreground mb-1">技術売上</div>
                                    <div className="font-mono-data text-sm font-bold">{formatCurrency(staff.techSales)}</div>
                                  </div>
                                  <div className="bg-muted/40 rounded-lg p-3">
                                    <div className="text-[10px] text-muted-foreground mb-1">店販売上</div>
                                    <div className="font-mono-data text-sm font-bold">{formatCurrency(staff.retailSales)}</div>
                                  </div>
                                  <div className="bg-muted/40 rounded-lg p-3">
                                    <div className="text-[10px] text-muted-foreground mb-1">客単価</div>
                                    <div className="font-mono-data text-sm font-bold">{formatCurrency(staff.unitPrice)}</div>
                                  </div>
                                  <div className="bg-muted/40 rounded-lg p-3">
                                    <div className="text-[10px] text-muted-foreground mb-1">新規客数</div>
                                    <div className="font-mono-data text-sm font-bold">{staff.newCustomers}名</div>
                                  </div>
                                  <div className="bg-muted/40 rounded-lg p-3">
                                    <div className="text-[10px] text-muted-foreground mb-1">再来客数</div>
                                    <div className="font-mono-data text-sm font-bold">{staff.returnCustomers}名</div>
                                  </div>
                                  <div className="bg-muted/40 rounded-lg p-3">
                                    <div className="text-[10px] text-muted-foreground mb-1">次回予約数</div>
                                    <div className="font-mono-data text-sm font-bold">{staff.nextReservation}件</div>
                                  </div>
                                </div>
                              </div>

                              {/* NPS情報 */}
                              <div>
                                <h4 className="text-xs font-bold text-muted-foreground mb-3 flex items-center gap-1.5">
                                  <BarChart3 className="w-3.5 h-3.5" />
                                  NPS情報
                                </h4>
                                {npsLoading ? (
                                  <div className="text-xs text-muted-foreground">NPSデータ読み込み中...</div>
                                ) : npsInfo ? (
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="bg-muted/40 rounded-lg p-3">
                                      <div className="text-[10px] text-muted-foreground mb-1">NPSスコア</div>
                                      <div className={`font-mono-data text-lg font-bold ${
                                        npsInfo.npsScore >= 50 ? "text-[#2D9C8F]" :
                                        npsInfo.npsScore >= 0 ? "text-[#E5B85C]" :
                                        "text-[#C75C5C]"
                                      }`}>
                                        {npsInfo.npsScore >= 0 ? "+" : ""}{npsInfo.npsScore}
                                      </div>
                                    </div>
                                    <div className="bg-muted/40 rounded-lg p-3">
                                      <div className="text-[10px] text-muted-foreground mb-1">平均スコア</div>
                                      <div className="font-mono-data text-lg font-bold">{npsInfo.avgScore}</div>
                                    </div>
                                    <div className="bg-muted/40 rounded-lg p-3">
                                      <div className="text-[10px] text-muted-foreground mb-1">回答数</div>
                                      <div className="font-mono-data text-lg font-bold">{npsInfo.totalResponses}件</div>
                                    </div>
                                    <div className="bg-muted/40 rounded-lg p-3">
                                      <div className="text-[10px] text-muted-foreground mb-1">内訳</div>
                                      <div className="flex items-center gap-1.5 mt-1">
                                        <div className="flex items-center gap-1">
                                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: NPS_COLORS.promoter }} />
                                          <span className="text-[10px] font-mono-data">{npsInfo.promoters}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: NPS_COLORS.passive }} />
                                          <span className="text-[10px] font-mono-data">{npsInfo.passives}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: NPS_COLORS.detractor }} />
                                          <span className="text-[10px] font-mono-data">{npsInfo.detractors}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground">
                                    この期間のNPSデータはありません
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
