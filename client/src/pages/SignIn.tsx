/**
 * SignIn - Magic Link認証ページ
 * customer-mgmt-console用
 */
import { useState } from 'react';
import { sendMagicLink } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await sendMagicLink(email.trim());
      setSent(true);
      toast.success('ログインリンクを送信しました');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'エラーが発生しました';
      toast.error(msg);
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
        {sent ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center space-y-3">
            <p className="text-sm font-medium text-foreground">
              {email} にログインリンクを送信しました
            </p>
            <p className="text-xs text-muted-foreground">
              メールのリンクをクリックしてログインしてください
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSent(false); setEmail(''); }}
            >
              別のメールアドレスで試す
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-6 space-y-4">
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
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !email.trim()}>
              {loading ? '送信中...' : 'ログインリンクを送信'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
