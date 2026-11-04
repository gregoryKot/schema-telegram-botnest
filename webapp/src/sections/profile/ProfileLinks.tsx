import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/authContext';

interface Props { onOpenSettings?: () => void; onDeleteAccount: () => void }

export function ProfileLinks({ onOpenSettings, onDeleteAccount }: Props) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  return (
    <>
      <div className="mobile-only ds-card ds-card--flush">
        {onOpenSettings && (
          <button type="button" className="ds-list-row ds-list-row--nav ds-list-row--hover" onClick={onOpenSettings}><span className="ds-list-title">Настройки</span><span className="ds-chev" aria-hidden="true" /></button>
        )}
        <button type="button" className="ds-list-row ds-list-row--nav ds-list-row--hover" onClick={() => navigate('/account')}><span className="ds-list-title">Аккаунт и привязки</span><span className="ds-chev" aria-hidden="true" /></button>
        <button type="button" className="ds-list-row ds-list-row--nav ds-list-row--hover ds-list-row--danger" onClick={() => logout()}><span className="ds-list-title">Выйти</span></button>
      </div>
      <div className="cpf-delete">
        <button type="button" className="ds-link ds-link--danger" onClick={onDeleteAccount}>Удалить аккаунт</button>
      </div>
    </>
  );
}
