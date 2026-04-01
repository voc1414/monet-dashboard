/**
 * Design: monet Brand Identity — 水彩ブルー × コンクリートモダン
 * Page: 店舗別アンケート詳細（ファンくる → NPS の順で同一ページに表示）
 * UI: Home.tsxの店舗一覧と統一したスタイル
 * NPSレビュー: 超高感度3件 → ワースト3件 → 「他にも詳しく見る」で全件展開
 */
import { useState, useMemo } from "react";
import { useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3, Calendar, ThumbsUp, Minus, ThumbsDown,
  Star, MessageSquare, Quote, FileText, ExternalLink,
  ChevronDown, ArrowLeft, Users, Sparkles, AlertTriangle, Eye
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/DashboardLayout";
import { useMonthlyReport } from "@/hooks/useMonthlyReport";
import { useNpsData, filterByMonth, getAvailableMonths } from "@/hooks/useNpsData";
import { useFankuruData } from "@/hooks/useFankuruData";
import type { NpsRecord } from "@/hooks/useNpsData";
import { getNpsClass } from "@/lib/npsClass";
import { Link } from "wouter";

// NPSスコアの色分け
function getScoreColor(score: number): string {
  if (score >= 9) return "text-emerald-600";
  if (score >= 7) return "text-amber-500";
  return "text-red-500";
}

function getScoreIcon(score: number) {
  if (score >= 9) return <ThumbsUp className="w-4 h-4 text-emerald-600" />;
  if (score >= 7) return <Minus className="w-4 h-4 text-amber-500" />;
  return <ThumbsDown className="w-4 h-4 text-red-500" />;
}

function getScoreLabel(score: number): string {
  if (score >= 9) return "推奨者";
  if (score >= 7) return "中立者";
  return "批判者";
}

function getScoreBg(score: number): string {
  if (score >= 9) return "bg-emerald-50 border-emerald-200/50";
  if (score >= 7) return "bg-amber-50 border-amber-200/50";
  return "bg-red-50 border-red-200/50";
}

// NPS回答カード（コンパクト版）
function NpsResponseCard({ record }: { record: NpsRecord }) {
  const [expanded, setExpanded] = useState(false);
  const hasComments = record.priceComment || record.spaceComment || record.staffComment || record.finishComment;

  return (
    <div className={`border rounded-xl p-4 transition-all ${getScoreBg(record.npsScore)}`}>
      {/* ヘッダー行 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {getScoreIcon(record.npsScore)}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-2xl font-mono font-bold ${getScoreColor(record.npsScore)}`}>
                {record.npsScore}
              </span>
              <Badge
                variant="outline"
                className={`text-xs ${
                  record.npsScore >= 9
                    ? "border-emerald-300 text-emerald-700"
                    : record.npsScore >= 7
                    ? "border-amber-300 text-amber-700"
                    : "border-red-300 text-red-700"
                }`}
              >
                {getScoreLabel(record.npsScore)}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>{record.date}</span>
              {record.staff && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {record.staff}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        {hasComments && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {/* レビューコメント（常に表示） */}
      {record.review && (
        <div className="mt-3 pl-7">
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{record.review}</p>
        </div>
      )}

      {/* 詳細コメント（展開時） */}
      <AnimatePresence>
        {expanded && hasComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pl-7 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {record.priceComment && (
                <div className="bg-white/60 rounded-lg p-2.5">
                  <span className="text-xs font-semibold text-muted-foreground">価格</span>
                  <p className="text-sm text-foreground/80 mt-0.5">{record.priceComment}</p>
                </div>
              )}
              {record.spaceComment && (
                <div className="bg-white/60 rounded-lg p-2.5">
                  <span className="text-xs font-semibold text-muted-foreground">空間</span>
                  <p className="text-sm text-foreground/80 mt-0.5">{record.spaceComment}</p>
                </div>
              )}
              {record.staffComment && (
                <div className="bg-white/60 rounded-lg p-2.5">
                  <span className="text-xs font-semibold text-muted-foreground">接客</span>
                  <p className="text-sm text-foreground/80 mt-0.5">{record.staffComment}</p>
                </div>
              )}
              {record.finishComment && (
                <div className="bg-white/60 rounded-lg p-2.5">
                  <span className="text-xs font-semibold text-muted-foreground">仕上がり</span>
                  <p className="text-sm text-foreground/80 mt-0.5">{record.finishComment}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ファンくるPDFカード
function FankuruPdfCard({ pdf }: { pdf: { displayName: string; stylist: string; date: string; viewUrl: string; cdnUrl: string } }) {
  return (
    <div className="bg-amber-50/60 border border-amber-200/50 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h4 className="font-semibold text-sm">{pdf.displayName}</h4>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>{pdf.date}</span>
              {pdf.stylist && (
                <>
                  <span>·</span>
                  <span>担当: {pdf.stylist}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <a
          href={pdf.viewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-amber-700 hover:text-amber-900 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-amber-100 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          開く
        </a>
      </div>
    </div>
  );
}

// ファンくるコメントカード
function FankuruCommentCard({ staffName, comment }: { staffName: string; comment: string }) {
  if (!comment || comment.trim() === "" || comment.trim() === "なし") return null;
  return (
    <div className="bg-amber-50/60 border border-amber-200/50 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <Quote className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-amber-700">ファンくるコメント</span>
            <span className="text-xs text-muted-foreground">{staffName}</span>
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{comment}</p>
        </div>
      </div>
    </div>
  );
}

// NPS分布バー（Home.tsxと同じスタイル）
function NpsDistributionBar({ promoterPct, passivePct, detractorPct }: { promoterPct: number; passivePct: number; detractorPct: number }) {
  return (
    <div className="flex gap-0.5 h-2 rounded-full overflow-hidden w-full">
      <div className="bg-[#2D9C8F] rounded-l-full" style={{ width: `${Math.max(promoterPct, 2)}%` }} />
      <div className="bg-[#E5B85C]" style={{ width: `${Math.max(passivePct, 2)}%` }} />
      <div className="bg-[#C75C5C] rounded-r-full" style={{ width: `${Math.max(detractorPct, 2)}%` }} />
    </div>
  );
}

export default function SurveyDetail() {
  const params = useParams<{ storeId: string }>();
  const storeName = decodeURIComponent(params.storeId || "");

  const { rawData, loading: monthlyLoading } = useMonthlyReport();
  const { records: npsRecords, loading: npsLoading, lastUpdated, refresh } = useNpsData();
  const { pdfs: fankuruPdfs, hasFolderMapping } = useFankuruData(storeName);

  const loading = monthlyLoading || npsLoading;

  // NPS利用可能月
  const npsMonths = useMemo(() => {
    const storeRecords = npsRecords.filter(r => r.storeShort === storeName);
    return getAvailableMonths(storeRecords);
  }, [npsRecords, storeName]);

  // ファンくるPDF利用可能月
  const fankuruMonths = useMemo(() => {
    const months = new Set<string>();
    fankuruPdfs.forEach(p => months.add(p.yearMonth));
    return Array.from(months).sort().reverse();
  }, [fankuruPdfs]);

  // 月末報告書の利用可能月
  const monthlyMonths = useMemo(() => {
    const months = new Set<string>();
    rawData.filter(r => r.storeNormalized === storeName).forEach(r => months.add(r.reportMonth));
    return Array.from(months).sort().reverse();
  }, [rawData, storeName]);

  // 全利用可能月
  const allMonths = useMemo(() => {
    const set = new Set([...npsMonths, ...fankuruMonths, ...monthlyMonths]);
    return Array.from(set).sort().reverse();
  }, [npsMonths, fankuruMonths, monthlyMonths]);

  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const activeMonth = selectedMonth || allMonths[0] || "";
  const monthLabel = activeMonth
    ? `${activeMonth.split("-")[0]}年${parseInt(activeMonth.split("-")[1])}月`
    : "";

  // NPS: 月+店舗でフィルタ
  const filteredNps = useMemo(() => {
    if (!activeMonth) return npsRecords.filter(r => r.storeShort === storeName);
    return filterByMonth(npsRecords, activeMonth).filter(r => r.storeShort === storeName);
  }, [npsRecords, activeMonth, storeName]);

  // NPS集計
  const npsStats = useMemo(() => {
    if (filteredNps.length === 0) return null;
    const total = filteredNps.length;
    const promoters = filteredNps.filter(r => r.npsScore >= 9).length;
    const passives = filteredNps.filter(r => r.npsScore >= 7 && r.npsScore <= 8).length;
    const detractors = filteredNps.filter(r => r.npsScore <= 6).length;
    const npsScore = Math.round(((promoters - detractors) / total) * 100);
    const avgScore = Math.round(filteredNps.reduce((s, r) => s + r.npsScore, 0) / total * 10) / 10;
    const promoterPct = Math.round((promoters / total) * 100);
    const passivePct = Math.round((passives / total) * 100);
    const detractorPct = Math.round((detractors / total) * 100);
    return { total, promoters, passives, detractors, npsScore, avgScore, promoterPct, passivePct, detractorPct };
  }, [filteredNps]);

  // ファンくるPDF: 月でフィルタ
  const filteredFankuruPdfs = useMemo(() => {
    if (!activeMonth) return fankuruPdfs;
    return fankuruPdfs.filter(p => p.yearMonth === activeMonth);
  }, [fankuruPdfs, activeMonth]);

  // ファンくるコメント（月末報告書から）
  const filteredFankuruComments = useMemo(() => {
    return rawData
      .filter(r => r.storeNormalized === storeName && r.reportMonth === activeMonth)
      .filter(r => r.fankuruComment && r.fankuruComment.trim() !== "" && r.fankuruComment.trim() !== "なし")
      .map(r => ({ staffName: r.name, comment: r.fankuruComment }));
  }, [rawData, activeMonth, storeName]);

  const npsClass = npsStats ? getNpsClass(npsStats.npsScore) : null;
  const hasFankuruData = filteredFankuruPdfs.length > 0 || filteredFankuruComments.length > 0;

  // === NPSレビューのコンパクト表示ロジック ===
  // 超高感度レビュー（スコア10のみ、レビューあり）→ スコア降順
  const topReviews = useMemo(() => {
    return filteredNps
      .filter(r => r.npsScore >= 9 && r.review && r.review.trim() !== "")
      .sort((a, b) => b.npsScore - a.npsScore || b.date.localeCompare(a.date))
      .slice(0, 3);
  }, [filteredNps]);

  // ワーストレビュー（スコア8以下、レビューあり）→ スコア昇順
  const worstReviews = useMemo(() => {
    return filteredNps
      .filter(r => r.npsScore <= 8 && r.review && r.review.trim() !== "")
      .sort((a, b) => a.npsScore - b.npsScore || b.date.localeCompare(a.date))
      .slice(0, 3);
  }, [filteredNps]);

  // 「他にも詳しく見る」展開用
  const [showAllNps, setShowAllNps] = useState(false);

  // 残りのレビュー（トップ3・ワースト3以外）
  const remainingReviews = useMemo(() => {
    const topIds = new Set(topReviews.map((_, i) => `top-${i}`));
    const worstIds = new Set(worstReviews.map((_, i) => `worst-${i}`));
    const shownRecords = new Set([...topReviews, ...worstReviews]);
    return filteredNps.filter(r => !shownRecords.has(r));
  }, [filteredNps, topReviews, worstReviews]);

  const breadcrumbs = [
    { label: "ホーム", href: "/" },
    { label: "アンケート一覧", href: "/survey" },
    { label: storeName },
  ];

  return (
    <DashboardLayout
      breadcrumbs={breadcrumbs}
      lastUpdated={lastUpdated ?? undefined}
      onRefresh={refresh}
      loading={loading}
    >
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* ヘッダー */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <Link
              href="/survey"
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mb-2"
            >
              <ArrowLeft className="w-3 h-3" />
              アンケート一覧に戻る
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                <img
                  src="https://d2xsxph8kpxj0f.cloudfront.net/310519663489426081/aLPZvLfFDC4rFYToBquZNR/monet-parasol_bfd1d990.jpg"
                  alt="monet"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">{storeName}</h1>
                <p className="text-sm text-muted-foreground">
                  顧客アンケート
                  {monthLabel && <span className="ml-1">（{monthLabel}）</span>}
                </p>
              </div>
            </div>
          </div>
          <Select value={activeMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[160px]">
              <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="月を選択" />
            </SelectTrigger>
            <SelectContent>
              {allMonths.map((m) => (
                <SelectItem key={m} value={m}>
                  {m.split("-")[0]}年{parseInt(m.split("-")[1])}月
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ローディング */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">データを読み込み中...</span>
            </div>
          </div>
        )}

        {!loading && (
          <div className="space-y-8">

            {/* ===== ファンくるセクション（一番上） ===== */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-5 h-5 text-amber-500" />
                <h2 className="font-bold text-base text-foreground">ファンくる</h2>
                {(filteredFankuruPdfs.length > 0 || filteredFankuruComments.length > 0) && (
                  <span className="text-xs text-muted-foreground">
                    （{filteredFankuruPdfs.length + filteredFankuruComments.length}件）
                  </span>
                )}
              </div>

              {/* ファンくるPDFレポート */}
              {filteredFankuruPdfs.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-600" />
                    調査レポート（{filteredFankuruPdfs.length}件）
                  </h3>
                  <div className="space-y-3">
                    {filteredFankuruPdfs.map(pdf => (
                      <FankuruPdfCard key={pdf.id} pdf={pdf} />
                    ))}
                  </div>
                </div>
              )}

              {/* ファンくるコメント（月末報告書から） */}
              {filteredFankuruComments.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Quote className="w-4 h-4 text-amber-600" />
                    ファンくるコメント（{filteredFankuruComments.length}件）
                  </h3>
                  <div className="space-y-3">
                    {filteredFankuruComments.map((f, i) => (
                      <FankuruCommentCard key={i} staffName={f.staffName} comment={f.comment} />
                    ))}
                  </div>
                </div>
              )}

              {/* データなし */}
              {!hasFankuruData && (
                <div className="text-center py-8 text-muted-foreground bg-card border border-border/50 rounded-xl">
                  <Star className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">
                    {hasFolderMapping
                      ? "この月のファンくるデータはありません"
                      : "この店舗のファンくるフォルダは未設定です"
                    }
                  </p>
                </div>
              )}
            </section>

            {/* ===== NPSセクション ===== */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-primary" />
                <h2 className="font-bold text-base text-foreground">NPS</h2>
                {npsStats && (
                  <span className="text-xs text-muted-foreground">（{npsStats.total}件）</span>
                )}
              </div>

              {/* NPSサマリー */}
              {npsStats && npsClass && (
                <Card className="border-border/50 shadow-sm mb-6">
                  <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row md:items-center gap-6">
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">NPSスコア</div>
                          <div className="font-mono text-4xl font-bold" style={{ color: npsClass.color }}>
                            {npsStats.npsScore > 0 ? "+" : ""}{npsStats.npsScore}
                          </div>
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full mt-1 inline-block"
                            style={{ backgroundColor: `${npsClass.color}15`, color: npsClass.color }}
                          >
                            {npsClass.label}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="grid grid-cols-4 gap-4 mb-3">
                          <div>
                            <div className="text-[10px] text-muted-foreground mb-0.5">平均スコア</div>
                            <div className="font-mono text-xl font-bold text-foreground">{npsStats.avgScore}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
                              <ThumbsUp className="w-3 h-3 text-emerald-600" /> 推奨者
                            </div>
                            <div className="font-mono text-xl font-bold text-emerald-600">{npsStats.promoters}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
                              <Minus className="w-3 h-3 text-amber-500" /> 中立者
                            </div>
                            <div className="font-mono text-xl font-bold text-amber-500">{npsStats.passives}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
                              <ThumbsDown className="w-3 h-3 text-red-500" /> 批判者
                            </div>
                            <div className="font-mono text-xl font-bold text-red-500">{npsStats.detractors}</div>
                          </div>
                        </div>
                        <NpsDistributionBar
                          promoterPct={npsStats.promoterPct}
                          passivePct={npsStats.passivePct}
                          detractorPct={npsStats.detractorPct}
                        />
                        <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                          <span>{npsStats.promoterPct}%</span>
                          <span>{npsStats.passivePct}%</span>
                          <span>{npsStats.detractorPct}%</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 超高感度レビュー TOP 3 */}
              {topReviews.length > 0 && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-sm font-semibold text-foreground">超高感度レビュー</h3>
                    <span className="text-xs text-muted-foreground">TOP {topReviews.length}</span>
                  </div>
                  <div className="space-y-3">
                    {topReviews.map((record, i) => (
                      <NpsResponseCard key={`top-${i}`} record={record} />
                    ))}
                  </div>
                </div>
              )}

              {/* ワーストレビュー 3 */}
              {worstReviews.length > 0 && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <h3 className="text-sm font-semibold text-foreground">ワーストレビュー</h3>
                    <span className="text-xs text-muted-foreground">{worstReviews.length}件</span>
                  </div>
                  <div className="space-y-3">
                    {worstReviews.map((record, i) => (
                      <NpsResponseCard key={`worst-${i}`} record={record} />
                    ))}
                  </div>
                </div>
              )}

              {/* 他にも詳しく見る */}
              {remainingReviews.length > 0 && !showAllNps && (
                <button
                  onClick={() => setShowAllNps(true)}
                  className="w-full py-3 rounded-xl border border-border/50 bg-card hover:bg-accent/30 transition-colors flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  <Eye className="w-4 h-4" />
                  他にも詳しく見る（残り {remainingReviews.length}件）
                </button>
              )}

              {/* 全件展開 */}
              <AnimatePresence>
                {showAllNps && remainingReviews.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="mb-3 mt-5">
                      <div className="flex items-center gap-2 mb-3">
                        <MessageSquare className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">全レビュー</h3>
                        <span className="text-xs text-muted-foreground">{remainingReviews.length}件</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {remainingReviews.map((record, i) => (
                        <NpsResponseCard key={`rest-${i}`} record={record} />
                      ))}
                    </div>
                    <button
                      onClick={() => setShowAllNps(false)}
                      className="w-full mt-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      閉じる
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* NPS回答なし */}
              {filteredNps.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">この月のNPS回答はありません</p>
                </div>
              )}

              {/* レビューなし（回答はあるがレビューテキストがない場合） */}
              {filteredNps.length > 0 && topReviews.length === 0 && worstReviews.length === 0 && (
                <div className="text-center py-8 text-muted-foreground bg-card border border-border/50 rounded-xl">
                  <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">レビューコメントのある回答はありません</p>
                </div>
              )}
            </section>
          </div>
        )}

        {/* 店舗詳細リンク */}
        {!loading && (
          <div className="flex justify-center pt-2 pb-4">
            <Link
              href={`/store/${encodeURIComponent(storeName)}`}
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              {storeName}の店舗詳細を見る <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
