/**
 * サロンボードの「日次・店舗別 新規来店数」を取得するフック。
 *
 * データソース: 「サロンボード売上」スプシ(1nR36…)の `daily_new` タブ。
 *   1行 = 店舗 × 日付(YYYY-MM-DD)。列: 店舗,日付,新規,再来,客数（件数のみ・PIIなし）。
 *   元は salonboard-scraper/aggregate_daily_new.js → Drive → Apps Script(refreshAll) で生成。
 *
 * 用途: 広告ダッシュボード(/ads)が選択期間(since〜until)に「厳密一致」で新規来店数を出すため。
 *   月次の stylist_flat と違い日次なので、過去30日などの日付範囲にそのまま合算できる。
 *   タブが未生成の間は空配列を返し、呼び出し側は月次へフォールバックする。
 */
import { useEffect, useState } from "react";

const SPREADSHEET_ID = "1nR36MMsbtAT8f2ccYLBTZjZ4ESin9odmgWN2xP3oVSE";
const SHEET_NAME = "daily_new";

export interface DailyNewRow {
  store: string; // 正規化済み店舗名（福島院 / 堀江院2nd 等）
  date: string; // YYYY-MM-DD
  newCount: number;
  returnCount: number;
  customers: number;
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
        } else inQuotes = false;
      } else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") {
        result.push(current);
        current = "";
      } else if (ch === "\r") {
        /* skip */
      } else current += ch;
    }
  }
  result.push(current);
  return result;
}

function num(v: unknown): number {
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/[",\s]/g, ""));
  return isNaN(n) ? 0 : n;
}

function toYmd(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  if (!s) return "";
  let m = s.match(/Date\((\d+),(\d+),(\d+)/);
  if (m)
    return `${m[1]}-${String(+m[2] + 1).padStart(2, "0")}-${String(+m[3]).padStart(2, "0")}`;
  m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m)
    return `${m[1]}-${String(+m[2]).padStart(2, "0")}-${String(+m[3]).padStart(2, "0")}`;
  return s;
}

export function parseDailyNewCsv(text: string): DailyNewRow[] {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = parseCSVLine(lines[0]);
  const ci = {
    store: header.indexOf("店舗"),
    date: header.indexOf("日付"),
    nw: header.indexOf("新規"),
    rt: header.indexOf("再来"),
    cu: header.indexOf("客数"),
  };
  if (ci.store < 0 || ci.date < 0 || ci.nw < 0) return [];
  const out: DailyNewRow[] = [];
  for (const line of lines.slice(1)) {
    const c = parseCSVLine(line);
    const store = (c[ci.store] || "").trim();
    const date = toYmd(c[ci.date]);
    if (!store || !date) continue;
    out.push({
      store,
      date,
      newCount: num(c[ci.nw]),
      returnCount: ci.rt >= 0 ? num(c[ci.rt]) : 0,
      customers: ci.cu >= 0 ? num(c[ci.cu]) : 0,
    });
  }
  return out;
}

let cached: DailyNewRow[] | null = null;
let fetchPromise: Promise<DailyNewRow[]> | null = null;
async function fetchRows(): Promise<DailyNewRow[]> {
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
      cached = parseDailyNewCsv(await resp.text());
      return cached;
    } catch (err) {
      console.warn("サロンボード日次新規データ取得失敗:", err);
      cached = [];
      return cached;
    }
  })();
  return fetchPromise;
}

export function useSalonBoardDailyNew() {
  const [data, setData] = useState<DailyNewRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const r = await fetchRows();
        if (!cancelled) setData(r);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading };
}
