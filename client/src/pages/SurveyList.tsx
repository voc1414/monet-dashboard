/**
 * Design: Atelier Blanc — クリーンアトリエ
 * Page: 顧客アンケート一覧（各店舗のファンくる・NPSまとめ）
 * Colors: Warm white base, monet water-blue accent, teal for NPS
 */
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  MessageSquare, Calendar, ChevronDown, ChevronRight,
  Star, ThumbsUp, Minus, ThumbsDown, Users, MapPin,
  ClipboardList, BarChart3, Quote, ExternalLink
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/DashboardLayout";
import { useMonthlyReport } from "@/hooks/useMonthlyReport";
import { useNpsData, filterByMonth, getAvailableMonths, calculateStoreStats } from "@/hooks/useNpsData";
import type { NpsRecord } from "@/hooks/useNpsData";
import { getNpsClass } from "@/lib/npsClass";

// エリア定義
const AREA_STORES: { area: string; stores: string[] }[] = [
  { area: "大阪エリア", stores: ["堀江院", "堀江院2nd", "福島院", "高槻院"] },
  { area: "福岡エリア", stores: ["姪浜院"] },
  { area: "広島エリア", stores: ["楽々園院"] },
];

// NPSスコアの色分け
function getScoreColor(score: number): string {
  if (score >= 9) return "text-emerald-600";
  if (score >= 7) return "text-amber-500";
  return "text-red-500";
}

function getScoreIcon(score: number) {
  if (score >= 9) return <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" />;
  if (score >= 7) return <Minus className="w-3.5 h-3.5 text-amber-500" />;
  return <ThumbsDown className="w-3.5 h-3.5 text-red-500" />;
}

function getScoreLabel(score: number): string {
  if (score >= 9) return "推奨者";
  if (score >= 7) return "中立者";
  return "批判者";
}

// ファンくるコメントカード
function FankuruCard({ staffName, comment, store }: { staffName: string; comment: string; store: string }) {
  if (!comment || comment.trim() === "" || comment.trim() === "なし") return null;
  return (
    <div className="bg-amber-50/60 border border-amber-200/50 rounded-lg p-3">
      <div className="flex items-start gap-2">
        <Quote className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-amber-700">ファンくる</span>
            <span className="text-xs text-muted-foreground">{staffName}</span>
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{comment}</p>
        </div>
      </div>
    </div>
  );
}

// NPSコメントカード
function NpsCommentCard({ record }: { record: NpsRecord }) {
  const hasComments = record.priceComment || record.spaceComment || record.staffComment || record.finishComment || record.review;
  if (!hasComments) return null;

  return (
    <div className="bg-primary/5 border border-primary/10 rounded-lg p-3">
      <div className="flex items-start gap-2">
        <div className="shrink-0 mt-0.5">
          {getScoreIcon(record.npsScore)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-semibold text-primary">NPS</span>
            <span className={`text-xs font-bold ${getScoreColor(record.npsScore)}`}>
              スコア: {record.npsScore}
            </span>
            <span className="text-xs text-muted-foreground">{record.staff}</span>
            <span className="text-xs text-muted-foreground">{record.date}</span>
          </div>
          <div className="space-y-1.5">
            {record.review && (
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{record.review}</p>
            )}
            {(record.priceComment || record.spaceComment || record.staffComment || record.finishComment) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-1">
                {record.priceComment && (
                  <div className="text-xs"><span className="text-muted-foreground">価格:</span> <span className="text-foreground/70">{record.priceComment}</span></div>
                )}
                {record.spaceComment && (
                  <div className="text-xs"><span className="text-muted-foreground">空間:</span> <span className="text-foreground/70">{record.spaceComment}</span></div>
                )}
                {record.staffComment && (
                  <div className="text-xs"><span className="text-muted-foreground">接客:</span> <span className="text-foreground/70">{record.staffComment}</span></div>
                )}
                {record.finishComment && (
                  <div className="text-xs"><span className="text-muted-foreground">仕上がり:</span> <span className="text-foreground/70">{record.finishComment}</span></div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// 店舗アンケートセクション
function StoreSurveySection({
  storeName,
  npsRecords,
  fankuruComments,
  isOpen,
  onToggle,
}: {
  storeName: string;
  npsRecords: NpsRecord[];
  fankuruComments: { staffName: string; comment: string }[];
  isOpen: boolean;
  onToggle: () => void;
}) {
  // NPS集計
  const npsStats = useMemo(() => {
    if (npsRecords.length === 0) return null;
    const total = npsRecords.length;
    const promoters = npsRecords.filter(r => r.npsScore >= 9).length;
    const passives = npsRecords.filter(r => r.npsScore >= 7 && r.npsScore <= 8).length;
    const detractors = npsRecords.filter(r => r.npsScore <= 6).length;
    const npsScore = Math.round(((promoters - detractors) / total) * 100);
    const avgScore = Math.round(npsRecords.reduce((s, r) => s + r.npsScore, 0) / total * 10) / 10;
    return { total, promoters, passives, detractors, npsScore, avgScore };
  }, [npsRecords]);

  const npsClass = npsStats ? getNpsClass(npsStats.npsScore) : null;
  const validFankuru = fankuruComments.filter(f => f.comment && f.comment.trim() !== "" && f.comment.trim() !== "なし");

  return (
    <div className="border border-border/50 rounded-xl overflow-hidden bg-card">
      {/* ヘッダー */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-accent/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <MapPin className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{storeName}</h3>
            <div className="flex items-center gap-3 mt-0.5">
              {npsStats && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <BarChart3 className="w-3 h-3" />
                  NPS回答 {npsStats.total}件
                </span>
              )}
              {validFankuru.length > 0 && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  ファンくる {validFankuru.length}件
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {npsStats && npsClass && (
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${npsClass.color}15`, color: npsClass.color }}
              >
                {npsClass.label}
              </span>
              <span className="font-mono text-sm font-bold" style={{ color: npsClass.color }}>
                {npsStats.npsScore > 0 ? "+" : ""}{npsStats.npsScore}
              </span>
            </div>
          )}
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* 展開コンテンツ */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              {/* NPS サマリー */}
              {npsStats && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5" />
                    NPS サマリー
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground">NPSスコア</div>
                      <div className="font-mono text-lg font-bold" style={{ color: npsClass?.color }}>
                        {npsStats.npsScore > 0 ? "+" : ""}{npsStats.npsScore}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">平均スコア</div>
                      <div className="font-mono text-lg font-bold text-foreground">{npsStats.avgScore}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <ThumbsUp className="w-3 h-3 text-emerald-600" /> 推奨者
                      </div>
                      <div className="font-mono text-lg font-bold text-emerald-600">{npsStats.promoters}名</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Minus className="w-3 h-3 text-amber-500" /> 中立者
                      </div>
                      <div className="font-mono text-lg font-bold text-amber-500">{npsStats.passives}名</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <ThumbsDown className="w-3 h-3 text-red-500" /> 批判者
                      </div>
                      <div className="font-mono text-lg font-bold text-red-500">{npsStats.detractors}名</div>
                    </div>
                  </div>
                </div>
              )}

              {/* ファンくるコメント */}
              {validFankuru.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5" />
                    ファンくるコメント（{validFankuru.length}件）
                  </h4>
                  <div className="space-y-2">
                    {validFankuru.map((f, i) => (
                      <FankuruCard key={i} staffName={f.staffName} comment={f.comment} store={storeName} />
                    ))}
                  </div>
                </div>
              )}

              {/* NPS個別コメント */}
              {npsRecords.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    NPS回答詳細（{npsRecords.length}件）
                  </h4>
                  <div className="space-y-2">
                    {npsRecords.map((record, i) => (
                      <NpsCommentCard key={i} record={record} />
                    ))}
                  </div>
                </div>
              )}

              {/* データなし */}
              {npsRecords.length === 0 && validFankuru.length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  この月のアンケートデータはありません
                </div>
              )}

              {/* 店舗詳細リンク */}
              <div className="flex justify-end">
                <Link
                  href={`/store/${encodeURIComponent(storeName)}`}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  店舗詳細を見る <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SurveyList() {
  const { rawData, loading: monthlyLoading, availableMonths: monthlyMonths } = useMonthlyReport();
  const { records: npsRecords, loading: npsLoading, lastUpdated, refresh } = useNpsData();

  const loading = monthlyLoading || npsLoading;

  // NPS利用可能月
  const npsMonths = useMemo(() => getAvailableMonths(npsRecords), [npsRecords]);

  // 全利用可能月（両方のデータソースを統合）
  const allMonths = useMemo(() => {
    const set = new Set([...monthlyMonths, ...npsMonths]);
    return Array.from(set).sort().reverse();
  }, [monthlyMonths, npsMonths]);

  const [selectedMonth, setSelectedMonth] = useState<string>("");

  // 月が未選択の場合、最新月を自動選択
  const activeMonth = selectedMonth || allMonths[0] || "";

  // 月選択時のラベル
  const monthLabel = activeMonth
    ? `${activeMonth.split("-")[0]}年${parseInt(activeMonth.split("-")[1])}月`
    : "";

  // NPS: 月でフィルタ
  const filteredNps = useMemo(() => {
    if (!activeMonth) return npsRecords;
    return filterByMonth(npsRecords, activeMonth);
  }, [npsRecords, activeMonth]);

  // ファンくる: 月でフィルタ
  const filteredFankuru = useMemo(() => {
    if (!activeMonth) return rawData;
    return rawData.filter(r => r.reportMonth === activeMonth);
  }, [rawData, activeMonth]);

  // 店舗ごとのNPSレコード
  const npsPerStore = useMemo(() => {
    const map = new Map<string, NpsRecord[]>();
    filteredNps.forEach(r => {
      const existing = map.get(r.storeShort) || [];
      existing.push(r);
      map.set(r.storeShort, existing);
    });
    return map;
  }, [filteredNps]);

  // 店舗ごとのファンくるコメント
  const fankuruPerStore = useMemo(() => {
    const map = new Map<string, { staffName: string; comment: string }[]>();
    filteredFankuru.forEach(r => {
      if (r.fankuruComment && r.fankuruComment.trim() && r.fankuruComment.trim() !== "なし") {
        const existing = map.get(r.storeNormalized) || [];
        existing.push({ staffName: r.name, comment: r.fankuruComment });
        map.set(r.storeNormalized, existing);
      }
    });
    return map;
  }, [filteredFankuru]);

  // 全店サマリー
  const totalNps = useMemo(() => {
    if (filteredNps.length === 0) return null;
    const total = filteredNps.length;
    const promoters = filteredNps.filter(r => r.npsScore >= 9).length;
    const detractors = filteredNps.filter(r => r.npsScore <= 6).length;
    const npsScore = Math.round(((promoters - detractors) / total) * 100);
    return { total, npsScore };
  }, [filteredNps]);

  const totalFankuru = useMemo(() => {
    return filteredFankuru.filter(r => r.fankuruComment && r.fankuruComment.trim() && r.fankuruComment.trim() !== "なし").length;
  }, [filteredFankuru]);

  // 開閉状態
  const [openStores, setOpenStores] = useState<Set<string>>(new Set());
  const toggleStore = (store: string) => {
    setOpenStores(prev => {
      const next = new Set(prev);
      if (next.has(store)) next.delete(store);
      else next.add(store);
      return next;
    });
  };

  // エリアの開閉
  const [openAreas, setOpenAreas] = useState<Set<string>>(new Set(AREA_STORES.map(a => a.area)));
  const toggleArea = (area: string) => {
    setOpenAreas(prev => {
      const next = new Set(prev);
      if (next.has(area)) next.delete(area);
      else next.add(area);
      return next;
    });
  };

  const breadcrumbs = [
    { label: "ホーム", href: "/" },
    { label: "顧客アンケート一覧" },
  ];

  return (
    <DashboardLayout
      breadcrumbs={breadcrumbs}
      lastUpdated={lastUpdated ?? undefined}
      onRefresh={refresh}
      loading={loading}
    >
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* ヘッダー */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              顧客アンケート一覧
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              各店舗のファンくる・NPS調査結果まとめ
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

        {/* 全店サマリーカード */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground">全店NPSスコア</span>
                </div>
                {totalNps ? (
                  <div className="font-mono text-2xl font-bold" style={{ color: getNpsClass(totalNps.npsScore).color }}>
                    {totalNps.npsScore > 0 ? "+" : ""}{totalNps.npsScore}
                  </div>
                ) : (
                  <div className="text-lg text-muted-foreground">—</div>
                )}
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground">NPS回答数</span>
                </div>
                <div className="font-mono text-2xl font-bold text-foreground">
                  {totalNps?.total ?? 0}<span className="text-sm font-normal text-muted-foreground ml-1">件</span>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm col-span-2 sm:col-span-1">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Star className="w-4 h-4 text-amber-500" />
                  <span className="text-xs text-muted-foreground">ファンくる件数</span>
                </div>
                <div className="font-mono text-2xl font-bold text-foreground">
                  {totalFankuru}<span className="text-sm font-normal text-muted-foreground ml-1">件</span>
                </div>
              </CardContent>
            </Card>
          </div>
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

        {/* エリア別店舗一覧 */}
        {!loading && (
          <div className="space-y-4">
            {AREA_STORES.map(({ area, stores }) => {
              // エリア内の合計件数
              const areaNpsCount = stores.reduce((s, st) => s + (npsPerStore.get(st)?.length || 0), 0);
              const areaFankuruCount = stores.reduce((s, st) => s + (fankuruPerStore.get(st)?.length || 0), 0);
              const areaIsOpen = openAreas.has(area);

              return (
                <div key={area}>
                  <button
                    onClick={() => toggleArea(area)}
                    className="w-full flex items-center justify-between py-2 px-1 hover:bg-accent/20 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      <span className="font-semibold text-sm">{area}</span>
                      <span className="text-xs text-muted-foreground">{stores.length}店舗</span>
                      {areaNpsCount > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          NPS {areaNpsCount}件
                        </Badge>
                      )}
                      {areaFankuruCount > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-600">
                          ファンくる {areaFankuruCount}件
                        </Badge>
                      )}
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-muted-foreground transition-transform ${areaIsOpen ? "" : "-rotate-90"}`}
                    />
                  </button>

                  <AnimatePresence>
                    {areaIsOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-2 mt-2 ml-2">
                          {stores.map(store => (
                            <StoreSurveySection
                              key={store}
                              storeName={store}
                              npsRecords={npsPerStore.get(store) || []}
                              fankuruComments={fankuruPerStore.get(store) || []}
                              isOpen={openStores.has(store)}
                              onToggle={() => toggleStore(store)}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
