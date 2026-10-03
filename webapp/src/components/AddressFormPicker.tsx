import { useEffect, useState } from 'react';
import { api, reportClientError } from '../api';
import { useSetAddressForm } from '../utils/addressForm';
import { useAddressFormChoice } from '../../../shared/src/settings/useAddressFormChoice';
import {
  shouldAskAddressForm,
  markAddressFormAsked,
} from '../../../shared/src/settings/addressFormPrompt';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { Dialog } from './Dialog';

/**
 * Выбор обращения («ты»/«вы») при первом входе — пока addressForm в настройках null.
 * «Позже» = мягкий пропуск: остаётся «ты» по умолчанию, спросим в следующей сессии
 * (не блокируем вход). Сам грузит настройки; не чаще раза за сессию.
 *
 * Сохранение выбора — через общий shared/src/settings/useAddressFormChoice.ts
 * (правило №3): при отказе api.updateSettings диалог НЕ закрывается — иначе
 * человек видит выбранную форму применённой, а на деле она не долетела до
 * сервера и на следующей сессии перезатрётся обратно на дефолтную (инцидент,
 * см. комментарий в useAddressFormChoice.ts).
 */
export function AddressFormPicker() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    api.getSettings()
      .then(s => { if (shouldAskAddressForm(s.addressForm)) setShow(true); })
      .catch(() => {});
  }, []);

  function close() {
    markAddressFormAsked();
    setShow(false);
  }

  if (!show) return null;
  // Оверлей вынесен в отдельный компонент, чтобы useHistorySheet (правило
  // CLAUDE.md — обязателен для fixed/inset:0 листов) вызывался только пока
  // диалог реально смонтирован, а не на каждом рендере AddressFormPicker.
  return <AddressFormPickerModal onClose={close} />;
}

function AddressFormPickerModal({ onClose }: { onClose: () => void }) {
  const setForm = useSetAddressForm();
  const goBack = useHistorySheet(onClose);
  // onSaved зовётся goBack — успешное сохранение закрывает диалог тем же
  // путём, что и «Назад» браузера (CLAUDE.md: «если лист закрывается после
  // сохранения, тоже goBack()»).
  const { failed, choose } = useAddressFormChoice(
    setForm,
    api.updateSettings,
    reportClientError,
    goBack,
  );

  return (
    <Dialog label="Как удобнее общаться?" zIndex={200}>
      <h2 className="dialog-title">Как удобнее общаться?</h2>
      <p className="dialog-text" style={{ marginBottom: 20 }}>
        Поменять можно в любой момент в настройках.
      </p>
      <div className="dialog-actions" style={{ marginBottom: 10 }}>
        <button className="btn-primary" onClick={() => choose('ty')}>
          На «ты»
        </button>
        <button className="btn-outline" onClick={() => choose('vy')}>
          На «вы»
        </button>
      </div>
      {failed && (
        <div className="dialog-error">
          Не удалось сохранить выбор. Проверить соединение и попробовать ещё раз — или «Позже».
        </div>
      )}
      <button className="dialog-link" onClick={goBack}>
        Позже
      </button>
    </Dialog>
  );
}
