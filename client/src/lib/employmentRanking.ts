/*
 * 雇用形態別の売上ランキング／平均売上の集計（2026-09-01 GF-EMPRANK）。
 *
 * 画面（pages/EmploymentRanking.tsx）から切り離した純関数。React も fetch も触らないので
 * server/employmentRanking.test.ts から実データ形状のまま検証できる。
 *
 * 決めごと（林さんの決定・2026-09-01）:
 *   1. 期間は既存の PeriodSelector に従う。複数月が選ばれたら「全月を集計」する。
 *      ※スタッフ一覧（StaffList.tsx）は複数月でも各スタッフの最新月しか見ていない。
 *        売上ランキングで同じことをすると「年間」なのに1ヶ月分の数字が並ぶので踏襲しない。
 *   2. 雇用形態はその月の報告どおりで分類する。月をまたいで雇用形態が変わった人は
 *      変わる前のグループと後のグループの両方に、その月のレコードだけが入る。
 *   3. 売上は月末報告書（自己申告）の 技術売上 + 店販売上。
 *      林さんの決定は一貫して「店舗売上＝サロンボード／個人数値＝月末報告書」で、
 *      2026-09-03 の指示で個人系の画面をすべて報告書へ戻した（staffReportMetrics.ts 参照）。
 *      報告書を出していない月はその行自体が存在しないので、平均の分母にも入らない。
 *      それでも getSales が null を返す余地は残す（分母から除外し、件数を必ず出す）。
 *   4. 雇用形態の比較指標は「1人あたり月間平均売上」＝ 売上合計 ÷ 有効レコード数（人×月）。
 *      期間が1ヶ月でも12ヶ月でも意味が変わらず、在籍月数の違いにも歪まない。
 */
import { canonicalEmploymentType, getMaxCustomers, normalizeEmploymentType } from "./utilizationRate";

/** 週数が書かれていない「パート」。最大客数が決まらないので正式な雇用形態と混ぜない */
export const PART_TIME_UNSPECIFIED_GROUP = "パート（週数未記入）";
/** 雇用形態が空欄の月 */
export const EMPLOYMENT_BLANK_GROUP = "雇用形態 未記入";

/** 集計の入力。月末報告書1行（= スタッフ×月）に必要な項目だけ */
export interface EmploymentRankingInput {
  name: string;
  storeNormalized: string;
  reportMonth: string;
  answerDate: string;
  employmentType: string;
}

/** 個人の1行（そのグループの中でのランキング行） */
export interface EmploymentMember {
  name: string;
  store: string;
  /** このグループに属していた月（降順） */
  months: string[];
  /** 売上データがあった月数（平均の分母） */
  validMonths: number;
  /** 売上データが無かった月（サロンボードに行が無い） */
  missingMonths: string[];
  /** 期間合計。validMonths が 0 なら 0 */
  totalSales: number;
  /** 月平均。validMonths が 0 なら null（¥0 と区別する） */
  avgMonthlySales: number | null;
}

/** 雇用形態1グループのまとめ */
export interface EmploymentGroup {
  employmentGroup: string;
  /** 参考値。週数未記入・未記入・想定外の表記は null */
  maxCustomers: number | null;
  /** このグループに属した人数（期間内） */
  people: number;
  /** レコード数（人×月） */
  records: number;
  /** うち売上データがあったレコード数＝平均の分母 */
  validRecords: number;
  /** うち売上データが無かったレコード数 */
  missingRecords: number;
  totalSales: number;
  /** 1人あたり月間平均売上。validRecords が 0 なら null */
  avgMonthlySales: number | null;
  /** 個人ランキング（月平均の降順。データ無しは末尾） */
  members: EmploymentMember[];
}

export interface EmploymentRankingResult {
  /** 集計対象の月（昇順） */
  months: string[];
  /** 雇用形態グループ（月平均の降順。データ無しは末尾） */
  groups: EmploymentGroup[];
  /** 全グループ合計 */
  totals: {
    people: number;
    records: number;
    validRecords: number;
    missingRecords: number;
    totalSales: number;
    avgMonthlySales: number | null;
  };
}

/**
 * 生の雇用形態文字列を、画面に出すグループ名へ寄せる。
 * 想定外の表記は捨てずに正規化した文字列そのままをグループにする（黙って消えると気づけない）。
 */
export function employmentGroupOf(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return EMPLOYMENT_BLANK_GROUP;

  const canonical = canonicalEmploymentType(trimmed);
  if (canonical) return canonical;

  const normalized = normalizeEmploymentType(trimmed);
  if (normalized === "パート") return PART_TIME_UNSPECIFIED_GROUP;
  return normalized;
}

/** グループ表示順の重み。正式な雇用形態を先に、判定できない枠を後ろに置く */
function groupSortWeight(group: string): number {
  if (group === EMPLOYMENT_BLANK_GROUP) return 2;
  if (group === PART_TIME_UNSPECIFIED_GROUP) return 1;
  return getMaxCustomers(group) === null ? 1 : 0;
}

/** null を末尾に落としつつ降順に並べる */
function byValueDesc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

/**
 * 同じスタッフ×同じ報告月の行が2つ以上あったら、回答日が新しい行だけを残す。
 * 月末報告書には二重提出（例: 同じ人の 08-02 と 08-08）が実在するので、
 * これをしないと売上が2回足されて雇用形態別の合計が膨らむ。
 */
export function dedupeByStaffMonth(rows: EmploymentRankingInput[]): EmploymentRankingInput[] {
  const latest = new Map<string, EmploymentRankingInput>();
  for (const r of rows) {
    const key = `${r.storeNormalized}__${r.name}__${r.reportMonth}`;
    const prev = latest.get(key);
    if (!prev || (r.answerDate || "") > (prev.answerDate || "")) latest.set(key, r);
  }
  return Array.from(latest.values());
}

export interface BuildEmploymentRankingOptions {
  /** 対象月。"all" なら全月 */
  months: string[] | "all";
  /** その月の売上。取れない月は null を返すこと（0 と区別する） */
  getSales: (store: string, name: string, month: string) => number | null;
  /** 退社・集計対象外の判定。true の行は落とす */
  isRetired?: (name: string, store: string, month: string) => boolean;
}

export function buildEmploymentRanking(
  rows: EmploymentRankingInput[],
  { months, getSales, isRetired }: BuildEmploymentRankingOptions,
): EmploymentRankingResult {
  const monthSet = months === "all" ? null : new Set(months);

  const target = dedupeByStaffMonth(
    rows.filter((r) => {
      if (!r.name || !r.storeNormalized || !r.reportMonth) return false;
      if (monthSet && !monthSet.has(r.reportMonth)) return false;
      if (isRetired?.(r.name, r.storeNormalized, r.reportMonth)) return false;
      return true;
    }),
  );

  // グループ → 人 → その人の月ごとの売上
  type MemberAcc = {
    name: string;
    store: string;
    months: string[];
    missingMonths: string[];
    totalSales: number;
    validMonths: number;
  };
  const groupAcc = new Map<string, Map<string, MemberAcc>>();

  for (const r of target) {
    const group = employmentGroupOf(r.employmentType);
    let membersOfGroup = groupAcc.get(group);
    if (!membersOfGroup) {
      membersOfGroup = new Map();
      groupAcc.set(group, membersOfGroup);
    }

    const memberKey = `${r.storeNormalized}__${r.name}`;
    let member = membersOfGroup.get(memberKey);
    if (!member) {
      member = {
        name: r.name,
        store: r.storeNormalized,
        months: [],
        missingMonths: [],
        totalSales: 0,
        validMonths: 0,
      };
      membersOfGroup.set(memberKey, member);
    }

    member.months.push(r.reportMonth);
    const sales = getSales(r.storeNormalized, r.name, r.reportMonth);
    if (sales === null) {
      member.missingMonths.push(r.reportMonth);
    } else {
      member.totalSales += sales;
      member.validMonths += 1;
    }
  }

  const groups: EmploymentGroup[] = Array.from(groupAcc.entries()).map(([group, membersOfGroup]) => {
    const members: EmploymentMember[] = Array.from(membersOfGroup.values())
      .map((m) => ({
        name: m.name,
        store: m.store,
        months: [...m.months].sort().reverse(),
        validMonths: m.validMonths,
        missingMonths: [...m.missingMonths].sort().reverse(),
        totalSales: m.totalSales,
        avgMonthlySales: m.validMonths > 0 ? Math.round(m.totalSales / m.validMonths) : null,
      }))
      .sort(
        (a, b) =>
          byValueDesc(a.avgMonthlySales, b.avgMonthlySales) ||
          a.name.localeCompare(b.name, "ja"),
      );

    const records = members.reduce((s, m) => s + m.months.length, 0);
    const validRecords = members.reduce((s, m) => s + m.validMonths, 0);
    const totalSales = members.reduce((s, m) => s + m.totalSales, 0);

    return {
      employmentGroup: group,
      maxCustomers: getMaxCustomers(group),
      people: members.length,
      records,
      validRecords,
      missingRecords: records - validRecords,
      totalSales,
      avgMonthlySales: validRecords > 0 ? Math.round(totalSales / validRecords) : null,
      members,
    };
  });

  groups.sort(
    (a, b) =>
      groupSortWeight(a.employmentGroup) - groupSortWeight(b.employmentGroup) ||
      byValueDesc(a.avgMonthlySales, b.avgMonthlySales) ||
      a.employmentGroup.localeCompare(b.employmentGroup, "ja"),
  );

  const records = groups.reduce((s, g) => s + g.records, 0);
  const validRecords = groups.reduce((s, g) => s + g.validRecords, 0);
  const totalSales = groups.reduce((s, g) => s + g.totalSales, 0);
  // 人数は雇用形態が月で変わった人を二重に数えないよう、店舗+氏名で数え直す
  const uniquePeople = new Set(target.map((r) => `${r.storeNormalized}__${r.name}`));

  return {
    months: Array.from(new Set(target.map((r) => r.reportMonth))).sort(),
    groups,
    totals: {
      people: uniquePeople.size,
      records,
      validRecords,
      missingRecords: records - validRecords,
      totalSales,
      avgMonthlySales: validRecords > 0 ? Math.round(totalSales / validRecords) : null,
    },
  };
}
