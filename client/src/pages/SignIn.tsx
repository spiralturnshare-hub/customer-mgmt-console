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
import { useState } from 'react';
import { sendMagicLink, verifyOtpCode } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

// 確認コードの許容桁数。Supabase の Email OTP Length 設定(既定6)に追従できるよう
// 固定長にせず幅を持たせる。generate_link は現状8桁を返すことがある。
const OTP_MIN_LEN = 4;
const OTP_MAX_LEN = 10;

export default function SignIn() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) return;
    setLoading(true);
    try {
      await sendMagicLink(email.trim());
      setStep('code');
      toast.success('確認コードを送信しました');
    } catch (err) {
      // 実際の失敗理由を出す(例: "Signups not allowed for otp" = 未登録メール)
      const msg = err instanceof Error ? err.message : 'エラーが発生しました';
      toast.error(`確認コードを送信できませんでした: ${msg}`);
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
            <Button type="submit" className="w-full" disabled={loading || !email.trim()}>
              {loading ? '送信中...' : '確認コードを送信'}
            </Button>
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
