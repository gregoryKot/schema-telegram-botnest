import { useEffect, useState } from 'react';
import { api, reportClientError } from '../api';
import { useSetAddressForm } from '../utils/addressForm';
import { useAddressFormChoice } from '../../../shared/src/settings/useAddressFormChoice';
import {
  shouldAskAddressForm,
  markAddressFormAsked,
} from '../../../shared/src/settings/addressFormPrompt';
import { useHistorySheet } from '../hooks/useHistorySheet';

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
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380, background: 'var(--bg)', borderRadius: 20, padding: 28 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Как удобнее общаться?
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6, marginBottom: 18 }}>
          Поменять можно в любой момент в настройках.
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <button onClick={() => choose('ty')}
            style={{ flex: 1, padding: '13px 0', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            На «ты»
          </button>
          <button onClick={() => choose('vy')}
            style={{ flex: 1, padding: '13px 0', borderRadius: 12, border: 'none', background: 'rgba(var(--fg-rgb),0.08)', color: 'var(--text)', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            На «вы»
          </button>
        </div>
        {failed && (
          <div style={{ fontSize: 12.5, color: 'var(--danger, #e5484d)', lineHeight: 1.5, marginBottom: 10 }}>
            Не удалось сохранить выбор. Проверить соединение и попробовать ещё раз — или «Позже».
          </div>
        )}
        <button onClick={goBack}
          style={{ width: '100%', padding: '9px 0', borderRadius: 10, border: 'none', background: 'transparent', color: 'var(--text-faint)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          Позже
        </button>
      </div>
    </div>
  );
}
