-- ============================================================
-- 004_measurement_and_analysis_revision_history.sql
-- 2026-08-27
--
-- foot_measurements(足の計測)・foot_analyses(動作分析)にも、
-- upload_revisions(003)と同じ「スナップショット保存+RPCによる原子的更新」の
-- 改訂履歴パターンを適用する。
--
-- 重要方針(2026-08-27本人指定、docs/10-customer-mgmt-console-vision-and-data-revision-policy.md参照):
--   履歴データの保存だけでは不十分で、customer-mgmt-consoleのUIから
--   即座に閲覧できて初めて実用的。データ保存とUIでの閲覧はセットで実装すること。
-- ============================================================

-- ---- foot_measurements 改訂履歴テーブル ----
create table if not exists foot_measurement_revisions (
  id uuid primary key default gen_random_uuid(),
  foot_measurement_id uuid not null references foot_measurements(id) on delete cascade,
  revision_number int not null,
  snapshot jsonb not null,
  changed_by_type text not null check (changed_by_type in ('staff', 'customer')),
  changed_by_id uuid,
  change_reason text,
  created_at timestamptz not null default now(),
  unique (foot_measurement_id, revision_number)
);

grant select, insert on foot_measurement_revisions to anon, authenticated;

-- ---- foot_analyses 改訂履歴テーブル ----
create table if not exists foot_analysis_revisions (
  id uuid primary key default gen_random_uuid(),
  foot_analysis_id uuid not null references foot_analyses(id) on delete cascade,
  revision_number int not null,
  snapshot jsonb not null,
  changed_by_type text not null check (changed_by_type in ('staff', 'customer')),
  changed_by_id uuid,
  change_reason text,
  created_at timestamptz not null default now(),
  unique (foot_analysis_id, revision_number)
);

grant select, insert on foot_analysis_revisions to anon, authenticated;

-- ---- foot_measurements 更新RPC(スナップショット保存 → 更新を1トランザクションで実行) ----
create or replace function update_foot_measurement_with_history(
  p_measurement_id uuid,
  p_patch jsonb,
  p_changed_by_type text,
  p_changed_by_id uuid,
  p_change_reason text default null
) returns foot_measurements
language plpgsql
as $$
declare
  v_old foot_measurements;
  v_new foot_measurements;
  v_next_rev int;
begin
  select * into v_old from foot_measurements where id = p_measurement_id;
  if not found then
    raise exception 'foot_measurements row not found: %', p_measurement_id;
  end if;

  select coalesce(max(revision_number), 0) + 1 into v_next_rev
  from foot_measurement_revisions
  where foot_measurement_id = p_measurement_id;

  insert into foot_measurement_revisions
    (foot_measurement_id, revision_number, snapshot, changed_by_type, changed_by_id, change_reason)
  values
    (p_measurement_id, v_next_rev, to_jsonb(v_old), p_changed_by_type, p_changed_by_id, p_change_reason);

  update foot_measurements
  set
    points_json = coalesce(p_patch->'points_json', points_json),
    flex_unit1_json = coalesce(p_patch->'flex_unit1_json', flex_unit1_json),
    flex_unit2_json = coalesce(p_patch->'flex_unit2_json', flex_unit2_json),
    left_foot_length = coalesce((p_patch->>'left_foot_length')::real, left_foot_length),
    right_foot_length = coalesce((p_patch->>'right_foot_length')::real, right_foot_length),
    left_foot_width = coalesce((p_patch->>'left_foot_width')::real, left_foot_width),
    right_foot_width = coalesce((p_patch->>'right_foot_width')::real, right_foot_width),
    left_heel_to_mp = coalesce((p_patch->>'left_heel_to_mp')::real, left_heel_to_mp),
    right_heel_to_mp = coalesce((p_patch->>'right_heel_to_mp')::real, right_heel_to_mp),
    left_first_ip = coalesce((p_patch->>'left_first_ip')::real, left_first_ip),
    right_first_ip = coalesce((p_patch->>'right_first_ip')::real, right_first_ip),
    left_leb = coalesce((p_patch->>'left_leb')::real, left_leb),
    right_leb = coalesce((p_patch->>'right_leb')::real, right_leb),
    regression_result_json = coalesce(p_patch->'regression_result_json', regression_result_json),
    status = coalesce(p_patch->>'status', status),
    paper_type = coalesce(p_patch->>'paper_type', paper_type),
    hallux_valgus_left = coalesce((p_patch->>'hallux_valgus_left')::int, hallux_valgus_left),
    hallux_valgus_right = coalesce((p_patch->>'hallux_valgus_right')::int, hallux_valgus_right),
    quintus_toe_left = coalesce((p_patch->>'quintus_toe_left')::int, quintus_toe_left),
    quintus_toe_right = coalesce((p_patch->>'quintus_toe_right')::int, quintus_toe_right),
    claw_toe_left = coalesce((p_patch->>'claw_toe_left')::int, claw_toe_left),
    claw_toe_right = coalesce((p_patch->>'claw_toe_right')::int, claw_toe_right),
    insole_points_json = coalesce(p_patch->'insole_points_json', insole_points_json),
    insole_length = coalesce((p_patch->>'insole_length')::real, insole_length),
    insole_paper_type = coalesce(p_patch->>'insole_paper_type', insole_paper_type),
    updated_at = now()
  where id = p_measurement_id
  returning * into v_new;

  return v_new;
end;
$$;

grant execute on function update_foot_measurement_with_history(uuid, jsonb, text, uuid, text) to anon, authenticated;

-- ---- foot_analyses 更新RPC(スナップショット保存 → 更新を1トランザクションで実行) ----
create or replace function update_foot_analysis_with_history(
  p_analysis_id uuid,
  p_detected_signs text[],
  p_mark_completed boolean,
  p_operator_member_id uuid,
  p_changed_by_type text,
  p_changed_by_id uuid,
  p_change_reason text default null
) returns foot_analyses
language plpgsql
as $$
declare
  v_old foot_analyses;
  v_new foot_analyses;
  v_next_rev int;
begin
  select * into v_old from foot_analyses where id = p_analysis_id;
  if not found then
    raise exception 'foot_analyses row not found: %', p_analysis_id;
  end if;

  select coalesce(max(revision_number), 0) + 1 into v_next_rev
  from foot_analysis_revisions
  where foot_analysis_id = p_analysis_id;

  insert into foot_analysis_revisions
    (foot_analysis_id, revision_number, snapshot, changed_by_type, changed_by_id, change_reason)
  values
    (p_analysis_id, v_next_rev, to_jsonb(v_old), p_changed_by_type, p_changed_by_id, p_change_reason);

  update foot_analyses
  set
    detected_signs = coalesce(p_detected_signs, detected_signs),
    is_completed = case when p_mark_completed then true else is_completed end,
    completed_at = case when p_mark_completed then now() else completed_at end,
    analyzed_at = case when p_mark_completed then now() else analyzed_at end,
    operator_member_id = case when p_mark_completed then coalesce(p_operator_member_id, operator_member_id) else operator_member_id end,
    updated_at = now()
  where id = p_analysis_id
  returning * into v_new;

  return v_new;
end;
$$;

grant execute on function update_foot_analysis_with_history(uuid, text[], boolean, uuid, text, uuid, text) to anon, authenticated;

-- ============================================================
-- ロールバック(このマイグレーションを取り消す場合)
-- ============================================================
-- drop function if exists update_foot_analysis_with_history(uuid, text[], boolean, uuid, text, uuid, text);
-- drop function if exists update_foot_measurement_with_history(uuid, jsonb, text, uuid, text);
-- drop table if exists foot_analysis_revisions;
-- drop table if exists foot_measurement_revisions;
