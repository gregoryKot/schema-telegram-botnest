import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearApiCache } from '../../../../shared/src/api/apiCache';
import { useAuth } from '../../auth/authContext';
import { useTr } from '../../utils/addressForm';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

// Причина 403 от POST /api/auth/merge: у поглощаемого аккаунта включён TOTP, и
// сервер просит его код (аудит 2026-10, A4). Строка — контракт с бэкендом
// (src/auth/merge-confirm.ts → SOURCE_TOTP_REQUIRED).
export const SOURCE_TOTP_REQUIRED = 'source_totp_required';

// Подтверждение объединения аккаунтов: запрос, второй фактор второго аккаунта,
// состояние кнопки. Вынесено из MergePage (правило №10: страница у потолка).
export function useMergeConfirm(token: string) {
  const navigate = useNavigate();
  const { accessToken, setAccessToken } = useAuth();
  const tr = useTr();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needCode, setNeedCode] = useState(false);
  const [code, setCode] = useState('');

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const sentCode = needCode ? code.trim() : '';
    try {
      const res = await fetch(`${API_BASE}/api/auth/merge`, {
        method: 'POST',
        // refresh-кука (path=/api/auth) — доказательство, что это тот самый
        // аккаунт: сервер не принимает merge-токен от анонима (A2).
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-requested-with': 'webapp',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(sentCode ? { token, code: sentCode } : { token }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Merge failed' }));
        if (res.status === 403 && body.reason === SOURCE_TOTP_REQUIRED) {
          // Первый отказ — просто показываем поле; повторный (код уходил) —
          // говорим, что код не подошёл.
          setNeedCode(true);
          setCode('');
          setBusy(false);
          if (sentCode) setError(tr('Код не подошёл. Проверь его и попробуй ещё раз.', 'Код не подошёл. Проверьте его и попробуйте ещё раз.'));
          return;
        }
        throw new Error(body.message ?? 'Merge failed');
      }
      const { accessToken: next, expiresIn } = await res.json() as { accessToken: string; expiresIn: number };
      setAccessToken(next, expiresIn);
      // Данные другого аккаунта переехали на текущий userId — старый кеш
      // (списки без перенесённых записей) обязан уйти вместе с ним.
      clearApiCache();
      navigate('/account', { replace: true });
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  };

  return { busy, error, needCode, code, setCode, confirm };
}
