import { useState } from 'react';
import { useTr } from '../../utils/addressForm';
import { SRow } from './ui';

// «Перестать быть специалистом» с подтверждением — тихая опасная строка раздела «Данные»
// (DataSection), перед «Удалить аккаунт»: опасные действия стоят вместе внизу листа (b25).
// Раньше была первой заметной кнопкой листа, в «Режиме». После «Снять роль» родитель
// закрывает лист и уводит в /today.
export function ResignTherapistBlock({ onResign }: { onResign: () => Promise<void> | void }) {
  const tr = useTr();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!confirm) return <SRow title="Перестать быть специалистом" danger onClick={() => setConfirm(true)} />;
  return (
    <div className="st-body-block">
      <div className="st-text">
        {tr(
          'Роль специалиста будет снята: кабинет и доступ к данным клиентов пропадут. Свои данные не теряешь. Заявку можно подать заново.',
          'Роль специалиста будет снята: кабинет и доступ к данным клиентов пропадут. Свои данные не теряете. Заявку можно подать заново.',
        )}
      </div>
      <div className="st-actions">
        <button className="ds-btn ds-btn--sm ds-btn--secondary" disabled={busy} onClick={() => setConfirm(false)}>
          Отмена
        </button>
        <button className="ds-btn ds-btn--sm st-btn-danger is-solid" disabled={busy}
          onClick={() => { setBusy(true); void (async () => { try { await onResign(); setConfirm(false); } finally { setBusy(false); } })(); }}>
          {busy ? '…' : 'Снять роль'}
        </button>
      </div>
    </div>
  );
}
