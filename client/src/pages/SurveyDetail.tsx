/**
 * Design: Atelier Blanc — クリーンアトリエ
 * Page: 店舗別アンケート詳細（NPS・ファンくる結果）
 * Colors: Warm white base, monet water-blue accent, teal for NPS
 */
import { useState, useMemo } from "react";
import { useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3, Calendar, ThumbsUp, Minus, ThumbsDown,
  Star, MessageSquare, Quote, FileText, ExternalLink,
  ChevronDown, MapPin, ArrowLeft, Users
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

// NPS回答カード（大きめ、見やすく）
function NpsResponseCard({ record }: { record: NpsRecord }) {
  const [expanded, setExpanded] = useState(false);
  const hasComments = record.priceComment || record.spaceComment || record.staffComment || record.finishComment;
  const hasReview = record.review;

  return (
    <motion.div
      layout
      className={`border rounded-xl p-4 transition-all ${getScoreBg(record.npsScore)}`}
    >
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
        {(hasComments || hasReview) && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {/* レビューコメント（常に表示） */}
      {hasReview && (
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
                  <span className="text-xs font-semibold text-muted-foreground">💰 価格</span>
                  <p className="text-sm text-foreground/80 mt-0.5">{record.priceComment}</p>
                </div>
              )}
              {record.spaceComment && (
                <div className="bg-white/60 rounded-lg p-2.5">
                  <span className="text-xs font-semibold text-muted-foreground">🏠 空間</span>
                  <p className="text-sm text-foreground/80 mt-0.5">{record.spaceComment}</p>
                </div>
              )}
              {record.staffComment && (
                <div className="bg-white/60 rounded-lg p-2.5">
                  <span className="text-xs font-semibold text-muted-foreground">👤 接客</span>
                  <p className="text-sm text-foreground/80 mt-0.5">{record.staffComment}</p>
                </div>
              )}
              {record.finishComment && (
                <div className="bg-white/60 rounded-lg p-2.5">
                  <span className="text-xs font-semibold text-muted-foreground">✨ 仕上がり</span>
                  <p className="text-sm text-foreground/80 mt-0.5">{record.finishComment}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
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
        <div className="flex items-center gap-2">
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
    </div>
  );
}

// ファンくるコメントカード（月末報告書から）
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
    return { total, promoters, passives, detractors, npsScore, avgScore };
  }, [filteredNps]);

  // ファンくるPDF: 月でフィルタ
  const filteredFankuruPdfs = useMemo(() => {
    if (!activeMonth) return fankuruPdfs;
    return fankuruPdfs.filter(p => p.yearMonth === activeMonth);
  }, [fankuruPdfs, activeMonth]);

  // ファンくるコメント（月末報告書から）: 月+店舗でフィルタ
  const filteredFankuruComments = useMemo(() => {
    return rawData
      .filter(r => r.storeNormalized === storeName && r.reportMonth === activeMonth)
      .filter(r => r.fankuruComment && r.fankuruComment.trim() !== "" && r.fankuruComment.trim() !== "なし")
      .map(r => ({ staffName: r.name, comment: r.fankuruComment }));
  }, [rawData, activeMonth, storeName]);

  // NPS分類別フィルタ
  const [npsFilter, setNpsFilter] = useState<"all" | "promoter" | "passive" | "detractor">("all");
  const displayedNps = useMemo(() => {
    if (npsFilter === "all") return filteredNps;
    if (npsFilter === "promoter") return filteredNps.filter(r => r.npsScore >= 9);
    if (npsFilter === "passive") return filteredNps.filter(r => r.npsScore >= 7 && r.npsScore <= 8);
    return filteredNps.filter(r => r.npsScore <= 6);
  }, [filteredNps, npsFilter]);

  const npsClass = npsStats ? getNpsClass(npsStats.npsScore) : null;
  const hasFankuruData = filteredFankuruPdfs.length > 0 || filteredFankuruComments.length > 0;

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
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              {storeName}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              NPS・ファンくる調査結果
              {monthLabel && <span className="ml-1">（{monthLabel}）</span>}
            </p>
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
          <Tabs defaultValue="nps" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="nps" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                NPS
                {npsStats && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                    {npsStats.total}件
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="fankuru" className="flex items-center gap-2">
                <Star className="w-4 h-4" />
                ファンくる
                {(filteredFankuruPdfs.length > 0 || filteredFankuruComments.length > 0) && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                    {filteredFankuruPdfs.length + filteredFankuruComments.length}件
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ===== NPS タブ ===== */}
            <TabsContent value="nps" className="space-y-4">
              {/* NPSサマリー */}
              {npsStats && npsClass && (
                <Card className="border-border/50 shadow-sm">
                  <CardContent className="p-5">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                      <div className="col-span-2 sm:col-span-1">
                        <div className="text-xs text-muted-foreground mb-1">NPSスコア</div>
                        <div className="font-mono text-3xl font-bold" style={{ color: npsClass.color }}>
                          {npsStats.npsScore > 0 ? "+" : ""}{npsStats.npsScore}
                        </div>
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full mt-1 inline-block"
                          style={{ backgroundColor: `${npsClass.color}15`, color: npsClass.color }}
                        >
                          {npsClass.label}
                        </span>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">平均スコア</div>
                        <div className="font-mono text-2xl font-bold text-foreground">{npsStats.avgScore}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <ThumbsUp className="w-3 h-3 text-emerald-600" /> 推奨者
                        </div>
                        <div className="font-mono text-2xl font-bold text-emerald-600">{npsStats.promoters}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <Minus className="w-3 h-3 text-amber-500" /> 中立者
                        </div>
                        <div className="font-mono text-2xl font-bold text-amber-500">{npsStats.passives}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <ThumbsDown className="w-3 h-3 text-red-500" /> 批判者
                        </div>
                        <div className="font-mono text-2xl font-bold text-red-500">{npsStats.detractors}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* フィルタボタン */}
              {filteredNps.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">フィルタ:</span>
                  {[
                    { key: "all" as const, label: "すべて", count: filteredNps.length },
                    { key: "promoter" as const, label: "推奨者", count: filteredNps.filter(r => r.npsScore >= 9).length, color: "text-emerald-600" },
                    { key: "passive" as const, label: "中立者", count: filteredNps.filter(r => r.npsScore >= 7 && r.npsScore <= 8).length, color: "text-amber-600" },
                    { key: "detractor" as const, label: "批判者", count: filteredNps.filter(r => r.npsScore <= 6).length, color: "text-red-600" },
                  ].map(f => (
                    <button
                      key={f.key}
                      onClick={() => setNpsFilter(f.key)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                        npsFilter === f.key
                          ? "bg-primary text-white border-primary"
                          : "bg-card border-border/50 hover:border-primary/30"
                      }`}
                    >
                      {f.label} ({f.count})
                    </button>
                  ))}
                </div>
              )}

              {/* NPS回答一覧 */}
              <div className="space-y-3">
                {displayedNps.map((record, i) => (
                  <NpsResponseCard key={i} record={record} />
                ))}
              </div>

              {filteredNps.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">この月のNPS回答はありません</p>
                </div>
              )}
            </TabsContent>

            {/* ===== ファンくる タブ ===== */}
            <TabsContent value="fankuru" className="space-y-4">
              {/* ファンくるPDFレポート */}
              {filteredFankuruPdfs.length > 0 && (
                <div>
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
                <div>
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
                <div className="text-center py-12 text-muted-foreground">
                  <Star className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">
                    {hasFolderMapping
                      ? "この月のファンくるデータはありません"
                      : "この店舗のファンくるフォルダは未設定です"
                    }
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* 店舗詳細リンク */}
        {!loading && (
          <div className="flex justify-center pt-2">
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
