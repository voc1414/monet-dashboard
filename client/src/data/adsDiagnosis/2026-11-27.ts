/**
 * 集客広告 店舗診断のスナップショット（2026-11-27）。
 * 次回は同じ形のファイルを足し、index.ts の CURRENT を差し替える。
 * 「–」だった数字は sheets_summary / hpb_slots / b_funnel / meta_adsets から入れた。
 * 広告費の院別は metaAdsets.ts の集客行の合計（全店合計と一致する）。
 * b_funnel の院別はこれより合計17円少なく、未配賦の広告セットではない。
 * 新規来店の null は、画面が広告ページと同じ日次を読んで埋める。
 * 確認中の項目は判定と合計に混ぜない。
 */

export type DiagnosisGrade = "A" | "B" | "C";

export interface DiagnosisSource {
  id: string;
  label: string;
  fetchedAt: string;
}

export interface DiagnosisStore {
  name: string;
  grade: DiagnosisGrade;
  /** 最初の画面に出す1行 */
  action: string;
  /** 前回からの変化。記録が無い院は null */
  history: string | null;
  spendYen: number;
  leads: number;
  lineReg: number;
  /** 30日の登録率（%）。無いときは null */
  regRatePct: number | null;
  /** 診断メモ上の登録率の書き方。30日と違うときだけ */
  regRateNote: string | null;
  costPerRegYen: number;
  ctrPct: number;
  cpmYen: number;
  /** 2週間のカット空き。未掲載・未取得は null */
  slotsCut: number | null;
  slotsColor: number | null;
  slotsNote: string | null;
  newVisits: number | null;
  /** LPの95%到達率（%）。未登録は null */
  lpReachPct: number | null;
  lpNote: string;
}

export interface AdsDiagnosisSnapshot {
  id: string;
  periodAds: string;
  periodSlots: string;
  sources: DiagnosisSource[];
  totals: {
    spendYen: number;
    leads: number;
    lineReg: number;
    costPerRegYen: number;
    regRatePct: number;
  };
  rules: string[];
  pending: string[];
  missing: string[];
  stores: DiagnosisStore[];
}

const sources: DiagnosisSource[] = [
  { id: "meta", label: "Meta広告（グランフュージョン）", fetchedAt: "2026-11-27 15:05" },
  { id: "line", label: "Lメッセージ（区分＝集客）", fetchedAt: "2026-11-27 20:37" },
  { id: "visits", label: "新規来店（サロンボード）", fetchedAt: "2026-11-27 20:37" },
  { id: "slots", label: "ホットペッパー掲載の空き枠", fetchedAt: "2026-11-27 20:39" },
  { id: "lp", label: "LP Clarity「モネ集客総合」スマホ過去30日", fetchedAt: "2026-11-27 20:50頃" },
];

export const ADS_DIAGNOSIS_20261127: AdsDiagnosisSnapshot = {
  id: "2026-11-27",
  periodAds: "2026-10-28〜2026-11-26",
  periodSlots: "2026-11-27〜2026-12-10",
  sources,
  totals: {
    spendYen: 587529,
    leads: 2982,
    lineReg: 1103,
    costPerRegYen: 533,
    regRatePct: 37,
  },
  rules: [
    "LINE登録単価が¥600以下なら C（問題なし）",
    "¥600超、かつ2週間のカット空きが5枠以下なら A（予約枠不足。広告より先に枠を増やす）",
    "¥600超、かつ枠があるなら B（広告とLPを見直す）。登録率の目標は35%。LPは95%地点まで読んだ人が40%以上で合格",
    "訴求「眠れる美容室」「五感を満たす唯一無二の美容室」は変えない。クリエイティブ疲れは動画の差し替えだけで対応",
  ],
  pending: [
    "高槻・姪浜のLINEタグとボタンの飛び先",
    "クリックが全クリックかリンククリックか、リードがLINEボタン押下か",
    "福島の配信エリア・ターゲット",
    "姪浜の11/24〜26の登録0が計測切れかどうか",
    "福島の差し替えルール（最初の7日を基準に15%下がったら差し替え）は提案で、未承認",
  ],
  missing: [
    "堀江2ndのLP（Clarity未登録）",
    "動画ごとの数字",
  ],
  stores: [
    {
      name: "堀江",
      grade: "A",
      action: "予約枠を増やす（11/23はB→今回A）",
      history: "11/23はB → 今回A",
      spendYen: 45101,
      leads: 141,
      lineReg: 54,
      regRatePct: 38.3,
      regRateNote: null,
      costPerRegYen: 835,
      ctrPct: 3.93,
      cpmYen: 1604,
      slotsCut: 3,
      slotsColor: 0,
      slotsNote: null,
      newVisits: 48,
      lpReachPct: 27.24,
      lpNote: "参考",
    },
    {
      name: "堀江2nd",
      grade: "A",
      action: "予約枠を増やす",
      history: null,
      spendYen: 30016,
      leads: 73,
      lineReg: 31,
      regRatePct: 42.5,
      regRateNote: null,
      costPerRegYen: 968,
      ctrPct: 3.32,
      cpmYen: 1890,
      slotsCut: 0,
      slotsColor: 0,
      slotsNote: null,
      newVisits: 6,
      lpReachPct: null,
      lpNote: "データなし（Clarity未登録）",
    },
    {
      name: "楽々園",
      grade: "A",
      action: "予約枠を増やす",
      history: null,
      spendYen: 45079,
      leads: 173,
      lineReg: 62,
      regRatePct: 35.8,
      regRateNote: null,
      costPerRegYen: 727,
      ctrPct: 3.63,
      cpmYen: 1038,
      slotsCut: 2,
      slotsColor: 0,
      slotsNote: null,
      newVisits: 24,
      lpReachPct: 20.79,
      lpNote: "参考",
    },
    {
      name: "福島",
      grade: "B",
      action: "広告動画の差し替え。CPMが基準の1.52倍（差の43%）",
      history: null,
      spendYen: 90206,
      leads: 284,
      lineReg: 94,
      regRatePct: 33.1,
      regRateNote: null,
      costPerRegYen: 960,
      ctrPct: 4.24,
      cpmYen: 1697,
      slotsCut: 44,
      slotsColor: 7,
      slotsNote: null,
      newVisits: 60,
      lpReachPct: 22.35,
      lpNote: "不合格",
    },
    {
      name: "高槻",
      grade: "B",
      action: "LPを見直す（登録率26.9%で最低）",
      history: null,
      spendYen: 45086,
      leads: 234,
      lineReg: 63,
      regRatePct: 26.9,
      regRateNote: null,
      costPerRegYen: 716,
      ctrPct: 4.39,
      cpmYen: 1098,
      slotsCut: 28,
      slotsColor: 4,
      slotsNote: null,
      newVisits: 48,
      lpReachPct: 32.82,
      lpNote: "不合格",
    },
    {
      name: "姪浜",
      grade: "B",
      action: "LINE追加の流れを確認する（登録率 前半41.1%→後半21.9%）。¥635・カット6枠であと1枠でA",
      history: "11/17 A → 11/20 C → 11/23 A → 今回B",
      spendYen: 51427,
      leads: 246,
      lineReg: 81,
      regRatePct: 32.9,
      regRateNote: "前半41.1% → 後半21.9%",
      costPerRegYen: 635,
      ctrPct: 4.26,
      cpmYen: 1152,
      slotsCut: 6,
      slotsColor: 1,
      slotsNote: null,
      newVisits: 25,
      lpReachPct: 30.25,
      lpNote: "不合格",
    },
    {
      name: "土橋",
      grade: "B",
      action: "LPを見直す。リード÷クリック10.6%で全店最低",
      history: null,
      spendYen: 45061,
      leads: 175,
      lineReg: 62,
      regRatePct: 35.4,
      regRateNote: null,
      costPerRegYen: 727,
      ctrPct: 4.08,
      cpmYen: 1111,
      slotsCut: 53,
      slotsColor: 14,
      slotsNote: null,
      newVisits: 53,
      lpReachPct: 26.04,
      lpNote: "不合格",
    },
    {
      name: "春日",
      grade: "C",
      action: "問題なし",
      history: null,
      spendYen: 79875,
      leads: 648,
      lineReg: 242,
      regRatePct: 37.3,
      regRateNote: null,
      costPerRegYen: 330,
      ctrPct: 5.67,
      cpmYen: 1014,
      slotsCut: 97,
      slotsColor: 68,
      slotsNote: null,
      newVisits: null,
      lpReachPct: 38.93,
      lpNote: "参考",
    },
    {
      name: "岡本",
      grade: "C",
      action: "問題なし",
      history: null,
      spendYen: 60224,
      leads: 336,
      lineReg: 137,
      regRatePct: 40.8,
      regRateNote: null,
      costPerRegYen: 440,
      ctrPct: 4.7,
      cpmYen: 1311,
      slotsCut: 44,
      slotsColor: 21,
      slotsNote: null,
      newVisits: 98,
      lpReachPct: 29.45,
      lpNote: "参考",
    },
    {
      name: "本通",
      grade: "C",
      action: "問題なし",
      history: null,
      spendYen: 54376,
      leads: 426,
      lineReg: 185,
      regRatePct: 43.4,
      regRateNote: null,
      costPerRegYen: 294,
      ctrPct: 5.5,
      cpmYen: 1187,
      slotsCut: null,
      slotsColor: null,
      slotsNote: "ホットペッパー未掲載",
      newVisits: null,
      lpReachPct: 42.69,
      lpNote: "参考",
    },
    {
      name: "下伊福",
      grade: "C",
      action: "問題なし",
      history: null,
      spendYen: 41078,
      leads: 246,
      lineReg: 92,
      regRatePct: 37.4,
      regRateNote: null,
      costPerRegYen: 446,
      ctrPct: 4.18,
      cpmYen: 1007,
      slotsCut: 80,
      slotsColor: 33,
      slotsNote: null,
      newVisits: 53,
      lpReachPct: 27.38,
      lpNote: "参考",
    },
  ],
};
