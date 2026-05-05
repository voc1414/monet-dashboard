import { useState, useMemo, useCallback } from "react";
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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AdminLayout from "@/components/AdminLayout";
import { useNpsData, calculateStoreStats, filterByMonth, getAvailableMonths, type NpsRecord } from "@/hooks/useNpsData";
import { useFankuruData, type FankuruPdf } from "@/hooks/useFankuruData";
import { toast } from "sonner";
import { useStores } from "@/hooks/useStores";

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

  return (
    <div>
      {/* Month Filter */}
      <div className="px-4 py-2 border-b border-border/20 flex items-center gap-2">
        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[140px] h-7 text-xs bg-white">
            <SelectValue placeholder="月を選択" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全期間</SelectItem>
            {availableMonths.map((m) => (
              <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-[10px] text-muted-foreground">
          {filteredPdfs.length}件
        </span>
      </div>

      {/* PDF List */}
      {filteredPdfs.length === 0 ? (
        <div className="p-4 text-center text-xs text-muted-foreground">
          この期間のファンくるデータはありません
        </div>
      ) : (
        <div className="divide-y divide-border/20">
          {filteredPdfs.map((pdf) => (
            <div key={pdf.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-accent/20 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground truncate">
                      {pdf.displayName || pdf.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {pdf.date}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {pdf.stylist ? (
                      <span className="text-[10px] text-primary flex items-center gap-0.5">
                        <User className="w-2.5 h-2.5" />
                        {pdf.stylist}
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-600 flex items-center gap-0.5">
                        <User className="w-2.5 h-2.5" />
                        担当未設定
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-muted-foreground hover:text-primary"
                  onClick={() => {
                    toast.info("担当スタッフ振り分け機能は準備中です", {
                      description: "データベース連携後に利用可能になります",
                    });
                  }}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                </Button>
                {pdf.viewUrl && (
                  <a
                    href={pdf.viewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-primary"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </a>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    toast.info("削除機能は準備中です", {
                      description: "データベース連携後に利用可能になります",
                    });
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminSurveys() {
  const { allStores: ALL_STORES, npsAliasMap } = useStores();
  const { records, loading: npsLoading } = useNpsData(npsAliasMap);
  const [filterStore, setFilterStore] = useState("all");
  const [activeTab, setActiveTab] = useState<"fankuru" | "nps">("fankuru");

  const npsMonths = useMemo(() => getAvailableMonths(records), [records]);

  const storesToShow = filterStore === "all" ? ALL_STORES : [filterStore];

  return (
    <AdminLayout
      title="アンケート情報管理"
      breadcrumbs={[{ label: "アンケート情報" }]}
    >
      <p className="text-sm text-muted-foreground mb-6">
        ファンくる調査結果の担当スタッフ振り分けや、不要データの削除を行います。
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
      </div>

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

      {/* Content */}
      {activeTab === "fankuru" ? (
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
      ) : (
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
      )}
    </AdminLayout>
  );
}
