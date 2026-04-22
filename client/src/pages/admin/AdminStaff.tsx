import { useState, useMemo, useEffect } from "react";
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

// Hardcoded staff list (source of truth for staff names + stores)
const STAFF_DATA: { name: string; store: string }[] = [
  // 姪浜院
  { name: "山口純奈", store: "姪浜院" },
  { name: "金田あゆみ", store: "姪浜院" },
  { name: "石橋 茉", store: "姪浜院" },
  { name: "藤田", store: "姪浜院" },
  // 楽々園院
  { name: "井上 恵子", store: "楽々園院" },
  { name: "前田慶子", store: "楽々園院" },
  { name: "千葉祐子", store: "楽々園院" },
  { name: "石原葉子", store: "楽々園院" },
  { name: "田中 江梨子", store: "楽々園院" },
  // 堀江院
  { name: "Kaede", store: "堀江院" },
  // 堀江院2nd
  { name: "Mimi", store: "堀江院2nd" },
  { name: "sayuri", store: "堀江院2nd" },
  { name: "Aki", store: "堀江院2nd" },
  { name: "Kazumi", store: "堀江院2nd" },
  { name: "Hiromi", store: "堀江院2nd" },
  // 高槻院
  { name: "Yuko", store: "高槻院" },
  { name: "Asuka", store: "高槻院" },
  { name: "Mariko", store: "高槻院" },
  { name: "Nao", store: "高槻院" },
  // 福島院
  { name: "Yu", store: "福島院" },
  { name: "yoshie", store: "福島院" },
  { name: "Hiroko", store: "福島院" },
  { name: "Mika", store: "福島院" },
  { name: "Hitomi", store: "福島院" },
];

const ALL_STORES = ["堀江院", "堀江院2nd", "福島院", "高槻院", "姪浜院", "楽々園院"];

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

  // Merge hardcoded staff data with DB status
  const staffList: StaffWithStatus[] = useMemo(() => {
    const dbStatuses = statusQuery.data || [];
    const statusMap = new Map<string, { status: "active" | "retired"; retiredMonth: string | null }>();
    for (const s of dbStatuses) {
      statusMap.set(`${s.staffName}|${s.storeName}`, { status: s.status, retiredMonth: s.retiredMonth });
    }

    return STAFF_DATA.map((staff) => {
      const key = `${staff.name}|${staff.store}`;
      const dbStatus = statusMap.get(key);
      return {
        name: staff.name,
        store: staff.store,
        status: dbStatus?.status || "active",
        retiredMonth: dbStatus?.retiredMonth || null,
      };
    });
  }, [statusQuery.data]);

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

  // Bulk initialize from hardcoded data
  const handleBulkInit = () => {
    // Default: Hitomi is retired, everyone else is active
    const initList = STAFF_DATA.map((s) => ({
      staffName: s.name,
      storeName: s.store,
      status: (s.name === "Hitomi" && s.store === "福島院" ? "retired" : "active") as "active" | "retired",
      retiredMonth: s.name === "Hitomi" && s.store === "福島院" ? "2026-04" : null,
    }));
    bulkInitMutation.mutate({ staffList: initList });
  };

  return (
    <AdminLayout
      title="スタッフ情報管理"
      breadcrumbs={[{ label: "スタッフ情報" }]}
    >
      <p className="text-sm text-muted-foreground mb-6">
        スタッフの在籍・退社ステータスを管理します。ステータスの変更は全ページに即時反映されます。
      </p>

      {/* DB initialization prompt */}
      {!statusQuery.isLoading && !isDbInitialized && (
        <Card className="border-amber-200 bg-amber-50/50 mb-6">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  スタッフステータスが未初期化です
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  初回のみ、現在のスタッフデータをデータベースに登録する必要があります。
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
              {ALL_STORES.map((s) => (
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
            <div className="text-xl font-bold font-mono-data">{ALL_STORES.length}</div>
            <div className="text-[10px] text-muted-foreground">店舗数</div>
          </CardContent>
        </Card>
      </div>

      {/* Staff List by Store */}
      {statusQuery.isLoading ? (
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

          {filteredStaff.length === 0 && (
            <Card className="border-border/50">
              <CardContent className="p-8 text-center">
                <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">
                  条件に一致するスタッフがいません
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
