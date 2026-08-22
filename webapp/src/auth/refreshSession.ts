// Сетевая половина обновления сессии сайта — вынесена из AuthProvider.tsx
// (файл-храповик, правило №10 CLAUDE.md: AuthProvider.tsx не имеет права
// расти сверх бейслайна). In-flight + кросс-табный замок и ретраи с бэкоффом
// при временной беде (сеть/5xx) — тот же урок, что у мини-аппа
// (schema-miniapp/src/session.ts): диагностика «постоянно нужно логиниться
// заново» (2026-08-21) нашла у сайта ДВА пробела разом — не было ни
// in-flight замка (параллельный refresh = кража токена для сервера), ни
// различения «сессия мертва» (401/403) от «сеть барахлит» (5xx/сеть/429).
import {
  classifyRefreshFailure,
  renewWithRetries,
} from '../../../shared/src/auth/sessionRefresh';
import { withCrossTabLock } from '../../../shared/src/auth/crossTabLock';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export type RefreshOutcome =
  | { ok: true; token: string; expiresIn: number }
  | { ok: false; dead: boolean };

async function attemptOnce(): Promise<RefreshOutcome> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // httpOnly refresh-кука
      headers: {
        'x-requested-with': 'webapp',
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      return { ok: false, dead: classifyRefreshFailure(res.status) === 'dead' };
    }
    const data = (await res.json()) as { accessToken: string; expiresIn: number };
    return { ok: true, token: data.accessToken, expiresIn: data.expiresIn };
  } catch {
    // Сетевая ошибка/таймаут — ответа не было вовсе, статус неизвестен.
    // classifyRefreshFailure(null) === 'transient', поэтому dead:false.
    return { ok: false, dead: false };
  }
}

// Модульный (не per-компонентный) промис: единственная защита от параллельной
// ротации refresh-токена, даже если AuthProvider почему-то смонтирован дважды.
let inFlight: Promise<RefreshOutcome> | null = null;

/**
 * Перевыпуск сессии: in-tab замок (общий промис) + withCrossTabLock
 * (Web Locks API) закрывает гонку между вкладками/установленным приложением
 * одного origin, renewWithRetries переживает временную беду вместо
 * немедленного отказа по живой refresh-куке.
 */
export function refreshSession(): Promise<RefreshOutcome> {
  if (inFlight) return inFlight;
  inFlight = withCrossTabLock('auth-refresh', () =>
    renewWithRetries(attemptOnce),
  ).finally(() => {
    inFlight = null;
  });
  return inFlight;
}
