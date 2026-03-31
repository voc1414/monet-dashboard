/*
 * Design: Atelier Blanc — クリーンアトリエ
 * Page: 店舗一覧（総売上・技術単価のサンプル + NPS概要）
 * Colors: Warm white base, rose taupe accent
 */
import { Link } from "wouter";
import { motion } from "framer-motion";
import { MapPin, Users, TrendingUp, BarChart3, ArrowRight, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import DashboardLayout from "@/components/DashboardLayout";
import { useNpsData, calculateStoreStats } from "@/hooks/useNpsData";
import { getNpsClass, NPS_INDUSTRY_AVERAGE, getAllNpsClasses } from "@/lib/npsClass";

const HERO_IMAGE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663489426081/aLPZvLfFDC4rFYToBquZNR/hero-salon-NicxdYrLg92ifUSevm3mos.webp";

// サンプルデータ（売上・技術単価は今後実データに置き換え）
const SAMPLE_STORE_DATA: Record<string, { revenue: string; unitPrice: string; staffCount: number }> = {
  "堀江院": { revenue: "¥4,850,000", unitPrice: "¥12,500", staffCount: 5 },
  "堀江院2nd": { revenue: "¥3,920,000", unitPrice: "¥11,800", staffCount: 4 },
  "福島院": { revenue: "¥4,210,000", unitPrice: "¥12,200", staffCount: 4 },
  "高槻院": { revenue: "¥3,580,000", unitPrice: "¥11,500", staffCount: 3 },
  "姪浜院": { revenue: "¥2,150,000", unitPrice: "¥10,800", staffCount: 3 },
  "楽々園院": { revenue: "¥1,780,000", unitPrice: "¥10,500", staffCount: 2 },
};

function NpsScoreBadge({ score }: { score: number }) {
  const npsClass = getNpsClass(score);
  return (
    <div className="flex flex-col items-end gap-1">
      <span
        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono-data font-semibold border"
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
  const { records, loading, error, lastUpdated, refresh } = useNpsData();
  const storeStats = calculateStoreStats(records);

  // 全店舗合計
  const totalResponses = storeStats.reduce((s, st) => s + st.totalResponses, 0);
  const totalPromoters = storeStats.reduce((s, st) => s + st.promoters, 0);
  const totalDetractors = storeStats.reduce((s, st) => s + st.detractors, 0);
  const overallNps = totalResponses > 0 ? Math.round(((totalPromoters - totalDetractors) / totalResponses) * 100) : 0;
  const overallAvg = totalResponses > 0 ? Math.round((records.reduce((s, r) => s + r.npsScore, 0) / totalResponses) * 10) / 10 : 0;

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
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-transparent" />
        </div>
        <div className="relative px-8 py-10 md:py-14">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h1 className="font-display text-3xl md:text-4xl font-semibold text-white mb-2 tracking-wide">
              monet Dashboard
            </h1>
            <p className="text-white/80 text-sm md:text-base max-w-lg">
              五感を満たす唯一無二の美容室 — 店舗パフォーマンス管理
            </p>
          </motion.div>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: "全店舗NPS", value: `${overallNps > 0 ? "+" : ""}${overallNps}`, icon: TrendingUp, color: "text-[#2D9C8F]", extra: loading ? undefined : getNpsClass(overallNps) },
        { label: "業界平均NPS", value: `${NPS_INDUSTRY_AVERAGE}`, icon: BarChart3, color: "text-muted-foreground", extra: undefined },
          { label: "平均スコア", value: `${overallAvg}`, icon: Sparkles, color: "text-[#9B8579]", extra: undefined },
          { label: "総回答数", value: `${totalResponses}`, icon: BarChart3, color: "text-[#7D8B75]", extra: undefined },
          { label: "店舗数", value: `${storeStats.length}`, icon: MapPin, color: "text-[#9B8579]", extra: undefined },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.05 }}
          >
            <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div className="font-mono-data text-2xl font-semibold text-foreground mb-1">
                  {loading ? "..." : stat.value}
                </div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
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

      {/* Store List */}
      <div className="mb-4">
        <h2 className="font-display text-xl font-semibold text-foreground tracking-wide">
          店舗一覧
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          各店舗の売上・NPS概要（売上データはサンプル）
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
          const sample = SAMPLE_STORE_DATA[st.shortName] || { revenue: "—", unitPrice: "—", staffCount: 0 };

          return (
            <motion.div
              key={st.shortName}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.04 }}
            >
              <Link href={`/store/${encodeURIComponent(st.shortName)}`}>
                <Card className="border-border/50 shadow-sm hover:shadow-lg hover:border-[#9B8579]/30 transition-all cursor-pointer group">
                  <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row md:items-center">
                      {/* Store Info */}
                      <div className="flex-1 p-5 md:p-6">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-[#9B8579]/10 flex items-center justify-center">
                            <MapPin className="w-5 h-5 text-[#9B8579]" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground text-base group-hover:text-[#9B8579] transition-colors">
                              {st.shortName}
                            </h3>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Users className="w-3 h-3" />
                              <span>{sample.staffCount}名在籍</span>
                            </div>
                          </div>
                        </div>

                        {/* Stats Row */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">総売上</div>
                            <div className="font-mono-data text-sm font-semibold">{sample.revenue}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">技術単価</div>
                            <div className="font-mono-data text-sm font-semibold">{sample.unitPrice}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">NPS回答数</div>
                            <div className="font-mono-data text-sm font-semibold">{st.totalResponses}件</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">平均スコア</div>
                            <div className="font-mono-data text-sm font-semibold">{st.avgScore}</div>
                          </div>
                        </div>
                      </div>

                      {/* NPS Score */}
                      <div className="flex items-center gap-4 px-5 pb-5 md:px-6 md:py-6 md:border-l border-border/40">
                        <div className="text-center">
                          <NpsScoreBadge score={st.npsScore} />
                          <div className="mt-2 flex gap-1">
                            <div className="h-1.5 rounded-full bg-[#2D9C8F]" style={{ width: `${Math.max(st.promoterPct * 0.6, 4)}px` }} />
                            <div className="h-1.5 rounded-full bg-[#E5B85C]" style={{ width: `${Math.max(st.passivePct * 0.6, 4)}px` }} />
                            <div className="h-1.5 rounded-full bg-[#C75C5C]" style={{ width: `${Math.max(st.detractorPct * 0.6, 4)}px` }} />
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-[#9B8579] transition-colors group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
