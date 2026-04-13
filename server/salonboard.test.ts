/**
 * サロンボードデータのCSVパース処理テスト
 * 
 * useSalonBoardData.tsのパース関数をテストする。
 * フック自体はReact依存のため、パース処理のロジックを抽出してテストする。
 */
import { describe, expect, it } from "vitest";

// CSVパーサー（useSalonBoardData.tsと同じロジック）
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
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else if (ch === "\r") {
        // skip
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

function parseNum(val: string): number {
  if (!val) return 0;
  const cleaned = val.replace(/[￥,\s"]/g, "").trim();
  if (!cleaned) return 0;
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function normalizeYearMonth(raw: string): string {
  const trimmed = raw.trim().replace(/"/g, "");
  if (!trimmed || trimmed === "") return "";
  return trimmed.replace("/", "-");
}

// 列インデックス定義
const COL = {
  YEAR_MONTH: 0,
  NET_SALES: 1,
  TECH_SALES: 2,
  RETAIL_SALES: 3,
  OPTION_SALES: 4,
  TOTAL_SALES: 5,
  DISCOUNT: 6,
  UNIT_PRICE: 7,
  TOTAL_CUSTOMERS: 8,
  NEW_CUSTOMERS: 9,
  RETURN_CUSTOMERS: 10,
} as const;

interface SalonBoardMonthlyData {
  storeName: string;
  yearMonth: string;
  totalSales: number;
  techSales: number;
  retailSales: number;
  unitPrice: number;
  totalCustomers: number;
  newCustomers: number;
  returnCustomers: number;
}

function parseCSVToStoreData(csvText: string, storeName: string): SalonBoardMonthlyData[] {
  const lines = csvText.split("\n").filter(l => l.trim());
  const dataLines = lines.slice(1); // ヘッダースキップ
  const storeData: SalonBoardMonthlyData[] = [];

  for (const line of dataLines) {
    const cols = parseCSVLine(line);
    if (cols.length < 11) continue;

    const rawYearMonth = cols[COL.YEAR_MONTH]?.trim().replace(/"/g, "");
    if (!rawYearMonth || rawYearMonth === "") continue;

    const yearMonth = normalizeYearMonth(rawYearMonth);
    if (!yearMonth) continue;

    const totalSales = parseNum(cols[COL.TOTAL_SALES]);
    const totalCustomers = parseNum(cols[COL.TOTAL_CUSTOMERS]);

    if (totalSales === 0 && totalCustomers === 0) continue;

    storeData.push({
      storeName,
      yearMonth,
      totalSales,
      techSales: parseNum(cols[COL.TECH_SALES]),
      retailSales: parseNum(cols[COL.RETAIL_SALES]),
      unitPrice: parseNum(cols[COL.UNIT_PRICE]),
      totalCustomers,
      newCustomers: parseNum(cols[COL.NEW_CUSTOMERS]),
      returnCustomers: parseNum(cols[COL.RETURN_CUSTOMERS]),
    });
  }

  return storeData;
}

describe("parseCSVLine", () => {
  it("parses a simple CSV line", () => {
    const result = parseCSVLine("a,b,c");
    expect(result).toEqual(["a", "b", "c"]);
  });

  it("handles quoted fields with commas", () => {
    const result = parseCSVLine('"hello, world",b,c');
    expect(result).toEqual(["hello, world", "b", "c"]);
  });

  it("handles double quotes inside quoted fields", () => {
    const result = parseCSVLine('"say ""hello""",b');
    expect(result).toEqual(['say "hello"', "b"]);
  });

  it("handles empty fields", () => {
    const result = parseCSVLine("a,,c");
    expect(result).toEqual(["a", "", "c"]);
  });

  it("strips carriage returns", () => {
    const result = parseCSVLine("a,b,c\r");
    expect(result).toEqual(["a", "b", "c"]);
  });
});

describe("parseNum", () => {
  it("parses a plain number", () => {
    expect(parseNum("1234")).toBe(1234);
  });

  it("parses a number with commas", () => {
    expect(parseNum("1,234,567")).toBe(1234567);
  });

  it("parses a number with yen sign", () => {
    expect(parseNum("￥1,234")).toBe(1234);
  });

  it("returns 0 for empty string", () => {
    expect(parseNum("")).toBe(0);
  });

  it("returns 0 for non-numeric string", () => {
    expect(parseNum("abc")).toBe(0);
  });

  it("handles quoted numbers", () => {
    expect(parseNum('"1,916,950"')).toBe(1916950);
  });
});

describe("normalizeYearMonth", () => {
  it("converts slash to dash", () => {
    expect(normalizeYearMonth("2025/03")).toBe("2025-03");
  });

  it("handles quoted values", () => {
    expect(normalizeYearMonth('"2025/03"')).toBe("2025-03");
  });

  it("returns empty for empty input", () => {
    expect(normalizeYearMonth("")).toBe("");
  });

  it("handles whitespace", () => {
    expect(normalizeYearMonth("  2025/03  ")).toBe("2025-03");
  });
});

describe("parseCSVToStoreData", () => {
  const sampleCSV = `"日付","純売上","技術","店販","オプション","総売上","割引","客単価","総客数","新規","再来"
"2025/03","1,800,000","1,700,000","80,000","20,000","1,900,000","-100,000","14,000","130","30","100"
"2025/04","2,000,000","1,900,000","90,000","10,000","2,100,000","-50,000","15,000","140","35","105"`;

  it("parses CSV into store data correctly", () => {
    const result = parseCSVToStoreData(sampleCSV, "姪浜院");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      storeName: "姪浜院",
      yearMonth: "2025-03",
      totalSales: 1900000,
      techSales: 1700000,
      retailSales: 80000,
      unitPrice: 14000,
      totalCustomers: 130,
      newCustomers: 30,
      returnCustomers: 100,
    });
  });

  it("skips header row", () => {
    const result = parseCSVToStoreData(sampleCSV, "姪浜院");
    expect(result.every(d => d.yearMonth !== "日付")).toBe(true);
  });

  it("skips rows with zero sales and zero customers", () => {
    const csvWithEmpty = `"日付","純売上","技術","店販","オプション","総売上","割引","客単価","総客数","新規","再来"
"2025/03","0","0","0","0","0","0","0","0","0","0"
"2025/04","2,000,000","1,900,000","90,000","10,000","2,100,000","-50,000","15,000","140","35","105"`;
    const result = parseCSVToStoreData(csvWithEmpty, "堀江院");
    expect(result).toHaveLength(1);
    expect(result[0].yearMonth).toBe("2025-04");
  });

  it("skips rows with empty year-month (total rows)", () => {
    const csvWithTotal = `"日付","純売上","技術","店販","オプション","総売上","割引","客単価","総客数","新規","再来"
"2025/03","1,800,000","1,700,000","80,000","20,000","1,900,000","-100,000","14,000","130","30","100"
"","10,000,000","9,000,000","500,000","100,000","10,500,000","-500,000","14,000","750","200","550"`;
    const result = parseCSVToStoreData(csvWithTotal, "堀江院");
    expect(result).toHaveLength(1);
    expect(result[0].yearMonth).toBe("2025-03");
  });

  it("returns empty array for empty CSV", () => {
    const result = parseCSVToStoreData("", "堀江院");
    expect(result).toHaveLength(0);
  });

  it("returns empty array for header-only CSV", () => {
    const headerOnly = `"日付","純売上","技術","店販","オプション","総売上","割引","客単価","総客数","新規","再来"`;
    const result = parseCSVToStoreData(headerOnly, "堀江院");
    expect(result).toHaveLength(0);
  });

  it("handles real-world data format with actual values", () => {
    const realCSV = `"日付","純売上","技術","店販","オプション","総売上","割引","客単価","総客数","新規","再来"
"2026/03","1,878,150","1,861,100","38,800","0","1,916,950","-38,800","14,110","132","35","97"`;
    const result = parseCSVToStoreData(realCSV, "姪浜院");
    expect(result).toHaveLength(1);
    expect(result[0].totalSales).toBe(1916950);
    expect(result[0].techSales).toBe(1861100);
    expect(result[0].retailSales).toBe(38800);
    expect(result[0].unitPrice).toBe(14110);
    expect(result[0].totalCustomers).toBe(132);
    expect(result[0].newCustomers).toBe(35);
    expect(result[0].returnCustomers).toBe(97);
  });
});

describe("store data lookup helpers", () => {
  const testData: SalonBoardMonthlyData[] = [
    { storeName: "姪浜院", yearMonth: "2026-03", totalSales: 1916950, techSales: 1861100, retailSales: 38800, unitPrice: 14110, totalCustomers: 132, newCustomers: 35, returnCustomers: 97 },
    { storeName: "堀江院2nd", yearMonth: "2026-03", totalSales: 1550900, techSales: 1500000, retailSales: 50900, unitPrice: 14026, totalCustomers: 110, newCustomers: 40, returnCustomers: 70 },
    { storeName: "姪浜院", yearMonth: "2026-02", totalSales: 1800000, techSales: 1700000, retailSales: 80000, unitPrice: 13500, totalCustomers: 120, newCustomers: 30, returnCustomers: 90 },
  ];

  it("finds store data for specific month", () => {
    const found = testData.find(d => d.storeName === "姪浜院" && d.yearMonth === "2026-03");
    expect(found).toBeDefined();
    expect(found!.totalSales).toBe(1916950);
  });

  it("returns undefined for non-existent store", () => {
    const found = testData.find(d => d.storeName === "楽々園院" && d.yearMonth === "2026-03");
    expect(found).toBeUndefined();
  });

  it("returns undefined for non-existent month", () => {
    const found = testData.find(d => d.storeName === "姪浜院" && d.yearMonth === "2026-01");
    expect(found).toBeUndefined();
  });

  it("checks if data exists for store and month", () => {
    const hasData = testData.some(d => d.storeName === "姪浜院" && d.yearMonth === "2026-03");
    expect(hasData).toBe(true);
  });

  it("checks if data does not exist for store and month", () => {
    const hasData = testData.some(d => d.storeName === "堀江院" && d.yearMonth === "2026-03");
    expect(hasData).toBe(false);
  });

  it("gets available months from data", () => {
    const months = [...new Set(testData.map(d => d.yearMonth))].sort().reverse();
    expect(months).toEqual(["2026-03", "2026-02"]);
  });

  it("gets all months for a specific store", () => {
    const storeData = testData.filter(d => d.storeName === "姪浜院").sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
    expect(storeData).toHaveLength(2);
    expect(storeData[0].yearMonth).toBe("2026-02");
    expect(storeData[1].yearMonth).toBe("2026-03");
  });
});
