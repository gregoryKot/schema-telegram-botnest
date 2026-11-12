import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { useTr } from '../utils/addressForm';
import { hueStyle, clientHue } from '../lib/tone';
import { Limits } from '../components/art/NeedArt';
import { HistoryConfirmDialog } from '../components/HistoryConfirmDialog';
import { PaperAlert } from '../components/paper/PaperAlert';
import { TherapistRequestSection } from './account/TherapistRequestSection';
import { TwoFactorSection } from './account/TwoFactorSection';
import { AccountLinkSection } from './account/AccountLinkSection';
import { SignInMethods } from './account/SignInMethods';
import { AccountFooter } from './account/AccountFooter';
import { GroupSkeleton } from './account/GroupSkeleton';
import { accountInitials } from './account/accountMethods';
import { emailLinkNotice } from './account/emailLinkNotice';
import { useAccountData } from './account/useAccountData';
import { useProviderActions } from './account/useProviderActions';
import { PROVIDER_NAMES } from './account/providerNames';
import { accountBackPathFromStorage } from './account/accountBackPath';
import '../styles/auth-account.css';
import { BackLabel } from '../components/NavGlyphs';

// Форма без картинок (APP_2026-11.md, b27): плоские группы, одна залитая кнопка — «Данные из Telegram» (если бот не подключён).
export function AccountPage() {
  const { accessToken, logout } = useAuth();
  const tr = useTr();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { providers, totp, loading, error, setError, refresh } = useAccountData(accessToken);
  const actions = useProviderActions(accessToken, refresh, setError);
  const emailNotice = emailLinkNotice(searchParams.get('linked'), searchParams.get('error'), tr);
  const initials = accountInitials(providers);
  const { unlinkProvider } = actions;
  // Силуэт 2FA — до первой загрузки: refresh не размонтирует секцию с только что выданными кодами.
  const [loadedOnce, setLoadedOnce] = useState(false);
  if (!loading && !loadedOnce) setLoadedOnce(true);

  return (
    <div className="aa-root light-lock">
      <div className="ds-sheet-head ds-sheet-head--page">
        <button type="button" className="ds-back" onClick={() => navigate(accountBackPathFromStorage())}><BackLabel>Назад</BackLabel></button>
      </div>
      <div className="aa-page">
        <div className="aa-head">
          {initials
            ? <div className="ds-avatar ds-avatar--serif aa-avatar" style={hueStyle(clientHue(initials))} aria-hidden>{initials}</div>
            : loading && <div className="skel aa-avatar aa-avatar--skel" aria-hidden />}
          <div className="aa-head-text">
            <div className="ds-eyebrow">Аккаунт</div>
            <h1 className="ds-h1">Вход и{'\u00a0'}<i>защита</i></h1>
            <p className="ds-sub aa-lead">
              {tr('Привязывай несколько способов входа – заходи откуда удобно', 'Привязывайте несколько способов входа – заходите откуда удобно')}
            </p>
          </div>
          <span className="pp-paper aa-head-sign" style={hueStyle(240)} aria-hidden="true"><Limits size="square" /></span>
        </div>

        {error && <PaperAlert title={error} sign="limits" className="aa-alert" />}
        <AccountLinkSection providers={providers} loading={loading} onLinked={refresh} />

        <div className="aa-cols">
          <SignInMethods
            providers={providers} loading={loading} busy={actions.busy} accessToken={accessToken}
            onLink={{ vk: actions.linkVk }}
            onUnlink={actions.setUnlinkProvider} emailNotice={emailNotice} onLinked={() => { void refresh(); }}
          />
          <div className="aa-col">
            {!loadedOnce ? <GroupSkeleton /> : <TwoFactorSection accessToken={accessToken} totp={totp} onChanged={refresh} />}
            <TherapistRequestSection accessToken={accessToken} />
            <section className="aa-group"><Link to="/subscribe" className="aa-nav"><span className="aa-nav-body"><span className="aa-row-title">Подписка</span><span className="ds-sub">Регулярная поддержка проекта</span></span><span className="ds-chev" aria-hidden="true" /></Link></section>
          </div>
        </div>
        <AccountFooter logout={logout} />
      </div>
      {/* Своя запись истории: «Назад» закрывает диалог; отвязка (и окно кода 2FA) — после снятия записи. */}
      {unlinkProvider && (
        <HistoryConfirmDialog
          title={`Отвязать ${PROVIDER_NAMES[unlinkProvider]}?`}
          message="Понадобится другой способ входа в аккаунт."
          confirmLabel="Отвязать"
          onConfirm={() => { void actions.performUnlink(unlinkProvider); }}
          onCancel={() => actions.setUnlinkProvider(null)}
        />
      )}
    </div>
  );
}
