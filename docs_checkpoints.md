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
- コミット: (このコミット後に追記)
- 内容: 別ページ(GaitAnalysis.tsx)への遷移が不便という指摘を受け、動作分析結果のサマリー(検出サイン一覧・完了ステータス)と「修正する」ボタンを顧客詳細トップ画面、通信履歴セクションの直上に表示するよう追加(`AnalysisResultSection`)。詳細な編集自体は引き続き別ページで行う。
  - `sendAnalysisResultNotification`関数を追加し、分析結果メールを任意の宛先(画面入力)へ送信キュー登録できるようにした。送信元アドレスは`noreply@insoleorder.jp`を予定(本人指定、`NOTIFICATION_SENDER_EMAIL`定数としてコード内に記録)。
  - **重要な制約**: 今回はPhase 1(送信キューへの登録のみ)。実際のメール送信処理(Phase 2)は未実装であり、別途構築が必要。

本番URL(常に最新を指す): https://customer-console-jade.vercel.app
