/**
 * 配送管理トップ画面 - セッション(バッチ)一覧
 * Blue(Glideベース)の配送管理トップ画面と同等の機能をGreenへ新規実装。
 *
 * - 「下書きのセッション」(address_csv_urlが未設定): カード表示
 * - 「CSV生成が完了したセッション」(address_csv_urlが設定済み): テーブル表示(履歴)
 * - 右上の「+ 新しいセッション」で出荷予定日(任意)を指定してセッションを作成し、
 *   作成後は詳細画面(/shipments/:id)へ遷移する。
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, Truck, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchShipmentBatches,
  fetchActiveShipmentItemCounts,
  createShipmentBatch,
  fetchCurrentMember,
  fetchMemberNameById,
  type ShipmentBatch,
} from "@/lib/supabase";

const PINK = "#D62598";

function formatDateTime(v: string | null): string {
  if (!v) return "—";
  return new Date(v).toLocaleString("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatDate(v: string | null): string {
  if (!v) return "未設定";
  return new Date(v).toLocaleDateString("ja-JP");
}

// ─── 新しいセッション作成モーダル ───────────────────────────────────────
function CreateBatchDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (batch: ShipmentBatch) => void;
}) {
  const { user } = useAuth();
  const [shipDate, setShipDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const member = user ? await fetchCurrentMember(user.id) : null;
      const created = await createShipmentBatch(shipDate || null, member?.id ?? null);
      onCreated(created);
      setShipDate("");
    } catch (e) {
      console.error("Failed to create shipment batch:", e);
      setError("セッションの作成に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新しいセッション</DialogTitle>
          <DialogDescription>出荷予定日を設定してください(未設定でも作成できます)。</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <label className="text-xs text-gray-500 block mb-1">出荷予定日</label>
          <input
            type="date"
            value={shipDate}
            onChange={(e) => setShipDate(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm"
            style={{ borderColor: "#ddd" }}
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ backgroundColor: PINK, color: "#fff" }}
          >
            {submitting ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
            提出
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── メインページ ─────────────────────────────────────────────────────────
export default function ShipmentSessionList() {
  const [, setLocation] = useLocation();
  const [batches, setBatches] = useState<ShipmentBatch[]>([]);
  const [editorNames, setEditorNames] = useState<Record<string, string>>({});
  const [itemCounts, setItemCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchShipmentBatches();
      setBatches(rows);
      const ids = Array.from(new Set(rows.map((r) => r.last_editor_member_id).filter(Boolean))) as string[];
      const [entries, counts] = await Promise.all([
        Promise.all(ids.map(async (id) => [id, (await fetchMemberNameById(id)) ?? "—"] as const)),
        fetchActiveShipmentItemCounts(rows.map((r) => r.id)),
      ]);
      setEditorNames(Object.fromEntries(entries));
      setItemCounts(counts);
    } catch (e) {
      console.error("Failed to fetch shipment batches:", e);
      setError("セッション一覧の取得に失敗しました。再読み込みしてください。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const draftBatches = batches.filter((b) => !b.address_csv_url);
  const completedBatches = batches.filter((b) => b.address_csv_url);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f5f5f5" }}>
      <div className="max-w-5xl mx-auto px-6 py-7">
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-1.5 text-sm mb-4 hover:opacity-70 transition-opacity"
          style={{ color: PINK }}
        >
          <ArrowLeft size={15} strokeWidth={2} />
          作製中一覧に戻る
        </button>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: "#1a1a1a" }}>
            <Truck size={20} strokeWidth={2} style={{ color: PINK }} />
            配送管理
          </h1>
          <Button
            onClick={() => setCreateOpen(true)}
            style={{ backgroundColor: PINK, color: "#fff" }}
            className="gap-1.5"
          >
            <Plus size={15} strokeWidth={2} />
            新しいセッション
          </Button>
        </div>

        {loading && (
          <div className="text-center py-20 text-sm" style={{ color: "#aaa" }}>
            読み込み中...
          </div>
        )}
        {!loading && error && (
          <div className="text-center py-10 text-sm text-red-500">{error}</div>
        )}

        {!loading && !error && (
          <>
            <section className="mb-10">
              <h2 className="text-sm font-bold mb-3" style={{ color: "#555" }}>
                下書きのセッション
              </h2>
              {draftBatches.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center border border-dashed rounded-lg">
                  下書きのセッションはありません
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {draftBatches.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => setLocation(`/shipments/${b.id}`)}
                      className="bg-white rounded-xl border border-border p-4 cursor-pointer hover:shadow-md transition-all"
                      style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
                    >
                      <p className="text-xs mb-1" style={{ color: "#aaa" }}>
                        最終更新: {formatDateTime(b.updated_at)}
                      </p>
                      <p className="text-xs mb-1" style={{ color: "#aaa" }}>
                        最終編集者: {b.last_editor_member_id ? (editorNames[b.last_editor_member_id] ?? "…") : "—"}
                      </p>
                      <p className="text-sm font-bold mb-1" style={{ color: "#1a1a1a" }}>
                        配送予定日: {formatDate(b.ship_date)}
                      </p>
                      <p className="text-xs" style={{ color: PINK }}>
                        リスト内の注文数: {itemCounts.get(b.id) ?? 0}件
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-sm font-bold mb-3" style={{ color: "#555" }}>
                CSV生成が完了したセッション
              </h2>
              {completedBatches.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center border border-dashed rounded-lg">
                  CSV生成が完了したセッションはありません
                </p>
              ) : (
                <div className="bg-white rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>出荷予定日</TableHead>
                        <TableHead>最終編集者</TableHead>
                        <TableHead>リスト内の注文数</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {completedBatches.map((b) => (
                        <TableRow
                          key={b.id}
                          onClick={() => setLocation(`/shipments/${b.id}`)}
                          className="cursor-pointer"
                        >
                          <TableCell>{formatDate(b.ship_date)}</TableCell>
                          <TableCell>
                            {b.last_editor_member_id ? (editorNames[b.last_editor_member_id] ?? "…") : "—"}
                          </TableCell>
                          <TableCell>{itemCounts.get(b.id) ?? 0}件</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <CreateBatchDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(batch) => {
          setCreateOpen(false);
          setLocation(`/shipments/${batch.id}`);
        }}
      />
    </div>
  );
}
