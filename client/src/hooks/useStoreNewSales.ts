/**
 * store_newsales タブ（サロンボード明細の「新規客の売上」を店舗×月で集計したもの）を取得するフック。
 * 列: 店舗,年月,新規売上,新規客数
 * 用途: /ads の ROAS（＝新規売上 ÷ 集客広告費）の分子。
 * 出所: 1nR36「サロンボード売上」の store_newsales タブ（aggregate_newsales.js → Drive → GAS refreshStoreExtras）。
 */
import { useEffect, useState } from "react";

const SPREADSHEET_ID = "1nR36MMsbtAT8f2ccYLBTZjZ4ESin9odmgWN2xP3oVSE";

export interface StoreNewSalesRow {
  storeName: string; // 例: 高槻院 / 堀江院2nd
  yearMonth: string; // 例: 2026-06
  newSales: number;
}

let _cache: StoreNewSalesRow[] | null = null;
let _promise: Promise<StoreNewSalesRow[]> | null = null;

async function fetchRows(): Promise<StoreNewSalesRow[]> {
  if (_cache) return _cache;
  if (_promise) return _promise;
  _promise = (async () => {
    const out: StoreNewSalesRow[] = [];
    try {
      const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=store_newsales`;
      const r = await fetch(url);
      if (r.ok) {
        const text = await r.text();
        const lines = text.split("\n").filter((l) => l.trim() !== "");
        for (let i = 1; i < lines.length; i++) {
          const c = lines[i].split(",").map((x) => x.replace(/^"|"$/g, "").trim());
          if (c.length < 3) continue;
          const v = parseInt((c[2] || "").replace(/[^\d-]/g, ""), 10);
          // 年月のゼロ埋めゆれ「2026-6」→「2026-06」を吸収（stylist_flatで実発生した形式）
          const ym = (c[1] || "").replace(/\//g, "-").replace(/^(\d{4})-(\d)$/, "$1-0$2");
          if (!isNaN(v)) out.push({ storeName: c[0], yearMonth: ym, newSales: v });
        }
      }
    } catch {
      /* 取得失敗時は空 */
    }
    _cache = out;
    return out;
  })();
  return _promise;
}

export function useStoreNewSales() {
  const [data, setData] = useState<StoreNewSalesRow[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetchRows().then((r) => {
      if (!cancelled) setData(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return { data };
}
