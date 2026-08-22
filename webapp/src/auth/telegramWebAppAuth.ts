import { getHost } from '../../../shared/src/host';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export type TelegramAuthOutcome =
  | { ok: true; token: string; expiresIn: number }
  | { ok: false };

/** Сайт открыт во встроенном браузере мессенджера — меняет подпись хоста на
 *  сессию тем эндпоинтом, который назвал сам хост. Вынесено из
 *  AuthProvider.tsx (файл-храповик, правило №10 CLAUDE.md). */
export async function telegramWebAppAuth(): Promise<TelegramAuthOutcome> {
  try {
    const exchange = getHost().sessionExchange();
    if (!exchange) return { ok: false };
    const res = await fetch(`${API_BASE}${exchange.path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(exchange.body),
    });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { accessToken: string; expiresIn: number };
    return { ok: true, token: data.accessToken, expiresIn: data.expiresIn };
  } catch {
    return { ok: false };
  }
}
