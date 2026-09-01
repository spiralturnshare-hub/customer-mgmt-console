/**
 * SignIn - 確認コード直接入力方式の認証ページ
 * customer-mgmt-console 用
 *
 * 【方式 / 過去の失敗と対策 (2026-08-28)】
 *   以前はメールで届く「マジックリンク」をタップさせる方式だったが、モバイルで
 *   機能しないことが判明(アプリ内ブラウザにセッションが隔離される / Gmail の
 *   URL 先読みでトークンが消費される)。詳細は lib/supabase.ts の注釈参照。
 *   → 現在は「メール送信 → 画面で確認コードを入力 → verifyOtp」の2ステップ。
 *   接続先: Supabase Auth(Green fhamrkmsxidxayaoexso)。verifyOtp は RLS を通らない。
 */
import { useEffect, useState } from 'react';
import { sendMagicLink, verifyOtpCode } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

// 確認コードの許容桁数。Supabase の Email OTP Length 設定(既定6)に追従できるよう
// 固定長にせず幅を持たせる。generate_link は現状8桁を返すことがある。
const OTP_MIN_LEN = 4;
const OTP_MAX_LEN = 10;

// 送信ボタンの機械的ロック秒数(誤操作の二重クリック防止)。
// Supabase Auth の同一メール宛の再送ブロックは実測で約30秒あり、それは
// 案内文で「30秒ほどお待ちください」と伝える。ここは短め(12秒)にして
// ボタンが固まって見える時間を抑える。ブロック中に押した場合は
// エラー文言の "after N seconds" を読んでロックをその秒数まで延長する
// (下の handleSendCode を参照)。
const RESEND_COOLDOWN_SEC = 12;

// Supabase の「送信頻度オーバー」エラーか判定する。
// HTTP 429、または "... after N seconds" という文言を持つエラーを対象にする。
function isSendRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: number; message?: string };
  if (e.status === 429) return true;
  return typeof e.message === 'string' && /after \d+ seconds?/i.test(e.message);
}

export default function SignIn() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  // > 0 の間は再送不可(残り秒数)。1秒ごとに減算し 0 で解除。
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) return;
    if (cooldown > 0) {
      // まだ Supabase の再送ブロック中。押しても失敗するので送らずに案内。
      toast('確認コードを送信しました。もう一度送信する場合は30秒ほどお待ちください。');
      return;
    }
    setLoading(true);
    try {
      await sendMagicLink(email.trim());
      setStep('code');
      setCooldown(RESEND_COOLDOWN_SEC);
      toast.success('確認コードを送信しました');
    } catch (err) {
      if (isSendRateLimitError(err)) {
        // 直前に送信済み(別タブ・別アプリ含む)。英語エラーは出さず日本語で待機を促す。
        // "after N seconds" があれば、その秒数(+余裕)までロックを延長する。
        const retryMsg = err instanceof Error ? err.message : '';
        const m = /after (\d+) seconds?/i.exec(retryMsg);
        setCooldown(m ? Math.max(RESEND_COOLDOWN_SEC, parseInt(m[1], 10) + 3) : RESEND_COOLDOWN_SEC);
        toast('確認コードを送信しました。もう一度送信する場合は30秒ほどお待ちください。');
      } else {
        // それ以外は実際の失敗理由を出す(例: "Signups not allowed for otp" = 未登録メール)
        const msg = err instanceof Error ? err.message : 'エラーが発生しました';
        toast.error(`確認コードを送信できませんでした: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < OTP_MIN_LEN || code.length > OTP_MAX_LEN) {
      toast.error('メールに記載された確認コードを入力してください');
      return;
    }
    setLoading(true);
    try {
      await verifyOtpCode(email.trim(), code);
      // 成功時は onAuthStateChange 経由で App 側がコンソール本体へ切り替える
    } catch (err) {
      // expired = 期限切れ / invalid = コード誤り など
      const msg = err instanceof Error ? err.message : 'エラーが発生しました';
      toast.error(`確認できませんでした: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">SPIRAL TURN</h1>
          <p className="text-sm text-muted-foreground">カスタマー管理コンソール</p>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleSendCode} className="rounded-lg border border-border bg-card p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="email">
                メールアドレス
              </label>
              <Input
                id="email"
                type="email"
                placeholder="example@spiralturn.co.jp"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                登録済みのメールアドレスに確認コードを送信します。
              </p>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !email.trim() || cooldown > 0}
            >
              {loading ? '送信中...' : cooldown > 0 ? '送信しました' : '確認コードを送信'}
            </Button>
            {cooldown > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                確認コードを送信しました。もう一度送信する場合は30秒ほどお待ちください。
              </p>
            )}
          </form>
        ) : (
          <form onSubmit={handleVerify} className="rounded-lg border border-border bg-card p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="otp">
                確認コード（メール記載）
              </label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={OTP_MAX_LEN}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                required
                disabled={loading}
                autoFocus
                className="text-lg text-center font-mono tracking-widest"
              />
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{email}</span> に届いたメールのコードを入力してください。
                メール内のリンクは使わないでください（スマホでは正しくログインできません）。
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '確認中...' : '確認してサインイン'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => { setStep('email'); setCode(''); }}
            >
              メールアドレスを変更する
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
