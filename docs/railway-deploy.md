# monet-dashboard Railway デプロイ手順（B-2）

Manus非依存（B-1完了）の monet-dashboard を Railway に独立デプロイする手順。
運用は非エンジニア想定。コマンドは Railway の Web UI 中心で完結する。

## 前提（林さんのみ実施・代行不可）
- Railway アカウント作成と支払い（クレジットカード）登録
- GitHub の `voc1414/monet-dashboard` に最新を push 済み（B-1＋サロンボード化＋B-2設定）

## 構成
- アプリ：Node（Express＋tRPC）＋ React（vite build）。`npm run build` → `dist/`、`node dist/index.js` で起動。
- DB：MySQL（Railway の MySQL プラグイン）。テーブル＝staff_status / staff_status_history / stores / stylist_aliases（drizzle）。
- アクセス制御：**管理ページ(/admin/*)のみログイン必須**（AdminLayout が未認証時に /admin/login へ誘導）。ダッシュボード（売上等の閲覧ページ）はログイン不要で閲覧可＝林さん方針。※全ページ背後化はしない。
- 定期同期：`/api/scheduled/monthly-sync` `/api/scheduled/new-store-check` は `CRON_SECRET` 必須（未設定なら503で無効）。

## 手順
1. **GitHub 連携でプロジェクト作成**
   Railway → New Project → Deploy from GitHub repo → `voc1414/monet-dashboard` を選択。
   ※ build/start は同梱の `railway.json`（NIXPACKS／`npm run build`／`node dist/index.js`）で自動。

2. **MySQL を追加**
   プロジェクト内で New → Database → Add MySQL。作成後、接続URLを控える
   （Variables の `MYSQL_URL` 等。アプリの `DATABASE_URL` にこの値を入れる）。

3. **環境変数を設定**（Service → Variables）。`.env.example` 参照。
   - `DATABASE_URL`＝MySQLプラグインの接続URL
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD`（管理者ログイン）
   - `JWT_SECRET`（`openssl rand -hex 32` で生成）
   - `CRON_SECRET`（ランダム文字列。後述のcronで使用）
   - `NODE_ENV=production`（PORT は Railway が自動注入）

4. **初回デプロイ**
   変数保存後にデプロイが走る。ビルドログでエラーが無いことを確認。
   ※ もし pnpm の peer 依存（vite7×@builder.io/vite-plugin-jsx-loc）でインストールが失敗する場合は、
     Variables に `NPM_CONFIG_STRICT_PEER_DEPENDENCIES=false` を追加（または Nixpacks の install を
     `pnpm install --no-strict-peer-dependencies` に上書き）。

5. **DBマイグレーション（テーブル作成）**
   一度だけ実行：ローカルで `DATABASE_URL=<RailwayのURL> npm run db:push`
   （または Railway のワンオフコマンド/Shellで `npm run db:push`）。
   ※ users テーブルは廃止済み。物理削除が必要なら別途。

6. **管理者初期データ（任意）**
   admin ログイン → 管理画面でスタッフ在籍/店舗マスタ/名寄せを設定（`bulkInitStaffStatuses` 等）。

7. **定期同期の cron（任意・新店検知を回す場合）**
   Railway の Cron で月次に下記を叩く（`CRON_SECRET` をヘッダで送る）：
   `curl -X POST -H "x-cron-secret: $CRON_SECRET" https://<本番URL>/api/scheduled/monthly-sync`
   ※ notifyOwner は現在 no-op（ログのみ）。新店検知の通知復活は別チケット。

8. **動作確認**
   本番URLを開く → ダッシュボードがそのまま表示（ログイン不要）。`/admin` を開くとログイン必須。
   売上＝技術＋店販、店舗＝Σスタイリストで表示されること。

## 注意 / 未了
- **サロンボード売上シート（1nR36…）は「リンク閲覧可」公開**。ダッシュボードは匿名gvizで取得するため必要。
  ダッシュボード自体もログイン不要で閲覧可の方針のため、数字は閲覧URLを知る人には見える。将来「数字の閲覧者を絞りたい」場合のみ、シート非公開＋サーバ取得＋閲覧ログインを別途検討（現時点では実装しない）。
- `findAvailablePort` は PORT が空いていればそのまま使う（Railwayでは $PORT が空いているため問題なし）。
- 既存の Manus 用 vite プラグイン（vite-plugin-manus-runtime 等）は dev 用途。本番ビルドは成功確認済み。
