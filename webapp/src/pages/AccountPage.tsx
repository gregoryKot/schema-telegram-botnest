import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { useTr } from '../utils/addressForm';
import { hueStyle, clientHue } from '../lib/tone';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { TherapistRequestSection } from './account/TherapistRequestSection';
import { TwoFactorSection } from './account/TwoFactorSection';
import { AccountLinkSection } from './account/AccountLinkSection';
import { SignInMethods } from './account/SignInMethods';
import { AccountFooter } from './account/AccountFooter';
import { accountInitials } from './account/accountMethods';
import { emailLinkErrorMessage } from './account/emailLinkError';
import { useAccountData } from './account/useAccountData';
import { useProviderActions } from './account/useProviderActions';
import { PROVIDER_NAMES } from './account/providerNames';
import '../styles/auth-account.css';

export function AccountPage() {
  const { accessToken, logout } = useAuth();
  const tr = useTr();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { providers, totp, loading, error, setError, refresh } = useAccountData(accessToken);
  const actions = useProviderActions(accessToken, refresh, setError);
  const success = searchParams.get('linked') === 'email' ? 'Email успешно привязан' : null;
  const emailTaken = emailLinkErrorMessage(searchParams.get('error'), tr);
  const initials = accountInitials(providers);
  const { unlinkProvider } = actions;

  return (
    <div className="aa-root light-lock">
      <div className="aa-page">
        <button className="aa-back" onClick={() => navigate('/today')}>← Назад</button>

        <div className="aa-head">
          {initials && (
            <div className="ds-avatar ds-avatar--serif aa-avatar" style={hueStyle(clientHue(initials))} aria-hidden>
              {initials}
            </div>
          )}
          <div>
            <h1 className="aa-h1">Аккаунт</h1>
            <div className="aa-lead">
              {tr('Привязывай несколько способов входа – заходи откуда удобно', 'Привязывайте несколько способов входа – заходите откуда удобно')}
            </div>
          </div>
        </div>

        {success && <div className="aa-ok"><span>✓</span>{success}</div>}
        {(error ?? emailTaken) && <div className="aa-err">{error ?? emailTaken}</div>}

        <AccountLinkSection providers={providers} loading={loading} onLinked={refresh} />

        <div className="aa-cols">
          <SignInMethods
            providers={providers} loading={loading} busy={actions.busy} accessToken={accessToken}
            onLink={{ google: actions.linkGoogle, telegram: actions.linkTelegram, vk: actions.linkVk }}
            onUnlink={actions.setUnlinkProvider} onError={setError}
          />
          <div className="aa-col">
            <TwoFactorSection accessToken={accessToken} totp={totp} onChanged={refresh} />
            <TherapistRequestSection accessToken={accessToken} />
            <div className="ds-card aa-sub"><div className="aa-sub-title">Подписка</div><Link to="/subscribe">Управлять →</Link></div>
          </div>
        </div>

        <AccountFooter logout={logout} />
      </div>

      {unlinkProvider && (
        <ConfirmDialog
          title={`Отвязать ${PROVIDER_NAMES[unlinkProvider]}?`}
          message="Понадобится другой способ входа в аккаунт."
          confirmLabel="Отвязать"
          busy={actions.busy}
          onConfirm={() => actions.performUnlink(unlinkProvider)}
          onCancel={() => actions.setUnlinkProvider(null)}
        />
      )}
    </div>
  );
}
