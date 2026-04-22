/**
 * Design: monet Brand Identity — 水彩ブルー × コンクリートモダン
 * Page: スタッフ一覧（全店舗横断・ソート機能付き）
 * Columns: 氏名、総売上、配属店舗、雇用形態、次回予約率
 * Feature: カード全体クリックでスタッフ個人ページへ遷移
 */
import { useState, useMemo, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Users, Calendar, Building2, ArrowRight,
  ChevronRight, ArrowUpDown, ArrowUp, ArrowDown
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DashboardLayout from "@/components/DashboardLayout";
import { useMonthlyReport } from "@/hooks/useMonthlyReport";
import { useNpsData, filterByMonth } from "@/hooks/useNpsData";
import type { StaffReport } from "@/hooks/useMonthlyReport";
import { isNewStaff } from "@/lib/newBadge";

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

type SortField = "totalSales" | "storeNormalized" | "employmentType" | "nextReservationRate";
type SortDirection = "asc" | "desc";

const SORT_LABELS: Record<SortField, string> = {
  totalSales: "総売上",
  storeNormalized: "配属店舗",
  employmentType: "雇用形態",
  nextReservationRate: "次回予約率",
};

export default function StaffList() {
  const { rawData, loading, error, availableMonths } = useMonthlyReport();
  const { records: npsRecords, loading: npsLoading } = useNpsData();
  const [, navigate] = useLocation();

  // ソート状態（デフォルト: 次回予約率の昇順）
  const [sortField, setSortField] = useState<SortField>("nextReservationRate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      // 総売上はデフォルト降順、それ以外は昇順
      setSortDirection(field === "totalSales" ? "desc" : "asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />;
    return sortDirection === "asc"
      ? <ArrowUp className="w-3 h-3 text-primary" />
      : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  // デフォルトは先月
  const defaultMonth = useMemo(() => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>("__init__");

  useEffect(() => {
    if (availableMonths.length > 0 && selectedMonth === "__init__") {
      const hasDefault = availableMonths.includes(defaultMonth);
      setSelectedMonth(hasDefault ? defaultMonth : availableMonths[0]);
    }
  }, [availableMonths, defaultMonth, selectedMonth]);

  const activeMonth = selectedMonth === "__init__" ? defaultMonth : selectedMonth;

  // 選択月のスタッフデータ
  const staffListUnsorted = useMemo(() => {
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
    return filtered;
  }, [rawData, activeMonth]);

  // ソート適用
  const staffList = useMemo(() => {
    const list = [...staffListUnsorted];
    const dir = sortDirection === "asc" ? 1 : -1;

    list.sort((a, b) => {
      switch (sortField) {
        case "totalSales":
          return (a.totalSales - b.totalSales) * dir;
        case "storeNormalized":
          return a.storeNormalized.localeCompare(b.storeNormalized, "ja") * dir;
        case "employmentType":
          return a.employmentType.localeCompare(b.employmentType, "ja") * dir;
        case "nextReservationRate":
          return (a.nextReservationRate - b.nextReservationRate) * dir;
        default:
          return 0;
      }
    });
    return list;
  }, [staffListUnsorted, sortField, sortDirection]);

  // スタッフごとのNPS情報を計算
  const staffNpsMap = useMemo(() => {
    const map = new Map<string, StaffNpsInfo>();
    if (!npsRecords.length) return map;

    const filteredNps = activeMonth === "all" ? npsRecords : filterByMonth(npsRecords, activeMonth);

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

  const handleStaffClick = (staffName: string, storeName: string) => {
    navigate(`/staff/${encodeURIComponent(storeName)}/${encodeURIComponent(staffName)}`);
  };

  // ソートラベル表示
  const sortLabel = `${SORT_LABELS[sortField]}${sortDirection === "asc" ? "↑" : "↓"}`;

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
            全店舗のスタッフ個人実績（{SORT_LABELS[sortField]}{sortDirection === "asc" ? "昇順" : "降順"}）
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

      {/* Mobile Sort Controls */}
      <div className="md:hidden flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        {(["nextReservationRate", "totalSales", "storeNormalized", "employmentType"] as SortField[]).map((field) => (
          <button
            key={field}
            onClick={() => handleSort(field)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
              sortField === field
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-card text-muted-foreground border-border/50 hover:bg-accent/50"
            }`}
          >
            {SORT_LABELS[field]}
            {sortField === field && (
              sortDirection === "asc"
                ? <ArrowUp className="w-3 h-3" />
                : <ArrowDown className="w-3 h-3" />
            )}
          </button>
        ))}
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
          {/* Table Header (desktop) — clickable for sorting */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-[10px] text-muted-foreground font-medium uppercase tracking-wider border-b border-border/40 mb-2">
            <div className="col-span-3">氏名</div>
            <div
              className="col-span-3 text-right flex items-center justify-end gap-1 cursor-pointer hover:text-foreground transition-colors select-none"
              onClick={() => handleSort("totalSales")}
            >
              総売上 {getSortIcon("totalSales")}
            </div>
            <div
              className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors select-none"
              onClick={() => handleSort("storeNormalized")}
            >
              配属店舗 {getSortIcon("storeNormalized")}
            </div>
            <div
              className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors select-none"
              onClick={() => handleSort("employmentType")}
            >
              雇用形態 {getSortIcon("employmentType")}
            </div>
            <div
              className="col-span-2 text-right flex items-center justify-end gap-1 cursor-pointer hover:text-foreground transition-colors select-none"
              onClick={() => handleSort("nextReservationRate")}
            >
              次回予約率 {getSortIcon("nextReservationRate")}
            </div>
          </div>

          <div className="space-y-2">
            {staffList.map((staff, i) => {
              const staffKey = `${staff.answerId}-${i}`;

              return (
                <motion.div
                  key={staffKey}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.02 * i }}
                >
                  <Card
                    className="border-border/50 shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group"
                    onClick={() => handleStaffClick(staff.name, staff.storeNormalized)}
                  >
                    <CardContent className="p-0">
                      {/* Desktop Layout */}
                      <div className="hidden md:grid grid-cols-12 gap-4 items-center p-4">
                        <div className="col-span-3 flex items-center gap-3">
                          {staff.photoUrl2 ? (
                            <img src={staff.photoUrl2} alt={staff.name} className="w-9 h-9 rounded-full object-cover object-center shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-primary font-bold text-sm">{staff.name.charAt(0)}</span>
                            </div>
                          )}
                          <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{staff.name}</span>
                          {isNewStaff(staff.name, staff.storeNormalized) && (
                            <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1 py-0.5 leading-none">NEW</span>
                          )}
                          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="col-span-3 text-right">
                          <span className="font-mono-data text-base font-bold text-foreground">{formatCurrency(staff.totalSales)}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            {staff.storeNormalized}
                          </span>
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
                      <div className="md:hidden p-4">
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
                                <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{staff.name}</span>
                                {isNewStaff(staff.name, staff.storeNormalized) && (
                                  <span className="text-[9px] font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1 py-0.5 leading-none">NEW</span>
                                )}
                                <span className="text-[10px] text-muted-foreground">({staff.employmentType})</span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                <span className="font-mono-data text-sm font-bold text-foreground">{formatCurrency(staff.totalSales)}</span>
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {staff.storeNormalized}
                              </span>
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
