import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { rememberReturnTo } from '../auth/returnTo';
import { totalItems as sumItems } from '../utils/mergeLabels';
import { useTr } from '../utils/addressForm';
import { PaperAlert } from '../components/paper/PaperAlert';
import { AckCheck } from './merge/AckCheck';
import { MergeRows } from './merge/MergeRows';
import { MergeSpread } from './merge/MergeSpread';
import { LinkOutcome } from './merge/LinkOutcome';
import { linkAckText, useLinkTicket } from './merge/useLinkTicket';
import { combinedText } from './merge/combinedText';
import { providerName } from './account/providerNames';
import { Skeleton } from '../components/Skeleton';
import { TwoFactorLossNote } from '../components/TwoFactorLossNote';
import { WarnNote } from '../components/WarnNote';
import { AddressFormProvider } from '../utils/AddressFormProvider';
import { StepUpProvider } from '../components/stepUp/StepUpProvider';

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
// Вид (b27): лист-герой SceneMerge + форма (MergeSpread), исходы — LinkOutcome.
export function LinkDevicePage() {
  const [params] = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();
  const code = (params.get('code') ?? '').trim();

  if (isLoading) return <div className="loader-center"><div className="spinner" /></div>;
  if (!isAuthenticated) {
    // Возврат сюда же после входа — иначе код потеряется и всё начинай заново.
    rememberReturnTo(`/link?code=${encodeURIComponent(code)}`);
    return <Navigate to="/login" replace />;
  }
  if (!code) return <Navigate to="/account" replace />;

  // Маршрут вне RequireAuth (свой возврат-после-логина выше) — форма не
  // приезжает сверху из App.tsx, ставим её здесь; окно кода 2FA (S12) — тоже.
  return (
    <AddressFormProvider>
      <StepUpProvider><LinkDeviceContent code={code} /></StepUpProvider>
    </AddressFormProvider>
  );
}

function LinkDeviceContent({ code }: { code: string }) {
  const tr = useTr();
  const { preview, error, failOutcome, busy, phase, approve, deny } = useLinkTicket(code);
  // Эффект тот же, что у MergePage (второй аккаунт вливается и удаляется), —
  // и подтверждение то же: без галочки кнопка недоступна.
  const [acknowledged, setAcknowledged] = useState(false);

  const messenger = preview ? providerName(preview.provider) ?? preview.provider : '';
  const total = preview ? sumItems(preview.summary) : 0;
  const combined = preview && !preview.sameAccount ? combinedText(preview.combined, tr) : null; // без числа — прежний текст

  if (phase === 'denied' || phase === 'done') return <LinkOutcome kind={phase} messenger={messenger} />;
  // Сводка не загрузилась — исход на весь экран с выходом из него.
  if (!preview && error) return <LinkOutcome kind={failOutcome ?? 'our_side'} messenger={messenger} error={error} />;

  return (
    <MergeSpread>
      <div className="ds-eyebrow">Аккаунт</div>
      <h1 className="ds-h2 am-title">Привязать приложение</h1>

      {!preview && (
        <div className="am-skel" aria-hidden="true">
          <Skeleton height={14} /><Skeleton height={14} width="85%" /><Skeleton height={64} radius={16} />
        </div>
      )}

      {preview && (
        <>
          <p className="am-lead">
            Приложение в {messenger}
            {preview.displayName ? ` (${preview.displayName})` : ''} хочет войти в этот аккаунт — {tr('твой', 'ваш')}.
            После подтверждения оно сможет открывать его и видеть, менять и удалять все {tr('твои', 'ваши')} данные.
            {preview.sameAccount
              ? ` ${tr('Это тот же аккаунт, ты уже в нём', 'Это тот же аккаунт, вы уже в нём')} — переносить нечего.`
              : ` Данные приложения (ниже) при этом переедут к ${tr('тебе', 'вам')}, а его прежний аккаунт исчезнет.`}
          </p>

          <WarnNote>
            {tr('Подтверждай, только если код запрошен тобой в этом приложении.', 'Подтверждайте, только если код запрошен вами в этом приложении.')}{' '}
            {tr('Если код прислали со стороны — нажми «Это не я»: подтверждённый чужой код отдаёт аккаунт постороннему.', 'Если код прислали со стороны — нажмите «Это не я»: подтверждённый чужой код отдаёт аккаунт постороннему.')}
          </WarnNote>

          {!preview.sameAccount && total > 0 && (
            <>
              <div className="ds-label">Что переедет из приложения:</div>
              <MergeRows summary={preview.summary} />
            </>
          )}
          {combined && <p className="am-lead">{combined}</p>}

          {preview.twoFactorLost && <TwoFactorLossNote />}

          {error && <PaperAlert title={error} sign="cup" />}

          <AckCheck checked={acknowledged} onChange={setAcknowledged} disabled={busy !== null}>
            {linkAckText(messenger, preview.sameAccount)}
          </AckCheck>

          <div className="am-actions">
            <button className="ds-btn" onClick={() => void approve()} disabled={busy !== null || !acknowledged} aria-busy={busy === 'approve' || undefined}>
              {busy === 'approve' ? 'Привязываю…' : 'Разрешить доступ'}
            </button>
            <button className="ds-btn ds-btn--secondary" onClick={() => void deny()} disabled={busy !== null} aria-busy={busy === 'deny' || undefined}>
              Это не я
            </button>
          </div>
        </>
      )}
    </MergeSpread>
  );
}
