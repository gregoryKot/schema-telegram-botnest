import { useCallback, useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { tableLabel, totalItems as sumItems } from '../utils/mergeLabels';
import { api } from '../api';
import {
  ACCOUNT_LINK_CONFIRMED_EVENT,
  type AccountLinkHost,
} from '../../../shared/src/share/analytics';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

interface Preview {
  provider: string;
  displayName: string | null;
  sameAccount: boolean;
  summary: Record<string, number>;
}

const PROVIDER_NAMES: Record<string, string> = {
  max: 'MAX',
  telegram: 'Telegram',
};

// Подтверждение привязки из мессенджера: сюда человек попадает по ссылке из
// мини-аппа (device authorization grant, RFC 8628).
//
// Экран обязателен, а не косметика: флоу с кодом ломают уговорами — «введите
// код для проверки безопасности», — и человек молча отдаёт аккаунт. Поэтому
// здесь прямым текстом сказано, чей аккаунт и что именно переедет.
export function LinkDevicePage() {
  const [params] = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();
  const code = (params.get('code') ?? '').trim();

  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const call = useCallback(async (path: string) => {
    const res = await fetch(`${API_BASE}/api/auth/device-link/${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-requested-with': 'webapp' },
      body: JSON.stringify({ code }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as { message?: string }).message ?? 'Не получилось');
    return body;
  }, [code]);

  useEffect(() => {
    if (!isAuthenticated || !code) return;
    let alive = true;
    call('preview')
      .then((p) => { if (alive) setPreview(p as Preview); })
      .catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [isAuthenticated, code, call]);

  if (isLoading) return <div className="loader-center"><div className="spinner" /></div>;
  if (!isAuthenticated) {
    // Возврат сюда же после входа — иначе код потеряется и всё начинай заново.
    try { sessionStorage.setItem('auth_return_to', `/link?code=${encodeURIComponent(code)}`); } catch { /* приватный режим */ }
    return <Navigate to="/login" replace />;
  }
  if (!code) return <Navigate to="/account" replace />;

  const approve = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = (await call('approve')) as { merged?: boolean };
      // Успех считает именно этот экран: мини-апп в этот момент ещё ждёт и о
      // результате не знает, а посчитать «довели до конца» надо ровно один раз.
      api.trackEvent(ACCOUNT_LINK_CONFIRMED_EVENT, {
        host: (preview?.provider ?? 'max') as AccountLinkHost,
        merged: res.merged === true,
      });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const messenger = preview ? PROVIDER_NAMES[preview.provider] ?? preview.provider : '';
  const total = preview ? sumItems(preview.summary) : 0;

  return (
    <div className="page-inner-wide" style={{ paddingTop: 80, paddingBottom: 80, maxWidth: 640, margin: '0 auto' }}>
      <div className="eyebrow" style={{ marginBottom: 14 }}>Аккаунт</div>
      <h1 style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: 18 }}>
        {done ? 'Готово' : 'Привязать приложение'}
      </h1>

      {done && (
        <p className="text-sm" style={{ lineHeight: 1.7 }}>
          Вернитесь в приложение — оно уже работает с этим аккаунтом.
        </p>
      )}

      {!done && error && (
        <p className="text-sm" style={{ color: 'var(--c-rose)', lineHeight: 1.7 }}>{error}</p>
      )}

      {!done && !error && !preview && (
        <div className="loader-center"><div className="spinner" /></div>
      )}

      {!done && preview && (
        <>
          <p className="text-sm" style={{ lineHeight: 1.7, marginBottom: 18 }}>
            Приложение в {messenger}
            {preview.displayName ? ` (${preview.displayName})` : ''} просит доступ к этому аккаунту.
            {preview.sameAccount
              ? ' Это тот же аккаунт — переносить нечего, просто подтвердите.'
              : ' После подтверждения данные из него переедут сюда, а сам он исчезнет.'}
          </p>

          {!preview.sameAccount && total > 0 && (
            <div className="card" style={{ padding: 16, borderRadius: 14, marginBottom: 18 }}>
              {Object.entries(preview.summary).map(([table, n]) => (
                <div key={table} style={{ display: 'flex', gap: 10, padding: '4px 0' }}>
                  <span className="text-sm" style={{ flex: 1 }}>{tableLabel(table)}</span>
                  <span className="hint">{n}</span>
                </div>
              ))}
            </div>
          )}

          <button className="btn" onClick={() => void approve()} disabled={busy} style={{ minHeight: 44 }}>
            {busy ? 'Привязываю…' : 'Да, это я'}
          </button>
        </>
      )}
    </div>
  );
}
