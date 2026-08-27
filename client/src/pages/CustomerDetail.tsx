/**
 * CustomerDetail - 管理画面（顧客詳細展開ページ）
 * データソース: Supabase Green の uploads テーブル（ID指定で取得）
 * レイアウト:
 *   - 上部: 日時・顧客名・インソール種別タグ
 *   - 注文情報ブロック（横幅全体）
 *   - 3カラム: 左=顧客情報+作製目的+配送先 / 中央=ファイル（動画・画像） / 右=靴情報+痛み+タコ+アップロード情報
 */

import { ArrowLeft, Copy, RefreshCw, Check, Loader2, Mail, MessageCircle, Send, CheckCircle2, XCircle, Clock, Pencil, X, History, Upload, Truck } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { useEffect, useRef, useState } from "react";
import {
  fetchUploadById,
  fetchUploadFiles,
  fetchWorkflowByUploadId,
  toStepDisplays,
  toggleWorkflowStep,
  saveTrackingNumber,
  toggleShipped,
  fetchCurrentMember,
  fetchCommunicationLogsByUploadId,
  resendCommunicationLog,
  sendAnalysisResultNotification,
  fetchUploadRevisions,
  updateUploadWithHistory,
  replaceUploadFile,
  uploadReplacementFileToStorage,
  fetchAnalysisSigns,
  fetchFootAnalysisByUploadId,
  type UploadRecord,
  type UploadFileRecord,
  type ProductionWorkflow,
  type WorkflowStepDisplay,
  type WorkflowStep,
  type CommunicationLog,
  type UploadRevision,
  type AnalysisSign,
  type FootAnalysis,
} from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const PINK = "#D62598";
// foot-measure(足の計測アプリ、別デプロイ)への連携URL
const FOOT_MEASURE_URL = "https://foot-measure.vercel.app";

// ─── ユーティリティ ───────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-xs font-bold mb-3 pb-1 border-b"
      style={{ color: PINK, borderColor: `${PINK}33`, letterSpacing: "0.06em" }}
    >
      {children}
    </h3>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2 mb-1.5 text-xs">
      <span className="shrink-0 text-gray-400 w-28">{label}</span>
      <span className="text-gray-700 break-all">{value || "—"}</span>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-4 mb-3 ${className}`}
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
    >
      {children}
    </div>
  );
}

// ─── ファイルカード（動画・画像） ────────────────────────────────────────
interface FileItem {
  id: string;
  label: string;
  type: 'video' | 'image';
  fileType: string | null;
  kind: string | null;
  updatedAt: string | null;
  url: string | null;
}

function FileCard({ file, onReplace }: { file: FileItem; onReplace: (file: FileItem, newFile: File) => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [replacing, setReplacing] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newFile = e.target.files?.[0];
    e.target.value = "";
    if (!newFile) return;
    setReplacing(true);
    try {
      await onReplace(file, newFile);
    } catch (err) {
      // 失敗時は何もしない(元のファイルを維持)
    } finally {
      setReplacing(false);
    }
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-bold" style={{ color: "#1a1a1a" }}>
          {file.label}
        </p>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={replacing}
          className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md disabled:opacity-50"
          style={{ color: PINK, border: `1px solid ${PINK}55`, backgroundColor: "#fff" }}
          title="差し替え(旧ファイルは削除せず履歴として残ります)"
        >
          {replacing ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
          差し替え
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={file.type === "video" ? "video/*" : "image/*"}
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
      <div className="text-xs text-gray-400 mb-2 space-y-0.5">
        <div className="flex gap-2">
          <span className="w-20 text-gray-400">id</span>
          <span className="break-all text-gray-500">{file.id}</span>
        </div>
        <div className="flex gap-2">
          <span className="w-20 text-gray-400">ファイル種別</span>
          <span className="text-gray-500">{file.fileType || "—"}</span>
        </div>
        <div className="flex gap-2">
          <span className="w-20 text-gray-400">更新日時</span>
          <span className="text-gray-500">
            {file.updatedAt
              ? new Date(file.updatedAt).toLocaleString('ja-JP')
              : "—"}
          </span>
        </div>
      </div>
      {/* メディア表示（URLがある場合は実際のメディア、ない場合はプレースホルダー） */}
      {file.type === "video" ? (
        file.url ? (
          <video
            src={file.url}
            controls
            className="w-full rounded-lg"
            style={{ maxHeight: 420 }}
          />
        ) : (
          <div
            className="w-full rounded-lg flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #f0f0f0 0%, #e0e0e0 100%)",
              aspectRatio: "9/16",
              maxHeight: 420,
              border: "1px solid #e5e5e5",
            }}
          >
            <div className="text-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-2"
                style={{ backgroundColor: `${PINK}18`, border: `2px solid ${PINK}44` }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill={PINK}>
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              </div>
              <p className="text-xs text-gray-400">{file.label} 動画</p>
            </div>
          </div>
        )
      ) : (
        file.url ? (
          <img
            src={file.url}
            alt={file.label}
            className="w-full rounded-lg object-cover"
            style={{ maxHeight: 320 }}
          />
        ) : (
          <div
            className="w-full rounded-lg flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #f7f7f7 0%, #ececec 100%)",
              aspectRatio: "4/3",
              maxHeight: 320,
              border: "1px solid #e5e5e5",
            }}
          >
            <div className="text-center">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-2"
                style={{ backgroundColor: `${PINK}18`, border: `2px solid ${PINK}44` }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={PINK} strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21,15 16,10 5,21" />
                </svg>
              </div>
              <p className="text-xs text-gray-400">{file.label} 画像</p>
            </div>
          </div>
        )
      )}
    </div>
  );
}

// uploads_files → FileItem 変換
function mapFileRecord(r: UploadFileRecord): FileItem {
  const isVideo = r.file_type === 'video' || r.kind === 'oneleg' || r.kind === 'walk';
  return {
    id: r.id,
    label: r.kind ?? r.file_type ?? r.id,
    type: isVideo ? 'video' : 'image',
    fileType: r.file_type,
    kind: r.kind,
    updatedAt: r.updated_at,
    url: r.url,
  };
}

// jsonb フィールドから文字列値を安全に取得するヘルパー
function getStr(obj: Record<string, unknown> | null | undefined, key: string): string {
  if (!obj) return '';
  const v = obj[key];
  if (v === null || v === undefined) return '';
  return String(v);
}

// ─── 工程進捗バー（計測/分析/設計/作製/発送） ─────────────────────────────
// 設計思想(2026-08-25確定): 各工程カードは「ラベル + その工程の機能を開くボタン」を
// 同じ枠内に内包する。完了後は枠内に完了日時・担当者名を表示する。
// 今後追加する計測・設計・発送の機能ボタンも同じ型(WorkflowStepAction)で差し込む。
export interface WorkflowStepAction {
  label: string;
  onClick: () => void;
}

function WorkflowProgressBar({
  steps,
  pendingStep,
  onToggle,
  actions,
}: {
  steps: WorkflowStepDisplay[];
  pendingStep: WorkflowStep | null;
  onToggle: (step: WorkflowStep, nextDone: boolean) => void;
  actions?: Partial<Record<WorkflowStep, WorkflowStepAction>>;
}) {
  return (
    <Card className="mb-4">
      <SectionTitle>工程進捗</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
        {steps.map((s) => {
          const isPending = pendingStep === s.step;
          const action = actions?.[s.step];
          return (
            <div
              key={s.step}
              className="rounded-lg border p-2.5 transition-colors"
              style={{
                borderColor: s.done ? PINK : "#e5e5e5",
                backgroundColor: s.done ? `${PINK}0d` : "#fff",
              }}
            >
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => onToggle(s.step, !s.done)}
                    title="手動でチェックを切り替える"
                    className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center disabled:opacity-60"
                    style={{
                      backgroundColor: s.done ? PINK : "#f0f0f0",
                      border: s.done ? "none" : "1px solid #ddd",
                    }}
                  >
                    {isPending ? (
                      <Loader2 size={11} className="animate-spin text-gray-400" />
                    ) : s.done ? (
                      <Check size={11} color="#fff" strokeWidth={3} />
                    ) : null}
                  </button>
                  <span className="text-xs font-bold truncate" style={{ color: s.done ? PINK : "#888" }}>
                    {s.label}
                  </span>
                </div>
                {action && (
                  <button
                    type="button"
                    onClick={action.onClick}
                    className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap"
                    style={{ color: PINK, border: `1px solid ${PINK}55`, backgroundColor: "#fff" }}
                  >
                    {action.label}
                  </button>
                )}
              </div>
              <div className="text-[10px] text-gray-400 leading-tight pl-[26px]">
                {s.done ? (
                  <>
                    {s.at ? new Date(s.at).toLocaleString('ja-JP') : ''}
                    {s.byName && <><br />{s.byName}</>}
                  </>
                ) : (
                  '未実施'
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── 配送管理(単件) ─────────────────────────────────────────────────────
// 2026-08-26: 発送は今後「一覧から複数顧客をまとめて処理」する一括UIを別途構築予定
// (docs/07-gait-analysis-and-workflow-ui.md参照、本人から詳細指示待ち)。
// 今回はそれとは独立した、この画面単体での追跡番号入力・発送完了マークのみ。
function ShippingSection({
  workflow,
  trackingInput,
  onTrackingInputChange,
  onSaveTracking,
  savingTracking,
  onToggleShipped,
  togglingShip,
}: {
  workflow: ProductionWorkflow | null;
  trackingInput: string;
  onTrackingInputChange: (v: string) => void;
  onSaveTracking: () => void;
  savingTracking: boolean;
  onToggleShipped: (nextDone: boolean) => void;
  togglingShip: boolean;
}) {
  const shipped = Boolean(workflow?.ship_done);
  return (
    <Card className="mb-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Truck size={13} style={{ color: PINK }} />
        <SectionTitle>配送管理</SectionTitle>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <span
          className="text-[10px] font-bold px-2 py-1 rounded-md"
          style={{
            color: shipped ? "#1a9e5c" : "#999",
            backgroundColor: shipped ? "#1a9e5c15" : "#f5f5f5",
          }}
        >
          {shipped ? "発送済み" : "未発送"}
        </span>
        {shipped && workflow?.shipped_at && (
          <span className="text-[10px] text-gray-400">
            {new Date(workflow.shipped_at).toLocaleString('ja-JP')}
          </span>
        )}
      </div>
      <div className="flex items-end gap-2 mb-3">
        <div className="flex-1">
          <label className="text-[10px] text-gray-400 block mb-1">追跡番号</label>
          <input
            type="text"
            value={trackingInput}
            onChange={(e) => onTrackingInputChange(e.target.value)}
            placeholder="未入力"
            className="w-full text-xs border rounded-md px-2 py-1.5"
            style={{ borderColor: "#ddd" }}
          />
        </div>
        <button
          type="button"
          onClick={onSaveTracking}
          disabled={savingTracking}
          className="text-[10px] font-bold px-3 py-1.5 rounded-md whitespace-nowrap disabled:opacity-60"
          style={{ color: PINK, border: `1px solid ${PINK}55`, backgroundColor: "#fff" }}
        >
          {savingTracking ? "保存中..." : "追跡番号を保存"}
        </button>
      </div>
      <button
        type="button"
        onClick={() => onToggleShipped(!shipped)}
        disabled={togglingShip}
        className="text-xs font-bold px-3 py-2 rounded-lg disabled:opacity-60"
        style={{
          color: shipped ? "#d43f3f" : "#fff",
          backgroundColor: shipped ? "#fff" : PINK,
          border: shipped ? "1px solid #d43f3f55" : "none",
        }}
      >
        {togglingShip ? "処理中..." : shipped ? "発送を取り消す" : "発送完了にする"}
      </button>
    </Card>
  );
}

// ─── 動作分析結果(サマリー表示・再送) ───────────────────────────────────────
// 2026-08-27: 別ページ(動作分析画面)への遷移が面倒という指摘を受け、
// 結果サマリーと再送UIを顧客詳細トップ画面(通信履歴の直上)に表示するよう変更。
// 詳細な検出サインの編集自体は引き続き別ページ(修正ボタン)で行う。
const SIDE_LABEL: Record<string, string> = { left: '左', right: '右', both: '両側' };

function AnalysisResultSection({
  analysis,
  signs,
  onEdit,
  emailInput,
  onEmailInputChange,
  onSend,
  sending,
  sentMsg,
}: {
  analysis: FootAnalysis | null;
  signs: AnalysisSign[];
  onEdit: () => void;
  emailInput: string;
  onEmailInputChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  sentMsg: string | null;
}) {
  const signByKey = new Map(signs.map((s) => [s.key, s]));
  const detected = (analysis?.detected_signs ?? [])
    .map((entry) => {
      const [key, side] = entry.split(':');
      const sign = signByKey.get(key);
      if (!sign) return null;
      return { title: sign.title, sideLabel: SIDE_LABEL[side] ?? side };
    })
    .filter((v): v is { title: string; sideLabel: string } => v !== null);

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <SectionTitle>動作分析結果</SectionTitle>
        <span
          className="text-[10px] font-bold px-2 py-1 rounded-md"
          style={{
            color: analysis?.is_completed ? "#1a9e5c" : "#999",
            backgroundColor: analysis?.is_completed ? "#1a9e5c15" : "#f5f5f5",
          }}
        >
          {analysis?.is_completed ? "完了" : "未完了"}
        </span>
      </div>
      {analysis?.analyzed_at && (
        <p className="text-[10px] text-gray-400 mb-3">
          最終更新: {new Date(analysis.analyzed_at).toLocaleString('ja-JP')}
        </p>
      )}
      {detected.length === 0 ? (
        <p className="text-xs text-gray-400 mb-3">検出されたサインはまだありません。</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mb-3">
          {detected.map((d, i) => (
            <div key={i} className="flex justify-between text-xs border-b pb-1" style={{ borderColor: "#f0f0f0" }}>
              <span className="text-gray-500">{d.title}</span>
              <span className="font-semibold" style={{ color: PINK }}>{d.sideLabel}</span>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={onEdit}
        className="text-xs font-bold px-3 py-2 rounded-lg text-white mb-4"
        style={{ backgroundColor: PINK }}
      >
        修正する
      </button>

      <div className="pt-3 border-t" style={{ borderColor: "#eee" }}>
        <p className="text-[11px] font-semibold text-gray-600 mb-2">分析結果メールを送る</p>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <input
              type="email"
              value={emailInput}
              onChange={(e) => onEmailInputChange(e.target.value)}
              placeholder="送信先メールアドレス"
              className="w-full text-xs border rounded-md px-2 py-1.5"
              style={{ borderColor: "#ddd" }}
            />
          </div>
          <button
            type="button"
            onClick={onSend}
            disabled={sending || !emailInput.trim()}
            className="text-[10px] font-bold px-3 py-1.5 rounded-md whitespace-nowrap disabled:opacity-60"
            style={{ color: PINK, border: `1px solid ${PINK}55`, backgroundColor: "#fff" }}
          >
            {sending ? "登録中..." : "送信キューに登録"}
          </button>
        </div>
        {sentMsg && <p className="text-[10px] text-gray-400 mt-1.5">{sentMsg}</p>}
        <p className="text-[10px] text-gray-400 mt-1.5">
          登録済みのメールアドレス以外でも、ここに入力した任意の宛先に送信できます。
        </p>
      </div>
    </Card>
  );
}

// ─── 通信履歴(メール/LINE送信ログ)・再送 ────────────────────────────────────
// 2026-08-26: 由村様の決済完了メール未着インシデントを受けて追加。
// 顧客詳細画面の一番下に配置(本人指定)。
// 注意: Green側の実送信処理(フェーズ2)は未実装のため、再送は「pending状態の
// 新規ログを登録する」動作のみ。実際の送信は送信処理本体の実装後に行われる。
const STATUS_LABEL: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  sent: { label: "送信成功", color: "#1a9e5c", icon: <CheckCircle2 size={12} /> },
  failed: { label: "送信失敗", color: "#d43f3f", icon: <XCircle size={12} /> },
  pending: { label: "未送信", color: "#999", icon: <Clock size={12} /> },
};

function CommunicationLogSection({
  logs,
  resendingId,
  onResend,
}: {
  logs: CommunicationLog[];
  resendingId: string | null;
  onResend: (log: CommunicationLog) => void;
}) {
  return (
    <Card className="mt-4">
      <SectionTitle>通信履歴(メール・LINE)</SectionTitle>
      {logs.length === 0 ? (
        <p className="text-xs text-gray-400">送信履歴はまだありません。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b" style={{ borderColor: "#eee" }}>
                <th className="text-left font-normal py-2 pr-3 whitespace-nowrap">日時</th>
                <th className="text-left font-normal py-2 pr-3 whitespace-nowrap">種別</th>
                <th className="text-left font-normal py-2 pr-3 whitespace-nowrap">工程</th>
                <th className="text-left font-normal py-2 pr-3">宛先</th>
                <th className="text-left font-normal py-2 pr-3">内容</th>
                <th className="text-left font-normal py-2 pr-3 whitespace-nowrap">ステータス</th>
                <th className="text-left font-normal py-2 whitespace-nowrap">再送</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const status = STATUS_LABEL[log.status] ?? STATUS_LABEL.pending;
                const isResending = resendingId === log.id;
                const isLine = log.notify_kind === "line";
                return (
                  <tr key={log.id} className="border-b" style={{ borderColor: "#f5f5f5" }}>
                    <td className="py-2 pr-3 whitespace-nowrap text-gray-500">
                      {log.created_at ? new Date(log.created_at).toLocaleString("ja-JP") : "—"}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1" style={{ color: isLine ? "#06C755" : "#555" }}>
                        {isLine ? <MessageCircle size={12} /> : <Mail size={12} />}
                        {log.notify_kind ?? "—"}
                      </span>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap text-gray-500">{log.notify_type ?? "—"}</td>
                    <td className="py-2 pr-3 text-gray-700 break-all">{log.notify_to ?? "—"}</td>
                    <td className="py-2 pr-3 text-gray-500 max-w-[240px] truncate" title={log.contents ?? undefined}>
                      {log.contents ?? "—"}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 font-medium" style={{ color: status.color }}>
                        {status.icon}
                        {status.label}
                      </span>
                      {log.resend_of_id && <span className="ml-1 text-[10px] text-gray-400">(再送)</span>}
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        disabled={isResending}
                        onClick={() => onResend(log)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md disabled:opacity-50"
                        style={{ color: PINK, border: `1px solid ${PINK}55`, backgroundColor: "#fff" }}
                      >
                        {isResending ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                        再送
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[10px] text-gray-300 mt-3">
        ※再送は送信待ちキューへの登録のみです。実際の送信処理はGreen側の実装完了後に有効になります。
      </p>
    </Card>
  );
}

// ─── スタッフによるデータ編集(改訂履歴ポリシー対応) ─────────────────────
// 方針: docs/10-customer-mgmt-console-vision-and-data-revision-policy.md
// スタッフは工程の状態に関わらず常に編集可能。編集は上書きせず、
// updateUploadWithHistory(RPC)経由で必ず変更前スナップショットを残してから保存する。

// フラットな項目(顧客情報・作製目的・配送先情報)の編集カード
function EditableInfoCard({
  title,
  fields,
  onSave,
}: {
  title: string;
  fields: { key: string; label: string; value: string }[];
  onSave: (values: Record<string, string>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setDraft(Object.fromEntries(fields.map((f) => [f.key, f.value])));
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch (e) {
      // 失敗時は編集状態を維持し、再試行できるようにする
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <SectionTitle>{title}</SectionTitle>
        {!editing ? (
          <button onClick={startEdit} className="text-gray-300 hover:text-gray-500 mb-3" title="編集">
            <Pencil size={13} />
          </button>
        ) : (
          <div className="flex gap-2 mb-3">
            <button onClick={() => setEditing(false)} disabled={saving} className="text-gray-300 hover:text-gray-500" title="キャンセル">
              <X size={14} />
            </button>
            <button onClick={save} disabled={saving} className="text-xs font-bold" style={{ color: PINK }} title="保存">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            </button>
          </div>
        )}
      </div>
      {!editing
        ? fields.map((f) => <InfoRow key={f.key} label={f.label} value={f.value} />)
        : fields.map((f) => (
            <div key={f.key} className="flex gap-2 mb-1.5 text-xs items-center">
              <span className="shrink-0 text-gray-400 w-28">{f.label}</span>
              <input
                className="flex-1 border rounded px-2 py-1 text-xs"
                style={{ borderColor: "#ddd" }}
                value={draft[f.key] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              />
            </div>
          ))}
    </Card>
  );
}

// 複雑なネスト構造(靴情報・痛み・タコ)は、暫定としてJSON直接編集で対応する。
// 今後、専用フォームへ段階的に置き換える想定。
function JsonEditCard({
  title,
  value,
  onSave,
}: {
  title: string;
  value: Record<string, unknown> | null;
  onSave: (value: Record<string, unknown>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  function startEdit() {
    setDraft(JSON.stringify(value ?? {}, null, 2));
    setJsonError(null);
    setEditing(true);
  }

  async function save() {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(draft);
    } catch (e) {
      setJsonError("JSONの形式が正しくありません");
      return;
    }
    setSaving(true);
    try {
      await onSave(parsed);
      setEditing(false);
    } catch (e) {
      // 失敗時は編集状態を維持
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <SectionTitle>{title}</SectionTitle>
        {!editing ? (
          <button onClick={startEdit} className="text-gray-300 hover:text-gray-500 mb-3" title="編集(JSON)">
            <Pencil size={13} />
          </button>
        ) : (
          <div className="flex gap-2 mb-3">
            <button onClick={() => setEditing(false)} disabled={saving} className="text-gray-300 hover:text-gray-500" title="キャンセル">
              <X size={14} />
            </button>
            <button onClick={save} disabled={saving} className="text-xs font-bold" style={{ color: PINK }} title="保存">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            </button>
          </div>
        )}
      </div>
      {editing ? (
        <>
          <textarea
            className="w-full border rounded px-2 py-1 text-xs font-mono"
            style={{ borderColor: jsonError ? "#d43f3f" : "#ddd", minHeight: 160 }}
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setJsonError(null); }}
          />
          {jsonError && <p className="text-[10px] mt-1" style={{ color: "#d43f3f" }}>{jsonError}</p>}
          <p className="text-[10px] text-gray-300 mt-1">※暫定的にJSON形式での直接編集です</p>
        </>
      ) : value ? (
        <pre className="text-[11px] text-gray-500 whitespace-pre-wrap break-all">{JSON.stringify(value, null, 2)}</pre>
      ) : (
        <p className="text-xs text-gray-400">データなし</p>
      )}
    </Card>
  );
}

// ─── 変更履歴(改訂履歴ポリシー) ────────────────────────────────────────
function RevisionHistorySection({ revisions }: { revisions: UploadRevision[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <Card className="mt-4">
      <SectionTitle>変更履歴(データ改訂ログ)</SectionTitle>
      {revisions.length === 0 ? (
        <p className="text-xs text-gray-400">変更履歴はまだありません。</p>
      ) : (
        <div className="space-y-1.5">
          {revisions.map((r) => (
            <div key={r.id} className="border rounded-lg" style={{ borderColor: "#eee" }}>
              <button
                className="w-full flex items-center justify-between px-3 py-2 text-xs"
                onClick={() => setOpenId(openId === r.id ? null : r.id)}
              >
                <span className="flex items-center gap-2">
                  <History size={12} className="text-gray-400" />
                  <span className="font-semibold text-gray-600">#{r.revision_number}</span>
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                    style={{
                      color: r.changed_by_type === "customer" ? "#1a7fb8" : PINK,
                      backgroundColor: r.changed_by_type === "customer" ? "#1a7fb818" : `${PINK}15`,
                    }}
                  >
                    {r.changed_by_type === "customer" ? "顧客" : "スタッフ"}
                  </span>
                  {r.change_reason && <span className="text-gray-400">{r.change_reason}</span>}
                </span>
                <span className="text-gray-400">{new Date(r.created_at).toLocaleString("ja-JP")}</span>
              </button>
              {openId === r.id && (
                <pre className="text-[10px] text-gray-500 whitespace-pre-wrap break-all px-3 pb-2 border-t" style={{ borderColor: "#f5f5f5" }}>
                  {JSON.stringify(r.snapshot, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── メインページ ─────────────────────────────────────────────────────────
export default function CustomerDetail() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useAuth();

  const [upload, setUpload] = useState<UploadRecord | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [workflow, setWorkflow] = useState<ProductionWorkflow | null>(null);
  const [stepDisplays, setStepDisplays] = useState<WorkflowStepDisplay[]>([]);
  const [pendingStep, setPendingStep] = useState<WorkflowStep | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);

  const [commLogs, setCommLogs] = useState<CommunicationLog[]>([]);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const [revisions, setRevisions] = useState<UploadRevision[]>([]);

  const [trackingInput, setTrackingInput] = useState('');
  const [savingTracking, setSavingTracking] = useState(false);
  const [togglingShip, setTogglingShip] = useState(false);

  const [analysis, setAnalysis] = useState<FootAnalysis | null>(null);
  const [analysisSigns, setAnalysisSigns] = useState<AnalysisSign[]>([]);
  const [analysisEmailInput, setAnalysisEmailInput] = useState('');
  const [sendingAnalysisEmail, setSendingAnalysisEmail] = useState(false);
  const [analysisEmailSentMsg, setAnalysisEmailSentMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [rec, fileRecs, wf, logs, revs, signs, footAnalysis] = await Promise.all([
          fetchUploadById(id),
          fetchUploadFiles(id),
          fetchWorkflowByUploadId(id),
          fetchCommunicationLogsByUploadId(id),
          fetchUploadRevisions(id),
          fetchAnalysisSigns(),
          fetchFootAnalysisByUploadId(id),
        ]);
        if (!cancelled) {
          setUpload(rec);
          setFiles(fileRecs.map(mapFileRecord));
          setWorkflow(wf);
          setStepDisplays(await toStepDisplays(wf));
          setTrackingInput(wf?.tracking_number ?? '');
          setCommLogs(logs);
          setRevisions(revs);
          setAnalysisSigns(signs);
          setAnalysis(footAnalysis);
        }
      } catch (e) {
        if (!cancelled) setError('データの取得に失敗しました。');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!user) return;
    fetchCurrentMember(user.id).then((m) => setMemberId(m?.id ?? null));
  }, [user]);

  async function handleToggleStep(step: WorkflowStep, nextDone: boolean) {
    if (!id) return;
    setPendingStep(step);
    try {
      const updated = await toggleWorkflowStep(id, upload?.order_id ?? null, step, nextDone, memberId);
      setWorkflow(updated);
      setStepDisplays(await toStepDisplays(updated));
    } catch (e) {
      // 失敗時は表示を変更せず据え置く
    } finally {
      setPendingStep(null);
    }
  }

  async function handleSaveTracking() {
    if (!id) return;
    setSavingTracking(true);
    try {
      const updated = await saveTrackingNumber(id, upload?.order_id ?? null, trackingInput.trim());
      setWorkflow(updated);
    } catch (e) {
      // 失敗時は入力値を保持したまま据え置く
    } finally {
      setSavingTracking(false);
    }
  }

  async function handleToggleShipped(nextDone: boolean) {
    if (!id) return;
    setTogglingShip(true);
    try {
      const updated = await toggleShipped(id, upload?.order_id ?? null, nextDone, memberId);
      setWorkflow(updated);
      setStepDisplays(await toStepDisplays(updated));
    } catch (e) {
      // 失敗時は表示を変更せず据え置く
    } finally {
      setTogglingShip(false);
    }
  }

  async function handleResend(log: CommunicationLog) {
    setResendingId(log.id);
    try {
      const created = await resendCommunicationLog(log, memberId);
      setCommLogs((prev) => [created, ...prev]);
    } catch (e) {
      // 失敗時は一覧を変更せず据え置く
    } finally {
      setResendingId(null);
    }
  }

  async function handleSendAnalysisEmail() {
    if (!id || !analysisEmailInput.trim()) return;
    setSendingAnalysisEmail(true);
    setAnalysisEmailSentMsg(null);
    try {
      const created = await sendAnalysisResultNotification({
        orderId: upload?.order_id ?? null,
        uploadId: id,
        customerId: upload?.user_id ?? null,
        toEmail: analysisEmailInput.trim(),
        isCustomEmail: true,
        editorUserId: memberId,
      });
      setCommLogs((prev) => [created, ...prev]);
      setAnalysisEmailSentMsg(`${analysisEmailInput.trim()} 宛に送信キューへ登録しました。`);
    } catch (e) {
      setAnalysisEmailSentMsg('送信キューへの登録に失敗しました。');
    } finally {
      setSendingAnalysisEmail(false);
    }
  }

  // uploads本体(トップレベル列)を編集する共通ハンドラ。
  // updateUploadWithHistory(RPC)が変更前スナップショットを自動保存してから更新するため、
  // ここでは呼び出すだけでよい。保存後は本体と変更履歴を再取得する。
  async function handleSaveUploadPatch(
    patch: Parameters<typeof updateUploadWithHistory>[1],
    reason?: string
  ) {
    if (!id) return;
    const updated = await updateUploadWithHistory(id, patch, memberId, reason);
    setUpload(updated);
    setRevisions(await fetchUploadRevisions(id));
  }

  async function handleReplaceFile(file: FileItem, newFile: File) {
    if (!id || !upload) return;
    const { url } = await uploadReplacementFileToStorage(newFile, id, file.kind ?? file.id, memberId);
    await replaceUploadFile({
      uploadId: id,
      orderId: upload.order_id,
      userId: upload.user_id,
      kind: file.kind ?? file.id,
      fileType: file.type,
      url,
      changedById: memberId,
    });
    const [fileRecs, revs] = await Promise.all([fetchUploadFiles(id), fetchUploadRevisions(id)]);
    setFiles(fileRecs.map(mapFileRecord));
    setRevisions(revs);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f5f5f5" }}>
        <div className="flex items-center gap-2 text-sm" style={{ color: "#aaa" }}>
          <RefreshCw size={14} className="animate-spin" />
          読み込み中...
        </div>
      </div>
    );
  }

  if (error || !upload) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: "#f5f5f5" }}>
        <p className="text-sm text-red-500">{error ?? 'データが見つかりません'}</p>
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-1.5 text-sm hover:opacity-70"
          style={{ color: PINK }}
        >
          <ArrowLeft size={15} />
          作製中一覧に戻る
        </button>
      </div>
    );
  }

  // jsonb フィールドを取り出す
  const customerInfo = upload.customer_info as Record<string, unknown> | null;
  const purposeInfo = upload.purpose_info as Record<string, unknown> | null;
  const shoeInfos = upload.shoe_infos as Record<string, unknown> | null;
  const painInfo = upload.pain_info as Record<string, unknown> | null;
  const takoInfo = upload.tako_info as Record<string, unknown> | null;

  const createdAt = upload.created_at
    ? new Date(upload.created_at).toLocaleString('ja-JP')
    : '—';
  const updatedAt = upload.updated_at
    ? new Date(upload.updated_at).toLocaleString('ja-JP')
    : '—';

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f5f5f5" }}>
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* ── 戻るボタン ── */}
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-1.5 text-sm mb-4 hover:opacity-70 transition-opacity"
          style={{ color: PINK }}
        >
          <ArrowLeft size={15} strokeWidth={2} />
          作製中一覧に戻る
        </button>

        {/* ── ページヘッダー ── */}
        <div className="mb-1">
          <p className="text-xs text-gray-400 mb-0.5">{createdAt}</p>
          <h1 className="text-xl font-bold mb-2" style={{ color: "#1a1a1a" }}>
            {upload.insole_user_name ?? '（名前未設定）'}
          </h1>
          {upload.insole_user_kana && (
            <p className="text-sm text-gray-400 mb-2">{upload.insole_user_kana}</p>
          )}
          {/* インソール種別タグ */}
          {(upload.selected_insoles ?? []).length > 0 && (
            <div className="flex gap-2 mb-4 flex-wrap">
              {(upload.selected_insoles ?? []).map((ins) => (
                <span
                  key={ins}
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: `${PINK}15`, color: PINK, border: `1px solid ${PINK}40` }}
                >
                  {ins}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── 工程進捗（計測/分析/設計/作製/発送） ── */}
        {/* 各カードにその工程の機能ボタンを内包する設計(2026-08-25確定)。
            計測・設計・発送のボタンは対応機能の実装時に追加する。 */}
        <WorkflowProgressBar
          steps={stepDisplays}
          pendingStep={pendingStep}
          onToggle={handleToggleStep}
          actions={{
            measure: {
              label: workflow?.measure_done ? '計測を確認する' : '計測を開始する',
              onClick: () => {
                if (!id) return;
                const params = new URLSearchParams({ uploadId: id });
                if (upload?.order_id) params.set('orderId', upload.order_id);
                window.open(`${FOOT_MEASURE_URL}/measure?${params.toString()}`, '_blank', 'noopener,noreferrer');
              },
            },
            analy: { label: '動作分析を開く', onClick: () => setLocation(`/customer/${id}/analysis`) },
          }}
        />

        <ShippingSection
          workflow={workflow}
          trackingInput={trackingInput}
          onTrackingInputChange={setTrackingInput}
          onSaveTracking={handleSaveTracking}
          savingTracking={savingTracking}
          onToggleShipped={handleToggleShipped}
          togglingShip={togglingShip}
        />

        {/* ── 注文情報ブロック（横幅全体） ── */}
        <Card className="mb-4">
          <SectionTitle>注文・アップロード情報</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: "#555" }}>注文情報</p>
              <InfoRow label="アップロードID" value={upload.id} />
              <InfoRow label="注文ID" value={upload.order_id} />
              <InfoRow label="注文コード" value={upload.order_name} />
              <InfoRow label="ゲストアップロード" value={upload.guest_tf ? 'true' : 'false'} />
              <InfoRow label="前回デザイン" value={upload.previous_design_tf ? 'true' : 'false'} />
              <InfoRow label="ステータス" value={upload.status} />
              <InfoRow label="作成日時" value={createdAt} />
              <InfoRow label="更新日時" value={updatedAt} />
            </div>
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: "#555" }}>組織情報</p>
              <InfoRow label="組織ID" value={upload.organization_id} />
              <InfoRow label="ユーザーID" value={upload.user_id} />
              <InfoRow label="ルームカラー" value={upload.room_color} />
            </div>
          </div>
        </Card>

        {/* ── 3カラムレイアウト ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr_1fr] gap-4">

          {/* ════ 左カラム ════ */}
          <div>
            {/* 顧客情報(編集可・改訂履歴あり) */}
            <EditableInfoCard
              title="顧客情報"
              fields={[
                { key: 'insole_user_name', label: 'インソール利用者名', value: upload.insole_user_name ?? '' },
                { key: 'insole_user_kana', label: 'ふりがな', value: upload.insole_user_kana ?? '' },
                { key: 'phone', label: '電話番号', value: getStr(customerInfo, 'phone') },
              ]}
              onSave={(v) =>
                handleSaveUploadPatch(
                  {
                    insole_user_name: v.insole_user_name,
                    insole_user_kana: v.insole_user_kana,
                    customer_info: { ...(customerInfo ?? {}), phone: v.phone },
                  },
                  '顧客情報を編集'
                )
              }
            />

            {/* 作製目的(編集可・改訂履歴あり) */}
            <EditableInfoCard
              title="作製目的"
              fields={[
                {
                  key: 'purposes',
                  label: '目的',
                  value: Array.isArray(purposeInfo?.purposes)
                    ? (purposeInfo!.purposes as string[]).join(', ')
                    : getStr(purposeInfo, 'purposes'),
                },
                { key: 'lifestyle', label: 'ライフスタイル', value: getStr(purposeInfo, 'lifestyle') },
                { key: 'playstyle', label: 'プレイスタイル', value: getStr(purposeInfo, 'playstyle') },
                { key: 'otherPurpose', label: 'その他', value: getStr(purposeInfo, 'otherPurpose') },
              ]}
              onSave={(v) =>
                handleSaveUploadPatch(
                  {
                    purpose_info: {
                      ...(purposeInfo ?? {}),
                      purposes: v.purposes.split(',').map((s) => s.trim()).filter(Boolean),
                      lifestyle: v.lifestyle,
                      playstyle: v.playstyle,
                      otherPurpose: v.otherPurpose,
                    },
                  },
                  '作製目的を編集'
                )
              }
            />

            {/* 配送先情報(編集可・改訂履歴あり) */}
            <EditableInfoCard
              title="配送先情報"
              fields={[
                { key: 'userName', label: '氏名', value: getStr(customerInfo, 'userName') },
                { key: 'userKana', label: 'ふりがな', value: getStr(customerInfo, 'userKana') },
                { key: 'shipName', label: '配送先名', value: getStr(customerInfo, 'shipName') },
                { key: 'postalCode', label: '郵便番号', value: getStr(customerInfo, 'postalCode') },
                { key: 'prefecture', label: '都道府県', value: getStr(customerInfo, 'prefecture') },
                { key: 'city', label: '市区町村', value: getStr(customerInfo, 'city') },
                { key: 'address', label: '住所', value: getStr(customerInfo, 'address') },
                { key: 'building', label: '建物名', value: getStr(customerInfo, 'building') },
                { key: 'phone', label: '電話番号', value: getStr(customerInfo, 'phone') },
              ]}
              onSave={(v) =>
                handleSaveUploadPatch(
                  { customer_info: { ...(customerInfo ?? {}), ...v } },
                  '配送先情報を編集'
                )
              }
            />
          </div>

          {/* ════ 中央カラム：ファイル ════ */}
          <div>
            <Card>
              <SectionTitle>ファイル</SectionTitle>
              {files.length === 0 ? (
                <p className="text-xs text-gray-400">ファイルなし（Storage連携待ち）</p>
              ) : (
                files.map((file) => (
                  <FileCard key={file.id} file={file} onReplace={handleReplaceFile} />
                ))
              )}
            </Card>
          </div>

          {/* ════ 右カラム ════ */}
          <div>
            {/* 靴情報(編集可・改訂履歴あり、複雑なネスト構造のため暫定JSON編集) */}
            <JsonEditCard
              title="靴情報"
              value={shoeInfos}
              onSave={(v) => handleSaveUploadPatch({ shoe_infos: v }, '靴情報を編集')}
            />

            {/* 痛み(編集可・改訂履歴あり、暫定JSON編集) */}
            <JsonEditCard
              title="痛み"
              value={painInfo}
              onSave={(v) => handleSaveUploadPatch({ pain_info: v }, '痛みの情報を編集')}
            />

            {/* タコ(編集可・改訂履歴あり、暫定JSON編集) */}
            <JsonEditCard
              title="タコ・魚の目"
              value={takoInfo}
              onSave={(v) => handleSaveUploadPatch({ tako_info: v }, 'タコ・魚の目の情報を編集')}
            />

            {/* アップロード情報 */}
            <Card>
              <SectionTitle>アップロード情報</SectionTitle>
              <InfoRow label="id" value={upload.id} />
              <InfoRow label="created_at" value={createdAt} />
              <InfoRow label="updated_at" value={updatedAt} />
              <InfoRow label="user_id" value={upload.user_id} />
              <InfoRow label="organization_id" value={upload.organization_id} />
            </Card>
          </div>
        </div>

        {/* ── 変更履歴(データ改訂ログ) ── */}
        <RevisionHistorySection revisions={revisions} />

        {/* ── 動作分析結果(通信履歴の直上、本人指定) ── */}
        <AnalysisResultSection
          analysis={analysis}
          signs={analysisSigns}
          onEdit={() => setLocation(`/customer/${id}/analysis`)}
          emailInput={analysisEmailInput}
          onEmailInputChange={setAnalysisEmailInput}
          onSend={handleSendAnalysisEmail}
          sending={sendingAnalysisEmail}
          sentMsg={analysisEmailSentMsg}
        />

        {/* ── 通信履歴(メール・LINE)・再送(画面最下部、本人指定) ── */}
        <CommunicationLogSection logs={commLogs} resendingId={resendingId} onResend={handleResend} />
      </div>
    </div>
  );
}
