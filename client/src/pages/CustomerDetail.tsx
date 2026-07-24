/**
 * CustomerDetail - 管理画面（顧客詳細展開ページ）
 * データソース: Supabase Green の uploads テーブル（ID指定で取得）
 * レイアウト:
 *   - 上部: 日時・顧客名・インソール種別タグ
 *   - 注文情報ブロック（横幅全体）
 *   - 3カラム: 左=顧客情報+作製目的+配送先 / 中央=ファイル（動画・画像） / 右=靴情報+痛み+タコ+アップロード情報
 */

import { ArrowLeft, Copy, RefreshCw } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { useEffect, useState } from "react";
import { fetchUploadById, fetchUploadFiles, type UploadRecord, type UploadFileRecord } from "@/lib/supabase";

const PINK = "#D62598";

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

function FileCard({ file }: { file: FileItem }) {
  return (
    <div className="mb-6">
      <p className="text-sm font-bold mb-2" style={{ color: "#1a1a1a" }}>
        {file.label}
      </p>
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

// ─── メインページ ─────────────────────────────────────────────────────────
export default function CustomerDetail() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [upload, setUpload] = useState<UploadRecord | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [rec, fileRecs] = await Promise.all([
          fetchUploadById(id),
          fetchUploadFiles(id),
        ]);
        if (!cancelled) {
          setUpload(rec);
          setFiles(fileRecs.map(mapFileRecord));
        }
      } catch (e) {
        if (!cancelled) setError('データの取得に失敗しました。');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

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
            {/* 顧客情報 */}
            <Card>
              <SectionTitle>顧客情報</SectionTitle>
              <InfoRow label="インソール利用者名" value={upload.insole_user_name} />
              <InfoRow label="ふりがな" value={upload.insole_user_kana} />
              <InfoRow label="電話番号" value={getStr(customerInfo, 'phone')} />
            </Card>

            {/* 作製目的 */}
            <Card>
              <SectionTitle>作製目的</SectionTitle>
              {purposeInfo ? (
                <>
                  <InfoRow
                    label="目的"
                    value={
                      Array.isArray(purposeInfo.purposes)
                        ? (purposeInfo.purposes as string[]).join(', ')
                        : getStr(purposeInfo, 'purposes')
                    }
                  />
                  <InfoRow label="ライフスタイル" value={getStr(purposeInfo, 'lifestyle')} />
                  <InfoRow label="プレイスタイル" value={getStr(purposeInfo, 'playstyle')} />
                  <InfoRow label="その他" value={getStr(purposeInfo, 'otherPurpose')} />
                </>
              ) : (
                <p className="text-xs text-gray-400">データなし</p>
              )}
            </Card>

            {/* 配送先情報 */}
            <Card>
              <div className="flex items-center justify-between mb-1">
                <SectionTitle>配送先情報</SectionTitle>
                <button
                  className="text-gray-300 hover:text-gray-500 transition-colors mb-3"
                  onClick={() => {
                    if (!customerInfo) return;
                    const addr = [
                      getStr(customerInfo, 'postalCode'),
                      getStr(customerInfo, 'prefecture'),
                      getStr(customerInfo, 'city'),
                      getStr(customerInfo, 'address'),
                      getStr(customerInfo, 'building'),
                    ].filter(Boolean).join(' ');
                    navigator.clipboard.writeText(addr).catch(() => {});
                  }}
                >
                  <Copy size={13} />
                </button>
              </div>
              {customerInfo ? (
                <>
                  <InfoRow label="氏名" value={getStr(customerInfo, 'userName')} />
                  <InfoRow label="ふりがな" value={getStr(customerInfo, 'userKana')} />
                  <InfoRow label="配送先名" value={getStr(customerInfo, 'shipName')} />
                  <InfoRow label="郵便番号" value={getStr(customerInfo, 'postalCode')} />
                  <InfoRow label="都道府県" value={getStr(customerInfo, 'prefecture')} />
                  <InfoRow label="市区町村" value={getStr(customerInfo, 'city')} />
                  <InfoRow label="住所" value={getStr(customerInfo, 'address')} />
                  <InfoRow label="建物名" value={getStr(customerInfo, 'building')} />
                  <InfoRow label="電話番号" value={getStr(customerInfo, 'phone')} />
                </>
              ) : (
                <p className="text-xs text-gray-400">データなし</p>
              )}
            </Card>
          </div>

          {/* ════ 中央カラム：ファイル ════ */}
          <div>
            <Card>
              <SectionTitle>ファイル</SectionTitle>
              {files.length === 0 ? (
                <p className="text-xs text-gray-400">ファイルなし（Storage連携待ち）</p>
              ) : (
                files.map((file) => (
                  <FileCard key={file.id} file={file} />
                ))
              )}
            </Card>
          </div>

          {/* ════ 右カラム ════ */}
          <div>
            {/* 靴情報 */}
            <Card>
              <SectionTitle>靴情報</SectionTitle>
              {shoeInfos ? (
                Object.entries(shoeInfos).map(([insoleKey, info]) => {
                  const si = info as Record<string, unknown>;
                  return (
                    <div key={insoleKey} className="mb-3">
                      <p className="text-xs font-semibold text-gray-500 mb-1">{insoleKey}</p>
                      <InfoRow label="ブランド" value={getStr(si, 'brand') || getStr(si, 'otherBrand')} />
                      <InfoRow label="サイズ" value={getStr(si, 'size')} />
                      <InfoRow label="インソールサイズ" value={getStr(si, 'insoleSize')} />
                      <InfoRow label="フィット感" value={getStr(si, 'fit')} />
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-gray-400">データなし</p>
              )}
            </Card>

            {/* 痛み */}
            <Card>
              <SectionTitle>痛み</SectionTitle>
              {painInfo ? (
                <>
                  <InfoRow label="痛みあり" value={String(painInfo.hasPain ?? '—')} />
                  {Array.isArray(painInfo.entries) && (painInfo.entries as Record<string, unknown>[]).map((entry, i) => (
                    <div key={i} className="mb-2 pl-2 border-l-2" style={{ borderColor: `${PINK}40` }}>
                      <InfoRow
                        label="部位"
                        value={
                          Array.isArray(entry.locations)
                            ? (entry.locations as string[]).join(', ')
                            : ''
                        }
                      />
                      <InfoRow label="左右" value={getStr(entry, 'side')} />
                      <InfoRow label="痛みの強さ" value={entry.faceScale != null ? String(entry.faceScale) : ''} />
                    </div>
                  ))}
                </>
              ) : (
                <p className="text-xs text-gray-400">データなし</p>
              )}
            </Card>

            {/* タコ */}
            <Card>
              <SectionTitle>タコ・魚の目</SectionTitle>
              {takoInfo ? (
                <>
                  <InfoRow
                    label="左足"
                    value={
                      Array.isArray(takoInfo.leftPositions)
                        ? (takoInfo.leftPositions as number[]).join(', ')
                        : ''
                    }
                  />
                  <InfoRow
                    label="右足"
                    value={
                      Array.isArray(takoInfo.rightPositions)
                        ? (takoInfo.rightPositions as number[]).join(', ')
                        : ''
                    }
                  />
                  <InfoRow label="その他" value={getStr(takoInfo, 'otherNote')} />
                </>
              ) : (
                <p className="text-xs text-gray-400">データなし</p>
              )}
            </Card>

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
      </div>
    </div>
  );
}
