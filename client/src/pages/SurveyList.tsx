/**
 * Design: Atelier Blanc — クリーンアトリエ
 * Page: スタッフ別アンケート一覧
 * Colors: Warm white base, monet water-blue accent
 */
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  ClipboardList, MapPin, ChevronRight, BarChart3, Star, Users, Search, Store
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DashboardLayout from "@/components/DashboardLayout";
import { useMonthlyReport } from "@/hooks/useMonthlyReport";
import { useNpsData, getAvailableMonths } from "@/hooks/useNpsData";
import { getNpsClass } from "@/lib/npsClass";
import { isNewStaff, isRetiredStaff } from "@/lib/newBadge";
import { PeriodSelector, getDefaultPeriodSelection, getFilterMonths, getPeriodLabel } from "@/components/PeriodSelector";
import type { PeriodSelection } from "@/components/PeriodSelector";
import type { StaffReport } from "@/hooks/useMonthlyReport";

export default function SurveyList() {
  const { rawData, loading: monthlyLoading, availableMonths: reportMonths } = useMonthlyReport();
  const { records: npsRecords, loading: npsLoading, lastUpdated, refresh } = useNpsData();
  const loading = monthlyLoading || npsLoading;

  // 期間セレクタ
  const npsMonths = useMemo(() => getAvailableMonths(npsRecords), [npsRecords]);
  const allMonths = useMemo(() => {
    const set = new Set([...npsMonths, ...reportMonths]);
    return Array.from(set).sort().reverse();
  }, [npsMonths, reportMonths]);

  const [periodSelection, setPeriodSelection] = useState<PeriodSelection>(getDefaultPeriodSelection());
  const filterMonths = useMemo(() => getFilterMonths(periodSelection, allMonths), [periodSelection, allMonths]);
  const isAllPeriod = filterMonths === "all";

  // 検索・フィルタ
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStore, setFilterStore] = useState("all");

  // スタッフリスト構築（期間フィルタ連動）
  const staffList = useMemo(() => {
    if (!rawData.length) return [];
    let filtered: StaffReport[];
    if (isAllPeriod) {
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
    } else if ((filterMonths as string[]).length === 1) {
      filtered = rawData.filter((r) => r.reportMonth === (filterMonths as string[])[0]);
    } else {
      const monthSet = new Set(filterMonths as string[]);
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
    // 退社スタッフを除外
    return filtered.filter((s) => !isRetiredStaff(s.name, s.storeNormalized, s.reportMonth));
  }, [rawData, filterMonths, isAllPeriod]);

  // 店舗リスト（フィルタ用）
  const storeList = useMemo(() => {
    const stores = new Set(staffList.map((s) => s.storeNormalized));
    return Array.from(stores).sort();
  }, [staffList]);

  // 各スタッフのNPS情報を計算
  const staffNpsMap = useMemo(() => {
    const map = new Map<string, { total: number; npsScore: number }>();
    // 期間でフィルタしたNPSレコード
    let filteredNps = npsRecords;
    if (!isAllPeriod) {
      filteredNps = npsRecords.filter(r => {
        if (!r.date) return false;
        const ym = r.date.substring(0, 7).replace(/\//g, "-");
        return (filterMonths as string[]).includes(ym);
      });
    }
    // スタッフ名でグルーピング
    for (const r of filteredNps) {
      if (!r.staff || r.staff.trim() === "") continue;
      const key = `${r.staff}__${r.storeShort}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { total: 0, npsScore: 0 });
      }
    }
    // 再集計
    const groupedByStaff = new Map<string, typeof filteredNps>();
    for (const r of filteredNps) {
      if (!r.staff || r.staff.trim() === "") continue;
      const key = `${r.staff}__${r.storeShort}`;
      const arr = groupedByStaff.get(key) || [];
      arr.push(r);
      groupedByStaff.set(key, arr);
    }
    for (const [key, records] of Array.from(groupedByStaff.entries())) {
      const total = records.length;
      const promoters = records.filter((r: (typeof filteredNps)[number]) => r.npsScore >= 9).length;
      const detractors = records.filter((r: (typeof filteredNps)[number]) => r.npsScore <= 6).length;
      const npsScore = Math.round(((promoters - detractors) / total) * 100);
      map.set(key, { total, npsScore });
    }
    return map;
  }, [npsRecords, filterMonths, isAllPeriod]);

  // ファンくるコメント件数（月末報告書から）
  const staffFankuruMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rawData) {
      if (!isAllPeriod && !(filterMonths as string[]).includes(r.reportMonth)) continue;
      if (r.fankuruComment && r.fankuruComment.trim() !== "" && r.fankuruComment.trim() !== "なし") {
        const key = `${r.name}__${r.storeNormalized}`;
        map.set(key, (map.get(key) || 0) + 1);
      }
    }
    return map;
  }, [rawData, filterMonths, isAllPeriod]);

  // フィルタ・検索適用
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      if (filterStore !== "all" && s.storeNormalized !== filterStore) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !s.storeNormalized.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [staffList, filterStore, searchQuery]);

  const breadcrumbs = [
    { label: "ホーム", href: "/" },
    { label: "アンケート一覧" },
  ];

  return (
    <DashboardLayout
      breadcrumbs={breadcrumbs}
      lastUpdated={lastUpdated ?? undefined}
      onRefresh={refresh}
      loading={loading}
    >
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* ヘッダー + 期間セレクタ */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              アンケート一覧
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              スタッフ別NPS・ファンくる調査結果
              <span className="ml-1 text-xs">— {getPeriodLabel(periodSelection)}</span>
            </p>
          </div>
          <PeriodSelector allMonths={allMonths} selection={periodSelection} onChange={setPeriodSelection} />
        </div>

        {/* 検索・フィルタ */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="スタッフ名で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
          <Select value={filterStore} onValueChange={setFilterStore}>
            <SelectTrigger className="w-full sm:w-[160px] bg-white">
              <Store className="w-4 h-4 mr-1 text-muted-foreground" />
              <SelectValue placeholder="店舗" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全店舗</SelectItem>
              {storeList.map((store) => (
                <SelectItem key={store} value={store}>{store}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 件数表示 */}
        {!loading && (
          <p className="text-xs text-muted-foreground">
            {filteredStaff.length}名表示
            {filteredStaff.length < staffList.length && ` / 全${staffList.length}名`}
          </p>
        )}

        {/* ローディング */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">データを読み込み中...</span>
            </div>
          </div>
        )}

        {/* スタッフ一覧 */}
        {!loading && filteredStaff.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Users className="w-8 h-8 opacity-40" />
              <p className="text-sm">
                {staffList.length === 0 ? "この期間のスタッフデータはありません" : "検索条件に一致するスタッフがいません"}
              </p>
            </div>
          </div>
        )}

        {!loading && filteredStaff.length > 0 && (
          <div className="space-y-2">
            {filteredStaff.map((staff, i) => {
              const key = `${staff.name}__${staff.storeNormalized}`;
              const npsInfo = staffNpsMap.get(key);
              const fankuruCount = staffFankuruMap.get(key) || 0;
              const npsClass = npsInfo ? getNpsClass(npsInfo.npsScore) : null;

              return (
                <Link key={key} href={`/staff/${encodeURIComponent(staff.storeNormalized)}/${encodeURIComponent(staff.name)}`}>
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.5) }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="bg-card border border-border/50 rounded-xl p-4 hover:border-primary/30 hover:shadow-md transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-base flex items-center gap-1.5">
                            {staff.name}
                            {isNewStaff(staff.name, staff.storeNormalized) && (
                              <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1 py-0.5 leading-none">NEW</span>
                            )}
                          </h3>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {staff.storeNormalized}
                            </span>
                            {npsInfo && npsInfo.total > 0 && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <BarChart3 className="w-3 h-3" />
                                NPS {npsInfo.total}件
                              </span>
                            )}
                            {fankuruCount > 0 && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Star className="w-3 h-3 text-amber-500" />
                                ファンくる {fankuruCount}件
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {npsInfo && npsInfo.total > 0 && npsClass && (
                          <div className="flex flex-col items-center whitespace-nowrap rounded-xl px-3 py-1.5" style={{ backgroundColor: `${npsClass.color}10` }}>
                            <span className="text-[9px] text-muted-foreground leading-none">NPSスコア</span>
                            <span className="font-mono text-lg font-bold leading-tight" style={{ color: npsClass.color }}>
                              {npsInfo.npsScore > 0 ? "+" : ""}{npsInfo.npsScore}
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
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
