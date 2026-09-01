# デプロイ・チェックポイント記録(customer-mgmt-console)

Manusのデータが失われているため、GitHub/Vercelに現在ある状態が「唯一の正」。以後、UIに変更を加える前に必ずこの記録の一番下に新しいチェックポイントを追記してから作業する。壊れた場合はここに書かれたコミット/URLに戻せる。

## 戻し方

```
git log --oneline          # コミット履歴確認
git reset --hard <コミットhash>   # 作業ツリーを指定コミットまで戻す(要事前確認・複数回許可)
git push --force-with-lease       # リモートも戻す(要事前確認・複数回許可)
```
または Vercelダッシュボード → Deployments → 戻したいデプロイの「...」→ 「Promote to Production」でコード変更なしに即座に切り戻し可能(こちらの方が安全・簡単)。

---

## チェックポイント一覧

### CP0 (2026-08-25 本日の開発着手前)
- コミット: `69bcde4`
- Vercel Production: https://customer-mgmt-console-43fhlza90-spiral-turn.vercel.app
- 内容: Supabase環境変数追加のみ(コードは無変更)。動作分析・工程進捗機能を実装する前の状態

### CP1 (2026-08-25 工程進捗バー・動作分析画面 追加後)
- コミット: `1761d77`
- Vercel Production: https://customer-mgmt-console-8zulqhzp6-spiral-turn.vercel.app
- 内容: production_workflows連携の工程進捗バー、GaitAnalysis.tsx(動作分析画面)追加

### CP2 (2026-08-25 工程進捗カードのボタン内包デザインに変更)
- コミット: `d01a8f9`
- Vercel Production: https://customer-mgmt-console-1b9farb83-spiral-turn.vercel.app
- 内容: 各工程カード内にアクションボタンを内包する設計へ変更(独立ボタン廃止)

### CP3 (2026-08-25 analysis_signs.side列の制約に合わせて修正)
- コミット: `1685734`
- Vercel Production: https://customer-mgmt-console-b3xcjkcya-spiral-turn.vercel.app
- 内容: seed SQLのside値を'-'固定に変更、左右/両側ボタンの出し分けをフロントエンドの例外リストに変更

### CP4 (2026-08-25 動作分析「保存に失敗しました」バグ修正)
- コミット: `53c86e0`
- Vercel Production: https://customer-mgmt-console-3geuvcrh2-spiral-turn.vercel.app
- 内容: `foot_analyses.production_id`(NOT NULL、`production_workflows.id`への外部キー)を`saveDetectedSigns`のinsertが渡していなかったのが原因と判明(FK確認済み)。`ensureProductionWorkflow()`を追加し、GaitAnalysis画面の読み込み時に`production_workflows`レコードを取得/作成してから保存するよう修正。

### CP5 (2026-08-26 本日の開発着手前)
- コミット: `0922d80`
- 内容: 本日は「通信履歴(メール/LINE)ログ・再送UI」「足の計測UI」「配送管理UI」の3機能に着手予定。着手前のベースライン。

### CP6 (2026-08-26 通信履歴ログ・再送UI 追加後)
- コミット: `bcf8185`
- Vercel Production: https://customer-mgmt-console-hrq72aa50-spiral-turn.vercel.app
- 内容: `production_notifications`に`status`(pending/sent/failed)・`resend_of_id`列を追加(マイグレーション`002_production_notifications_status.sql`実行済み)。顧客詳細画面の最下部に送信履歴一覧・再送ボタンを実装。再送は現時点ではpendingキュー登録のみ(実送信処理は未実装、フェーズ2で対応予定)。

### CP7 (2026-08-26 データ改訂履歴・スタッフ編集機能 追加後)
- コミット: `3150f26`
- Vercel Production: https://customer-mgmt-console-gr5cdvdor-spiral-turn.vercel.app
- 内容: `upload_revisions`テーブル・`uploads_files.is_current`列・`update_upload_with_history`/`replace_upload_file` RPCを追加(マイグレーション`003_upload_revision_history.sql`実行済み)。顧客情報・作製目的・配送先情報・靴情報・痛み・タコの各カードをスタッフ編集可能にし、変更前スナップショットを必ず保存してから更新。写真・動画は差し替え時に旧ファイルを削除せず`is_current=false`で履歴保持。画面最下部に「変更履歴(データ改訂ログ)」セクションを追加。

### CP8 (2026-08-26 配送管理(単件) 追加後)
- コミット: `a0daf30`
- 内容: `production_workflows`に`saveTrackingNumber`/`toggleShipped`関数を追加。顧客詳細画面の工程進捗バー直下に「配送管理」カードを新設し、追跡番号の入力・保存、発送完了/取り消しを単件で行えるようにした。発送完了時は`ship_done`/`ship_at`/`ship_by`(工程進捗の一般形式)と`shipped_at`(発送実績専用列)を同時刻で記録。
  - 注意: `shipment_batches`/`shipment_items`を使った「複数顧客を一括処理する」配送管理UI(docs/07-gait-analysis-and-workflow-ui.md記載の将来方針)は**今回のスコープ外**。本人からの詳細指示を待って別途実装する。

### CP9 (2026-08-26 foot-measureへの計測連携ボタン追加)
- コミット: `4bc876a`
- 内容: 工程進捗バーの「計測」ステップに、別デプロイのfoot-measureアプリ(`https://foot-measure.vercel.app/measure?uploadId=...&orderId=...`)を新しいタブで開くボタンを追加(動作分析の`analy`ボタンと同じ`WorkflowStepAction`パターン)。foot-measure側は計測完了時に`production_workflows.measure_done`等を更新するため、その結果が本画面の工程進捗バーにそのまま反映される(追加の表示コード不要)。

### CP10 (2026-08-27 動作分析結果の顧客詳細トップ画面への統合・メール再送)
- コミット: `caae4e0`
- 内容: 別ページ(GaitAnalysis.tsx)への遷移が不便という指摘を受け、動作分析結果のサマリー(検出サイン一覧・完了ステータス)と「修正する」ボタンを顧客詳細トップ画面、通信履歴セクションの直上に表示するよう追加(`AnalysisResultSection`)。詳細な編集自体は引き続き別ページで行う。
  - `sendAnalysisResultNotification`関数を追加し、分析結果メールを任意の宛先(画面入力)へ送信キュー登録できるようにした。送信元アドレスは`noreply@insoleorder.jp`を予定(本人指定、`NOTIFICATION_SENDER_EMAIL`定数としてコード内に記録)。
  - **重要な制約**: 今回はPhase 1(送信キューへの登録のみ)。実際のメール送信処理(Phase 2)は未実装であり、別途構築が必要。

### CP11 (2026-08-27 足の計測結果の統合・測り直し・計測/分析の改訂履歴)
- コミット: `253c63a`
- **前提**: `supabase_migrations/004_measurement_and_analysis_revision_history.sql`を本人が事前にSupabase SQL Editorで実行済みであること(`foot_measurement_revisions`/`foot_analysis_revisions`テーブルと`update_foot_measurement_with_history`/`update_foot_analysis_with_history`RPCを追加するマイグレーション)。
- 内容:
  - 顧客詳細トップ画面、動作分析結果の直上に「足の計測結果」セクションを追加(Lt/Rt別のLength/Width/Heel to MP/1st IP/LEBをmm表示)。「測り直す」ボタンでfoot-measureアプリを`?readjust=<foot_measurements.id>&uploadId=...&orderId=...`付きで新しいタブに開き、既存の計測データを読み込んだ状態で再調整できる。
  - `saveDetectedSigns`/`completeFootAnalysis`を、直接updateから改訂履歴RPC(`update_foot_analysis_with_history`)経由に変更。foot-measure側の`calculateAndSaveMeasurement`も同様にRPC化済み(別コミット、foot-measureリポジトリ)。
  - `RevisionHistorySection`をuploadRevisions専用から汎用化(`title` propを追加)し、「計測データの変更履歴」「動作分析データの変更履歴」としても再利用。
  - **既知のスコープ縮小**: 計測結果の表示は、foot-measure側の「足の図」グラフィック(足型+座標付き数値)ではなく、動作分析結果と同じシンプルな数値グリッド表示。

### CP12 (2026-08-27 作製中一覧に実データ連携・計測/分析ボタン・追跡番号入力を追加)
- コミット: `3b23b94`
- 内容: `Home.tsx`(作製中一覧トップ画面)の工程チェックボックス(計測・分析・設計・作製・発送)が、これまでコンポーネント内ローカルのダミー状態(production_workflowsと未連携)だったのを、`production_workflows`と実際に連携するよう修正(`fetchWorkflowsByUploadIds`で一括取得、`toggleWorkflowStep`で更新)。
  - 計測・分析ボタンを各顧客カードの進捗テーブルに追加(顧客詳細画面を開かずに、計測はfoot-measureを新タブで開く、分析はGaitAnalysis画面へ遷移できる)。
  - 追跡番号入力欄を追加(`saveTrackingNumber`で保存)。物理バーコードスキャナー(キーボード入力互換)での運用を想定し、普通のテキスト入力欄のままで対応(追加のバーコード読取実装は無し)。
  - `fetchWorkflowsByUploadIds`/`fetchMeasurementsByUploadIds`(一括取得関数)を新設し、一覧画面でのN+1クエリを回避。

### CP13 (2026-08-27 配送管理(セッション単位の一括発送処理)着手前)
- コミット: `3a5c12c`
- 内容: 本日は「配送管理(セッション単位の一括発送処理)」機能に着手予定。CP8で単件の配送管理(追跡番号・発送完了)を実装済みだが、今回は`shipment_batches`/`shipment_items`を使った複数顧客一括処理のセッション管理UIを新規実装する。着手前のベースライン。

### CP14 (2026-08-27 配送管理(セッション単位の一括発送処理) 追加後)
- コミット: `6e14038`
- **前提**: `supabase_migrations/005_shipment_batch_management.sql`を本人が事前にSupabase SQL Editorで実行済みであること(`shipment_items.is_active`等の列、`add_to_shipment_batch`/`remove_from_shipment_batch` RPCを追加するマイグレーション)。
- 内容:
  - 新規ページ`ShipmentSessionList.tsx`(`/shipments`): セッション一覧(下書き=カード表示、CSV生成完了=テーブル表示の履歴)。「+ 新しいセッション」で出荷予定日(任意)を指定して作成。
  - 新規ページ`ShipmentBatchDetail.tsx`(`/shipments/:id`): セッション詳細(最終更新/最終編集者/配送予定日編集/注文数)、CSV生成実行・ダウンロード、リスト内注文のテーブル(検索・削除)、「+ まとめて追加」モーダル。
  - 追加モーダルは氏名・かな・ST始まりの注文ID・メール・電話のいずれでも検索可能(`searchCandidateUploads`、uploads/orders結合、既に有効な配送記録がある顧客は候補から自動除外)。音声検索(Web Speech API、`lang="ja-JP"`、非対応ブラウザではマイクボタン非表示)、複数選択一括追加と単独追加の両方に対応。
  - 顧客の追加・削除は物理削除ではなく、必ず`add_to_shipment_batch`/`remove_from_shipment_batch` RPC経由(無効化+新規追加方式)で行う。`shipment_items`への直接updateは行っていない。
  - CSV出力は将来のヤマト運輸(黒猫)投入を見据えた列構成(お客様管理番号/郵便番号/都道府県/市区町村/住所1・2/氏名/氏名カナ/電話番号/依頼主名固定値/品名)。UTF-8 BOM付きで`upsys`バケットへ保存し、`shipment_batches.address_csv_url`に記録。ヤマトAPIとの実連携はスコープ外。
  - `Home.tsx`ヘッダーに「配送管理」への導線ボタンを追加(常設サイドバーは今回スコープ外)。
  - `npm run check`・`npm run build`とも成功を確認済み。

### CP15 (2026-08-27 権限管理機能を新規実装)
- コミット: `bba94e4`
- **前提**: `supabase_migrations/006_permission_management.sql`を本人が事前にSupabase SQL Editorで実行済みであること(`system_members.visible_customer_sections`列と、`role='owner'`の行を1件に制限するユニークインデックス`system_members_single_owner`を追加するマイグレーション)。
- 内容: これまでGlideのスプレッドシート上で行っていた権限管理を、customer-mgmt-console上で行えるようにした。
  - `supabase.ts`: `SystemMember`型、`fetchCurrentMemberFull`(既存の簡易版`fetchCurrentMember`とは別に権限判定用として新設)、`fetchAllMembers`、`updateMemberPermissions`、`createMember`、判定ヘルパー`canViewCustomerSection`/`canViewDomain`を追加。
  - 新規ページ`PermissionManagement.tsx`(`/members`): `role==='owner'`のメンバーのみアクセス可能(オーナー以外が開いた場合、他メンバー情報は一切取得・表示しない)。メンバーごとに7ドメイン(分析/計測/作製/配送/顧客情報/組織/メンバー管理)の権限(none/view/edit)と、`perm_customer`がnone以外の場合のみ表示される`visible_customer_sections`(顧客詳細画面のどの「枠」を見せるか、11項目から選択)を編集できる。`role`を'owner'に変更しようとした際、既に別のオーナーがいればフロント側でも一意性チェックで弾く(DB側のユニークインデックスが最終的な安全網、二重の安全策)。「+ 新しいメンバーを追加」で名前・メールのみのメンバーを作成可能(認証アカウントとの紐付け=`auth_user_id`は本人が別途、実際のサインイン時に行う運用。招待メール送信は未実装)。
  - `Home.tsx`ヘッダーに「権限管理」への導線ボタンを追加(オーナーのみ表示、`fetchCurrentMemberFull`で判定)。
  - `CustomerDetail.tsx`: メインのデータ取得`useEffect`で`fetchCurrentMemberFull(user.id)`を呼び`currentMember`state(新設、既存の`memberId`とは別)に保持。`perm_production`が'none'なら工程進捗セクション全体を非表示(計測・分析・発送の個々のボタンを出し分けるところまでは今回のスコープ外)、`perm_shipping`/`perm_measurement`/`perm_analysis`が'none'ならそれぞれの対応セクションを非表示。`perm_customer`が'none'の場合、顧客情報系11カード(注文情報/顧客情報/作製目的/配送先/靴情報/痛み/タコ/ファイル/アップロード情報/変更履歴/通信履歴)を全て非表示にし、'view'または'edit'の場合は`visible_customer_sections`に含まれるものだけ表示。顧客情報の権限が無いメンバーには、ページ見出しを顧客名でなく`order_name`(注文ID)またはuploadIdで表示(**重要な設計判断・本人指定**: 同一顧客が複数年で複数回注文するケースがあるため、動作分析等は顧客を横断集約せず必ずupload単位で識別する。これに合わせ、権限を絞ったスタッフの画面には「顧客名」ではなく「注文ID/アップロードID」を出す)。`role==='owner'`はこれら全ての判定をバイパスして常に全表示。
  - **重要な設計上の注意(コード内コメントに明記)**: この権限チェックはアプリケーション層(Reactコンポーネントの表示条件)のみであり、Supabase RLS(Row Level Security)による真のアクセス制御ではない。Green段階はanon keyで緩やかにアクセス可能という、このプロジェクトの現状の設計方針を踏襲している。
  - `system_members`テーブルへの直接update(`updateMemberPermissions`/`createMember`)は、この権限管理機能に限って許容(改訂履歴RPCは対象外、本人からその指示なし)。
  - `npm run check`・`npm run build`とも成功を確認済み。
  - **スコープ外(意図的に対象外)**: メール招待フロー、RLSの実装、工程進捗バー内の個別ボタンの出し分け、GaitAnalysis.tsx/ShipmentBatchDetail.tsx等の他ページへの権限適用。

### CP16 (2026-08-28 認証をコード直接入力方式へ統一 / S2 の4本目・最終)
- コミット(着手前): `ca666a7`("docs: CP15にコミットハッシュを記録")
- Vercel Production(着手前): `customer-mgmt-console-4la7zzkpr`(公開URL `https://customer-console-jade.vercel.app`)
- 背景: dealer-insole-order(CP3)・dealer-mgmt-console(CP4)・foot-measure(CP5)と同じ。メール内マジックリンクがモバイルで機能しない問題(アプリ内ブラウザにセッション隔離 / Gmail の URL 先読みでトークン消費)を、認証を持つ全アプリへ横展開する S2 の最後の1本。dealer-insole-order で実機ログイン確認済み。
- 変更内容:
  - `client/src/lib/supabase.ts`: `verifyOtpCode(email, token)` を新設(`supabase.auth.verifyOtp({ type: 'email' })`)。既存 `sendMagicLink` に `shouldCreateUser: false` を追加(**これまで未指定=true だった**。社内スタッフ用コンソールなので事前登録済み system_members のメールに限定)。`emailRedirectTo` は保険で残置。2026-08-28 失敗史の注釈を追加。
  - `client/src/pages/SignIn.tsx`: 「送信 → 完了画面」から「送信 → 確認コード入力 → verifyOtp」の2ステップへ。`@/lib/supabase` から `sendMagicLink` / `verifyOtpCode` を直接 import(このアプリの既存パターン。AuthContext は user/session の追跡のみで認証アクションは持たない)。コード欄は数字のみ・桁数寛容(4〜10、Email OTP Length 設定に追従)。案内文を「メール記載のコードを入力。リンクは使わない」に変更。
- DB/RLS への影響: なし(`verifyOtp` は RLS を通らない。migration 不要)。
- ビルド: `npx vite build` 成功。`npx tsc --noEmit` = **エラー0件**(変更2ファイル含め全体クリーン)。
- 戻し方: Vercel → customer-mgmt-console → Deployments で `4la7zzkpr`(着手前の本番)を Promote to Production。またはコミット `ca666a7` へ `git reset --hard`(要・複数回許可)。

本番URL(常に最新を指す): https://customer-console-jade.vercel.app

---

## DB migration 010(RLS 硬化)適用 2026-08-28 — コード変更なし

`spiralturn-green-integration/supabase/migrations/010_rls_hardening.sql` を Green Supabase に適用(冨永社長が SQL Editor で実行・検証済み)。customer-mgmt-console への影響:

- `uploads_files` / Storage `upsys` のスタッフ横断 read が、緩いポリシー(`USING true`)から **HQ 権限ポリシー(`hq_has_perm('production'|'analysis'|'measurement'|'shipping', 'view')`)** へ移行。
  - ログイン中スタッフの `system_members` 行が **HQ(`organization_id IS NULL`)かつ上記いずれかの権限 view 以上**なら、顧客詳細のファイル一覧・プレビューは従来どおり表示される。
  - 権限が無いスタッフには**見えなくなる**(意図した挙動)。オーナーで見えない場合は `system_members.organization_id` が取扱店シードで汚れていないか確認(`supabase/README.md` のインシデント記録参照)。
- `organizations` の `USING true` SELECT を削除。スタッフは `"organizations: system_members can read"`(有効メンバー)で従来どおり閲覧可。
- `commission_ratio_settings` は HQ の `organization` 権限持ちのみ SELECT 可に。
- 実機確認(未): 顧客詳細でアップロード済みファイルが表示されるか。壊れたら 010 末尾のロールバック SQL。

---

### CP17 (2026-09-01 サインインの確認コード送信にクールダウンを追加)
- コミット(着手前): `95ad7c3`("feat: サインインを確認コード直接入力方式へ統一(マジックリンク依存を排除)")
- Vercel Production(着手前): `customer-mgmt-console-87ifb7tff`(公開URL `https://customer-console-jade.vercel.app`)
- 背景: Supabase Auth は同一メール宛の確認コード再送を約10秒間ブロックする(ホスティング版の固定値・ダッシュボードで変更不可)。従来はこのとき英語のレート制限メッセージを toast でそのまま表示していたため、「別 Google アカウントで誤ログイン → すぐ正しいアカウントで送り直す」等の正当な操作でサインインできず混乱する。冨永社長の依頼で全アプリのサインイン画面に横展開する1本目(2本目=foot-measure)。
- 変更内容(`client/src/pages/SignIn.tsx` のみ):
  - `cooldown`(残り秒数)state と 1秒ごとの減算 `useEffect` を追加。定数 `RESEND_COOLDOWN_SEC = 12`(Supabase の約10秒に余裕を足した値)。
  - `handleSendCode`: 送信成功時に `cooldown` を 12 にセット。`cooldown > 0` の間は送信せず「確認コードを送信しました。もう一度送信する場合は10秒ほどお待ちください。」を通常 toast で案内。
  - 送信エラーを判定関数 `isSendRateLimitError`(HTTP 429 か "after N seconds" 文言)で仕分け。レート制限なら英語を出さず上記の日本語案内 + `cooldown` セット。それ以外は従来どおり実エラーを表示。
  - メールアドレス入力ステップのボタン: `cooldown > 0` の間は無効化しラベルを「送信しました」に。ボタン下に同じ日本語案内文を表示。数字カウントダウンは出さない(冨永社長の指定)。
- DB/RLS への影響: なし(フロントの状態管理のみ。Supabase 呼び出しの中身は不変)。
- ビルド: `npx tsc --noEmit` = エラー0件 / `npx vite build` = 成功(2026-09-01 実行、1715 modules)。
- デプロイ済み(2026-09-01): コミット `036858c` を push → `vercel deploy --prod` → `customer-mgmt-console-cexi3phk6`(本番)。公開URL 200 確認。
- 案内文言(2026-09-01 冨永社長修正): 「10秒ほどお待ちください」だけだと「コードが届くまで待つ」と誤読されるため → **「確認コードを送信しました。もう一度送信する場合は10秒ほどお待ちください。」**
- 戻し方: Vercel → customer-mgmt-console → Deployments で `87ifb7tff`(着手前の本番)を Promote to Production。またはコミット `95ad7c3` へ戻す(要・複数回許可)。

本番URL(常に最新を指す): https://customer-console-jade.vercel.app
