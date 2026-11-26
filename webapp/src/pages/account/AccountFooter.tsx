import { useState } from 'react';
import { HistoryConfirmDialog } from '../../components/HistoryConfirmDialog';

/** Низ страницы: «Выйти» и «Выйти со всех устройств» (второе — через подтверждение). */
export function AccountFooter({ logout }: { logout: (all?: boolean) => void | Promise<void> }) {
  // «Выйти со всех устройств» отзывает ВСЕ сессии (?all=true) — ощутимее
  // обычного выхода, поэтому через подтверждение.
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);
  return (
    <>
      <div className="aa-foot">
        <button type="button" onClick={() => void logout()} className="ds-btn ds-btn--secondary">Выйти</button>
        <button type="button" onClick={() => setLogoutAllOpen(true)} className="ds-link">Выйти со всех устройств</button>
      </div>
      {logoutAllOpen && (
        <HistoryConfirmDialog
          title="Выйти со всех устройств?"
          message="Сессии на всех устройствах завершатся. Данные останутся на месте — войти можно будет снова."
          confirmLabel="Выйти везде"
          onConfirm={() => void logout(true)}
          onCancel={() => setLogoutAllOpen(false)}
        />
      )}
    </>
  );
}
