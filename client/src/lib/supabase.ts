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
}

export async function fetchUploadFiles(uploadId: string): Promise<UploadFileRecord[]> {
  const { data, error } = await supabase
    .from('uploads_files')
    .select('id, order_id, upload_id, user_id, status, file_type, kind, url, updated_at')
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
  detectedSigns: string[]
): Promise<FootAnalysis> {
  const existing = await fetchFootAnalysisByUploadId(uploadId);
  const patch = { detected_signs: detectedSigns, updated_at: new Date().toISOString() };
  if (existing) {
    const { data, error } = await supabase
      .from('foot_analyses')
      .update(patch)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data as FootAnalysis;
  }
  const { data, error } = await supabase
    .from('foot_analyses')
    .insert({ upload_id: uploadId, order_id: orderId, user_id: userId, production_id: productionId, ...patch })
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

/** 分析完了として確定する(完了フラグ+完了日時+担当者を記録) */
export async function completeFootAnalysis(
  footAnalysisId: string,
  operatorMemberId: string | null
): Promise<FootAnalysis> {
  const { data, error } = await supabase
    .from('foot_analyses')
    .update({
      is_completed: true,
      completed_at: new Date().toISOString(),
      analyzed_at: new Date().toISOString(),
      operator_member_id: operatorMemberId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', footAnalysisId)
    .select()
    .single();
  if (error) throw error;
  return data as FootAnalysis;
}
