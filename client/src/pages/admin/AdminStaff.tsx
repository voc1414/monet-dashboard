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
  Loader2,
  RefreshCw,
  Database,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    // 全角スペース → 半角スペース
    .replace(/\u3000/g, " ")
    // 連続スペースを1つに
    .replace(/\s{2,}/g, " ")
    .trim();

  // 既知のサフィックスを除去（スペース区切りの後に続くもの）
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

type StaffWithStatus = {
  name: string;
  store: string;
  status: "active" | "retired";
  retiredMonth: string | null;
};

export default function AdminStaff() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStore, setFilterStore] = useState("all");
  const [showRetired, setShowRetired] = useState(false);

  // Dialog state for status toggle confirmation
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    staff: StaffWithStatus | null;
    targetStatus: "active" | "retired";
    retiredMonth: string;
  }>({ open: false, staff: null, targetStatus: "active", retiredMonth: getCurrentYearMonth() });

  // ─── スプレッドシートからスタッフ一覧を動的取得 ───
  const { rawData, loading: reportLoading } = useMonthlyReport();

  // rawDataからユニークなスタッフ一覧を抽出（正規化済み）
  const dynamicStaffData = useMemo(() => {
    if (!rawData.length) return [];

    const seen = new Map<string, { name: string; store: string }>();
    for (const r of rawData) {
      const normalizedName = normalizeStaffName(r.name);
      const store = r.storeNormalized;

      // テストデータを除外
      if (TEST_NAMES.has(normalizedName) || TEST_NAMES.has(r.name)) continue;
      // 空の名前を除外
      if (!normalizedName || !store) continue;

      const key = `${normalizedName}|${store}`;
      if (!seen.has(key)) {
        seen.set(key, { name: normalizedName, store });
      }
    }

    return Array.from(seen.values()).sort((a, b) =>
      a.store.localeCompare(b.store, "ja") || a.name.localeCompare(b.name, "ja")
    );
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

  const updateStatusMutation = trpc.admin.updateStaffStatus.useMutation({
    onSuccess: () => {
      statusQuery.refetch();
      toast.success("ステータスを更新しました");
      setConfirmDialog({ open: false, staff: null, targetStatus: "active", retiredMonth: getCurrentYearMonth() });
    },
    onError: (err) => {
      toast.error("ステータスの更新に失敗しました", { description: err.message });
    },
  });

  const bulkInitMutation = trpc.admin.bulkInitStaffStatuses.useMutation({
    onSuccess: (data) => {
      statusQuery.refetch();
      toast.success(`${data.count}名のステータスを初期化しました`);
    },
    onError: (err) => {
      toast.error("初期化に失敗しました", { description: err.message });
    },
  });

  // ─── DBステータスとのマージ（正規化マッチング） ───
  const staffList: StaffWithStatus[] = useMemo(() => {
    const dbStatuses = statusQuery.data || [];

    // DB側の正規化キー → ステータスのマップ
    // 完全一致用
    const exactMap = new Map<string, { status: "active" | "retired"; retiredMonth: string | null }>();
    // 正規化マッチング用（スペース除去+小文字）
    const normalizedMap = new Map<string, { status: "active" | "retired"; retiredMonth: string | null }>();

    for (const s of dbStatuses) {
      const exactKey = `${s.staffName}|${s.storeName}`;
      exactMap.set(exactKey, { status: s.status, retiredMonth: s.retiredMonth });

      const normKey = `${normalizeForMatching(s.staffName)}|${s.storeName}`;
      normalizedMap.set(normKey, { status: s.status, retiredMonth: s.retiredMonth });
    }

    // スプレッドシートのスタッフ一覧にDBステータスをマージ
    const result: StaffWithStatus[] = dynamicStaffData.map((staff) => {
      // 1. 完全一致を試みる
      const exactKey = `${staff.name}|${staff.store}`;
      let dbStatus = exactMap.get(exactKey);

      // 2. 正規化マッチング（スペース差異を吸収）
      if (!dbStatus) {
        const normKey = `${normalizeForMatching(staff.name)}|${staff.store}`;
        dbStatus = normalizedMap.get(normKey);
      }

      return {
        name: staff.name,
        store: staff.store,
        status: dbStatus?.status || "active",
        retiredMonth: dbStatus?.retiredMonth || null,
      };
    });

    // DBにのみ存在するスタッフ（スプレッドシートにいないが退社ステータスが設定されている等）も追加
    const dynamicKeys = new Set(dynamicStaffData.map((s) => `${normalizeForMatching(s.name)}|${s.store}`));
    for (const s of dbStatuses) {
      const normKey = `${normalizeForMatching(s.staffName)}|${s.storeName}`;
      if (!dynamicKeys.has(normKey)) {
        result.push({
          name: s.staffName,
          store: s.storeName,
          status: s.status,
          retiredMonth: s.retiredMonth,
        });
      }
    }

    return result;
  }, [dynamicStaffData, statusQuery.data]);

  // Check if DB has been initialized
  const isDbInitialized = (statusQuery.data?.length || 0) > 0;

  // Filter staff
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

  // Stats
  const activeCount = staffList.filter((s) => s.status === "active").length;
  const retiredCount = staffList.filter((s) => s.status === "retired").length;

  // Open confirm dialog
  const openToggleDialog = (staff: StaffWithStatus) => {
    const targetStatus = staff.status === "active" ? "retired" : "active";
    setConfirmDialog({
      open: true,
      staff,
      targetStatus,
      retiredMonth: staff.retiredMonth || getCurrentYearMonth(),
    });
  };

  // Execute status toggle
  const executeToggle = () => {
    if (!confirmDialog.staff) return;
    updateStatusMutation.mutate({
      staffName: confirmDialog.staff.name,
      storeName: confirmDialog.staff.store,
      status: confirmDialog.targetStatus,
      retiredMonth: confirmDialog.targetStatus === "retired" ? confirmDialog.retiredMonth : null,
    });
  };

  // Bulk initialize from dynamic spreadsheet data
  const handleBulkInit = () => {
    if (dynamicStaffData.length === 0) {
      toast.error("スプレッドシートのデータがまだ読み込まれていません");
      return;
    }

    // 既知の退社スタッフ（Hitomi@福島院）
    const initList = dynamicStaffData.map((s) => ({
      staffName: s.name,
      storeName: s.store,
      status: (s.name === "Hitomi" && s.store === "福島院" ? "retired" : "active") as "active" | "retired",
      retiredMonth: s.name === "Hitomi" && s.store === "福島院" ? "2026-04" : null,
    }));
    bulkInitMutation.mutate({ staffList: initList });
  };

  const loading = reportLoading || statusQuery.isLoading;

  return (
    <AdminLayout
      title="スタッフ情報管理"
      breadcrumbs={[{ label: "スタッフ情報" }]}
    >
      <p className="text-sm text-muted-foreground mb-6">
        スタッフの在籍・退社ステータスを管理します。ステータスの変更は全ページに即時反映されます。
        <br />
        <span className="text-xs text-muted-foreground/70">
          スタッフ一覧は月末報告書スプレッドシートから自動取得されます。新しいスタッフが報告書を提出すると自動的に表示されます。
        </span>
      </p>

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
              size="sm"
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
          onClick={() => statusQuery.refetch()}
          disabled={statusQuery.isFetching}
          className="shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${statusQuery.isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="border-border/50">
          <CardContent className="p-3">
            <div className="text-xl font-bold font-mono-data">{activeCount}</div>
            <div className="text-[10px] text-muted-foreground">在籍スタッフ</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3">
            <div className="text-xl font-bold font-mono-data">{retiredCount}</div>
            <div className="text-[10px] text-muted-foreground">退社スタッフ</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3">
            <div className="text-xl font-bold font-mono-data">{allStores.length}</div>
            <div className="text-[10px] text-muted-foreground">店舗数</div>
          </CardContent>
        </Card>
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
                  に変更します。
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
