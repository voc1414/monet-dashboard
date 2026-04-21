/**
 * PeriodSelector — 期間セレクタコンポーネント
 * 5つのモード: 先月（デフォルト）/ 指定月 / 年間 / 指定期間 / 全期間
 */
import { useState, useMemo, useCallback } from "react";
import { Calendar } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type PeriodMode = "last_month" | "specific_month" | "yearly" | "custom_range" | "all";

export interface PeriodSelection {
  mode: PeriodMode;
  /** 指定月モード時の年月 "YYYY-MM" */
  month?: string;
  /** 年間モード時の年 "YYYY" */
  year?: string;
  /** 指定期間モード時の開始月 "YYYY-MM" */
  rangeStart?: string;
  /** 指定期間モード時の終了月 "YYYY-MM" */
  rangeEnd?: string;
}

/** 期間選択から、フィルタリングに使う月リストを返す */
export function getFilterMonths(selection: PeriodSelection, allMonths: string[]): string[] | "all" {
  switch (selection.mode) {
    case "all":
      return "all";
    case "last_month": {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const ym = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;
      return [ym];
    }
    case "specific_month":
      return selection.month ? [selection.month] : "all";
    case "yearly":
      if (!selection.year) return "all";
      return allMonths.filter((m) => m.startsWith(selection.year!));
    case "custom_range": {
      if (!selection.rangeStart || !selection.rangeEnd) return "all";
      return allMonths.filter((m) => m >= selection.rangeStart! && m <= selection.rangeEnd!);
    }
    default:
      return "all";
  }
}

/** 期間選択のラベルを生成 */
export function getPeriodLabel(selection: PeriodSelection): string {
  switch (selection.mode) {
    case "all":
      return "全期間";
    case "last_month":
      return "先月";
    case "specific_month":
      return selection.month ? formatMonth(selection.month) : "指定月";
    case "yearly":
      return selection.year ? `${selection.year}年` : "年間";
    case "custom_range":
      if (selection.rangeStart && selection.rangeEnd) {
        return `${formatMonth(selection.rangeStart)} 〜 ${formatMonth(selection.rangeEnd)}`;
      }
      return "指定期間";
    default:
      return "";
  }
}

function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  return `${y}年${parseInt(m)}月`;
}

interface PeriodSelectorProps {
  allMonths: string[];
  selection: PeriodSelection;
  onChange: (selection: PeriodSelection) => void;
}

export function PeriodSelector({ allMonths, selection, onChange }: PeriodSelectorProps) {
  const availableYears = useMemo(() => {
    const years = new Set(allMonths.map((m) => m.split("-")[0]));
    return Array.from(years).sort().reverse();
  }, [allMonths]);

  const handleModeChange = useCallback(
    (mode: string) => {
      const m = mode as PeriodMode;
      if (m === "last_month") {
        onChange({ mode: m });
      } else if (m === "all") {
        onChange({ mode: m });
      } else if (m === "specific_month") {
        onChange({ mode: m, month: allMonths[0] || undefined });
      } else if (m === "yearly") {
        onChange({ mode: m, year: availableYears[0] || undefined });
      } else if (m === "custom_range") {
        const end = allMonths[0] || undefined;
        const start = allMonths[Math.min(allMonths.length - 1, 11)] || undefined;
        onChange({ mode: m, rangeStart: start, rangeEnd: end });
      }
    },
    [onChange, allMonths, availableYears]
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />

      {/* モード選択 */}
      <Select value={selection.mode} onValueChange={handleModeChange}>
        <SelectTrigger className="w-[130px] bg-white text-sm">
          <SelectValue placeholder="期間" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="last_month">先月</SelectItem>
          <SelectItem value="specific_month">指定月</SelectItem>
          <SelectItem value="yearly">年間</SelectItem>
          <SelectItem value="custom_range">指定期間</SelectItem>
          <SelectItem value="all">全期間</SelectItem>
        </SelectContent>
      </Select>

      {/* 指定月サブセレクタ */}
      {selection.mode === "specific_month" && (
        <Select
          value={selection.month || ""}
          onValueChange={(v) => onChange({ ...selection, month: v })}
        >
          <SelectTrigger className="w-[150px] bg-white text-sm">
            <SelectValue placeholder="月を選択" />
          </SelectTrigger>
          <SelectContent>
            {allMonths.map((m) => (
              <SelectItem key={m} value={m}>
                {formatMonth(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* 年間サブセレクタ */}
      {selection.mode === "yearly" && (
        <Select
          value={selection.year || ""}
          onValueChange={(v) => onChange({ ...selection, year: v })}
        >
          <SelectTrigger className="w-[120px] bg-white text-sm">
            <SelectValue placeholder="年を選択" />
          </SelectTrigger>
          <SelectContent>
            {availableYears.map((y) => (
              <SelectItem key={y} value={y}>
                {y}年
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* 指定期間サブセレクタ */}
      {selection.mode === "custom_range" && (
        <div className="flex items-center gap-1.5">
          <Select
            value={selection.rangeStart || ""}
            onValueChange={(v) => {
              const newStart = v;
              const newEnd = selection.rangeEnd && v > selection.rangeEnd ? v : selection.rangeEnd;
              onChange({ ...selection, rangeStart: newStart, rangeEnd: newEnd });
            }}
          >
            <SelectTrigger className="w-[140px] bg-white text-sm">
              <SelectValue placeholder="開始月" />
            </SelectTrigger>
            <SelectContent>
              {allMonths.map((m) => (
                <SelectItem key={m} value={m}>
                  {formatMonth(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">〜</span>
          <Select
            value={selection.rangeEnd || ""}
            onValueChange={(v) => {
              const newEnd = v;
              const newStart = selection.rangeStart && v < selection.rangeStart ? v : selection.rangeStart;
              onChange({ ...selection, rangeEnd: newEnd, rangeStart: newStart });
            }}
          >
            <SelectTrigger className="w-[140px] bg-white text-sm">
              <SelectValue placeholder="終了月" />
            </SelectTrigger>
            <SelectContent>
              {allMonths.map((m) => (
                <SelectItem key={m} value={m}>
                  {formatMonth(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

/** デフォルトの期間選択（先月） */
export function getDefaultPeriodSelection(): PeriodSelection {
  return { mode: "last_month" };
}
