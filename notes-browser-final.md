# Browser Check: Admin Staff Page - Complete List

Stats: 26 active, 2 retired, 6 stores

## Stores and Staff:

楽々園院 (5名): 井上 恵子, 石原葉子, 千葉祐子, 前田慶子, 田中江梨子
高槻院 (4名): Asuka NEW, Mariko NEW, Nao, Yuko
福島院 (5名): Hiroko NEW, Kayo NEW, Mika NEW, yoshie NEW, Yu
堀江院 (2名): Kaede, Mika
堀江院2nd (4名): Aki NEW, Hiromi NEW, Mimi NEW, sayuri
姪浜院 (6名): 金田あゆみ, 山口純奈, 石橋 茜, 尾上みゆき, 石橋 茉, 藤田

## Issues noticed:
- 姪浜院 has both 石橋 茜 (from spreadsheet) AND 石橋 茉 (from DB only) - this is correct behavior
  since 石橋 茉 is in DB but not in spreadsheet, and 石橋 茜 is new from spreadsheet
- 藤田 appears (from DB only, not in current spreadsheet) - correct
- sayuri correctly normalized (stripped "ホットペッパー" suffix)
- 田中江梨子 correctly matched to DB "田中 江梨子" via normalized matching
- NEW badges appear on staff that don't have DB records yet
- All 退社 buttons functional
