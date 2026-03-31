/*
 * Design: Atelier Blanc — クリーンアトリエ
 * Page: 店舗詳細（売上情報・在籍スタッフ・ファンくる調査・NPS調査結果）
 * Colors: Warm white base, rose taupe accent, sage green secondary
 */
import { useParams, Link } from "wouter";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  MapPin, Users, TrendingUp, BarChart3, ArrowRight, Calendar,
  DollarSign, Scissors, Star, MessageSquare, ChevronDown,
  Trophy, ThumbsUp, Target, AlertTriangle, AlertCircle,
  Lightbulb, CheckCircle2, ArrowUpRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import DashboardLayout from "@/components/DashboardLayout";
import { useNpsData, calculateStoreStats, filterByMonth, getAvailableMonths } from "@/hooks/useNpsData";
import type { NpsRecord, StoreStats } from "@/hooks/useNpsData";
import { getNpsClass, NPS_INDUSTRY_AVERAGE } from "@/lib/npsClass";
import { generateStoreAdvice } from "@/lib/npsAdvice";
import type { NpsAdvice } from "@/lib/npsAdvice";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

const NPS_HEADER_IMAGE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663489426081/aLPZvLfFDC4rFYToBquZNR/nps-header-6cTohzoTSmSjrDCLc4VzHg.webp";

// サンプルスタッフデータ
const SAMPLE_STAFF: Record<string, Array<{ name: string; role: string }>> = {
  "堀江院": [
    { name: "田中 美咲", role: "店長 / スタイリスト" },
    { name: "佐藤 健太", role: "スタイリスト" },
    { name: "山田 花子", role: "スタイリスト" },
    { name: "鈴木 一郎", role: "アシスタント" },
    { name: "高橋 真由", role: "アシスタント" },
  ],
  "堀江院2nd": [
    { name: "中村 優子", role: "店長 / スタイリスト" },
    { name: "小林 大輔", role: "スタイリスト" },
    { name: "加藤 理恵", role: "スタイリスト" },
    { name: "渡辺 翔太", role: "アシスタント" },
  ],
  "福島院": [
    { name: "伊藤 さくら", role: "店長 / スタイリスト" },
    { name: "松本 拓也", role: "スタイリスト" },
    { name: "井上 美月", role: "スタイリスト" },
    { name: "木村 陽介", role: "アシスタント" },
  ],
  "高槻院": [
    { name: "林 由美子", role: "店長 / スタイリスト" },
    { name: "清水 大地", role: "スタイリスト" },
    { name: "森田 愛", role: "アシスタント" },
  ],
  "姪浜院": [
    { name: "岡田 真理", role: "店長 / スタイリスト" },
    { name: "藤井 健", role: "スタイリスト" },
    { name: "西村 恵", role: "アシスタント" },
  ],
  "楽々園院": [
    { name: "石田 裕子", role: "店長 / スタイリスト" },
    { name: "前田 翼", role: "スタイリスト" },
  ],
};

const SAMPLE_REVENUE: Record<string, { revenue: string; unitPrice: string; customers: string; returnRate: string }> = {
  "堀江院": { revenue: "¥4,850,000", unitPrice: "¥12,500", customers: "388", returnRate: "78%" },
  "堀江院2nd": { revenue: "¥3,920,000", unitPrice: "¥11,800", customers: "332", returnRate: "75%" },
  "福島院": { revenue: "¥4,210,000", unitPrice: "¥12,200", customers: "345", returnRate: "76%" },
  "高槻院": { revenue: "¥3,580,000", unitPrice: "¥11,500", customers: "311", returnRate: "72%" },
  "姪浜院": { revenue: "¥2,150,000", unitPrice: "¥10,800", customers: "199", returnRate: "70%" },
  "楽々園院": { revenue: "¥1,780,000", unitPrice: "¥10,500", customers: "169", returnRate: "68%" },
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
                  className="h-full rounded-full bg-[#9B8579]/60 transition-all duration-500"
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
      <h2 className="font-display text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
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
                <ArrowUpRight className="w-4 h-4 text-[#9B8579]" />
                <h4 className="text-sm font-semibold text-foreground">アクションプラン</h4>
              </div>
              <ul className="space-y-2">
                {advice.actionItems.map((s, i) => (
                  <li key={i} className="text-xs text-muted-foreground leading-relaxed flex gap-2">
                    <span className="w-1 h-1 rounded-full bg-[#9B8579] mt-1.5 shrink-0" />
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
  const { records, loading, error, lastUpdated, refresh } = useNpsData();
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedScore, setSelectedScore] = useState<number | null>(null);

  const allMonths = useMemo(() => getAvailableMonths(records), [records]);

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

  const selectedScoreRecords = useMemo(() => {
    if (selectedScore === null) return [];
    return storeRecords.filter((r) => r.npsScore === selectedScore);
  }, [storeRecords, selectedScore]);

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

  const revenue = SAMPLE_REVENUE[storeId] || { revenue: "—", unitPrice: "—", customers: "—", returnRate: "—" };
  const staff = SAMPLE_STAFF[storeId] || [];

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
            <div className="w-12 h-12 rounded-xl bg-[#9B8579]/10 flex items-center justify-center">
              <MapPin className="w-6 h-6 text-[#9B8579]" />
            </div>
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-semibold text-foreground tracking-wide">
                {storeId}
              </h1>
              <p className="text-sm text-muted-foreground">monet 白髪染めと髪質改善のサロン</p>
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

      {/* Revenue Section (Sample) */}
      <section className="mb-8">
        <h2 className="font-display text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-[#9B8579]" />
          売上情報
          <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-2">サンプル</span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "総売上", value: revenue.revenue, icon: DollarSign },
            { label: "技術単価", value: revenue.unitPrice, icon: Scissors },
            { label: "総客数", value: revenue.customers + "名", icon: Users },
            { label: "リピート率", value: revenue.returnRate, icon: TrendingUp },
          ].map((item, i) => (
            <motion.div key={item.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.04 }}>
              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-4">
                  <item.icon className="w-4 h-4 text-[#9B8579] mb-2" />
                  <div className="font-mono-data text-lg font-semibold">{item.value}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{item.label}</div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Staff Section (Sample) */}
      <section className="mb-8">
        <h2 className="font-display text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-[#7D8B75]" />
          在籍スタッフ
          <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-2">サンプル</span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {staff.map((s, i) => (
            <motion.div key={s.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.03 }}>
              <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-[#9B8579]/10 mx-auto mb-2 flex items-center justify-center">
                    <span className="text-[#9B8579] font-medium text-sm">{s.name.charAt(0)}</span>
                  </div>
                  <div className="font-medium text-sm text-foreground">{s.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{s.role}</div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* NPS Survey Results */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#2D9C8F]" />
            NPS調査結果
            {selectedMonth !== "all" && (
              <span className="text-sm font-normal text-muted-foreground">— {formatMonth(selectedMonth)}</span>
            )}
          </h2>
          <Link href={`/store/${encodeURIComponent(storeId)}/nps`}>
            <span className="flex items-center gap-1 text-sm text-[#9B8579] hover:text-[#7D6B61] transition-colors cursor-pointer">
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
                    <div className="font-mono-data text-sm font-semibold text-[#2D9C8F]">{storeStats.promoterPct}%</div>
                    <div className="text-[10px] text-muted-foreground">{storeStats.promoters}件</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">中立者</div>
                    <div className="font-mono-data text-sm font-semibold text-[#B8922A]">{storeStats.passivePct}%</div>
                    <div className="text-[10px] text-muted-foreground">{storeStats.passives}件</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">批判者</div>
                    <div className="font-mono-data text-sm font-semibold text-[#C75C5C]">{storeStats.detractorPct}%</div>
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
                  <BarChart data={scoreDistribution} margin={{ top: 5, right: 5, bottom: 5, left: -20 }} style={{ cursor: "pointer" }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                    <XAxis dataKey="score" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e5e5" }}
                      formatter={(value: number) => [`${value}件`, "回答数"]}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} onClick={(data: any) => { if (data && data.count > 0) setSelectedScore(data.score); }} className="cursor-pointer">
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
          <h2 className="font-display text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#9B8579]" />
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
        <section>
          <h2 className="font-display text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
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
      <Dialog open={selectedScore !== null} onOpenChange={(open) => { if (!open) setSelectedScore(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-mono-data font-bold"
                style={{
                  backgroundColor:
                    selectedScore !== null
                      ? selectedScore >= 9 ? NPS_COLORS.promoter : selectedScore >= 7 ? NPS_COLORS.passive : NPS_COLORS.detractor
                      : "#999",
                }}
              >
                {selectedScore}
              </div>
              スコア {selectedScore} の回答一覧
            </DialogTitle>
            <DialogDescription>
              {selectedScoreRecords.length}件の回答
              {selectedScore !== null && (
                <span className="ml-2">
                  （{selectedScore >= 9 ? "推奨者" : selectedScore >= 7 ? "中立者" : "批判者"}）
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-3 pb-4">
              {selectedScoreRecords.length > 0 ? (
                selectedScoreRecords.map((r, i) => (
                  <Card key={r.no + "-" + i} className="border-border/50 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">{r.menu}</span>
                        <span className="text-[10px] text-muted-foreground">{r.date.split(" ")[0]}</span>
                      </div>
                      {r.review ? (
                        <p className="text-sm text-foreground/80 leading-relaxed mb-2">{r.review}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground/50 italic mb-2">レビューなし</p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {r.priceComment && (
                          <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                            金額: {r.priceComment.split(",")[0].trim()}
                          </span>
                        )}
                        {r.spaceComment && (
                          <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                            空間: {r.spaceComment.split(",")[0].trim()}
                          </span>
                        )}
                        {r.staffComment && (
                          <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                            スタッフ: {r.staffComment.split(",")[0].trim()}
                          </span>
                        )}
                        {r.finishComment && (
                          <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                            仕上がり: {r.finishComment.split(",")[0].trim()}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  該当する回答はありません
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ファンくる調査結果プレースホルダー */}
      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Star className="w-5 h-5 text-[#7D8B75]" />
          ファンくる調査結果
          <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-2">準備中</span>
        </h2>
        <Card className="border-border/50 border-dashed">
          <CardContent className="p-8 text-center text-muted-foreground">
            <p className="text-sm">ファンくる調査結果は今後追加予定です</p>
          </CardContent>
        </Card>
      </section>
    </DashboardLayout>
  );
}
