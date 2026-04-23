import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Users,
  User,
  Store,
  Search,
  LogOut as LogOutIcon,
  Sparkles,
  UserCheck,
  UserX,
  UserPlus,
  UserMinus,
  Loader2,
  RefreshCw,
  Database,
  History,
  ChevronDown,
  ArrowRight,
  MessageSquare,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import AdminLayout from "@/components/AdminLayout";
import { isNewStaff } from "@/lib/newBadge";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useMonthlyReport } from "@/hooks/useMonthlyReport";
import {
  PeriodSelector,
  PeriodSelection,
  getDefaultPeriodSelection,
  getFilterMonths,
  getPeriodLabel,
} from "@/components/PeriodSelector";

// ─── スタッフ名正規化 ───

/** テストデータとして除外するスタッフ名 */
const TEST_NAMES = new Set(["C", "D", "テスト", "test", "Test"]);

/**
 * スタッフ名を正規化する。
 * - 全角スペース（U+3000）→ 半角スペース
 * - 連続スペースを1つに
 * - 先頭・末尾のスペースを除去
 * - 既知のサフィックス（"ホットペッパー" 等）を除去
 */
function normalizeStaffName(raw: string): string {
  let name = raw
    .replace(/\u3000/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  const suffixes = ["ホットペッパー", "hotpepper", "HP", "ＨＰ"];
  for (const suffix of suffixes) {
    const idx = name.indexOf(suffix);
    if (idx > 0) {
      name = name.substring(0, idx).trim();
    }
  }

  return name;
}

/**
 * DBステータスとのマッチング用に正規化したキーを生成する。
 * スペースの有無・全角半角の差異を吸収する。
 */
function normalizeForMatching(name: string): string {
  return name
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 期間選択から開始日・終了日のISO文字列を生成 */
function periodToDateRange(
  selection: PeriodSelection,
  allMonths: string[]
): { startDate: string | null; endDate: string | null } {
  const filterMonths = getFilterMonths(selection, allMonths);
  if (filterMonths === "all") {
    return { startDate: null, endDate: null };
  }
  if (filterMonths.length === 0) {
    return { startDate: null, endDate: null };
  }
  const sorted = [...filterMonths].sort();
  const startYM = sorted[0];
  const endYM = sorted[sorted.length - 1];
  // Start of first month
  const startDate = `${startYM}-01T00:00:00.000Z`;
  // End of last month (first day of next month)
  const [ey, em] = endYM.split("-").map(Number);
  const nextMonth = em === 12 ? `${ey + 1}-01` : `${ey}-${String(em + 1).padStart(2, "0")}`;
  const endDate = `${nextMonth}-01T00:00:00.000Z`;
  return { startDate, endDate };
}

type StaffWithStatus = {
  name: string;
  store: string;
  status: "active" | "retired";
  retiredMonth: string | null;
  /** スタッフの最初の報告月 (YYYY-MM) — 新入社判定に使用 */
  firstReportMonth: string | null;
};

export default function AdminStaff() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStore, setFilterStore] = useState("all");
  const [showRetired, setShowRetired] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [periodSelection, setPeriodSelection] = useState<PeriodSelection>(getDefaultPeriodSelection());

  // Dialog state for status toggle confirmation
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    staff: StaffWithStatus | null;
    targetStatus: "active" | "retired";
    retiredMonth: string;
    note: string;
  }>({ open: false, staff: null, targetStatus: "active", retiredMonth: getCurrentYearMonth(), note: "" });

  // ─── スプレッドシートからスタッフ一覧を動的取得 ───
  const { rawData, loading: reportLoading } = useMonthlyReport();

  // rawDataからユニークなスタッフ一覧を抽出（正規化済み）+ 初回報告月を記録
  const dynamicStaffData = useMemo(() => {
    if (!rawData.length) return [];

    const seen = new Map<string, { name: string; store: string; firstMonth: string | null }>();
    for (const r of rawData) {
      const normalizedName = normalizeStaffName(r.name);
      const store = r.storeNormalized;

      if (TEST_NAMES.has(normalizedName) || TEST_NAMES.has(r.name)) continue;
      if (!normalizedName || !store) continue;

      const key = `${normalizedName}|${store}`;
      const reportMonth = r.reportMonth || null;

      if (!seen.has(key)) {
        seen.set(key, { name: normalizedName, store, firstMonth: reportMonth });
      } else {
        const existing = seen.get(key)!;
        if (reportMonth && (!existing.firstMonth || reportMonth < existing.firstMonth)) {
          existing.firstMonth = reportMonth;
        }
      }
    }

    return Array.from(seen.values()).sort((a, b) =>
      a.store.localeCompare(b.store, "ja") || a.name.localeCompare(b.name, "ja")
    );
  }, [rawData]);

  // 利用可能な月一覧（期間セレクタ用）
  const allMonths = useMemo(() => {
    const months = new Set<string>();
    for (const r of rawData) {
      if (r.reportMonth) months.add(r.reportMonth);
    }
    return Array.from(months).sort().reverse();
  }, [rawData]);

  // 動的に取得された店舗一覧
  const allStores = useMemo(() => {
    const stores = new Set(dynamicStaffData.map((s) => s.store));
    return Array.from(stores).sort((a, b) => a.localeCompare(b, "ja"));
  }, [dynamicStaffData]);

  // Fetch staff statuses from DB
  const statusQuery = trpc.admin.getStaffStatuses.useQuery(undefined, {
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Fetch staff status change history
  const historyQuery = trpc.admin.getStaffStatusHistory.useQuery(undefined, {
    retry: 1,
    refetchOnWindowFocus: false,
    enabled: showHistory,
  });

  // Fetch period-based staff stats from backend
  const { startDate: statsStartDate, endDate: statsEndDate } = periodToDateRange(periodSelection, allMonths);
  const statsQuery = trpc.admin.getStaffStats.useQuery(
    { startDate: statsStartDate, endDate: statsEndDate },
    {
      retry: 1,
      refetchOnWindowFocus: false,
    }
  );

  const updateStatusMutation = trpc.admin.updateStaffStatus.useMutation({
    onSuccess: () => {
      statusQuery.refetch();
      statsQuery.refetch();
      if (showHistory) historyQuery.refetch();
      toast.success("ステータスを更新しました");
      setConfirmDialog({ open: false, staff: null, targetStatus: "active", retiredMonth: getCurrentYearMonth(), note: "" });
    },
    onError: (err) => {
      toast.error("ステータスの更新に失敗しました", { description: err.message });
    },
  });

  const bulkInitMutation = trpc.admin.bulkInitStaffStatuses.useMutation({
    onSuccess: (data) => {
      statusQuery.refetch();
      statsQuery.refetch();
      toast.success(`${data.count}名のステータスを初期化しました`);
    },
    onError: (err) => {
      toast.error("初期化に失敗しました", { description: err.message });
    },
  });

  // ─── DBステータスとのマージ（正規化マッチング） ───
  const staffList: StaffWithStatus[] = useMemo(() => {
    const dbStatuses = statusQuery.data || [];

    const exactMap = new Map<string, { status: "active" | "retired"; retiredMonth: string | null }>();
    const normalizedMap = new Map<string, { status: "active" | "retired"; retiredMonth: string | null }>();

    for (const s of dbStatuses) {
      const exactKey = `${s.staffName}|${s.storeName}`;
      exactMap.set(exactKey, { status: s.status, retiredMonth: s.retiredMonth });

      const normKey = `${normalizeForMatching(s.staffName)}|${s.storeName}`;
      normalizedMap.set(normKey, { status: s.status, retiredMonth: s.retiredMonth });
    }

    const result: StaffWithStatus[] = dynamicStaffData.map((staff) => {
      const exactKey = `${staff.name}|${staff.store}`;
      let dbStatus = exactMap.get(exactKey);

      if (!dbStatus) {
        const normKey = `${normalizeForMatching(staff.name)}|${staff.store}`;
        dbStatus = normalizedMap.get(normKey);
      }

      return {
        name: staff.name,
        store: staff.store,
        status: dbStatus?.status || "active",
        retiredMonth: dbStatus?.retiredMonth || null,
        firstReportMonth: staff.firstMonth,
      };
    });

    const dynamicKeys = new Set(dynamicStaffData.map((s) => `${normalizeForMatching(s.name)}|${s.store}`));
    for (const s of dbStatuses) {
      const normKey = `${normalizeForMatching(s.staffName)}|${s.storeName}`;
      if (!dynamicKeys.has(normKey)) {
        result.push({
          name: s.staffName,
          store: s.storeName,
          status: s.status,
          retiredMonth: s.retiredMonth,
          firstReportMonth: null,
        });
      }
    }

    return result;
  }, [dynamicStaffData, statusQuery.data]);

  const isDbInitialized = (statusQuery.data?.length || 0) > 0;

  // ─── 期間フィルタリング ───
  const filterMonthsResult = getFilterMonths(periodSelection, allMonths);

  // 新入社数: 選択期間内に初めて報告書を提出したスタッフ
  // ※ スプレッドシートに1ヶ月分しかデータがない場合、全員がその月の「新入社」になるため、
  //    利用可能な月が1つしかない場合は「—」（判定不可）を返す
  const newHireCount = useMemo(() => {
    // 利用可能な月データが1つ以下の場合は正確な新入社判定ができない
    if (allMonths.length <= 1) return null;

    if (filterMonthsResult === "all") {
      // 全期間の場合: 最も古い月に初めて登場したスタッフ = 判定不可（全員が「初回」になる）
      // → 全スタッフ数を返す
      return dynamicStaffData.length;
    }
    return dynamicStaffData.filter((s) => {
      if (!s.firstMonth) return false;
      return (filterMonthsResult as string[]).includes(s.firstMonth);
    }).length;
  }, [dynamicStaffData, filterMonthsResult, allMonths.length]);

  // Filter staff for list display
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      if (!showRetired && s.status === "retired") return false;
      if (filterStore !== "all" && s.store !== filterStore) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return s.name.toLowerCase().includes(q) || s.store.toLowerCase().includes(q);
      }
      return true;
    });
  }, [staffList, searchQuery, filterStore, showRetired]);

  // Group by store
  const staffByStore = useMemo(() => {
    const map = new Map<string, StaffWithStatus[]>();
    for (const staff of filteredStaff) {
      const existing = map.get(staff.store) || [];
      existing.push(staff);
      map.set(staff.store, existing);
    }
    return map;
  }, [filteredStaff]);

  // ─── KPI計算（staffList = スプレッドシート+DBマージ後の統一リストから算出） ───
  // 総スタッフ数・在籍数はフロントエンドのstaffListから計算（データソース統一）
  const activeCount = staffList.filter((s) => s.status === "active").length;
  const retiredCount = staffList.filter((s) => s.status === "retired").length;
  // 退社数・復帰数はDB変更履歴から取得（期間フィルタ対応）
  const periodRetirements = statsQuery.data?.periodRetirements ?? 0;
  const periodReactivations = statsQuery.data?.periodReactivations ?? 0;

  // Open confirm dialog
  const openToggleDialog = (staff: StaffWithStatus) => {
    const targetStatus = staff.status === "active" ? "retired" : "active";
    setConfirmDialog({
      open: true,
      staff,
      targetStatus,
      retiredMonth: staff.retiredMonth || getCurrentYearMonth(),
      note: "",
    });
  };

  // Execute status toggle (now includes note)
  const executeToggle = () => {
    if (!confirmDialog.staff) return;
    updateStatusMutation.mutate({
      staffName: confirmDialog.staff.name,
      storeName: confirmDialog.staff.store,
      status: confirmDialog.targetStatus,
      retiredMonth: confirmDialog.targetStatus === "retired" ? confirmDialog.retiredMonth : null,
      note: confirmDialog.note.trim() || null,
    });
  };

  // Bulk initialize from dynamic spreadsheet data
  const handleBulkInit = () => {
    if (dynamicStaffData.length === 0) {
      toast.error("スプレッドシートのデータがまだ読み込まれていません");
      return;
    }

    const initList = dynamicStaffData.map((s) => ({
      staffName: s.name,
      storeName: s.store,
      status: (s.name === "Hitomi" && s.store === "福島院" ? "retired" : "active") as "active" | "retired",
      retiredMonth: s.name === "Hitomi" && s.store === "福島院" ? "2026-04" : null,
    }));
    bulkInitMutation.mutate({ staffList: initList });
  };

  const loading = reportLoading || statusQuery.isLoading;
  const periodLabel = getPeriodLabel(periodSelection);

  return (
    <AdminLayout
      title="スタッフ情報管理"
      breadcrumbs={[{ label: "スタッフ情報" }]}
    >
      <p className="text-sm text-muted-foreground mb-4">
        スタッフの在籍・退社ステータスを管理します。ステータスの変更は全ページに即時反映されます。
        <br />
        <span className="text-xs text-muted-foreground/70">
          スタッフ一覧は月末報告書スプレッドシートから自動取得されます。新しいスタッフが報告書を提出すると自動的に表示されます。
        </span>
      </p>

      {/* ─── 期間セレクタ ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          人事サマリー
          <span className="text-xs font-normal text-muted-foreground">— {periodLabel}</span>
        </h2>
        <PeriodSelector
          allMonths={allMonths}
          selection={periodSelection}
          onChange={setPeriodSelection}
        />
      </div>

      {/* ─── KPIカード ─── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {[
          {
            label: "総スタッフ数",
            value: activeCount + retiredCount,
            icon: Users,
            color: "text-primary",
            bgColor: "bg-primary/5",
          },
          {
            label: "在籍スタッフ",
            value: activeCount,
            icon: UserCheck,
            color: "text-green-600",
            bgColor: "bg-green-50",
          },
          {
            label: "新入社",
            value: newHireCount,
            icon: UserPlus,
            color: "text-blue-600",
            bgColor: "bg-blue-50",
            sub: newHireCount === null ? "※ 複数月のデータが必要" : periodLabel,
          },
          {
            label: "退社",
            value: periodRetirements,
            icon: UserMinus,
            color: "text-red-600",
            bgColor: "bg-red-50",
            sub: periodLabel,
          },
          {
            label: "復帰",
            value: periodReactivations,
            icon: Sparkles,
            color: "text-amber-600",
            bgColor: "bg-amber-50",
            sub: periodLabel,
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
          >
            <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow h-full">
              <CardContent className="p-3 lg:p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stat.bgColor}`}>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                </div>
                <div className="font-mono-data text-2xl font-bold text-foreground">
                  {loading || statsQuery.isLoading ? "..." : stat.value === null ? "—" : stat.value}
                </div>
                <div className="text-[10px] text-muted-foreground leading-tight mt-1">{stat.label}</div>
                {stat.sub && (
                  <div className="text-[9px] text-muted-foreground/60 mt-0.5">{stat.sub}</div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* DB initialization prompt */}
      {!statusQuery.isLoading && !isDbInitialized && !reportLoading && dynamicStaffData.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 mb-6">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  スタッフステータスが未初期化です
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  初回のみ、スプレッドシートのスタッフデータ（{dynamicStaffData.length}名）をデータベースに登録する必要があります。
                </p>
              </div>
            </div>
            <Button
              onClick={handleBulkInit}
              disabled={bulkInitMutation.isPending}
              className="shrink-0"
            >
              {bulkInitMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Database className="w-4 h-4 mr-1.5" />
              )}
              初期化する
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ─── スタッフ一覧セクション ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-lg font-bold text-foreground">スタッフ一覧</h2>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{allStores.length}店舗</span>
          <span>·</span>
          <span>{activeCount}名在籍</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="スタッフ名で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4 text-muted-foreground" />
          <Select value={filterStore} onValueChange={setFilterStore}>
            <SelectTrigger className="w-[160px] bg-white">
              <SelectValue placeholder="店舗" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全店舗</SelectItem>
              {allStores.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant={showRetired ? "default" : "outline"}
          size="sm"
          onClick={() => setShowRetired(!showRetired)}
          className="shrink-0"
        >
          <LogOutIcon className="w-4 h-4 mr-1.5" />
          退社スタッフ{showRetired ? "を非表示" : "も表示"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            statusQuery.refetch();
            statsQuery.refetch();
          }}
          disabled={statusQuery.isFetching}
          className="shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${statusQuery.isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Staff List by Store */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">読み込み中...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(staffByStore.entries()).map(([storeName, storeStaffList]) => (
            <motion.div
              key={storeName}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="border-border/50 overflow-hidden">
                <div className="px-4 py-3 bg-muted/30 border-b border-border/30 flex items-center gap-2">
                  <Store className="w-4 h-4 text-primary" />
                  <span className="font-bold text-sm text-foreground">{storeName}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {storeStaffList.length}名
                  </Badge>
                </div>
                <CardContent className="p-0">
                  <div className="divide-y divide-border/30">
                    {storeStaffList.map((staff) => {
                      const isNew = isNewStaff(staff.name, staff.store);
                      const isRetired = staff.status === "retired";

                      return (
                        <div
                          key={`${staff.name}-${staff.store}`}
                          className={`px-4 py-3 ${isRetired ? "bg-muted/20" : ""}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                isRetired ? "bg-red-50" : "bg-accent"
                              }`}>
                                <User className={`w-4 h-4 ${isRetired ? "text-red-400" : "text-muted-foreground"}`} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-sm font-medium ${isRetired ? "text-muted-foreground line-through" : "text-foreground"}`}>
                                    {staff.name}
                                  </span>
                                  {isNew && !isRetired && (
                                    <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1 py-0.5 leading-none">
                                      NEW
                                    </span>
                                  )}
                                  {isRetired && (
                                    <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-1 py-0.5 leading-none flex items-center gap-0.5">
                                      <LogOutIcon className="w-2.5 h-2.5" />
                                      退社 ({staff.retiredMonth})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Button
                              variant={isRetired ? "outline" : "ghost"}
                              size="sm"
                              onClick={() => openToggleDialog(staff)}
                              className={isRetired
                                ? "text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                                : "text-muted-foreground hover:text-red-600 hover:bg-red-50"
                              }
                            >
                              {isRetired ? (
                                <>
                                  <UserCheck className="w-3.5 h-3.5 mr-1" />
                                  <span className="text-xs">復帰</span>
                                </>
                              ) : (
                                <>
                                  <UserX className="w-3.5 h-3.5 mr-1" />
                                  <span className="text-xs">退社</span>
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {filteredStaff.length === 0 && !loading && (
            <Card className="border-border/50">
              <CardContent className="p-8 text-center">
                <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">
                  {reportLoading
                    ? "スプレッドシートからデータを読み込み中..."
                    : rawData.length === 0
                    ? "スプレッドシートにスタッフデータがありません"
                    : "条件に一致するスタッフがいません"}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ─── 変更履歴セクション ─── */}
      <div className="mt-8">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-2 text-sm font-bold text-foreground hover:text-primary transition-colors mb-4"
        >
          <History className="w-4 h-4" />
          変更履歴
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showHistory ? "rotate-180" : ""}`} />
        </button>

        {showHistory && (
          <Card className="border-border/50 overflow-hidden">
            <CardContent className="p-0">
              {historyQuery.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">履歴を読み込み中...</span>
                </div>
              ) : historyQuery.data && historyQuery.data.length > 0 ? (
                <div className="divide-y divide-border/30">
                  {historyQuery.data.map((entry) => (
                    <div key={entry.id} className="px-4 py-3 hover:bg-accent/20 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                          entry.newStatus === "retired" ? "bg-red-50" : "bg-green-50"
                        }`}>
                          {entry.newStatus === "retired" ? (
                            <UserX className="w-4 h-4 text-red-500" />
                          ) : (
                            <UserCheck className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground">{entry.staffName}</span>
                            <span className="text-xs text-muted-foreground">({entry.storeName})</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                entry.previousStatus === "retired"
                                  ? "border-red-200 text-red-600 bg-red-50/50"
                                  : "border-green-200 text-green-600 bg-green-50/50"
                              }`}
                            >
                              {entry.previousStatus === "retired" ? "退社" : "在籍"}
                            </Badge>
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                entry.newStatus === "retired"
                                  ? "border-red-200 text-red-600 bg-red-50/50"
                                  : "border-green-200 text-green-600 bg-green-50/50"
                              }`}
                            >
                              {entry.newStatus === "retired" ? "退社" : "在籍"}
                            </Badge>
                            {entry.changeMonth && (
                              <span className="text-[10px] text-muted-foreground ml-1">
                                ({entry.changeMonth})
                              </span>
                            )}
                          </div>
                          {entry.note && (
                            <div className="flex items-start gap-1.5 mt-1.5">
                              <MessageSquare className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                              <p className="text-xs text-muted-foreground">{entry.note}</p>
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] text-muted-foreground/70">
                              {formatDateTime(entry.createdAt)}
                            </span>
                            <span className="text-[10px] text-muted-foreground/50">
                              by {entry.changedBy}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <History className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">変更履歴はまだありません</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Confirm Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => {
        if (!open) setConfirmDialog({ ...confirmDialog, open: false });
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmDialog.targetStatus === "retired" ? "退社に変更" : "在籍に復帰"}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.staff && (
                <>
                  <span className="font-medium text-foreground">{confirmDialog.staff.name}</span>
                  <span className="text-muted-foreground">（{confirmDialog.staff.store}）</span>
                  のステータスを
                  {confirmDialog.targetStatus === "retired" ? (
                    <span className="font-medium text-red-600">「退社」</span>
                  ) : (
                    <span className="font-medium text-green-600">「在籍」</span>
                  )}
                  に変更します。この操作は変更履歴に記録されます。
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {confirmDialog.targetStatus === "retired" && (
            <div className="space-y-2 py-2">
              <label className="text-sm font-medium text-foreground">退社月</label>
              <Input
                type="month"
                value={confirmDialog.retiredMonth}
                onChange={(e) => setConfirmDialog({ ...confirmDialog, retiredMonth: e.target.value })}
                className="max-w-[200px]"
              />
              <p className="text-xs text-muted-foreground">
                この月以降、ダッシュボード上でこのスタッフのデータが非表示になります。
              </p>
            </div>
          )}

          {/* メモ入力欄 */}
          <div className="space-y-2 py-1">
            <label className="text-sm font-medium text-foreground">メモ（任意）</label>
            <Textarea
              placeholder={
                confirmDialog.targetStatus === "retired"
                  ? "例: 自己都合退社、転居のため等"
                  : "例: 復帰理由等"
              }
              value={confirmDialog.note}
              onChange={(e) => setConfirmDialog({ ...confirmDialog, note: e.target.value })}
              rows={2}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              変更履歴に記録されます。
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}
              disabled={updateStatusMutation.isPending}
            >
              キャンセル
            </Button>
            <Button
              onClick={executeToggle}
              disabled={updateStatusMutation.isPending}
              variant={confirmDialog.targetStatus === "retired" ? "destructive" : "default"}
            >
              {updateStatusMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : confirmDialog.targetStatus === "retired" ? (
                <UserX className="w-4 h-4 mr-1.5" />
              ) : (
                <UserCheck className="w-4 h-4 mr-1.5" />
              )}
              {confirmDialog.targetStatus === "retired" ? "退社にする" : "在籍に戻す"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
