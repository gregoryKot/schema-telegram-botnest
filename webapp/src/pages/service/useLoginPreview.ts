// Экран сверки входа (S9, аудит 2026-11): какое устройство и когда просило
// вход. Спрашиваем по коду, который человек НАБРАЛ сам и который совпал с
// кодом билета: до этого сервер о билете не спрашиваем и на экран о нём
// ничего не выводим — код из ссылки мог прислать кто угодно.
// Ручка только читает: POST /api/auth/ticket/login-preview → {deviceLabel,
// createdAt} или 404 (мёртвый, чужой по назначению или неизвестный код).
import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../../utils/apiBase';

export type LoginPreview =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; deviceLabel: string | null; createdAt: string }
  | { kind: 'notfound' }
  /** Сеть или сервер — подтверждать можно, просто без подписи устройства. */
  | { kind: 'failed' };

export function useLoginPreview(
  /** Набранный и совпавший код; `null` — ещё не совпал. */
  code: string | null,
  sessionToken: () => Promise<string | null>,
): LoginPreview {
  // Ответ привязан к коду: пока ответа на ЭТОТ код нет — «загрузка».
  const [result, setResult] = useState<{ code: string; state: LoginPreview } | null>(null);
  const token = useRef(sessionToken);
  useEffect(() => { token.current = sessionToken; });

  useEffect(() => {
    if (!code) return;
    let alive = true;
    const setState = (state: LoginPreview) => { if (alive) setResult({ code, state }); };
    void (async () => {
      try {
        const bearer = await token.current();
        if (!bearer) throw new Error('no session');
        const res = await fetch(`${API_BASE}/api/auth/ticket/login-preview`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'x-requested-with': 'webapp', Authorization: `Bearer ${bearer}` },
          body: JSON.stringify({ code }),
        });
        if (res.status === 404) { setState({ kind: 'notfound' }); return; }
        if (!res.ok) throw new Error(`http_${res.status}`);
        const body = (await res.json()) as { deviceLabel?: unknown; createdAt?: unknown };
        if (typeof body.createdAt !== 'string') throw new Error('bad body');
        const deviceLabel = typeof body.deviceLabel === 'string' ? body.deviceLabel : null;
        setState({ kind: 'ok', deviceLabel, createdAt: body.createdAt });
      } catch {
        setState({ kind: 'failed' });
      }
    })();
    return () => { alive = false; };
  }, [code]);

  if (!code) return { kind: 'idle' };
  return result?.code === code ? result.state : { kind: 'loading' };
}
