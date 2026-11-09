import { useState } from 'react';
import { api, reportClientError } from '../../api';
import { ApiError } from '../../apiClient';
import { describeFailure } from '../../../../shared/src/api/describeFailure';

// Отмена подписки по ссылке из письма. Раньше `catch { /* ignore */ }`
// проглатывал любой отказ (500, 429, maintenance-HTML с кодом 200 в окно
// деплоя, обрыв сети): экран оставался как до нажатия, человек считал, что
// отменил, а следующее списание уходило (аудит 2026-10-11, frontends#0).
//
//   idle    — кнопка активна
//   loading — запрос в полёте, кнопка заблокирована (двойной клик = два POST)
//   error   — отказ: текст «не получилось» + отчёт наверх
//   stale   — 404: токена нет, ссылка устарела (повторять бессмысленно, отчёт
//             не шлём — это ожидаемый исход, а не поломка)
export type CancelPhase = 'idle' | 'loading' | 'error' | 'stale';

export const SUBSCRIPTION_SECTION = 'subscription';

/** Отказ загрузки подписки по ссылке: экран-тупик шлёт отчёт наверх (правило
 * №14, check-dead-end-report). 404 — ссылка устарела, ожидаемый исход, как у
 * отмены: без отчёта. Токена в отчёте нет. */
export function reportSubscriptionLoadFailure(err: unknown): void {
  if (err instanceof ApiError && err.status === 404) return;
  reportClientError({ message: `subscription load failed: ${describeFailure(err)}`, section: SUBSCRIPTION_SECTION });
}

export function useSubscriptionCancel(token: string | null, onCancelled: () => void) {
  const [phase, setPhase] = useState<CancelPhase>('idle');

  const cancel = async () => {
    if (!token || phase === 'loading') return;
    setPhase('loading');
    try {
      await api.cancelSubscription(token);
      onCancelled();
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setPhase('stale');
        return;
      }
      // Без токена и без PII: код ответа или тип сбоя, текст ошибки не уходит.
      reportClientError({ message: `subscription cancel failed: ${describeFailure(err)}`, section: SUBSCRIPTION_SECTION });
      setPhase('error');
    }
  };

  return { phase, cancel };
}
