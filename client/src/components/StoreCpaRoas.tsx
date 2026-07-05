/**
 * 店舗別 CPA / ROAS カード（集客広告）
 *  - CPA（新規獲得コスト）＝ 集客広告費 ÷ 新規来店数
 *  - ROAS ＝ 新規売上 ÷ 集客広告費 ×100%
 * データ源：
 *  - 集客広告費：/ads の raw.monet（キャンペーン名が「集客」始まり）を店舗×月で合算
 *  - 新規来店数：useSalonBoardData（store_official＝サロンボード公式の新規）
 *  - 新規売上：1nR36 の store_newsales タブ（明細の新規会計 金額合計）を gviz 読み
 * 広告費が無い店舗・期間は何も表示しない（return null）。防御的実装。
 */
import { useEffect, useMemo, useState } from "react";
import { useAdsData } from "@/hooks/useAdsData";
import { useSalonBoardData } from "@/hooks/useSalonBoardData";

const SPREADSHEET_ID = "1nR36MMsbtAT8f2ccYLBTZjZ4ESin9odmgWN2xP3oVSE";

// 広告側の店舗名 → ダッシュボードの正規化店舗名。「堀江2nd院」を先に判定。
function canonAdsStore(s: string): string {
  const t = (s || "").trim();
  if (t.indexOf("堀江2nd") >= 0 || t.indexOf("堀江院2nd") >= 0 || t.indexOf("堀江院 2nd") >= 0) return "堀江院2nd";
  if (t.indexOf("堀江") >= 0) return "堀江院";
  if (t.indexOf("姪浜") >= 0) return "姪浜院";
  if (t.indexOf("楽々園") >= 0) return "楽々園院";
  if (t.indexOf("高槻") >= 0) return "高槻院";
  if (t.indexOf("福島") >= 0) return "福島院";
  if (t.indexOf("土橋") >= 0) return "土橋院";
  return t;
}

// store_newsales（店舗__年月 → 新規売上）。モジュールキャッシュ。
let _nsCache: Map<string, number> | null = null;
let _nsPromise: Promise<Map<string, number>> | null = null;
async function fetchNewSales(): Promise<Map<string, number>> {
  if (_nsCache) return _nsCache;
  if (_nsPromise) return _nsPromise;
  _nsPromise = (async () => {
    const m = new Map<string, number>();
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
          if (!isNaN(v)) m.set(`${c[0]}__${c[1]}`, v);
        }
      }
    } catch {
      /* 取得失敗時は空 */
    }
    _nsCache = m;
    return m;
  })();
  return _nsPromise;
}

interface Props {
  storeName: string;
  months?: string[]; // 未指定＝全期間
}

export function StoreCpaRoas({ storeName, months }: Props) {
  const { raw } = useAdsData();
  const { getStoreMonthsAggregated } = useSalonBoardData();
  const [newSalesMap, setNewSalesMap] = useState<Map<string, number> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchNewSales().then((m) => {
      if (!cancelled) setNewSalesMap(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const metrics = useMemo(() => {
    if (!storeName) return null;
    const monthSet = months && months.length > 0 ? new Set(months) : null; // null=全期間

    // 集客広告費（店舗×月）
    let spend = 0;
    if (raw && raw.monet) {
      for (const row of raw.monet) {
        if ((row.camp || "").indexOf("集客") !== 0) continue;
        if (canonAdsStore(row.tenpo) !== storeName) continue;
        const ym = (row.date || "").slice(0, 7);
        if (monthSet && !monthSet.has(ym)) continue;
        spend += row.spend || 0;
      }
    }

    // 新規来店数（サロンボード公式）
    const agg = getStoreMonthsAggregated(storeName, months);
    const newVisits = agg ? agg.newCustomers : 0;

    // 新規売上
    let newSales = 0;
    if (newSalesMap) {
      if (monthSet) {
        monthSet.forEach((ym) => {
          const v = newSalesMap.get(`${storeName}__${ym}`);
          if (typeof v === "number") newSales += v;
        });
      } else {
        const pref = `${storeName}__`;
        newSalesMap.forEach((v, k) => {
          if (k.indexOf(pref) === 0) newSales += v;
        });
      }
    }

    const cpa = spend > 0 && newVisits > 0 ? Math.round(spend / newVisits) : null;
    const roas = spend > 0 ? Math.round((newSales / spend) * 100) : null;
    return { spend, newVisits, newSales, cpa, roas };
  }, [storeName, months, raw, newSalesMap, getStoreMonthsAggregated]);

  if (!metrics || metrics.spend <= 0) return null;

  return (
    <div className="mt-3 rounded-lg border border-border bg-card p-3">
      <div className="text-[11px] font-medium text-muted-foreground mb-2">広告効率（集客）</div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] text-muted-foreground">CPA（新規獲得コスト）</div>
          <div className="text-lg font-bold">{metrics.cpa != null ? `¥${metrics.cpa.toLocaleString()}` : "—"}</div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground">ROAS</div>
          <div className="text-lg font-bold">{metrics.roas != null ? `${metrics.roas}%` : "—"}</div>
        </div>
      </div>
      <div className="mt-2 text-[10px] text-muted-foreground">
        集客広告費 ¥{metrics.spend.toLocaleString()} ／ 新規来店 {metrics.newVisits}人 ／ 新規売上 ¥{metrics.newSales.toLocaleString()}
      </div>
    </div>
  );
}
