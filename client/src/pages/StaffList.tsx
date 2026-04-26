/**
 * Design: monet Brand Identity — 水彩ブルー × コンクリートモダン
 * Page: スタッフ一覧（全店舗横断・ソート機能付き）
 * Columns: 氏名、総売上、配属店舗、雇用形態、稼働率、次回予約率
 * Feature: カード全体クリックでスタッフ個人ページへ遷移
 */
import { useState, useMemo, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Users, Building2, AlertTriangle, Search, Store,
  ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Activity,
  Sparkles, Trophy, CircleCheck, CalendarCheck, Gauge
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PeriodSelector, getDefaultPeriodSelection, getFilterMonths, getPeriodLabel } from "@/components/PeriodSelector";
import type { PeriodSelection } from "@/components/PeriodSelector";
import DashboardLayout from "@/components/DashboardLayout";
import { useMonthlyReport } from "@/hooks/useMonthlyReport";
import { useNpsData, filterByMonth } from "@/hooks/useNpsData";
import type { StaffReport } from "@/hooks/useMonthlyReport";
import { isNewStaff, isRetiredStaff } from "@/lib/newBadge";
import { calculateUtilizationRate, getUtilizationColor, getUtilizationLabel } from "@/lib/utilizationRate";

const formatCurrency = (n: number) => {
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

type SortField = "totalSales" | "storeNormalized" | "employmentType" | "utilizationRate" | "nextReservationRate";
type SortDirection = "asc" | "desc";

const SORT_LABELS: Record<SortField, string> = {
  totalSales: "総売上",
  storeNormalized: "配属店舗",
  employmentType: "雇用形態",
  utilizationRate: "稼働率",
  nextReservationRate: "次回予約率",
};

export default function StaffList() {
  const { rawData, loading, error, availableMonths } = useMonthlyReport();
  const { records: npsRecords, loading: npsLoading } = useNpsData();
  const [, navigate] = useLocation();

  // 検索・フィルタ状態
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStore, setFilterStore] = useState("all");

  // ソート状態（デフォルト: 総売上の降順）
  const [sortField, setSortField] = useState<SortField>("totalSales");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      // 全てデフォルト降順
      setSortDirection("desc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />;
    return sortDirection === "asc"
      ? <ArrowUp className="w-3 h-3 text-primary" />
      : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  // 期間セレクタ状態
  const [periodSelection, setPeriodSelection] = useState<PeriodSelection>(getDefaultPeriodSelection());

  // 期間フィルタから対象月リストを取得
  const filterMonthsResult = useMemo(
    () => getFilterMonths(periodSelection, availableMonths),
    [periodSelection, availableMonths]
  );

  // 選択期間のスタッフデータ
  const staffListUnsorted = useMemo(() => {
    if (!rawData.length) return [];
    let filtered: StaffReport[];
    if (filterMonthsResult === "all") {
      // 全期間: 各スタッフの最新月のデータを使用
      const map = new Map<string, StaffReport>();
      for (const r of rawData) {
        const key = `${r.name}__${r.storeNormalized}`;
        const existing = map.get(key);
        if (!existing || r.reportMonth > existing.reportMonth) {
          map.set(key, r);
        }
      }
      filtered = Array.from(map.values());
    } else if (filterMonthsResult.length === 1) {
      // 単月
      filtered = rawData.filter((r) => r.reportMonth === filterMonthsResult[0]);
    } else {
      // 複数月: 各スタッフの最新月のデータを使用
      const monthSet = new Set(filterMonthsResult);
      const inRange = rawData.filter((r) => monthSet.has(r.reportMonth));
      const map = new Map<string, StaffReport>();
      for (const r of inRange) {
        const key = `${r.name}__${r.storeNormalized}`;
        const existing = map.get(key);
        if (!existing || r.reportMonth > existing.reportMonth) {
          map.set(key, r);
        }
      }
      filtered = Array.from(map.values());
    }
    return filtered;
  }, [rawData, filterMonthsResult]);

  // 店舗一覧（フィルタ用）
  const storeList = useMemo(() => {
    const stores = new Set(staffListUnsorted.map((s) => s.storeNormalized));
    return Array.from(stores).sort((a, b) => a.localeCompare(b, "ja"));
  }, [staffListUnsorted]);

  // 検索・店舗フィルタ適用
  const staffFiltered = useMemo(() => {
    return staffListUnsorted.filter((s) => {
      // 店舗フィルタ
      if (filterStore !== "all" && s.storeNormalized !== filterStore) return false;
      // 名前検索
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return s.name.toLowerCase().includes(q) || s.storeNormalized.toLowerCase().includes(q);
      }
      return true;
    });
  }, [staffListUnsorted, filterStore, searchQuery]);

  // ソート適用
  const staffList = useMemo(() => {
    const list = [...staffFiltered];
    const dir = sortDirection === "asc" ? 1 : -1;

    list.sort((a, b) => {
      switch (sortField) {
        case "totalSales":
          return (a.totalSales - b.totalSales) * dir;
        case "storeNormalized":
          return a.storeNormalized.localeCompare(b.storeNormalized, "ja") * dir;
        case "employmentType":
          return a.employmentType.localeCompare(b.employmentType, "ja") * dir;
        case "utilizationRate": {
          const rateA = calculateUtilizationRate(a.totalCustomers, a.employmentType) ?? -1;
          const rateB = calculateUtilizationRate(b.totalCustomers, b.employmentType) ?? -1;
          return (rateA - rateB) * dir;
        }
        case "nextReservationRate":
          return (a.nextReservationRate - b.nextReservationRate) * dir;
        default:
          return 0;
      }
    });
    return list;
  }, [staffFiltered, sortField, sortDirection]);

  // スタッフごとのNPS情報を計算
  const staffNpsMap = useMemo(() => {
    const map = new Map<string, StaffNpsInfo>();
    if (!npsRecords.length) return map;

    let filteredNps;
    if (filterMonthsResult === "all") {
      filteredNps = npsRecords;
    } else if (filterMonthsResult.length === 1) {
      filteredNps = filterByMonth(npsRecords, filterMonthsResult[0]);
    } else {
      const monthSet = new Set(filterMonthsResult);
      filteredNps = npsRecords.filter((r) => {
        const d = new Date(r.date);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        return monthSet.has(ym);
      });
    }

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
  }, [npsRecords, filterMonthsResult]);

  const monthLabel = getPeriodLabel(periodSelection);

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  useEffect(() => {
    if (rawData.length > 0) setLastUpdated(new Date());
  }, [rawData]);

  const handleStaffClick = (staffName: string, storeName: string) => {
    navigate(`/staff/${encodeURIComponent(storeName)}/${encodeURIComponent(staffName)}`);
  };

  // ソートラベル表示
  const sortLabel = `${SORT_LABELS[sortField]}${sortDirection === "asc" ? "↑" : "↓"}`;

  // 月間表彰: エクセレント！達成スタッフ
  const { reservationExcellentList, utilizationExcellentList } = useMemo(() => {
    if (!staffListUnsorted.length) return { reservationExcellentList: [] as { name: string; store: string; nextReservationRate: number; utilizationRate: number | null; employmentType: string }[], utilizationExcellentList: [] as { name: string; store: string; nextReservationRate: number; utilizationRate: number | null; employmentType: string }[] };

    const staffWithRates = staffListUnsorted
      .filter((r) => !isRetiredStaff(r.name, r.storeNormalized, r.reportMonth))
      .map((r) => {
        const utilRate = calculateUtilizationRate(r.totalCustomers, r.employmentType);
        return {
          name: r.name,
          store: r.storeNormalized,
          employmentType: r.employmentType,
          nextReservationRate: r.nextReservationRate,
          utilizationRate: utilRate,
        };
      });

    const reservationList = staffWithRates
      .filter((s) => s.nextReservationRate >= 85)
      .sort((a, b) => b.nextReservationRate - a.nextReservationRate);

    const utilizationList = staffWithRates
      .filter((s) => s.utilizationRate !== null && s.utilizationRate >= 95)
      .sort((a, b) => (b.utilizationRate ?? 0) - (a.utilizationRate ?? 0));

    return { reservationExcellentList: reservationList, utilizationExcellentList: utilizationList };
  }, [staffListUnsorted]);

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
            {filterStore !== "all" ? `${filterStore}の` : "全店舗の"}スタッフ個人実績（{SORT_LABELS[sortField]}{sortDirection === "asc" ? "昇順" : "降順"}）
            {staffList.length > 0 && ` — ${staffList.length}名`}
            {staffList.length < staffListUnsorted.length && staffList.length > 0 && ` / 全${staffListUnsorted.length}名`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/">
            <span className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors cursor-pointer">
              <Building2 className="w-4 h-4" />
              店舗一覧へ
            </span>
          </Link>
          <PeriodSelector
            allMonths={availableMonths}
            selection={periodSelection}
            onChange={setPeriodSelection}
          />
        </div>
      </div>

      {/* 月間表彰セクション */}
      {!loading && (reservationExcellentList.length > 0 || utilizationExcellentList.length > 0) && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-sm">
              <Trophy className="w-3 h-3 text-white" />
            </div>
            <h2 className="text-base font-bold text-foreground">月間表彰</h2>
            <span className="text-[10px] text-muted-foreground">エクセレント！達成（{getPeriodLabel(periodSelection)}）</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* 次回予約部門 */}
            {reservationExcellentList.length > 0 && (
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-50/40 via-yellow-50/20 to-amber-50/40 rounded-xl" />
                <div className="relative border border-amber-200/50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <CalendarCheck className="w-3.5 h-3.5 text-amber-500" />
                    <span className="font-bold text-xs text-foreground">次回予約部門</span>
                    <span className="text-[9px] text-muted-foreground ml-0.5">{reservationExcellentList.length}名</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5">
                    {reservationExcellentList.map((staff, i) => (
                      <Link key={`res-${staff.name}-${staff.store}`} href={`/staff/${encodeURIComponent(staff.store)}/${encodeURIComponent(staff.name)}`}>
                        <div className="flex items-center gap-1.5 py-1 px-1.5 rounded-md hover:bg-amber-100/40 transition-colors cursor-pointer group">
                          <span className="w-4 text-[10px] font-bold text-amber-500 text-center shrink-0">{i + 1}</span>
                          <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors truncate flex-1">{staff.name}</span>
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-600 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300/80 rounded-full px-1.5 py-px shadow-sm shrink-0">
                            <Trophy className="w-2 h-2 text-amber-500" />
                            {staff.nextReservationRate}%
                            <Sparkles className="w-2 h-2 text-amber-400" />
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 稼働率部門 */}
            {utilizationExcellentList.length > 0 && (
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/40 via-teal-50/20 to-emerald-50/40 rounded-xl" />
                <div className="relative border border-emerald-200/50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Gauge className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="font-bold text-xs text-foreground">稼働率部門</span>
                    <span className="text-[9px] text-muted-foreground ml-0.5">{utilizationExcellentList.length}名</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5">
                    {utilizationExcellentList.map((staff, i) => (
                      <Link key={`util-${staff.name}-${staff.store}`} href={`/staff/${encodeURIComponent(staff.store)}/${encodeURIComponent(staff.name)}`}>
                        <div className="flex items-center gap-1.5 py-1 px-1.5 rounded-md hover:bg-emerald-100/40 transition-colors cursor-pointer group">
                          <span className="w-4 text-[10px] font-bold text-emerald-500 text-center shrink-0">{i + 1}</span>
                          <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors truncate flex-1">{staff.name}</span>
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-600 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300/80 rounded-full px-1.5 py-px shadow-sm shrink-0">
                            <Trophy className="w-2 h-2 text-emerald-500" />
                            {staff.utilizationRate}%
                            <Sparkles className="w-2 h-2 text-emerald-400" />
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search & Store Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="スタッフ名で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4 text-muted-foreground" />
          <Select value={filterStore} onValueChange={setFilterStore}>
            <SelectTrigger className="w-[160px] bg-white">
              <SelectValue placeholder="店舗" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全店舗</SelectItem>
              {storeList.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Mobile Sort Controls */}
      <div className="md:hidden flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        {(["nextReservationRate", "utilizationRate", "totalSales", "storeNormalized", "employmentType"] as SortField[]).map((field) => (
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
              {staffListUnsorted.length === 0
                ? "この期間のスタッフデータはありません"
                : "検索条件に一致するスタッフがいません"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Staff List */}
      {!loading && staffList.length > 0 && (
        <>
          {/* Table Header (desktop) — simplified since metrics are now in card body */}
          <div className="hidden md:flex items-center justify-between px-4 py-2 text-[10px] text-muted-foreground font-medium uppercase tracking-wider border-b border-border/40 mb-2">
            <div className="flex items-center gap-6">
              <span>氏名</span>
              <span
                className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors select-none"
                onClick={() => handleSort("storeNormalized")}
              >
                配属店舗 {getSortIcon("storeNormalized")}
              </span>
              <span
                className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors select-none"
                onClick={() => handleSort("employmentType")}
              >
                雇用形態 {getSortIcon("employmentType")}
              </span>
            </div>
            <div className="flex items-center gap-6">
              <span
                className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors select-none"
                onClick={() => handleSort("nextReservationRate")}
              >
                次回予約率 {getSortIcon("nextReservationRate")}
              </span>
              <span
                className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors select-none"
                onClick={() => handleSort("utilizationRate")}
              >
                稼働率 {getSortIcon("utilizationRate")}
              </span>
              <span
                className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors select-none"
                onClick={() => handleSort("totalSales")}
              >
                総売上 {getSortIcon("totalSales")}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {staffList.map((staff, i) => {
              const staffKey = `${staff.answerId}-${i}`;
              const utilRate = calculateUtilizationRate(staff.totalCustomers, staff.employmentType);

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
                      <div className="hidden md:block px-5 py-3">
                        <div className="grid grid-cols-[2fr_2fr_2fr_2fr_2fr_3fr] gap-3 items-center">
                          <div className="flex items-center gap-3">
                            {staff.photoUrl2 ? (
                              <img src={staff.photoUrl2} alt={staff.name} className="w-9 h-9 rounded-full object-cover object-center shrink-0" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="text-primary font-bold text-sm">{staff.name.charAt(0)}</span>
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{staff.name}</span>
                                {isNewStaff(staff.name, staff.storeNormalized) && (
                                  <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1 py-0.5 leading-none">NEW</span>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="col-span-2 text-right">
                            <span className="font-mono-data text-base font-bold text-foreground">{formatCurrency(staff.totalSales)}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              {staff.storeNormalized}
                            </span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-xs text-muted-foreground">{staff.employmentType}</span>
                          </div>
                          {/* 稼働率 */}
                          <div className="col-span-2 text-right">
                            {utilRate !== null ? (
                              <div className="flex flex-col items-end">
                                <div className="flex items-center justify-end gap-1 mb-0.5">
                                  <Gauge className="w-3 h-3 text-muted-foreground" />
                                  <span className="text-[10px] font-medium text-muted-foreground">稼働率</span>
                                </div>
                                <span className={`font-mono-data text-base font-bold flex items-center justify-end gap-1 ${getUtilizationColor(utilRate)}`}>
                                  {utilRate <= 89 && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5" title="要改善">
                                      <AlertTriangle className="w-3 h-3" />
                                      要改善
                                    </span>
                                  )}
                                  {utilRate}%
                                </span>
                                {utilRate >= 95 && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300 rounded-full px-2 py-0.5 shadow-sm">
                                    <Trophy className="w-3 h-3 text-amber-500" />
                                    エクセレント！
                                    <Sparkles className="w-3 h-3 text-amber-400" />
                                  </span>
                                )}
                                {utilRate >= 90 && utilRate < 95 && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#E5B85C] bg-amber-50/60 border border-amber-200/60 rounded-full px-2 py-0.5">
                                    <CircleCheck className="w-3 h-3 text-[#E5B85C]" />
                                    適正
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                          {/* 次回予約率 */}
                          <div className="col-span-3 text-right">
                            <div className="flex items-center justify-end gap-1 mb-0.5">
                              <CalendarCheck className="w-3 h-3 text-muted-foreground" />
                              <span className="text-[10px] font-medium text-muted-foreground">次回予約率</span>
                            </div>
                            <span className={`font-mono-data text-base font-bold flex items-center justify-end gap-1 ${
                              staff.nextReservationRate >= 85 ? "text-[#2D9C8F]" :
                              staff.nextReservationRate >= 70 ? "text-[#E5B85C]" :
                              "text-[#C75C5C]"
                            }`}>
                              {staff.nextReservationRate <= 69 && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5" title="要改善">
                                  <AlertTriangle className="w-3 h-3" />
                                  要改善
                                </span>
                              )}
                              {staff.nextReservationRate >= 85 && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300 rounded-full px-2 py-0.5 shadow-sm">
                                  <Trophy className="w-3 h-3 text-amber-500" />
                                  エクセレント！
                                  <Sparkles className="w-3 h-3 text-amber-400" />
                                </span>
                              )}
                              {staff.nextReservationRate >= 70 && staff.nextReservationRate <= 84 && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#E5B85C] bg-amber-50/60 border border-amber-200/60 rounded-full px-2 py-0.5">
                                  <CircleCheck className="w-3 h-3 text-[#E5B85C]" />
                                  適正
                                </span>
                              )}
                              {staff.nextReservationRate}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Mobile Layout */}
                      <div className="md:hidden p-4">
                        <div className="flex items-center gap-2">
                          {staff.photoUrl2 ? (
                            <img src={staff.photoUrl2} alt={staff.name} className="w-8 h-8 rounded-full object-cover object-center shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-primary font-bold text-xs">{staff.name.charAt(0)}</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{staff.name}</span>
                                {isNewStaff(staff.name, staff.storeNormalized) && (
                                  <span className="text-[9px] font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1 py-0.5 leading-none">NEW</span>
                                )}
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
                              <div className="flex items-center gap-2 shrink-0">
                                {/* 稼働率（モバイル） */}
                                {utilRate !== null && (
                                  <span className={`text-[11px] font-mono-data font-bold flex items-center gap-1 ${getUtilizationColor(utilRate)}`}>
                                    {utilRate <= 89 ? (
                                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-1 py-0.5">
                                        <AlertTriangle className="w-2.5 h-2.5" />
                                        要改善
                                      </span>
                                    ) : utilRate >= 95 ? (
                                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-600 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300 rounded-full px-1.5 py-0.5 shadow-sm">
                                        <Trophy className="w-2.5 h-2.5 text-amber-500" />
                                        <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                                      </span>
                                    ) : utilRate >= 90 ? (
                                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-[#E5B85C] bg-amber-50/60 border border-amber-200/60 rounded-full px-1.5 py-0.5">
                                        <CircleCheck className="w-2.5 h-2.5 text-[#E5B85C]" />
                                      </span>
                                    ) : (
                                      <Activity className="w-3 h-3 inline mr-0.5" />
                                    )}
                                    稼働率 {utilRate}%
                                  </span>
                                )}
                                {/* 次回予約率（モバイル） */}
                                <span className={`text-[11px] font-mono-data font-bold flex items-center gap-1 ${
                                  staff.nextReservationRate >= 85 ? "text-[#2D9C8F]" :
                                  staff.nextReservationRate >= 70 ? "text-[#E5B85C]" :
                                  "text-[#C75C5C]"
                                }`}>
                                  {staff.nextReservationRate <= 69 ? (
                                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-1 py-0.5">
                                      <AlertTriangle className="w-2.5 h-2.5" />
                                      要改善
                                    </span>
                                  ) : staff.nextReservationRate >= 85 ? (
                                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-600 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300 rounded-full px-1.5 py-0.5 shadow-sm">
                                      <Trophy className="w-2.5 h-2.5 text-amber-500" />
                                      <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                                    </span>
                                  ) : staff.nextReservationRate >= 70 ? (
                                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-[#E5B85C] bg-amber-50/60 border border-amber-200/60 rounded-full px-1.5 py-0.5">
                                      <CircleCheck className="w-2.5 h-2.5 text-[#E5B85C]" />
                                    </span>
                                  ) : null}
                                  予約率 {staff.nextReservationRate}%
                                </span>
                              </div>
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
