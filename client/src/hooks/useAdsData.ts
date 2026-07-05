/**
 * monet Meta広告ダッシュボードのデータフック。
 *
 * データソース: スプレッドシート「monet Meta広告 月次データ」(1z5JU…)。
 *   - monet シート      … 1行 = 日付 × 広告セット の実績（消化額/リード/クリック/インプ/フリーク）
 *   - lmessage シート    … 流入タグ別の累計友だち数（日次・累積）→ 期間内の増分 = LINE登録数
 *   - adset_meta シート  … 広告セット名 × 1日予算 × 最終変更日
 *
 * 集計ロジックは GAS Webアプリ(monet-meta-ads-sync / webapp.gs)の
 * getDashboardData / getLmessageData を忠実に移植したもの。FC非ログインで閲覧できるよう
 * gviz CSV を匿名読み(credentials:'omit' 相当の素のfetch)する。集計値のみでPIIなし。
 */
import { useEffect, useState } from "react";

const SPREADSHEET_ID = "1z5JU-Onf6wiqydFUeYYoQ0czXByyZbqH4JODWkYh6Ts";

// ===== CSV パース =====
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

function parseCsv(text: string): string[][] {
  return text
    .split("\n")
    .filter((l) => l.length > 0)
    .map(parseCSVLine);
}

function num(v: unknown): number {
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/[",\s¥%]/g, ""));
  return isNaN(n) ? 0 : n;
}

/** gviz CSV のセル値（日付/yyyy-mm-dd/yyyy/mm/dd/Date(y,m,d)）を 'YYYY-MM-DD' に正規化 */
function toYmd(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  if (!s) return "";
  let m = s.match(/Date\((\d+),(\d+),(\d+)/); // gviz JSON風（月は0始まり）
  if (m) {
    const y = +m[1];
    const mo = +m[2] + 1;
    const d = +m[3];
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m)
    return `${m[1]}-${String(+m[2]).padStart(2, "0")}-${String(+m[3]).padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/); // M/D/YYYY
  if (m)
    return `${m[3]}-${String(+m[1]).padStart(2, "0")}-${String(+m[2]).padStart(2, "0")}`;
  const dt = new Date(s);
  if (!isNaN(dt.getTime()))
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
      dt.getDate()
    ).padStart(2, "0")}`;
  return s;
}

async function fetchSheet(sheet: string): Promise<string[][]> {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
    sheet
  )}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`${sheet} 取得失敗 (${resp.status})`);
  return parseCsv(await resp.text());
}

// ===== 型 =====
export interface MonetRow {
  date: string; // YYYY-MM-DD
  kubun: string; // 直営 / FC
  region: string; // 地域
  tenpo: string; // 店舗
  camp: string; // キャンペーン名
  adset: string; // 広告セット名
  spend: number;
  lead: number;
  freq: number;
  impr: number;
  click: number;
}
export interface LmsgRow {
  date: string;
  botId: string;
  botName: string;
  category: string; // 集客 / 求人
  tagId: string;
  tagName: string;
  count: number;
}
export interface AdsetMeta {
  dailyBudget: number;
  updatedTime: string | null;
}
export interface RawAds {
  monet: MonetRow[];
  lmessage: LmsgRow[];
  adsetMeta: Record<string, AdsetMeta>;
}

export interface Bucket {
  lead: number;
  spend: number;
  impr: number;
  click: number;
  freqWeighted: number;
  dailyBudget?: number;
  lastUpdated?: string;
}
export interface StoreRow {
  name: string;
  kubun: string;
  region: string;
  shukyaku: Bucket;
  kyujin: Bucket;
  total_spend: number;
}
export interface NamedRow {
  name: string;
  shukyaku: Bucket;
  kyujin: Bucket;
}
export interface RegionRow {
  name: string;
  region: string;
  shukyaku: Bucket;
  kyujin: Bucket;
  total_spend: number;
}
export interface DashboardData {
  period: { days: number; value: string; label: string; since: string; until: string };
  cur: { shukyaku: Bucket; kyujin: Bucket };
  prev: {
    shukyaku: { lead: number; spend: number };
    kyujin: { lead: number; spend: number };
  };
  chokuei: StoreRow[];
  fc: StoreRow[];
  byCampaign: NamedRow[];
  byAdset: NamedRow[];
  kyujinByRegion: RegionRow[];
  series: { labels: string[]; shukyaku: number[]; kyujin: number[] };
  filters: { campaignList: string[]; storeList: string[]; regionList: string[] };
  updatedAt: string;
  lmessage: { byStoreShort: Record<string, number>; byRegion: Record<string, number>; asOf: string };
}

// ===== 期間プリセット解決（webapp.gs resolvePeriod を移植）=====
function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
function dayDiff(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000) + 1;
}
export function resolvePeriod(period: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const y = today.getFullYear();
  const m = today.getMonth();
  let since: Date,
    until: Date,
    prevSince: Date,
    prevUntil: Date,
    label: string,
    value: string,
    days: number;

  if (period === "this-month") {
    since = new Date(y, m, 1);
    until = today;
    prevSince = new Date(y, m - 1, 1);
    const elapsed = dayDiff(today, since);
    prevUntil = new Date(prevSince);
    prevUntil.setDate(prevSince.getDate() + elapsed - 1);
    label = "今月";
    value = "this-month";
    days = elapsed;
  } else if (period === "last-month") {
    since = new Date(y, m - 1, 1);
    until = new Date(y, m, 0);
    prevSince = new Date(y, m - 2, 1);
    prevUntil = new Date(y, m - 1, 0);
    label = "先月";
    value = "last-month";
    days = dayDiff(until, since);
  } else if (period === "this-year") {
    since = new Date(y, 0, 1);
    until = today;
    prevSince = new Date(y - 1, 0, 1);
    const elapsed = dayDiff(today, since);
    prevUntil = new Date(prevSince);
    prevUntil.setDate(prevSince.getDate() + elapsed - 1);
    label = "今年";
    value = "this-year";
    days = elapsed;
  } else if (period === "last-year") {
    since = new Date(y - 1, 0, 1);
    until = new Date(y - 1, 11, 31);
    prevSince = new Date(y - 2, 0, 1);
    prevUntil = new Date(y - 2, 11, 31);
    label = "前年";
    value = "last-year";
    days = 365;
  } else {
    days = parseInt(period, 10) || 30;
    since = new Date(today);
    since.setDate(since.getDate() - days + 1);
    until = today;
    prevSince = new Date(today);
    prevSince.setDate(prevSince.getDate() - days * 2 + 1);
    prevUntil = new Date(today);
    prevUntil.setDate(prevUntil.getDate() - days);
    label = "過去" + days + "日";
    value = String(days);
  }
  return {
    since,
    until,
    prevSince,
    prevUntil,
    sinceStr: fmt(since),
    untilStr: fmt(until),
    prevSinceStr: fmt(prevSince),
    prevUntilStr: fmt(prevUntil),
    label,
    value,
    days,
  };
}

// ===== ヘルパ（webapp.gs を移植）=====
function getCampaignType(name: string): "集客" | "求人" | "" {
  if (!name) return "";
  if (name.indexOf("集客") === 0) return "集客";
  if (name.indexOf("求人") === 0) return "求人";
  return "";
}
const KNOWN_REGIONS = ["大阪", "広島", "福岡"];
export function normalizeRegion(r: string): string | null {
  if (!r) return null;
  for (const base of KNOWN_REGIONS) {
    if (r === base || r === base + "エリア") return base + "エリア";
  }
  if (/エリア$/.test(r)) return r;
  return null;
}
function blankBucket(): Bucket {
  return { lead: 0, spend: 0, impr: 0, click: 0, freqWeighted: 0 };
}
function addToBucket(b: Bucket, lead: number, spend: number, impr: number, click: number, freq: number) {
  b.lead += lead;
  b.spend += spend;
  b.impr += impr;
  b.click += click;
  b.freqWeighted += freq * impr;
}

// 求人エリア集計用（lmessage byRegion 用 都道府県判定）
const PREFS = [
  "北海道","青森","秋田","岩手","宮城","山形","福島","東京","神奈川","埼玉","千葉","茨城","栃木","群馬","新潟","富山","石川","福井","愛知","岐阜","三重","静岡","大阪","兵庫","京都","奈良","滋賀","和歌山","広島","岡山","鳥取","島根","山口","香川","徳島","愛媛","高知","福岡","佐賀","長崎","熊本","大分","宮崎","鹿児島","沖縄",
];
const CITY_TO_PREF: Record<string, string> = {
  帯広: "北海道", 札幌: "北海道", 函館: "北海道", 旭川: "北海道",
  名古屋: "愛知", 横浜: "神奈川", 神戸: "兵庫", 岡本: "兵庫",
};
function tagToPref(s: string): string {
  for (let i = 0; i < PREFS.length; i++) if (s.indexOf(PREFS[i]) === 0) return PREFS[i];
  for (const c in CITY_TO_PREF) if (s.indexOf(c) === 0) return CITY_TO_PREF[c];
  return "";
}
function dayBefore(d: string): string {
  if (!d || d === "1900-01-01") return "1899-12-31";
  const p = d.split("-");
  const dt = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  dt.setDate(dt.getDate() - 1);
  return fmt(dt);
}

function getLmessageData(rows: LmsgRow[], since: string, until: string) {
  const sinceDay = since || "1900-01-01";
  const untilDay = until || "2099-12-31";
  const beforeSince = dayBefore(sinceDay);
  const startMap: Record<string, LmsgRow> = {};
  const endMap: Record<string, LmsgRow> = {};
  for (const r of rows) {
    const key = r.botId + "|" + r.tagId;
    const date = r.date;
    if (date <= beforeSince) {
      if (!startMap[key] || startMap[key].date < date) startMap[key] = r;
    }
    if (date <= untilDay) {
      if (!endMap[key] || endMap[key].date < date) endMap[key] = r;
    }
  }
  const byStoreShort: Record<string, number> = {};
  const byRegion: Record<string, number> = {};
  let maxDate = "";
  for (const k in endMap) {
    const end = endMap[k];
    const start = startMap[k];
    const startCount = start ? start.count : 0;
    const delta = end.count - startCount;
    const displayCount = delta > 0 ? delta : 0;
    const tag = end.tagName || "";
    const shortName = tag.replace(/流入$/, "");
    if (end.category === "集客") {
      byStoreShort[shortName] = (byStoreShort[shortName] || 0) + displayCount;
    } else if (end.category === "求人") {
      const pref = tagToPref(shortName);
      if (pref) {
        const k2 = pref + "エリア";
        byRegion[k2] = (byRegion[k2] || 0) + displayCount;
      }
    }
    if (end.date > maxDate) maxDate = end.date;
  }
  return { byStoreShort, byRegion, asOf: maxDate };
}

// ===== メイン集計（webapp.gs getDashboardData を移植）=====
export function getDashboardData(raw: RawAds, period: string): DashboardData {
  const p = resolvePeriod(period);
  const adsetMetaMap = raw.adsetMeta;

  const aggMeta = (adsetSet: Set<string>): AdsetMeta => {
    let dailyBudget = 0;
    let lastUpdated: string | null = null;
    Array.from(adsetSet).forEach((an) => {
      const meta = adsetMetaMap[an];
      if (!meta) return;
      dailyBudget += meta.dailyBudget;
      if (meta.updatedTime && (!lastUpdated || meta.updatedTime > lastUpdated))
        lastUpdated = meta.updatedTime;
    });
    return { dailyBudget, updatedTime: lastUpdated };
  };

  const storeData: Record<
    string,
    { kubun: string; region: string; shukyakuAdsets: Set<string>; kyujinAdsets: Set<string>; shukyaku: Bucket; kyujin: Bucket }
  > = {};
  const campaignData: Record<string, { adsets: Set<string>; shukyaku: Bucket; kyujin: Bucket }> = {};
  const adsetData: Record<string, { shukyaku: Bucket; kyujin: Bucket }> = {};
  const kyujinByRegion: Record<string, { adsets: Set<string>; shukyaku: Bucket; kyujin: Bucket }> = {};

  const cur = { shukyaku: blankBucket(), kyujin: blankBucket() };
  const prev = { shukyaku: { lead: 0, spend: 0 }, kyujin: { lead: 0, spend: 0 } };
  const dailyMap: Record<string, { 集客: number; 求人: number }> = {};
  const allCampaigns = new Set<string>();

  for (const row of raw.monet) {
    const date = row.date;
    if (!date) continue;
    const tenpo = row.tenpo;
    const kubun = row.kubun || "";
    const region = row.region || "";
    const campName = row.camp || "";
    const adsetName = row.adset || "";
    const campType = getCampaignType(campName);
    const lead = row.lead;
    const spend = row.spend;
    const freq = row.freq;
    const impr = row.impr;
    const click = row.click;

    if (date >= p.sinceStr && date <= p.untilStr) {
      if (campName) allCampaigns.add(campName);

      if (campType === "集客") {
        cur.shukyaku.lead += lead; cur.shukyaku.spend += spend; cur.shukyaku.impr += impr; cur.shukyaku.click += click; cur.shukyaku.freqWeighted += freq * impr;
      } else if (campType === "求人") {
        cur.kyujin.lead += lead; cur.kyujin.spend += spend; cur.kyujin.impr += impr; cur.kyujin.click += click; cur.kyujin.freqWeighted += freq * impr;
      }

      if (tenpo) {
        if (!storeData[tenpo])
          storeData[tenpo] = { kubun, region, shukyakuAdsets: new Set(), kyujinAdsets: new Set(), shukyaku: blankBucket(), kyujin: blankBucket() };
        if (campType === "集客") {
          addToBucket(storeData[tenpo].shukyaku, lead, spend, impr, click, freq);
          if (adsetName) storeData[tenpo].shukyakuAdsets.add(adsetName);
        } else if (campType === "求人") {
          addToBucket(storeData[tenpo].kyujin, lead, spend, impr, click, freq);
          if (adsetName) storeData[tenpo].kyujinAdsets.add(adsetName);
        }
      }

      if (campName) {
        if (!campaignData[campName]) campaignData[campName] = { adsets: new Set(), shukyaku: blankBucket(), kyujin: blankBucket() };
        if (campType === "集客") addToBucket(campaignData[campName].shukyaku, lead, spend, impr, click, freq);
        else if (campType === "求人") addToBucket(campaignData[campName].kyujin, lead, spend, impr, click, freq);
        if (adsetName) campaignData[campName].adsets.add(adsetName);
      }

      if (adsetName) {
        if (!adsetData[adsetName]) adsetData[adsetName] = { shukyaku: blankBucket(), kyujin: blankBucket() };
        if (campType === "集客") addToBucket(adsetData[adsetName].shukyaku, lead, spend, impr, click, freq);
        else if (campType === "求人") addToBucket(adsetData[adsetName].kyujin, lead, spend, impr, click, freq);
      }

      if (campType === "求人") {
        const normReg = normalizeRegion(region);
        if (normReg) {
          if (!kyujinByRegion[normReg]) kyujinByRegion[normReg] = { adsets: new Set(), shukyaku: blankBucket(), kyujin: blankBucket() };
          addToBucket(kyujinByRegion[normReg].kyujin, lead, spend, impr, click, freq);
          if (adsetName) kyujinByRegion[normReg].adsets.add(adsetName);
        }
      }

      if (!dailyMap[date]) dailyMap[date] = { 集客: 0, 求人: 0 };
      if (campType) dailyMap[date][campType] += lead;
    } else if (date >= p.prevSinceStr && date <= p.prevUntilStr) {
      if (campType === "集客") { prev.shukyaku.lead += lead; prev.shukyaku.spend += spend; }
      else if (campType === "求人") { prev.kyujin.lead += lead; prev.kyujin.spend += spend; }
    }
  }

  const withMeta = (b: Bucket, set: Set<string>): Bucket => {
    const m = aggMeta(set);
    return { ...b, dailyBudget: m.dailyBudget, lastUpdated: m.updatedTime || "" };
  };

  const stores: StoreRow[] = Object.keys(storeData).map((name) => {
    const s = storeData[name];
    return {
      name,
      kubun: s.kubun,
      region: s.region || "",
      shukyaku: withMeta(s.shukyaku, s.shukyakuAdsets),
      kyujin: withMeta(s.kyujin, s.kyujinAdsets),
      total_spend: s.shukyaku.spend + s.kyujin.spend,
    };
  });
  const chokuei = stores.filter((s) => s.kubun === "直営").sort((a, b) => b.total_spend - a.total_spend);
  const fc = stores.filter((s) => s.kubun === "FC").sort((a, b) => b.total_spend - a.total_spend);

  const byCampaign: NamedRow[] = Object.keys(campaignData)
    .map((name) => {
      const b = campaignData[name];
      return { name, shukyaku: withMeta(b.shukyaku, b.adsets), kyujin: withMeta(b.kyujin, b.adsets) };
    })
    .sort((a, b) => b.shukyaku.spend + b.kyujin.spend - (a.shukyaku.spend + a.kyujin.spend));
  const byAdset: NamedRow[] = Object.keys(adsetData)
    .map((name) => {
      const b = adsetData[name];
      const set = new Set<string>([name]);
      return { name, shukyaku: withMeta(b.shukyaku, set), kyujin: withMeta(b.kyujin, set) };
    })
    .sort((a, b) => b.shukyaku.spend + b.kyujin.spend - (a.shukyaku.spend + a.kyujin.spend));
  const kyujinByRegionArr: RegionRow[] = Object.keys(kyujinByRegion)
    .map((name) => {
      const b = kyujinByRegion[name];
      return { name, region: name, shukyaku: b.shukyaku, kyujin: withMeta(b.kyujin, b.adsets), total_spend: b.kyujin.spend };
    })
    .sort((a, b) => b.kyujin.spend - a.kyujin.spend);

  const dates = Object.keys(dailyMap).sort();
  const series = {
    labels: dates,
    shukyaku: dates.map((d) => dailyMap[d]["集客"]),
    kyujin: dates.map((d) => dailyMap[d]["求人"]),
  };

  const storeList = Array.from(new Set([...chokuei, ...fc].map((s) => s.name))).sort();
  const regionList = Array.from(
    new Set([...chokuei, ...fc].map((s) => normalizeRegion(s.region)).filter((r): r is string => !!r))
  ).sort();

  return {
    period: { days: p.days, value: p.value, label: p.label, since: p.sinceStr, until: p.untilStr },
    cur,
    prev,
    chokuei,
    fc,
    byCampaign,
    byAdset,
    kyujinByRegion: kyujinByRegionArr,
    series,
    filters: { campaignList: Array.from(allCampaigns).sort(), storeList, regionList },
    updatedAt:
      `${fmt(new Date())} ` +
      `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`,
    lmessage: getLmessageData(raw.lmessage, p.sinceStr, p.untilStr),
  };
}

// ===== raw データ構築 =====
function buildRaw(monetCsv: string[][], lmsgCsv: string[][], metaCsv: string[][]): RawAds {
  // monet: ヘッダ名でマッピング
  const mh = monetCsv[0] || [];
  const idx = (n: string) => mh.indexOf(n);
  const cDate = idx("日付"), cKubun = idx("区分"), cRegion = idx("地域"), cTenpo = idx("店舗"),
    cCamp = idx("キャンペーン名"), cAdset = idx("広告セット名"), cSpend = idx("消化額"),
    cLead = idx("リード数"), cFreq = idx("フリークエンシー"), cImpr = idx("インプレッション"), cClick = idx("クリック");
  const monet: MonetRow[] = [];
  for (let i = 1; i < monetCsv.length; i++) {
    const r = monetCsv[i];
    if (!r || r.length === 0) continue;
    const date = toYmd(r[cDate]);
    if (!date) continue;
    monet.push({
      date,
      kubun: (r[cKubun] || "").trim(),
      region: (r[cRegion] || "").trim(),
      tenpo: (r[cTenpo] || "").trim(),
      camp: (r[cCamp] || "").trim(),
      adset: (r[cAdset] || "").trim(),
      spend: num(r[cSpend]),
      lead: num(r[cLead]),
      freq: num(r[cFreq]),
      impr: num(r[cImpr]),
      click: num(r[cClick]),
    });
  }

  // lmessage: 位置でマッピング（取得日, ボットID, ボット名, 区分, タグID, タグ名, 友だち数）
  const lmessage: LmsgRow[] = [];
  for (let i = 1; i < lmsgCsv.length; i++) {
    const r = lmsgCsv[i];
    if (!r || r.length < 7) continue;
    const date = toYmd(r[0]);
    if (!date) continue;
    lmessage.push({
      date,
      botId: (r[1] || "").trim(),
      botName: (r[2] || "").trim(),
      category: (r[3] || "").trim(),
      tagId: (r[4] || "").trim(),
      tagName: (r[5] || "").trim(),
      count: num(r[6]),
    });
  }

  // adset_meta: 位置（広告セット名, 1日予算, 最終変更日）
  const adsetMeta: Record<string, AdsetMeta> = {};
  for (let i = 1; i < metaCsv.length; i++) {
    const r = metaCsv[i];
    if (!r || !r[0]) continue;
    adsetMeta[(r[0] || "").trim()] = { dailyBudget: num(r[1]), updatedTime: toYmd(r[2]) || null };
  }

  return { monet, lmessage, adsetMeta };
}

let cached: RawAds | null = null;
let fetchPromise: Promise<RawAds> | null = null;
async function fetchRaw(): Promise<RawAds> {
  if (cached) return cached;
  if (fetchPromise) return fetchPromise;
  fetchPromise = (async () => {
    const [monetCsv, lmsgCsv, metaCsv] = await Promise.all([
      fetchSheet("monet"),
      fetchSheet("lmessage"),
      fetchSheet("adset_meta"),
    ]);
    cached = buildRaw(monetCsv, lmsgCsv, metaCsv);
    return cached;
  })();
  return fetchPromise;
}

export function useAdsData() {
  const [raw, setRaw] = useState<RawAds | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const r = await fetchRaw();
        if (!cancelled) {
          setRaw(r);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "取得に失敗しました");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { raw, loading, error };
}
