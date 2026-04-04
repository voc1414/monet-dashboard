import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Users,
  User,
  Store,
  Edit2,
  Save,
  X,
  Search,
  LogOut as LogOutIcon,
  Sparkles,
  RefreshCw,
  Database,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AdminLayout from "@/components/AdminLayout";
import { useMonthlyReport, StaffReport } from "@/hooks/useMonthlyReport";
import { isNewStaff } from "@/lib/newBadge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const ALL_STORES = ["堀江院", "堀江院2nd", "福島院", "高槻院", "姪浜院", "楽々園院"];

interface StaffEntry {
  originalName: string;
  displayName: string;
  store: string;
  hidden: boolean;
  retiredMonth: string | null;
  hasOverride: boolean; // DBにオーバーライドが存在するか
  overrideId?: number;
}

export default function AdminStaff() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStore, setFilterStore] = useState("all");
  const [showRetired, setShowRetired] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    displayName: string;
    store: string;
    retiredMonth: string;
    hidden: boolean;
  } | null>(null);

  // 月末報告書からスタッフ一覧を取得
  const { rawData, loading: reportLoading } = useMonthlyReport();

  // DBのスタッフオーバーライドを取得
  const {
    data: overrides,
    isLoading: overridesLoading,
    refetch: refetchOverrides,
  } = trpc.admin.staffOverrides.useQuery();

  const upsertMutation = trpc.admin.upsertStaffOverride.useMutation({
    onSuccess: () => {
      refetchOverrides();
      toast.success("スタッフ情報を保存しました");
      cancelEdit();
    },
    onError: (err) => {
      toast.error("保存に失敗しました", { description: err.message });
    },
  });

  const loading = reportLoading || overridesLoading;

  // CSVデータとDBオーバーライドを統合してスタッフ一覧を構築
  const staffEntries = useMemo(() => {
    // CSVから一意のスタッフ（name + storeNormalized）を抽出
    const csvStaffMap = new Map<string, { name: string; store: string }>();
    for (const r of rawData) {
      const key = `${r.name}__${r.storeNormalized}`;
      if (!csvStaffMap.has(key)) {
        csvStaffMap.set(key, { name: r.name, store: r.storeNormalized });
      }
    }

    // DBオーバーライドをマップ化（originalName + store → override）
    const overrideMap = new Map<string, NonNullable<typeof overrides>[0]>();
    if (overrides) {
      for (const o of overrides) {
        overrideMap.set(`${o.originalName}__${o.store}`, o);
      }
    }

    const entries: StaffEntry[] = [];

    // CSVスタッフをベースに、DBオーバーライドをマージ
    for (const [, csvStaff] of Array.from(csvStaffMap)) {
      const key = `${csvStaff.name}__${csvStaff.store}`;
      const override = overrideMap.get(key);

      entries.push({
        originalName: csvStaff.name,
        displayName: override ? override.displayName : csvStaff.name,
        store: override ? override.store : csvStaff.store,
        hidden: override ? override.hidden === 1 : false,
        retiredMonth: override?.retiredMonth ?? null,
        hasOverride: !!override,
        overrideId: override?.id,
      });

      // マージ済みのオーバーライドを削除
      overrideMap.delete(key);
    }

    // CSVに存在しないがDBにのみ存在するオーバーライド（手動追加分）
    for (const [, o] of Array.from(overrideMap)) {
      entries.push({
        originalName: o.originalName,
        displayName: o.displayName,
        store: o.store,
        hidden: o.hidden === 1,
        retiredMonth: o.retiredMonth,
        hasOverride: true,
        overrideId: o.id,
      });
    }

    // 店舗名→名前でソート
    entries.sort((a, b) => {
      const storeOrder = ALL_STORES.indexOf(a.store) - ALL_STORES.indexOf(b.store);
      if (storeOrder !== 0) return storeOrder;
      return a.displayName.localeCompare(b.displayName);
    });

    return entries;
  }, [rawData, overrides]);

  // フィルタリング
  const filteredStaff = useMemo(() => {
    return staffEntries.filter((s) => {
      if (!showRetired && s.retiredMonth) return false;
      if (s.hidden) return false;
      if (filterStore !== "all" && s.store !== filterStore) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          s.displayName.toLowerCase().includes(q) ||
          s.originalName.toLowerCase().includes(q) ||
          s.store.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [staffEntries, searchQuery, filterStore, showRetired]);

  // 店舗ごとにグループ化
  const staffByStore = useMemo(() => {
    const map = new Map<string, StaffEntry[]>();
    for (const staff of filteredStaff) {
      const existing = map.get(staff.store) || [];
      existing.push(staff);
      map.set(staff.store, existing);
    }
    return map;
  }, [filteredStaff]);

  const staffKey = (s: StaffEntry) => `${s.originalName}__${s.store}`;

  const startEdit = (staff: StaffEntry) => {
    setEditingKey(staffKey(staff));
    setEditForm({
      displayName: staff.displayName,
      store: staff.store,
      retiredMonth: staff.retiredMonth || "",
      hidden: staff.hidden,
    });
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditForm(null);
  };

  const saveEdit = useCallback(
    (staff: StaffEntry) => {
      if (!editForm) return;
      upsertMutation.mutate({
        originalName: staff.originalName,
        store: staff.store,
        displayName: editForm.displayName.trim(),
        hidden: editForm.hidden ? 1 : 0,
        retiredMonth: editForm.retiredMonth.trim() || null,
      });
    },
    [editForm, upsertMutation]
  );

  const activeCount = staffEntries.filter((s) => !s.retiredMonth && !s.hidden).length;
  const retiredCount = staffEntries.filter((s) => s.retiredMonth).length;
  const overrideCount = staffEntries.filter((s) => s.hasOverride).length;

  return (
    <AdminLayout
      title="スタッフ情報管理"
      breadcrumbs={[{ label: "スタッフ情報" }]}
    >
      <p className="text-sm text-muted-foreground mb-6">
        スタッフの表示名・退社情報を管理します。変更はダッシュボード全体に即時反映されます。
      </p>

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
          variant="outline"
          size="sm"
          onClick={() => refetchOverrides()}
          className="shrink-0"
        >
          <RefreshCw className="w-4 h-4 mr-1.5" />
          更新
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
            <div className="text-xl font-bold font-mono-data flex items-center gap-1">
              {overrideCount}
              <Database className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="text-[10px] text-muted-foreground">DB登録済み</div>
          </CardContent>
        </Card>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
          <span className="text-sm text-muted-foreground">読み込み中...</span>
        </div>
      )}

      {/* Staff List by Store */}
      {!loading && (
        <div className="space-y-4">
          {Array.from(staffByStore.entries()).map(([storeName, staffList]) => (
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
                    {staffList.length}名
                  </Badge>
                </div>
                <CardContent className="p-0">
                  <div className="divide-y divide-border/30">
                    {staffList.map((staff) => {
                      const key = staffKey(staff);
                      const isEditing = editingKey === key;
                      const isNew = isNewStaff(staff.displayName, staff.store);
                      const isRenamed = staff.hasOverride && staff.originalName !== staff.displayName;

                      return (
                        <div key={key} className="px-4 py-3">
                          {isEditing && editForm ? (
                            /* 編集モード */
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-foreground flex items-center gap-2">
                                  <Edit2 className="w-3.5 h-3.5 text-primary" />
                                  編集中
                                  <span className="text-[10px] text-muted-foreground font-normal">
                                    (CSV元名: {staff.originalName})
                                  </span>
                                </span>
                                <div className="flex items-center gap-2">
                                  <Button variant="ghost" size="sm" onClick={cancelEdit}>
                                    <X className="w-3.5 h-3.5 mr-1" />
                                    キャンセル
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => saveEdit(staff)}
                                    disabled={upsertMutation.isPending}
                                  >
                                    <Save className="w-3.5 h-3.5 mr-1" />
                                    {upsertMutation.isPending ? "保存中..." : "保存"}
                                  </Button>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-medium text-muted-foreground">表示名</label>
                                  <Input
                                    value={editForm.displayName}
                                    onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                                    className="h-8 text-sm"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-medium text-muted-foreground">所属店舗</label>
                                  <Select
                                    value={editForm.store}
                                    onValueChange={(v) => setEditForm({ ...editForm, store: v })}
                                  >
                                    <SelectTrigger className="h-8 text-sm">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ALL_STORES.map((s) => (
                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-medium text-muted-foreground">退社月 (YYYY-MM)</label>
                                  <Input
                                    value={editForm.retiredMonth}
                                    onChange={(e) => setEditForm({ ...editForm, retiredMonth: e.target.value })}
                                    placeholder="在籍中"
                                    className="h-8 text-sm"
                                  />
                                </div>
                              </div>
                            </div>
                          ) : (
                            /* 表示モード */
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                                  <User className="w-4 h-4 text-muted-foreground" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-foreground">{staff.displayName}</span>
                                    {isRenamed && (
                                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                        CSV: {staff.originalName}
                                      </span>
                                    )}
                                    {staff.hasOverride && (
                                      <Database className="w-3 h-3 text-primary" />
                                    )}
                                    {isNew && (
                                      <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1 py-0.5 leading-none">
                                        NEW
                                      </span>
                                    )}
                                    {staff.retiredMonth && (
                                      <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-1 py-0.5 leading-none flex items-center gap-0.5">
                                        <LogOutIcon className="w-2.5 h-2.5" />
                                        退社 ({staff.retiredMonth})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startEdit(staff)}
                                className="text-muted-foreground hover:text-primary"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
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
                  条件に一致するスタッフがいません
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
