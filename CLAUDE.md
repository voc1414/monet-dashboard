# monet-dashboard — Claude Code 開発ガイド

monet（白髪染め・髪質改善サロン・全7店舗）の経営ダッシュボード。
FC共有前提でログイン不要の公開閲覧（管理ページ `/admin` のみ要ログイン）。
本番: https://monet-dashboard-production.up.railway.app/

**コード実装・ビルド・テスト・デプロイ・git は Claude Code 側で完結**させる。ブラウザ操作/CAPTCHA/Notion/SyncWith・GAS等の外部SaaS管理画面は Cowork（はやしん）側の担当。

> 最終更新: 2026-07-09（push解決・タスク①〜④/⑦-a完了・名前マッピング仕組み化まで反映）

---
## 1. ビルド / テスト / デプロイ / git
- 依存: `npm install --legacy-peer-deps`（**legacy-peer-deps必須**。vite7 と @builder.io/vite-plugin-jsx-loc の peer 衝突のため）
- 型チェック: `npx tsc --noEmit`（デプロイ前に必ず通す）
- テスト: `npx vitest run`（server/ に *.test.ts。全緑を維持。**「現在月」前提の月ハードコードテストは禁止**＝時限爆弾になる。newBadge.test の ymOffset 方式を踏襲）
- デプロイ: `npx --yes @railway/cli up --detach --service monet-dashboard`（プロジェクト 63c9060f…）
  - ビルドは `nixpacks.toml` で `npm ci --legacy-peer-deps` に固定済み。**pnpm/yarn のロックファイルを置かないこと**（過去にビルダーがpnpmを誤検知してビルド失敗）
  - env: JWT_SECRET / CRON_SECRET / ADMIN_USERNAME(commit.1414@gmail.com) / ADMIN_PASSWORD(林設定) / NODE_ENV / DATABASE_URL=${{MySQL.MYSQL_URL}}。Node22。preDeployで drizzle-kit migrate
- git: **push可**（2026-08-29 HTTPS化。remote `https://github.com/voc1414/monet-dashboard.git`、認証は `gh`＝GitHub CLI の credential helper）。**旧SSH鍵 `~/.ssh/id_ed25519` は GitHub 側で失効済み**（提示はされるが拒否される）ため SSH は使えない。関心事ごとにコミットし、デプロイ前に push する。CI（GitHub Actions）が push ごとに tsc+vitest を自動実行
- Drive同期で node_modules / package-lock.json が壊れることがある → `rm -rf node_modules package-lock.json && npm install --legacy-peer-deps` で復旧

## 2. データソース（すべて gviz 匿名CSV読み・集計値のみPIIなし）
- 正本スプシ「サロンボード売上」= `1nR36MMsbtAT8f2ccYLBTZjZ4ESin9odmgWN2xP3oVSE`。タブ:
  - `stylist_flat`（店舗×スタイリスト×月）… スタッフ実績の正本
  - `store_official`（サロンボード公式の店舗別月次集計）… **店舗カード売上の正本**（月末報告書へはフォールバックしない＝林指示 2026-07-06）
  - `store_newsales`（店舗×月：新規売上）… ROASの分子
  - `daily_new`（店舗×日付）、`counseling`
  - salonboard-scraper（../salonboard-scraper、Mac mini常駐 launchd 毎朝7:30）が生成→Drive→GAS（1nR36にbound、refreshAll=毎朝8:54、refreshStoreExtras=毎時）
- 広告正本スプシ「monet Meta広告」= `1z5JU-Onf6wiqydFUeYYoQ0czXByyZbqH4JODWkYh6Ts`（シート monet / lmessage / adset_meta）。**SyncWith が Meta から同期**（管理はCowork側）。集客/求人はキャンペーン名の接頭辞で判定。/ads ヘッダにデータ最新日付を表示し、3日以上遅れると赤警告が出る
- 月末報告書スプシ = `1DXAaFk0aLDZwXq28krOcrDSiTOwd6BeTzV-xFXbLuKI`（スタッフ自己申告。**次回予約率はここ由来**）
- NPSスプシ = `1xSm2poTIeRPFviVmINdWNWmLT5d9pXXL2XzWEQsxiRU`（タブ「全店舗」。スタッフ選択肢はHPB掲載名連動）
- ファンくるスプシ = `1bbQT7eBb2Om1ODgsL_g0dx_bcw55j3RHRRJGr7xSwsg`（担当者名はお客様申告＝表記ゆれ前提）

## 3. スタッフ名・店舗名の名寄せ（重要）
**新人・表記ゆれは管理画面で解決する運用が確立済み（2026-07-09）。コード修正は原則不要。**
- 未マッチのスタッフ名が出ると: ①アンケート一覧(/surveys)に警告バナー ②管理ページ→アンケート情報→名前マッピングタブの検出パネルに、**読み仮名ベースの候補つき**で一覧表示 → 管理者が[登録]を押すだけで NPS・ファンくる両方に反映
- 実装: DB `stylist_aliases`（正本） > コード内蔵表。照合キー=空白除去＋小文字化
  - NPS照合: `client/src/lib/staffNameAlias.ts`（normalizeStaffKey。内蔵表: akiko→小池明子, 石原ようこ→石原葉子）
  - ファンくる照合: `useFankuruData.ts` の `matchesStylist`＋`STYLIST_NAME_ALIASES`
  - 候補推定: `server/nameSuggest.ts`（kuromoji読み推定。tRPC admin.suggestStaffMatches。誤マッチ防止のため自動確定はしない）
- 店舗名の突合:
  - 広告「堀江2nd院」↔サロンボード「堀江院2nd」は `canonicalStore`（Ads.tsx、"院"・空白除去）
  - 月末報告書「広島土橋院」等の接頭辞付き→短縮名は `useMonthlyReport.ts` の `STORE_NAME_MAP_FALLBACK`（**新店追加時はここ＋useFankuruData/useNpsDataのfallbackにも追加**。DB storesのaliases列は現状短縮名のみ）
  - NPSサロン名判定 `parseStoreName` は**長いエイリアス優先＋空白除去**（「堀江院 2nd」が堀江院に誤配賦されるバグを2026-07-06修正済み。同型バグに注意）
- 退職者（堀江院2nd AKI・姪浜院 藤田）は名簿外のため未紐付けが正常

### 3.1 退社スタッフの正本は Notion（2026-08-19〜）
**退社・在籍を直すときはコードを触らず Notion を編集する。**
- 正本: Notion「全スタッフ一覧」DB https://app.notion.com/p/2dfab44d3cb98031a890e8de4ed0d1ff
  （「スタッフ管理」ページ配下。列＝サロンボード表示名／退職月(YYYY-MM)／ダッシュボード対象）
- 反映: `npm run sync:staff`（`NOTION_TOKEN` 必須）→ `client/src/data/staffMaster.ts` を再生成 → commit & push
- `newBadge.ts` の `RETIRED_STAFF` はこのマスタから組み立てる。**手で書き足さない**（次の同期で消える）
- 未接続だと Notion API が 404 を返す。Notion 側で対象DBをインテグレーションに接続すること（1回だけ）
- **照合は必ず「店舗＋表示名」の組**。表示名はローマ字が多く `Akiko` `Mika` `Yu` `Nao` `Mayu`
  `Minaho` `Yukiko` が複数店舗に別人として存在する。名前だけで引くと別人を巻き込む
- 退社月が不明なときは `stylist_flat` の最終稼働月から復元できる（実績が途切れた月＝退社月）
- 名簿に居ない人（例: 佐々木 淳）は `newBadge.ts` の `EXCLUDED_STAFF` で常時除外。
  人事DBに非従業員を登録しないための逃がし先で、店舗・月・DB連携に関係なく効く
- 履歴書・労働契約書・雇用形態は人事の正本。**同期対象に含めない**（取得するのは
  名前・表示名・店舗・在籍状態・退職月 の5項目のみ。本リポジトリは public）

### 3.2 店舗マスタの正本も Notion（2026-08-20〜）
**店舗を増やす・エリアを直すときはコードを触らず Notion を編集する。**
- 正本: Notion「DB_monet店舗一覧」 https://app.notion.com/p/354ab44d3cb98068ad2ac3a3aa2e2af2
  （列＝名前／エリア／**開店日**／住所／電話／HPB URL／LP URL 等）
- 反映: `npm run sync:stores`（`NOTION_TOKEN` 必須）→ `client/src/data/storeMaster.ts` を再生成 → commit & push
- `useStores.ts` の店舗一覧はこのマスタから組み立てる。**手で書き足さない**
- **開店日が未定(null)の店は「営業中の一覧」に出ない。** 開店日を Notion に入れれば、
  その日から自動で店舗一覧・スタッフ一覧に並ぶ（開店のたびにコードを直す必要はない）
- 店舗名は Notion の表記に合わせる（岡山エリアは「下伊福院」。「岡山下伊福院」ではない）
- 広告(/ads)は開店前の店も数字が出るので、`useAdsData.ts` の `SINGLE_STORE_AREA` と
  `Ads.tsx` の `HPB_START_MONTH` にも新店を足す（1エリア1店舗のときだけ店舗を特定できる）

## 4. 主要ファイル
- `client/src/pages/Ads.tsx` … /ads。列順=1日予算→消化額→HPB費用→LINE登録→LINE単価→リード→新規数→CPA→ROAS→CPL→CTR→CPC→フリーク。**HPB費用=全店一律月額¥55,000×選択期間の月数（HPB_MONTHLY_FEE）。CPA=(集客広告費+HPB)÷新規来店、ROAS=新規売上÷(集客広告費+HPB)。CPLは広告費のみ**。求人はHPB/CPA/ROAS対象外。データ鮮度警告つき
- `client/src/hooks/useSalonBoardData.ts` … 店舗カード値（store_official優先）
- `client/src/hooks/useAdsData.ts` / `useStoreNewSales.ts` / `useSalonBoardDailyNew.ts` … 広告・新規売上・日次新規
- `client/src/hooks/useMonthlyReport.ts` … 月末報告書（次回予約率の由来）
- `client/src/pages/Home.tsx` … 店舗一覧（月間表彰は2026-07-05廃止済み）
- `client/src/pages/StoreDetail.tsx` … 店舗詳細（売上=サロンボードのみ。**店舗内月間表彰が残存＝廃止判断は林さん待ち**）
- `client/src/pages/admin/AdminSurveys.tsx` … 名前マッピング管理（未マッチ検出＋候補承認パネル）
- `client/src/hooks/useStores.ts` / `server/routers/stores.ts` … 店舗マスタ（DB＋fallback）。新店は scheduledNewStore が自動検知

## 5. 未解決 / 継続事項
- **⑦-b 失敗通知の恒久化**: notifyOwner は no-op のまま。Cowork側 scheduled task `salonboard-freshness-check`（毎朝10:03）＋/adsの鮮度警告で部分カバー。メール/LINE通知の復活は未着手
- **データ入力異常（林さん確認中 2026-07-09）**: 次回予約数>客数（堀江院2nd Minaho 6月 58/12、土橋院 藤原牧子 6月 89/58）→ 既存validationがアラート表示中。訂正はデータ側
- **NPS 0件の在籍スタッフ**: 小池明子・石原葉子はシートに回答自体が未着（エイリアスは登録済みなので回答が来れば自動紐付け）。回答ゼロが続くならフォーム→シート連携をCowork側で確認
- 旧 fine-grained PAT（7/24期限）は不要になった。GitHub側で削除推奨

## 6. 注意 / ハマりどころ
- **gviz は新規タブのインデックス反映が遅れる**。GAS側は出力フォルダID直接指定＋グローバルfallbackで解決済（refreshStoreExtras参照）
- **サロンボードのスクレイプはCAPTCHA/ログインで人手が要る**（セッション切れ時はCowork/人手）
- **Cowork担当（Claude Code対象外）**: Notion司令塔、サロンボード/HPB/SyncWithのブラウザ操作、本番の目視確認
- このフォルダは**Cowork側セッションと並行作業になることがある**。コミット前に `git status` で自分が触っていないファイルの変更が混ざっていないか確認し、混ざっていたら関心事を分けてコミットする
- 経緯の詳細: Cowork側メモリ `project_monet_salonboard_truth_source` 等と GrandFusion法人司令塔(Notion)
