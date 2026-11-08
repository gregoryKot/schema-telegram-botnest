// Экран /account/merge: чей второй аккаунт и что в нём записано — с сервера по
// подписанному merge-токену (S20, аудит 2026-11), а не из адреса: адрес
// собирает кто угодно. POST /api/auth/merge/preview {token} → {provider,
// otherDisplay, summary, twoFactorLost}; чужой токен — 403.
import { useEffect, useState } from 'react';
import { API_BASE } from '../../utils/apiBase';

export interface MergePreview {
  provider: string;
  otherDisplay: string | null;
  summary: Record<string, number>;
  twoFactorLost: boolean;
}

export type MergePreviewState =
  | { kind: 'loading' }
  | ({ kind: 'ok' } & MergePreview)
  /** Сеть, чужой или протухший токен — экран говорит нейтрально. */
  | { kind: 'failed' };

/** Только известная форма: числа в сводке, строки в именах — иначе `null`. */
export function parseMergePreview(body: unknown): MergePreview | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (typeof b.provider !== 'string' || !b.summary || typeof b.summary !== 'object') return null;
  const summary: Record<string, number> = {};
  for (const [k, v] of Object.entries(b.summary as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) summary[k] = v;
  }
  return {
    provider: b.provider,
    otherDisplay: typeof b.otherDisplay === 'string' && b.otherDisplay ? b.otherDisplay : null,
    summary,
    twoFactorLost: b.twoFactorLost === true,
  };
}

export function useMergePreview(token: string, accessToken: string | null): MergePreviewState {
  // Ответ привязан к токену: пока ответа на ЭТОТ токен нет — «загрузка».
  const [result, setResult] = useState<{ token: string; state: MergePreviewState } | null>(null);
  useEffect(() => {
    if (!token) return;
    let alive = true;
    const settle = (state: MergePreviewState) => { if (alive) setResult({ token, state }); };
    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/merge/preview`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-requested-with': 'webapp',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ token }),
        });
        const preview = res.ok ? parseMergePreview(await res.json()) : null;
        settle(preview ? { kind: 'ok', ...preview } : { kind: 'failed' });
      } catch {
        settle({ kind: 'failed' }); // сеть — нейтральный текст вместо имён и цифр
      }
    })();
    return () => { alive = false; };
  }, [token, accessToken]);
  return result?.token === token ? result.state : { kind: 'loading' };
}
