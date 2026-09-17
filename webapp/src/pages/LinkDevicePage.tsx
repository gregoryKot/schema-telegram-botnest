import { useCallback, useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { tableLabel, totalItems as sumItems } from '../utils/mergeLabels';
import { api } from '../api';
import { useTr } from '../utils/addressForm';
import { AddressFormProvider } from '../utils/AddressFormProvider';
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
// копирайт (O1 аудита 2026-08) ведёт с ГЛАВНОГО эффекта — приложение получит
// полный доступ к ЭТОМУ (вашему) аккаунту, — а перенос данных и счётчики идут
// вторыми; плюс явное предупреждение не подтверждать код, пришедший со стороны.
// Раньше текст кадрировал согласие как «импорт данных ко мне» — доступ к своему
// аккаунту читался как побочная деталь.
export function LinkDevicePage() {
  const [params] = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();
  const code = (params.get('code') ?? '').trim();

  if (isLoading) return <div className="loader-center"><div className="spinner" /></div>;
  if (!isAuthenticated) {
    // Возврат сюда же после входа — иначе код потеряется и всё начинай заново.
    try { sessionStorage.setItem('auth_return_to', `/link?code=${encodeURIComponent(code)}`); } catch { /* приватный режим */ }
    return <Navigate to="/login" replace />;
  }
  if (!code) return <Navigate to="/account" replace />;

  // Маршрут вне RequireAuth (свой возврат-после-логина выше) — форма не
  // приезжает сверху из App.tsx, ставим её здесь.
  return (
    <AddressFormProvider>
      <LinkDeviceContent code={code} />
    </AddressFormProvider>
  );
}

function LinkDeviceContent({ code }: { code: string }) {
  const tr = useTr();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const call = useCallback(async (path: string) => {
    const res = await fetch(`${API_BASE}/api/auth/ticket/${path}`, {
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
    let alive = true;
    call('preview')
      .then((p) => { if (alive) setPreview(p as Preview); })
      .catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [call]);

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
          {tr('Вернись в приложение', 'Вернитесь в приложение')} — оно уже работает с этим аккаунтом.
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
          <p className="text-sm" style={{ lineHeight: 1.7, marginBottom: 14 }}>
            Приложение в {messenger}
            {preview.displayName ? ` (${preview.displayName})` : ''} хочет войти в этот аккаунт — {tr('твой', 'ваш')}.
            После подтверждения оно сможет открывать его и видеть, менять и удалять все {tr('твои', 'ваши')} данные.
            {preview.sameAccount
              ? ` ${tr('Это тот же аккаунт, ты уже в нём', 'Это тот же аккаунт, вы уже в нём')} — переносить нечего.`
              : ` Данные приложения (ниже) при этом переедут к ${tr('тебе', 'вам')}, а его прежний аккаунт исчезнет.`}
          </p>

          <p className="text-sm" style={{ lineHeight: 1.7, marginBottom: 18, color: 'var(--c-amber)' }}>
            {tr('Подтверждай, только если код запрошен тобой в этом приложении.', 'Подтверждайте, только если код запрошен вами в этом приложении.')}{' '}
            {tr('Если код прислали со стороны — закрой эту страницу: так отдают доступ к аккаунту чужому.', 'Если код прислали со стороны — закройте эту страницу: так отдают доступ к аккаунту чужому.')}
          </p>

          {!preview.sameAccount && total > 0 && (
            <>
              <div className="hint" style={{ marginBottom: 8 }}>Что переедет из приложения:</div>
              <div className="card" style={{ padding: 16, borderRadius: 'var(--r-14)', marginBottom: 18 }}>
                {Object.entries(preview.summary).map(([table, n]) => (
                  <div key={table} style={{ display: 'flex', gap: 'var(--space-10)', padding: '4px 0' }}>
                    <span className="text-sm" style={{ flex: 1 }}>{tableLabel(table)}</span>
                    <span className="hint">{n}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <button className="btn" onClick={() => void approve()} disabled={busy} style={{ minHeight: 44 }}>
            {busy ? 'Привязываю…' : 'Разрешить доступ'}
          </button>
        </>
      )}
    </div>
  );
}
