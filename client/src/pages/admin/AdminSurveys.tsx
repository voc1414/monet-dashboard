import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ClipboardList,
  Store,
  Calendar,
  User,
  FileText,
  ExternalLink,
  Search,
  UserPlus,
  Trash2,
  Eye,
  Link2,
  Plus,
  X,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AdminLayout from "@/components/AdminLayout";
import { useNpsData, calculateStoreStats, filterByMonth, getAvailableMonths, type NpsRecord } from "@/hooks/useNpsData";
import { useFankuruData, fetchPdfData, matchesStylist, type FankuruPdf } from "@/hooks/useFankuruData";
import { useMonthlyReport } from "@/hooks/useMonthlyReport";
import { normalizeStaffKey } from "@/lib/staffNameAlias";
import { toast } from "sonner";
import { useStores } from "@/hooks/useStores";
import { trpc } from "@/lib/trpc";

const formatMonth = (ym: string) => {
  const [y, m] = ym.split("-");
  return `${y}年${parseInt(m)}月`;
};

function FankuruStoreSection({ storeName }: { storeName: string }) {
  const { pdfs, loading, error } = useFankuruData(storeName);
  const [selectedMonth, setSelectedMonth] = useState("all");

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    pdfs.forEach((p) => {
      if (p.yearMonth) months.add(p.yearMonth);
    });
    return Array.from(months).sort().reverse();
  }, [pdfs]);

  const filteredPdfs = useMemo(() => {
    if (selectedMonth === "all") return pdfs;
    return pdfs.filter((p) => p.yearMonth === selectedMonth);
  }, [pdfs, selectedMonth]);

  if (loading) {
    return (
      <div className="p-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-32 mb-2" />
        <div className="h-4 bg-muted rounded w-48" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive">
        エラー: {error}
      </div>
    );
  }

  if (pdfs.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        ファンくるデータなし
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Month filter */}
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[140px] h-8 text-xs bg-white">
            <SelectValue placeholder="月を選択" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全期間</SelectItem>
            {availableMonths.map((m) => (
              <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filteredPdfs.length}件</span>
      </div>

      {/* PDF list */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {filteredPdfs.map((pdf, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-foreground truncate">
                  {pdf.stylist || "担当者不明"}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {pdf.yearMonth ? formatMonth(pdf.yearMonth) : "日付不明"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {pdf.viewUrl && (
                <a
                  href={pdf.viewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-md hover:bg-accent transition-colors"
                  title="PDFを開く"
                >
                  <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                </a>
              )}
              <button
                onClick={() => toast.info("担当者振り分け機能は準備中です")}
                className="p-1.5 rounded-md hover:bg-accent transition-colors"
                title="担当者を振り分け"
              >
                <UserPlus className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              <button
                onClick={() => toast.info("削除機能は準備中です")}
                className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                title="削除"
              >
                <Trash2 className="w-3.5 h-3.5 text-destructive/60" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 未マッチ検出＋候補承認パネル ───

interface UnmatchedEntry {
  source: "NPS" | "ファンくる";
  name: string;
  store: string;
  count: number;
}

function UnmatchedSuggestPanel({
  aliases,
  onRegistered,
}: {
  aliases: Array<{ alias: string; canonicalName: string; storeName: string | null }>;
  onRegistered: () => void;
}) {
  const { npsAliasMap } = useStores();
  const { records: npsRecords } = useNpsData(npsAliasMap);
  const { rawData: reportRawData } = useMonthlyReport();
  const [fankuruAll, setFankuruAll] = useState<Record<string, FankuruPdf[]>>({});
  useEffect(() => {
    fetchPdfData().then(setFankuruAll).catch(() => {});
  }, []);

  const normKey = (s: string) => (s || "").replace(/[\s　]/g, "").toLowerCase();

  // 名簿（月末報告書）: 店舗別と全体
  const rosterByStore = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const r of reportRawData) {
      if (!r.name || !r.storeNormalized || r.name === "テスト") continue;
      if (!map.has(r.storeNormalized)) map.set(r.storeNormalized, new Set());
      map.get(r.storeNormalized)!.add(r.name);
    }
    return map;
  }, [reportRawData]);
  const rosterAll = useMemo(
    () => Array.from(new Set(Array.from(rosterByStore.values()).flatMap((s) => Array.from(s)))),
    [rosterByStore]
  );

  // 最新のDB登録も加味して名寄せ（登録直後に一覧から消えるように、propsのaliasesを直接参照）
  const resolveKey = useMemo(() => {
    const dbMap = new Map(aliases.map((a) => [normKey(a.alias), a.canonicalName]));
    return (name: string) => normalizeStaffKey(dbMap.get(normKey(name)) || name);
  }, [aliases]);

  // 未マッチ検出（NPS＋ファンくる）
  const unmatched = useMemo(() => {
    if (!reportRawData.length) return [] as UnmatchedEntry[];
    const rosterKeys = new Set(rosterAll.map((n) => resolveKey(n)));
    const agg = new Map<string, UnmatchedEntry>();

    for (const r of npsRecords) {
      const staff = r.staff?.trim();
      if (!staff || staff === "選択しない") continue;
      if (rosterKeys.has(resolveKey(staff))) continue;
      const k = `NPS__${resolveKey(staff)}__${r.storeShort}`;
      const cur = agg.get(k);
      if (cur) cur.count++;
      else agg.set(k, { source: "NPS", name: staff, store: r.storeShort, count: 1 });
    }

    for (const [storeName, pdfs] of Object.entries(fankuruAll)) {
      const storeRoster = Array.from(rosterByStore.get(storeName) || []);
      for (const pdf of pdfs) {
        const stylist = pdf.stylist?.trim();
        if (!stylist) continue;
        const hit =
          storeRoster.some((n) => matchesStylist(stylist, n)) ||
          rosterKeys.has(resolveKey(stylist));
        if (hit) continue;
        const k = `ファンくる__${resolveKey(stylist)}__${storeName}`;
        const cur = agg.get(k);
        if (cur) cur.count++;
        else agg.set(k, { source: "ファンくる", name: stylist, store: storeName, count: 1 });
      }
    }
    return Array.from(agg.values()).sort((a, b) => b.count - a.count);
  }, [npsRecords, fankuruAll, reportRawData, rosterAll, rosterByStore, resolveKey]);

  // 読み仮名ベースの候補推定（サーバ側）
  const suggestQuery = trpc.admin.suggestStaffMatches.useQuery(
    { names: unmatched.map((u) => u.name), roster: rosterAll },
    { enabled: unmatched.length > 0 && rosterAll.length > 0, staleTime: 5 * 60 * 1000, retry: 1 }
  );
  const suggestions = useMemo(() => {
    const map = new Map<string, { suggested: string | null; confidence: "high" | "mid" | null }>();
    for (const s of suggestQuery.data || []) map.set(s.name, { suggested: s.suggested, confidence: s.confidence });
    return map;
  }, [suggestQuery.data]);

  const [selections, setSelections] = useState<Record<string, string>>({});
  const addMutation = trpc.admin.addStylistAlias.useMutation({
    onSuccess: () => {
      toast.success("マッピングを登録しました");
      onRegistered();
    },
    onError: (err) => toast.error("登録に失敗しました", { description: err.message }),
  });

  const handleRegister = (u: UnmatchedEntry) => {
    const rowKey = `${u.source}__${u.name}__${u.store}`;
    const canonical = selections[rowKey] ?? suggestions.get(u.name)?.suggested ?? "";
    if (!canonical) {
      toast.error("正式名を選択してください");
      return;
    }
    addMutation.mutate({ canonicalName: canonical, alias: u.name, storeName: u.store });
  };

  if (unmatched.length === 0) {
    return (
      <Card className="border-emerald-200/60 bg-emerald-50/40">
        <CardContent className="p-3">
          <p className="text-xs text-emerald-700">
            ✓ 未マッチのスタッフ名はありません（NPS・ファンくるとも全件が名簿に紐付いています）
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200/70 bg-amber-50/30">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <h4 className="text-sm font-bold text-foreground">未マッチのスタッフ名（{unmatched.length}件）</h4>
        </div>
        <p className="text-[11px] text-muted-foreground mb-3">
          読み仮名から候補を自動推定しています（<Sparkles className="w-3 h-3 inline text-amber-500" />=候補あり）。
          正しければそのまま「登録」、違えばプルダウンで正式名を選んで登録してください。
        </p>
        <div className="space-y-2">
          {unmatched.map((u) => {
            const rowKey = `${u.source}__${u.name}__${u.store}`;
            const sug = suggestions.get(u.name);
            const value = selections[rowKey] ?? sug?.suggested ?? "";
            const storeRoster = Array.from(rosterByStore.get(u.store) || []);
            const others = rosterAll.filter((n) => !storeRoster.includes(n));
            return (
              <div key={rowKey} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white/80 border border-border/40 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Badge variant="outline" className="text-[10px] shrink-0">{u.source}</Badge>
                  <span className="text-sm font-medium truncate">{u.name}</span>
                  <span className="text-[11px] text-muted-foreground shrink-0">（{u.store}・{u.count}件）</span>
                  {sug?.confidence === "high" && <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground shrink-0">→</span>
                  <Select value={value} onValueChange={(v) => setSelections((p) => ({ ...p, [rowKey]: v }))}>
                    <SelectTrigger className="w-[180px] bg-white h-8 text-xs">
                      <SelectValue placeholder="正式名を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {storeRoster.map((n) => (
                        <SelectItem key={n} value={n}>{n}</SelectItem>
                      ))}
                      {others.length > 0 && storeRoster.length > 0 && (
                        <SelectItem value="__sep__" disabled>― 他店舗 ―</SelectItem>
                      )}
                      {others.map((n) => (
                        <SelectItem key={n} value={n}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="h-8"
                    disabled={!value || addMutation.isPending}
                    onClick={() => handleRegister(u)}
                  >
                    登録
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Stylist Alias Management Section ───

function StylistAliasManagement() {
  const { allStores: ALL_STORES } = useStores();
  const aliasQuery = trpc.admin.getStylistAliases.useQuery(undefined, {
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const addMutation = trpc.admin.addStylistAlias.useMutation({
    onSuccess: () => {
      aliasQuery.refetch();
      toast.success("マッピングを追加しました");
      setNewAlias({ canonicalName: "", alias: "", storeName: "" });
      setShowAddForm(false);
    },
    onError: (err) => {
      toast.error("追加に失敗しました", { description: err.message });
    },
  });

  const deleteMutation = trpc.admin.deleteStylistAlias.useMutation({
    onSuccess: () => {
      aliasQuery.refetch();
      toast.success("マッピングを削除しました");
    },
    onError: (err) => {
      toast.error("削除に失敗しました", { description: err.message });
    },
  });

  const [showAddForm, setShowAddForm] = useState(false);
  const [newAlias, setNewAlias] = useState({ canonicalName: "", alias: "", storeName: "" });
  const [filterStore, setFilterStore] = useState("all");

  const aliases = aliasQuery.data || [];

  const filteredAliases = useMemo(() => {
    if (filterStore === "all") return aliases;
    return aliases.filter((a) => a.storeName === filterStore);
  }, [aliases, filterStore]);

  const handleAdd = () => {
    if (!newAlias.canonicalName || !newAlias.alias || !newAlias.storeName) {
      toast.error("全ての項目を入力してください");
      return;
    }
    addMutation.mutate(newAlias);
  };

  const handleDelete = (id: number, alias: string) => {
    if (confirm(`「${alias}」のマッピングを削除しますか？`)) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <div className="space-y-4">
      {/* 未マッチ検出＋候補承認 */}
      <UnmatchedSuggestPanel aliases={aliases} onRegistered={() => aliasQuery.refetch()} />

      {/* Header with add button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4 text-muted-foreground" />
          <Select value={filterStore} onValueChange={setFilterStore}>
            <SelectTrigger className="w-[160px] bg-white">
              <SelectValue placeholder="店舗" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全店舗</SelectItem>
              {ALL_STORES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
          variant={showAddForm ? "outline" : "default"}
        >
          {showAddForm ? (
            <>
              <X className="w-3.5 h-3.5 mr-1" />
              キャンセル
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5 mr-1" />
              新規追加
            </>
          )}
        </Button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <h4 className="text-sm font-bold mb-3">新しいマッピングを追加</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">正式名（ダッシュボード表示名）</label>
                  <Input
                    placeholder="例: Yoshie"
                    value={newAlias.canonicalName}
                    onChange={(e) => setNewAlias({ ...newAlias, canonicalName: e.target.value })}
                    className="bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">エイリアス（外部データの表記）</label>
                  <Input
                    placeholder="例: 由恵（よしえさん）"
                    value={newAlias.alias}
                    onChange={(e) => setNewAlias({ ...newAlias, alias: e.target.value })}
                    className="bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">所属店舗</label>
                  <Select
                    value={newAlias.storeName}
                    onValueChange={(v) => setNewAlias({ ...newAlias, storeName: v })}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="店舗を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_STORES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleAdd}
                  disabled={addMutation.isPending}
                >
                  {addMutation.isPending ? "追加中..." : "追加する"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Existing aliases list */}
      {aliasQuery.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse h-14 bg-muted rounded-lg" />
          ))}
        </div>
      ) : filteredAliases.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="p-6 text-center">
            <Link2 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {filterStore === "all"
                ? "登録されたマッピングはありません"
                : `${filterStore}のマッピングはありません`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              「新規追加」ボタンからマッピングを登録できます
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredAliases.map((alias) => (
            <motion.div
              key={alias.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="border-border/50 hover:shadow-sm transition-shadow">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <Link2 className="w-4 h-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{alias.alias}</span>
                        <span className="text-xs text-muted-foreground">→</span>
                        <span className="text-sm font-bold text-primary">{alias.canonicalName}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {alias.storeName}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(alias.id, alias.alias)}
                    disabled={deleteMutation.isPending}
                    className="text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Info card */}
      <Card className="border-border/30 bg-muted/20">
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong>使い方:</strong> NPSアンケートやファンくるPDFなどの外部データで使われているスタッフ名（エイリアス）を、
            月末報告書の正式名にマッピングします。ここに登録すると、NPS・ファンくる両方の紐付けに反映され、
            表記揺れがあっても同一人物として集計されます。新人で表記が違う場合もここに1行追加するだけです。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminSurveys() {
  const { allStores: ALL_STORES, npsAliasMap } = useStores();
  const { records, loading: npsLoading } = useNpsData(npsAliasMap);
  const [filterStore, setFilterStore] = useState("all");
  const [activeTab, setActiveTab] = useState<"fankuru" | "nps" | "aliases">("fankuru");

  const npsMonths = useMemo(() => getAvailableMonths(records), [records]);

  const storesToShow = filterStore === "all" ? ALL_STORES : [filterStore];

  return (
    <AdminLayout
      title="アンケート情報管理"
      breadcrumbs={[{ label: "アンケート情報" }]}
    >
      <p className="text-sm text-muted-foreground mb-6">
        ファンくる調査結果の担当スタッフ振り分けや、不要データの削除、スタッフ名マッピングの管理を行います。
      </p>

      {/* Tab Selector */}
      <div className="flex items-center gap-1 mb-6 bg-muted/50 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab("fankuru")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "fankuru"
              ? "bg-white text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          ファンくる
        </button>
        <button
          onClick={() => setActiveTab("nps")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "nps"
              ? "bg-white text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          NPS調査
        </button>
        <button
          onClick={() => setActiveTab("aliases")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "aliases"
              ? "bg-white text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          名前マッピング
        </button>
      </div>

      {/* Content */}
      {activeTab === "fankuru" ? (
        <>
          {/* Store Filter */}
          <div className="flex items-center gap-2 mb-6">
            <Store className="w-4 h-4 text-muted-foreground" />
            <Select value={filterStore} onValueChange={setFilterStore}>
              <SelectTrigger className="w-[160px] bg-white">
                <SelectValue placeholder="店舗" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全店舗</SelectItem>
                {ALL_STORES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            {storesToShow.map((storeName) => (
              <motion.div
                key={storeName}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="border-border/50 overflow-hidden">
                  <div className="px-4 py-3 bg-muted/30 border-b border-border/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-primary" />
                      <span className="font-bold text-sm text-foreground">{storeName}</span>
                    </div>
                    <a
                      href={`/survey/${encodeURIComponent(storeName)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                    >
                      アンケート詳細
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <FankuruStoreSection storeName={storeName} />
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      ) : activeTab === "nps" ? (
        <div className="space-y-4">
          <Card className="border-border/50">
            <CardContent className="p-6 text-center">
              <ClipboardList className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-2">
                NPS調査データはGoogleスプレッドシートから自動取得されます
              </p>
              <p className="text-xs text-muted-foreground">
                {npsLoading ? "読み込み中..." : `${records.length}件のNPS回答データ`}
                {npsMonths.length > 0 && ` (${npsMonths.length}ヶ月分)`}
              </p>
              <div className="mt-4">
                <a
                  href="https://docs.google.com/spreadsheets/d/1xSm2poTIeRPFviVmINdWNWmLT5d9pXXL2XzWEQsxiRU/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  NPSスプレッドシートを開く
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <StylistAliasManagement />
      )}
    </AdminLayout>
  );
}
