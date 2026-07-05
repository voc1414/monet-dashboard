import { describe, it, expect, beforeEach } from "vitest";
import {
  isNewStaff,
  buildStaffFirstAppearanceMap,
  setStaffFirstAppearanceMap,
} from "../client/src/lib/newBadge";

describe("buildStaffFirstAppearanceMap", () => {
  it("各スタッフの最も古いreportMonthを初登場月として検出する（データ最古月のスタッフは除外）", () => {
    const reports = [
      // データ最古月 = 2026-03
      { name: "田中太郎", storeNormalized: "堀江院", reportMonth: "2026-03" },
      { name: "田中太郎", storeNormalized: "堀江院", reportMonth: "2026-04" },
      { name: "田中太郎", storeNormalized: "堀江院", reportMonth: "2026-05" },
      { name: "佐藤花子", storeNormalized: "姪浜院", reportMonth: "2026-05" },
    ];

    const map = buildStaffFirstAppearanceMap(reports);

    // 田中太郎の初登場月は2026-03だが、データ最古月と一致するので除外される
    expect(map.has("田中太郎|堀江院")).toBe(false);
    // 佐藤花子の初登場月は2026-05（データ最古月より後）なので残る
    expect(map.get("佐藤花子|姪浜院")).toBe("2026-05");
  });

  it("スペースを含むスタッフ名を正規化して統一する", () => {
    const reports = [
      // データ最古月 = 2026-04
      { name: "山田次郎", storeNormalized: "堀江院", reportMonth: "2026-04" },
      { name: "藤原 牧子", storeNormalized: "堀江院", reportMonth: "2026-05" },
      { name: "藤原牧子", storeNormalized: "堀江院", reportMonth: "2026-06" },
    ];

    const map = buildStaffFirstAppearanceMap(reports);

    // 山田次郎はデータ最古月(2026-04)と一致するので除外
    expect(map.has("山田次郎|堀江院")).toBe(false);
    // 藤原牧子はスペース除去で正規化され、初登場月=2026-05
    expect(map.get("藤原牧子|堀江院")).toBe("2026-05");
  });

  it("同名スタッフでも異なる店舗は別エントリとして扱う", () => {
    const reports = [
      // データ最古月 = 2026-03
      { name: "YU", storeNormalized: "福島院", reportMonth: "2026-03" },
      { name: "YU", storeNormalized: "堀江院", reportMonth: "2026-05" },
    ];

    const map = buildStaffFirstAppearanceMap(reports);

    // YU@福島院はデータ最古月(2026-03)と一致するので除外
    expect(map.has("yu|福島院")).toBe(false);
    // YU@堀江院は2026-05からなので残る
    expect(map.get("yu|堀江院")).toBe("2026-05");
  });

  it("空の名前や店舗名はスキップする", () => {
    const reports = [
      { name: "", storeNormalized: "堀江院", reportMonth: "2026-04" },
      { name: "田中", storeNormalized: "", reportMonth: "2026-04" },
      { name: "田中", storeNormalized: "堀江院", reportMonth: "" },
    ];

    const map = buildStaffFirstAppearanceMap(reports);
    expect(map.size).toBe(0);
  });

  it("データ最古月のスタッフは除外される（既存スタッフがNEWにならない）", () => {
    const reports = [
      // データ最古月 = 2026-04（DATA_START_DATE以降の最古）
      { name: "既存スタッフA", storeNormalized: "堀江院", reportMonth: "2026-04" },
      { name: "既存スタッフA", storeNormalized: "堀江院", reportMonth: "2026-05" },
      { name: "既存スタッフB", storeNormalized: "姪浜院", reportMonth: "2026-04" },
      { name: "既存スタッフB", storeNormalized: "姪浜院", reportMonth: "2026-05" },
      { name: "新人スタッフC", storeNormalized: "堀江院", reportMonth: "2026-05" },
      { name: "新人スタッフC", storeNormalized: "堀江院", reportMonth: "2026-06" },
    ];

    const map = buildStaffFirstAppearanceMap(reports);

    // 既存スタッフAとBはデータ最古月(2026-04)から存在するので除外
    expect(map.has("既存スタッフa|堀江院")).toBe(false);
    expect(map.has("既存スタッフb|姪浜院")).toBe(false);
    // 新人スタッフCは2026-05からなので残る
    expect(map.get("新人スタッフc|堀江院")).toBe("2026-05");
  });
});

// 実行日からの相対月 "YYYY-MM"（テストが実行日付で期限切れにならないよう動的に計算）
function ymOffset(offset: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

describe("isNewStaff", () => {
  beforeEach(() => {
    // テスト前にマップをリセット
    setStaffFirstAppearanceMap(null);
  });

  it("マップが未設定の場合はfalseを返す", () => {
    expect(isNewStaff("田中太郎", "堀江院")).toBe(false);
  });

  it("マップが空の場合はfalseを返す", () => {
    setStaffFirstAppearanceMap(new Map());
    expect(isNewStaff("田中太郎", "堀江院")).toBe(false);
  });

  it("初登場月から3ヶ月以内のスタッフにNEWを付ける", () => {
    // 初登場月が2ヶ月前 → 初登場月を含めて3ヶ月間NEW → 今月が期限ちょうど＝NEW
    const map = new Map<string, string>();
    map.set("田中太郎|堀江院", ymOffset(-2));
    setStaffFirstAppearanceMap(map);

    expect(isNewStaff("田中太郎", "堀江院")).toBe(true);
  });

  it("初登場月から3ヶ月を超えたスタッフにはNEWを付けない", () => {
    // 初登場月が4ヶ月前 → NEW期間（初登場月＋2ヶ月）を過ぎている
    const map = new Map<string, string>();
    map.set("佐藤花子|姪浜院", ymOffset(-4));
    setStaffFirstAppearanceMap(map);

    expect(isNewStaff("佐藤花子", "姪浜院")).toBe(false);
  });

  it("マップに存在しないスタッフにはNEWを付けない", () => {
    const map = new Map<string, string>();
    map.set("田中太郎|堀江院", ymOffset(-1));
    setStaffFirstAppearanceMap(map);

    expect(isNewStaff("山田次郎", "堀江院")).toBe(false);
  });

  it("スタッフ名のスペースを正規化して判定する", () => {
    // マップには正規化済みキーが入っている
    const map = new Map<string, string>();
    map.set("藤原牧子|堀江院", ymOffset(-1));
    setStaffFirstAppearanceMap(map);

    // スペースありで呼んでも正規化されてマッチする
    expect(isNewStaff("藤原 牧子", "堀江院")).toBe(true);
    expect(isNewStaff("藤原牧子", "堀江院")).toBe(true);
  });

  it("大文字小文字を区別しない", () => {
    const map = new Map<string, string>();
    map.set("yu|福島院", ymOffset(-1));
    setStaffFirstAppearanceMap(map);

    expect(isNewStaff("YU", "福島院")).toBe(true);
    expect(isNewStaff("Yu", "福島院")).toBe(true);
    expect(isNewStaff("yu", "福島院")).toBe(true);
  });
});
