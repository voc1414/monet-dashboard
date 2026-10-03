/*
 * 次回予約強化タブ（管理者専用・2026-10-03）の集計ロジック。
 * 月は ymOffset 方式（newBadge.test と同じ）。「現在月」前提の月ハードコードは禁止。
 */
import { describe, expect, it } from "vitest";

import {
  BOOST_START_MONTH,
  buildBoostView,
  buildPersonBoostView,
  isBoostTarget,
  matchBoostAnswer,
  nextReservationRate,
  parseBoostAnswers,
  parseScore,
  parseTargetMonth,
  resolveBoostColumns,
  streakByMonth,
  type ReportRow,
} from "../client/src/lib/nextReservationBoost";

function ymOffset(offset: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 測定開始月の制限をかけない（相対月で組んだテスト用） */
const ALL = "";

const key = (s: string) => s.replace(/[\s　]/g, "").toLowerCase();
const fold = (s: string) => s.replace(/^(大阪|広島|福岡|岡山)/, "");

const Q_HEADERS = Array.from({ length: 17 }, (_, i) => `Q${i + 1}. トーク要点${i + 1}`);
const HEADER = [
  "LINE ユーザーID",
  "回答ID",
  "回答日時",
  "回答者ID",
  "LINE名",
  "システム表示名",
  "氏名",
  "所属店舗",
  "対象月",
  ...Q_HEADERS,
  "次回予約に関する自身の課題点",
  "翌月まで強化する具体的なアクション内容",
];

function row(o: { date: string; sys: string; name: string; store: string; month: string; scores: number[]; issue?: string; action?: string }) {
  const label = ["", "1 できていない", "2 あまりできていない", "3 だいたいできている", "4 いつもできている"];
  return [
    "U1", "A1", o.date, "R1", "line", o.sys, o.name, o.store, `${o.month}-01`,
    ...o.scores.map((s) => label[s]),
    o.issue ?? "", o.action ?? "",
  ];
}

describe("次回予約率", () => {
  it("次回予約取得数 ÷（新規＋再来）を小数1桁で出す", () => {
    expect(nextReservationRate(14, 5, 15)).toBe(70);
    expect(nextReservationRate(2, 1, 2)).toBe(66.7);
  });
  it("客数0は判定できない（null）", () => {
    expect(nextReservationRate(0, 0, 0)).toBeNull();
    expect(isBoostTarget(null)).toBe(false);
  });
  it("70%ちょうどは強化対象・70%超えはクリア", () => {
    expect(isBoostTarget(70)).toBe(true);
    expect(isBoostTarget(70.1)).toBe(false);
  });
});

describe("連続月数", () => {
  const m = [ymOffset(-5), ymOffset(-4), ymOffset(-3), ymOffset(-2), ymOffset(-1)];

  it("70%以下で+1、70%超えで0に戻る", () => {
    const rates = new Map<string, number | null>([
      [m[0], 60], [m[1], 65], [m[2], 80], [m[3], 50], [m[4], 70],
    ]);
    const s = streakByMonth(m, rates, ALL);
    expect(m.map((x) => s.get(x))).toEqual([1, 2, 0, 1, 2]);
  });

  it("報告書を出していない月は判定せず据え置く（3ヶ月連続にも数える）", () => {
    const rates = new Map<string, number | null>([[m[0], 60], [m[1], 65], [m[3], 50]]);
    const s = streakByMonth(m, rates, ALL);
    expect(m.map((x) => s.get(x))).toEqual([1, 2, 2, 3, 3]);
  });

  it("客数0の月も判定できない月として据え置く", () => {
    const rates = new Map<string, number | null>([[m[0], 60], [m[1], null], [m[2], 40]]);
    const s = streakByMonth(m.slice(0, 3), rates, ALL);
    expect(s.get(m[1])).toBe(1);
    expect(s.get(m[2])).toBe(2);
  });
});

// 開始月そのものの決まりなので、ここだけ固定の月を使う（今日の日付に依存しない）
describe("測定開始月（2026年10月分から）", () => {
  it("開始前の月は連続月数に数えず、開始月から1で数え始める", () => {
    const m = ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11"];
    const rates = new Map<string, number | null>(m.map((x) => [x, 50]));
    const s = streakByMonth(m, rates);
    expect(BOOST_START_MONTH).toBe("2026-10");
    expect(m.map((x) => s.get(x))).toEqual([0, 0, 0, 1, 2]);
  });

  it("開始前の月は対象者一覧に出さない・個人ページでは測定前", () => {
    const reports: ReportRow[] = [
      { store: "堀江院", name: "A", systemName: "", reportMonth: "2026-09", newCustomers: 0, returnCustomers: 100, nextReservation: 50 },
      { store: "堀江院", name: "A", systemName: "", reportMonth: "2026-10", newCustomers: 0, returnCustomers: 100, nextReservation: 50 },
    ];
    expect(buildBoostView({ reports, answers: [], questionLabels: [], month: "2026-09", staffKey: key }).targets).toEqual([]);
    expect(
      buildBoostView({ reports, answers: [], questionLabels: [], month: "2026-10", staffKey: key }).targets.map((t) => t.streak),
    ).toEqual([1]);
    const p = buildPersonBoostView({ reports, answers: [], store: "堀江院", name: "A", staffKey: key });
    expect(p.months.map((x) => [x.month, x.measured, x.isTarget, x.streak])).toEqual([
      ["2026-10", true, true, 1],
      ["2026-09", false, false, 0],
    ]);
  });
});

describe("強化シートの列解決", () => {
  it("ヘッダー名で解決する（列が増えても位置に依存しない）", () => {
    const header = ["増えた列", ...HEADER];
    const c = resolveBoostColumns(header);
    expect(c.ok).toBe(true);
    expect(c.index.name).toBe(header.indexOf("氏名"));
    expect(c.index.store).toBe(header.indexOf("所属店舗"));
    expect(c.index.targetMonth).toBe(header.indexOf("対象月"));
    expect(c.questions[0]).toBe(header.indexOf(Q_HEADERS[0]));
    expect(c.questions[16]).toBe(header.indexOf(Q_HEADERS[16]));
    expect(c.index.issue).toBe(header.indexOf("次回予約に関する自身の課題点"));
    expect(c.index.action).toBe(header.indexOf("翌月まで強化する具体的なアクション内容"));
    expect(c.issues).toEqual([]);
  });

  it("Q1 と Q10〜Q17 を取り違えない", () => {
    const c = resolveBoostColumns(HEADER);
    expect(new Set(c.questions).size).toBe(17);
    expect(HEADER[c.questions[9]]).toBe(Q_HEADERS[9]);
  });

  it("Qの番号がヘッダーに無いときは中身（4〜1の選択肢）の列を左から当てる", () => {
    const header = HEADER.map((h) => (h.startsWith("Q") ? h.replace(/^Q\d+\.\s*/, "") : h));
    const body = [row({ date: "2026-01-07", sys: "a", name: "a", store: "堀江院", month: "2026-01", scores: Array(17).fill(3) })];
    const c = resolveBoostColumns(header, body);
    expect(c.questions).toEqual(Array.from({ length: 17 }, (_, i) => 9 + i));
  });

  it("必須列が無いときは ok=false で注意書きを出す", () => {
    const c = resolveBoostColumns(["回答日時", "氏名"]);
    expect(c.ok).toBe(false);
    expect(c.issues.some((i) => i.includes("所属店舗"))).toBe(true);
  });

  it("点数と対象月の読み取り", () => {
    expect(parseScore("4 いつもできている")).toBe(4);
    expect(parseScore("２ あまりできていない")).toBe(2);
    expect(parseScore("")).toBeNull();
    expect(parseTargetMonth("2026/1/1")).toBe("2026-01");
    expect(parseTargetMonth("2026年10月")).toBe("2026-10");
    expect(parseTargetMonth("Date(2026,9,1)")).toBe("2026-10");
  });
});

describe("0件のとき", () => {
  it("ヘッダーも本文も空なら回答0件で壊れない", () => {
    expect(parseBoostAnswers([], fold).answers).toEqual([]);
    expect(parseBoostAnswers([[""]], fold).answers).toEqual([]);
    // ヘッダーが空のうちは注意書きも出さない（最初の回答でヘッダーが入る）
    expect(parseBoostAnswers([[""]], fold).columns.issues).toEqual([]);
  });

  it("ヘッダーだけあって回答0件でも壊れない", () => {
    expect(parseBoostAnswers([HEADER], fold).answers).toEqual([]);
  });

  it("回答0件でも対象者一覧は月末報告書から出る（全員未提出）", () => {
    const month = ymOffset(-1);
    const v = buildBoostView({
      reports: [{ store: "堀江院", name: "山田花子", systemName: "", reportMonth: month, newCustomers: 5, returnCustomers: 5, nextReservation: 5 }],
      answers: [],
      questionLabels: [],
      month,
      staffKey: key,
      startMonth: ALL,
    });
    expect(v.targets).toHaveLength(1);
    expect(v.targets[0].submitted).toBe(false);
    expect(v.answerCount).toBe(0);
    expect(v.questionStats.every((q) => q.average === null)).toBe(true);
    expect(v.people).toEqual([]);
  });
});

describe("テスト回答の除外", () => {
  it("氏名やシステム表示名が「テスト」の回答は読まない", () => {
    const rows = [
      HEADER,
      row({ date: "2026-01-07", sys: "テスト", name: "テスト", store: "堀江院", month: "2026-01", scores: Array(17).fill(1) }),
      row({ date: "2026-01-07", sys: "hana", name: "山田花子", store: "大阪堀江院", month: "2026-01", scores: Array(17).fill(3) }),
    ];
    const { answers } = parseBoostAnswers(rows, fold);
    expect(answers.map((a) => a.name)).toEqual(["山田花子"]);
    expect(answers[0].storeNormalized).toBe("堀江院");
  });
});

describe("名前の照合（店舗＋名前の組）", () => {
  const staff = [
    { store: "堀江院", name: "Akiko", systemName: "" },
    { store: "姪浜院", name: "Akiko", systemName: "" },
    { store: "高槻院", name: "佐藤", systemName: "さとう(高槻)" },
  ];

  it("同じ名前が別店舗にいても、店舗で絞って1人に決める", () => {
    const r = matchBoostAnswer({ name: "akiko", systemName: "", storeNormalized: "姪浜院" }, staff, key);
    expect(r).toEqual({ matched: true, store: "姪浜院", name: "Akiko" });
  });

  it("システム表示名どうしでも照合できる", () => {
    const r = matchBoostAnswer({ name: "", systemName: "さとう(高槻)", storeNormalized: "高槻院" }, staff, key);
    expect(r).toEqual({ matched: true, store: "高槻院", name: "佐藤" });
  });

  it("店舗が違えば同名でも寄せない（未照合）", () => {
    const r = matchBoostAnswer({ name: "Akiko", systemName: "", storeNormalized: "高槻院" }, staff, key);
    expect(r.matched).toBe(false);
  });

  it("同じ店舗に候補が2人以上なら未照合", () => {
    const dup = [...staff, { store: "堀江院", name: "Mika", systemName: "akiko" }];
    const r = matchBoostAnswer({ name: "Akiko", systemName: "", storeNormalized: "堀江院" }, dup, key);
    expect(r.matched).toBe(false);
  });
});

describe("画面の組み立て", () => {
  const m3 = ymOffset(-3);
  const m2 = ymOffset(-2);
  const m1 = ymOffset(-1);
  const rep = (name: string, store: string, month: string, rate: number): ReportRow => ({
    store, name, systemName: "", reportMonth: month, newCustomers: 0, returnCustomers: 100, nextReservation: rate,
  });
  const reports = [
    rep("A", "堀江院", m3, 60), rep("A", "堀江院", m2, 60), rep("A", "堀江院", m1, 60),
    rep("B", "堀江院", m1, 80),
    rep("C", "高槻院", m3, 50), /* m2 未提出 */ rep("C", "高槻院", m1, 50),
  ];
  const ans = (name: string, store: string, month: string, scores: number[], date = `${month}-08`) => ({
    answerDate: date, systemName: "", name, store, storeNormalized: store, targetMonth: month,
    scores, issue: `${name}の課題`, action: `${name}の行動`,
  });
  const s = (first: number, rest: number) => [first, ...Array(16).fill(rest)];
  const answers = [
    ans("A", "堀江院", m3, s(4, 4)),
    ans("A", "堀江院", m2, s(3, 4)),
    ans("A", "堀江院", m1, s(1, 4), `${m1}-08`),
    ans("A", "堀江院", m1, s(2, 4), `${m1}-09`), // 同じ月の再提出 → 新しい方
    ans("C", "高槻院", m1, s(1, 3)),
    ans("知らない人", "堀江院", m1, s(4, 4)),
  ];
  const v = buildBoostView({ reports, answers, questionLabels: [], month: m1, staffKey: key, startMonth: ALL });

  it("70%以下だけが対象で、連続3ヶ月以上は面談対象", () => {
    expect(v.targets.map((t) => [t.name, t.streak, t.needsInterview, t.submitted])).toEqual([
      ["A", 3, true, true],
      ["C", 2, false, true],
    ]);
  });

  it("項目ごとの集計は低い項目が上・2と1の人数を数える", () => {
    expect(v.answerCount).toBe(3); // A(再提出は1件), C, 未照合1件
    expect(v.questionStats[0].index).toBe(0);
    expect(v.questionStats[0].average).toBe(Math.round(((2 + 1 + 4) / 3) * 100) / 100);
    expect(v.questionStats[0].lowCount).toBe(2);
  });

  it("個人ごとの回答は直近3回・新しい順", () => {
    const a = v.people.find((p) => p.name === "A")!;
    expect(a.answers.map((x) => x.targetMonth)).toEqual([m1, m2, m3]);
    expect(a.answers[0].scores[0]).toBe(2);
  });

  it("照合できない回答は未照合として出す（誰かに寄せない）", () => {
    expect(v.unmatched.map((u) => u.answer.name)).toEqual(["知らない人"]);
  });

  it("選べる月は新しい順", () => {
    expect(v.months).toEqual([m1, m2, m3]);
  });

  it("退職者は対象者一覧から外す", () => {
    const v2 = buildBoostView({
      reports, answers, questionLabels: [], month: m1, staffKey: key,
      isRetired: (name) => name === "A", startMonth: ALL,
    });
    expect(v2.targets.map((t) => t.name)).toEqual(["C"]);
  });

  describe("個人ページ", () => {
    it("月ごとの推移（新しい順）に率・連続月数・提出状況が並ぶ", () => {
      const p = buildPersonBoostView({ reports, answers, store: "堀江院", name: "A", staffKey: key, startMonth: ALL });
      expect(p.months.map((m) => [m.month, m.rate, m.streak, m.isTarget, m.answer?.scores[0] ?? null])).toEqual([
        [m1, 60, 3, true, 2], // 同じ月の再提出は新しい方
        [m2, 60, 2, true, 3],
        [m3, 60, 1, true, 4],
      ]);
      expect(p.answers.map((a) => a.targetMonth)).toEqual([m1, m2, m3]);
    });

    it("報告書を出していない月は「報告書なし」で、連続月数は据え置き", () => {
      const p = buildPersonBoostView({ reports, answers, store: "高槻院", name: "C", staffKey: key, startMonth: ALL });
      expect(p.months.map((m) => [m.month, m.reported, m.streak])).toEqual([
        [m1, true, 2],
        [m3, true, 1],
      ]);
    });

    it("70%超えの人は対象外・回答なし", () => {
      const p = buildPersonBoostView({ reports, answers, store: "堀江院", name: "B", staffKey: key, startMonth: ALL });
      expect(p.months.map((m) => [m.month, m.isTarget, m.streak])).toEqual([[m1, false, 0]]);
      expect(p.answers).toEqual([]);
    });

    it("同じ名前でも店舗が違えば別人（店舗＋名前の組）", () => {
      const p = buildPersonBoostView({ reports, answers, store: "高槻院", name: "A", staffKey: key, startMonth: ALL });
      expect(p.months).toEqual([]);
      expect(p.answers).toEqual([]);
    });
  });
});
