import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { totalItems as sumItems } from '../utils/mergeLabels';
import { useTr } from '../utils/addressForm';
import { ServicePage } from './service/ServicePage';
import { ServiceRows } from './service/ServiceRows';
import { TicketDenied } from './service/TicketDenied';
import { AckCheck } from './merge/AckCheck';
import { linkAckText, useLinkTicket } from './merge/useLinkTicket';
import { providerName } from './account/providerNames';
import { Skeleton } from '../components/Skeleton';
import { TwoFactorLossNote } from '../components/TwoFactorLossNote';
import { AddressFormProvider } from '../utils/AddressFormProvider';

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
  const navigate = useNavigate();
  const { preview, error, busy, phase, approve, deny } = useLinkTicket(code);
  // Эффект тот же, что у MergePage (второй аккаунт вливается и удаляется), —
  // и подтверждение то же: без галочки кнопка недоступна.
  const [acknowledged, setAcknowledged] = useState(false);
  const done = phase === 'done';

  const messenger = preview ? providerName(preview.provider) ?? preview.provider : '';
  const total = preview ? sumItems(preview.summary) : 0;

  if (phase === 'denied') {
    return (
      <TicketDenied>
        <p className="as-lead">
          Код не подтверждён: приложение в {messenger} не получило доступ к аккаунту, данные остались на месте.
        </p>
        <button className="ds-btn ds-btn--secondary" onClick={() => navigate('/account')}>В аккаунт</button>
      </TicketDenied>
    );
  }

  return (
    <ServicePage>
      <div className="as-body">
        <div className="ds-eyebrow">Аккаунт</div>
        <h1 className="ds-h2">{done ? 'Готово' : 'Привязать приложение'}</h1>

        {done && (
          <p className="as-lead">
            {tr('Вернись в приложение', 'Вернитесь в приложение')} — оно уже работает с этим аккаунтом.
          </p>
        )}

        {!done && error && <div className="ds-card as-err">{error}</div>}

        {!done && !error && !preview && (
          <>
            <Skeleton height={14} />
            <Skeleton height={14} width="85%" />
          </>
        )}

        {!done && preview && (
          <>
            <p className="as-lead">
              Приложение в {messenger}
              {preview.displayName ? ` (${preview.displayName})` : ''} хочет войти в этот аккаунт — {tr('твой', 'ваш')}.
              После подтверждения оно сможет открывать его и видеть, менять и удалять все {tr('твои', 'ваши')} данные.
              {preview.sameAccount
                ? ` ${tr('Это тот же аккаунт, ты уже в нём', 'Это тот же аккаунт, вы уже в нём')} — переносить нечего.`
                : ` Данные приложения (ниже) при этом переедут к ${tr('тебе', 'вам')}, а его прежний аккаунт исчезнет.`}
            </p>

            <p className="as-warn">
              {tr('Подтверждай, только если код запрошен тобой в этом приложении.', 'Подтверждайте, только если код запрошен вами в этом приложении.')}{' '}
              {tr('Если код прислали со стороны — нажми «Это не я»: подтверждённый чужой код отдаёт аккаунт постороннему.', 'Если код прислали со стороны — нажмите «Это не я»: подтверждённый чужой код отдаёт аккаунт постороннему.')}
            </p>

            {!preview.sameAccount && total > 0 && (
              <>
                <div className="ds-label">Что переедет из приложения:</div>
                <ServiceRows summary={preview.summary} />
              </>
            )}

            {preview.twoFactorLost && <TwoFactorLossNote />}

            <AckCheck checked={acknowledged} onChange={setAcknowledged} disabled={busy !== null}>
              {linkAckText(messenger, preview.sameAccount)}
            </AckCheck>

            <div className="as-actions-row">
              <button className="ds-btn" onClick={() => void approve()} disabled={busy !== null || !acknowledged}>
                {busy === 'approve' ? 'Привязываю…' : 'Разрешить доступ'}
              </button>
              <button className="ds-btn ds-btn--secondary" onClick={() => void deny()} disabled={busy !== null}>
                Это не я
              </button>
            </div>
          </>
        )}
      </div>
    </ServicePage>
  );
}
