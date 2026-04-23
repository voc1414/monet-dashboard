# Spreadsheet vs DB Staff Diff Analysis

## Spreadsheet staff (29 unique, after store normalization → 27 valid, excluding test data)

After normalizing store names (大阪堀江院→堀江院, etc.) and excluding test entries (C, D, テスト):

| Name (raw) | Store (normalized) | Notes |
|---|---|---|
| Kaede | 堀江院 | ✅ matches DB |
| Mika | 堀江院 | 🆕 NEW - not in DB for 堀江院 |
| Aki | 堀江院2nd | ✅ matches DB |
| Hiromi | 堀江院2nd | ✅ matches DB |
| Kazumi | 堀江院2nd | ✅ matches DB |
| Mimi | 堀江院2nd | ✅ matches DB |
| sayuri  ホットペッパー | 堀江院2nd | ⚠️ needs normalization → "sayuri" |
| Hiroko | 福島院 | ✅ matches DB |
| Hitomi | 福島院 | ✅ matches DB |
| Kayo | 福島院 | 🆕 NEW - not in DB |
| Mika | 福島院 | ✅ matches DB |
| yoshie | 福島院 | ✅ matches DB |
| Yu | 福島院 | ✅ matches DB |
| Asuka | 高槻院 | ✅ matches DB |
| Mariko | 高槻院 | ✅ matches DB |
| Nao | 高槻院 | ✅ matches DB |
| Yuko | 高槻院 | ✅ matches DB |
| 井上　恵子 | 楽々園院 | ⚠️ IDEOGRAPHIC SPACE → DB has "井上 恵子" (half-width) |
| 前田慶子 | 楽々園院 | ✅ matches DB |
| 千葉祐子 | 楽々園院 | ✅ matches DB |
| 田中江梨子 | 楽々園院 | ⚠️ no space → DB has "田中 江梨子" (half-width space) |
| 石原葉子 | 楽々園院 | ✅ matches DB |
| 尾上みゆき | 姪浜院 | 🆕 NEW - not in DB |
| 山口純奈 | 姪浜院 | ✅ matches DB |
| 石橋　茜 | 姪浜院 | ⚠️ DB has "石橋 茉" - DIFFERENT PERSON/NAME |
| 金田あゆみ | 姪浜院 | ✅ matches DB |

## Issues to handle:

1. **Test data exclusion**: "C", "D", "テスト" (堀江院) should be excluded
2. **Name normalization needed**:
   - "sayuri  ホットペッパー" → "sayuri" (strip suffix after double space)
   - "井上　恵子" → normalize IDEOGRAPHIC SPACE to half-width space
   - "田中江梨子" → DB has "田中 江梨子" (with space) - need to match
   - "石橋　茜" → DB has "石橋 茉" - different kanji! This is a REAL name change
3. **New staff in spreadsheet not in DB**:
   - Kayo (福島院)
   - 尾上みゆき (姪浜院)
   - Mika (堀江院) - same name as Mika in 福島院
4. **Staff in DB but NOT in spreadsheet**:
   - 藤田 (姪浜院) - may have left or not submitted report
   - 石橋 茉 (姪浜院) - replaced by 石橋　茜

## Normalization strategy:
1. Normalize all spaces (full-width → half-width, collapse multiple)
2. Strip known suffixes like "ホットペッパー" etc.
3. For DB matching: use normalized name for lookup
4. For 石橋 茉 → 石橋 茜: This is a genuine name correction. The old DB record should be kept (won't match new name), new record will be created for 石橋 茜.
5. 藤田 won't appear in dynamic list (not in spreadsheet) but DB record persists.
