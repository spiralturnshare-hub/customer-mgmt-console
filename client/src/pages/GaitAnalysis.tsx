/**
 * GaitAnalysis - 動作分析画面（Glideからの移植）
 * 部位（体幹・骨盤/腕/脚/足部）ごとにサインを表示し、左右×強弱(左弱・左強・右弱・右強)を選択して検出結果を保存する。
 *
 * 重要: 動作分析は将来インソール注文から独立した単商品として販売予定のため、
 * order_idに依存しないロジックにしている（uploadIdを起点に扱う）。
 * 詳細: docs/07-gait-analysis-and-workflow-ui.md
 */
import { Fragment, useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Check, History, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  fetchAnalysisSigns,
  fetchFootAnalysisByUploadId,
  fetchUploadById,
  saveDetectedSigns,
  confirmFootAnalysis,
  fetchCurrentMember,
  fetchMemberNameById,
  fetchAnalysisRevisions,
  ensureProductionWorkflow,
  toggleWorkflowStep,
  type AnalysisSign,
  type AnalysisRevision,
} from "@/lib/supabase";

import { useAuth } from "@/contexts/AuthContext";
import {
  EMPTY_SEL,
  parseDetected,
  toEntries,
  groupDetectedLabels,
  type Level,
  type SignSel,
} from "@/lib/gaitSigns";

const PINK = "#D62598";
// 強弱ボタンの配色(2026-09-19 冨永社長指定: 弱=緑 / 強=赤っぽいピンク)。
// 選択中はベタ塗りにせず、やわらかいグラデーション+影で上品に見せる。未選択は淡い色地+細い枠。
const LEVEL_STYLE: Record<Level, { text: string; border: string; bg: string; activeBg: string; shadow: string }> = {
  weak: {
    text: "#059669",
    border: "#A7F3D0",
    bg: "#ECFDF5",
    activeBg: "linear-gradient(135deg, #34D399 0%, #0D9488 100%)",
    shadow: "0 2px 8px rgba(13,148,136,0.35)",
  },
  strong: {
    text: "#E11D48",
    border: "#FECDD3",
    bg: "#FFF1F2",
    activeBg: "linear-gradient(135deg, #FB7185 0%, #DB2777 100%)",
    shadow: "0 2px 8px rgba(219,39,119,0.35)",
  },
};

// analysis_signs.side列はDB上の用途が不明(1行1サインなのに単一値しか持てないCHECK制約)なため、
// 「左右/両側どのボタンを出すか」はここで例外リストとして明示管理する。
// 根拠: 2026-08-25 Glideスクリーンショットの目視確認。要スプレッドシート照合。
const SIGN_KEYS_WITHOUT_SIDE = new Set(["no_arm_swing"]); // 左右概念なし、単一チェックボックス
// 「少ない方をチェック」型 = 片側のみ選択可(左右同時には選べない。強弱は選べる)
const SIGN_KEYS_LR_ONLY = new Set(["single_arm_swing", "sole_area_compare"]);

function SideButtons({
  sign,
  sel,
  onChange,
}: {
  sign: AnalysisSign;
  sel: SignSel;
  onChange: (next: SignSel) => void;
}) {
  // 左右の概念が無いサインは単一チェックボックス(強弱なし)
  if (SIGN_KEYS_WITHOUT_SIDE.has(sign.key)) {
    const checked = sel.check;
    return (
      <button
        type="button"
        onClick={() => onChange({ ...sel, check: !checked })}
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

  const lrOnly = SIGN_KEYS_LR_ONLY.has(sign.key);

  // 同じボタンをもう一度押すと解除。同じ側の弱⇔強は排他。左と右は独立(lrOnly のサインだけ片側のみ)。
  function toggle(side: "left" | "right", level: Level) {
    const nextLevel = sel[side] === level ? null : level;
    const other = side === "left" ? "right" : "left";
    onChange({
      ...sel,
      [side]: nextLevel,
      ...(lrOnly && nextLevel ? { [other]: null } : {}),
    });
  }

  // 弱ボタンは小さく(flex 1)、強ボタンはその1.5倍幅。左グループと右グループの境目に縦線を入れて、
  // どこからが左でどこからが右かを一目で分かるようにする。
  const buttons: { side: "left" | "right"; level: Level; label: string }[] = [
    { side: "left", level: "weak", label: "左弱" },
    { side: "left", level: "strong", label: "左強" },
    { side: "right", level: "weak", label: "右弱" },
    { side: "right", level: "strong", label: "右強" },
  ];

  return (
    <div className="flex items-stretch gap-1.5 w-full">
      {buttons.map((b) => {
        const active = sel[b.side] === b.level;
        const st = LEVEL_STYLE[b.level];
        return (
          <Fragment key={`${b.side}_${b.level}`}>
            {b.side === "right" && b.level === "weak" && (
              <div className="self-stretch w-px mx-1 bg-gray-300" aria-hidden="true" />
            )}
            <button
              type="button"
              onClick={() => toggle(b.side, b.level)}
              className="min-w-0 text-sm py-2 rounded-lg transition-all"
              style={{
                flex: b.level === "strong" ? 1.5 : 1,
                border: `1.5px solid ${active ? "transparent" : st.border}`,
                background: active ? st.activeBg : st.bg,
                color: active ? "#fff" : st.text,
                fontWeight: active ? 700 : 500,
                boxShadow: active ? st.shadow : "none",
              }}
            >
              {b.label}
            </button>
          </Fragment>
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
  const [selections, setSelections] = useState<Record<string, SignSel>>({});
  // 保存済み(=結果サマリー表示用)の detected_signs。編集中の選択とは別に、確定/読込時点の内容を保持する。
  const [savedEntries, setSavedEntries] = useState<string[]>([]);
  const [footAnalysisId, setFootAnalysisId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [productionId, setProductionId] = useState<string | null>(null);
  const [customerUserId, setCustomerUserId] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 確定済みかどうかで「結果サマリー(既定)」と「編集フォーム」を出し分ける。
  // 未完了(初回)は最初から編集フォームを出す。
  const [isCompleted, setIsCompleted] = useState(false);
  const [editing, setEditing] = useState(true);
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(null);
  const [analystName, setAnalystName] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<AnalysisRevision[]>([]);
  const [revisionNames, setRevisionNames] = useState<Record<string, string>>({});

  // 分析結果(完了状態・分析者・履歴)を state へ反映する。初回ロードと確定後の再読込の両方から呼ぶ。
  async function applyAnalysisMeta(analysis: { id: string; is_completed: boolean | null; analyzed_at: string | null; operator_member_id: string | null } | null) {
    setIsCompleted(Boolean(analysis?.is_completed));
    setEditing(!analysis?.is_completed);
    setAnalyzedAt(analysis?.analyzed_at ?? null);
    setAnalystName(analysis?.operator_member_id ? await fetchMemberNameById(analysis.operator_member_id) : null);
    if (analysis?.id) {
      const revs = await fetchAnalysisRevisions(analysis.id);
      setRevisions(revs);
      const staffIds = Array.from(
        new Set(revs.filter((r) => r.changed_by_type === "staff" && r.changed_by_id).map((r) => r.changed_by_id as string))
      );
      const names: Record<string, string> = {};
      await Promise.all(
        staffIds.map(async (mid) => {
          const n = await fetchMemberNameById(mid);
          if (n) names[mid] = n;
        })
      );
      setRevisionNames(names);
    } else {
      setRevisions([]);
      setRevisionNames({});
    }
  }

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

        const workflow = await ensureProductionWorkflow(uploadId, upload?.order_id ?? null);
        if (cancelled) return;
        setProductionId(workflow.id);

        if (analysis?.detected_signs) {
          setFootAnalysisId(analysis.id);
        }
        setSelections(parseDetected(analysis?.detected_signs, SIGN_KEYS_WITHOUT_SIDE));
        setSavedEntries(analysis?.detected_signs ?? []);
        await applyAnalysisMeta(analysis);
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

  // 確定済みの検出内容(結果サマリー表示用)。左右両方ある場合は1行にまとめる(例: 「左強 / 右弱」)。
  const detectedList = useMemo(() => {
    const signByKey = new Map(signs.map((s) => [s.key, s]));
    const out: { title: string; sideLabel: string }[] = [];
    groupDetectedLabels(savedEntries).forEach((labels, key) => {
      const sign = signByKey.get(key);
      if (sign) out.push({ title: sign.title, sideLabel: labels.join(" / ") });
    });
    return out;
  }, [signs, savedEntries]);

  async function persist(next: Record<string, SignSel>, markCompleted: boolean) {
    if (!uploadId || !productionId) return;
    setSaving(true);
    try {
      const detected = toEntries(next, SIGN_KEYS_WITHOUT_SIDE);

      if (markCompleted) {
        // 確定はこの1回の呼び出しだけで detected_signs の更新+完了フラグ+履歴記録(1件)を行う。
        // 個々のチェック(下書き保存)では履歴を作らないため、記録は「確定した」という事実の1件だけになる。
        const completed = await confirmFootAnalysis(uploadId, orderId, customerUserId, productionId, detected, memberId);
        setFootAnalysisId(completed.id);
        setSavedEntries(detected);
        // 作製中一覧の「分析」チェックを、確定と連動して自動でONにする(担当者・日時も記録)。
        // 失敗しても分析結果自体の確定は成立しているため、ここは握りつぶしてログのみ残す。
        try {
          await toggleWorkflowStep(uploadId, orderId, "analy", true, memberId);
        } catch (e2) {
          console.error("toggleWorkflowStep(analy) failed:", e2);
        }
        await applyAnalysisMeta(completed);
        toast.success("動作分析を記録しました");
      } else {
        // 下書き保存: チェックのたびに呼ばれるため、履歴は作らずdetected_signsだけ更新する。
        const result = await saveDetectedSigns(uploadId, orderId, customerUserId, productionId, detected);
        setFootAnalysisId(result.id);
        setSavedEntries(detected);
      }
    } catch (e) {
      console.error("persist(GaitAnalysis) failed:", e);
      setError("保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  function handleSelect(key: string, sel: SignSel) {
    const next = { ...selections, [key]: sel };
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

        {error && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-3 mb-4 text-xs text-red-600">
            {error}
          </div>
        )}

        {!editing ? (
          <>
            <div className="flex items-center gap-2 mb-4">
              <span
                className="text-[10px] font-bold px-2 py-1 rounded-md"
                style={{ color: "#1a9e5c", backgroundColor: "#1a9e5c15" }}
              >
                確定済み
              </span>
              <span className="text-xs text-gray-400">
                {analystName ?? "分析者不明"}
                {analyzedAt && ` ・ ${new Date(analyzedAt).toLocaleString("ja-JP")}`}
              </span>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
              <p className="text-sm font-bold mb-3" style={{ color: "#1a1a1a" }}>検出された悪い兆候</p>
              {detectedList.length === 0 ? (
                <p className="text-xs text-gray-400">該当する兆候は検出されませんでした。</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                  {detectedList.map((d, i) => (
                    <div key={i} className="flex justify-between text-xs border-b pb-1" style={{ borderColor: "#f0f0f0" }}>
                      <span className="text-gray-500">{d.title}</span>
                      <span className="font-semibold" style={{ color: PINK }}>{d.sideLabel}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setEditing(true)}
              className="w-full h-11 rounded-xl font-bold text-white transition-colors mb-6"
              style={{ backgroundColor: PINK }}
            >
              分析結果を修正する
            </button>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: "#1a1a1a" }}>
                <History size={13} className="text-gray-400" />
                分析の記録
              </p>
              {revisions.length === 0 ? (
                <p className="text-xs text-gray-400">変更履歴はまだありません。</p>
              ) : (
                <div className="space-y-1.5">
                  {revisions.map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-[11px] border-b pb-1" style={{ borderColor: "#f5f5f5" }}>
                      <span className="text-gray-500">
                        #{r.revision_number}{" "}
                        {r.changed_by_id && revisionNames[r.changed_by_id] ? revisionNames[r.changed_by_id] : "スタッフ"}
                      </span>
                      <span className="text-gray-400 whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString("ja-JP")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-6">
              歩行動画から検出された悪い兆候を、部位ごとにチェックしてください。
            </p>

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
                        sel={selections[s.key] ?? EMPTY_SEL}
                        onChange={(next) => handleSelect(s.key, next)}
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
                {saving ? "保存中..." : isCompleted ? "確認(修正内容を確定する)" : "確認(分析を確定する)"}
              </button>
            )}
            {isCompleted && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
                className="w-full h-10 rounded-xl font-bold mt-2 disabled:opacity-60"
                style={{ color: PINK, border: `1px solid ${PINK}55`, backgroundColor: "#fff" }}
              >
                結果サマリーに戻る(保存しない)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
