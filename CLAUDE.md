# monet-dashboard — Claude Code 引き継ぎ / 開発ガイド

このリポジトリは monet（白髪染め・髪質改善サロン・全7店舗）の経営ダッシュボード。
FC共有前提でログイン不要の公開閲覧（管理ページ `/admin` のみ要ログイン）。
本番: https://monet-dashboard-production.up.railway.app/

このファイルは Cowork（はやしん）→ Claude Code への引き継ぎ。**コード実装・ビルド・テスト・デプロイ・git は Claude Code 側で完結**させる。ブラウザ操作/CAPTCHA/Notion は Cowork 側の担当。

---
## 0. 最優先（前提）
- **GitHub push の 403 を解決する**。remote は `origin https://github.com/voc1414/monet-dashboard.git`。現状 push が 403（書込権限不足）で、デプロイは `railway up`（CLIローカル直アップロード）運用＝**git履歴が残っていない**。まず push 権限（PAT/権限）を通し、現状の作業ツリーをcommit/pushしてから作業を始める。これがClaude Code運用（差分管理・安全なコミット）の前提。

## 1. ビルド / テスト / デプロイ
- 開発: `npm install`（初回。Drive上のnode_modulesは不完全な場合あり→ローカルで入れ直す）
- 型チェック: `npx tsc --noEmit`（**デプロイ前に必ず通す**。Cowork側はsandboxにtscが無く検証できなかった＝ここがClaude Codeの主眼）
- テスト: `npx vitest run`（server/ に *.test.ts 多数。既存全緑を維持）
- デプロイ: `npx --yes @railway/cli up --detach --service monet-dashboard`（この1コマンド。プロジェクト 63c9060f…、サービス monet-dashboard）
  - env: JWT_SECRET / CRON_SECRET / ADMIN_USERNAME(commit.1414@gmail.com) / ADMIN_PASSWORD(林設定) / NODE_ENV / DATABASE_URL=${{MySQL.MYSQL_URL}}。Node22。preDeployで drizzle-kit migrate。

## 2. データソース（すべて gviz 匿名CSV読み・集計値のみPIIなし）
- 正本スプシ「サロンボード売上」= `1nR36MMsbtAT8f2ccYLBTZjZ4ESin9odmgWN2xP3oVSE`。タブ:
  - `stylist_flat`（店舗×スタイリスト×月：売上/客数/新規/再来/技術/店販）… スタッフ実績の正本
  - `store_official`（**サロンボード公式の店舗別月次集計**：純売上/技術/店販/オプション/総売上/割引/客単価/総客数/新規/再来）… **店舗カードの正本（A方針）**
  - `store_newsales`（店舗×月：新規売上/新規客数）… ROASの分子（新規客の売上）
  - `daily_new`（店舗×日付：新規/再来/客数）、`counseling`
  - これらは salonboard-scraper（別フォルダ）が毎朝生成→Drive→GASで各タブ化。GASは1nR36にbound（project id `1v5a2dS-WQMx3ZoYx2Cobnafc2vIdn4AcRep70Vui3CKEQsS8R79iaB2d`、関数 refreshAll＝毎朝8:54トリガー、refreshStoreExtras＝毎時トリガーで store_official/store_newsales を再生成）。GASはブラウザ編集した経緯があるが、**今後は clasp で管理推奨**。
- 広告正本スプシ「monet Meta広告」= `1z5JU-Onf6wiqydFUeYYoQ0czXByyZbqH4JODWkYh6Ts`。シート monet（日付×広告セット：店舗/キャンペーン名/消化額/リード/…）/ lmessage / adset_meta。集客/求人は**キャンペーン名の接頭辞**（"集客"/"求人"）で判定。

## 3. 主要ファイル
- `client/src/hooks/useSalonBoardData.ts` … 店舗カードの値。**store_official を gviz 優先で読む**（`parseStoreOfficialCsv`）。無ければ stylist_flat 合算にフォールバック。店舗名は `normalizeSalonBoardStore`（useSalonBoardStylistData）で正規化。
- `client/src/hooks/useAdsData.ts` … 広告データ（`useAdsData()`→`{raw,loading,error}`、raw.monet=MonetRow[]）。`getDashboardData(raw, period)`／`resolvePeriod`／`getCampaignType`。
- `client/src/pages/Ads.tsx` … /adsページ。`MetricTable`（集客=店舗別）に **CPA・ROAS列を実装済**（CPA=集客spend÷新規来店、ROAS=新規売上÷集客spend）。新規来店=`newByStore`（daily_new優先/月次フォールバック）、新規売上=`useStoreNewSales`→`newSalesByStore`。店舗名突合は `canonicalStore`（"院"・空白除去）。
- `client/src/hooks/useStoreNewSales.ts` … store_newsales を gviz 読み（ROAS用）。
- `client/src/hooks/useStores.ts` / `server/routers/stores.ts` … 店舗マスタ（DB `stores`）＋ハードコードfallback。**土橋院を広島エリアに追加済（両方）**。新店は scheduledNewStore が自動検知して DB挿入する設計（keyword「土橋」定義済）。DBに登録が無い店はfallback（DB空時のみ）でしか出ない点に注意。
- `client/src/pages/Home.tsx` … トップ。店舗一覧＋「月間表彰」セクション（L372〜、総合点TOP5/ランキング）。
- `client/src/pages/StoreDetail.tsx` … 店舗詳細（店舗売上サマリ＝公式値）。
- `client/src/components/StoreCpaRoas.tsx` … **未使用**（CPA/ROASを一旦店舗詳細に置いたが/adsへ移設。削除してよい）。

## 4. 未実装タスク（林 確定仕様・2026-07-05）
- **① ランキング廃止**：`Home.tsx` の「**月間表彰」セクション（L372〜）を丸ごと削除**（総合点TOP5・総合点ランキング含め全部）。関連import/未使用変数も掃除。
- **② /ads に「HPB費用」列を追加**：全店一律 **月額¥55,000**。選択期間が複数月なら **×月数**（`monthsBetween(D.period.since, D.period.until).length`）。集客の店舗別テーブル（`MetricTable` 集客）に列追加。表示は各店同額×月数、合計は 55,000×月数×店舗数。
- **③ ROAS 再計算**：ROAS = **新規売上 ÷（集客広告費 ＋ HPB費用）**×100。今の実装は分母が集客spendのみ→分母に hpb費用（月額×月数）を足す。集客のみ対象（求人は対象外）。
- **④ CPA 再計算**：CPA = **（集客広告費 ＋ HPB費用）÷ 新規来店数**。**CPL（リード単価）は据え置き**＝広告費のみ（HPBは含めない）。
  - ②〜④実装メモ：MetricTableに hpbPerMonth(=55000) と monthCount を渡すか、Ads本体で hpbByStore を作って渡す。CPA/ROASのtd・合計・列ヘッダ「HPB費用」を追加。既存のCPA/ROAS実装（spendのみ）を (spend+hpb) に変更。
- **⑦-a 次回予約率の異常/欠測**：`Home.tsx`/`StoreDetail.tsx`。堀江院2ndが **107.8%（>100%）**＝計算かデータ異常（次回予約数>客数）。土橋院が **0%**＝月末報告書が未取込（次回予約率だけ月末報告書由来）。ロジック点検＋土橋の月末報告書取込（データ側はCowork/scraper連携）。
- **⑦-b 失敗通知の復活**：スクレイパー/同期stopの通知。現状 notifyOwner はno-op化。Cowork側で鮮度チェックの scheduledタスク `salonboard-freshness-check`（毎朝10:03・daily_new最新日付が2日以上遅れたら警告）を稼働中＝部分カバー。恒久はメール/LINE通知の復活を検討。

## 5. 注意 / ハマりどころ
- **店舗名の突合**：広告 tenpo「堀江2nd院」↔ サロンボード「堀江院2nd」。`canonicalStore`（"院"・空白除去）で "堀江2nd" に揃えて一致。store_official/store_newsales/stylist_flat は `normalizeSalonBoardStore`（→「堀江院2nd」等 canonical）。混同注意。
- **gviz は新規タブのインデックス反映が遅れる**ことがある。GAS側 `DriveApp.getFilesByName` も新規CSV名は遅延で見つからない→**出力フォルダID直接指定**（`getFolderById('14TOVk8oVfknCfK0HgaK6SDSqIbyk8Pw_').getFilesByName`）＋グローバルfallbackで解決済（refreshStoreExtras参照）。
- **サロンボードのスクレイプはCAPTCHA/ログインで人手が要る**（Claude Code＝ターミナルでは無人不可）。scraperのnodeスクリプト自体は実行可能だが、セッション切れ時のログインはCowork/人手。
- **Cowork担当（Claude Code対象外）**：Notion司令塔の読み書き、サロンボード/HPBのブラウザ操作、本番サイトの目視確認、⑤スタッフ一覧(Notion)。
- 詳細な経緯・データ系譜は Cowork側メモリ `project_monet_salonboard_truth_source` / `reference_salonboard_scraper_sheets` / `reference_monet_ads_page_react` と GrandFusion法人司令塔(Notion)に記録。

## 6. 関連リポジトリ/資産（別フォルダ）
- スクレイパー: `../salonboard-scraper`（download_sales.js=明細・download_monthly.js=公式月別集計・aggregate_*.js・auto_run.sh＝launchd毎朝7:30、Mac mini常駐）。GAS: 1nR36にbound（clasp化推奨）。
