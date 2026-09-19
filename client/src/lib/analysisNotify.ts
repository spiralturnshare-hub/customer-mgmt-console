/**
 * 動作分析の確定を Make に知らせ、顧客Email・取扱店Emailへ通知を送らせる。
 *
 * 経緯・設計(2026-09-19 冨永社長指示。docs/39-analysis-notification-make-scenario.md):
 *   外部連携(メール送信)は「UIから直接叩かず Make に一元化」する方針(docs/14 §1)。
 *   このUIは Make の Webhook に foot_analysis_id だけを渡す。宛先・本文の組み立ては
 *   Make が限定RPC(get_analysis_notification_payload)経由で行うため、UI側は個人情報を扱わない。
 *
 * Webhook の URL は環境変数 VITE_ANALYSIS_NOTIFY_WEBHOOK(Vercel)で与える。未設定なら何もしない
 * ("skipped")ので、Make シナリオが未構築の間も動作分析の確定自体は今までどおり動く。
 */
export async function notifyAnalysisConfirmed(footAnalysisId: string): Promise<"sent" | "skipped"> {
  const url = import.meta.env.VITE_ANALYSIS_NOTIFY_WEBHOOK as string | undefined;
  if (!url) return "skipped";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ foot_analysis_id: footAnalysisId }),
  });
  if (!res.ok) throw new Error(`analysis notify webhook failed: HTTP ${res.status}`);
  return "sent";
}
