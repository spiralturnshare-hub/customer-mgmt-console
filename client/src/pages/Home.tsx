/**
 * 作製中一覧 - CRMトップ画面
 * データソース: Supabase Green (fhamrkmsxidxayaoexso) の uploads テーブル
 * upload-center から送信されたデータをリアルタイムで表示する
 *
 * 2026-08-27: 顧客詳細画面を開かずにこの一覧から直接操作できるよう変更。
 * - 計測・分析ステップは production_workflows と連携する実データ(以前はローカルのみの
 *   ダミー状態だった)。
 * - 計測・分析ボタンを追加(顧客詳細画面と同じ導線: 計測はfoot-measureを新タブで開く、
 *   分析はGaitAnalysis画面へ遷移)。
 * - 追跡番号の入力欄を追加。バーコードスキャナー(キーボード入力互換の物理機器)を
 *   使う想定のため、普通のテキスト入力欄のままで対応できる(追加実装不要)。
 */
import { useState, useEffect, useCallback } from "react";
import { Search, SlidersHorizontal, ChevronDown, ExternalLink, MessageCircle, RefreshCw, Loader2, Truck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchUploads,
  fetchWorkflowsByUploadIds,
  fetchMeasurementsByUploadIds,
  toggleWorkflowStep,
  saveTrackingNumber,
  fetchCurrentMember,
  type UploadRecord,
  type ProductionWorkflow,
  type WorkflowStep,
  type FootMeasurementRow,
} from "@/lib/supabase";

const PINK = "#D62598";
// foot-measure(足の計測アプリ、別デプロイ)への連携URL
const FOOT_MEASURE_URL = "https://foot-measure.vercel.app";

interface Customer {
  id: string;
  orderId: string | null;
  uploadA?: string;
  uploadB?: string;
  uploadedAt?: string;
  orderCode?: string;
  customerName: string;
  selectedInsoles: string[];
  status: string | null;
}

// UploadRecord → Customer 変換
function mapUploadToCustomer(u: UploadRecord): Customer {
  return {
    id: u.id,
    orderId: u.order_id,
    uploadA: u.guest_tf ? 'ゲストアップロード' : undefined,
    uploadB: u.insole_user_name ?? undefined,
    uploadedAt: u.created_at
      ? new Date(u.created_at).toLocaleString('ja-JP', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit',
        })
      : undefined,
    orderCode: u.order_name ?? undefined,
    customerName: u.insole_user_name ?? '（名前未設定）',
    selectedInsoles: u.selected_insoles ?? [],
    status: u.status,
  };
}

// ─── 進捗テーブル(実データ連携) ─────────────────────────────────────────────
const COLUMNS: { label: string; step: WorkflowStep }[] = [
  { label: "計測", step: "measure" },
  { label: "分析", step: "analy" },
  { label: "設計", step: "design" },
  { label: "作製", step: "produce" },
  { label: "発送", step: "ship" },
];

function ProgressTable({
  workflow,
  pendingStep,
  onToggle,
  onOpenMeasure,
  onOpenAnalysis,
  trackingInput,
  onTrackingInputChange,
  onSaveTracking,
  savingTracking,
}: {
  workflow: ProductionWorkflow | null;
  pendingStep: WorkflowStep | null;
  onToggle: (step: WorkflowStep, nextDone: boolean) => void;
  onOpenMeasure: () => void;
  onOpenAnalysis: () => void;
  trackingInput: string;
  onTrackingInputChange: (v: string) => void;
  onSaveTracking: () => void;
  savingTracking: boolean;
}) {
  const doneFor = (step: WorkflowStep): boolean => Boolean(workflow?.[`${step}_done` as keyof ProductionWorkflow]);

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.step}
                className="px-5 py-2 text-left font-normal text-xs border-b border-border"
                style={{ color: "#aaa", minWidth: 90 }}
              >
                {col.label}
              </th>
            ))}
            <th
              className="px-5 py-2 text-left font-normal text-xs border-b border-border"
              style={{ color: "#aaa", minWidth: 90 }}
            >
              出荷日
            </th>
            <th
              className="px-5 py-2 text-left font-normal text-xs border-b border-border"
              style={{ color: "#aaa", minWidth: 160 }}
            >
              追跡番号
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            {COLUMNS.map((col) => {
              const isPending = pendingStep === col.step;
              const done = doneFor(col.step);
              return (
                <td key={col.step} className="px-5 py-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={done}
                      disabled={isPending}
                      onCheckedChange={() => onToggle(col.step, !done)}
                      className="data-[state=checked]:bg-[#D62598] data-[state=checked]:border-[#D62598]"
                      style={!done ? { borderColor: "#ccc", backgroundColor: "transparent" } : {}}
                    />
                    {col.step === "measure" && (
                      <button
                        type="button"
                        onClick={onOpenMeasure}
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap"
                        style={{ color: PINK, border: `1px solid ${PINK}55`, backgroundColor: "#fff" }}
                      >
                        計測
                      </button>
                    )}
                    {col.step === "analy" && (
                      <button
                        type="button"
                        onClick={onOpenAnalysis}
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap"
                        style={{ color: PINK, border: `1px solid ${PINK}55`, backgroundColor: "#fff" }}
                      >
                        分析
                      </button>
                    )}
                  </div>
                </td>
              );
            })}
            <td className="px-5 py-2">
              <span className="text-xs" style={{ color: "#aaa" }}>
                {workflow?.shipped_at ? new Date(workflow.shipped_at).toLocaleDateString('ja-JP') : "—"}
              </span>
            </td>
            <td className="px-5 py-2">
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={trackingInput}
                  onChange={(e) => onTrackingInputChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onSaveTracking()}
                  placeholder="バーコードを読取/入力"
                  className="text-xs border rounded-md px-2 py-1 w-28"
                  style={{ borderColor: "#ddd" }}
                />
                <button
                  type="button"
                  onClick={onSaveTracking}
                  disabled={savingTracking}
                  className="text-[10px] font-bold px-1.5 py-1 rounded whitespace-nowrap disabled:opacity-60"
                  style={{ color: PINK, border: `1px solid ${PINK}55`, backgroundColor: "#fff" }}
                >
                  {savingTracking ? "…" : "保存"}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── 顧客カード ───────────────────────────────────────────────────────────
function CustomerCard({
  customer,
  workflow,
  measurement,
  pendingStep,
  onToggle,
  trackingInput,
  onTrackingInputChange,
  onSaveTracking,
  savingTracking,
}: {
  customer: Customer;
  workflow: ProductionWorkflow | null;
  measurement: FootMeasurementRow | null;
  pendingStep: WorkflowStep | null;
  onToggle: (cid: string, step: WorkflowStep, nextDone: boolean) => void;
  trackingInput: string;
  onTrackingInputChange: (v: string) => void;
  onSaveTracking: () => void;
  savingTracking: boolean;
}) {
  const [, setLocation] = useLocation();

  function handleOpenMeasure() {
    const params = new URLSearchParams({ uploadId: customer.id });
    if (customer.orderId) params.set('orderId', customer.orderId);
    if (measurement) params.set('readjust', measurement.id);
    window.open(`${FOOT_MEASURE_URL}/measure?${params.toString()}`, '_blank', 'noopener,noreferrer');
  }

  return (
    <div
      className="bg-white rounded-xl border border-border p-5 mb-4"
      style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
    >
      {customer.uploadA && (
        <p className="text-xs font-bold mb-1" style={{ color: "#D62598", letterSpacing: "0.04em" }}>
          {customer.uploadA}
        </p>
      )}
      {customer.uploadB && (
        <p className="text-xs font-bold mb-1" style={{ color: "#D62598", letterSpacing: "0.04em" }}>
          {customer.uploadB}
        </p>
      )}
      {customer.uploadedAt && (
        <p className="text-xs mb-0.5" style={{ color: "#aaa", letterSpacing: "0.02em" }}>
          {customer.uploadedAt}
        </p>
      )}
      {customer.orderCode && (
        <p className="text-xs font-bold mb-1" style={{ color: "#D62598", letterSpacing: "0.04em" }}>
          {customer.orderCode}
        </p>
      )}
      {customer.selectedInsoles.length > 0 && (
        <div className="flex gap-1 mb-2 flex-wrap">
          {customer.selectedInsoles.map((ins) => (
            <span
              key={ins}
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: '#D6259815', color: '#D62598', border: '1px solid #D6259840' }}
            >
              {ins}
            </span>
          ))}
        </div>
      )}
      <h2 className="text-2xl font-bold mb-4" style={{ color: "#1a1a1a", letterSpacing: "0.05em" }}>
        {customer.customerName}
      </h2>
      <div className="flex items-center gap-2 mb-1">
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-all active:scale-95"
          style={{ backgroundColor: "#D62598" }}
        >
          <MessageCircle size={15} strokeWidth={2} />
          LINE
        </button>
        <button
          onClick={() => setLocation(`/customer/${customer.id}`)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-white hover:bg-gray-50 transition-all active:scale-95"
          style={{ color: "#555" }}
        >
          <ExternalLink size={14} strokeWidth={1.8} />
          管理画面を開く
        </button>
      </div>
      <ProgressTable
        workflow={workflow}
        pendingStep={pendingStep}
        onToggle={(step, nextDone) => onToggle(customer.id, step, nextDone)}
        onOpenMeasure={handleOpenMeasure}
        onOpenAnalysis={() => setLocation(`/customer/${customer.id}/analysis`)}
        trackingInput={trackingInput}
        onTrackingInputChange={onTrackingInputChange}
        onSaveTracking={onSaveTracking}
        savingTracking={savingTracking}
      />
    </div>
  );
}

// ─── メインページ ─────────────────────────────────────────────────────────
export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [workflows, setWorkflows] = useState<Map<string, ProductionWorkflow>>(new Map());
  const [measurements, setMeasurements] = useState<Map<string, FootMeasurementRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [memberId, setMemberId] = useState<string | null>(null);

  const [pendingKey, setPendingKey] = useState<string | null>(null); // `${uploadId}:${step}`
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});
  const [savingTrackingId, setSavingTrackingId] = useState<string | null>(null);

  const loadUploads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const records = await fetchUploads({ limit: 100 });
      const mapped = records.map(mapUploadToCustomer);
      setCustomers(mapped);
      const ids = mapped.map((c) => c.id);
      const [wfMap, measureMap] = await Promise.all([
        fetchWorkflowsByUploadIds(ids),
        fetchMeasurementsByUploadIds(ids),
      ]);
      setWorkflows(wfMap);
      setMeasurements(measureMap);
      setTrackingInputs(
        Object.fromEntries(mapped.map((c) => [c.id, wfMap.get(c.id)?.tracking_number ?? '']))
      );
    } catch (e) {
      console.error('Failed to fetch uploads:', e);
      setError('データの取得に失敗しました。再読み込みしてください。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUploads();
  }, [loadUploads]);

  useEffect(() => {
    if (!user) return;
    fetchCurrentMember(user.id).then((m) => setMemberId(m?.id ?? null));
  }, [user]);

  async function handleToggle(uploadId: string, step: WorkflowStep, nextDone: boolean) {
    const key = `${uploadId}:${step}`;
    setPendingKey(key);
    try {
      const customer = customers.find((c) => c.id === uploadId);
      const updated = await toggleWorkflowStep(uploadId, customer?.orderId ?? null, step, nextDone, memberId);
      setWorkflows((prev) => new Map(prev).set(uploadId, updated));
    } catch (e) {
      // 失敗時は表示を変更せず据え置く
    } finally {
      setPendingKey(null);
    }
  }

  async function handleSaveTracking(uploadId: string) {
    setSavingTrackingId(uploadId);
    try {
      const customer = customers.find((c) => c.id === uploadId);
      const value = trackingInputs[uploadId] ?? '';
      const updated = await saveTrackingNumber(uploadId, customer?.orderId ?? null, value.trim());
      setWorkflows((prev) => new Map(prev).set(uploadId, updated));
    } catch (e) {
      // 失敗時は入力値を保持したまま据え置く
    } finally {
      setSavingTrackingId(null);
    }
  }

  const filtered = customers.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim();
    return (
      c.customerName.includes(q) ||
      (c.orderCode?.includes(q) ?? false) ||
      (c.uploadA?.includes(q) ?? false) ||
      (c.uploadB?.includes(q) ?? false)
    );
  });

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f5f5f5" }}>
      <div className="max-w-5xl mx-auto px-6 py-7">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold" style={{ color: "#1a1a1a" }}>
              作製中一覧
            </h1>
            <button
              type="button"
              onClick={() => setLocation('/shipments')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95"
              style={{ color: PINK, border: `1px solid ${PINK}55`, backgroundColor: "#fff" }}
            >
              <Truck size={13} strokeWidth={2} />
              配送管理
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: "#aaa" }}
              />
              <Input
                type="text"
                placeholder="検索"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-4 py-2 h-9 w-52 text-sm bg-white border-border focus-visible:ring-[#D62598]"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 gap-1.5 bg-white border-border text-sm font-normal"
              style={{ color: "#555" }}
            >
              <SlidersHorizontal size={13} strokeWidth={1.8} />
              フィルタ
              <ChevronDown size={12} strokeWidth={2} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadUploads}
              disabled={loading}
              className="h-9 px-3 bg-white border-border"
              style={{ color: "#555" }}
            >
              <RefreshCw size={13} strokeWidth={1.8} className={loading ? 'animate-spin' : ''} />
            </Button>
          </div>
        </div>
        {loading && (
          <div className="text-center py-20 text-sm" style={{ color: "#aaa" }}>
            読み込み中...
          </div>
        )}
        {!loading && error && (
          <div className="text-center py-10 text-sm text-red-500">
            {error}
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-20 text-muted-foreground text-sm">
            該当するデータがありません
          </div>
        )}
        {!loading && !error && filtered.map((customer) => {
          const [pendingUploadId, pendingStepRaw] = (pendingKey ?? '').split(':');
          const pendingStep = pendingUploadId === customer.id ? (pendingStepRaw as WorkflowStep) : null;
          return (
            <CustomerCard
              key={customer.id}
              customer={customer}
              workflow={workflows.get(customer.id) ?? null}
              measurement={measurements.get(customer.id) ?? null}
              pendingStep={pendingStep}
              onToggle={handleToggle}
              trackingInput={trackingInputs[customer.id] ?? ''}
              onTrackingInputChange={(v) => setTrackingInputs((prev) => ({ ...prev, [customer.id]: v }))}
              onSaveTracking={() => handleSaveTracking(customer.id)}
              savingTracking={savingTrackingId === customer.id}
            />
          );
        })}
      </div>
    </div>
  );
}
