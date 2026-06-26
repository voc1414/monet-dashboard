# 実装依頼（Claude Code）：Manus基盤の解消＋独立ホスティング＋アクセス制御

## 調査結果（2026-06-24）
- Manus OAuth（sdk.ts / oauth.ts / users テーブル）は**ダッシュボードの実機能では未使用**（`protectedProcedure` を使うルーターが0）。
- Forge系AI（voiceTranscription / imageGeneration / map / llm）も**クライアント未使用**＝テンプレ残骸。
- 認証は別系統で自前：admin の ID/パス＋JWT（`server/routers/admin.ts`、env `ADMIN_USERNAME`/`ADMIN_PASSWORD`/`JWT_SECRET`）。Manus非依存。
- 実依存：**MySQL**（テーブル＝staff_status / staff_status_history / stores / stylist_aliases。users はOAuth用で撤去可）と、**notifyOwner**（Forgeの通知。定期同期で使用）。

## 課題1：基盤解消＋独立ホスティング
1. **Manus依存の撤去**
   - OAuth一式（oauth.ts、sdk.ts、users連携、OAUTH_SERVER_URL/OWNER_OPEN_ID/VITE_APP_ID）を撤去。
   - Forge系AI（voice/image/map/llm）を削除（未使用）。
   - `notifyOwner` を「メール送信」または「無効化（ログのみ）」に置換（BUILT_IN_FORGE_API_*撤去）。
2. **認証を admin ログインに一本化**（既存のID/パス＋JWT）。
3. **DB**：MySQLを独立運用（4テーブル）。usersテーブル撤去。マイグレーションは drizzle（`db:push`）。
4. **ホスティング**：Nodeアプリ（express＋tRPC＋定期同期ルート）を動かせるホストにデプロイ。
   - ※Cloudflare Pagesは静的専用のため不可。Render / Railway / Fly.io 等のNodeアプリホストを使う。
   - 定期同期（毎月6日 `/api/scheduled/monthly-sync`）はホストのcron/scheduledで叩く。
5. **環境変数（本番）**：`DATABASE_URL` `JWT_SECRET` `ADMIN_USERNAME` `ADMIN_PASSWORD` `PORT`。OAuth/Forge/Owner/VITE_APP_ID は撤去。

## 課題5：アクセス制御（経営数字の機密）
現状、店舗/スタッフ等のダッシュボードはログイン無しで閲覧可能（adminページのみ保護）。かつデータはクライアントが公開Googleシートを直読み＝**実質公開**。

- **フェーズ1（必須・軽い）**：アプリ全体を admin ログインの背後に入れる（全ページ要ログイン）。またはホスト側のアクセス制御（Basic認証 / Cloudflare Access 等）を前段に置く。
- **フェーズ2（堅牢・推奨だが工数あり）**：Googleシートのクライアント直読みをやめ、**サーバ経由で取得**＋シートを**非公開（サービスアカウント共有）**にする。シートIDがJSバンドルに露出しなくなり、URLを知っても外部から数字が見えなくなる。

## 林さんが決めること
- ホスト：Render / Railway / Fly / VPS（DB込みで選ぶ）。
- DB：MySQLのまま管理DBを借りる / Postgresへ移行。
- アクセス制御：フェーズ1だけ / フェーズ2まで。
- 通知：notifyOwner を メール化 / 無効化。

## 完了条件
Manus関連の環境変数・コードを撤去しても全テスト緑かつローカル起動可。独立ホストにデプロイし、admin ログインの背後で全ダッシュボードが表示される。

## 確定事項（2026-06-24 / はやしん経由・林さん委任で決定）
着手時、Claude Code は以下を前提に進める。プラットフォーム最新仕様（特にRailwayのMySQL提供）は着手時に再確認すること。

- **ホスト：Railway 採用。** 理由＝運用が非エンジニア（総務）想定で、サーバー自前管理が要るVPSを避けた。
- **DB：MySQL のまま継続。** 理由＝コードが既にMySQLで改修最小。Postgresへの移行はしない。RailwayでMySQLを用意する（提供状況は着手時に確認、不可なら林さんへ確認の上で再判断）。
- **アクセス制御：管理ページ(/admin/*)のみログイン必須。**（2026-06-26 林さん明確化で改訂）ダッシュボード（売上等の閲覧ページ）はログイン不要で閲覧自由。FCにも数字を見せる前提のため、全ページadminログイン背後化（旧フェーズ1）は**実施しない**。/admin は AdminLayout の redirectOnUnauthenticated で保護済み。
  - ※旧記載（フェーズ1＝全ページ背後／フェーズ2＝シート非公開＋サーバ取得）は林さんの意図と逆だったため撤回。将来「数字の閲覧者を絞りたい」場合のみ、シート非公開＋サーバ取得＋閲覧専用ログインを別途検討。
- **通知：notifyOwner は無効化（ログのみ）。** Forge依存を撤去。メール送信が必要になれば後日追加。
- **人間側作業（Claude代行不可）：Railwayのアカウント作成・支払い登録は林さんが実施。** それ以降（撤去・デプロイ設定・マイグレーション）はClaude Codeが進める。

### 並行可能な別タスク
スタイリスト別売上のサロンボード化（docs/spec-stylist-salonboard.md）はホストと独立で着手可能。
