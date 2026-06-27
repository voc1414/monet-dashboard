/**
 * カウンセリングシート集計データを取得するフック。
 *
 * データソース: スプレッドシート「サロンボード売上」(1nR36...) の counseling タブ。
 *   1行 = 年月 × 設問 × 選択肢。列: year_month, q_key, opt_key, count, pct, base
 *   （毎月の集計タスク salonbrain-monthly-survey が先月ぶんを追記する）
 * 表示用の日本語ラベルは client/src/data/counselingTaxonomy.ts で対応づける。
 * 集計値のみ・個人情報なし。モネ全7院合算（ヨルモネ除外）。
 */
import { useState, useEffect, useMemo } from "react";
import {
  COUNSELING_TAXONOMY,
  questionTitle,
  optionLabel,
} from "@/data/counselingTaxonomy";

const SPREADSHEET_ID = "1nR36MMsbtAT8f2ccYLBTZjZ4ESin9odmgWN2xP3oVSE";
const SHEET_NAME = "counseling";

export interface CounselingRow {
  yearMonth: string;
  qKey: string;
  optKey: string;
  count: number;
  pct: number;
  base: number;
}

export interface CounselingOption {
  key: string;
  label: string;
  count: number;
  pct: number;
}
export interface CounselingQuestion {
  key: string;
  title: string;
  multi: boolean;
  base: number;
  options: CounselingOption[];
}
export interface CounselingMonth {
  yearMonth: string;
  totalRespondents: number;
  questions: CounselingQuestion[];
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") {
        result.push(current);
        current = "";
      } else if (ch === "\r") {
        // skip
      } else current += ch;
    }
  }
  result.push(current);
  return result;
}

function num(v: string): number {
  const n = parseFloat((v || "").replace(/[",\s]/g, ""));
  return isNaN(n) ? 0 : n;
}

export function parseCounselingCsv(text: string): CounselingRow[] {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const out: CounselingRow[] = [];
  for (const line of lines.slice(1)) {
    const c = parseCSVLine(line);
    if (c.length < 6) continue;
    const yearMonth = (c[0] || "").trim().replace(/"/g, "");
    const qKey = (c[1] || "").trim();
    const optKey = (c[2] || "").trim();
    if (!yearMonth || !qKey || !optKey) continue;
    out.push({
      yearMonth,
      qKey,
      optKey,
      count: num(c[3]),
      pct: num(c[4]),
      base: num(c[5]),
    });
  }
  return out;
}

/** 行データを月ごと・タクソノミー順に構造化する。 */
export function buildMonths(rows: CounselingRow[]): CounselingMonth[] {
  const byMonth = new Map<string, CounselingRow[]>();
  for (const r of rows) {
    if (!byMonth.has(r.yearMonth)) byMonth.set(r.yearMonth, []);
    byMonth.get(r.yearMonth)!.push(r);
  }
  const months: CounselingMonth[] = [];
  Array.from(byMonth.entries()).forEach(([ym, rs]) => {
    const questions: CounselingQuestion[] = [];
    for (const tq of COUNSELING_TAXONOMY) {
      const qRows = rs.filter((r) => r.qKey === tq.key);
      if (qRows.length === 0) continue;
      const base = qRows[0].base;
      // タクソノミー順に並べ、件数降順で安定化
      const options: CounselingOption[] = qRows
        .map((r) => ({
          key: r.optKey,
          label: optionLabel(tq.key, r.optKey),
          count: r.count,
          pct: r.pct,
        }))
        .sort((a, b) => b.count - a.count);
      questions.push({
        key: tq.key,
        title: questionTitle(tq.key),
        multi: tq.multi,
        base,
        options,
      });
    }
    const genderQ = questions.find((q) => q.key === "gender");
    const totalRespondents = genderQ
      ? genderQ.options.reduce((s, o) => s + o.count, 0)
      : 0;
    months.push({ yearMonth: ym, totalRespondents, questions });
  });
  months.sort((a, b) => (a.yearMonth < b.yearMonth ? 1 : -1)); // 新しい順
  return months;
}

let cached: CounselingRow[] | null = null;
let fetchPromise: Promise<CounselingRow[]> | null = null;

async function fetchRows(): Promise<CounselingRow[]> {
  if (cached) return cached;
  if (fetchPromise) return fetchPromise;
  fetchPromise = (async () => {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
        SHEET_NAME
      )}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        cached = [];
        return cached;
      }
      const text = await resp.text();
      cached = parseCounselingCsv(text);
      return cached;
    } catch (err) {
      console.warn("カウンセリング集計データ取得失敗:", err);
      cached = [];
      return cached;
    }
  })();
  return fetchPromise;
}

export function useCounselingData() {
  const [rows, setRows] = useState<CounselingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const r = await fetchRows();
        if (!cancelled) {
          setRows(r);
          setError(null);
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "取得に失敗しました");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const months = useMemo(() => buildMonths(rows), [rows]);
  const availableMonths = useMemo(
    () => months.map((m) => m.yearMonth),
    [months]
  );

  return { months, availableMonths, loading, error };
}
