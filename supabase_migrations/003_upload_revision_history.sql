-- 顧客アップロードデータの改訂履歴(追記型・上書き禁止ポリシー)
-- 詳細方針: docs/10-customer-mgmt-console-vision-and-data-revision-policy.md
-- 2026-08-26

-- ============================================================
-- 1. 履歴テーブル: uploads本体を変更する直前の状態をスナップショット保存
-- ============================================================
CREATE TABLE IF NOT EXISTS upload_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid NOT NULL REFERENCES uploads(id),
  revision_number int NOT NULL,
  snapshot jsonb NOT NULL,
  changed_by_type text NOT NULL CHECK (changed_by_type IN ('customer', 'staff')),
  changed_by_id uuid,
  change_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (upload_id, revision_number)
);

COMMENT ON TABLE upload_revisions IS
  '顧客アップロードデータ(uploads)の変更履歴。変更の都度、変更前の全データをsnapshotへ保存してから本体を更新する(上書き・削除しない追記型ポリシー)';

CREATE INDEX IF NOT EXISTS idx_upload_revisions_upload_id ON upload_revisions(upload_id);

-- ============================================================
-- 2. uploads_files: 古いファイル行を削除せず「現在有効か」で管理
-- ============================================================
ALTER TABLE uploads_files
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN uploads_files.is_current IS
  '差し替え後の最新ファイルならtrue。差し替えられた旧ファイルはfalseにするが行は削除しない';

-- ============================================================
-- 3. RPC: uploads本体を安全に更新する(スナップショット保存+更新を1トランザクションで実行)
-- ============================================================
CREATE OR REPLACE FUNCTION update_upload_with_history(
  p_upload_id uuid,
  p_patch jsonb,
  p_changed_by_type text,
  p_changed_by_id uuid,
  p_change_reason text DEFAULT NULL
) RETURNS uploads
LANGUAGE plpgsql
AS $$
DECLARE
  v_old uploads;
  v_next_rev int;
  v_new uploads;
BEGIN
  IF p_changed_by_type NOT IN ('customer', 'staff') THEN
    RAISE EXCEPTION 'invalid changed_by_type: %', p_changed_by_type;
  END IF;

  SELECT * INTO v_old FROM uploads WHERE id = p_upload_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'upload % not found', p_upload_id;
  END IF;

  SELECT COALESCE(MAX(revision_number), 0) + 1 INTO v_next_rev
  FROM upload_revisions WHERE upload_id = p_upload_id;

  INSERT INTO upload_revisions (upload_id, revision_number, snapshot, changed_by_type, changed_by_id, change_reason)
  VALUES (p_upload_id, v_next_rev, to_jsonb(v_old), p_changed_by_type, p_changed_by_id, p_change_reason);

  UPDATE uploads SET
    order_name        = COALESCE(p_patch->>'order_name', order_name),
    status             = COALESCE(p_patch->>'status', status),
    insole_user_name   = COALESCE(p_patch->>'insole_user_name', insole_user_name),
    insole_user_kana   = COALESCE(p_patch->>'insole_user_kana', insole_user_kana),
    room_color         = COALESCE(p_patch->>'room_color', room_color),
    selected_insoles   = CASE WHEN p_patch ? 'selected_insoles'
                           THEN ARRAY(SELECT jsonb_array_elements_text(p_patch->'selected_insoles'))
                           ELSE selected_insoles END,
    shoe_infos         = COALESCE(p_patch->'shoe_infos', shoe_infos),
    pain_info          = COALESCE(p_patch->'pain_info', pain_info),
    purpose_info       = COALESCE(p_patch->'purpose_info', purpose_info),
    tako_info          = COALESCE(p_patch->'tako_info', tako_info),
    customer_info      = COALESCE(p_patch->'customer_info', customer_info),
    updated_at         = now()
  WHERE id = p_upload_id
  RETURNING * INTO v_new;

  RETURN v_new;
END;
$$;

COMMENT ON FUNCTION update_upload_with_history IS
  'uploadsを更新する唯一の正式な経路。更新前に必ずupload_revisionsへスナップショットを保存してから更新する。p_patchは変更したい列のみを含むjsonb(未指定の列は変更しない)';

-- ============================================================
-- 4. RPC: ファイル(写真・動画)を差し替える(旧ファイルは削除せずis_current=falseに)
-- ============================================================
CREATE OR REPLACE FUNCTION replace_upload_file(
  p_upload_id uuid,
  p_order_id uuid,
  p_user_id uuid,
  p_kind text,
  p_file_type text,
  p_url text,
  p_changed_by_type text,
  p_changed_by_id uuid
) RETURNS uploads_files
LANGUAGE plpgsql
AS $$
DECLARE
  v_new uploads_files;
BEGIN
  UPDATE uploads_files
  SET is_current = false, updated_at = now()
  WHERE upload_id = p_upload_id AND kind = p_kind AND is_current = true;

  INSERT INTO uploads_files (order_id, upload_id, user_id, status, file_type, kind, url, is_current, updated_at)
  VALUES (p_order_id, p_upload_id, p_user_id, 'active', p_file_type, p_kind, p_url, true, now())
  RETURNING * INTO v_new;

  INSERT INTO upload_revisions (upload_id, revision_number, snapshot, changed_by_type, changed_by_id, change_reason)
  VALUES (
    p_upload_id,
    (SELECT COALESCE(MAX(revision_number), 0) + 1 FROM upload_revisions WHERE upload_id = p_upload_id),
    jsonb_build_object('file_replaced', p_kind, 'new_url', p_url),
    p_changed_by_type,
    p_changed_by_id,
    'ファイル差し替え: ' || p_kind
  );

  RETURN v_new;
END;
$$;

COMMENT ON FUNCTION replace_upload_file IS
  '写真・動画を差し替える唯一の正式な経路。旧ファイルは削除せずis_current=falseにして残す';

-- ============================================================
-- 5. 実行権限(Green: PIIなし、anon/authenticated双方に許可)
-- ============================================================
GRANT EXECUTE ON FUNCTION update_upload_with_history TO anon, authenticated;
GRANT EXECUTE ON FUNCTION replace_upload_file TO anon, authenticated;
GRANT SELECT, INSERT ON upload_revisions TO anon, authenticated;

-- ロールバック用:
-- DROP FUNCTION IF EXISTS replace_upload_file;
-- DROP FUNCTION IF EXISTS update_upload_with_history;
-- ALTER TABLE uploads_files DROP COLUMN IF EXISTS is_current;
-- DROP TABLE IF EXISTS upload_revisions;
