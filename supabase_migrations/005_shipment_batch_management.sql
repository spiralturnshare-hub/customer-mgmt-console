-- ============================================================
-- 005_shipment_batch_management.sql
-- 2026-08-27
--
-- 配送管理(セッション単位の一括発送処理)機能のためのスキーマ追加。
-- shipment_batches/shipment_itemsは既存テーブル(Blue Glide由来、これまで
-- Green UIから未使用)。ここでは「顧客をセッションから外す・別セッションへ
-- 付け替える」操作を、物理削除ではなく無効化+新規追加で表現できるよう
-- 列を追加する(docs/10-customer-mgmt-console-vision-and-data-revision-policy.md
-- 2026-08-27追記2参照: 古い配送記録は残し、無効化した事実を後から追える必要がある)。
-- ============================================================

alter table shipment_items
  add column if not exists is_active boolean not null default true,
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by_member_id uuid,
  add column if not exists removed_reason text;

-- 1つのuploadにつき「有効な配送記録」は常に1件までに制約する
-- (同じ顧客を複数セッションに重複して有効割り当てすることを防ぐ)
create unique index if not exists shipment_items_upload_active_unique
  on shipment_items (upload_id)
  where is_active;

grant select, insert, update on shipment_items to anon, authenticated;
grant select, insert, update on shipment_batches to anon, authenticated;

-- ---- 顧客をセッションに追加する(既存の有効な配送記録があれば自動的に無効化してから追加) ----
create or replace function add_to_shipment_batch(
  p_batch_id uuid,
  p_upload_id uuid,
  p_order_id uuid,
  p_production_workflow_id uuid,
  p_customer_id uuid,
  p_changed_by_id uuid
) returns shipment_items
language plpgsql
as $$
declare
  v_new shipment_items;
begin
  -- 既に別(または同一)セッションに有効な配送記録がある場合は無効化する
  update shipment_items
  set
    is_active = false,
    removed_at = now(),
    removed_by_member_id = p_changed_by_id,
    removed_reason = '別セッションへの付け替え',
    updated_at = now()
  where upload_id = p_upload_id
    and is_active;

  insert into shipment_items
    (shipment_batch_id, upload_id, order_id, production_workflow_id, customer_id, is_active, is_shipped)
  values
    (p_batch_id, p_upload_id, p_order_id, p_production_workflow_id, p_customer_id, true, false)
  returning * into v_new;

  return v_new;
end;
$$;

grant execute on function add_to_shipment_batch(uuid, uuid, uuid, uuid, uuid, uuid) to anon, authenticated;

-- ---- 顧客をセッションから外す(無効化するのみ。物理削除はしない) ----
create or replace function remove_from_shipment_batch(
  p_shipment_item_id uuid,
  p_changed_by_id uuid,
  p_reason text default null
) returns shipment_items
language plpgsql
as $$
declare
  v_row shipment_items;
begin
  update shipment_items
  set
    is_active = false,
    removed_at = now(),
    removed_by_member_id = p_changed_by_id,
    removed_reason = coalesce(p_reason, 'セッションから削除'),
    updated_at = now()
  where id = p_shipment_item_id
  returning * into v_row;

  if not found then
    raise exception 'shipment_items row not found: %', p_shipment_item_id;
  end if;

  return v_row;
end;
$$;

grant execute on function remove_from_shipment_batch(uuid, uuid, text) to anon, authenticated;

-- ============================================================
-- ロールバック(このマイグレーションを取り消す場合)
-- ============================================================
-- drop function if exists remove_from_shipment_batch(uuid, uuid, text);
-- drop function if exists add_to_shipment_batch(uuid, uuid, uuid, uuid, uuid, uuid);
-- drop index if exists shipment_items_upload_active_unique;
-- alter table shipment_items drop column if exists is_active, drop column if exists removed_at, drop column if exists removed_by_member_id, drop column if exists removed_reason;
