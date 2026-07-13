/**
 * CustomerDetail - 管理画面（顧客詳細展開ページ）
 * デザイン: PANTONE Pink C (#D62598) アクセント、白カード、薄グレー背景
 * レイアウト:
 *   - 上部: 日時・顧客名・改修歴・カテゴリタグ
 *   - 注文情報ブロック（横幅全体）
 *   - 3カラム: 左=顧客情報+作製目的+配送先 / 中央=ファイル（動画・画像） / 右=靴情報+痛み+タコ+追加情報+アップロード情報
 */

import { ArrowLeft, Copy } from "lucide-react";
import { useLocation } from "wouter";

const PINK = "#D62598";

// ─── サンプルデータ ──────────────────────────────────────────────────────────
const sampleDetail = {
  createdAt: "2026/05/09 12:26:15",
  customerName: "あやかさん（2026年ゴールドコーストセミナー）",
  revisedHistory: "",
  categories: ["ビューティー", "靴インソール"],

  // 注文情報
  order: {
    orderId: "cnv117681-e66e-44e1-5c6e-0623f0107b91",
    orderedAt: "1970/01/01 02:23:45",
    insolId1: "GUEST-UPLOAD",
    insolId2: "GUEST-UPLOAD",
    insolType1: "ゲストアップロード",
    insolType2: "ゲストアップロード",
    csr: "GUEST",
  },

  // 顧客情報
  customer: {
    uploadId: "55cee9f5-2f58-4a4d-9713-08c3c300029c3",
    insolId: "あやかさん（2026年ゴールドコースト歩きセミナー）",
    guestUpload: "true",
    licenseOrder: "false",
    uploadUserName: "温永 陽生",
    insolUserName: "あやかさん（2026年3月ゴールドコースト歩きセミナー）",
    insolUserNameKana: "アヤカ",
    email: "",
    phone: "",
  },

  // 作製目的
  purpose: {
    id: "649e0e5c-3710-4754-1dc2-019B0U60036",
    purposeOrder: "歩くことが多い",
    goal: "美容",
    playStyle: "",
    golfRight: "",
    golfLeft: "",
  },

  // 配送先情報
  shipping: {
    id: "3H41ac-e90-447f-fa9c-1a96f307e4HT",
    nameKanji: "塩本 智佳",
    nameKana: "",
    postalCode: "752000",
    prefecture: "神奈川県",
    city: "品川",
    address: "南区1961",
    building: "申し訳方",
  },

  // ファイル（動画・画像）
  files: [
    {
      key: "oneleg",
      label: "oneleg",
      type: "video" as const,
      id: "f4249d6b-2242-4b37-b582-b04b5c4b303c",
      fileType: "video",
      updatedAt: "2025/05/09 09:59:34",
      src: "",
    },
    {
      key: "walk",
      label: "walk",
      type: "video" as const,
      id: "2d8b8a2c-022-44fb-f38c-495f8c8a9e49",
      fileType: "video",
      updatedAt: "2025/06/30 09:31:01",
      src: "",
    },
    {
      key: "foot",
      label: "foot",
      type: "image" as const,
      id: "2c12c8c4-b428-4a2b-b2f8-c946135df23a",
      fileType: "image",
      updatedAt: "2025/05/09 11:41:27",
      src: "",
    },
    {
      key: "beauty",
      label: "beauty",
      type: "image" as const,
      id: "a9a4b893-b428-4a2b-b4c6-d2a4b4e40137",
      fileType: "image",
      updatedAt: "2025/05/09 11:30:50",
      src: "",
    },
  ],

  // 靴情報
  shoe: {
    id: "3ab8b0c7-1f1c-3-d3ce-a8b3-0f99a2701d65",
    insolType: "beauty",
    brand: "ナイキ",
    fit: "ぴったり",
    size: "240",
    insolSize: "245",
  },

  // 痛み（左右）
  pain: {
    left: "",
    right: "",
  },

  // タコ（左右）
  callus: {
    left: "",
    right: "",
  },

  // 追加情報
  additionalNote: "",

  // アップロード情報
  uploadInfo: {
    id: "5cee8f5A-25b-6a4-a91b-3e1c5b5c3b5A8",
    createdAt: "2026-05-09 07:07:41.374",
    updatedAt: "2026-05-10 06:11:224",
    orderedAt: "2026-03-16 08:11:843",
    userId: "e1f11900-ef80-4e61-5af0-6c25b2b5f90e",
    sortId: "43df500-33c2-4c46-a8df-187000e97c0c",
  },

  // 取扱店情報
  store: {
    storeId: "STORE-00142",
    storeName: "ゴールドコースト歩きセミナー事務局",
    storeNameKana: "ゴールドコーストアルキセミナーJIMUKYOKU",
    contactPerson: "温永 陽生",
    email: "info@goldcoast-seminar.example.com",
    phone: "03-0000-0000",
    prefecture: "東京都",
    city: "渋谷区",
    address: "神南1-2-3",
    building: "",
    uploadedBy: "温永 陽生",
    uploadedAt: "2026-05-09 07:07:41",
    licenseType: "GUEST",
  },
};

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

function InfoRow({ label, value }: { label: string; value?: string }) {
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
function FileCard({ file }: { file: typeof sampleDetail.files[0] }) {
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
          <span className="text-gray-500">{file.fileType}</span>
        </div>
        <div className="flex gap-2">
          <span className="w-20 text-gray-400">更新日時</span>
          <span className="text-gray-500">{file.updatedAt}</span>
        </div>
      </div>

      {/* メディアプレースホルダー */}
      {file.type === "video" ? (
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
      )}
    </div>
  );
}

// ─── メインページ ─────────────────────────────────────────────────────────
export default function CustomerDetail() {
  const [, setLocation] = useLocation();
  const d = sampleDetail;

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
          <p className="text-xs text-gray-400 mb-0.5">{d.createdAt}</p>
          <h1 className="text-xl font-bold mb-2" style={{ color: "#1a1a1a" }}>
            {d.customerName}
          </h1>
          <div className="flex items-center gap-1 mb-1">
            <span className="text-xs text-gray-400">改修歴</span>
            <span className="text-xs text-gray-500">{d.revisedHistory || "—"}</span>
          </div>
          <div className="flex gap-2 mb-4">
            {d.categories.map((cat) => (
              <span
                key={cat}
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: `${PINK}15`, color: PINK, border: `1px solid ${PINK}40` }}
              >
                {cat}
              </span>
            ))}
          </div>
        </div>

        {/* ── 注文情報ブロック（横幅全体・左右2カラム） ── */}
        <Card className="mb-4">
          <SectionTitle>注文・詳細組織情報</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 左：注文情報 */}
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: "#555" }}>注文情報</p>
              <InfoRow label="注文ID" value={d.order.orderId} />
              <InfoRow label="注文取得日時" value={d.order.orderedAt} />
              <InfoRow label="インソールID 1" value={d.order.insolId1} />
              <InfoRow label="インソールID 2" value={d.order.insolId2} />
              <InfoRow label="インソール種類1" value={d.order.insolType1} />
              <InfoRow label="インソール種類2" value={d.order.insolType2} />
              <InfoRow label="CSR担当" value={d.order.csr} />
            </div>
            {/* 右：取扱店情報 */}
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: "#555" }}>取扱店情報</p>
              <InfoRow label="取扱店ID" value={d.store.storeId} />
              <InfoRow label="取扱店名" value={d.store.storeName} />
              <InfoRow label="取扱店名（カナ）" value={d.store.storeNameKana} />
              <InfoRow label="担当者名" value={d.store.contactPerson} />
              <InfoRow label="メールアドレス" value={d.store.email} />
              <InfoRow label="電話番号" value={d.store.phone} />
              <InfoRow label="都道府県" value={d.store.prefecture} />
              <InfoRow label="市区町村" value={d.store.city} />
              <InfoRow label="住所" value={d.store.address} />
              <InfoRow label="アップロード担当" value={d.store.uploadedBy} />
              <InfoRow label="アップロード日時" value={d.store.uploadedAt} />
              <InfoRow label="ライセンス種別" value={d.store.licenseType} />
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
              <InfoRow label="アップロードID" value={d.customer.uploadId} />
              <InfoRow label="インソールID" value={d.customer.insolId} />
              <InfoRow label="ゲストアップロード" value={d.customer.guestUpload} />
              <InfoRow label="ライセンス注文" value={d.customer.licenseOrder} />
              <InfoRow label="アップロードユーザー名" value={d.customer.uploadUserName} />
              <InfoRow label="インソール利用者名" value={d.customer.insolUserName} />
              <InfoRow label="インソール利用者名（ふりがな）" value={d.customer.insolUserNameKana} />
              <InfoRow label="メールアドレス" value={d.customer.email} />
              <InfoRow label="電話番号" value={d.customer.phone} />
            </Card>

            {/* 作製目的 */}
            <Card>
              <SectionTitle>作製目的</SectionTitle>
              <InfoRow label="ID" value={d.purpose.id} />
              <InfoRow label="目的注文" value={d.purpose.purposeOrder} />
              <InfoRow label="作製目標" value={d.purpose.goal} />
              <InfoRow label="プレイスタイル" value={d.purpose.playStyle} />
              <InfoRow label="ゴルフ_正" value={d.purpose.golfRight} />
              <InfoRow label="ゴルフ_右" value={d.purpose.golfLeft} />
            </Card>

            {/* 配送先情報 */}
            <Card>
              <div className="flex items-center justify-between mb-1">
                <SectionTitle>配送先情報</SectionTitle>
                <button className="text-gray-300 hover:text-gray-500 transition-colors mb-3">
                  <Copy size={13} />
                </button>
              </div>
              <InfoRow label="id" value={d.shipping.id} />
              <InfoRow label="氏名漢字名" value={d.shipping.nameKanji} />
              <InfoRow label="氏名カタカナ名" value={d.shipping.nameKana} />
              <InfoRow label="郵便番号" value={d.shipping.postalCode} />
              <InfoRow label="都道府県" value={d.shipping.prefecture} />
              <InfoRow label="市区町村" value={d.shipping.city} />
              <InfoRow label="住所" value={d.shipping.address} />
              <InfoRow label="マンション・アパート名" value={d.shipping.building} />
            </Card>
          </div>

          {/* ════ 中央カラム：ファイル ════ */}
          <div>
            <Card>
              <SectionTitle>ファイル</SectionTitle>
              {d.files.map((file) => (
                <FileCard key={file.key} file={file} />
              ))}
            </Card>
          </div>

          {/* ════ 右カラム ════ */}
          <div>
            {/* 靴情報 */}
            <Card>
              <SectionTitle>靴情報</SectionTitle>
              <p className="text-xs font-semibold text-gray-500 mb-2">beauty</p>
              <InfoRow label="ID" value={d.shoe.id} />
              <InfoRow label="インソール型" value={d.shoe.insolType} />
              <InfoRow label="ブランド" value={d.shoe.brand} />
              <InfoRow label="フィット感" value={d.shoe.fit} />
              <InfoRow label="サイズ" value={d.shoe.size} />
              <InfoRow label="中底サイズ" value={d.shoe.insolSize} />
            </Card>

            {/* 痛み */}
            <Card>
              <SectionTitle>痛み</SectionTitle>
              <InfoRow label="左足" value={d.pain.left} />
              <InfoRow label="右足" value={d.pain.right} />
            </Card>

            {/* タコ */}
            <Card>
              <SectionTitle>タコ</SectionTitle>
              <InfoRow label="左足" value={d.callus.left} />
              <InfoRow label="右足" value={d.callus.right} />
            </Card>

            {/* 追加情報 */}
            <Card>
              <SectionTitle>追加情報</SectionTitle>
              <div className="text-xs text-gray-400 mb-1">作製担当者文章</div>
              <div
                className="min-h-16 rounded-md p-2 text-xs text-gray-600"
                style={{ backgroundColor: "#fafafa", border: "1px solid #efefef" }}
              >
                {d.additionalNote || ""}
              </div>
            </Card>

            {/* アップロード情報 */}
            <Card>
              <SectionTitle>アップロード情報</SectionTitle>
              <InfoRow label="id" value={d.uploadInfo.id} />
              <InfoRow label="created_at" value={d.uploadInfo.createdAt} />
              <InfoRow label="updated_at" value={d.uploadInfo.updatedAt} />
              <InfoRow label="ordered_at" value={d.uploadInfo.orderedAt} />
              <InfoRow label="user_id" value={d.uploadInfo.userId} />
              <InfoRow label="sort_id" value={d.uploadInfo.sortId} />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
