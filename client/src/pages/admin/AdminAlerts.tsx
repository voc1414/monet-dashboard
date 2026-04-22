import { useState, useMemo } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Filter,
  Store,
  User,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import AdminLayout from "@/components/AdminLayout";
import { useMonthlyReport } from "@/hooks/useMonthlyReport";
import { validateStoreReport, getAlertSummary, type ReportAlert, type AlertSeverity } from "@/lib/reportValidation";
import { PeriodSelector, getDefaultPeriodSelection, getFilterMonths, getPeriodLabel } from "@/components/PeriodSelector";
import type { PeriodSelection } from "@/components/PeriodSelector";

const AREA_STORES: { area: string; stores: string[] }[] = [
  { area: "大阪エリア", stores: ["堀江院", "堀江院2nd", "福島院", "高槻院"] },
  { area: "福岡エリア", stores: ["姪浜院"] },
  { area: "広島エリア", stores: ["楽々園院"] },
];

const ALL_STORES = AREA_STORES.flatMap((a) => a.stores);

const severityConfig: Record<AlertSeverity, { icon: typeof AlertTriangle; label: string; color: string; bgColor: string; borderColor: string }> = {
  error: {
    icon: AlertCircle,
    label: "エラー",
    color: "#dc2626",
    bgColor: "#fee2e2",
    borderColor: "#fecaca",
  },
  warning: {
    icon: AlertTriangle,
    label: "警告",
    color: "#d97706",
    bgColor: "#fef3c7",
    borderColor: "#fde68a",
  },
  info: {
    icon: Info,
    label: "情報",
    color: "#2563eb",
    bgColor: "#dbeafe",
    borderColor: "#bfdbfe",
  },
};

interface StoreAlert extends ReportAlert {
  storeName: string;
}

export default function AdminAlerts() {
  const { loading, error, getStoreMonthlyStats, availableMonths } = useMonthlyReport();

  const [periodSelection, setPeriodSelection] = useState<PeriodSelection>(getDefaultPeriodSelection());
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterStore, setFilterStore] = useState<string>("all");

  const filterM = useMemo(() => getFilterMonths(periodSelection, availableMonths), [periodSelection, availableMonths]);
  const isAllPeriod = filterM === "all";

  // 全店舗のアラートを収集
  // getStoreMonthlyStats は単一月のみ受け付けるため、複数月の場合は各月ごとに呼び出して集約する
  const allAlerts = useMemo(() => {
    const alerts: StoreAlert[] = [];

    if (isAllPeriod) {
      // 全期間: month=undefined で全データ集約
      for (const storeName of ALL_STORES) {
        const stats = getStoreMonthlyStats(storeName, undefined);
        const storeAlerts = validateStoreReport(stats);
        for (const alert of storeAlerts) {
          alerts.push({ ...alert, storeName });
        }
      }
    } else {
      const months = filterM as string[];
      // 各月ごとにアラートを収集（重複排除のためSetで管理）
      for (const storeName of ALL_STORES) {
        const seenKeys = new Set<string>();
        for (const month of months) {
          const stats = getStoreMonthlyStats(storeName, month);
          const storeAlerts = validateStoreReport(stats);
          for (const alert of storeAlerts) {
            // staffName + message でユニークキーを作成して重複排除
            const key = `${alert.staffName}|${alert.message}|${month}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              alerts.push({ ...alert, storeName });
            }
          }
        }
      }
    }

    return alerts;
  }, [filterM, isAllPeriod, getStoreMonthlyStats]);

  // フィルタリング
  const filteredAlerts = useMemo(() => {
    return allAlerts.filter((a) => {
      if (filterSeverity !== "all" && a.severity !== filterSeverity) return false;
      if (filterStore !== "all" && a.storeName !== filterStore) return false;
      return true;
    });
  }, [allAlerts, filterSeverity, filterStore]);

  const summary = getAlertSummary(allAlerts);

  // 店舗ごとにグループ化
  const alertsByStore = useMemo(() => {
    const map = new Map<string, StoreAlert[]>();
    for (const alert of filteredAlerts) {
      const existing = map.get(alert.storeName) || [];
      existing.push(alert);
      map.set(alert.storeName, existing);
    }
    return map;
  }, [filteredAlerts]);

  return (
    <AdminLayout title="アラート一覧">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="text-2xl font-bold font-mono-data text-foreground">{summary.total}</div>
            <div className="text-xs text-muted-foreground">全アラート</div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <div className="text-2xl font-bold font-mono-data text-red-700">{summary.errors}</div>
            </div>
            <div className="text-xs text-red-600/80">エラー</div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <div className="text-2xl font-bold font-mono-data text-amber-700">{summary.warnings}</div>
            </div>
            <div className="text-xs text-amber-600/80">警告</div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600" />
              <div className="text-2xl font-bold font-mono-data text-blue-700">{summary.infos}</div>
            </div>
            <div className="text-xs text-blue-600/80">情報</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <PeriodSelector allMonths={availableMonths} selection={periodSelection} onChange={setPeriodSelection} />

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={filterSeverity} onValueChange={setFilterSeverity}>
            <SelectTrigger className="w-[140px] bg-white">
              <SelectValue placeholder="重要度" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="error">エラー</SelectItem>
              <SelectItem value="warning">警告</SelectItem>
              <SelectItem value="info">情報</SelectItem>
            </SelectContent>
          </Select>
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
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-20 bg-muted rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 text-destructive rounded-lg p-4 mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Alert List */}
      {!loading && !error && (
        <div className="space-y-4">
          {filteredAlerts.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="p-8 text-center">
                <AlertTriangle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">
                  {allAlerts.length === 0
                    ? "アラートはありません"
                    : "フィルタ条件に一致するアラートはありません"}
                </p>
              </CardContent>
            </Card>
          ) : (
            Array.from(alertsByStore.entries()).map(([storeName, alerts]) => (
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
                      <Badge variant="outline" className="text-[10px]">
                        {alerts.length}件
                      </Badge>
                    </div>
                    <Link href={`/store/${encodeURIComponent(storeName)}`}>
                      <span className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                        店舗詳細
                        <ExternalLink className="w-3 h-3" />
                      </span>
                    </Link>
                  </div>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border/30">
                      {alerts.map((alert, i) => {
                        const config = severityConfig[alert.severity];
                        const Icon = config.icon;
                        return (
                          <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-accent/20 transition-colors">
                            <div
                              className="mt-0.5 p-1.5 rounded-md shrink-0"
                              style={{ backgroundColor: config.bgColor }}
                            >
                              <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-bold" style={{ color: config.color }}>
                                  {config.label}
                                </span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {alert.staffName}
                                </span>
                              </div>
                              <p className="text-sm text-foreground">{alert.message}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                実際の値: {alert.actualValue}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      )}
    </AdminLayout>
  );
}
