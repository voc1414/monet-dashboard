import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Store,
  MapPin,
  Calendar,
  Edit2,
  Save,
  X,
  Plus,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AdminLayout from "@/components/AdminLayout";
import { useStores } from "@/hooks/useStores";
import { toast } from "sonner";

// 現在のハードコード店舗データ（将来的にはDBから取得）
const INITIAL_STORES = [
  { name: "堀江院", area: "大阪エリア", aliases: ["大阪堀江院"], newExpiry: "" },
  { name: "堀江院2nd", area: "大阪エリア", aliases: ["大阪堀江院2nd"], newExpiry: "2026-05" },
  { name: "福島院", area: "大阪エリア", aliases: ["大阪福島院"], newExpiry: "2026-08" },
  { name: "高槻院", area: "大阪エリア", aliases: ["大阪高槻院"], newExpiry: "2026-08" },
  { name: "姪浜院", area: "福岡エリア", aliases: ["福岡姪浜院"], newExpiry: "" },
  { name: "楽々園院", area: "広島エリア", aliases: ["広島楽々園院"], newExpiry: "" },
];

interface StoreData {
  name: string;
  area: string;
  aliases: string[];
  newExpiry: string;
}

export default function AdminStores() {
  const { isNewStore: isNewStoreFn } = useStores();
  const [stores] = useState<StoreData[]>(INITIAL_STORES);
  const [editingStore, setEditingStore] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<StoreData | null>(null);

  const startEdit = (store: StoreData) => {
    setEditingStore(store.name);
    setEditForm({ ...store });
  };

  const cancelEdit = () => {
    setEditingStore(null);
    setEditForm(null);
  };

  const saveEdit = () => {
    // 将来的にはAPI経由でDBに保存
    toast.info("店舗情報の保存機能は準備中です", {
      description: "データベース連携後に利用可能になります",
    });
    cancelEdit();
  };

  return (
    <AdminLayout
      title="店舗情報管理"
      breadcrumbs={[{ label: "店舗情報" }]}
    >
      <p className="text-sm text-muted-foreground mb-6">
        店舗名・エリア・NEWバッジ期限・店舗名エイリアスを管理します。
        現在はフロントエンドのハードコードデータを表示しています。
      </p>

      <div className="space-y-3">
        {stores.map((store, i) => {
          const isEditing = editingStore === store.name;
          const isNew = isNewStoreFn(store.name);

          return (
            <motion.div
              key={store.name}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
            >
              <Card className="border-border/50">
                <CardContent className="p-4">
                  {isEditing && editForm ? (
                    /* 編集モード */
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                          <Edit2 className="w-4 h-4 text-primary" />
                          {store.name} を編集
                        </h3>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={cancelEdit}>
                            <X className="w-4 h-4 mr-1" />
                            キャンセル
                          </Button>
                          <Button size="sm" onClick={saveEdit}>
                            <Save className="w-4 h-4 mr-1" />
                            保存
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">店舗名</label>
                          <Input
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">エリア</label>
                          <Input
                            value={editForm.area}
                            onChange={(e) => setEditForm({ ...editForm, area: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">
                            NEWバッジ期限 (YYYY-MM)
                          </label>
                          <Input
                            value={editForm.newExpiry}
                            onChange={(e) => setEditForm({ ...editForm, newExpiry: e.target.value })}
                            placeholder="例: 2026-08"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                          エイリアス（カンマ区切り）
                        </label>
                        <Input
                          value={editForm.aliases.join(", ")}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              aliases: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                            })
                          }
                          placeholder="例: 大阪堀江院, 堀江"
                        />
                      </div>
                    </div>
                  ) : (
                    /* 表示モード */
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Store className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="font-bold text-sm text-foreground">{store.name}</h3>
                            {isNew && (
                              <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1 py-0.5 leading-none">
                                NEW
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {store.area}
                            </span>
                            {store.newExpiry && (
                              <span className="flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-orange-500" />
                                NEW期限: {store.newExpiry}
                              </span>
                            )}
                            {store.aliases.length > 0 && (
                              <span className="flex items-center gap-1">
                                別名: {store.aliases.join(", ")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(store)}
                        className="text-muted-foreground hover:text-primary"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* 新規店舗追加ボタン */}
      <div className="mt-6">
        <Button
          variant="outline"
          className="w-full border-dashed"
          onClick={() => toast.info("新規店舗追加機能は準備中です")}
        >
          <Plus className="w-4 h-4 mr-2" />
          新しい店舗を追加
        </Button>
      </div>
    </AdminLayout>
  );
}
