/**
 * Design: Atelier Blanc — クリーンアトリエ
 * Page: スタッフ一覧（全店舗横断・総売上順）
 * Columns: 氏名、総売上、配属店舗、雇用形態、次回予約率
 */
import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Users, Calendar, Building2, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DashboardLayout from "@/components/DashboardLayout";
import { useMonthlyReport } from "@/hooks/useMonthlyReport";
import type { StaffReport } from "@/hooks/useMonthlyReport";

const formatCurrency = (n: number) => {
  if (n === 0) return "—";
  return `¥${n.toLocaleString()}`;
};

const formatMonth = (m: string) => {
  const [y, mo] = m.split("-");
  return `${y}年${parseInt(mo)}月`;
};

export default function StaffList() {
  const { rawData, loading, error, availableMonths } = useMonthlyReport();

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

  // 選択月のスタッフデータを総売上順でソート
  const staffList = useMemo(() => {
    if (!rawData.length) return [];
    let filtered: StaffReport[];
    if (activeMonth === "all") {
      // 全期間: 同一名+同一店舗で最新のレコードのみ
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

  const monthLabel = activeMonth === "all" ? "全期間" : formatMonth(activeMonth);

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  useEffect(() => {
    if (rawData.length > 0) setLastUpdated(new Date());
  }, [rawData]);

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
            <Users className="w-5 h-5 text-[#9B8579]" />
            スタッフ一覧
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            全店舗のスタッフ個人実績（総売上順）
            {staffList.length > 0 && ` — ${staffList.length}名`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/">
            <span className="flex items-center gap-1 text-sm text-[#9B8579] hover:text-[#7D6B61] transition-colors cursor-pointer">
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
            {staffList.map((staff, i) => (
              <motion.div
                key={`${staff.answerId}-${i}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.02 * i }}
              >
                <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    {/* Desktop Layout */}
                    <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#9B8579]/10 flex items-center justify-center shrink-0">
                          <span className="text-[#9B8579] font-bold text-sm">{staff.name.charAt(0)}</span>
                        </div>
                        <span className="font-bold text-sm text-foreground">{staff.name}</span>
                      </div>
                      <div className="col-span-3 text-right">
                        <span className="font-mono-data text-base font-bold text-foreground">{formatCurrency(staff.totalSales)}</span>
                      </div>
                      <div className="col-span-2">
                        <Link href={`/store/${encodeURIComponent(staff.storeNormalized)}`}>
                          <span className="text-sm text-[#9B8579] hover:text-[#7D6B61] transition-colors cursor-pointer flex items-center gap-1">
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
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#9B8579]/10 flex items-center justify-center shrink-0">
                            <span className="text-[#9B8579] font-bold text-sm">{staff.name.charAt(0)}</span>
                          </div>
                          <div>
                            <div className="font-bold text-sm text-foreground">{staff.name}</div>
                            <div className="text-[10px] text-muted-foreground">{staff.employmentType}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono-data text-base font-bold text-foreground">{formatCurrency(staff.totalSales)}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <Link href={`/store/${encodeURIComponent(staff.storeNormalized)}`}>
                          <span className="text-[#9B8579] hover:text-[#7D6B61] transition-colors cursor-pointer flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {staff.storeNormalized}
                          </span>
                        </Link>
                        <span className={`font-mono-data font-bold ${
                          staff.nextReservationRate >= 80 ? "text-[#2D9C8F]" :
                          staff.nextReservationRate >= 60 ? "text-[#E5B85C]" :
                          "text-[#C75C5C]"
                        }`}>
                          次回予約 {staff.nextReservationRate}%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
