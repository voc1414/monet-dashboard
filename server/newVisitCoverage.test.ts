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
const NONE = { stale: null, startNotes: [], knownStores: [] as string[] };

describe("新規来店の日次カバー", () => {
  it("全日そろっている店は出さない", () => {
    const all = ymds(SINCE, UNTIL);
    expect(all).toHaveLength(30);
    expect(newVisitCoverage(rows("堀江院", all), SINCE, UNTIL)).toEqual({
      stale: null,
      startNotes: [],
      knownStores: ["堀江院"],
    });
  });

  it("系列の途中で行が無い日は0件として数え、欠損の警告にしない", () => {
    const all = ymds(SINCE, UNTIL);
    const skip = all.filter((_, i) => i % 2 === 0);
    expect(skip).toHaveLength(15);
    // 期間より前の行があるので途中開始ではない。抜けた日は最新日までの来店ゼロ
    const got = newVisitCoverage(
      [...rows("堀江院2nd", ["2026-09-01"]), ...rows("堀江院2nd", ymds(SINCE, UNTIL, skip))],
      SINCE,
      UNTIL,
    );
    expect(got).toEqual({ stale: null, startNotes: [], knownStores: ["堀江院2nd"] });
  });

  it("別の店が最新日まで持っていれば、行が短い店の残りも0件", () => {
    const got = newVisitCoverage(
      [
        ...rows("堀江院2nd", ymds(SINCE, UNTIL).slice(0, 10)),
        ...rows("岡本院", ymds(SINCE, UNTIL)),
      ],
      SINCE,
      UNTIL,
    );
    expect(got).toEqual({ stale: null, startNotes: [], knownStores: ["岡本院", "堀江院2nd"] });
  });

  it("系列が期間の途中から始まる店は警告ではなく注記", () => {
    const dates = ymds("2026-11-09", UNTIL, ["2026-11-14", "2026-11-15", "2026-11-21", "2026-11-22"]);
    expect(dates).toHaveLength(15);
    const got = newVisitCoverage(rows("春日院", dates), SINCE, UNTIL);
    expect(got.stale).toBeNull();
    expect(got.startNotes).toEqual([
      {
        store: "春日院",
        startsOn: "2026-11-09",
        message: "11/9から集計（開店前の日は含まない）",
      },
    ]);
    expect(got.knownStores).toEqual(["春日院"]);
    expect(got.startNotes.every((n) => !n.message.includes("少なめ") && !n.message.includes("日数が足り"))).toBe(true);
  });

  it("期間より前からデータがある店の穴は、途中開始とも警告ともしない", () => {
    const inPeriod = ymds(SINCE, UNTIL, ["2026-10-29", "2026-10-30"]);
    const got = newVisitCoverage(
      [...rows("姪浜院", ["2026-10-01"]), ...rows("姪浜院", inPeriod)],
      SINCE,
      UNTIL,
    );
    expect(got).toEqual({ stale: null, startNotes: [], knownStores: ["姪浜院"] });
  });

  it("期間内の行が無くても、系列が最新日まで届いていれば来店0として確定する", () => {
    const got = newVisitCoverage(
      [...rows("姪浜院", ["2026-09-01", "2026-10-01"]), ...rows("堀江院", ymds(SINCE, UNTIL))],
      SINCE,
      UNTIL,
    );
    expect(got).toEqual({ stale: null, startNotes: [], knownStores: ["堀江院", "姪浜院"] });
  });

  it("期間より後に始まる系列は、この期間の注記にも0件にもしない", () => {
    const got = newVisitCoverage(
      [...rows("春日院", ["2026-12-01"]), ...rows("堀江院", ymds(SINCE, UNTIL))],
      SINCE,
      UNTIL,
    );
    expect(got).toEqual({ stale: null, startNotes: [], knownStores: ["堀江院"] });
  });

  it("同じ日の重複は系列の開始を早めない。そろっている店に注記は付かない", () => {
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
    expect(got.stale).toBeNull();
    expect(got.startNotes).toEqual([]);
    expect(got.knownStores).toEqual(["岡本院", "下伊福院", "堀江院2nd"]);
  });

  it("全体の最新日が選択期間の最終日より前のときだけ警告し、最新日を示す", () => {
    const latest = "2026-11-25";
    const got = newVisitCoverage(
      [
        ...rows("堀江院", ["2026-09-01", ...ymds(SINCE, latest, ["2026-11-10", "2026-11-11"])]),
        ...rows("姪浜院", ymds(SINCE, latest)),
      ],
      SINCE,
      UNTIL,
    );
    expect(got.stale).toEqual({
      latest: "2026-11-25",
      message: "新規来店：データは2026-11-25まで（選択期間の最終日より前）",
    });
    expect(got.startNotes).toEqual([]);
    expect(got.knownStores).toEqual(["堀江院", "姪浜院"]);
  });

  it("最新日が期間の最終日ちょうど、またはそれより後なら警告しない", () => {
    expect(newVisitCoverage(rows("堀江院", ["2026-09-01", UNTIL]), SINCE, UNTIL)).toEqual({
      stale: null,
      startNotes: [],
      knownStores: ["堀江院"],
    });
    expect(newVisitCoverage(rows("堀江院", ["2026-09-01", "2026-11-28"]), SINCE, UNTIL)).toEqual({
      stale: null,
      startNotes: [],
      knownStores: ["堀江院"],
    });
  });

  it("データが古いときも、途中開始の店は注記のままで店ごとの欠損警告にしない", () => {
    const got = newVisitCoverage(
      [
        ...rows("堀江院", ymds("2026-09-01", "2026-11-20")),
        ...rows("春日院", ymds("2026-11-09", "2026-11-20", ["2026-11-14"])),
      ],
      SINCE,
      UNTIL,
    );
    expect(got.stale).toEqual({
      latest: "2026-11-20",
      message: "新規来店：データは2026-11-20まで（選択期間の最終日より前）",
    });
    expect(got.startNotes).toEqual([
      {
        store: "春日院",
        startsOn: "2026-11-09",
        message: "11/9から集計（開店前の日は含まない）",
      },
    ]);
    expect(got.knownStores).toEqual(["春日院", "堀江院"]);
  });

  it("途中開始が複数なら開始日が早い店が先", () => {
    const got = newVisitCoverage(
      [
        ...rows("下伊福院", ["2026-11-20", UNTIL]),
        ...rows("春日院", ["2026-11-09", UNTIL]),
        ...rows("堀江院", ymds(SINCE, UNTIL)),
      ],
      SINCE,
      UNTIL,
    );
    expect(got.stale).toBeNull();
    expect(got.startNotes.map((n) => n.store)).toEqual(["春日院", "下伊福院"]);
    expect(got.startNotes[1].message).toBe("11/20から集計（開店前の日は含まない）");
    expect(got.knownStores).toEqual(["下伊福院", "春日院", "堀江院"]);
  });

  it("系列の初日が期間の初日なら途中開始ではない", () => {
    const got = newVisitCoverage(rows("堀江院", ymds(SINCE, UNTIL, ["2026-11-03"])), SINCE, UNTIL);
    expect(got).toEqual({ stale: null, startNotes: [], knownStores: ["堀江院"] });
  });

  it("最終日だけから始まる店は注記し、最新日が最終日なら警告しない", () => {
    const got = newVisitCoverage(
      [...rows("春日院", [UNTIL]), ...rows("堀江院", ymds(SINCE, UNTIL))],
      SINCE,
      UNTIL,
    );
    expect(got.stale).toBeNull();
    expect(got.startNotes).toEqual([
      {
        store: "春日院",
        startsOn: UNTIL,
        message: "11/27から集計（開店前の日は含まない）",
      },
    ]);
    expect(got.knownStores).toEqual(["春日院", "堀江院"]);
  });

  it("期間に入る行が無くても、最新日が最終日より前なら警告する", () => {
    const got = newVisitCoverage(rows("堀江院", ["2026-09-01"]), SINCE, UNTIL);
    expect(got.stale?.latest).toBe("2026-09-01");
    expect(got.stale?.message).toContain("2026-09-01");
    expect(got.startNotes).toEqual([]);
    expect(got.knownStores).toEqual([]);
  });

  it("店名と日付の空白は除く。壊れた行は無視する", () => {
    const got = newVisitCoverage(
      [
        { store: "  ", date: "2026-11-01" },
        { store: "堀江院", date: "11/01" },
        { store: " 春日院 ", date: " 2026-11-09 " },
        { store: "春日院", date: UNTIL },
      ],
      SINCE,
      UNTIL,
    );
    expect(got.stale).toBeNull();
    expect(got.startNotes).toEqual([
      {
        store: "春日院",
        startsOn: "2026-11-09",
        message: "11/9から集計（開店前の日は含まない）",
      },
    ]);
    expect(got.knownStores).toEqual(["春日院"]);
  });

  it("期間が逆・空データなら空", () => {
    expect(newVisitCoverage(rows("堀江院", ["2026-11-01"]), UNTIL, SINCE)).toEqual(NONE);
    expect(newVisitCoverage([], SINCE, UNTIL)).toEqual(NONE);
  });
});
