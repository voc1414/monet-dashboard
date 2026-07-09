/**
 * Design: monet Brand Identity — 水彩ブルー × コンクリートモダン
 * Page: スタッフ一覧（全店舗横断・ソート機能付き）
 * Columns: 氏名、総売上、配属店舗、雇用形態、稼働率、次回予約率、NPS
 * Feature: カード全体クリックでスタッフ個人ページへ遷移
 */
import { useState, useMemo, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Users, Building2, AlertTriangle, Search, Store,
  ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Activity,
  Sparkles, Trophy, CircleCheck, TrendingUp
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PeriodSelector, getDefaultPeriodSelection, getFilterMonths, getPeriodLabel } from "@/components/PeriodSelector";
import type { PeriodSelection } from "@/components/PeriodSelector";
import DashboardLayout from "@/components/DashboardLayout";
import { useMonthlyReport } from "@/hooks/useMonthlyReport";
import { useNpsData, filterByMonth } from "@/hooks/useNpsData";
import { useSalonBoardStylistData } from "@/hooks/useSalonBoardStylistData";
import type { StaffReport } from "@/hooks/useMonthlyReport";
import { isNewStaff, isRetiredStaff } from "@/lib/newBadge";
import { useStores } from "@/hooks/useStores";
import { calculateUtilizationRate, getUtilizationColor, getUtilizationLabel } from "@/lib/utilizationRate";
import { getNpsClass } from "@/lib/npsClass";
import { calculateCompositeScore, getCompositeRank } from "@/lib/compositeScore";
import type { CompositeScoreResult } from "@/lib/compositeScore";
import { normalizeStaffKey } from "@/lib/staffNameAlias";


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

type SortField = "totalSales" | "storeNormalized" | "employmentType" | "utilizationRate" | "nextReservationRate" | "npsScore" | "compositeScore";
type SortDirection = "asc" | "desc";

const SORT_LABELS: Record<SortField, string> = {
  compositeScore: "総合点",
  totalSales: "総売上",
  storeNormalized: "配属店舗",
  employmentType: "雇用形態",
  utilizationRate: "稼働率",
  nextReservationRate: "次回予約率",
  npsScore: "NPS",
};

/** Compact NPS badge for staff list */
function StaffNpsBadge({ npsInfo }: { npsInfo: StaffNpsInfo | undefined }) {
  if (!npsInfo || npsInfo.totalResponses === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const npsClass = getNpsClass(npsInfo.npsScore);
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono-data font-bold border"
        style={{ backgroundColor: npsClass.bgColor, color: npsClass.color, borderColor: npsClass.borderColor }}
      >
        {npsInfo.npsScore > 0 ? "+" : ""}{npsInfo.npsScore}
      </span>
      <span className="text-[9px] font-medium" style={{ color: npsClass.color }}>
        {npsClass.label}
      </span>
    </div>
  );
}

/** Mobile compact NPS badge */
function StaffNpsBadgeMobile({ npsInfo }: { npsInfo: StaffNpsInfo | undefined }) {
  if (!npsInfo || npsInfo.totalResponses === 0) {
    return null;
  }
  const npsClass = getNpsClass(npsInfo.npsScore);
  return (
    <span
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-mono-data font-bold border"
      style={{ backgroundColor: npsClass.bgColor, color: npsClass.color, borderColor: npsClass.borderColor }}
    >
      <TrendingUp className="w-2.5 h-2.5" />
      NPS {npsInfo.npsScore > 0 ? "+" : ""}{npsInfo.npsScore}
    </span>
  );
}

export default function StaffList() {
  const { rawData, loading, error, availableMonths } = useMonthlyReport();
  const { npsAliasMap } = useStores();
  const { records: npsRecords, loading: npsLoading } = useNpsData(npsAliasMap);
  const { getStylistMonth } = useSalonBoardStylistData();
  const [, navigate] = useLocation();

  /**
   * 実績系（売上・客数・新規・再来）は【サロンボードのみ】。林さんの指示により、
   * 売上データに月末報告書は使わない。サロンボードに該当月のデータが無い場合は
   * 月末報告書へフォールバックせず 0（データ無し）を返す。
   * ※雇用形態・次回予約率は別途 report 由来（売上ではないので従来どおり）。
   */
  const getMetrics = useMemo(() => {
    return (staff: StaffReport) => {
      const sb = getStylistMonth(staff.storeNormalized, staff.name, staff.reportMonth);
      if (sb) {
        return {
          totalSales: sb.sales,
          totalCustomers: sb.customers,
          newCustomers: sb.newCustomers,
          returnCustomers: sb.returnCustomers,
          dataSource: "salonboard" as const,
        };
      }
      // サロンボードにデータが無い → 月末報告書は使わず 0
      return {
        totalSales: 0,
        totalCustomers: 0,
        newCustomers: 0,
        returnCustomers: 0,
        dataSource: "none" as const,
      };
    };
  }, [getStylistMonth]);



  // 検索・フィルタ状態
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStore, setFilterStore] = useState("all");

  // ソート状態（デフォルト: 次回予約率の降順）
  const [sortField, setSortField] = useState<SortField>("nextReservationRate");
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

  // 退社スタッフを除外
  const staffListActive = useMemo(() => {
    return staffListUnsorted.filter((s) => !isRetiredStaff(s.name, s.storeNormalized, s.reportMonth));
  }, [staffListUnsorted]);

  // 店舗一覧（フィルタ用）
  const storeList = useMemo(() => {
    const stores = new Set(staffListActive.map((s) => s.storeNormalized));
    return Array.from(stores).sort((a, b) => a.localeCompare(b, "ja"));
  }, [staffListActive]);

  // 検索・店舗フィルタ適用
  const staffFiltered = useMemo(() => {
    return staffListActive.filter((s) => {
      // 店舗フィルタ
      if (filterStore !== "all" && s.storeNormalized !== filterStore) return false;
      // 名前検索
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return s.name.toLowerCase().includes(q) || s.storeNormalized.toLowerCase().includes(q);
      }
      return true;
    });
  }, [staffListActive, filterStore, searchQuery]);

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

    // スペース正規化＋小文字化してグルーピング（NPSシートは"Yoshie"、月末報告書は"yoshie"等の大小違いがある）
    const normalizeStaffName = (n: string) => normalizeStaffKey(n);
    const grouped = new Map<string, number[]>();
    for (const r of filteredNps) {
      const staffName = r.staff?.trim();
      if (!staffName) continue;
      const normName = normalizeStaffName(staffName);
      if (!grouped.has(normName)) grouped.set(normName, []);
      grouped.get(normName)!.push(r.npsScore);
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

  // スタッフごとの総合点スコアを計算
  const compositeScoreMap = useMemo(() => {
    const map = new Map<string, CompositeScoreResult>();
    for (const staff of staffFiltered) {
      const utilRate = calculateUtilizationRate(getMetrics(staff).totalCustomers, staff.employmentType);
      const npsInfo = staffNpsMap.get(normalizeStaffKey(staff.name));



      const result = calculateCompositeScore({
        npsScore: npsInfo && npsInfo.totalResponses > 0 ? npsInfo.npsScore : null,
        npsResponseCount: npsInfo?.totalResponses || 0,
        nextReservationRate: staff.nextReservationRate,
        utilizationRate: utilRate,
      });
      const key = `${staff.name}__${staff.storeNormalized}`;
      map.set(key, result);
    }
    return map;
  }, [staffFiltered, staffNpsMap]);

  // ソート適用
  const staffList = useMemo(() => {
    const list = [...staffFiltered];
    const dir = sortDirection === "asc" ? 1 : -1;

    list.sort((a, b) => {
      switch (sortField) {
        case "totalSales":
          return (getMetrics(a).totalSales - getMetrics(b).totalSales) * dir;
        case "storeNormalized":
          return a.storeNormalized.localeCompare(b.storeNormalized, "ja") * dir;
        case "employmentType":
          return a.employmentType.localeCompare(b.employmentType, "ja") * dir;
        case "utilizationRate": {
          const rateA = calculateUtilizationRate(getMetrics(a).totalCustomers, a.employmentType) ?? -1;
          const rateB = calculateUtilizationRate(getMetrics(b).totalCustomers, b.employmentType) ?? -1;
          return (rateA - rateB) * dir;
        }
        case "nextReservationRate":
          return (a.nextReservationRate - b.nextReservationRate) * dir;
        case "npsScore": {
          const npsA = staffNpsMap.get(normalizeStaffKey(a.name))?.npsScore ?? -999;
          const npsB = staffNpsMap.get(normalizeStaffKey(b.name))?.npsScore ?? -999;
          return (npsA - npsB) * dir;
        }
        case "compositeScore": {
          const scoreA = compositeScoreMap.get(`${a.name}__${a.storeNormalized}`)?.total ?? -1;
          const scoreB = compositeScoreMap.get(`${b.name}__${b.storeNormalized}`)?.total ?? -1;
          return (scoreA - scoreB) * dir;
        }
        default:
          return 0;
      }
    });
    return list;
  }, [staffFiltered, sortField, sortDirection, staffNpsMap, compositeScoreMap]);

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
            {monthLabel}
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
      <div className="md:hidden mb-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(["compositeScore", "nextReservationRate", "utilizationRate", "npsScore", "totalSales", "storeNormalized", "employmentType"] as SortField[]).map((field) => (
            <button
              key={field}
              onClick={() => handleSort(field)}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-colors border ${
                sortField === field
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-card text-muted-foreground border-border/50 hover:bg-accent/50"
              }`}
            >
              {SORT_LABELS[field]}
              {sortField === field && (
                sortDirection === "asc"
                  ? <ArrowUp className="w-3 h-3 shrink-0" />
                  : <ArrowDown className="w-3 h-3 shrink-0" />
                )}
            </button>
          ))}
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
          {/* Table Header (desktop) - sticky */}
          <div className="hidden md:grid grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.5fr)] gap-3 items-center px-5 py-2 text-[10px] text-muted-foreground font-medium uppercase tracking-wider border-b border-border/40 mb-2 sticky top-[4rem] bg-[#FAF8F5] z-20 backdrop-blur-sm shadow-sm">
            <span>氏名</span>
            <span
              className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors select-none justify-center"
              onClick={() => handleSort("compositeScore")}
            >
              総合点 {getSortIcon("compositeScore")}
            </span>
            <span
              className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors select-none"
              onClick={() => handleSort("totalSales")}
            >
              総売上 {getSortIcon("totalSales")}
            </span>
            <span
              className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors select-none"
              onClick={() => handleSort("storeNormalized")}
            >
              店舗 {getSortIcon("storeNormalized")}
            </span>
            <span
              className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors select-none"
              onClick={() => handleSort("employmentType")}
            >
              勤務形態 {getSortIcon("employmentType")}
            </span>
            <span
              className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors select-none justify-end"
              onClick={() => handleSort("nextReservationRate")}
            >
              次回予約率 {getSortIcon("nextReservationRate")}
            </span>
            <span
              className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors select-none justify-end"
              onClick={() => handleSort("npsScore")}
            >
              NPS {getSortIcon("npsScore")}
            </span>
            <span
              className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors select-none justify-end"
              onClick={() => handleSort("utilizationRate")}
            >
              稼働率 {getSortIcon("utilizationRate")}
            </span>
            <span />
          </div>

          <div className="space-y-2">
            {staffList.map((staff, i) => {
              const staffKey = `${staff.answerId}-${i}`;
              const metrics = getMetrics(staff);
              const utilRate = calculateUtilizationRate(metrics.totalCustomers, staff.employmentType);
              const npsInfo = staffNpsMap.get(normalizeStaffKey(staff.name));

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
                      <div className="hidden md:grid grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.5fr)] gap-3 items-center px-5 py-3">
                        {/* 氏名 */}
                        <div className="flex items-center gap-3">
                          {staff.photoUrl2 ? (
                            <img src={staff.photoUrl2} alt={staff.name} className="w-9 h-9 rounded-full object-cover object-center shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-primary font-bold text-sm">{staff.name.charAt(0)}</span>
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors truncate">{staff.name}</span>
                              {isNewStaff(staff.name, staff.storeNormalized) && (
                                <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1 py-0.5 leading-none shrink-0">NEW</span>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* 総合点 */}
                        {(() => {
                          const scoreKey = `${staff.name}__${staff.storeNormalized}`;
                          const scoreResult = compositeScoreMap.get(scoreKey);
                          if (!scoreResult) return <div className="text-center"><span className="text-xs text-muted-foreground">—</span></div>;
                          return (
                            <div className="flex flex-col items-center gap-0.5">
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono-data font-bold border"
                                style={{ backgroundColor: scoreResult.rank.bgColor, color: scoreResult.rank.color, borderColor: scoreResult.rank.borderColor }}
                              >
                                {scoreResult.total}点
                              </span>
                              <span className="text-[9px] font-medium" style={{ color: scoreResult.rank.color }}>
                                {scoreResult.rank.label}
                              </span>
                            </div>
                          );
                        })()}
                        {/* 総売上 */}
                        <div>
                          <span className="font-mono-data text-sm font-bold text-foreground">{formatCurrency(metrics.totalSales)}</span>
                        </div>
                        {/* 店舗 */}
                        <div>
                          <span className="text-xs text-muted-foreground truncate">{staff.storeNormalized}</span>
                        </div>
                        {/* 勤務形態 */}
                        <div>
                          <span className="text-xs text-muted-foreground">{staff.employmentType}</span>
                        </div>
                        {/* 次回予約率 */}
                        <div className="text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className={`font-mono-data text-sm font-bold ${
                              staff.nextReservationRate >= 85 ? "text-[#2D9C8F]" :
                              staff.nextReservationRate >= 70 ? "text-[#E5B85C]" :
                              "text-[#C75C5C]"
                            }`}>
                              {staff.nextReservationRate}%
                            </span>
                            {staff.nextReservationRate >= 85 && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-600 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300 rounded-full px-1.5 py-0.5 shadow-sm">
                                <Trophy className="w-2.5 h-2.5 text-amber-500" />
                                エクセレント！
                                <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                              </span>
                            )}
                            {staff.nextReservationRate >= 70 && staff.nextReservationRate <= 84 && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-[#E5B85C] bg-amber-50/60 border border-amber-200/60 rounded-full px-1.5 py-0.5">
                                <CircleCheck className="w-2.5 h-2.5 text-[#E5B85C]" />
                                適正
                              </span>
                            )}
                            {staff.nextReservationRate <= 69 && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                要改善
                              </span>
                            )}
                          </div>
                        </div>
                        {/* NPS */}
                        <div className="text-right">
                          <StaffNpsBadge npsInfo={npsInfo} />
                        </div>
                        {/* 稼働率 */}
                        <div className="text-right">
                          {utilRate !== null ? (
                            <div className="flex flex-col items-end gap-0.5">
                              <span className={`font-mono-data text-sm font-bold ${getUtilizationColor(utilRate)}`}>
                                {utilRate}%
                              </span>
                              {utilRate >= 95 && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-600 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300 rounded-full px-1.5 py-0.5 shadow-sm">
                                  <Trophy className="w-2.5 h-2.5 text-amber-500" />
                                  エクセレント！
                                  <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                                </span>
                              )}
                              {utilRate >= 90 && utilRate < 95 && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-[#E5B85C] bg-amber-50/60 border border-amber-200/60 rounded-full px-1.5 py-0.5">
                                  <CircleCheck className="w-2.5 h-2.5 text-[#E5B85C]" />
                                  適正
                                </span>
                              )}
                              {utilRate <= 89 && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  要改善
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                        {/* Arrow */}
                        <div className="flex justify-end">
                          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>

                      {/* Mobile Layout */}
                      <div className="md:hidden px-3 py-2">
                        <div className="flex items-start gap-2">
                          {staff.photoUrl2 ? (
                            <img src={staff.photoUrl2} alt={staff.name} className="w-8 h-8 rounded-full object-cover object-center shrink-0 mt-0.5" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                              <span className="text-primary font-bold text-xs">{staff.name.charAt(0)}</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            {/* 1行目: 名前 + 総合点 + 売上 */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors truncate">{staff.name}</span>
                                {isNewStaff(staff.name, staff.storeNormalized) && (
                                  <span className="text-[9px] font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1 py-0.5 leading-none shrink-0">NEW</span>
                                )}
                                {(() => {
                                  const scoreKey = `${staff.name}__${staff.storeNormalized}`;
                                  const scoreResult = compositeScoreMap.get(scoreKey);
                                  if (!scoreResult) return null;
                                  return (
                                    <span
                                      className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-mono-data font-bold border shrink-0"
                                      style={{ backgroundColor: scoreResult.rank.bgColor, color: scoreResult.rank.color, borderColor: scoreResult.rank.borderColor }}
                                    >
                                      {scoreResult.total}点
                                    </span>
                                  );
                                })()}
                              </div>
                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                <span className="text-[9px] text-muted-foreground">売上</span>
                                <span className="font-mono-data text-base font-bold text-foreground">{formatCurrency(metrics.totalSales)}</span>
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              </div>
                            </div>
                            {/* 2行目: 店舗名 + 雇用形態 */}
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                                <Building2 className="w-3 h-3 shrink-0" />
                                <span className="truncate">{staff.storeNormalized}</span>
                              </span>
                              <span className="text-[10px] text-muted-foreground/70 shrink-0">{staff.employmentType}</span>
                            </div>
                            {/* 3行目: 稼働率・予約率（横並び） */}
                            <div className="flex items-start justify-between mt-1.5 gap-3">
                              {/* 左側: 稼働率・次回予約率（横並び） */}
                              <div className="flex gap-4 min-w-0 flex-wrap">
                                {/* 稼働率 */}
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[9px] text-muted-foreground leading-none">稼働率</span>
                                  <div className="flex items-center gap-1.5">
                                    {utilRate !== null ? (
                                      <>
                                        <span className={`text-sm font-mono-data font-bold ${getUtilizationColor(utilRate)}`}>
                                          {utilRate}%
                                        </span>
                                        {utilRate <= 89 ? (
                                          <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-1 py-0.5 leading-none">
                                            <AlertTriangle className="w-2.5 h-2.5" />
                                            要改善
                                          </span>
                                        ) : utilRate >= 95 ? (
                                          <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-amber-600 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300 rounded-full px-1 py-0.5 leading-none shadow-sm">
                                            <Trophy className="w-2.5 h-2.5 text-amber-500" />
                                          </span>
                                        ) : utilRate >= 90 ? (
                                          <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-[#E5B85C] bg-amber-50/60 border border-amber-200/60 rounded-full px-1 py-0.5 leading-none">
                                            <CircleCheck className="w-2.5 h-2.5 text-[#E5B85C]" />
                                            適正
                                          </span>
                                        ) : null}
                                      </>
                                    ) : (
                                      <span className="text-sm text-muted-foreground">—</span>
                                    )}
                                  </div>
                                </div>
                                {/* 次回予約率 */}
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[9px] text-muted-foreground leading-none">次回予約</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className={`text-sm font-mono-data font-bold ${
                                      staff.nextReservationRate >= 85 ? "text-[#2D9C8F]" :
                                      staff.nextReservationRate >= 70 ? "text-[#E5B85C]" :
                                      "text-[#C75C5C]"
                                    }`}>
                                      {staff.nextReservationRate}%
                                    </span>
                                    {staff.nextReservationRate <= 69 ? (
                                      <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-1 py-0.5 leading-none">
                                        <AlertTriangle className="w-2.5 h-2.5" />
                                        要改善
                                      </span>
                                    ) : staff.nextReservationRate >= 85 ? (
                                      <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-amber-600 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300 rounded-full px-1 py-0.5 leading-none shadow-sm">
                                        <Trophy className="w-2.5 h-2.5 text-amber-500" />
                                      </span>
                                    ) : staff.nextReservationRate >= 70 ? (
                                      <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-[#E5B85C] bg-amber-50/60 border border-amber-200/60 rounded-full px-1 py-0.5 leading-none">
                                        <CircleCheck className="w-2.5 h-2.5 text-[#E5B85C]" />
                                        適正
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </div>

                            </div>
                            {/* NPS（モバイル） */}
                            {npsInfo && npsInfo.totalResponses > 0 && (
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-[9px] text-muted-foreground">NPS</span>
                                <StaffNpsBadgeMobile npsInfo={npsInfo} />
                                <span className="text-[9px] text-muted-foreground">({npsInfo.totalResponses}件)</span>
                              </div>
                            )}

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
