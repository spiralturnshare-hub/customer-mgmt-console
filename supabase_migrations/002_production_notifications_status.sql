-- 通信履歴(メール/LINE)ログ・再送UI のための production_notifications 拡張
-- is_sent(boolean)だけでは「未送信/成功/失敗」を区別できないため status 列を追加。
-- 再送の追跡のため resend_of_id(自己参照)を追加。
-- 2026-08-26

ALTER TABLE production_notifications
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  ADD COLUMN IF NOT EXISTS resend_of_id uuid REFERENCES production_notifications(id);

COMMENT ON COLUMN production_notifications.status IS
  '送信ステータス。pending=未送信/送信待ち、sent=送信成功、failed=送信失敗';
COMMENT ON COLUMN production_notifications.resend_of_id IS
  '再送の場合、元になった通知レコードのid。新規送信の場合はnull';

-- ロールバック用:
-- ALTER TABLE production_notifications DROP COLUMN IF EXISTS status;
-- ALTER TABLE production_notifications DROP COLUMN IF EXISTS resend_of_id;
