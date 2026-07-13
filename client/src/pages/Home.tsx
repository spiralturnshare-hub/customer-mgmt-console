/**
 * 作製中一覧 - CRMトップ画面
 * デザイン: PANTONE Pink C (#D62598) アクセント、白カード、薄グレー背景
 * レイアウト: ヘッダー（タイトル＋検索＋フィルタ）＋縦スクロールカードリスト
 *
 * カード構造:
 *   - アップロードデータ（アップロードA / アップロードB）
 *   - アップロード日時
 *   - 注文コード（任意）
 *   - 顧客名（1つのみ）
 *   - LINE / 管理画面ボタン
 *   - 進捗テーブル
 */

import { useState } from "react";
import { Search, SlidersHorizontal, ChevronDown, ExternalLink, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocation } from "wouter";

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
  /** アップロードA のラベル（例: "ゲストアップロード"） */
  uploadA?: string;
  /** アップロードB のラベル（例: "圏　佑汰"） */
  uploadB?: string;
  /** アップロード日時（例: "2024-03-15 14:32"） */
  uploadedAt?: string;
  /** 注文コード（例: "ST-01387"） */
  orderCode?: string;
  /** 顧客名 */
  customerName: string;
  rows: ProgressRow[];
}

// ─── サンプルデータ ──────────────────────────────────────────────────────────
const initialCustomers: Customer[] = [
  {
    id: "1",
    uploadA: "ゲストアップロード",
    uploadB: "圏　佑汰",
    uploadedAt: "2024-03-15 14:32",
    customerName: "獄　佑汰",
    rows: [
      { id: 1, keisoku: false, bunseki: true, sekkei: false, sakusei: false, hassou: false, shukkaDate: "" },
    ],
  },
  {
    id: "2",
    uploadedAt: "2024-03-16 09:10",
    customerName: "渡部　紀子",
    rows: [
      { id: 1, keisoku: false, bunseki: true, sekkei: false, sakusei: false, hassou: false, shukkaDate: "" },
    ],
  },
  {
    id: "3",
    uploadedAt: "2024-03-17 11:45",
    orderCode: "ST-01387",
    customerName: "野尻　美代子",
    rows: [
      { id: 1, keisoku: false, bunseki: true, sekkei: false, sakusei: false, hassou: false, shukkaDate: "" },
    ],
  },
  {
    id: "4",
    uploadedAt: "2024-03-18 16:20",
    customerName: "田畑　より子",
    rows: [
      { id: 1, keisoku: false, bunseki: true, sekkei: false, sakusei: false, hassou: false, shukkaDate: "" },
    ],
  },
];

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
          <tr style={{ backgroundColor: "#f9f9f9" }}>
            {COLUMNS.map((col) => (
              <th
                key={col.field}
                className="px-5 py-2 text-left font-normal text-xs border-b border-border"
                style={{ color: "#888", minWidth: 140 }}
              >
                {col.label}
              </th>
            ))}
            <th
              className="px-5 py-2 text-left font-normal text-xs border-b border-border"
              style={{ color: "#888", minWidth: 160 }}
            >
              出荷予定日
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="bg-white">
              {COLUMNS.map((col, i) => (
                <td key={col.field} className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    {i === 0 && (
                      <span className="text-xs" style={{ color: "#bbb", minWidth: 12 }}>
                        {row.id}
                      </span>
                    )}
                    <Checkbox
                      checked={row[col.field]}
                      onCheckedChange={() => onToggle(row.id, col.field)}
                      className="data-[state=checked]:bg-[#D62598] data-[state=checked]:border-[#D62598]"
                      style={
                        !row[col.field]
                          ? { borderColor: "#ccc", backgroundColor: "transparent" }
                          : undefined
                      }
                    />
                  </div>
                </td>
              ))}
              <td className="px-5 py-3">
                <span className="text-xs text-muted-foreground">{row.shukkaDate}</span>
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
      style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
    >
      {/* ── アップロードA ── */}
      {customer.uploadA && (
        <p className="text-xs font-bold mb-0.5" style={{ color: "#D62598", letterSpacing: "0.04em" }}>
          {customer.uploadA}
        </p>
      )}

      {/* ── アップロードB ── */}
      {customer.uploadB && (
        <p className="text-xs font-bold mb-1" style={{ color: "#D62598", letterSpacing: "0.04em" }}>
          {customer.uploadB}
        </p>
      )}

      {/* ── アップロード日時 ── */}
      {customer.uploadedAt && (
        <p className="text-xs mb-0.5" style={{ color: "#aaa", letterSpacing: "0.02em" }}>
          {customer.uploadedAt}
        </p>
      )}

      {/* ── 注文コード ── */}
      {customer.orderCode && (
        <p className="text-xs font-bold mb-1" style={{ color: "#D62598", letterSpacing: "0.04em" }}>
          {customer.orderCode}
        </p>
      )}

      {/* ── 顧客名（1つのみ） ── */}
      <h2 className="text-2xl font-bold mb-4" style={{ color: "#1a1a1a", letterSpacing: "0.05em" }}>
        {customer.customerName}
      </h2>

      {/* ── ボタン群 ── */}
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

      {/* ── 進捗テーブル ── */}
      <ProgressTable
        rows={customer.rows}
        onToggle={(rowId, field) => onToggle(customer.id, rowId, field)}
      />
    </div>
  );
}

// ─── メインページ ─────────────────────────────────────────────────────────
export default function Home() {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [searchQuery, setSearchQuery] = useState("");

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

        {/* ─── ヘッダー ─── */}
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
          </div>
        </div>

        {/* ─── カードリスト ─── */}
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground text-sm">
            該当するデータがありません
          </div>
        ) : (
          filtered.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              onToggle={handleToggle}
            />
          ))
        )}
      </div>
    </div>
  );
}
