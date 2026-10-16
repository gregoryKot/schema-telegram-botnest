import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/authContext';
import { pressable } from '../../utils/a11y';

interface Props { onOpenSettings?: () => void; onDeleteAccount: () => void }

export function ProfileLinks({ onOpenSettings, onDeleteAccount }: Props) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  return (
    <>
      <div className="mobile-only ds-card ds-card--flush">
        {onOpenSettings && (
          <button type="button" className="cpf-link-row" onClick={onOpenSettings}><span>Настройки</span><span className="cpf-chev">›</span></button>
        )}
        <button type="button" className="cpf-link-row" onClick={() => navigate('/account')}><span>Аккаунт и привязки</span><span className="cpf-chev">›</span></button>
        <button type="button" className="cpf-link-row is-danger" onClick={() => logout()}><span>Выйти</span></button>
      </div>
      <div className="cpf-delete">
        <span className="ds-link cpf-delete-link" {...pressable(onDeleteAccount)}>Удалить аккаунт</span>
      </div>
    </>
  );
}
