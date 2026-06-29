// Single place to alert the admin with a delivery guarantee: try Telegram, and
// if that fails (bot down, network, revoked token) fall back to e-mail via
// Resend. Dependency-free (reads env) so it works both inside DI services and
// in AlertLogger, which is constructed before the DI container exists.
//
// Swallows all errors silently and never uses the NestJS Logger — otherwise an
// e-mail failure would log an error that routes back through AlertLogger and
// recurse. This is the last line of defence; if both channels fail, give up.
//
// Env: BOT_TOKEN, ADMIN_ID (Telegram) · RESEND_API_KEY, ADMIN_EMAIL, EMAIL_FROM (e-mail)

export async function notifyAdminWithFallback(
  text: string,
  subject = 'Уведомление SchemeHappens',
): Promise<void> {
  if (await sendTelegram(text)) return;
  await sendEmail(subject, text);
}

async function sendTelegram(text: string): Promise<boolean> {
  const token = process.env.BOT_TOKEN;
  const chatId = process.env.ADMIN_ID;
  if (!token || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendEmail(subject: string, text: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ADMIN_EMAIL;
  const from = process.env.EMAIL_FROM ?? 'SchemeHappens <no-reply@schemehappens.ru>';
  if (!apiKey || !to) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to, subject, text: text.replace(/<[^>]+>/g, '') }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    /* both channels down — nothing more we can do */
  }
}
