// ============================================================
// SPIRAL TURN - Supabase クライアント設定（customer-console）
// Green Supabase: fhamrkmsxidxayaoexso
// ============================================================
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://fhamrkmsxidxayaoexso.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoYW1ya21zeGlkeGF5YW9leHNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2OTcwMTMsImV4cCI6MjEwMDI3MzAxM30.7GRn0m2SO3BzNQLQAb8dbREpoC8ewSIMLU2gWMIHp5I';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// ============================================================
// uploads テーブルの型定義
// upload-centerから送信されたデータを表示するためのもの
// ============================================================
export interface UploadRecord {
  id: string;
  created_at: string;
  updated_at: string;
  order_id: string | null;
  user_id: string | null;
  organization_id: string | null;
  order_name: string | null;
  selected_insoles: string[] | null;
  status: string | null;
  insole_user_name: string | null;
  insole_user_kana: string | null;
  guest_tf: boolean | null;
  previous_design_tf: boolean | null;
  room_color: string | null;
  // Step3-7 で収集したデータ（jsonb）
  shoe_infos: Record<string, unknown> | null;
  pain_info: Record<string, unknown> | null;
  purpose_info: Record<string, unknown> | null;
  tako_info: Record<string, unknown> | null;
  customer_info: Record<string, unknown> | null;
}

// ============================================================
// uploads テーブル操作
// ============================================================

/**
 * 全アップロード一覧を取得（作製中一覧用）
 * status が 'submitted' または 'in_progress' のものを新しい順に返す
 */
export async function fetchUploads(options?: {
  organizationId?: string;
  status?: string[];
  limit?: number;
}): Promise<UploadRecord[]> {
  let query = supabase
    .from('uploads')
    .select(
      `id, created_at, updated_at, order_id, user_id, organization_id,
       order_name, selected_insoles, status,
       insole_user_name, insole_user_kana,
       guest_tf, previous_design_tf, room_color,
       shoe_infos, pain_info, purpose_info, tako_info, customer_info`
    )
    .order('created_at', { ascending: false });

  if (options?.organizationId) {
    query = query.eq('organization_id', options.organizationId);
  }
  if (options?.status && options.status.length > 0) {
    query = query.in('status', options.status);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as UploadRecord[];
}

/**
 * 特定のアップロードを取得（詳細画面用）
 */
export async function fetchUploadById(id: string): Promise<UploadRecord | null> {
  const { data, error } = await supabase
    .from('uploads')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as UploadRecord;
}

/**
 * アップロードのステータスを更新
 */
export async function updateUploadStatus(
  id: string,
  status: string
): Promise<void> {
  const { error } = await supabase
    .from('uploads')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ============================================================
// upload_revisions - 顧客アップロードデータの改訂履歴
// 方針: docs/10-customer-mgmt-console-vision-and-data-revision-policy.md
// 上書き・削除はせず、変更のたびにupload_revisionsへスナップショットを残す。
// customer-mgmt-console(スタッフ側)は工程の状態に関わらず常に編集可能。
// ============================================================
export interface UploadRevision {
  id: string;
  upload_id: string;
  revision_number: number;
  snapshot: Record<string, unknown>;
  changed_by_type: 'customer' | 'staff';
  changed_by_id: string | null;
  change_reason: string | null;
  created_at: string;
}

/** 指定uploadの変更履歴を新しい順に取得 */
export async function fetchUploadRevisions(uploadId: string): Promise<UploadRevision[]> {
  const { data, error } = await supabase
    .from('upload_revisions')
    .select('*')
    .eq('upload_id', uploadId)
    .order('revision_number', { ascending: false });
  if (error) throw error;
  return (data ?? []) as UploadRevision[];
}

/**
 * uploadsを更新する唯一の正式な経路(RPC経由)。
 * patchには変更したい列のみを渡す(未指定の列は変わらない)。
 * 呼び出し前に必ず変更前の状態をupload_revisionsへ保存してから更新するため、
 * このRPC以外でuploadsへUPDATEをかけないこと。
 */
export async function updateUploadWithHistory(
  uploadId: string,
  patch: Partial<
    Pick<
      UploadRecord,
      | 'order_name' | 'status' | 'insole_user_name' | 'insole_user_kana' | 'room_color'
      | 'selected_insoles' | 'shoe_infos' | 'pain_info' | 'purpose_info' | 'tako_info' | 'customer_info'
    >
  >,
  changedById: string | null,
  changeReason?: string
): Promise<UploadRecord> {
  const { data, error } = await supabase.rpc('update_upload_with_history', {
    p_upload_id: uploadId,
    p_patch: patch,
    p_changed_by_type: 'staff',
    p_changed_by_id: changedById,
    p_change_reason: changeReason ?? null,
  });
  if (error) throw error;
  return data as UploadRecord;
}

/**
 * スタッフによる写真・動画の差し替え用ストレージアップロード。
 * upload-center側と同じバケット(upsys)・パス規則(userSegment/live/uploadId/kind/fileId/filename)を用い、
 * upsert:falseで既存ファイルへの上書きを防ぐ(常に新しいパスに保存する)。
 */
export async function uploadReplacementFileToStorage(
  file: File,
  uploadId: string,
  kind: string,
  userId: string | null
): Promise<{ path: string; url: string }> {
  const userSegment = userId ?? 'staff';
  const fileId = crypto.randomUUID();
  const ext = file.name.split('.').pop() ?? '';
  const filename = ext ? `${fileId}.${ext}` : fileId;
  const storagePath = `${userSegment}/live/${uploadId}/${kind}/${fileId}/${filename}`;

  const { error } = await supabase.storage.from('upsys').upload(storagePath, file, { upsert: false });
  if (error) throw error;

  const { data: urlData } = supabase.storage.from('upsys').getPublicUrl(storagePath);
  return { path: storagePath, url: urlData.publicUrl };
}

/**
 * 写真・動画を差し替える唯一の正式な経路(RPC経由)。
 * 旧ファイルは削除せずis_current=falseとして残る。
 */
export async function replaceUploadFile(params: {
  uploadId: string;
  orderId: string | null;
  userId: string | null;
  kind: string;
  fileType: string;
  url: string;
  changedById: string | null;
}): Promise<UploadFileRecord> {
  const { data, error } = await supabase.rpc('replace_upload_file', {
    p_upload_id: params.uploadId,
    p_order_id: params.orderId,
    p_user_id: params.userId,
    p_kind: params.kind,
    p_file_type: params.fileType,
    p_url: params.url,
    p_changed_by_type: 'staff',
    p_changed_by_id: params.changedById,
  });
  if (error) throw error;
  return data as UploadFileRecord;
}

// ============================================================
// uploads_files テーブル操作（ファイルURL取得）
// ============================================================
export interface UploadFileRecord {
  id: string;
  order_id: string | null;
  upload_id: string | null;
  user_id: string | null;
  status: string | null;
  file_type: string | null;
  kind: string | null;
  url: string | null;
  updated_at: string | null;
  is_current: boolean;
}

/** 現在有効なファイルのみ(is_current=true)を取得(表示用) */
export async function fetchUploadFiles(uploadId: string): Promise<UploadFileRecord[]> {
  const { data, error } = await supabase
    .from('uploads_files')
    .select('id, order_id, upload_id, user_id, status, file_type, kind, url, updated_at, is_current')
    .eq('upload_id', uploadId)
    .eq('is_current', true)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as UploadFileRecord[];
}

/** 差し替えられた過去のファイル(is_current=false)も含めた全履歴を取得 */
export async function fetchAllUploadFilesIncludingHistory(uploadId: string): Promise<UploadFileRecord[]> {
  const { data, error } = await supabase
    .from('uploads_files')
    .select('id, order_id, upload_id, user_id, status, file_type, kind, url, updated_at, is_current')
    .eq('upload_id', uploadId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as UploadFileRecord[];
}

// ============================================================
// 認証 - Magic Link
// ============================================================
export async function sendMagicLink(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/`,
    },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}

// ============================================================
// system_members - ログイン中の担当者情報
// ============================================================
export async function fetchCurrentMember(authUserId: string): Promise<{ id: string; name: string } | null> {
  const { data, error } = await supabase
    .from('system_members')
    .select('id, name')
    .eq('auth_user_id', authUserId)
    .single();
  if (error || !data) return null;
  return data as { id: string; name: string };
}

async function fetchMemberNames(memberIds: string[]): Promise<Record<string, string>> {
  const ids = Array.from(new Set(memberIds.filter(Boolean)));
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from('system_members')
    .select('id, name')
    .in('id', ids);
  if (error || !data) return {};
  return Object.fromEntries(data.map((m: { id: string; name: string }) => [m.id, m.name]));
}

/** system_members.id(担当者ID)から名前を解決する(fetchCurrentMemberはauth_user_id起点のため別関数として用意) */
export async function fetchMemberNameById(memberId: string | null): Promise<string | null> {
  if (!memberId) return null;
  const { data, error } = await supabase
    .from('system_members')
    .select('id, name')
    .eq('id', memberId)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { id: string; name: string }).name;
}

// ============================================================
// production_workflows - 工程進捗(計測/分析/設計/作製/発送)
// ============================================================
export type WorkflowStep = 'measure' | 'analy' | 'design' | 'produce' | 'ship';

export interface ProductionWorkflow {
  id: string;
  order_id: string | null;
  upload_id: string | null;
  measurement_id: string | null;
  status: string | null;
  measure_done: boolean | null;
  measure_at: string | null;
  measure_by: string | null;
  analy_done: boolean | null;
  analy_at: string | null;
  analy_by: string | null;
  design_done: boolean | null;
  design_at: string | null;
  design_by: string | null;
  produce_done: boolean | null;
  produce_at: string | null;
  produce_by: string | null;
  ship_done: boolean | null;
  ship_at: string | null;
  ship_by: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
}

export interface WorkflowStepDisplay {
  step: WorkflowStep;
  label: string;
  done: boolean;
  at: string | null;
  byName: string | null;
}

/**
 * 複数upload_idのproduction_workflowsを一括取得し、upload_idをキーにしたMapで返す
 * (作製中一覧画面で1件ずつ問い合わせるとN+1になるため)
 */
export async function fetchWorkflowsByUploadIds(uploadIds: string[]): Promise<Map<string, ProductionWorkflow>> {
  if (uploadIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('production_workflows')
    .select('*')
    .in('upload_id', uploadIds);
  if (error) throw error;
  const map = new Map<string, ProductionWorkflow>();
  for (const row of (data ?? []) as ProductionWorkflow[]) {
    if (row.upload_id) map.set(row.upload_id, row);
  }
  return map;
}

/** upload_idに紐づくproduction_workflowを取得(無ければnull) */
export async function fetchWorkflowByUploadId(uploadId: string): Promise<ProductionWorkflow | null> {
  const { data, error } = await supabase
    .from('production_workflows')
    .select('*')
    .eq('upload_id', uploadId)
    .maybeSingle();
  if (error) throw error;
  return data as ProductionWorkflow | null;
}

/**
 * upload_idに紐づくproduction_workflowを取得し、無ければ最小構成で新規作成して返す。
 * foot_analyses.production_id(NOT NULL)を満たすために、動作分析の保存前に必ず呼ぶ。
 */
export async function ensureProductionWorkflow(
  uploadId: string,
  orderId: string | null
): Promise<ProductionWorkflow> {
  const existing = await fetchWorkflowByUploadId(uploadId);
  if (existing) return existing;
  const { data, error } = await supabase
    .from('production_workflows')
    .insert({ upload_id: uploadId, order_id: orderId })
    .select()
    .single();
  if (error) throw error;
  return data as ProductionWorkflow;
}

const STEP_LABELS: Record<WorkflowStep, string> = {
  measure: '計測',
  analy: '分析',
  design: '設計',
  produce: '作製',
  ship: '発送',
};

/** ProductionWorkflow → 画面表示用の5ステップ配列(担当者名を解決済み) */
export async function toStepDisplays(wf: ProductionWorkflow | null): Promise<WorkflowStepDisplay[]> {
  const steps: WorkflowStep[] = ['measure', 'analy', 'design', 'produce', 'ship'];
  const byIds = steps.map((s) => wf?.[`${s}_by` as keyof ProductionWorkflow] as string | null).filter(Boolean) as string[];
  const names = await fetchMemberNames(byIds);
  return steps.map((s) => ({
    step: s,
    label: STEP_LABELS[s],
    done: Boolean(wf?.[`${s}_done` as keyof ProductionWorkflow]),
    at: (wf?.[`${s}_at` as keyof ProductionWorkflow] as string | null) ?? null,
    byName: (() => {
      const byId = wf?.[`${s}_by` as keyof ProductionWorkflow] as string | null;
      return byId ? (names[byId] ?? null) : null;
    })(),
  }));
}

/**
 * 工程ステップの完了状態を切り替える。
 * ONにする時は現在日時+担当者を記録、OFFに戻す時はクリアする。
 * production_workflowsレコードが無い場合はuploadIdを起点に新規作成する。
 */
export async function toggleWorkflowStep(
  uploadId: string,
  orderId: string | null,
  step: WorkflowStep,
  nextDone: boolean,
  memberId: string | null
): Promise<ProductionWorkflow> {
  const patch: Record<string, unknown> = {
    [`${step}_done`]: nextDone,
    [`${step}_at`]: nextDone ? new Date().toISOString() : null,
    [`${step}_by`]: nextDone ? memberId : null,
    updated_at: new Date().toISOString(),
  };

  const existing = await fetchWorkflowByUploadId(uploadId);
  if (existing) {
    const { data, error } = await supabase
      .from('production_workflows')
      .update(patch)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data as ProductionWorkflow;
  }

  const { data, error } = await supabase
    .from('production_workflows')
    .insert({ upload_id: uploadId, order_id: orderId, ...patch })
    .select()
    .single();
  if (error) throw error;
  return data as ProductionWorkflow;
}

/**
 * 配送管理: 追跡番号を保存する(発送完了マークとは独立して、発送前でも編集可能)。
 */
export async function saveTrackingNumber(
  uploadId: string,
  orderId: string | null,
  trackingNumber: string
): Promise<ProductionWorkflow> {
  const patch = { tracking_number: trackingNumber || null, updated_at: new Date().toISOString() };
  const existing = await fetchWorkflowByUploadId(uploadId);
  if (existing) {
    const { data, error } = await supabase
      .from('production_workflows')
      .update(patch)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data as ProductionWorkflow;
  }
  const { data, error } = await supabase
    .from('production_workflows')
    .insert({ upload_id: uploadId, order_id: orderId, ...patch })
    .select()
    .single();
  if (error) throw error;
  return data as ProductionWorkflow;
}

/**
 * 配送管理: 発送完了/取り消しを切り替える。
 * 完了時: ship_done/ship_at/ship_by(工程進捗の一般形式)に加え、
 * 発送実績の専用列shipped_atも同時刻で記録する。
 */
export async function toggleShipped(
  uploadId: string,
  orderId: string | null,
  nextDone: boolean,
  memberId: string | null
): Promise<ProductionWorkflow> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    ship_done: nextDone,
    ship_at: nextDone ? now : null,
    ship_by: nextDone ? memberId : null,
    shipped_at: nextDone ? now : null,
    updated_at: now,
  };
  const existing = await fetchWorkflowByUploadId(uploadId);
  if (existing) {
    const { data, error } = await supabase
      .from('production_workflows')
      .update(patch)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data as ProductionWorkflow;
  }
  const { data, error } = await supabase
    .from('production_workflows')
    .insert({ upload_id: uploadId, order_id: orderId, ...patch })
    .select()
    .single();
  if (error) throw error;
  return data as ProductionWorkflow;
}

// ============================================================
// foot_measurements - 足の計測結果
// 2026-08-27: 顧客詳細トップ画面に計測結果サマリー・測り直しボタン・
// 変更履歴を表示するために追加。改訂履歴はfoot_measurement_revisions
// (upload_revisionsと同じ「上書き禁止・スナップショット保存」方式)。
// ============================================================
export interface FootMeasurementRow {
  id: string;
  upload_id: string | null;
  order_id: string | null;
  status: string;
  measured_at: string | null;
  left_foot_length: number | null;
  right_foot_length: number | null;
  left_foot_width: number | null;
  right_foot_width: number | null;
  left_heel_to_mp: number | null;
  right_heel_to_mp: number | null;
  left_first_ip: number | null;
  right_first_ip: number | null;
  left_leb: number | null;
  right_leb: number | null;
  insole_size: string | null;
  shoe_size: string | null;
  shoe_brand: string | null;
}

/** 複数upload_idの計測結果を一括取得し、upload_idをキーにしたMapで返す(作製中一覧用) */
export async function fetchMeasurementsByUploadIds(uploadIds: string[]): Promise<Map<string, FootMeasurementRow>> {
  if (uploadIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('foot_measurements')
    .select(
      'id, upload_id, order_id, status, measured_at, left_foot_length, right_foot_length, left_foot_width, right_foot_width, left_heel_to_mp, right_heel_to_mp, left_first_ip, right_first_ip, left_leb, right_leb, insole_size, shoe_size, shoe_brand'
    )
    .in('upload_id', uploadIds);
  if (error) throw error;
  const map = new Map<string, FootMeasurementRow>();
  for (const row of (data ?? []) as FootMeasurementRow[]) {
    if (row.upload_id) map.set(row.upload_id, row);
  }
  return map;
}

/** upload_idに紐づく計測結果を取得(無ければnull) */
export async function fetchMeasurementByUploadId(uploadId: string): Promise<FootMeasurementRow | null> {
  const { data, error } = await supabase
    .from('foot_measurements')
    .select(
      'id, upload_id, order_id, status, measured_at, left_foot_length, right_foot_length, left_foot_width, right_foot_width, left_heel_to_mp, right_heel_to_mp, left_first_ip, right_first_ip, left_leb, right_leb, insole_size, shoe_size, shoe_brand'
    )
    .eq('upload_id', uploadId)
    .maybeSingle();
  if (error) throw error;
  return data as FootMeasurementRow | null;
}

// ============================================================
// foot_measurement_revisions / foot_analysis_revisions - 計測・分析の改訂履歴
// upload_revisionsと同じパターン。保存だけでなく、customer-mgmt-consoleの
// UIから即座に閲覧できることが必須方針(docs/10-...md 2026-08-27追記参照)。
// ============================================================
export interface MeasurementRevision {
  id: string;
  foot_measurement_id: string;
  revision_number: number;
  snapshot: Record<string, unknown>;
  changed_by_type: 'customer' | 'staff';
  changed_by_id: string | null;
  change_reason: string | null;
  created_at: string;
}

/** 指定計測の変更履歴を新しい順に取得 */
export async function fetchMeasurementRevisions(measurementId: string): Promise<MeasurementRevision[]> {
  const { data, error } = await supabase
    .from('foot_measurement_revisions')
    .select('*')
    .eq('foot_measurement_id', measurementId)
    .order('revision_number', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MeasurementRevision[];
}

export interface AnalysisRevision {
  id: string;
  foot_analysis_id: string;
  revision_number: number;
  snapshot: Record<string, unknown>;
  changed_by_type: 'customer' | 'staff';
  changed_by_id: string | null;
  change_reason: string | null;
  created_at: string;
}

/** 指定動作分析の変更履歴を新しい順に取得 */
export async function fetchAnalysisRevisions(analysisId: string): Promise<AnalysisRevision[]> {
  const { data, error } = await supabase
    .from('foot_analysis_revisions')
    .select('*')
    .eq('foot_analysis_id', analysisId)
    .order('revision_number', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AnalysisRevision[];
}

// ============================================================
// analysis_signs / foot_analyses - 動作分析
// ============================================================
export type SignSide = 'left' | 'right' | 'both';

export interface AnalysisSign {
  key: string;
  side: string | null;
  region: string | null;
  header: string | null;
  title: string;
  p_analytics: string | null;
  p_measure: string | null;
  exercise_header: string | null;
  howto: string | null;
  caution: string | null;
  frequency: string | null;
  image_url: string | null;
  point: number | null;
  display_index: number | null;
}

export interface FootAnalysis {
  id: string;
  order_id: string | null;
  upload_id: string | null;
  user_id: string | null;
  detected_signs: string[] | null;
  total_score: number | null;
  deduction_score: number | null;
  walk_video_url: string | null;
  item_video1_url: string | null;
  item_video2_url: string | null;
  is_completed: boolean | null;
  completed_at: string | null;
  editor_user_id: string | null;
  operator_member_id: string | null;
  analyzed_at: string | null;
}

/** サインのマスタ一覧を表示順で取得 */
export async function fetchAnalysisSigns(): Promise<AnalysisSign[]> {
  const { data, error } = await supabase
    .from('analysis_signs')
    .select('*')
    .order('display_index', { ascending: true });
  if (error) throw error;
  return (data ?? []) as AnalysisSign[];
}

/** upload_idに紐づく分析結果を取得(無ければnull) */
export async function fetchFootAnalysisByUploadId(uploadId: string): Promise<FootAnalysis | null> {
  const { data, error } = await supabase
    .from('foot_analyses')
    .select('*')
    .eq('upload_id', uploadId)
    .maybeSingle();
  if (error) throw error;
  return data as FootAnalysis | null;
}

/**
 * 検出サイン(detected_signsのキー配列。例: "shoulder_swing_left"のように
 * サインkeyとside(left/right/both)を組み合わせたIDで保存する)を保存する。
 * 未完成(下書き)保存であり、is_completed確定は別途明示的に行う。
 */
export async function saveDetectedSigns(
  uploadId: string,
  orderId: string | null,
  userId: string | null,
  productionId: string,
  detectedSigns: string[],
  changedById: string | null
): Promise<FootAnalysis> {
  const existing = await fetchFootAnalysisByUploadId(uploadId);
  if (existing) {
    // 既存行の更新は改訂履歴RPC経由(呼び出し前のスナップショットをfoot_analysis_revisionsへ保存してから更新)
    const { data, error } = await supabase.rpc('update_foot_analysis_with_history', {
      p_analysis_id: existing.id,
      p_detected_signs: detectedSigns,
      p_mark_completed: false,
      p_operator_member_id: null,
      p_changed_by_type: 'staff',
      p_changed_by_id: changedById,
      p_change_reason: '検出サインの下書き保存',
    });
    if (error) throw error;
    return data as FootAnalysis;
  }
  // 新規作成はスナップショットする対象が無いため、そのままinsertでよい
  const { data, error } = await supabase
    .from('foot_analyses')
    .insert({
      upload_id: uploadId,
      order_id: orderId,
      user_id: userId,
      production_id: productionId,
      detected_signs: detectedSigns,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as FootAnalysis;
}

// ============================================================
// production_notifications - 通信履歴(メール/LINE送信ログ)・再送
// Glide prod_d_line_notify の受け入れ先。工程中に担当者が顧客へ送るLINE/メール通知の履歴。
// 2026-08-26: status/resend_of_id列を追加(is_sentのみでは失敗を区別できないため)
// ============================================================
export type NotificationStatus = 'pending' | 'sent' | 'failed';

export interface CommunicationLog {
  id: string;
  order_id: string | null;
  production_workflow_id: string | null;
  upload_id: string | null;
  customer_id: string | null;
  notify_type: string | null;
  contents: string | null;
  note: string | null;
  notify_kind: string | null;
  notify_to: string | null;
  is_sent: boolean;
  status: NotificationStatus;
  is_custom_email: boolean;
  editor_user_id: string | null;
  resend_of_id: string | null;
  created_at: string;
  updated_at: string;
}

/** upload_idに紐づく通信履歴を新しい順に取得 */
export async function fetchCommunicationLogsByUploadId(uploadId: string): Promise<CommunicationLog[]> {
  const { data, error } = await supabase
    .from('production_notifications')
    .select('*')
    .eq('upload_id', uploadId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CommunicationLog[];
}

/**
 * 通信履歴を再送キューに登録する。
 * 注意: 現時点(2026-08-26)ではGreen側に実際の送信処理(メール/LINE送信本体)が
 * まだ実装されていないため、この関数はstatus='pending'の新規レコードを作るのみで、
 * 実際の送信はフェーズ2(送信処理本体の実装)完了後に行われる。
 */
export async function resendCommunicationLog(
  original: CommunicationLog,
  editorUserId: string | null
): Promise<CommunicationLog> {
  const { data, error } = await supabase
    .from('production_notifications')
    .insert({
      order_id: original.order_id,
      production_workflow_id: original.production_workflow_id,
      upload_id: original.upload_id,
      customer_id: original.customer_id,
      notify_type: original.notify_type,
      contents: original.contents,
      notify_kind: original.notify_kind,
      notify_to: original.notify_to,
      is_sent: false,
      status: 'pending',
      is_custom_email: original.is_custom_email,
      is_favorited: false,
      editor_user_id: editorUserId,
      resend_of_id: original.id,
    })
    .select()
    .single();
  if (error) throw error;
  return data as CommunicationLog;
}

/**
 * 通知メールの送信元アドレス(Phase 2の実送信処理実装時に使用する固定値)。
 * 2026-08-26 本人指定: noreply@insoleorder.jp
 */
export const NOTIFICATION_SENDER_EMAIL = 'noreply@insoleorder.jp';

/**
 * 動作分析結果メールを送信キューに登録する(再送・任意メール宛の新規送信の両方に対応)。
 * 注意: resendCommunicationLogと同様、現時点ではキュー登録のみ。実送信はフェーズ2で実装する。
 */
export async function sendAnalysisResultNotification(params: {
  orderId: string | null;
  uploadId: string;
  customerId: string | null;
  toEmail: string;
  isCustomEmail: boolean;
  editorUserId: string | null;
}): Promise<CommunicationLog> {
  const { data, error } = await supabase
    .from('production_notifications')
    .insert({
      order_id: params.orderId,
      upload_id: params.uploadId,
      customer_id: params.customerId,
      notify_type: '分析結果',
      notify_kind: 'email',
      notify_to: params.toEmail,
      is_sent: false,
      status: 'pending',
      is_custom_email: params.isCustomEmail,
      is_favorited: false,
      editor_user_id: params.editorUserId,
      resend_of_id: null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as CommunicationLog;
}

/**
 * 分析完了として確定する(完了フラグ+完了日時+担当者を記録)。
 * 改訂履歴RPC経由(呼び出し前のスナップショットをfoot_analysis_revisionsへ保存してから更新)。
 */
export async function completeFootAnalysis(
  footAnalysisId: string,
  operatorMemberId: string | null
): Promise<FootAnalysis> {
  const { data, error } = await supabase.rpc('update_foot_analysis_with_history', {
    p_analysis_id: footAnalysisId,
    p_detected_signs: null,
    p_mark_completed: true,
    p_operator_member_id: operatorMemberId,
    p_changed_by_type: 'staff',
    p_changed_by_id: operatorMemberId,
    p_change_reason: '動作分析を確定',
  });
  if (error) throw error;
  return data as FootAnalysis;
}

// ============================================================
// shipment_batches / shipment_items - 配送管理(セッション単位の一括発送処理)
// 2026-08-27: Blue(Glideベース)の配送管理画面と同等の機能をGreenへ新規実装。
// テーブル自体はBlue由来の既存テーブル(これまでGreen UIから未使用)。
// マイグレーション005で追加したis_active/removed_*列とRPC
// (add_to_shipment_batch/remove_from_shipment_batch)を使い、
// 「顧客をセッションから外す・付け替える」操作を物理削除ではなく
// 無効化+新規追加で表現する(会社のデータ改訂ポリシーに準拠)。
// このため、shipment_itemsのis_active等はこのRPC経由以外で直接updateしないこと。
// ============================================================
export interface ShipmentBatch {
  id: string;
  ship_date: string | null;
  is_shipped: boolean;
  address_csv_url: string | null;
  survey_sent_date: string | null;
  memo: string | null;
  is_favorited: boolean | null;
  glide_row_id: string | null;
  created_at: string;
  updated_at: string;
  last_editor_member_id: string | null;
}

export interface ShipmentItem {
  id: string;
  shipment_batch_id: string;
  order_id: string | null;
  production_workflow_id: string | null;
  upload_id: string | null;
  customer_id: string | null;
  tracking_number: string | null;
  is_shipped: boolean;
  survey_sent_date: string | null;
  memo: string | null;
  is_favorited: boolean | null;
  glide_row_id: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  removed_at: string | null;
  removed_by_member_id: string | null;
  removed_reason: string | null;
}

/** shipment_itemsに顧客の表示用情報(uploads結合)を足した型 */
export interface ShipmentItemDisplay extends ShipmentItem {
  insole_user_name: string | null;
  insole_user_kana: string | null;
  order_name: string | null;
  selected_insoles: string[] | null;
  upload_updated_at: string | null;
}

/** 全セッションを新しい順に取得(配送管理トップ画面用) */
export async function fetchShipmentBatches(): Promise<ShipmentBatch[]> {
  const { data, error } = await supabase
    .from('shipment_batches')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ShipmentBatch[];
}

/**
 * 複数セッションの「有効な配送記録数」(=リスト内の注文数)を一括取得する
 * (配送管理トップ画面のカード/テーブル表示用。N+1回避のため一括取得)
 */
export async function fetchActiveShipmentItemCounts(batchIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (batchIds.length === 0) return map;
  const { data, error } = await supabase
    .from('shipment_items')
    .select('shipment_batch_id')
    .eq('is_active', true)
    .in('shipment_batch_id', batchIds);
  if (error) throw error;
  for (const row of (data ?? []) as Array<{ shipment_batch_id: string }>) {
    map.set(row.shipment_batch_id, (map.get(row.shipment_batch_id) ?? 0) + 1);
  }
  return map;
}

/** 特定のセッションを取得(詳細画面用) */
export async function fetchShipmentBatchById(id: string): Promise<ShipmentBatch | null> {
  const { data, error } = await supabase
    .from('shipment_batches')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as ShipmentBatch | null;
}

/** 新しいセッション(バッチ)を作成する。出荷予定日は未設定(null)でも可 */
export async function createShipmentBatch(
  shipDate: string | null,
  lastEditorMemberId: string | null
): Promise<ShipmentBatch> {
  const { data, error } = await supabase
    .from('shipment_batches')
    .insert({
      ship_date: shipDate,
      is_shipped: false,
      last_editor_member_id: lastEditorMemberId,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ShipmentBatch;
}

/** セッションの出荷予定日を更新する */
export async function updateShipmentBatchShipDate(
  id: string,
  shipDate: string | null,
  lastEditorMemberId: string | null
): Promise<ShipmentBatch> {
  const { data, error } = await supabase
    .from('shipment_batches')
    .update({
      ship_date: shipDate,
      last_editor_member_id: lastEditorMemberId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as ShipmentBatch;
}

/**
 * 指定バッチの有効な(is_active=true)配送記録を、顧客表示情報(uploads結合)付きで取得する。
 * PostgREST側の外部キー埋め込みに依存せず、uploadsを別途一括取得してJS側でマージする
 * (fetchWorkflowsByUploadIds等、このファイルの他関数と同じ方針)。
 */
export async function fetchActiveShipmentItemsByBatchId(batchId: string): Promise<ShipmentItemDisplay[]> {
  const { data, error } = await supabase
    .from('shipment_items')
    .select('*')
    .eq('shipment_batch_id', batchId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const items = (data ?? []) as ShipmentItem[];

  const uploadIds = Array.from(new Set(items.map((i) => i.upload_id).filter(Boolean))) as string[];
  const uploadMap = new Map<string, { insole_user_name: string | null; insole_user_kana: string | null; order_name: string | null; selected_insoles: string[] | null; updated_at: string | null }>();
  if (uploadIds.length > 0) {
    const { data: uploads, error: uploadsErr } = await supabase
      .from('uploads')
      .select('id, insole_user_name, insole_user_kana, order_name, selected_insoles, updated_at')
      .in('id', uploadIds);
    if (uploadsErr) throw uploadsErr;
    for (const u of (uploads ?? []) as Array<{ id: string; insole_user_name: string | null; insole_user_kana: string | null; order_name: string | null; selected_insoles: string[] | null; updated_at: string | null }>) {
      uploadMap.set(u.id, u);
    }
  }

  return items.map((item) => {
    const u = item.upload_id ? uploadMap.get(item.upload_id) : undefined;
    return {
      ...item,
      insole_user_name: u?.insole_user_name ?? null,
      insole_user_kana: u?.insole_user_kana ?? null,
      order_name: u?.order_name ?? null,
      selected_insoles: u?.selected_insoles ?? null,
      upload_updated_at: u?.updated_at ?? null,
    };
  });
}

/** 顧客追加モーダルの候補1件分 */
export interface ShipmentCandidate {
  upload_id: string;
  order_id: string | null;
  user_id: string | null;
  order_name: string | null;
  insole_user_name: string | null;
  insole_user_kana: string | null;
  uploaded_at: string;
}

/**
 * 顧客追加モーダルの候補検索。
 * uploads側(利用者名・かな・注文ID)とorders側(氏名・かな・メール・電話・注文ID)の
 * どちらかにqueryがILIKE部分一致すれば候補に含める。
 * excludeAlreadyActive=trueの場合、既にshipment_items.is_active=trueな顧客(二重登録)は除外する。
 */
export async function searchCandidateUploads(
  query: string,
  excludeAlreadyActive: boolean = true
): Promise<ShipmentCandidate[]> {
  const q = query.trim();
  if (!q) return [];
  // PostgRESTの.or()構文はカンマ/括弧を条件区切りとして解釈するため、
  // 検索語にこれらが含まれるとフィルタ全体が壊れる。氏名・かな・ID・メール・
  // 電話番号の検索でこれらの文字が本質的に必要になることは無いため除去する。
  const sanitized = q.replace(/[,()]/g, '');
  if (!sanitized) return [];
  const like = `%${sanitized}%`;

  type CandidateRow = {
    id: string;
    order_id: string | null;
    user_id: string | null;
    order_name: string | null;
    insole_user_name: string | null;
    insole_user_kana: string | null;
    created_at: string;
  };

  // 1. uploads側(利用者名・かな・注文ID)で直接一致するもの
  const { data: uploadsDirect, error: uploadsErr } = await supabase
    .from('uploads')
    .select('id, order_id, user_id, order_name, insole_user_name, insole_user_kana, created_at')
    .or(`insole_user_name.ilike.${like},insole_user_kana.ilike.${like},order_name.ilike.${like}`)
    .order('created_at', { ascending: false })
    .limit(50);
  if (uploadsErr) throw uploadsErr;

  // 2. orders側(氏名・かな・メール・電話・注文ID)で一致する注文に紐づくuploadsも候補に含める
  const { data: matchedOrders, error: ordersErr } = await supabase
    .from('orders')
    .select('id')
    .or(
      `order_name.ilike.${like},customer_last_name.ilike.${like},customer_first_name.ilike.${like},customer_last_name_kana.ilike.${like},customer_first_name_kana.ilike.${like},customer_email.ilike.${like},customer_phone.ilike.${like}`
    )
    .limit(50);
  if (ordersErr) throw ordersErr;

  let uploadsFromOrders: CandidateRow[] = [];
  const orderIds = (matchedOrders ?? []).map((o: { id: string }) => o.id);
  if (orderIds.length > 0) {
    const { data, error } = await supabase
      .from('uploads')
      .select('id, order_id, user_id, order_name, insole_user_name, insole_user_kana, created_at')
      .in('order_id', orderIds)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    uploadsFromOrders = (data ?? []) as CandidateRow[];
  }

  const merged = new Map<string, ShipmentCandidate>();
  for (const row of [...((uploadsDirect ?? []) as CandidateRow[]), ...uploadsFromOrders]) {
    merged.set(row.id, {
      upload_id: row.id,
      order_id: row.order_id,
      user_id: row.user_id,
      order_name: row.order_name,
      insole_user_name: row.insole_user_name,
      insole_user_kana: row.insole_user_kana,
      uploaded_at: row.created_at,
    });
  }

  let candidates = Array.from(merged.values());

  if (excludeAlreadyActive && candidates.length > 0) {
    const ids = candidates.map((c) => c.upload_id);
    const { data: activeItems, error: activeErr } = await supabase
      .from('shipment_items')
      .select('upload_id')
      .eq('is_active', true)
      .in('upload_id', ids);
    if (activeErr) throw activeErr;
    const activeSet = new Set((activeItems ?? []).map((r: { upload_id: string | null }) => r.upload_id));
    candidates = candidates.filter((c) => !activeSet.has(c.upload_id));
  }

  candidates.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
  return candidates;
}

/**
 * 顧客をセッションに追加する唯一の正式な経路(RPC経由)。
 * 既に別(または同一)セッションに有効な配送記録がある場合はRPC側で自動的に無効化してから追加する。
 */
export async function addUploadToShipmentBatch(
  batchId: string,
  uploadId: string,
  orderId: string | null,
  productionWorkflowId: string | null,
  customerId: string | null,
  changedById: string | null
): Promise<ShipmentItem> {
  const { data, error } = await supabase.rpc('add_to_shipment_batch', {
    p_batch_id: batchId,
    p_upload_id: uploadId,
    p_order_id: orderId,
    p_production_workflow_id: productionWorkflowId,
    p_customer_id: customerId,
    p_changed_by_id: changedById,
  });
  if (error) throw error;
  return data as ShipmentItem;
}

/**
 * 顧客をセッションから外す唯一の正式な経路(RPC経由)。無効化するのみで物理削除はしない。
 */
export async function removeShipmentItem(
  shipmentItemId: string,
  changedById: string | null,
  reason?: string
): Promise<ShipmentItem> {
  const { data, error } = await supabase.rpc('remove_from_shipment_batch', {
    p_shipment_item_id: shipmentItemId,
    p_changed_by_id: changedById,
    p_reason: reason ?? null,
  });
  if (error) throw error;
  return data as ShipmentItem;
}

/** CSV出力用: 配送先住所(upload_ship)を複数upload_idで一括取得 */
export interface UploadShipRecord {
  id: string;
  upload_id: string;
  ship_name: string | null;
  ship_kana: string | null;
  postal_code: string | null;
  prefecture: string | null;
  city: string | null;
  address_line1: string | null;
  address_line2: string | null;
  phone: string | null;
}

export async function fetchUploadShipByUploadIds(uploadIds: string[]): Promise<Map<string, UploadShipRecord>> {
  if (uploadIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('upload_ship')
    .select('id, upload_id, ship_name, ship_kana, postal_code, prefecture, city, address_line1, address_line2, phone')
    .in('upload_id', uploadIds);
  if (error) throw error;
  const map = new Map<string, UploadShipRecord>();
  for (const row of (data ?? []) as UploadShipRecord[]) {
    map.set(row.upload_id, row);
  }
  return map;
}

/**
 * CSV出力用: ordersテーブルの配送先情報(upload_shipが無い場合のフォールバック用)を
 * 複数order_idで一括取得する。
 */
export interface OrderShipInfo {
  id: string;
  ship_name: string | null;
  ship_phone: string | null;
  ship_postal_code: string | null;
  ship_prefecture: string | null;
  ship_city: string | null;
  ship_address_line1: string | null;
  ship_address_line2: string | null;
}

export async function fetchOrdersShipInfoByIds(orderIds: string[]): Promise<Map<string, OrderShipInfo>> {
  if (orderIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('orders')
    .select('id, ship_name, ship_phone, ship_postal_code, ship_prefecture, ship_city, ship_address_line1, ship_address_line2')
    .in('id', orderIds);
  if (error) throw error;
  const map = new Map<string, OrderShipInfo>();
  for (const row of (data ?? []) as OrderShipInfo[]) {
    map.set(row.id, row);
  }
  return map;
}

/**
 * CSVをSupabase Storage(upsysバケット)へアップロードし公開URLを返す。
 * 将来ヤマト運輸(黒猫)のシステムへ投入することを見据え、UTF-8 BOM付きで保存する
 * (Excel/Windows系ツールでの文字化け防止)。
 */
export async function uploadShipmentCsvToStorage(
  batchId: string,
  csvContent: string
): Promise<{ url: string }> {
  const timestamp = Date.now();
  const storagePath = `shipment-csv/${batchId}/${timestamp}.csv`;
  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });

  const { error } = await supabase.storage.from('upsys').upload(storagePath, blob, {
    upsert: false,
    contentType: 'text/csv',
  });
  if (error) throw error;

  const { data: urlData } = supabase.storage.from('upsys').getPublicUrl(storagePath);
  return { url: urlData.publicUrl };
}

/** CSV生成完了をセッションに記録する(address_csv_urlを保存) */
export async function finalizeShipmentBatchCsv(batchId: string, csvUrl: string): Promise<ShipmentBatch> {
  const { data, error } = await supabase
    .from('shipment_batches')
    .update({ address_csv_url: csvUrl, updated_at: new Date().toISOString() })
    .eq('id', batchId)
    .select()
    .single();
  if (error) throw error;
  return data as ShipmentBatch;
}
