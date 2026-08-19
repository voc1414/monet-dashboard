import { describe, it, expect } from "vitest";
import {
  parseStylistFlatCsv,
  normalizeSalonBoardStore,
  stylistKey,
} from "@/hooks/useSalonBoardStylistData";
import { calculateUtilizationRate } from "@/lib/utilizationRate";

const HEADER = "店舗,スタイリスト,年月,売上,客数,客単価,指名数,新規,再来,技術売上,店販売上";

describe("useSalonBoardStylistData / parseStylistFlatCsv", () => {
  it("ヘッダ行をスキップし各列を正しくパースする（技術/店販含む）", () => {
    const csv = [
      HEADER,
      '"monet 白髪染めと髪質改善のサロン 堀江院【モネ】","Akiko",2026-06,540000,43,12558,19,22,21,520000,20000',
    ].join("\n");
    const rows = parseStylistFlatCsv(csv);
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.storeName).toBe("堀江院");
    expect(r.stylist).toBe("Akiko");
    expect(r.yearMonth).toBe("2026-06");
    expect(r.sales).toBe(540000);
    expect(r.customers).toBe(43);
    expect(r.unitPrice).toBe(12558);
    expect(r.nominate).toBe(19);
    expect(r.newCustomers).toBe(22);
    expect(r.returnCustomers).toBe(21);
    expect(r.techSales).toBe(520000);
    expect(r.retailSales).toBe(20000);
    expect(r.techSales + r.retailSales).toBe(r.sales);
  });

  it("年月のゼロ埋めゆれ「2026-6」を「2026-06」に正規化する（実データで混在・新規数欠落の原因）", () => {
    const csv = [
      HEADER,
      '"モネ-monet- 白髪染めと髪質改善のサロン 堀江院 2nd","Mimi",2026-6,100000,10,10000,1,5,5,90000,10000',
      '"モネ-monet- 白髪染めと髪質改善のサロン 堀江院 2nd","Mayu",2026/6,100000,10,10000,1,5,5,90000,10000',
    ].join("\n");
    const rows = parseStylistFlatCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].yearMonth).toBe("2026-06");
    expect(rows[1].yearMonth).toBe("2026-06");
    expect(rows[0].storeName).toBe("堀江院2nd");
  });

  it("技術/店販列が無い旧フォーマットでも0で安全にパースする", () => {
    const csv = [
      "店舗,スタイリスト,年月,売上,客数,客単価,指名数,新規,再来",
      '"高槻院","Nao",2026-06,168250,12,14021,3,6,6',
    ].join("\n");
    const r = parseStylistFlatCsv(csv)[0];
    expect(r.sales).toBe(168250);
    expect(r.techSales).toBe(0);
    expect(r.retailSales).toBe(0);
  });

  it("新規＋再来＝客数（A-1の集計が保たれる）", () => {
    const csv = [
      HEADER,
      '"monet 土橋院【モネ】","藤原 牧子",2026-06,492850,42,11735,4,28,14',
    ].join("\n");
    const r = parseStylistFlatCsv(csv)[0];
    expect(r.newCustomers + r.returnCustomers).toBe(r.customers);
  });

  it("年月のスラッシュ区切りをダッシュ区切りへ正規化する", () => {
    const csv = [HEADER, '"高槻院","Yuko",2026/06,590850,54,10942,18,18,36'].join("\n");
    expect(parseStylistFlatCsv(csv)[0].yearMonth).toBe("2026-06");
  });

  it("空行・列不足行・空セル行をスキップする", () => {
    const csv = [
      HEADER,
      "",
      '"福島院","Yu",2026-06,480500', // 列不足
      '"","",2026-06,0,0,0,0,0,0', // 店舗・担当が空
      '"福島院","Yu",2026-06,480500,40,12013,29,12,28',
    ].join("\n");
    const rows = parseStylistFlatCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].stylist).toBe("Yu");
  });
});

describe("normalizeSalonBoardStore（店舗名の名寄せ）", () => {
  it("「堀江院 2nd」を「堀江院」より先に判定する", () => {
    expect(normalizeSalonBoardStore("monet ... 堀江院 2nd【モネ】")).toBe("堀江院2nd");
    expect(normalizeSalonBoardStore("monet ... 堀江院【モネ】")).toBe("堀江院");
  });
  it("福岡姪浜院→姪浜院、広島楽々園院→楽々園院に寄せる", () => {
    expect(normalizeSalonBoardStore("monet 福岡姪浜院【モネ】")).toBe("姪浜院");
    expect(normalizeSalonBoardStore("monet 広島楽々園院【モネ】")).toBe("楽々園院");
  });
  it("土橋院・福島院・高槻院はそのトークンを返す", () => {
    expect(normalizeSalonBoardStore("monet 土橋院【モネ】")).toBe("土橋院");
    expect(normalizeSalonBoardStore("monet 福島院【モネ】")).toBe("福島院");
    expect(normalizeSalonBoardStore("monet 高槻院【モネ】")).toBe("高槻院");
  });
});

describe("stylistKey（スタイリスト名の名寄せキー）", () => {
  it("スペースの有無を吸収する（月末報告書=スペース無し／サロンボード=スペース有り）", () => {
    expect(stylistKey("山口 純奈")).toBe(stylistKey("山口純奈"));
    expect(stylistKey("尾上　みゆき")).toBe(stylistKey("尾上みゆき")); // 全角スペース
  });
  it("大文字小文字を吸収する", () => {
    expect(stylistKey("Akiko")).toBe(stylistKey("akiko"));
  });
});

describe("稼働率の実客数切替（サロンボード優先・無ければ月末報告書）", () => {
  // 消費側ロジックを再現: サロンボード客数があればそれを稼働率の分子に使う
  function pickCustomers(salonBoard: number | null, report: number): number {
    return salonBoard != null ? salonBoard : report;
  }
  it("サロンボード客数があれば稼働率はサロンボード値で計算される", () => {
    const reportCustomers = 30;
    const salonBoardCustomers = 42;
    const empType = "フルタイム社員"; // 最大66
    const rate = calculateUtilizationRate(
      pickCustomers(salonBoardCustomers, reportCustomers),
      empType
    );
    // 42/66*100 = 63.6（30/66=45.5 ではない）
    expect(rate).toBe(63.6);
  });
  it("サロンボード客数が無ければ月末報告書客数で計算される", () => {
    const rate = calculateUtilizationRate(pickCustomers(null, 30), "フルタイム社員");
    expect(rate).toBe(45.5);
  });
});

describe("stylistKey / 名寄せ2層をまたぐ突合（2026-08-19 修正）", () => {
  // 月末報告書側の氏名とサロンボード側の担当名が別表記でも、同じキーに落ちること。
  // 落ちないと「サロンボードに実績が無い」と判定され、売上が ¥0 表示になる。
  it("石原さん: 報告書『石原葉子』とサロンボード『石原 ようこ』が一致する", () => {
    expect(stylistKey("石原葉子")).toBe(stylistKey("石原 ようこ"));
  });

  it("坂手さん: 報告書『坂手芳』とサロンボード『坂手』が一致する", () => {
    // 名寄せ2層で正準名が食い違っていた（ファンくる層=坂手 / 報告書層=坂手芳）
    expect(stylistKey("坂手芳")).toBe(stylistKey("坂手"));
  });

  it("小池さん: 報告書『小池明子』とサロンボード『Akiko』が一致する", () => {
    expect(stylistKey("小池明子")).toBe(stylistKey("Akiko"));
  });

  it("スペース種別の違い（半角/全角）を吸収する", () => {
    expect(stylistKey("井上　恵子")).toBe(stylistKey("井上 恵子"));
    expect(stylistKey("石橋　茜")).toBe(stylistKey("石橋 茜"));
  });

  it("別人を同一視しない", () => {
    expect(stylistKey("石原葉子")).not.toBe(stylistKey("井上 恵子"));
    expect(stylistKey("坂手芳")).not.toBe(stylistKey("小池明子"));
  });
});
