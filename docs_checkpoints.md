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

本番URL(常に最新を指す): https://customer-console-jade.vercel.app
