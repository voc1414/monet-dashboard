/*
 * Design: Atelier Blanc — クリーンアトリエ
 * Page: 店舗別アンケート詳細（StoreDetail.tsxと同じデザインベース）
 * セクション順: ファンくる → NPS調査結果 → 総合アドバイス → カテゴリ別評価 → トップ3レビュー → ワースト3レビュー
 * 個人売上セクションなし
 */
import { useParams, Link } from "wouter";
import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, BarChart3, Calendar, Star, MessageSquare,
  FileText, ExternalLink, Loader2, FolderOpen, Eye,
  Lightbulb, CheckCircle2, Target, ArrowUpRight,
  Trophy, ThumbsUp, AlertTriangle, AlertCircle,
  Sparkles, ChevronDown, Users, Quote
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import ScoreDetailModal from "@/components/ScoreDetailModal";
import DashboardLayout from "@/components/DashboardLayout";
import { useNpsData, calculateStoreStats, filterByMonth, getAvailableMonths } from "@/hooks/useNpsData";
import type { NpsRecord, StoreStats } from "@/hooks/useNpsData";
import { getNpsClass, NPS_INDUSTRY_AVERAGE } from "@/lib/npsClass";
import { generateStoreAdvice } from "@/lib/npsAdvice";
import { useFankuruData } from "@/hooks/useFankuruData";
import { useMonthlyReport } from "@/hooks/useMonthlyReport";
import { isNewStore } from "@/lib/newBadge";
import type { FankuruPdf } from "@/hooks/useFankuruData";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

const NPS_COLORS = {
  promoter: "#2D9C8F",
  passive: "#E5B85C",
  detractor: "#C75C5C",
};

// ネガティブキーワード（辛辣レビュー選定用）
const NEGATIVE_KEYWORDS = [
  "残念", "不満", "改善", "高い", "待ち時間", "長い", "微妙", "期待外れ",
  "雑", "不安", "痛", "ムラ", "合わな", "違う", "もう少し", "気になる",
  "狭", "汚", "臭", "がっかり", "ひどい", "最悪", "二度と", "嫌",
];

// --- NPS Gauge (StoreDetail.tsxと同じ) ---
function NpsGauge({ score }: { score: number }) {
  const npsClass = getNpsClass(score);
  return (
    <div className="flex flex-col items-center">
      <div className="w-28 h-28 rounded-full border-4 flex items-center justify-center" style={{ borderColor: npsClass.color }}>
        <div className="text-center">
          <div className="font-mono-data text-3xl font-bold" style={{ color: npsClass.color }}>
            {score > 0 ? "+" : ""}{score}
          </div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">NPS</div>
        </div>
      </div>
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
    </div>
  );
}

// --- Category Analysis (StoreDetail.tsxと同じ) ---
function CategoryAnalysis({ records, field, label }: { records: NpsRecord[]; field: keyof NpsRecord; label: string }) {
  const analysis = useMemo(() => {
    const counts: Record<string, number> = {};
    records.forEach((r) => {
      const val = r[field] as string;
      if (!val) return;
      val.split(",").forEach((v) => {
        const trimmed = v.trim();
        if (trimmed) counts[trimmed] = (counts[trimmed] || 0) + 1;
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
                  className="h-full rounded-full bg-primary/60 transition-all duration-500"
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

// --- Advice Section (StoreDetail.tsxと同じ) ---
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
      <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
        <Lightbulb className="w-5 h-5 text-[#E5B85C]" />
        総合アドバイス
      </h2>
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className="px-5 py-4 flex items-start gap-3" style={{ backgroundColor: npsClass.bgColor }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: npsClass.color + "18" }}>
            <IconComponent className="w-5 h-5" style={{ color: npsClass.color }} />
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">{advice.summary}</p>
        </div>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
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
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <ArrowUpRight className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-semibold text-foreground">アクションプラン</h4>
              </div>
              <ul className="space-y-2">
                {advice.actionItems.map((s, i) => (
                  <li key={i} className="text-xs text-muted-foreground leading-relaxed flex gap-2">
                    <span className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
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

// --- Review Card (StoreDetail.tsxスタイル) ---
function ReviewCard({ record, index }: { record: NpsRecord; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index }}
    >
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-mono-data font-bold"
                style={{
                  backgroundColor:
                    record.npsScore >= 9 ? NPS_COLORS.promoter : record.npsScore >= 7 ? NPS_COLORS.passive : NPS_COLORS.detractor,
                }}
              >
                {record.npsScore}
              </div>
              <span className="text-xs text-muted-foreground">{record.menu}</span>
              {record.staff && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {record.staff}
                </span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground">{record.date.split(" ")[0]}</span>
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed">{record.review}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function SurveyDetail() {
  const params = useParams<{ storeId: string }>();
  const storeId = decodeURIComponent(params.storeId || "");
  const { records, loading: npsLoading, lastUpdated, refresh } = useNpsData();
  const { rawData, loading: reportLoading, availableMonths: reportMonths } = useMonthlyReport();
  const { pdfs: fankuruPdfs, loading: fankuruLoading, hasFolderMapping } = useFankuruData(storeId);
  const loading = npsLoading || reportLoading;

  // 月の管理
  const allNpsMonths = useMemo(() => {
    const storeRecords = records.filter(r => r.storeShort === storeId);
    return getAvailableMonths(storeRecords);
  }, [records, storeId]);

  const fankuruMonths = useMemo(() => {
    const months = new Set<string>();
    fankuruPdfs.forEach(p => months.add(p.yearMonth));
    return Array.from(months).sort().reverse();
  }, [fankuruPdfs]);

  const monthlyMonths = useMemo(() => {
    const months = new Set<string>();
    rawData.filter(r => r.storeNormalized === storeId).forEach(r => months.add(r.reportMonth));
    return Array.from(months).sort().reverse();
  }, [rawData, storeId]);

  const allMonths = useMemo(() => {
    const set = new Set([...allNpsMonths, ...fankuruMonths, ...monthlyMonths]);
    return Array.from(set).sort().reverse();
  }, [allNpsMonths, fankuruMonths, monthlyMonths]);

  // デフォルト月: 全データ読み込み完了後に決定する
  // NPS月を優先し、なければファンくる/月末報告書の月にフォールバック
  const defaultMonth = useMemo(() => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const ym = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;
    // 先月のデータがあればそれを使う
    if (allMonths.includes(ym)) return ym;
    // なければNPS月の最新を優先
    if (allNpsMonths.length > 0) return allNpsMonths[0];
    // NPSもなければ全月の最新
    return allMonths[0] || "all";
  }, [allMonths, allNpsMonths]);

  const [selectedMonth, setSelectedMonth] = useState<string>("__init__");
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [selectedPdf, setSelectedPdf] = useState<FankuruPdf | null>(null);
  const [showAllReviews, setShowAllReviews] = useState(false);

  // 全データの読み込みが完了してからデフォルト月を設定する
  useEffect(() => {
    if (selectedMonth === "__init__" && !npsLoading && !fankuruLoading && allMonths.length > 0) {
      setSelectedMonth(defaultMonth);
    }
  }, [allMonths, defaultMonth, selectedMonth, npsLoading, fankuruLoading]);

  const activeMonth = selectedMonth === "__init__" ? defaultMonth : selectedMonth;

  // NPS: 月+店舗でフィルタ
  const storeRecords = useMemo(() => {
    const filtered = records.filter(r => r.storeShort === storeId);
    if (activeMonth === "all") return filtered;
    return filterByMonth(filtered, activeMonth);
  }, [records, storeId, activeMonth]);

  const storeStats = useMemo(() => {
    if (storeRecords.length === 0) return null;
    const stats = calculateStoreStats(storeRecords);
    return stats.find(s => s.shortName === storeId) || null;
  }, [storeRecords, storeId]);

  // スコア分布
  const scoreDistribution = useMemo(() => {
    const dist: Record<number, number> = {};
    for (let i = 0; i <= 10; i++) dist[i] = 0;
    storeRecords.forEach(r => {
      if (r.npsScore >= 0 && r.npsScore <= 10) dist[r.npsScore]++;
    });
    return Object.entries(dist).map(([score, count]) => ({
      score: parseInt(score),
      count,
      fill: parseInt(score) >= 9 ? NPS_COLORS.promoter : parseInt(score) >= 7 ? NPS_COLORS.passive : NPS_COLORS.detractor,
    }));
  }, [storeRecords]);

  // 円グラフ
  const pieData = useMemo(() => {
    if (!storeStats) return [];
    return [
      { name: "推奨者 (9-10)", value: storeStats.promoters, fill: NPS_COLORS.promoter },
      { name: "中立者 (7-8)", value: storeStats.passives, fill: NPS_COLORS.passive },
      { name: "批判者 (0-6)", value: storeStats.detractors, fill: NPS_COLORS.detractor },
    ];
  }, [storeStats]);

  // ファンくるPDF: 月でフィルタ
  const filteredFankuruPdfs = useMemo(() => {
    if (activeMonth === "all") return fankuruPdfs;
    return fankuruPdfs.filter(p => p.yearMonth === activeMonth);
  }, [fankuruPdfs, activeMonth]);

  // ファンくるコメント（月末報告書から）
  const filteredFankuruComments = useMemo(() => {
    return rawData
      .filter(r => r.storeNormalized === storeId && r.reportMonth === activeMonth)
      .filter(r => r.fankuruComment && r.fankuruComment.trim() !== "" && r.fankuruComment.trim() !== "なし")
      .map(r => ({ staffName: r.name, comment: r.fankuruComment }));
  }, [rawData, activeMonth, storeId]);

  const hasFankuruData = filteredFankuruPdfs.length > 0 || filteredFankuruComments.length > 0;

  // === トップ3レビュー（文章長め優先） ===
  const topReviews = useMemo(() => {
    return storeRecords
      .filter(r => r.npsScore >= 9 && r.review && r.review.trim().length > 0)
      .sort((a, b) => {
        // 文章長め優先（長い順）、同じ長さならスコア高い順
        const lenDiff = (b.review?.length || 0) - (a.review?.length || 0);
        if (lenDiff !== 0) return lenDiff;
        return b.npsScore - a.npsScore;
      })
      .slice(0, 3);
  }, [storeRecords]);

  // === ワースト3レビュー（辛辣な文章優先） ===
  const worstReviews = useMemo(() => {
    const withHarshness = storeRecords
      .filter(r => r.npsScore <= 8 && r.review && r.review.trim().length > 0)
      .map(r => {
        // 辛辣度スコア: ネガティブキーワード数 + 文章の長さボーナス + 低スコアボーナス
        let harshScore = 0;
        const reviewText = r.review || "";
        NEGATIVE_KEYWORDS.forEach(kw => {
          if (reviewText.includes(kw)) harshScore += 3;
        });
        // 長い文章ほど具体的な不満 → ボーナス
        harshScore += Math.min(reviewText.length / 20, 5);
        // 低スコアほど辛辣 → ボーナス
        harshScore += (8 - r.npsScore) * 2;
        return { record: r, harshScore };
      })
      .sort((a, b) => b.harshScore - a.harshScore);
    return withHarshness.slice(0, 3).map(h => h.record);
  }, [storeRecords]);

  // 残りのレビュー
  const remainingReviews = useMemo(() => {
    const shown = new Set([...topReviews, ...worstReviews]);
    return storeRecords.filter(r => !shown.has(r) && r.review && r.review.trim().length > 0);
  }, [storeRecords, topReviews, worstReviews]);

  const formatMonth = (ym: string) => {
    if (!ym || ym === "all" || ym === "__init__") return "";
    const [y, m] = ym.split("-");
    return `${y}年${parseInt(m)}月`;
  };

  const breadcrumbs = [
    { label: "ホーム", href: "/" },
    { label: "アンケート一覧", href: "/survey" },
    { label: storeId },
  ];

  return (
    <DashboardLayout
      breadcrumbs={breadcrumbs}
      lastUpdated={lastUpdated}
      onRefresh={refresh}
      loading={loading}
    >
      {/* Store Header (StoreDetail.tsxと同じスタイル) */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <MapPin className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
                {storeId}
                {isNewStore(storeId) && (
                  <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1 py-0.5 leading-none">NEW</span>
                )}
              </h1>
              <p className="text-xs text-muted-foreground">顧客アンケート — NPS・ファンくる調査結果</p>
            </div>
          </div>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Select value={activeMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px] bg-white">
              <SelectValue placeholder="期間を選択" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全期間</SelectItem>
              {allMonths.map(m => (
                <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ===== 1. ファンくる調査結果（一番上） ===== */}
      <section className="mb-8 pt-6 border-t-2 border-sage/20">
        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-sage" />
          ファンくる調査結果
          {(filteredFankuruPdfs.length > 0 || filteredFankuruComments.length > 0) && (
            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-2">
              {filteredFankuruPdfs.length + filteredFankuruComments.length}件
            </span>
          )}
        </h2>

        {!hasFolderMapping ? (
          <Card className="border-border/50 border-dashed">
            <CardContent className="p-8 text-center text-muted-foreground">
              <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">この店舗のファンくるフォルダはまだ設定されていません</p>
            </CardContent>
          </Card>
        ) : fankuruLoading ? (
          <Card className="border-border/50">
            <CardContent className="p-8 text-center text-muted-foreground">
              <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin opacity-50" />
              <p className="text-sm">ファンくるデータを読み込み中...</p>
            </CardContent>
          </Card>
        ) : !hasFankuruData ? (
          <Card className="border-border/50 border-dashed">
            <CardContent className="p-8 text-center text-muted-foreground">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">この月のファンくるデータはありません</p>
              <p className="text-xs mt-1 opacity-70">Google Driveにファイルが追加されると自動的に表示されます</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ファンくるPDFリスト */}
            {filteredFankuruPdfs.length > 0 && (
              <div className="grid gap-3 mb-4">
                {filteredFankuruPdfs.map((pdf, i) => (
                  <motion.div
                    key={pdf.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i }}
                  >
                    <Card
                      className={`border-border/50 shadow-sm hover:shadow-md transition-all cursor-pointer group ${
                        selectedPdf?.id === pdf.id ? "ring-2 ring-sage/40 border-sage/30" : ""
                      }`}
                      onClick={() => setSelectedPdf(selectedPdf?.id === pdf.id ? null : pdf)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-sage/10 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5 text-sage" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-foreground group-hover:text-sage transition-colors">
                              {pdf.displayName}
                              {pdf.stylist && (
                                <span className="ml-2 text-xs font-normal text-muted-foreground">
                                  担当: {pdf.stylist}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              フォルダ: {pdf.folder || "ルート"}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              selectedPdf?.id === pdf.id
                                ? "bg-sage text-white"
                                : "bg-sage/10 text-sage group-hover:bg-sage/20"
                            }`}>
                              <Eye className="w-3 h-3" />
                              {selectedPdf?.id === pdf.id ? "閉じる" : "詳細を見る"}
                            </span>
                            <a
                              href={pdf.viewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                              onClick={(e) => e.stopPropagation()}
                              title="Google Driveで開く"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}

            {/* PDF Preview */}
            {selectedPdf && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4"
              >
                <Card className="border-border/50 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between bg-sage/5">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-sage" />
                      <span className="text-sm font-medium text-foreground">{selectedPdf.displayName}</span>
                    </div>
                    <a
                      href={selectedPdf.viewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-sage hover:text-sage/80 transition-colors"
                    >
                      Google Driveで開く
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="w-full" style={{ height: "80vh", minHeight: "500px" }}>
                    <iframe
                      src={selectedPdf.previewUrl}
                      className="w-full h-full border-0"
                      title={selectedPdf.displayName}
                      allow="autoplay"
                    />
                  </div>
                </Card>
              </motion.div>
            )}

            {/* ファンくるコメント */}
            {filteredFankuruComments.length > 0 && (
              <div className="space-y-3">
                {filteredFankuruComments.map((f, i) => (
                  <Card key={i} className="border-border/50 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Quote className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-amber-700">ファンくるコメント</span>
                            <span className="text-xs text-muted-foreground">{f.staffName}</span>
                          </div>
                          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{f.comment}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* ===== 2. NPS調査結果 ===== */}
      <section className="mb-8 pt-6 border-t-2 border-[#2D9C8F]/20">
        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[#2D9C8F]" />
          NPS調査結果
          {activeMonth !== "all" && activeMonth !== "__init__" && (
            <span className="text-xs font-normal text-muted-foreground">— {formatMonth(activeMonth)}</span>
          )}
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
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
                    <div className="font-mono-data text-sm md:text-base font-bold text-[#2D9C8F]">{storeStats.promoterPct}%</div>
                    <div className="text-[10px] text-muted-foreground">{storeStats.promoters}件</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">中立者</div>
                    <div className="font-mono-data text-sm md:text-base font-bold text-[#B8922A]">{storeStats.passivePct}%</div>
                    <div className="text-[10px] text-muted-foreground">{storeStats.passives}件</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">批判者</div>
                    <div className="font-mono-data text-sm md:text-base font-bold text-[#C75C5C]">{storeStats.detractorPct}%</div>
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
                  <BarChart data={scoreDistribution} margin={{ top: 5, right: 5, bottom: 5, left: -20 }} style={{ cursor: "pointer" }} onClick={(state: any) => { if (state && state.activePayload && state.activePayload[0]) { const d = state.activePayload[0].payload; if (d.count > 0) setSelectedScore(d.score); } }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                    <XAxis dataKey="score" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e5e5" }}
                      formatter={(value: number) => [`${value}件`, "回答数"]}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} cursor="pointer">
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
              {activeMonth !== "all" ? "この期間のNPSデータはありません" : "NPSデータがありません"}
            </CardContent>
          </Card>
        )}
      </section>

      {/* Score Detail Modal */}
      <ScoreDetailModal
        selectedScore={selectedScore}
        onClose={() => setSelectedScore(null)}
        records={storeRecords}
      />

      {/* ===== 3. 総合アドバイス ===== */}
      {storeStats && storeRecords.length > 0 && (
        <AdviceSection stats={storeStats} records={storeRecords} />
      )}

      {/* ===== 4. カテゴリ別評価 ===== */}
      {storeRecords.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
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

      {/* ===== 5. トップ3レビュー（文章長め選定） ===== */}
      {topReviews.length > 0 && (
        <section className="mb-8 pt-6 border-t-2 border-[#2D9C8F]/20">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#2D9C8F]" />
            超高感度レビュー
            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-2">TOP {topReviews.length}</span>
          </h2>
          <div className="space-y-3">
            {topReviews.map((record, i) => (
              <ReviewCard key={`top-${i}`} record={record} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* ===== 6. ワースト3レビュー（辛辣な文章選定） ===== */}
      {worstReviews.length > 0 && (
        <section className="mb-8 pt-6 border-t-2 border-[#C75C5C]/20">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-[#C75C5C]" />
            ワーストレビュー
            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-2">{worstReviews.length}件</span>
          </h2>
          <div className="space-y-3">
            {worstReviews.map((record, i) => (
              <ReviewCard key={`worst-${i}`} record={record} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* ===== 他にも詳しく見る ===== */}
      {remainingReviews.length > 0 && !showAllReviews && (
        <button
          onClick={() => setShowAllReviews(true)}
          className="w-full py-3 rounded-xl border border-border/50 bg-card hover:bg-accent/30 transition-colors flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <Eye className="w-4 h-4" />
          他にも詳しく見る（残り {remainingReviews.length}件）
        </button>
      )}

      <AnimatePresence>
        {showAllReviews && remainingReviews.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden mb-8"
          >
            <section className="pt-6 border-t-2 border-primary/20">
              <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-[#E5B85C]" />
                全レビュー
                <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-2">{remainingReviews.length}件</span>
              </h2>
              <div className="space-y-3">
                {remainingReviews.map((record, i) => (
                  <ReviewCard key={`rest-${i}`} record={record} index={i} />
                ))}
              </div>
              <button
                onClick={() => setShowAllReviews(false)}
                className="w-full mt-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                閉じる
              </button>
            </section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NPS回答なし */}
      {!loading && storeRecords.length === 0 && !hasFankuruData && (
        <div className="text-center py-12 text-muted-foreground mb-8">
          <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">この月のアンケートデータはありません</p>
        </div>
      )}

      {/* 店舗詳細リンク */}
      {!loading && (
        <div className="flex justify-center pt-2 pb-4">
          <Link
            href={`/store/${encodeURIComponent(storeId)}`}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            {storeId}の店舗詳細を見る <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </DashboardLayout>
  );
}
