/**
 * 作製中一覧 - CRMトップ画面
 * データソース: Supabase Green (fhamrkmsxidxayaoexso) の uploads テーブル
 * upload-center から送信されたデータをリアルタイムで表示する
 */
import { useState, useEffect, useCallback } from "react";
import { Search, SlidersHorizontal, ChevronDown, ExternalLink, MessageCircle, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocation } from "wouter";
import { fetchUploads, type UploadRecord } from "@/lib/supabase";

// ─── 型定義 ────────────────────────────────────────────────────────────────
interface ProgressRow {
  id: number;
  keisoku: boolean;
  bunseki: boolean;
  sekkei: boolean;
  sakusei: boolean;
  hassou: boolean;
  shukkaDate: string;
}

interface Customer {
  id: string;
  uploadA?: string;
  uploadB?: string;
  uploadedAt?: string;
  orderCode?: string;
  customerName: string;
  selectedInsoles: string[];
  status: string | null;
  rows: ProgressRow[];
}

// UploadRecord → Customer 変換
function mapUploadToCustomer(u: UploadRecord): Customer {
  return {
    id: u.id,
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
    rows: [
      { id: 1, keisoku: false, bunseki: false, sekkei: false, sakusei: false, hassou: false, shukkaDate: '' },
    ],
  };
}

// ─── 進捗テーブル ─────────────────────────────────────────────────────────
const COLUMNS = [
  { label: "計測", field: "keisoku" as const },
  { label: "分析", field: "bunseki" as const },
  { label: "設計", field: "sekkei" as const },
  { label: "作製", field: "sakusei" as const },
  { label: "発送", field: "hassou" as const },
];

function ProgressTable({
  rows,
  onToggle,
}: {
  rows: ProgressRow[];
  onToggle: (rowId: number, field: keyof Omit<ProgressRow, "id" | "shukkaDate">) => void;
}) {
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.field}
                className="px-5 py-2 text-left font-normal text-xs border-b border-border"
                style={{ color: "#aaa", minWidth: 60 }}
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
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {COLUMNS.map((col) => (
                <td key={col.field} className="px-5 py-2">
                  <Checkbox
                    checked={row[col.field]}
                    onCheckedChange={() => onToggle(row.id, col.field)}
                    className="data-[state=checked]:bg-[#D62598] data-[state=checked]:border-[#D62598]"
                    style={
                      !row[col.field]
                        ? { borderColor: "#ccc", backgroundColor: "transparent" }
                        : {}
                    }
                  />
                </td>
              ))}
              <td className="px-5 py-2">
                <span className="text-xs" style={{ color: "#aaa" }}>
                  {row.shukkaDate || "—"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── 顧客カード ───────────────────────────────────────────────────────────
function CustomerCard({
  customer,
  onToggle,
}: {
  customer: Customer;
  onToggle: (cid: string, rowId: number, field: keyof Omit<ProgressRow, "id" | "shukkaDate">) => void;
}) {
  const [, setLocation] = useLocation();
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
        rows={customer.rows}
        onToggle={(rowId, field) => onToggle(customer.id, rowId, field)}
      />
    </div>
  );
}

// ─── メインページ ─────────────────────────────────────────────────────────
export default function Home() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const loadUploads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const records = await fetchUploads({ limit: 100 });
      setCustomers(records.map(mapUploadToCustomer));
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

  const handleToggle = (
    cid: string,
    rowId: number,
    field: keyof Omit<ProgressRow, "id" | "shukkaDate">
  ) => {
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === cid
          ? {
              ...c,
              rows: c.rows.map((r) =>
                r.id === rowId ? { ...r, [field]: !r[field] } : r
              ),
            }
          : c
      )
    );
  };

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
          <h1 className="text-xl font-bold" style={{ color: "#1a1a1a" }}>
            作製中一覧
          </h1>
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
        {!loading && !error && filtered.map((customer) => (
          <CustomerCard
            key={customer.id}
            customer={customer}
            onToggle={handleToggle}
          />
        ))}
      </div>
    </div>
  );
}
