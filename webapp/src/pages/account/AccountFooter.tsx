import { useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';

/** Низ страницы: «Выйти» и «Выйти со всех устройств» (второе — через подтверждение). */
export function AccountFooter({ logout }: { logout: (all?: boolean) => void | Promise<void> }) {
  // «Выйти со всех устройств» отзывает ВСЕ сессии (?all=true) — ощутимее
  // обычного выхода, поэтому через подтверждение.
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);
  return (
    <>
      <div className="aa-foot">
        <button onClick={() => void logout()} className="ds-btn ds-btn--secondary">Выйти</button>
        <button onClick={() => setLogoutAllOpen(true)} className="aa-foot-all">Выйти со всех устройств</button>
      </div>
      {logoutAllOpen && (
        <ConfirmDialog
          title="Выйти со всех устройств?"
          message="Сессии на всех устройствах завершатся. Данные останутся на месте — войти можно будет снова."
          confirmLabel="Выйти везде"
          onConfirm={() => { setLogoutAllOpen(false); void logout(true); }}
          onCancel={() => setLogoutAllOpen(false)}
        />
      )}
    </>
  );
}
