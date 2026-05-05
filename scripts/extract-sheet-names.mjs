/**
 * サロンボードスプレッドシートからシート名一覧を取得する
 * htmlviewのレスポンスからシート名を正規表現で抽出
 */

const SPREADSHEET_ID = "1pYQcY42rUS3ftfIkZxffCsy7zfW2hW7U_zxtXf5A5bI";

async function getSheetNames() {
  // Method 1: htmlview から抽出
  const htmlUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/htmlview`;
  const res = await fetch(htmlUrl);
  const html = await res.text();
  
  // シート名はJavaScript内にUnicodeエスケープで含まれている
  // パターン: "monet堀江_月別" のような文字列
  // htmlview内では直接UTF-8で含まれている場合もある
  
  console.log("=== HTML response length:", html.length);
  
  // 「_月別」を含む文字列を探す
  const monthlyPattern = /[^\s"',;{}()\[\]]{2,30}_\u6708\u5225/g;
  const monthlyMatches = html.match(monthlyPattern) || [];
  console.log("\n=== _月別 pattern matches:", monthlyMatches);
  
  // 「monet」を含む文字列を探す
  const monetPattern = /monet[^\s"',;{}()\[\]]{1,30}/g;
  const monetMatches = html.match(monetPattern) || [];
  console.log("\n=== monet pattern matches:", [...new Set(monetMatches)]);
  
  // Method 2: export?format=csv でシート名を推測（既知のパターンで試す）
  const candidateSheets = [
    "monet堀江_月別",
    "monet広島_月別", 
    "monet福岡姪浜院_月別",
    "monet堀江ﾆ号店_月別",
    "monet高槻_月別",
    "monet福島院_月別",
    // 新店舗候補
    "monet土橋_月別",
    "monet広島土橋_月別",
    "monet広島土橋院_月別",
  ];
  
  console.log("\n=== Testing candidate sheet names...");
  for (const sheet of candidateSheets) {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`;
    try {
      const csvRes = await fetch(csvUrl);
      const csvText = await csvRes.text();
      const firstLine = csvText.split("\n")[0] || "";
      const exists = !firstLine.includes("店舗情報の追加") && csvText.length > 100;
      console.log(`  ${sheet}: ${exists ? "✓ EXISTS" : "✗ NOT FOUND"} (${csvText.length} bytes, first: ${firstLine.substring(0, 50)})`);
    } catch (e) {
      console.log(`  ${sheet}: ERROR - ${e.message}`);
    }
  }
}

getSheetNames().catch(console.error);
