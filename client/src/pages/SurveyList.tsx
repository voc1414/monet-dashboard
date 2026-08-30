/**
 * Design: Atelier Blanc — クリーンアトリエ
 * Page: スタッフ別アンケート一覧（NPS + ファンくる）
 * データソース: NPSスプレッドシート + ファンくるPDFスプレッドシート + 月末報告書（コメントのみ）
 */
import { useState, useMemo, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  ClipboardList, MapPin, ChevronRight, BarChart3, Star, Users, Search, Store, MessageCircle, Loader2, AlertTriangle
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DashboardLayout from "@/components/DashboardLayout";
import { useNpsData, getAvailableMonths } from "@/hooks/useNpsData";
import { useMonthlyReport } from "@/hooks/useMonthlyReport";
import { normalizeStaffKey } from "@/lib/staffNameAlias";
import { fetchPdfData, matchesStylist, normalizeStylistName } from "@/hooks/useFankuruData";
import type { FankuruPdf } from "@/hooks/useFankuruData";
import { getNpsClass } from "@/lib/npsClass";
import { isNewStaff, isRetiredStaff } from "@/lib/newBadge";
import { resolveStaffDisplayName } from "@/lib/staffDisplayName";
import { useStores } from "@/hooks/useStores";
import { PeriodSelector, getDefaultPeriodSelection, getFilterMonths, getPeriodLabel } from "@/components/PeriodSelector";
import type { PeriodSelection } from "@/components/PeriodSelector";

// スタッフ情報（NPS + ファンくるから構築）
interface StaffEntry {
  name: string;
  store: string;
}

export default function SurveyList() {
  const { npsAliasMap } = useStores();
  const { records: npsRecords, loading: npsLoading, lastUpdated, refresh } = useNpsData(npsAliasMap);

  // ファンくるPDFデータ取得
  const [fankuruAllData, setFankuruAllData] = useState<Record<string, FankuruPdf[]>>({});
  const [fankuruLoading, setFankuruLoading] = useState(true);

  const loadFankuru = useCallback(async () => {
    try {
      setFankuruLoading(true);
      const data = await fetchPdfData();
      setFankuruAllData(data);
    } catch (err) {
      console.warn("ファンくるデータ取得エラー:", err);
    } finally {
      setFankuruLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFankuru();
  }, [loadFankuru]);

  const loading = npsLoading || fankuruLoading;

  // ファンくるPDFから利用可能な月を取得
  const fankuruMonths = useMemo(() => {
    const months = new Set<string>();
    for (const pdfs of Object.values(fankuruAllData)) {
      for (const pdf of pdfs) {
        if (pdf.yearMonth) months.add(pdf.yearMonth);
      }
    }
    return Array.from(months).sort().reverse();
  }, [fankuruAllData]);

  // 期間セレクタ
  const npsMonths = useMemo(() => getAvailableMonths(npsRecords), [npsRecords]);
  const allMonths = useMemo(() => {
    const set = new Set([...npsMonths, ...fankuruMonths]);
    return Array.from(set).sort().reverse();
  }, [npsMonths, fankuruMonths]);

  const [periodSelection, setPeriodSelection] = useState<PeriodSelection>(getDefaultPeriodSelection());
  const filterMonths = useMemo(() => getFilterMonths(periodSelection, allMonths), [periodSelection, allMonths]);
  const isAllPeriod = filterMonths === "all";

  // 検索・フィルタ
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStore, setFilterStore] = useState("all");

  // スタッフ名正規化（スペース除去）
  const normalizeName = (name: string) => name.replace(/\s+/g, "").trim();

  // NPSデータからスタッフリストを構築（スタッフ名が入っているレコードのみ）
  const npsStaffEntries = useMemo(() => {
    const map = new Map<string, StaffEntry>();
    for (const r of npsRecords) {
      if (!r.staff || r.staff.trim() === "" || r.staff.trim() === "選択しない") continue;
      const key = `${normalizeName(r.staff)}__${r.storeShort}`;
      if (!map.has(key)) {
        map.set(key, { name: r.staff.trim(), store: r.storeShort });
      }
    }
    return map;
  }, [npsRecords]);

  // ファンくるPDFからスタッフリストを構築（stylistフィールドが入っているレコードのみ）
  const fankuruStaffEntries = useMemo(() => {
    const map = new Map<string, StaffEntry>();
    for (const [storeName, pdfs] of Object.entries(fankuruAllData)) {
      for (const pdf of pdfs) {
        if (!pdf.stylist || pdf.stylist.trim() === "") continue;
        const canonicalName = normalizeStylistName(pdf.stylist);
        const key = `${normalizeName(canonicalName)}__${storeName}`;
        if (!map.has(key)) {
          map.set(key, { name: canonicalName, store: storeName });
        }
      }
    }
    return map;
  }, [fankuruAllData]);

  // 統合スタッフリスト（NPS + ファンくるから重複排除）
  const staffList = useMemo(() => {
    const merged = new Map<string, StaffEntry>();

    for (const [key, entry] of Array.from(npsStaffEntries.entries())) {
      merged.set(key, entry);
    }

    for (const [, entry] of Array.from(fankuruStaffEntries.entries())) {
      let matched = false;
      for (const [, existingEntry] of Array.from(merged.entries())) {
        if (existingEntry.store === entry.store && (
          matchesStylist(entry.name, existingEntry.name, entry.store) ||
          normalizeName(entry.name) === normalizeName(existingEntry.name)
        )) {
          matched = true;
          break;
        }
      }
      if (!matched) {
        const key = `${normalizeName(entry.name)}__${entry.store}`;
        if (!merged.has(key)) {
          merged.set(key, entry);
        }
      }
    }

    return Array.from(merged.values()).filter(
      (s) => !isRetiredStaff(s.name, s.store, "")
    );
  }, [npsStaffEntries, fankuruStaffEntries]);

  // 店舗リスト（フィルタ用）
  const storeList = useMemo(() => {
    const stores = new Set(staffList.map((s) => s.store));
    return Array.from(stores).sort();
  }, [staffList]);

  // 各スタッフのNPS情報を計算（期間フィルタ連動）
  const staffNpsMap = useMemo(() => {
    const map = new Map<string, { total: number; npsScore: number }>();
    let filteredNps = npsRecords;
    if (!isAllPeriod) {
      filteredNps = npsRecords.filter(r => {
        if (!r.date) return false;
        const ym = r.date.substring(0, 7).replace(/\//g, "-");
        return (filterMonths as string[]).includes(ym);
      });
    }
    const groupedByStaff = new Map<string, typeof filteredNps>();
    for (const r of filteredNps) {
      if (!r.staff || r.staff.trim() === "" || r.staff.trim() === "選択しない") continue;
      const key = `${normalizeName(r.staff)}__${r.storeShort}`;
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

  // 各スタッフのファンくる件数を計算（期間フィルタ連動、PDFデータから）
  const staffFankuruMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const [storeName, pdfs] of Object.entries(fankuruAllData)) {
      for (const pdf of pdfs) {
        if (!pdf.stylist || pdf.stylist.trim() === "") continue;
        if (!isAllPeriod) {
          if (!pdf.yearMonth || !(filterMonths as string[]).includes(pdf.yearMonth)) continue;
        }
        for (const staff of staffList) {
          if (staff.store !== storeName) continue;
          if (matchesStylist(pdf.stylist, staff.name, staff.store)) {
            const key = `${normalizeName(staff.name)}__${staff.store}`;
            map.set(key, (map.get(key) || 0) + 1);
            break;
          }
        }
      }
    }
    return map;
  }, [fankuruAllData, staffList, filterMonths, isAllPeriod]);

  // 各スタッフの最新ファンくるPDF（期間内で最新1件ずつ）のdriveFileIdを収集
  const latestFankuruPdfs = useMemo(() => {
    const map = new Map<string, { driveFileId: string; stylist: string; date: string; store: string }>();
    for (const [storeName, pdfs] of Object.entries(fankuruAllData)) {
      // 日付降順にソート済みなので最初にマッチしたものが最新
      for (const pdf of pdfs) {
        if (!pdf.stylist || pdf.stylist.trim() === "") continue;
        if (!pdf.driveFileId) continue;
        if (!isAllPeriod) {
          if (!pdf.yearMonth || !(filterMonths as string[]).includes(pdf.yearMonth)) continue;
        }
        for (const staff of staffList) {
          if (staff.store !== storeName) continue;
          if (matchesStylist(pdf.stylist, staff.name, staff.store)) {
            const key = `${normalizeName(staff.name)}__${staff.store}`;
            if (!map.has(key)) {
              map.set(key, {
                driveFileId: pdf.driveFileId,
                stylist: pdf.stylist,
                date: pdf.date || pdf.yearMonth,
                store: storeName,
              });
            }
            break;
          }
        }
      }
    }
    return Array.from(map.entries());
  }, [fankuruAllData, staffList, filterMonths, isAllPeriod]);

  // tRPC経由でファンくるPDFコメントを取得
  const pdfInputs = useMemo(() => {
    return latestFankuruPdfs.map(([, pdf]) => pdf);
  }, [latestFankuruPdfs]);

  const { data: fankuruComments, isLoading: commentsLoading } = trpc.fankuru.getComments.useQuery(
    { pdfs: pdfInputs },
    {
      enabled: pdfInputs.length > 0 && !loading,
      staleTime: 10 * 60 * 1000, // 10分キャッシュ
      retry: 1,
      refetchOnWindowFocus: false,
    }
  );

  // コメントデータをスタッフキーでマッピング
  const staffFankuruCommentMap = useMemo(() => {
    const map = new Map<string, { comment: string; month: string }>();
    if (!fankuruComments) return map;

    for (const comment of fankuruComments) {
      if (!comment.comment || comment.comment.trim() === "") continue;
      // driveFileIdからスタッフキーを逆引き
      for (const [key, pdf] of latestFankuruPdfs) {
        if (pdf.driveFileId === comment.driveFileId) {
          if (!map.has(key)) {
            map.set(key, {
              comment: comment.comment,
              month: comment.date || "",
            });
          }
          break;
        }
      }
    }
    return map;
  }, [fankuruComments, latestFankuruPdfs]);

  // 未マッチスタイリスト名の検出（ファンくるPDFのスタイリストが誰にもマッチしない場合）
  const unmatchedStylists = useMemo(() => {
    const unmatched: Array<{ stylist: string; store: string; yearMonth: string }> = [];
    const seen = new Set<string>();

    for (const [storeName, pdfs] of Object.entries(fankuruAllData)) {
      for (const pdf of pdfs) {
        if (!pdf.stylist || pdf.stylist.trim() === "") continue;
        // 期間フィルタ適用
        if (!isAllPeriod) {
          if (!pdf.yearMonth || !(filterMonths as string[]).includes(pdf.yearMonth)) continue;
        }
        const normalized = normalizeStylistName(pdf.stylist);
        const dedupeKey = `${normalized.toLowerCase()}__${storeName}`;
        if (seen.has(dedupeKey)) continue;

        // staffList内の誰かにマッチするかチェック
        let matched = false;
        for (const staff of staffList) {
          if (staff.store !== storeName) continue;
          if (matchesStylist(pdf.stylist, staff.name, staff.store)) {
            matched = true;
            break;
          }
        }
        if (!matched) {
          seen.add(dedupeKey);
          unmatched.push({
            stylist: pdf.stylist,
            store: storeName,
            yearMonth: pdf.yearMonth || "",
          });
        }
      }
    }
    return unmatched;
  }, [fankuruAllData, staffList, filterMonths, isAllPeriod]);

  const [showUnmatchedAlert, setShowUnmatchedAlert] = useState(true);

  // NPS側の未マッチ検出（「スタッフ選択」の名前が月末報告書のどのスタッフにも名寄せできない場合）
  const { rawData: reportRawData } = useMonthlyReport();
  const unmatchedNpsStaff = useMemo(() => {
    if (!reportRawData.length) return [] as Array<{ staff: string; store: string; count: number }>;
    const rosterKeys = new Set(reportRawData.map((r) => normalizeStaffKey(r.name)));
    const agg = new Map<string, { staff: string; store: string; count: number }>();
    for (const r of npsRecords) {
      const staff = r.staff?.trim();
      if (!staff || staff === "選択しない") continue;
      const key = normalizeStaffKey(staff);
      if (rosterKeys.has(key)) continue;
      const dedupeKey = `${key}__${r.storeShort}`;
      const cur = agg.get(dedupeKey);
      if (cur) cur.count++;
      else agg.set(dedupeKey, { staff, store: r.storeShort, count: 1 });
    }
    return Array.from(agg.values()).sort((a, b) => b.count - a.count);
  }, [npsRecords, reportRawData]);
  const [showNpsUnmatchedAlert, setShowNpsUnmatchedAlert] = useState(true);

  // フィルタ・検索適用
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      if (filterStore !== "all" && s.store !== filterStore) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        // 画面はニックネーム表示なので、見えている呼び名でも氏名でも引けるようにする
        const shown = resolveStaffDisplayName(s.name, s.store).toLowerCase();
        if (
          !shown.includes(q) &&
          !s.name.toLowerCase().includes(q) &&
          !s.store.toLowerCase().includes(q)
        )
          return false;
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

        {/* 未マッチアラート */}
        {!loading && unmatchedStylists.length > 0 && showUnmatchedAlert && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50 border border-amber-200 rounded-lg p-3"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-amber-800">
                    未マッチのスタイリスト名が{unmatchedStylists.length}件あります
                  </p>
                  <button
                    onClick={() => setShowUnmatchedAlert(false)}
                    className="text-amber-600 hover:text-amber-800 text-xs"
                  >
                    ×
                  </button>
                </div>
                <p className="text-[11px] text-amber-700 mt-1">
                  ファンくるPDFのスタイリスト名がどのスタッフにも紐づいていません。
                  <Link href="/admin/surveys">
                    <span className="underline font-medium cursor-pointer hover:text-amber-900">管理者ページの「名前マッピング」</span>
                  </Link>
                  からマッピングを追加してください。
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {unmatchedStylists.slice(0, 5).map((u, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-800 rounded px-1.5 py-0.5">
                      <span className="font-medium">{u.stylist}</span>
                      <span className="text-amber-600">({u.store})</span>
                    </span>
                  ))}
                  {unmatchedStylists.length > 5 && (
                    <span className="text-[10px] text-amber-600">他{unmatchedStylists.length - 5}件</span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* NPS未マッチアラート */}
        {!loading && unmatchedNpsStaff.length > 0 && showNpsUnmatchedAlert && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50 border border-amber-200 rounded-lg p-3"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-amber-800">
                    NPSアンケートに未マッチのスタッフ名が{unmatchedNpsStaff.length}名分あります
                  </p>
                  <button
                    onClick={() => setShowNpsUnmatchedAlert(false)}
                    className="text-amber-600 hover:text-amber-800 text-xs"
                  >
                    ×
                  </button>
                </div>
                <p className="text-[11px] text-amber-700 mt-1">
                  NPSの「スタッフ選択」の名前が月末報告書のどのスタッフにも名寄せできていません。
                  <Link href="/admin/surveys">
                    <span className="underline font-medium cursor-pointer hover:text-amber-900">管理者ページの「名前マッピング」</span>
                  </Link>
                  で「この表記 → 正式名」を追加すると自動で紐付きます。
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {unmatchedNpsStaff.slice(0, 5).map((u, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-800 rounded px-1.5 py-0.5">
                      <span className="font-medium">{u.staff}</span>
                      <span className="text-amber-600">({u.store}・{u.count}件)</span>
                    </span>
                  ))}
                  {unmatchedNpsStaff.length > 5 && (
                    <span className="text-[10px] text-amber-600">他{unmatchedNpsStaff.length - 5}名</span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

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
                {staffList.length === 0 ? "この期間のアンケートデータはありません" : "検索条件に一致するスタッフがいません"}
              </p>
            </div>
          </div>
        )}

        {!loading && filteredStaff.length > 0 && (
          <div className="space-y-2">
            {filteredStaff.map((staff, i) => {
              const normalizedKey = `${normalizeName(staff.name)}__${staff.store}`;
              const npsInfo = staffNpsMap.get(normalizedKey);
              const fankuruCount = staffFankuruMap.get(normalizedKey) || 0;
              const fankuruComment = staffFankuruCommentMap.get(normalizedKey);
              const npsClass = npsInfo ? getNpsClass(npsInfo.npsScore) : null;

              return (
                <Link key={normalizedKey} href={`/staff/${encodeURIComponent(staff.store)}/${encodeURIComponent(staff.name)}`}>
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
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-base flex items-center gap-1.5 flex-wrap">
                            {resolveStaffDisplayName(staff.name, staff.store)}
                            {isNewStaff(staff.name, staff.store) && (
                              <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1 py-0.5 leading-none">NEW</span>
                            )}
                            {npsInfo && npsInfo.total > 0 && (
                              <span className="text-[10px] font-medium text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5 leading-none">NPS {npsInfo.total}件</span>
                            )}
                            {fankuruCount > 0 && (
                              <span className="text-[10px] font-medium text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 leading-none">ファンくる {fankuruCount}件</span>
                            )}
                          </h3>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {staff.store}
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
                          {/* ファンくる最新コメントプレビュー */}
                          {commentsLoading && fankuruCount > 0 && (
                            <div className="mt-2 flex items-center gap-1.5">
                              <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                              <span className="text-[11px] text-muted-foreground/60">コメント読み込み中...</span>
                            </div>
                          )}
                          {!commentsLoading && fankuruComment && (
                            <div className="mt-2 flex items-start gap-1.5 min-w-0">
                              <MessageCircle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                              <p className="text-xs text-muted-foreground truncate leading-relaxed">
                                <span className="text-[10px] text-amber-600 font-medium mr-1">{fankuruComment.month}</span>
                                {fankuruComment.comment}
                              </p>
                            </div>
                          )}
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
