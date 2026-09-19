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
  - `handleSendCode`: 送信成功時に `cooldown` を 12 にセット。`cooldown > 0` の間は送信せず案内文を通常 toast で表示。ボタンロックは 12 秒(二重クリック防止)だが、案内文は **「確認コードを送信しました。もう一度送信する場合は30秒ほどお待ちください。」**(Supabase の実ブロックが実測約30秒のため)。送信エラーが `after N seconds` を含む場合は `Math.max(12, N+3)` 秒までロックを自動延長する。
  - 送信エラーを判定関数 `isSendRateLimitError`(HTTP 429 か "after N seconds" 文言)で仕分け。レート制限なら英語を出さず上記の日本語案内 + `cooldown` セット。それ以外は従来どおり実エラーを表示。
  - メールアドレス入力ステップのボタン: `cooldown > 0` の間は無効化しラベルを「送信しました」に。ボタン下に同じ日本語案内文を表示。数字カウントダウンは出さない(冨永社長の指定)。
- DB/RLS への影響: なし(フロントの状態管理のみ。Supabase 呼び出しの中身は不変)。
- ビルド: `npx tsc --noEmit` = エラー0件 / `npx vite build` = 成功(2026-09-01 実行、1715 modules)。
- デプロイ済み(2026-09-01): コミット `036858c` を push → `vercel deploy --prod` → `customer-mgmt-console-cexi3phk6`(本番)。公開URL 200 確認。
- 案内文言(2026-09-01 冨永社長修正、2回): (1)「待つ=コード到着まで」と誤読されるため「もう一度送信する場合は」を明示。(2)実測で15秒では足りず約30秒必要と判明 → 文言を **「確認コードを送信しました。もう一度送信する場合は30秒ほどお待ちください。」** に。ボタンロック自体は12秒のまま(社長指定。固まって見える時間を短く)+ エラーの `after N seconds` で自動延長。
- 戻し方: Vercel → customer-mgmt-console → Deployments で `87ifb7tff`(着手前の本番)を Promote to Production。またはコミット `95ad7c3` へ戻す(要・複数回許可)。

### CP18 (2026-09-01 作製中一覧ヘッダーにサインアウトボタンを追加)
- コミット(着手前): `cc2aef4`("docs(checkpoints): CPにデプロイ結果と文言修正を追記")
- Vercel Production(着手前): `customer-mgmt-console-cexi3phk6`(公開URL `https://customer-console-jade.vercel.app`)
- 背景: このアプリには UI 上にサインアウト手段が無かった(`lib/supabase.ts` に `signOut()` は実装済みだが未接続)。冨永社長の依頼で追加(foot-measure CP6 と同じ対応)。サインインのクールダウン(CP17)を実機確認するにもサインアウトが必要。
- 変更内容(`client/src/pages/Home.tsx` のみ):
  - `@/lib/supabase` から `signOut` を、`lucide-react` から `LogOut` を、`sonner` から `toast` を import 追加。
  - `signingOut` state と `handleSignOut()` を追加。`signOut()` 成功後は AuthContext の `onAuthStateChange` → `user` が null → `App.tsx` の `AuthGuard` が自動で `<SignIn />` を表示するため画面遷移コードは持たない。失敗時のみ `toast.error` + ボタン再有効化。
  - ヘッダー右側クラスタ(検索・フィルタ・更新ボタンの並び)の末尾に「サインアウト」ボタンを追加。`LogOut` アイコン + ラベル(狭幅では `hidden sm:inline` でアイコンのみ)、`title` にログイン中メール。処理中は `Loader2` スピナー。
- DB/RLS への影響: なし。
- ビルド: `npx tsc --noEmit` = エラー0件 / `npx vite build` = 成功(2026-09-01 実行)。
- デプロイ済み(2026-09-01): コミット `7ec0740` を push → `vercel deploy --prod` → `customer-mgmt-console-pc3f7ijjv`(本番)。公開URL 200 確認。
- 戻し方: Vercel → customer-mgmt-console → Deployments で `cexi3phk6`(着手前の本番)を Promote to Production。またはこのコミットのみ `git revert`。

### CP19 (2026-09-01 作製中一覧に「発注日/アップロード日」2表記 + 注文番号 + 氏名マスク)
- コミット(着手前): `196a662`("fix(signin): 再送クールダウン案内を「30秒ほど」に変更 + after N seconds で自動延長")
- Vercel Production(着手前): `customer-mgmt-console-cjesiy8jj`(公開URL `https://customer-console-jade.vercel.app`)
- 背景: 冨永社長の依頼。(1)カードにアップロード日しか無く、発注(=注文)日との「離れ」で優先度を判断できない。(2)注文番号が氏名の上に無ラベルで埋もれている。(3)動作分析だけ行う担当者には氏名を伏せ ID(注文番号)だけで運用する方針を UI に実装する。
- 決定事項(2026-09-01 冨永社長): ①発注日 = **決済完了日時**(`stripe_payments.paid_at` 最古 → 無ければ `orders.created_at`)②OEM 注文番号は `order_name` が既に `EM-...`(自社は `ST-...`)③氏名マスクの制御 = **(a) `is_outsourced` は常に非表示 + (b) 権限管理の新チェック**、オーナーは常に表示 ④マスク時の識別子 = 注文番号のみ。
- 変更内容:
  - `client/src/lib/supabase.ts`:
    - `fetchOrderMetaByIds(orderIds)` 新設 — `orders`(order_name, created_at)+ `stripe_payments`(paid_at)を `.in()` 一括取得し `{orderName, placedAt}` の Map を返す。RLS で読めなければ空 Map(呼び出し側はアップロード日だけで続行)。
    - `canViewCustomerNameInList(member)` 新設 — owner=常に可 / `is_outsourced`=不可 / `perm_customer==='none'` or 未登録=不可 / それ以外は `visible_customer_sections` に `LIST_CUSTOMER_NAME_KEY`('list_customer_name')があれば可。**専用カラムは足さず既存 `visible_customer_sections`(text[])を再利用**。
    - `updateMemberPermissions` の Pick に `is_outsourced` を追加。
  - `client/src/pages/Home.tsx`:
    - `Customer` に `orderPlacedAt`(YYYY/MM/DD)追加。`loadUploads` の Promise.all に `fetchOrderMetaByIds` を足し、各カードへ発注日・(uploads側が空なら)注文番号を反映。
    - カード: 日付行を「発注 YYYY/MM/DD ／ アップロード YYYY/MM/DD HH:mm」に統合。氏名の再掲(`uploadB`)行を削除。`<h2>` は `showName ? 氏名 : 注文番号`。氏名表示時のみ「注文番号: ...」補助行。
    - フルのメンバー情報を state に保持し `canSeeNames = canViewCustomerNameInList(member)` を算出。検索フィルタは氏名を見られない場合、氏名一致を除外(マスク時に氏名で当てさせない)。
  - `client/src/pages/PermissionManagement.tsx`: メンバー行に「顧客氏名の表示」ブロックを新設 — 「外注スタッフ(氏名を一切表示しない)」トグル(`is_outsourced`)+「作製中一覧で顧客の氏名を表示する」チェック(`list_customer_name`。外注 ON 時は無効・グレー表示)。`handleSave` に `is_outsourced` を追加。
- DB/RLS への影響: **migration 不要**(`is_outsourced` カラム既存、`visible_customer_sections` は text[] に新キーを混ぜるだけ)。`stripe_payments` の SELECT は既存の org/HQ ポリシーで読める範囲のみ(読めなければ発注日は `orders.created_at` 経由 or 非表示)。
- ビルド: `npx tsc --noEmit` = エラー0件 / `npx vite build` = 成功(2026-09-01)。
- デプロイ済み(2026-09-01): コミット `d9407aa` → `customer-mgmt-console-otaisvi3t`。追随修正 `b4186f5` → `customer-mgmt-console-q87hj424i`(発注スロットを常時4パターン表示に: **ゲストアップロード / 発注 <日付> / 発注 日付不明 / 発注情報なし**。発注なしでアップロードする運用があるため空欄にしない。ゲストアップロード=`guest_tf` は発注非紐付け)。公開URL 200 確認。
- 実データ0件のため見た目確認は E2E モックデータ seed が要る(発注日・注文番号は `orders`/`stripe_payments` 由来のため)。
- 戻し方: Vercel → customer-mgmt-console → Deployments で `cjesiy8jj`(着手前の本番)を Promote to Production。またはこのコミットのみ `git revert`。

本番URL(常に最新を指す): https://customer-console-jade.vercel.app

---

## 2026-09-04: Legacy anon JWT → 新 publishable キー(docs/35 WS-B / docs/36)

- 変更前 HEAD: `b3923f7` / Vercel Production: https://customer-console-jade.vercel.app
- `client/src/lib/supabase.ts`: ハードコード fallback(旧 anon JWT)撤去 → env 必須(未設定なら throw)
- Vercel env `VITE_SUPABASE_ANON_KEY` を `sb_publishable_...` に差し替え済み(Production ほか)
- 巻き戻し: この commit を revert + Vercel env を旧 anon JWT に戻す

## 2026-09-11: メールログイン不能を修正 — Turnstile captchaToken を signInWithOtp に添付

- 変更前 HEAD: `8a1afa6` / Vercel Production: https://customer-console-jade.vercel.app
- 症状・原因: 2026-09-10 の Green Supabase Auth の Captcha protection(Turnstile)有効化により `signInWithOtp`(メール)に `captchaToken` が必須化され、トークン未添付の本アプリのログインが `captcha protection: request disallowed` で全滅。
- 修正: `client/src/components/Turnstile.tsx`(新規)/ `client/index.html` に Turnstile api.js / `lib/supabase.ts` `sendMagicLink(email, captchaToken?)` → `signInWithOtp` options に付与 / `SignIn` にウィジェット配置(トークン未取得なら送信不可・送信毎に再マウント・エラー時もトークン破棄)。
- Vercel env(CLI で設定済み): Production に `VITE_TURNSTILE_SITE_KEY`(upload-center と同一・公開値)。
- 前提: Cloudflare Turnstile ウィジェット `upload-center` の Hostname に `customer-console-jade.vercel.app` を追加済み(冨永社長・2026-09-11)。
- ビルド: `npx vite build` 成功。コミット: `417432a`(+ env 反映のため空コミット `8f55cb5`)。
- 戻し方: 2コミットを revert + Vercel env 削除。captcha protection が ON の間はログイン不能に戻る点に注意。

## 2026-09-18: 動作分析「確認(分析を確定する)」ボタンが成功しても無反応な問題を修正

- 変更前 HEAD: `315e635` / Vercel Production: https://customer-console-jade.vercel.app
- 背景: M1 実機確認中、冨永社長が動作分析画面(`GaitAnalysis.tsx`)で全項目チェック後に「確認(分析を確定する)」を押しても画面が変わらず、確定できたか分からないと報告。コード確認の結果、左右ボタンのクリックごとに`saveDetectedSigns`(RPC `update_foot_analysis_with_history`)で即時自動保存されており、確定ボタンも保存自体は成功(`completeFootAnalysis`で`is_completed=true`等をセット)していたが、**成功時のトースト表示・画面遷移のコードが元々存在しなかった**(バグではなく未実装)。
- 修正(`client/src/pages/GaitAnalysis.tsx`のみ): `sonner`から`toast`をimport。`persist(selections, true)`内、`completeFootAnalysis`成功後に`toast.success("動作分析を確定しました")` + `setLocation(`/customer/${uploadId}`)`(画面上部の「顧客詳細に戻る」と同じ遷移先)を追加。
- DB/RLSへの影響: なし(フロントエンドのみ)。
- ビルド: `npx tsc --noEmit`(リポジトリ直下で実行。`vite.config.ts`がルート直下にあるため`client/`で実行すると alias 解決に失敗する点に注意)= エラー0件 / `npx vite build` = 成功(1716 modules)。
- 戻し方: このコミットのみ `git revert`。または Vercel → customer-mgmt-console → Deployments で `315e635` 時点の本番デプロイを Promote to Production。

## 2026-09-18: 動作分析画面を「確定後は結果サマリー表示・修正は明示ボタン経由」に作り直し + 責任の所在(分析者・日時)を全画面に表示

- 変更前 HEAD: `7cac13b` / Vercel Production: https://customer-console-jade.vercel.app
- 背景: 上記の直前コミットで確定後にトースト+顧客詳細への遷移を追加したが、冨永社長から実機確認で「以前指示した仕様が反映されていない」と再指摘。過去の指示(`docs/07-gait-analysis-and-workflow-ui.md` §1「UI配置の設計思想」)が原本として残っており、①確定後は同画面に結果一覧を表示する②再度開いたときも要約を先に見せ、「修正する」ボタンを押した時だけ編集フォームに入る③誰が・いつ分析したかを常に明示する、という仕様が`GaitAnalysis.tsx`未実装だった。[[顧客データ改訂ポリシー]](Bacon_Brain)に恒久仕様として明文化した上で実装。
- 修正:
  - `client/src/pages/GaitAnalysis.tsx`: `editing`(サマリー/編集の出し分け)・`analystName`・`revisions`のstateを追加。確定済みなら既定でサマリー(検出リスト+分析者+確定日時+変更履歴)を表示し「分析結果を修正する」ボタンでのみ編集フォームへ。確定成功時に前コミットの`setLocation`遷移を廃止し、代わりに同画面でサマリー表示へ切替 + `toggleWorkflowStep(uploadId, orderId, 'analy', true, memberId)`を呼び`production_workflows.analy_done/analy_at/analy_by`を自動更新(計測=foot-measureの`measure_done`連携と同じパターン)。
  - `client/src/pages/Home.tsx`(作製中一覧): `fetchMemberNames`を一括呼び出しし(N+1回避)、「分析」チェックボックスの直下に担当者名+日時を表示。`handleToggle`で手動トグル時も担当者名を追加解決。
  - `client/src/pages/CustomerDetail.tsx`: 動作分析結果カードに分析者名を追加表示。`RevisionHistorySection`の担当者バッジを「スタッフ」固定表示から実名表示(`memberNames`props追加)に変更(動作分析の変更履歴のみ対象。計測の変更履歴は今回スコープ外・未対応)。
  - `client/src/lib/supabase.ts`: `fetchMemberNames`を`export`化(Home.tsx/CustomerDetail.tsxから再利用するため)。
- DB/RLSへの影響: なし(migration不要。既存カラム`production_workflows.analy_*`・`foot_analyses.operator_member_id`/`analyzed_at`・`foot_analysis_revisions`を読み書きするのみ)。
- ビルド: `npx tsc --noEmit`(リポジトリ直下)= エラー0件 / `npx vite build` = 成功(1716 modules)。
- 既知の残課題(今回スコープ外・次回検討): 計測(foot-measure)側の変更履歴・作製中一覧表示にも同じ「担当者名が出ない」問題が残っている可能性が高い。
- 戻し方: このコミットのみ `git revert`。または Vercel → customer-mgmt-console → Deployments で `7cac13b` 時点の本番デプロイを Promote to Production。

## 2026-09-18(続き): 変更履歴が「チェック1回ごと」に大量記録される問題を修正 + 表現を「責任の所在ログ」から「分析の記録」に変更

- 変更前 HEAD: `25cea98` / Vercel Production: https://customer-console-jade.vercel.app
- 背景: 上記の実装後、冨永社長が実機確認したところ「変更履歴(責任の所在ログ)」に左右ボタンを押すたび(下書き保存のたび)の記録が積み上がり(#14〜#20 が数十秒の間に大量発生)、読めない状態になっていた。理由: 個々のチェックは同一人物が同一時間帯に行うことが多く粒度が細かすぎる意味が無い上、「責任の所在」という表現は分析者を萎縮させるとの指摘。
- 修正:
  - `client/src/lib/supabase.ts`: `saveDetectedSigns`(下書き保存・チェックのたびに呼ばれる)を、改訂履歴RPC経由から**プレーンな`update`(履歴を作らない)**に変更。`completeFootAnalysis`を`confirmFootAnalysis`に置き換え、detected_signsの更新+完了フラグ+履歴記録(1件のみ)を1回のRPC呼び出しでまとめて行うように統合(旧実装は確定のたびに「下書き保存」1件+「確定」1件の計2件が作られていた)。
  - `client/src/pages/GaitAnalysis.tsx`: `persist()`を下書き(履歴なし)と確定(履歴1件)の2経路に明確に分離。「変更履歴(責任の所在ログ)」の見出しを「分析の記録」に変更。各行の`change_reason`表示を削除(全件同じ文言になり冗長なため)。
- DB/RLSへの影響: なし(既存RPC・テーブルは無変更。呼び出し方のみ変更)。
- ビルド: `npx tsc --noEmit` = エラー0件 / `npx vite build` = 成功(1716 modules)。
- 戻し方: このコミットのみ `git revert`。または Vercel → customer-mgmt-console → Deployments で `25cea98` 時点の本番デプロイを Promote to Production。

## 2026-09-18(続き・別セッション): 顧客詳細に「決済情報」ブロックを新設(dealer-mgmt-console CP27〜31 の続き)

- 変更前 HEAD: `887e668` / Vercel Production: https://customer-console-jade.vercel.app
- 背景: dealer-mgmt-console のコミッション画面に決済詳細パネルを作った際(CP27〜31。migration 045〜048)、冨永社長より「顧客が何を・誰の名義で・いつ購入したかを、Stripe/Supabase/各管理コンソールを個別に見て回らずここで完結させたい」との指示。customer-mgmt-console はまだ未着手だったため、同じ設計(Supabaseの既存データを読むのみ・Stripeへのライブ呼び出しなし)でこちらにも追加。
- 追加: `client/src/lib/supabase.ts` に `fetchOrderPaymentInfo(orderId)` を新設。`orders`(注文フォーム入力の氏名・メール・電話・商品明細・金額)と `stripe_payments`(Stripe Checkout時点の氏名・メール・電話・住所=`checkout_*`。migration 048で追加/決済ステータス・金額・各種ID)を `order_id` でまとめて取得する。`client/src/pages/CustomerDetail.tsx` の「注文・アップロード情報」ブロック直後に新規カード「決済情報」を追加(`canViewCustomerSection(currentMember, 'order_info')`で出し分け・既存の権限キーを再利用)。
- **カード会社・下4桁は今回もスコープ外**(現行のStripe Webhookデータ=Checkout Sessionオブジェクトには含まれない。取得には決済完了Makeシナリオへの構造変更=新規モジュール追加が必要で、別タスクとして慎重に進める)。
- 前提: `stripe_payments` の読み取りは spiralturn-green-integration の Green migration 047(`hq_has_perm('customer','view')`のRLSポリシー追加)で許可済み。本アプリ側の追加DB変更は無し(既存の`orders`/`stripe_payments`スキーマをそのまま読むだけ)。
- ビルド: `npx tsc --noEmit`(変更前後ともエラー0件・stashで比較確認済み)/ `npx vite build` 成功(1716 modules)。
- 戻し方: `git checkout -- client/src/lib/supabase.ts client/src/pages/CustomerDetail.tsx`(DB変更が無いためこれのみで完全に戻る)。

## 2026-09-19: 動作分析の入力を「左右×強弱」の4ボタンに変更(左弱・左強・右弱・右強)

- 変更前 HEAD: `81806f9` / Vercel Production: https://customer-console-jade.vercel.app
- 背景: 冨永社長指示。従来の「左/右/両側」は有無(0/1)しか表せず、「左に少しある」と「左に明らかにある」を区別できなかった。
- 変更:
  - `client/src/lib/gaitSigns.ts`(新規): 選択状態と `foot_analyses.detected_signs` の相互変換・表示ラベル。保存形式は `key:left_weak` / `left_strong` / `right_weak` / `right_strong`(左右とも選べば2要素)、左右の概念が無いサイン(no_arm_swing)は従来どおり `key:both`。旧形式(`left`/`right`/`both`)も読み取り可能(編集フォーム上は旧「左/右」=強、旧「両側」=左強+右強として読み込む。サマリー表示は旧ラベルのまま)。
  - `GaitAnalysis.tsx`: ボタンを [左弱(小・緑)][左強(2倍幅・赤ピンク)][右弱(小・緑)][右強(2倍幅・赤ピンク)] に変更。「両側」ボタンは廃止(左右とも選べば両側の意味)。同じボタンの再押下で解除、同じ側の弱⇔強は排他、左右は独立。**「少ない方をチェック」型の2サイン(single_arm_swing / sole_area_compare)は従来どおり片側のみ選択可**(強弱は選べる)。結果サマリーは1サイン1行(例「左強 / 右弱」)。
  - `CustomerDetail.tsx`: 動作分析結果カードを同じ表示ルール(1サイン1行)に変更。
- DB変更: なし(detected_signs は text[] のまま。新しい文字列値が入るだけ)。ただしメール本文RPCの追随が必要 → migration 055(別途Greenへ適用)。
- 検証: `npx tsc --noEmit` エラー0件 / `npx vite build` 成功 / gaitSigns.ts の変換ロジックを実行して往復変換・旧形式読込・ラベルまとめを確認済み。**画面上の見た目・操作感は実機未確認**(ブラウザ操作環境が無いため)。
- 戻し方: このコミットのみ `git revert`。または Vercel で `81806f9` 時点の本番デプロイを Promote to Production。

## 2026-09-19(続き): 強弱4ボタンの見た目を微調整

- 変更前 HEAD: `c371d4e` / Vercel Production: https://customer-console-jade.vercel.app
- 冨永社長の指摘3点: ①左と右の境目が分かりづらい ②選択時のベタ塗り(緑・赤)の色が良くない ③強ボタンが横に大きすぎる。
- 変更(`client/src/pages/GaitAnalysis.tsx` の `SideButtons` のみ・ロジック不変): ①左強と右弱の間に縦線(`w-px` の細い灰色線)を追加 ②選択中はベタ塗りをやめ、やわらかいグラデーション+影(弱=エメラルド→ティール / 強=ローズ→ピンク)、未選択は淡い色地+細い枠に変更 ③強ボタンの幅を弱の2倍→1.5倍に縮小。
- 検証: `npx tsc --noEmit` エラー0件 / `npx vite build` 成功。見た目は実機未確認。
- 戻し方: このコミットのみ `git revert`。または Vercel で `c371d4e` 時点のデプロイを Promote to Production。

## 2026-09-19(続き2): 強弱の表記を「弱→±」「強→+」の記号に変更

- 変更前 HEAD: `c68d604` / Vercel Production: https://customer-console-jade.vercel.app
- 冨永社長指示: 「弱」「強」の文字が分かりづらい。弱=「±」(あるかどうか曖昧・わずかにある)、強=「+」(明らかにある)の記号にする。緑と赤の色分けと合わせて「+の方が強い」を表現する。
- 変更: `GaitAnalysis.tsx`(ボタン表記を 左± / 左+ / 右± / 右+、記号を読みやすく text-base、編集フォーム上部に凡例「± = あるかどうか曖昧・わずかにある / + = 明らかにある」を追加)、`lib/gaitSigns.ts`(結果サマリー等の表示ラベルを 左±/左+/右±/右+ に)。
- **表示だけの変更**: DBの保存値(`left_weak` / `left_strong` 等)は不変。過去に保存した分もそのまま新表記で表示される。
- **対象外(意図的)**: お客さん向け画面(upload-center)とお客さんへのメール本文は「左弱・左強」のままにしている。記号だけ(「左+」)ではお客さんに意味が伝わらないため。統一する場合は upload-center の `fetchMyFootAnalysis` のラベル表と migration 055 のRPCを変更する。
- 検証: `npx tsc --noEmit` エラー0件 / `npx vite build` 成功 / ラベル変換と保存値不変をスクリプトで確認。見た目は実機未確認。
- 戻し方: このコミットのみ `git revert`。または Vercel で `c68d604` 時点のデプロイを Promote to Production。

## 2026-09-19(続き3): ノーアームスイングサインも ± / + の2段階に変更

- 変更前 HEAD: `56d1412` / Vercel Production: https://customer-console-jade.vercel.app
- 冨永社長指示: ノーアームスイングは「腕を振っているか」の判定だが、「わずか・十分に振っていない」と「明らかに全く振っていない」を分ける必要がある。チェックボックスをやめ、他サインと同じ ± / + にする(左右の概念は無いので「±」「+」の2ボタンのみ)。
- 変更: `lib/gaitSigns.ts`(`SignSel.check`→`level`、保存値 `no_arm_swing:weak` / `:strong`、表示 ± / +)、`GaitAnalysis.tsx`(ボタンを `LevelButton` に共通化し、ノーアームスイングは ±/+ の2ボタン+説明「± = わずか・十分に振っていない / + = 明らかに全く振っていない」)。
- **旧データ**: 旧チェックボックスの保存値 `no_arm_swing:both` は「ない=明らかに振っていない」と判定していたはずなので、編集フォーム上は「+」として読み込む(保存し直すまでDBは `both` のまま)。Greenはローンチ前でテストデータのみ。
- 検証: `npx tsc --noEmit` エラー0件 / `npx vite build` 成功 / 変換ロジックをスクリプトで確認。見た目は実機未確認。
- 戻し方: このコミットのみ `git revert`。または Vercel で `56d1412` 時点のデプロイを Promote to Production。

## 2026-09-19(続き4): 動作分析の「最初の確定」時に、Make へ通知を依頼する処理を追加

- 変更前 HEAD: `d948d8e` / Vercel Production: https://customer-console-jade.vercel.app
- 背景: 動作分析を確定したとき、顧客Email・取扱店Emailへ自動通知する(冨永社長指示。手順書 = `spiralturn-green-integration/docs/39-analysis-notification-make-scenario.md`)。
- 変更: `client/src/lib/analysisNotify.ts`(新規。環境変数 `VITE_ANALYSIS_NOTIFY_WEBHOOK` の Make Webhook に `{ foot_analysis_id }` だけを POST。**未設定なら何もしない**)、`GaitAnalysis.tsx`(**最初の確定のときだけ**呼ぶ。修正後の再確定では呼ばない。通知が失敗しても確定は取り消さず警告トーストのみ)。
- **本番への影響: 現時点ではゼロ**(環境変数が未設定のため通知は行われない。Make シナリオ構築後に Vercel へ環境変数を設定して有効化)。
- 検証: `npx tsc --noEmit` エラー0件 / `npx vite build` 成功。実際の送信は Make 未構築のため未検証。
- 戻し方: このコミットのみ `git revert`。または Vercel で `d948d8e` 時点のデプロイを Promote to Production。

## 2026-09-19(続き5): 動作分析の確定通知を有効化(Vercel 環境変数 VITE_ANALYSIS_NOTIFY_WEBHOOK を設定して再デプロイ)

- 変更前 HEAD: `b03ff7b` / Vercel Production: https://customer-console-jade.vercel.app
- 背景: Make シナリオ `analysis_result_notification - Green`(ID 7497345)を Blueprint Import で構築し、テスト送信でメール到達・通信履歴記録まで確認済み(冨永社長「これでよい」)。「中途半端にせず完了させる」との指示で有効化する。
- 変更: コード変更なし。Vercel Production に `VITE_ANALYSIS_NOTIFY_WEBHOOK`(Make の Custom webhook URL。Non-sensitive・VITE のためブラウザに配信される準公開値)を追加し、再デプロイのためこの記録だけをコミットして push。
- **本番への影響**: 動作分析の「最初の確定」で、顧客Email(と、取扱店送信ONの注文は取扱店Email)へ通知が送られる。Make シナリオを ON にした時点から有効。
- 検証: 環境変数の追加を `vercel env ls` で確認。デプロイ後に本番バンドルへ URL が入ったことを確認する。
- 戻し方: Make シナリオを OFF にする(即時停止)。または Vercel の `VITE_ANALYSIS_NOTIFY_WEBHOOK` を削除して再デプロイ(UI は環境変数が無ければ何もしない)。
