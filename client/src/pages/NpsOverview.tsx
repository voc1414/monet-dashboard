/*
 * Design: Atelier Blanc — クリーンアトリエ
 * Page: NPS調査結果詳細（店舗単位の集計ページ）
 * Colors: Warm white base, teal green for NPS, rose taupe accent
 */
import { useParams } from "wouter";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart3, Calendar, TrendingUp, TrendingDown, Users, MessageSquare,
  ThumbsUp, Minus, ThumbsDown, ChevronDown, ChevronUp, Star
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/DashboardLayout";
import { useNpsData, calculateStoreStats, filterByMonth, getAvailableMonths } from "@/hooks/useNpsData";
import type { NpsRecord } from "@/hooks/useNpsData";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area
} from "recharts";

const NPS_COLORS = {
  promoter: "#2D9C8F",
  passive: "#E5B85C",
  detractor: "#C75C5C",
};

function NpsGaugeLarge({ score }: { score: number }) {
  const color = score >= 50 ? NPS_COLORS.promoter : score >= 0 ? NPS_COLORS.passive : NPS_COLORS.detractor;
  return (
    <div className="w-36 h-36 rounded-full border-[6px] flex items-center justify-center" style={{ borderColor: color }}>
      <div className="text-center">
        <div className="font-mono-data text-4xl font-bold" style={{ color }}>
          {score > 0 ? "+" : ""}{score}
        </div>
        <div className="text-xs text-muted-foreground uppercase tracking-widest mt-1">NPS Score</div>
      </div>
    </div>
  );
}

function StatCard({ label, value, subtext, icon: Icon, color }: {
  label: string; value: string; subtext?: string; icon: any; color: string;
}) {
  return (
    <Card className="border-border/50 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div className="font-mono-data text-2xl font-semibold text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
        {subtext && <div className="text-[10px] text-muted-foreground/70 mt-0.5">{subtext}</div>}
      </CardContent>
    </Card>
  );
}

function ReviewCard({ record }: { record: NpsRecord }) {
  const [expanded, setExpanded] = useState(false);
  const scoreColor = record.npsScore >= 9 ? NPS_COLORS.promoter : record.npsScore >= 7 ? NPS_COLORS.passive : NPS_COLORS.detractor;

  return (
    <Card className="border-border/50 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-mono-data font-bold shrink-0"
            style={{ backgroundColor: scoreColor }}
          >
            {record.npsScore}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">{record.menu}</span>
              <span className="text-[10px] text-muted-foreground">{record.date.split(" ")[0]}</span>
            </div>
            {record.review && (
              <div>
                <p className={`text-sm text-foreground/80 leading-relaxed ${!expanded ? "line-clamp-2" : ""}`}>
                  {record.review}
                </p>
                {record.review.length > 100 && (
                  <button
                    onClick={() => setExpanded(!expanded)}
                    className="text-xs text-[#9B8579] hover:text-[#7D6B61] mt-1 flex items-center gap-0.5"
                  >
                    {expanded ? (
                      <>閉じる <ChevronUp className="w-3 h-3" /></>
                    ) : (
                      <>続きを読む <ChevronDown className="w-3 h-3" /></>
                    )}
                  </button>
                )}
              </div>
            )}
            {/* Category tags */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {record.priceComment && (
                <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                  金額: {record.priceComment.split(",")[0].trim()}
                </span>
              )}
              {record.spaceComment && (
                <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                  空間: {record.spaceComment.split(",")[0].trim()}
                </span>
              )}
              {record.staffComment && (
                <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                  スタッフ: {record.staffComment.split(",")[0].trim()}
                </span>
              )}
              {record.finishComment && (
                <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                  仕上がり: {record.finishComment.split(",")[0].trim()}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function NpsOverview() {
  const params = useParams<{ storeId: string }>();
  const storeId = decodeURIComponent(params.storeId || "");
  const { records, loading, error, lastUpdated, refresh } = useNpsData();
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [reviewFilter, setReviewFilter] = useState<string>("all");

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

  // Monthly trend data
  const monthlyTrend = useMemo(() => {
    const storeAll = records.filter((r) => r.storeShort === storeId);
    const months = getAvailableMonths(storeAll).reverse();
    return months.map((m) => {
      const monthRecs = filterByMonth(storeAll, m);
      const total = monthRecs.length;
      if (total === 0) return { month: m, nps: 0, avg: 0, count: 0 };
      const promoters = monthRecs.filter((r) => r.npsScore >= 9).length;
      const detractors = monthRecs.filter((r) => r.npsScore <= 6).length;
      const nps = Math.round(((promoters - detractors) / total) * 100);
      const avg = Math.round((monthRecs.reduce((s, r) => s + r.npsScore, 0) / total) * 10) / 10;
      const [y, mo] = m.split("-");
      return { month: `${parseInt(mo)}月`, nps, avg, count: total };
    });
  }, [records, storeId]);

  // Score distribution
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

  // Pie data
  const pieData = useMemo(() => {
    if (!storeStats) return [];
    return [
      { name: "推奨者 (9-10)", value: storeStats.promoters, fill: NPS_COLORS.promoter },
      { name: "中立者 (7-8)", value: storeStats.passives, fill: NPS_COLORS.passive },
      { name: "批判者 (0-6)", value: storeStats.detractors, fill: NPS_COLORS.detractor },
    ];
  }, [storeStats]);

  // Category analysis
  const categoryAnalysis = useMemo(() => {
    const analyze = (field: keyof NpsRecord) => {
      const counts: Record<string, number> = {};
      storeRecords.forEach((r) => {
        const val = r[field] as string;
        if (!val) return;
        val.split(",").forEach((v) => {
          const trimmed = v.trim();
          if (trimmed) counts[trimmed] = (counts[trimmed] || 0) + 1;
        });
      });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => ({ name, value, pct: Math.round((value / storeRecords.length) * 100) }));
    };
    return {
      price: analyze("priceComment"),
      space: analyze("spaceComment"),
      staff: analyze("staffComment"),
      finish: analyze("finishComment"),
    };
  }, [storeRecords]);

  // Filtered reviews
  const filteredReviews = useMemo(() => {
    let filtered = storeRecords;
    if (reviewFilter === "promoter") filtered = filtered.filter((r) => r.npsScore >= 9);
    else if (reviewFilter === "passive") filtered = filtered.filter((r) => r.npsScore >= 7 && r.npsScore <= 8);
    else if (reviewFilter === "detractor") filtered = filtered.filter((r) => r.npsScore <= 6);
    return filtered.filter((r) => r.review);
  }, [storeRecords, reviewFilter]);

  const formatMonth = (ym: string) => {
    const [y, m] = ym.split("-");
    return `${y}年${parseInt(m)}月`;
  };

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: storeId, href: `/store/${encodeURIComponent(storeId)}` },
        { label: "NPS調査結果" },
      ]}
      lastUpdated={lastUpdated}
      onRefresh={refresh}
      loading={loading}
    >
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold text-foreground tracking-wide mb-1">
            NPS調査結果
          </h1>
          <p className="text-sm text-muted-foreground">{storeId} — 顧客満足度調査の詳細分析</p>
        </div>
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

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-border/50 animate-pulse">
              <CardContent className="p-8"><div className="h-40 bg-muted rounded" /></CardContent>
            </Card>
          ))}
        </div>
      ) : storeStats ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="col-span-2 md:col-span-1">
              <Card className="border-border/50 shadow-sm h-full">
                <CardContent className="p-5 flex flex-col items-center justify-center h-full">
                  <NpsGaugeLarge score={storeStats.npsScore} />
                </CardContent>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <StatCard label="回答数" value={`${storeStats.totalResponses}`} icon={Users} color="#9B8579" />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <StatCard label="平均スコア" value={`${storeStats.avgScore}`} subtext="/ 10" icon={BarChart3} color="#7D8B75" />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <StatCard label="推奨者率" value={`${storeStats.promoterPct}%`} subtext={`${storeStats.promoters}件`} icon={ThumbsUp} color={NPS_COLORS.promoter} />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <StatCard label="批判者率" value={`${storeStats.detractorPct}%`} subtext={`${storeStats.detractors}件`} icon={ThumbsDown} color={NPS_COLORS.detractor} />
            </motion.div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
            {/* Monthly Trend */}
            {monthlyTrend.length > 1 && (
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#2D9C8F]" />
                    月別NPS推移
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={monthlyTrend} margin={{ top: 10, right: 10, bottom: 5, left: -10 }}>
                      <defs>
                        <linearGradient id="npsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2D9C8F" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#2D9C8F" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} domain={[-100, 100]} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e5e5" }}
                        formatter={(value: number, name: string) => {
                          if (name === "nps") return [`${value}`, "NPS"];
                          return [`${value}`, name];
                        }}
                      />
                      <Area type="monotone" dataKey="nps" stroke="#2D9C8F" strokeWidth={2} fill="url(#npsGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Score Distribution */}
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#9B8579]" />
                  スコア分布
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={scoreDistribution} margin={{ top: 10, right: 10, bottom: 5, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                    <XAxis dataKey="score" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e5e5" }}
                      formatter={(value: number) => [`${value}件`, "回答数"]}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {scoreDistribution.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Pie Chart */}
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-foreground">回答者構成</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${Math.round(percent * 100)}%`}
                      labelLine={false}
                    >
                      {pieData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e5e5" }}
                      formatter={(value: number, name: string) => [`${value}件`, name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Monthly Response Count */}
            {monthlyTrend.length > 1 && (
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#7D8B75]" />
                    月別回答数
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={monthlyTrend} margin={{ top: 10, right: 10, bottom: 5, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e5e5" }}
                        formatter={(value: number) => [`${value}件`, "回答数"]}
                      />
                      <Bar dataKey="count" fill="#9B8579" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Category Analysis */}
          <section className="mb-8">
            <h2 className="font-display text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#9B8579]" />
              カテゴリ別評価分析
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: "金額について", data: categoryAnalysis.price, color: "#9B8579" },
                { label: "空間について", data: categoryAnalysis.space, color: "#7D8B75" },
                { label: "スタッフについて", data: categoryAnalysis.staff, color: "#2D9C8F" },
                { label: "仕上がりについて", data: categoryAnalysis.finish, color: "#E5B85C" },
              ].map((cat) => (
                <Card key={cat.label} className="border-border/50 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-foreground">{cat.label}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    {cat.data.length > 0 ? (
                      <div className="space-y-2.5">
                        {cat.data.map((item) => (
                          <div key={item.name}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-muted-foreground truncate max-w-[70%]">{item.name}</span>
                              <span className="text-xs font-mono-data text-foreground">{item.pct}% ({item.value}件)</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${item.pct}%`, backgroundColor: cat.color + "80" }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground py-4 text-center">データなし</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Reviews Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
                <Star className="w-5 h-5 text-[#E5B85C]" />
                レビュー一覧
                <span className="text-sm font-normal text-muted-foreground">({filteredReviews.length}件)</span>
              </h2>
              <Tabs value={reviewFilter} onValueChange={setReviewFilter}>
                <TabsList className="bg-muted/50">
                  <TabsTrigger value="all" className="text-xs">全て</TabsTrigger>
                  <TabsTrigger value="promoter" className="text-xs">推奨者</TabsTrigger>
                  <TabsTrigger value="passive" className="text-xs">中立者</TabsTrigger>
                  <TabsTrigger value="detractor" className="text-xs">批判者</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="space-y-3">
              {filteredReviews.length > 0 ? (
                filteredReviews.map((r, i) => (
                  <motion.div
                    key={r.no + "-" + i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(0.03 * i, 0.5) }}
                  >
                    <ReviewCard record={r} />
                  </motion.div>
                ))
              ) : (
                <Card className="border-border/50">
                  <CardContent className="p-8 text-center text-muted-foreground text-sm">
                    該当するレビューはありません
                  </CardContent>
                </Card>
              )}
            </div>
          </section>
        </>
      ) : (
        <Card className="border-border/50">
          <CardContent className="p-12 text-center text-muted-foreground">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-lg font-medium mb-2">データがありません</p>
            <p className="text-sm">
              {selectedMonth !== "all"
                ? "選択した期間のデータが見つかりませんでした。別の期間を選択してください。"
                : "この店舗のNPSデータはまだ登録されていません。"}
            </p>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}
