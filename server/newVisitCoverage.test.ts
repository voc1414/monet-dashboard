import { describe, expect, it } from "vitest";
import { newVisitCoverage } from "../client/src/lib/newVisitCoverage";

function ymds(from: string, to: string, skip: string[] = []): string[] {
  const out: string[] = [];
  const p = from.split("-").map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  for (let i = 0; i < 400; i++) {
    const s = d.toISOString().slice(0, 10);
    if (!skip.includes(s)) out.push(s);
    if (s >= to) break;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function rows(store: string, dates: string[]) {
  return dates.map((date) => ({ store, date }));
}

const SINCE = "2026-10-29";
const UNTIL = "2026-11-27";

describe("新規来店の日次カバー", () => {
  it("全日そろっている店は出さない", () => {
    const all = ymds(SINCE, UNTIL);
    expect(all).toHaveLength(30);
    expect(newVisitCoverage(rows("堀江院", all), SINCE, UNTIL)).toEqual([]);
  });

  it("抜けた日は「30日中15日分のみ」と出す", () => {
    const all = ymds(SINCE, UNTIL);
    const skip = all.filter((_, i) => i % 2 === 0);
    expect(skip).toHaveLength(15);
    // 期間より前の行があるので、先頭日の欠測は「途中から始まった」ではない
    const got = newVisitCoverage(
      [...rows("堀江院2nd", ["2026-09-01"]), ...rows("堀江院2nd", ymds(SINCE, UNTIL, skip))],
      SINCE,
      UNTIL,
    );
    expect(got).toEqual([
      {
        store: "堀江院2nd",
        periodDays: 30,
        coveredDays: 15,
        startsOnLabel: null,
        message: "新規来店：30日中15日分のみ（少なめに出ている可能性）",
      },
    ]);
  });

  it("系列が期間の途中から始まる店は「11/9以降の分」を添える", () => {
    const dates = ymds("2026-11-09", UNTIL, ["2026-11-14", "2026-11-15", "2026-11-21", "2026-11-22"]);
    expect(dates).toHaveLength(15);
    const got = newVisitCoverage(rows("春日院", dates), SINCE, UNTIL);
    expect(got).toEqual([
      {
        store: "春日院",
        periodDays: 30,
        coveredDays: 15,
        startsOnLabel: "11/9",
        message: "新規来店：30日中15日分のみ（少なめに出ている可能性）・11/9以降の分",
      },
    ]);
  });

  it("期間より前からデータがある店の穴は、途中開始とは書かない", () => {
    const inPeriod = ymds(SINCE, UNTIL, ["2026-10-29", "2026-10-30"]);
    const got = newVisitCoverage(
      [...rows("姪浜院", ["2026-10-01"]), ...rows("姪浜院", inPeriod)],
      SINCE,
      UNTIL,
    );
    expect(got).toHaveLength(1);
    expect(got[0].startsOnLabel).toBeNull();
    expect(got[0].coveredDays).toBe(28);
    expect(got[0].message).toBe("新規来店：30日中28日分のみ（少なめに出ている可能性）");
  });

  it("期間より後に始まる系列は、この期間の警告にしない", () => {
    expect(newVisitCoverage(rows("春日院", ["2026-12-01"]), SINCE, UNTIL)).toEqual([]);
  });

  it("同じ日の重複は1日。そろっている店は混ぜない。日数が少ない店が先", () => {
    const got = newVisitCoverage(
      [
        ...rows("下伊福院", ymds(SINCE, UNTIL, ["2026-11-18"])),
        ...rows("下伊福院", ["2026-11-01"]),
        ...rows("岡本院", ymds(SINCE, UNTIL)),
        ...rows("堀江院2nd", ymds(SINCE, UNTIL).slice(0, 10)),
      ],
      SINCE,
      UNTIL,
    );
    expect(got.map((g) => g.store)).toEqual(["堀江院2nd", "下伊福院"]);
    expect(got[0].coveredDays).toBe(10);
    expect(got[1].coveredDays).toBe(29);
    expect(got.every((g) => g.message.includes("少なめに出ている可能性"))).toBe(true);
    expect(got.some((g) => g.store === "岡本院")).toBe(false);
  });

  it("期間が逆・空データなら空", () => {
    expect(newVisitCoverage(rows("堀江院", ["2026-11-01"]), UNTIL, SINCE)).toEqual([]);
    expect(newVisitCoverage([], SINCE, UNTIL)).toEqual([]);
  });
});
