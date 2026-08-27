/**
 * 配送管理 - セッション詳細画面
 * Blue(Glideベース)の配送管理詳細画面と同等の機能をGreenへ新規実装。
 *
 * - 上部: 最終更新日/最終編集者/配送予定日(編集可)/リスト内の注文数
 * - CSV未生成なら「CSV生成実行」、生成済みなら「CSVファイルをダウンロード」
 * - 「リストに入っている注文」テーブル(検索・削除)
 * - 「+ まとめて追加」モーダル(検索・音声検索・複数選択/単独追加の両対応)
 *
 * 注意: 顧客をセッションから外す・付け替える操作は、必ずremoveShipmentItem/
 * addUploadToShipmentBatch(RPC経由)で行う。shipment_itemsへの直接updateで
 * is_active等を書き換えないこと(会社のデータ改訂ポリシー)。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Truck, Plus, Search, Mic, Loader2, Download, FileSpreadsheet, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  fetchShipmentBatchById,
  updateShipmentBatchShipDate,
  fetchActiveShipmentItemsByBatchId,
  fetchMemberNameById,
  fetchCurrentMember,
  searchCandidateUploads,
  addUploadToShipmentBatch,
  removeShipmentItem,
  fetchUploadShipByUploadIds,
  fetchOrdersShipInfoByIds,
  uploadShipmentCsvToStorage,
  finalizeShipmentBatchCsv,
  ensureProductionWorkflow,
  type ShipmentBatch,
  type ShipmentItemDisplay,
  type ShipmentCandidate,
} from "@/lib/supabase";

const PINK = "#D62598";
const SENDER_NAME = "株式会社SPIRALTURN";

function formatDateTime(v: string | null): string {
  if (!v) return "—";
  return new Date(v).toLocaleString("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

// ============================================================
// CSV生成(将来ヤマト運輸(黒猫)への投入を見据えた列構成)
// ============================================================
function csvEscape(v: string | null | undefined): string {
  const s = (v ?? "").toString();
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildShipmentCsv(
  items: ShipmentItemDisplay[],
  uploadShipMap: Map<string, { ship_name: string | null; ship_kana: string | null; postal_code: string | null; prefecture: string | null; city: string | null; address_line1: string | null; address_line2: string | null; phone: string | null }>,
  orderShipMap: Map<string, { ship_name: string | null; ship_phone: string | null; ship_postal_code: string | null; ship_prefecture: string | null; ship_city: string | null; ship_address_line1: string | null; ship_address_line2: string | null }>
): string {
  const header = [
    "お客様管理番号", "お届け先郵便番号", "お届け先都道府県", "お届け先市区町村",
    "お届け先住所1", "お届け先住所2", "お届け先氏名", "お届け先氏名カナ",
    "お届け先電話番号", "依頼主名", "品名",
  ];
  const rows = items.map((item) => {
    const ship = item.upload_id ? uploadShipMap.get(item.upload_id) : undefined;
    const orderShip = item.order_id ? orderShipMap.get(item.order_id) : undefined;
    const productName = (item.selected_insoles ?? []).join("/");
    return [
      item.order_name ?? "",
      ship?.postal_code ?? orderShip?.ship_postal_code ?? "",
      ship?.prefecture ?? orderShip?.ship_prefecture ?? "",
      ship?.city ?? orderShip?.ship_city ?? "",
      ship?.address_line1 ?? orderShip?.ship_address_line1 ?? "",
      ship?.address_line2 ?? orderShip?.ship_address_line2 ?? "",
      ship?.ship_name ?? orderShip?.ship_name ?? item.insole_user_name ?? "",
      ship?.ship_kana ?? item.insole_user_kana ?? "",
      ship?.phone ?? orderShip?.ship_phone ?? "",
      SENDER_NAME,
      productName,
    ].map(csvEscape).join(",");
  });
  return [header.map(csvEscape).join(","), ...rows].join("\r\n");
}

// ============================================================
// 顧客追加モーダル
// ============================================================
function AddCandidatesModal({
  open,
  onOpenChange,
  onAdded,
  memberId,
  batchId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
  memberId: string | null;
  batchId: string;
}) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<ShipmentCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [bulkAdding, setBulkAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);

  const SpeechRecognitionCtor =
    typeof window !== "undefined"
      ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
      : undefined;

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setCandidates([]);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const results = await searchCandidateUploads(q, true);
      setCandidates(results);
    } catch (e) {
      console.error("Failed to search candidates:", e);
      setError("候補の検索に失敗しました。");
    } finally {
      setSearching(false);
    }
  }, []);

  // 入力のデバウンス検索
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => runSearch(query), 400);
    return () => clearTimeout(timer);
  }, [query, open, runSearch]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setCandidates([]);
      setSelected(new Set());
      setError(null);
    }
  }, [open]);

  function handleMicClick() {
    if (!SpeechRecognitionCtor) return;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "ja-JP";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? "";
      if (transcript) setQuery(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    setListening(true);
    recognition.start();
  }

  function toggleSelected(uploadId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uploadId)) next.delete(uploadId);
      else next.add(uploadId);
      return next;
    });
  }

  async function addOne(candidate: ShipmentCandidate) {
    setAddingId(candidate.upload_id);
    setError(null);
    try {
      const workflow = await ensureProductionWorkflow(candidate.upload_id, candidate.order_id);
      await addUploadToShipmentBatch(
        batchId,
        candidate.upload_id,
        candidate.order_id,
        workflow.id,
        candidate.user_id,
        memberId
      );
      setCandidates((prev) => prev.filter((c) => c.upload_id !== candidate.upload_id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(candidate.upload_id);
        return next;
      });
      onAdded();
    } catch (e) {
      console.error("Failed to add candidate:", e);
      setError("追加に失敗しました。");
    } finally {
      setAddingId(null);
    }
  }

  async function addSelected() {
    if (selected.size === 0) return;
    setBulkAdding(true);
    setError(null);
    try {
      const targets = candidates.filter((c) => selected.has(c.upload_id));
      for (const candidate of targets) {
        const workflow = await ensureProductionWorkflow(candidate.upload_id, candidate.order_id);
        await addUploadToShipmentBatch(
          (window as any).__currentBatchId,
          candidate.upload_id,
          candidate.order_id,
          workflow.id,
          candidate.user_id,
          memberId
        );
      }
      const addedIds = new Set(targets.map((t) => t.upload_id));
      setCandidates((prev) => prev.filter((c) => !addedIds.has(c.upload_id)));
      setSelected(new Set());
      onAdded();
    } catch (e) {
      console.error("Failed to bulk add candidates:", e);
      setError("一括追加に失敗しました。途中まで追加された可能性があります。一覧を確認してください。");
    } finally {
      setBulkAdding(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>まとめて追加</DialogTitle>
          <DialogDescription>
            氏名・かな・注文ID・メールアドレス・電話番号のいずれかで検索できます。
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="氏名・かな・注文ID・メール・電話で検索"
              className="pl-8"
            />
          </div>
          {SpeechRecognitionCtor && (
            <button
              type="button"
              onClick={handleMicClick}
              className="shrink-0 p-2 rounded-lg border transition-all"
              style={{
                color: listening ? "#fff" : PINK,
                backgroundColor: listening ? PINK : "#fff",
                borderColor: `${PINK}55`,
              }}
              title="音声で検索(読み仮名・電話番号向け)"
            >
              <Mic size={16} strokeWidth={2} />
            </button>
          )}
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex-1 overflow-y-auto border rounded-lg" style={{ borderColor: "#eee" }}>
          {searching && (
            <div className="text-center py-6 text-sm text-gray-400">検索中...</div>
          )}
          {!searching && query.trim() && candidates.length === 0 && (
            <div className="text-center py-6 text-sm text-gray-400">該当する候補はありません</div>
          )}
          {!searching && !query.trim() && (
            <div className="text-center py-6 text-sm text-gray-400">検索キーワードを入力してください</div>
          )}
          {!searching && candidates.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>インソールID/注文ID</TableHead>
                  <TableHead>インソール利用者名</TableHead>
                  <TableHead>アップロード日時</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((c) => (
                  <TableRow key={c.upload_id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(c.upload_id)}
                        onCheckedChange={() => toggleSelected(c.upload_id)}
                      />
                    </TableCell>
                    <TableCell className="text-xs">{c.order_name ?? "—"}</TableCell>
                    <TableCell className="text-xs">
                      {c.insole_user_name ?? "（名前未設定）"}
                      {c.insole_user_kana ? (
                        <span className="text-gray-400 ml-1">({c.insole_user_kana})</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs text-gray-400">{formatDateTime(c.uploaded_at)}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={addingId === c.upload_id || bulkAdding}
                        onClick={() => addOne(c)}
                        className="text-xs h-7"
                      >
                        {addingId === c.upload_id ? <Loader2 size={12} className="animate-spin" /> : "追加"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={addSelected}
            disabled={selected.size === 0 || bulkAdding}
            style={{ backgroundColor: PINK, color: "#fff" }}
          >
            {bulkAdding ? <Loader2 size={14} className="animate-spin mr-1" /> : <Plus size={14} className="mr-1" />}
            選択した{selected.size}件を追加
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// メインページ
// ============================================================
export default function ShipmentBatchDetail() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const batchId = params.id;
  const { user } = useAuth();

  const [batch, setBatch] = useState<ShipmentBatch | null>(null);
  const [editorName, setEditorName] = useState<string | null>(null);
  const [items, setItems] = useState<ShipmentItemDisplay[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [shipDateInput, setShipDateInput] = useState("");
  const [savingShipDate, setSavingShipDate] = useState(false);

  const [tableSearch, setTableSearch] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [generatingCsv, setGeneratingCsv] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!batchId) return;
    setLoading(true);
    setError(null);
    try {
      const [b, itemRows] = await Promise.all([
        fetchShipmentBatchById(batchId),
        fetchActiveShipmentItemsByBatchId(batchId),
      ]);
      if (!b) {
        setError("セッションが見つかりません。");
        return;
      }
      setBatch(b);
      setShipDateInput(b.ship_date ?? "");
      setItems(itemRows);
      const name = await fetchMemberNameById(b.last_editor_member_id);
      setEditorName(name);
    } catch (e) {
      console.error("Failed to fetch shipment batch:", e);
      setError("セッションの取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    fetchCurrentMember(user.id).then((m) => setMemberId(m?.id ?? null));
  }, [user]);

  async function handleShipDateBlur() {
    if (!batch) return;
    if ((batch.ship_date ?? "") === shipDateInput) return;
    setSavingShipDate(true);
    try {
      const updated = await updateShipmentBatchShipDate(batch.id, shipDateInput || null, memberId);
      setBatch(updated);
    } catch (e) {
      console.error("Failed to update ship date:", e);
    } finally {
      setSavingShipDate(false);
    }
  }

  async function handleRemove(item: ShipmentItemDisplay) {
    const label = item.insole_user_name ?? item.order_name ?? "この注文";
    if (!window.confirm(`${label}をこのセッションから削除しますか?(無効化として記録されます)`)) return;
    setRemovingId(item.id);
    try {
      await removeShipmentItem(item.id, memberId, "セッションから削除");
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (e) {
      console.error("Failed to remove shipment item:", e);
    } finally {
      setRemovingId(null);
    }
  }

  async function handleGenerateCsv() {
    if (!batch) return;
    setGeneratingCsv(true);
    setError(null);
    try {
      const uploadIds = items.map((i) => i.upload_id).filter(Boolean) as string[];
      const orderIds = items.map((i) => i.order_id).filter(Boolean) as string[];
      const [uploadShipMap, orderShipMap] = await Promise.all([
        fetchUploadShipByUploadIds(uploadIds),
        fetchOrdersShipInfoByIds(orderIds),
      ]);
      const csv = buildShipmentCsv(items, uploadShipMap, orderShipMap);
      const { url } = await uploadShipmentCsvToStorage(batch.id, csv);
      const updated = await finalizeShipmentBatchCsv(batch.id, url);
      setBatch(updated);
    } catch (e) {
      console.error("Failed to generate CSV:", e);
      setError("CSV生成に失敗しました。");
    } finally {
      setGeneratingCsv(false);
    }
  }

  const filteredItems = useMemo(() => {
    const q = tableSearch.trim();
    if (!q) return items;
    return items.filter((i) =>
      (i.insole_user_name ?? "").includes(q) ||
      (i.insole_user_kana ?? "").includes(q) ||
      (i.order_name ?? "").includes(q)
    );
  }, [items, tableSearch]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f5f5f5" }}>
        <Loader2 className="animate-spin" style={{ color: PINK }} />
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: "#f5f5f5" }}>
        <p className="text-sm text-red-500">{error ?? "データが見つかりません"}</p>
        <button
          onClick={() => setLocation("/shipments")}
          className="flex items-center gap-1.5 text-sm hover:opacity-70"
          style={{ color: PINK }}
        >
          <ArrowLeft size={15} />
          配送管理に戻る
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f5f5f5" }}>
      <div className="max-w-5xl mx-auto px-6 py-7">
        <button
          onClick={() => setLocation("/shipments")}
          className="flex items-center gap-1.5 text-sm mb-4 hover:opacity-70 transition-opacity"
          style={{ color: PINK }}
        >
          <ArrowLeft size={15} strokeWidth={2} />
          配送管理に戻る
        </button>

        <h1 className="text-xl font-bold flex items-center gap-2 mb-4" style={{ color: "#1a1a1a" }}>
          <Truck size={20} strokeWidth={2} style={{ color: PINK }} />
          配送セッション
        </h1>

        <div className="bg-white rounded-xl border border-border p-5 mb-6" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">最終更新</p>
              <p className="text-sm">{formatDateTime(batch.updated_at)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">最終編集者</p>
              <p className="text-sm">{editorName ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">配送予定日</p>
              <input
                type="date"
                value={shipDateInput}
                onChange={(e) => setShipDateInput(e.target.value)}
                onBlur={handleShipDateBlur}
                disabled={savingShipDate}
                className="border rounded-md px-2 py-1 text-sm"
                style={{ borderColor: "#ddd" }}
              />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">リスト内の注文数</p>
              <p className="text-sm font-bold" style={{ color: PINK }}>{items.length}件</p>
            </div>
          </div>

          {batch.address_csv_url ? (
            <a
              href={batch.address_csv_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: PINK }}
            >
              <Download size={14} strokeWidth={2} />
              CSVファイルをダウンロード
            </a>
          ) : (
            <Button
              onClick={handleGenerateCsv}
              disabled={generatingCsv || items.length === 0}
              style={{ backgroundColor: PINK, color: "#fff" }}
              className="gap-1.5"
            >
              {generatingCsv ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} strokeWidth={2} />}
              CSV生成実行
            </Button>
          )}
          {items.length === 0 && !batch.address_csv_url && (
            <p className="text-xs text-gray-400 mt-2">注文が1件も入っていないため、CSVを生成できません。</p>
          )}
        </div>

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold" style={{ color: "#555" }}>リストに入っている注文</h2>
          <Button
            size="sm"
            onClick={() => setAddModalOpen(true)}
            style={{ backgroundColor: PINK, color: "#fff" }}
            className="gap-1.5"
          >
            <Plus size={14} strokeWidth={2} />
            まとめて追加
          </Button>
        </div>

        <div className="relative mb-3 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            placeholder="リスト内を検索"
            className="pl-8 bg-white"
          />
        </div>

        <div className="bg-white rounded-xl border border-border overflow-hidden">
          {filteredItems.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">
              {items.length === 0 ? "まだ注文が追加されていません" : "該当する注文がありません"}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>INSOLE ID / 注文ID</TableHead>
                  <TableHead>INSOLE USER NAME</TableHead>
                  <TableHead>LATEST UPDATE</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-xs">{item.order_name ?? "—"}</TableCell>
                    <TableCell className="text-xs">
                      {item.insole_user_name ?? "（名前未設定）"}
                      {item.insole_user_kana ? (
                        <span className="text-gray-400 ml-1">({item.insole_user_kana})</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs text-gray-400">{formatDateTime(item.upload_updated_at)}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleRemove(item)}
                        disabled={removingId === item.id}
                        className="flex items-center gap-1 text-xs text-red-500 hover:opacity-70 disabled:opacity-50"
                      >
                        {removingId === item.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        削除
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <AddCandidatesModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        memberId={memberId}
        batchId={batch.id}
        onAdded={load}
      />
    </div>
  );
}
