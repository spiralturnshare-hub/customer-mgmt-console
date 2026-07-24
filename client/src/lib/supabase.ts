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
