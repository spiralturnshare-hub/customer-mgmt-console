/**
 * 権限管理画面(/members)
 * 2026-08-27新設: これまでGlideのスプレッドシート上で行っていた
 * 「誰がどのデータを見られるか」の管理を、このコンソール上で行えるようにする。
 *
 * アクセス制御: role==='owner'のメンバーのみが開ける。オーナーは常に1名だけ
 * (supabase_migrations/006_permission_management.sqlのユニークインデックスが
 * 最終的な安全網)。オーナー以外がこの画面を開いた場合、他メンバーの情報は
 * 一切取得・表示しない。
 *
 * 【重要】この権限チェックはアプリケーション層(このReactコンポーネントの
 * 表示条件)のみであり、Supabase RLS(Row Level Security)による真のアクセス
 * 制御ではない。Green段階はanon keyで緩やかにアクセス可能という、このプロジェクト
 * の現状の設計方針を踏襲している。
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, Plus, ShieldAlert, Save, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchCurrentMemberFull,
  fetchAllMembers,
  updateMemberPermissions,
  createMember,
  CUSTOMER_SECTION_LABELS,
  type SystemMember,
  type PermLevel,
  type CustomerSectionKey,
} from "@/lib/supabase";

const PINK = "#D62598";

const PERM_DOMAINS: { key: keyof Pick<
  SystemMember,
  'perm_analysis' | 'perm_measurement' | 'perm_production' | 'perm_shipping' | 'perm_customer' | 'perm_organization' | 'perm_member'
>; label: string }[] = [
  { key: "perm_analysis", label: "分析" },
  { key: "perm_measurement", label: "計測" },
  { key: "perm_production", label: "作製" },
  { key: "perm_shipping", label: "配送" },
  { key: "perm_customer", label: "顧客情報" },
  { key: "perm_organization", label: "組織" },
  { key: "perm_member", label: "メンバー管理" },
];

const PERM_LEVEL_LABELS: Record<PermLevel, string> = {
  none: "権限なし",
  view: "閲覧のみ",
  edit: "編集可",
};

const CUSTOMER_SECTION_KEYS = Object.keys(CUSTOMER_SECTION_LABELS) as CustomerSectionKey[];

// ─── 新規メンバー追加モーダル ───────────────────────────────────────────────
function CreateMemberDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (member: SystemMember) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name.trim() || !email.trim()) {
      setError("名前とメールアドレスを入力してください。");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await createMember(name.trim(), email.trim());
      onCreated(created);
      setName("");
      setEmail("");
      onOpenChange(false);
    } catch (e) {
      console.error("Failed to create member:", e);
      setError("メンバーの追加に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新しいメンバーを追加</DialogTitle>
          <DialogDescription>
            認証アカウントとの紐付けは、本人が実際にサインインした際に別途行います。
            招待メールの送信はこの画面では行いません。
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">名前</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
              style={{ borderColor: "#ddd" }}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
              style={{ borderColor: "#ddd" }}
            />
          </div>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting} style={{ backgroundColor: PINK, color: "#fff" }}>
            {submitting ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
            追加
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── メンバー1名分のカード(権限編集) ────────────────────────────────────
function MemberCard({
  member,
  hasOtherOwner,
  onUpdated,
}: {
  member: SystemMember;
  hasOtherOwner: boolean;
  onUpdated: (updated: SystemMember) => void;
}) {
  const [draft, setDraft] = useState<SystemMember>(member);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(member);
  }, [member]);

  function handleRoleChange(nextRole: string) {
    setRoleError(null);
    if (nextRole === "owner" && hasOtherOwner) {
      // フロント側の一意性チェック(DB側のユニークインデックスと合わせた二重の安全策)
      setRoleError("オーナーは既に別のメンバーに設定されています。オーナーは常に1名だけです。");
      return;
    }
    setDraft((d) => ({ ...d, role: nextRole }));
  }

  function handlePermChange(key: (typeof PERM_DOMAINS)[number]["key"], value: PermLevel) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function toggleSection(key: CustomerSectionKey) {
    setDraft((d) => {
      const has = d.visible_customer_sections.includes(key);
      return {
        ...d,
        visible_customer_sections: has
          ? d.visible_customer_sections.filter((k) => k !== key)
          : [...d.visible_customer_sections, key],
      };
    });
  }

  async function handleSave() {
    if (draft.role === "owner" && hasOtherOwner) {
      setRoleError("オーナーは既に別のメンバーに設定されています。オーナーは常に1名だけです。");
      return;
    }
    setSaving(true);
    setSaved(false);
    setRoleError(null);
    try {
      const updated = await updateMemberPermissions(member.id, {
        role: draft.role,
        perm_analysis: draft.perm_analysis,
        perm_measurement: draft.perm_measurement,
        perm_production: draft.perm_production,
        perm_shipping: draft.perm_shipping,
        perm_customer: draft.perm_customer,
        perm_organization: draft.perm_organization,
        perm_member: draft.perm_member,
        visible_customer_sections: draft.visible_customer_sections,
      });
      onUpdated(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error("Failed to update member permissions:", e);
      // DB側のユニークインデックス(system_members_single_owner)に弾かれた場合もここに来る
      setRoleError("保存に失敗しました。オーナーの重複などをご確認ください。");
    } finally {
      setSaving(false);
    }
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(member);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-3" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-bold" style={{ color: "#1a1a1a" }}>{member.name || "(名前未設定)"}</p>
          <p className="text-xs text-gray-400">{member.email ?? "—"}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400">役割</label>
          <select
            value={draft.role ?? "member"}
            onChange={(e) => handleRoleChange(e.target.value)}
            className="border rounded px-2 py-1 text-xs"
            style={{ borderColor: "#ddd" }}
          >
            <option value="owner">オーナー</option>
            <option value="member">メンバー</option>
          </select>
        </div>
      </div>

      {roleError && <p className="text-xs text-red-500 mb-2">{roleError}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        {PERM_DOMAINS.map((d) => (
          <div key={d.key}>
            <label className="text-[11px] text-gray-400 block mb-0.5">{d.label}</label>
            <select
              value={draft[d.key]}
              onChange={(e) => handlePermChange(d.key, e.target.value as PermLevel)}
              className="w-full border rounded px-2 py-1 text-xs"
              style={{ borderColor: "#ddd" }}
            >
              <option value="none">{PERM_LEVEL_LABELS.none}</option>
              <option value="view">{PERM_LEVEL_LABELS.view}</option>
              <option value="edit">{PERM_LEVEL_LABELS.edit}</option>
            </select>
          </div>
        ))}
      </div>

      {draft.perm_customer !== "none" && (
        <div className="mb-3 border-t pt-3" style={{ borderColor: "#eee" }}>
          <p className="text-[11px] font-bold text-gray-500 mb-2">
            顧客詳細画面で見せる情報の枠(選択したものだけが表示されます)
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CUSTOMER_SECTION_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-1.5 text-xs text-gray-600">
                <Checkbox
                  checked={draft.visible_customer_sections.includes(key)}
                  onCheckedChange={() => toggleSection(key)}
                  className="data-[state=checked]:bg-[#D62598] data-[state=checked]:border-[#D62598]"
                />
                {CUSTOMER_SECTION_LABELS[key]}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-md disabled:opacity-40"
          style={{ color: "#fff", backgroundColor: PINK }}
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? <Check size={12} /> : <Save size={12} />}
          {saved ? "保存しました" : "保存"}
        </button>
      </div>
    </div>
  );
}

// ─── メインページ ─────────────────────────────────────────────────────────
export default function PermissionManagement() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();

  const [checking, setChecking] = useState(true);
  const [currentMember, setCurrentMember] = useState<SystemMember | null>(null);
  const [members, setMembers] = useState<SystemMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setChecking(true);
      try {
        const me = await fetchCurrentMemberFull(user.id);
        if (cancelled) return;
        setCurrentMember(me);
        if (me?.role === "owner") {
          setLoadingMembers(true);
          const all = await fetchAllMembers();
          if (!cancelled) setMembers(all);
          if (!cancelled) setLoadingMembers(false);
        }
      } catch (e) {
        console.error("Failed to check permission / fetch members:", e);
        if (!cancelled) setError("メンバー情報の取得に失敗しました。");
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  function handleMemberUpdated(updated: SystemMember) {
    setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  }

  function handleMemberCreated(created: SystemMember) {
    setMembers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "ja")));
  }

  const isOwner = currentMember?.role === "owner";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f5f5f5" }}>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-1.5 text-sm mb-4 hover:opacity-70 transition-opacity"
          style={{ color: PINK }}
        >
          <ArrowLeft size={15} strokeWidth={2} />
          作製中一覧に戻る
        </button>

        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold" style={{ color: "#1a1a1a" }}>権限管理</h1>
          {isOwner && (
            <Button
              size="sm"
              onClick={() => setShowCreate(true)}
              className="h-9 px-3 gap-1.5"
              style={{ backgroundColor: PINK, color: "#fff" }}
            >
              <Plus size={14} />
              新しいメンバーを追加
            </Button>
          )}
        </div>

        {(authLoading || checking) && (
          <div className="flex items-center gap-2 text-sm py-16 justify-center" style={{ color: "#aaa" }}>
            <Loader2 size={14} className="animate-spin" />
            読み込み中...
          </div>
        )}

        {!authLoading && !checking && !isOwner && (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <ShieldAlert size={28} style={{ color: "#ccc" }} />
            <p className="text-sm text-gray-500">
              この画面はオーナーのみアクセスできます。
            </p>
          </div>
        )}

        {!authLoading && !checking && isOwner && (
          <>
            {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
            {loadingMembers ? (
              <div className="flex items-center gap-2 text-sm py-10 justify-center" style={{ color: "#aaa" }}>
                <Loader2 size={14} className="animate-spin" />
                読み込み中...
              </div>
            ) : (
              members.map((m) => (
                <MemberCard
                  key={m.id}
                  member={m}
                  hasOtherOwner={members.some((other) => other.id !== m.id && other.role === "owner")}
                  onUpdated={handleMemberUpdated}
                />
              ))
            )}
          </>
        )}
      </div>

      <CreateMemberDialog open={showCreate} onOpenChange={setShowCreate} onCreated={handleMemberCreated} />
    </div>
  );
}
