import { getHost } from '../../../shared/src/host';
import { fetchWithTimeout } from '../../../shared/src/api/fetchWithTimeout';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export type TelegramAuthOutcome = { ok: true; token: string; expiresIn: number } | { ok: false };

/** Сайт открыт во встроенном браузере мессенджера — меняет подпись хоста на
 *  сессию тем эндпоинтом, который назвал сам хост; таймаут — чтобы зависшая
 *  сеть не держала спиннер входа вечно (E9). Вынесено из AuthProvider.tsx. */
export async function telegramWebAppAuth(): Promise<TelegramAuthOutcome> {
  try {
    const exchange = getHost().sessionExchange();
    if (!exchange) return { ok: false };
    const res = await fetchWithTimeout(`${API_BASE}${exchange.path}`, {
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
