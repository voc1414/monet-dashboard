/**
 * Design: monet Brand Identity — 水彩ブルー × コンクリートモダン
 * Page: monet Meta広告 ダッシュボード（GAS Webアプリ版を忠実移植）
 * データソース: スプレッドシート 1z5JU…（monet / lmessage / adset_meta）→ useAdsData
 *   集計・KPI・前期比・警告しきい値・LINE登録結合は webapp.gs と同一ロジック。
 *   集計値のみ・PIIなし・FC非ログインで閲覧可（gviz匿名読み）。
 */
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Megaphone, Loader2, AlertTriangle } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import DashboardLayout from "@/components/DashboardLayout";
import { useAdsData, getDashboardData, normalizeRegion } from "@/hooks/useAdsData";
import type { Bucket, StoreRow, RegionRow, NamedRow } from "@/hooks/useAdsData";
import { useSalonBoardStylistData } from "@/hooks/useSalonBoardStylistData";
import { useSalonBoardDailyNew } from "@/hooks/useSalonBoardDailyNew";
import { useStoreNewSales } from "@/hooks/useStoreNewSales";

// ===== 表示ヘルパ（webapp.gs と同じ式）=====
const yen = (n: number) => "¥" + Math.round(n).toLocaleString();
const numf = (n: number) => Math.round(n).toLocaleString();
const pct = (n: number) => n.toFixed(2) + "%";
const fr = (n: number) => n.toFixed(2);
const cpl = (s: number, l: number) => (l > 0 ? Math.round(s / l) : 0);
const ctr = (c: number, i: number) => (i > 0 ? +((c / i) * 100).toFixed(2) : 0);
const cpc = (s: number, c: number) => (c > 0 ? Math.round(s / c) : 0);
const freqAvg = (fw: number, i: number) => (i > 0 ? +(fw / i).toFixed(2) : 0);

type TypeKey = "shukyaku" | "kyujin";
const isCplBad = (v: number, t: TypeKey) =>
  v > 0 && (t === "shukyaku" ? v > 350 : v > 3000);
const isCtrBad = (v: number, t: TypeKey) =>
  v > 0 && (t === "shukyaku" ? v < 3 : v < 2);

function popLabel(v: number | null, t: "lead" | "spend") {
  if (v === null) return { text: "— 前期比", cls: "text-muted-foreground" };
  const arrow = v >= 0 ? "▲" : "▼";
  // リード: 増=良(緑) / 消化額: 増=注意(赤)
  const good = v > 0 ? t !== "spend" : t === "spend";
  const cls = v === 0 ? "text-muted-foreground" : good ? "text-emerald-600" : "text-red-500";
  return { text: `${arrow} ${Math.abs(v)}% 前期比`, cls };
}

// LINE登録 店舗マッチ（injectLineColumns / lookupFn を移植）
const PREFIX_RE = /^(大阪|広島|福岡|兵庫|岡山|京都|東京|北海道|帯広|神戸|名古屋|横浜)/;
function lookupStoreLine(name: string, byStore: Record<string, number>): number | null {
  const cands: { k: string; place: string }[] = [];
  for (const k in byStore) cands.push({ k, place: k.replace(PREFIX_RE, "") });
  cands.sort((a, b) => b.place.length - a.place.length);
  for (const c of cands) if (name.indexOf(c.place) >= 0) return byStore[c.k];
  return null;
}
function lookupRegionLine(name: string, byRegion: Record<string, number>): number | null {
  if (byRegion[name] != null) return byRegion[name];
  for (const k in byRegion) {
    if (k.length >= name.length && k.substr(k.length - name.length) === name) return byRegion[k];
    if (name.length >= k.length && name.substr(name.length - k.length) === k) return byRegion[k];
  }
  return null;
}

// 新規来店数（サロンボード）店舗名の名寄せ：/ads「堀江2nd院」とサロンボード「堀江院2nd」を
// "院"・空白を除いた共通キーで一致させる（福島院→福島 / 堀江2nd院→堀江2nd 等）。
const canonicalStore = (name: string) => (name || "").replace(/院/g, "").replace(/[\s　]/g, "");

// HPB（ホットペッパービューティー）掲載費: 全店一律の月額。CPA/ROASの分母に集客広告費と合算する（林 確定仕様 2026-07-05）
const HPB_MONTHLY_FEE = 55000;

// HPB掲載の開始月（YYYY-MM）。ここに載っていない店は最初から掲載しているものとして扱う。
// 開店前の新店は掲載費が発生しないので、開始月より前の月には HPB費用 を計上しない
// （計上すると合計の CPA が悪化し ROAS が下がって見える）。
// 店舗名は Notion「DB_monet店舗一覧」に合わせる（岡山エリアの店は「下伊福院」）。
// 林さん確認 2026-08-19: 下伊福院は2026-08から、岡本院は2026-09から。
const HPB_START_MONTH: Record<string, string> = {
  "下伊福院": "2026-08",
  "岡本院": "2026-09",
};

// 選択期間(since〜until)が重なる年月("YYYY-MM")の一覧。
function monthsBetween(since: string, until: string): string[] {
  const out: string[] = [];
  const sp = since.split("-").map(Number);
  const up = until.split("-").map(Number);
  if (sp.length < 2 || up.length < 2) return out;
  let y = sp[0],
    m = sp[1];
  const uy = up[0],
    um = up[1];
  while (y < uy || (y === uy && m <= um)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
    if (out.length > 400) break;
  }
  return out;
}

// ===== 小物コンポーネント =====
function KpiCard({ label, value, sub, subCls }: { label: string; value: string; sub: string; subCls?: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-white/70 p-4 shadow-sm">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-2xl font-bold text-foreground tabular-nums">{value}</div>
      <div className={`text-[11px] mt-1 ${subCls || "text-muted-foreground"}`}>{sub}</div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border/60 bg-white/80 px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const NB = (v: number) => (v > 0 ? numf(v) : "—");
const YB = (v: number) => (v > 0 ? yen(v) : "—");

// 店舗別/エリア別テーブル（集客=店舗別+LINE列 / 求人=エリア別）
function MetricTable({
  typeKey,
  rows,
  title,
  badge,
  byStore,
  byRegion,
  newByStore,
  newSalesByStore,
  hpbCostOf,
  firstColLabel,
}: {
  typeKey: TypeKey;
  rows: { name: string; kubun?: string; bucket: Bucket }[];
  title: string;
  badge: string;
  byStore?: Record<string, number>;
  byRegion?: Record<string, number>;
  newByStore?: Record<string, number>;
  newSalesByStore?: Record<string, number>;
  /** HPB費用を店舗名から返す（掲載開始月より前の月は計上しない）。集客の店舗別テーブルのみ。CPA/ROASの分母に加算 */
  hpbCostOf?: (storeName: string) => number;
  firstColLabel?: string;
}) {
  const showLine = typeKey === "shukyaku" ? !!byStore : !!byRegion;
  const showNew = !!newByStore;
  const newOf = (name: string): number | null =>
    newByStore ? (newByStore[canonicalStore(name)] ?? null) : null;
  const salesOf = (name: string): number | null =>
    newSalesByStore ? (newSalesByStore[canonicalStore(name)] ?? null) : null;
  const showCpaRoas = showNew; // 集客（新規来店がある）時のみ CPA / ROAS を表示
  const showHpb = hpbCostOf != null;
  const hpbOf = (name: string) => (hpbCostOf ? hpbCostOf(name) : 0);
  // 合計
  const tot = rows.reduce(
    (a, r) => {
      a.lead += r.bucket.lead;
      a.spend += r.bucket.spend;
      a.impr += r.bucket.impr;
      a.click += r.bucket.click;
      a.freqWeighted += r.bucket.freqWeighted;
      a.dailyBudget += r.bucket.dailyBudget || 0;
      a.line += (showLine ? (typeKey === "shukyaku" ? lookupStoreLine(r.name, byStore!) : lookupRegionLine(r.name, byRegion!)) || 0 : 0);
      a.newc += (showNew ? newOf(r.name) || 0 : 0);
      a.newSales += (showCpaRoas ? salesOf(r.name) || 0 : 0);
      return a;
    },
    { lead: 0, spend: 0, impr: 0, click: 0, freqWeighted: 0, dailyBudget: 0, line: 0, newc: 0, newSales: 0 }
  );
  const totCpl = cpl(tot.spend, tot.lead);
  const totCtr = ctr(tot.click, tot.impr);
  const totHpb = rows.reduce((a, r) => a + hpbOf(r.name), 0); // 店舗ごとに掲載開始月を見て合算

  const firstCol = firstColLabel || (typeKey === "shukyaku" ? "店舗" : "エリア");
  return (
    <div className="rounded-2xl border border-border/60 bg-white/70 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <span
          className={`text-[11px] font-bold px-2 py-0.5 rounded ${
            typeKey === "shukyaku" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
          }`}
        >
          {badge}
        </span>
        <span className="text-sm font-bold text-foreground">{title}</span>
        <span className="text-[11px] text-muted-foreground ml-auto">{rows.length}件</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs whitespace-nowrap">
          <thead>
            <tr className="text-muted-foreground border-b border-border/50">
              <th className="text-left font-medium px-3 py-2">{firstCol}</th>
              <th className="text-right font-medium px-3 py-2">1日予算</th>
              <th className="text-right font-medium px-3 py-2">消化額</th>
              {showHpb && <th className="text-right font-medium px-3 py-2">HPB費用</th>}
              {showLine && <th className="text-right font-medium px-3 py-2">LINE登録</th>}
              {showLine && <th className="text-right font-medium px-3 py-2">LINE単価</th>}
              <th className="text-right font-medium px-3 py-2">リード</th>
              {showNew && <th className="text-right font-medium px-3 py-2">新規数</th>}
              {showCpaRoas && <th className="text-right font-medium px-3 py-2">CPA</th>}
              {showCpaRoas && <th className="text-right font-medium px-3 py-2">ROAS</th>}
              <th className="text-right font-medium px-3 py-2">CPL</th>
              <th className="text-right font-medium px-3 py-2">CTR</th>
              <th className="text-right font-medium px-3 py-2">CPC</th>
              <th className="text-right font-medium px-3 py-2">フリーク</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const b = r.bucket;
              const cplV = cpl(b.spend, b.lead);
              const ctrV = ctr(b.click, b.impr);
              const line = showLine
                ? (typeKey === "shukyaku" ? lookupStoreLine(r.name, byStore!) : lookupRegionLine(r.name, byRegion!))
                : null;
              const tanka = line && line > 0 && b.spend > 0 ? Math.round(b.spend / line) : null;
              return (
                <tr key={r.name} className="border-b border-border/30">
                  <td className="text-left px-3 py-2 font-medium text-foreground">
                    {r.kubun && (
                      <span
                        className={`mr-1.5 text-[10px] px-1 py-0.5 rounded ${
                          r.kubun === "直営" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {r.kubun}
                      </span>
                    )}
                    {r.name}
                  </td>
                  <td className="text-right px-3 py-2 tabular-nums">{b.dailyBudget && b.dailyBudget > 0 ? yen(b.dailyBudget) : "—"}</td>
                  <td className="text-right px-3 py-2 tabular-nums">{YB(b.spend)}</td>
                  {showHpb && (
                    <td className="text-right px-3 py-2 tabular-nums">{yen(hpbOf(r.name))}</td>
                  )}
                  {showLine && <td className="text-right px-3 py-2 tabular-nums">{line != null ? numf(line) : "—"}</td>}
                  {showLine && <td className="text-right px-3 py-2 tabular-nums">{tanka != null ? yen(tanka) : "—"}</td>}
                  <td className="text-right px-3 py-2 tabular-nums">{NB(b.lead)}</td>
                  {showNew && (
                    <td className="text-right px-3 py-2 tabular-nums font-medium text-foreground">
                      {(() => {
                        const nv = newOf(r.name);
                        return nv != null ? numf(nv) : "—";
                      })()}
                    </td>
                  )}
                  {showCpaRoas && (
                    <td className="text-right px-3 py-2 tabular-nums font-semibold text-foreground">
                      {(() => {
                        // CPA = (集客広告費 + HPB費用) ÷ 新規来店数
                        const nv = newOf(r.name);
                        const h = hpbOf(r.name);
                        return nv && nv > 0 && b.spend + h > 0 ? yen(Math.round((b.spend + h) / nv)) : "—";
                      })()}
                    </td>
                  )}
                  {showCpaRoas && (
                    <td className="text-right px-3 py-2 tabular-nums font-semibold text-foreground">
                      {(() => {
                        // ROAS = 新規売上 ÷ (集客広告費 + HPB費用) × 100
                        const ns = salesOf(r.name);
                        const h = hpbOf(r.name);
                        return ns != null && b.spend + h > 0 ? `${Math.round((ns / (b.spend + h)) * 100)}%` : "—";
                      })()}
                    </td>
                  )}
                  <td className={`text-right px-3 py-2 tabular-nums font-semibold ${isCplBad(cplV, typeKey) ? "text-red-600 bg-red-50" : ""}`}>
                    {cplV > 0 ? yen(cplV) : "—"}
                  </td>
                  <td className={`text-right px-3 py-2 tabular-nums ${isCtrBad(ctrV, typeKey) ? "text-red-600 bg-red-50" : ""}`}>
                    {ctrV > 0 ? pct(ctrV) : "—"}
                  </td>
                  <td className="text-right px-3 py-2 tabular-nums">{YB(cpc(b.spend, b.click))}</td>
                  <td className="text-right px-3 py-2 tabular-nums">{b.impr > 0 ? fr(freqAvg(b.freqWeighted, b.impr)) : "—"}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8 + (showLine ? 2 : 0) + (showNew ? 1 : 0) + (showHpb ? 1 : 0) + (showCpaRoas ? 2 : 0)} className="text-center px-3 py-6 text-muted-foreground">
                  該当データがありません
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border/60 font-bold bg-muted/30">
                <td className="text-left px-3 py-2">合計</td>
                <td className="text-right px-3 py-2 tabular-nums">{tot.dailyBudget > 0 ? yen(tot.dailyBudget) : "—"}</td>
                <td className="text-right px-3 py-2 tabular-nums">{YB(tot.spend)}</td>
                {showHpb && <td className="text-right px-3 py-2 tabular-nums">{yen(totHpb)}</td>}
                {showLine && <td className="text-right px-3 py-2 tabular-nums">{numf(tot.line)}</td>}
                {showLine && <td className="text-right px-3 py-2 tabular-nums">{tot.line > 0 && tot.spend > 0 ? yen(Math.round(tot.spend / tot.line)) : "—"}</td>}
                <td className="text-right px-3 py-2 tabular-nums">{NB(tot.lead)}</td>
                {showNew && <td className="text-right px-3 py-2 tabular-nums">{numf(tot.newc)}</td>}
                {showCpaRoas && <td className="text-right px-3 py-2 tabular-nums">{tot.newc > 0 && tot.spend + totHpb > 0 ? yen(Math.round((tot.spend + totHpb) / tot.newc)) : "—"}</td>}
                {showCpaRoas && <td className="text-right px-3 py-2 tabular-nums">{tot.spend + totHpb > 0 ? `${Math.round((tot.newSales / (tot.spend + totHpb)) * 100)}%` : "—"}</td>}
                <td className="text-right px-3 py-2 tabular-nums">{totCpl > 0 ? yen(totCpl) : "—"}</td>
                <td className="text-right px-3 py-2 tabular-nums">{totCtr > 0 ? pct(totCtr) : "—"}</td>
                <td className="text-right px-3 py-2 tabular-nums">{YB(cpc(tot.spend, tot.click))}</td>
                <td className="text-right px-3 py-2 tabular-nums">{tot.impr > 0 ? fr(freqAvg(tot.freqWeighted, tot.impr)) : "—"}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// キャンペーン別/広告セット別テーブル（LINE列なし）
function NonStoreTable({ typeKey, rows, title, badge, labelCol }: { typeKey: TypeKey; rows: NamedRow[]; title: string; badge: string; labelCol: string }) {
  const filtered = rows.filter((r) => r[typeKey].spend > 0 || r[typeKey].lead > 0);
  const metricRows = filtered.map((r) => ({ name: r.name, bucket: r[typeKey] }));
  return <MetricTable typeKey={typeKey} rows={metricRows} title={title} badge={badge} firstColLabel={labelCol} />;
}

export default function Ads() {
  const { raw, loading, error } = useAdsData();
  const { data: sbData } = useSalonBoardStylistData();
  const { data: dailyNew } = useSalonBoardDailyNew();
  const { data: newSalesData } = useStoreNewSales();
  const [period, setPeriod] = useState("last-month");
  const [type, setType] = useState<"all" | "shukyaku" | "kyujin">("all");
  const [kubun, setKubun] = useState<"all" | "chokuei" | "fc">("all");
  const [region, setRegion] = useState("all");
  const [store, setStore] = useState("all");
  const [view, setView] = useState<"store" | "campaign" | "adset">("store");

  const D = useMemo(() => (raw ? getDashboardData(raw, period) : null), [raw, period]);

  const reset = () => {
    setPeriod("last-month");
    setType("all");
    setKubun("all");
    setRegion("all");
    setStore("all");
    setView("store");
  };

  // KPI（種別フィルタのみ反映、webapp.gs refreshKPI と同一）
  const kpi = useMemo(() => {
    if (!D) return null;
    let lead = 0, spend = 0, impr = 0, click = 0, freqW = 0, prevLead = 0, prevSpend = 0;
    if (type === "all" || type === "shukyaku") {
      lead += D.cur.shukyaku.lead; spend += D.cur.shukyaku.spend; impr += D.cur.shukyaku.impr; click += D.cur.shukyaku.click; freqW += D.cur.shukyaku.freqWeighted; prevLead += D.prev.shukyaku.lead; prevSpend += D.prev.shukyaku.spend;
    }
    if (type === "all" || type === "kyujin") {
      lead += D.cur.kyujin.lead; spend += D.cur.kyujin.spend; impr += D.cur.kyujin.impr; click += D.cur.kyujin.click; freqW += D.cur.kyujin.freqWeighted; prevLead += D.prev.kyujin.lead; prevSpend += D.prev.kyujin.spend;
    }
    let lineTot = 0;
    for (const k in D.lmessage.byStoreShort) lineTot += D.lmessage.byStoreShort[k];
    for (const k in D.lmessage.byRegion) lineTot += D.lmessage.byRegion[k];
    return {
      lead, spend,
      cplV: cpl(spend, lead), cpcV: cpc(spend, click), ctrV: ctr(click, impr), freqV: freqAvg(freqW, impr),
      lineTot,
      leadPoP: prevLead > 0 ? Math.round((lead / prevLead - 1) * 100) : null,
      spendPoP: prevSpend > 0 ? Math.round((spend / prevSpend - 1) * 100) : null,
    };
  }, [D, type]);

  // 集客 店舗別行（区分/エリア/店舗フィルタ適用）
  const storeRows = useMemo(() => {
    if (!D) return [] as { name: string; kubun: string; bucket: Bucket }[];
    let src: StoreRow[] = [];
    if (kubun === "all" || kubun === "chokuei") src = src.concat(D.chokuei);
    if (kubun === "all" || kubun === "fc") src = src.concat(D.fc);
    return src
      .filter((r) => (store === "all" || r.name === store) && (region === "all" || normalizeRegion(r.region) === region))
      .map((r) => ({ name: r.name, kubun: r.kubun, bucket: r.shukyaku }));
  }, [D, kubun, store, region]);

  // 求人 エリア別行（エリアフィルタ適用）
  const regionRows = useMemo(() => {
    if (!D) return [] as { name: string; bucket: Bucket }[];
    return (D.kyujinByRegion as RegionRow[])
      .filter((r) => region === "all" || r.name === region)
      .map((r) => ({ name: r.name, bucket: r.kyujin }));
  }, [D, region]);

  // 新規来店数（サロンボード）。日次タブ daily_new があれば選択期間に「厳密一致」で合算（推奨）。
  // 未生成の間は月次 stylist_flat にフォールバック（選択期間に重なる月を合算＝該当月計）。
  const { newByStore, totalNew, newLabel } = useMemo(() => {
    const map: Record<string, number> = {};
    let total = 0;
    if (!D) return { newByStore: map, totalNew: 0, newLabel: "サロンボード" };
    const since = D.period.since;
    const until = D.period.until;
    // 日次（厳密）優先
    let dailyHit = false;
    for (const r of dailyNew) {
      if (r.date >= since && r.date <= until) {
        dailyHit = true;
        const key = canonicalStore(r.store);
        map[key] = (map[key] || 0) + r.newCount;
        total += r.newCount;
      }
    }
    if (dailyHit) {
      return { newByStore: map, totalNew: total, newLabel: `サロンボード ${since}〜${until}` };
    }
    // フォールバック: 月次（該当月計）
    const months = monthsBetween(since, until);
    const monthSet = new Set(months);
    for (const d of sbData) {
      if (!monthSet.has(d.yearMonth)) continue;
      const key = canonicalStore(d.storeName);
      map[key] = (map[key] || 0) + d.newCustomers;
      total += d.newCustomers;
    }
    const label =
      months.length === 1
        ? `サロンボード ${months[0]}（月次）`
        : months.length > 1
        ? `サロンボード ${months[0]}〜${months[months.length - 1]}計（月次）`
        : "サロンボード";
    return { newByStore: map, totalNew: total, newLabel: label };
  }, [D, dailyNew, sbData]);

  // 新規売上（サロンボード明細 store_newsales）を選択期間で店舗別に合算（ROAS用の分子）
  const newSalesByStore = useMemo(() => {
    const map: Record<string, number> = {};
    if (!D) return map;
    const monthSet = new Set(monthsBetween(D.period.since, D.period.until));
    for (const r of newSalesData) {
      if (!monthSet.has(r.yearMonth)) continue;
      const key = canonicalStore(r.storeName);
      map[key] = (map[key] || 0) + r.newSales;
    }
    return map;
  }, [D, newSalesData]);

  // HPB費用: 月額¥55,000 × 選択期間のうち「その店が掲載している月」の数。
  // 開店前で未掲載の店は0になる（集客のCPA/ROAS分母に加算。求人は対象外）
  const hpbCostOf = useMemo(() => {
    if (!D) return () => 0;
    const months = monthsBetween(D.period.since, D.period.until);
    return (storeName: string) => {
      const start = HPB_START_MONTH[canonicalStore(storeName)] ?? HPB_START_MONTH[storeName];
      const billed = start ? months.filter((m) => m >= start).length : months.length;
      return HPB_MONTHLY_FEE * billed;
    };
  }, [D]);

  // データ鮮度: スプシに入っている日次データの最新日付。同期(SyncWith)停止の検知用。
  // 健全時は「昨日〜一昨日」まで入る（日次同期＋Metaのレポート遅延1日）ため、3日以上で警告。
  const latestDataDate = useMemo(() => {
    if (!raw?.monet?.length) return null;
    let max = "";
    for (const r of raw.monet) if (r.date && r.date > max) max = r.date;
    return max || null;
  }, [raw]);
  const dataLagDays = useMemo(() => {
    if (!latestDataDate) return null;
    const t = new Date(`${latestDataDate}T00:00:00`).getTime();
    if (Number.isNaN(t)) return null;
    return Math.floor((Date.now() - t) / 86400000);
  }, [latestDataDate]);

  const showShukyaku = type === "all" || type === "shukyaku";
  const showKyujin = type === "all" || type === "kyujin";

  const chartData = useMemo(() => {
    if (!D) return [];
    return D.series.labels.map((d, i) => ({
      date: d.slice(5),
      集客: D.series.shukyaku[i],
      求人: D.series.kyujin[i],
    }));
  }, [D]);

  return (
    <DashboardLayout breadcrumbs={[{ label: "広告（Meta）" }]}>
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Megaphone className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">monet Meta広告 ダッシュボード</h1>
        </div>
        <p className="text-sm text-muted-foreground flex items-center flex-wrap gap-x-2 gap-y-1">
          <span>{D ? `${D.period.since} 〜 ${D.period.until}` : "—"}</span>
          {latestDataDate && (
            <span className="text-xs">データ: 〜{latestDataDate}</span>
          )}
          {dataLagDays != null && dataLagDays >= 3 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
              <AlertTriangle className="w-3 h-3" />
              同期が{dataLagDays}日分遅れています（SyncWith要確認）
            </span>
          )}
        </p>
      </div>

      {/* フィルタ */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Select
          label="期間"
          value={period}
          onChange={setPeriod}
          options={[
            { value: "7", label: "過去7日" },
            { value: "30", label: "過去30日" },
            { value: "90", label: "過去3ヶ月" },
            { value: "180", label: "過去6ヶ月" },
            { value: "this-month", label: "今月" },
            { value: "last-month", label: "先月" },
            { value: "this-year", label: "今年" },
            { value: "last-year", label: "前年" },
          ]}
        />
        <Select label="種別" value={type} onChange={(v) => setType(v as typeof type)} options={[{ value: "all", label: "両方表示" }, { value: "shukyaku", label: "集客のみ" }, { value: "kyujin", label: "求人のみ" }]} />
        <Select label="区分" value={kubun} onChange={(v) => setKubun(v as typeof kubun)} options={[{ value: "all", label: "両方表示" }, { value: "chokuei", label: "直営のみ" }, { value: "fc", label: "FCのみ" }]} />
        <Select
          label="エリア"
          value={region}
          onChange={setRegion}
          options={[{ value: "all", label: "全エリア" }, ...(D?.filters.regionList || []).map((r) => ({ value: r, label: r }))]}
        />
        <Select
          label="店舗"
          value={store}
          onChange={setStore}
          options={[{ value: "all", label: "全店" }, ...(D?.filters.storeList || []).map((s) => ({ value: s, label: s }))]}
        />
        <Select label="ビュー" value={view} onChange={(v) => setView(v as typeof view)} options={[{ value: "store", label: "店舗別" }, { value: "campaign", label: "キャンペーン別" }, { value: "adset", label: "広告セット別" }]} />
        <button onClick={reset} className="text-xs text-primary hover:underline">
          リセット
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-16 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          読み込み中…
        </div>
      )}
      {!loading && error && (
        <div className="rounded-xl border border-border/50 bg-muted/30 p-6 text-sm text-muted-foreground">
          データの取得に失敗しました（{error}）
        </div>
      )}

      {!loading && D && kpi && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          {/* KPIカード */}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
            <KpiCard label="LINE登録数" value={numf(kpi.lineTot)} sub="流入タグ友だち" />
            <KpiCard label="LINE登録単価" value={kpi.lineTot > 0 ? yen(kpi.spend / kpi.lineTot) : "—"} sub="消化額/LINE登録" />
            <KpiCard label="リード数" value={numf(kpi.lead)} sub={popLabel(kpi.leadPoP, "lead").text} subCls={popLabel(kpi.leadPoP, "lead").cls} />
            <KpiCard label="消化額" value={yen(kpi.spend)} sub={popLabel(kpi.spendPoP, "spend").text} subCls={popLabel(kpi.spendPoP, "spend").cls} />
            <KpiCard label="CPL（リード単価）" value={kpi.cplV > 0 ? yen(kpi.cplV) : "—"} sub="消化額/リード" />
            <KpiCard label="CPC（クリック単価）" value={kpi.cpcV > 0 ? yen(kpi.cpcV) : "—"} sub="消化額/クリック" />
            <KpiCard label="CTR（リンククリック率）" value={kpi.ctrV > 0 ? pct(kpi.ctrV) : "—"} sub="クリック/インプ" />
            <KpiCard label="フリークエンシー" value={kpi.freqV > 0 ? fr(kpi.freqV) : "—"} sub="適正範囲: 1.0-2.0" />
            <KpiCard
              label="新規来店数"
              value={totalNew > 0 ? numf(totalNew) : "—"}
              sub={newLabel}
            />
          </div>

          {/* 日次リード推移 */}
          {chartData.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-white/70 shadow-sm p-4 mb-6">
              <div className="text-sm font-bold text-foreground mb-3">日次リード推移（集客 / 求人）</div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="集客" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="求人" stroke="#a855f7" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* テーブル群 */}
          <div className="space-y-6">
            {showShukyaku &&
              (view === "store" ? (
                <MetricTable typeKey="shukyaku" rows={storeRows} title="店舗別 一覧（直営・FC統合）" badge="集客" byStore={D.lmessage.byStoreShort} newByStore={newByStore} newSalesByStore={newSalesByStore} hpbCostOf={hpbCostOf} />
              ) : (
                <NonStoreTable typeKey="shukyaku" rows={view === "campaign" ? D.byCampaign : D.byAdset} title={view === "campaign" ? "キャンペーン別 一覧" : "広告セット別 一覧"} badge="集客" labelCol={view === "campaign" ? "キャンペーン名" : "広告セット名"} />
              ))}
            {showKyujin &&
              (view === "store" ? (
                <MetricTable typeKey="kyujin" rows={regionRows} title="エリア別 一覧" badge="求人" byRegion={D.lmessage.byRegion} />
              ) : (
                <NonStoreTable typeKey="kyujin" rows={view === "campaign" ? D.byCampaign : D.byAdset} title={view === "campaign" ? "キャンペーン別 一覧" : "広告セット別 一覧"} badge="求人" labelCol={view === "campaign" ? "キャンペーン名" : "広告セット名"} />
              ))}
          </div>

          <div className="mt-6 rounded-xl border border-border/40 bg-muted/30 p-4 text-xs text-muted-foreground">
            出典: Meta広告データ（SyncWith）＋ L Message 流入タグ。CPL警告しきい値=集客¥350超・求人¥3,000超、CTR=集客3%未満・求人2%未満で赤表示。LINE登録数は流入タグ友だちの期間内増分。「新規（新規来店数）」はサロンボード実績。日次データ(daily_new)があれば選択期間に厳密一致で合算、未反映の間は月次(該当月計)にフォールバック（KPIの注記に出所と範囲を表示）。HPB費用=月額¥55,000×選択期間のうちその店が掲載している月数（開店前で未掲載の店は0）。CPA=(集客広告費+HPB費用)÷新規来店数、ROAS=新規売上÷(集客広告費+HPB費用)。CPL（リード単価）は広告費のみ。集計値のみで個人情報は含みません。
          </div>
        </motion.div>
      )}
    </DashboardLayout>
  );
}
