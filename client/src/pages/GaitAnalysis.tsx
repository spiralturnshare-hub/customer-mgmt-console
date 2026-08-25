/**
 * GaitAnalysis - 動作分析画面（Glideからの移植）
 * 部位（体幹・骨盤/腕/脚/足部）ごとにサインを表示し、左右/両側を選択して検出結果を保存する。
 *
 * 重要: 動作分析は将来インソール注文から独立した単商品として販売予定のため、
 * order_idに依存しないロジックにしている（uploadIdを起点に扱う）。
 * 詳細: docs/07-gait-analysis-and-workflow-ui.md
 */
import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Check, RefreshCw } from "lucide-react";
import {
  fetchAnalysisSigns,
  fetchFootAnalysisByUploadId,
  fetchUploadById,
  saveDetectedSigns,
  completeFootAnalysis,
  fetchCurrentMember,
  type AnalysisSign,
} from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const PINK = "#D62598";
type Side = "left" | "right" | "both";

// detected_signs には "key:side" 形式（例: "shoulder_swing:left"）で保存する
function signValue(key: string, side: Side): string {
  return `${key}:${side}`;
}

// analysis_signs.side列はDB上の用途が不明(1行1サインなのに単一値しか持てないCHECK制約)なため、
// 「左右/両側どのボタンを出すか」はここで例外リストとして明示管理する。
// 根拠: 2026-08-25 Glideスクリーンショットの目視確認。要スプレッドシート照合。
const SIGN_KEYS_WITHOUT_SIDE = new Set(["no_arm_swing"]); // 左右概念なし、単一チェックボックス
const SIGN_KEYS_LR_ONLY = new Set(["single_arm_swing", "sole_area_compare"]); // 「両側」ボタン無し

function SideButtons({
  sign,
  selected,
  onSelect,
}: {
  sign: AnalysisSign;
  selected: Side | null;
  onSelect: (side: Side | null) => void;
}) {
  const hasSide = !SIGN_KEYS_WITHOUT_SIDE.has(sign.key);
  const allowsBoth = hasSide && !SIGN_KEYS_LR_ONLY.has(sign.key);

  if (!hasSide) {
    const checked = selected === "both";
    return (
      <button
        type="button"
        onClick={() => onSelect(checked ? null : "both")}
        className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border"
        style={{
          borderColor: checked ? PINK : "#ddd",
          backgroundColor: checked ? `${PINK}15` : "#fff",
          color: checked ? PINK : "#555",
        }}
      >
        <span
          className="w-4 h-4 rounded flex items-center justify-center"
          style={{ backgroundColor: checked ? PINK : "#f0f0f0", border: checked ? "none" : "1px solid #ccc" }}
        >
          {checked && <Check size={11} color="#fff" strokeWidth={3} />}
        </span>
        {sign.title}
      </button>
    );
  }

  const options: { side: Side; label: string }[] = [
    { side: "left", label: "左" },
    { side: "right", label: "右" },
    ...(allowsBoth ? [{ side: "both" as Side, label: "両側" }] : []),
  ];

  return (
    <div className="flex gap-2">
      {options.map((opt) => {
        const active = selected === opt.side;
        return (
          <button
            key={opt.side}
            type="button"
            onClick={() => onSelect(active ? null : opt.side)}
            className="text-sm px-3 py-1.5 rounded-lg border font-medium transition-colors"
            style={{
              borderColor: active ? PINK : "#ddd",
              backgroundColor: active ? PINK : "#fff",
              color: active ? "#fff" : "#555",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function GaitAnalysis() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const uploadId = params.id;
  const { user } = useAuth();

  const [signs, setSigns] = useState<AnalysisSign[]>([]);
  const [selections, setSelections] = useState<Record<string, Side | null>>({});
  const [footAnalysisId, setFootAnalysisId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [customerUserId, setCustomerUserId] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uploadId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [signList, analysis, upload] = await Promise.all([
          fetchAnalysisSigns(),
          fetchFootAnalysisByUploadId(uploadId),
          fetchUploadById(uploadId),
        ]);
        if (cancelled) return;
        setSigns(signList);
        setOrderId(upload?.order_id ?? null);
        setCustomerUserId(upload?.user_id ?? null);

        const initial: Record<string, Side | null> = {};
        if (analysis?.detected_signs) {
          for (const entry of analysis.detected_signs) {
            const [key, side] = entry.split(":");
            if (key && side) initial[key] = side as Side;
          }
          setFootAnalysisId(analysis.id);
        }
        setSelections(initial);
      } catch (e) {
        if (!cancelled) setError("データの取得に失敗しました。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [uploadId]);

  useEffect(() => {
    if (!user) return;
    fetchCurrentMember(user.id).then((m) => setMemberId(m?.id ?? null));
  }, [user]);

  const grouped = useMemo(() => {
    const map = new Map<string, AnalysisSign[]>();
    for (const s of signs) {
      const region = s.region || "その他";
      if (!map.has(region)) map.set(region, []);
      map.get(region)!.push(s);
    }
    return Array.from(map.entries());
  }, [signs]);

  async function persist(next: Record<string, Side | null>, markCompleted: boolean) {
    if (!uploadId) return;
    setSaving(true);
    try {
      const detected = Object.entries(next)
        .filter(([, side]) => side)
        .map(([key, side]) => signValue(key, side as Side));
      const result = await saveDetectedSigns(uploadId, orderId, customerUserId, detected);
      setFootAnalysisId(result.id);
      if (markCompleted) {
        await completeFootAnalysis(result.id, memberId);
      }
    } catch (e) {
      setError("保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  function handleSelect(key: string, side: Side | null) {
    const next = { ...selections, [key]: side };
    setSelections(next);
    persist(next, false);
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

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: "#f5f5f5" }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button
          onClick={() => setLocation(`/customer/${uploadId}`)}
          className="flex items-center gap-1.5 text-sm mb-4 hover:opacity-70 transition-opacity"
          style={{ color: PINK }}
        >
          <ArrowLeft size={15} strokeWidth={2} />
          顧客詳細に戻る
        </button>

        <h1 className="text-xl font-bold mb-1" style={{ color: "#1a1a1a" }}>動作分析</h1>
        <p className="text-xs text-gray-400 mb-6">
          歩行動画から検出された悪い兆候を、部位ごとにチェックしてください。
        </p>

        {error && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-3 mb-4 text-xs text-red-600">
            {error}
          </div>
        )}

        {signs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
            サインのマスタデータが未投入です。<br />
            <code className="text-xs">supabase_migrations/001_analysis_signs_seed.sql</code> を実行してください。
          </div>
        ) : (
          grouped.map(([region, regionSigns]) => (
            <div key={region} className="mb-8">
              <div className="text-center mb-4">
                <div
                  className="w-16 h-16 rounded-full mx-auto mb-2"
                  style={{ backgroundColor: "#e0e0e0", border: `2px solid ${PINK}55` }}
                />
                <p className="text-sm font-bold text-gray-600">— {region} —</p>
              </div>
              {regionSigns.map((s) => (
                <div key={s.key} className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
                  {s.header && (
                    <p className="text-xs font-bold mb-0.5" style={{ color: PINK }}>{s.header}</p>
                  )}
                  <p className="text-sm font-bold mb-0.5" style={{ color: "#1a1a1a" }}>{s.title}</p>
                  {s.p_measure && <p className="text-xs text-gray-400 mb-3">{s.p_measure}</p>}
                  <SideButtons
                    sign={s}
                    selected={selections[s.key] ?? null}
                    onSelect={(side) => handleSelect(s.key, side)}
                  />
                </div>
              ))}
            </div>
          ))
        )}

        {signs.length > 0 && (
          <button
            type="button"
            disabled={saving}
            onClick={() => persist(selections, true)}
            className="w-full h-12 rounded-xl font-bold text-white transition-colors disabled:opacity-60"
            style={{ backgroundColor: PINK }}
          >
            {saving ? "保存中..." : "確認（分析を確定する）"}
          </button>
        )}
      </div>
    </div>
  );
}
