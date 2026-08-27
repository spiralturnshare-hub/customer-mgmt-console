-- ============================================================
-- 006_permission_management.sql
-- 2026-08-27
--
-- system_membersには既に role('owner'等) と 7つのドメイン権限列
-- (perm_analysis/perm_measurement/perm_production/perm_shipping/
--  perm_customer/perm_organization/perm_member、値は 'none'/'view'/'edit'
--  の3段階を想定、既存データはowner1名がperm_*='edit')が存在する。
--
-- 今回追加するのは:
-- 1. オーナーは常に1名まで、というDB制約(role='owner'の行は1件のみ)
-- 2. perm_customer配下(顧客詳細画面)のうち、どの「枠」(カード)を見せるかを
--    細かく選べるようにする列(visible_customer_sections)
--
-- 権限設定画面(customer-mgmt-console)は本人指定によりオーナーのみが
-- 操作できるようにする(role='owner'のメンバーだけがアクセス可能)。
-- ============================================================

alter table system_members
  add column if not exists visible_customer_sections text[] not null default '{}'::text[];

comment on column system_members.visible_customer_sections is
  '顧客詳細画面でこのメンバーに見せる「枠」のキー一覧(perm_customerがnone以外の時のみ意味を持つ)。'
  '想定キー: customer_info, purpose_info, address_info, shoe_info, pain_info, tako_info, files, '
  'order_info, revision_history, communication_log';

-- オーナーは常に1名まで(role=''owner''の行を1件に制限)
create unique index if not exists system_members_single_owner
  on system_members (role)
  where role = 'owner';

-- ============================================================
-- ロールバック(このマイグレーションを取り消す場合)
-- ============================================================
-- drop index if exists system_members_single_owner;
-- alter table system_members drop column if exists visible_customer_sections;
