import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Users,
  User,
  Store,
  Edit2,
  Save,
  X,
  Plus,
  Search,
  Calendar,
  LogOut as LogOutIcon,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AdminLayout from "@/components/AdminLayout";
import { useMonthlyReport } from "@/hooks/useMonthlyReport";
import { isNewStaff, isRetiredStaff } from "@/lib/newBadge";
import { toast } from "sonner";

// STAFF_STORE_MAP のデータ（useFankuruData.tsから転記）
const STAFF_DATA: { name: string; store: string; retired?: string }[] = [
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
  { name: "Hitomi", store: "福島院", retired: "2026-04" },
];

const ALL_STORES = ["堀江院", "堀江院2nd", "福島院", "高槻院", "姪浜院", "楽々園院"];

export default function AdminStaff() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStore, setFilterStore] = useState("all");
  const [showRetired, setShowRetired] = useState(false);
  const [editingStaff, setEditingStaff] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<typeof STAFF_DATA[0] | null>(null);

  const filteredStaff = useMemo(() => {
    return STAFF_DATA.filter((s) => {
      // 退社スタッフフィルタ
      if (!showRetired && s.retired) return false;
      // 店舗フィルタ
      if (filterStore !== "all" && s.store !== filterStore) return false;
      // 検索フィルタ
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return s.name.toLowerCase().includes(q) || s.store.toLowerCase().includes(q);
      }
      return true;
    });
  }, [searchQuery, filterStore, showRetired]);

  // 店舗ごとにグループ化
  const staffByStore = useMemo(() => {
    const map = new Map<string, typeof STAFF_DATA>();
    for (const staff of filteredStaff) {
      const existing = map.get(staff.store) || [];
      existing.push(staff);
      map.set(staff.store, existing);
    }
    return map;
  }, [filteredStaff]);

  const startEdit = (staff: typeof STAFF_DATA[0]) => {
    setEditingStaff(staff.name);
    setEditForm({ ...staff });
  };

  const cancelEdit = () => {
    setEditingStaff(null);
    setEditForm(null);
  };

  const saveEdit = () => {
    toast.info("スタッフ情報の保存機能は準備中です", {
      description: "データベース連携後に利用可能になります",
    });
    cancelEdit();
  };

  return (
    <AdminLayout
      title="スタッフ情報管理"
      breadcrumbs={[{ label: "スタッフ情報" }]}
    >
      <p className="text-sm text-muted-foreground mb-6">
        スタッフの所属店舗・名前エイリアス・退社情報を管理します。
        現在はフロントエンドのハードコードデータを表示しています。
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
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="border-border/50">
          <CardContent className="p-3">
            <div className="text-xl font-bold font-mono-data">{STAFF_DATA.filter(s => !s.retired).length}</div>
            <div className="text-[10px] text-muted-foreground">在籍スタッフ</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3">
            <div className="text-xl font-bold font-mono-data">{STAFF_DATA.filter(s => s.retired).length}</div>
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
                    const isEditing = editingStaff === staff.name;
                    const isNew = isNewStaff(staff.name, staff.store);

                    return (
                      <div key={`${staff.name}-${staff.store}`} className="px-4 py-3">
                        {isEditing && editForm ? (
                          /* 編集モード */
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-bold text-foreground flex items-center gap-2">
                                <Edit2 className="w-3.5 h-3.5 text-primary" />
                                編集中
                              </span>
                              <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" onClick={cancelEdit}>
                                  <X className="w-3.5 h-3.5 mr-1" />
                                  キャンセル
                                </Button>
                                <Button size="sm" onClick={saveEdit}>
                                  <Save className="w-3.5 h-3.5 mr-1" />
                                  保存
                                </Button>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <label className="text-[10px] font-medium text-muted-foreground">名前</label>
                                <Input
                                  value={editForm.name}
                                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
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
                                  value={editForm.retired || ""}
                                  onChange={(e) => setEditForm({ ...editForm, retired: e.target.value || undefined })}
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
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-foreground">{staff.name}</span>
                                  {isNew && (
                                    <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1 py-0.5 leading-none">
                                      NEW
                                    </span>
                                  )}
                                  {staff.retired && (
                                    <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-1 py-0.5 leading-none flex items-center gap-0.5">
                                      <LogOutIcon className="w-2.5 h-2.5" />
                                      退社 ({staff.retired})
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

      {/* 新規スタッフ追加ボタン */}
      <div className="mt-6">
        <Button
          variant="outline"
          className="w-full border-dashed"
          onClick={() => toast.info("新規スタッフ追加機能は準備中です")}
        >
          <Plus className="w-4 h-4 mr-2" />
          新しいスタッフを追加
        </Button>
      </div>
    </AdminLayout>
  );
}
