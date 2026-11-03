import { useEffect, useState } from 'react';
import { useNavigationType } from 'react-router-dom';
import { api, reportClientError } from '../api';
import { useSetAddressForm } from '../utils/addressForm';
import { useAddressFormChoice } from '../../../shared/src/settings/useAddressFormChoice';
import { shouldAskAddressForm, markAddressFormAsked } from '../../../shared/src/settings/addressFormPrompt';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { Dialog } from './Dialog';

/**
 * Выбор обращения («ты»/«вы») при первом входе — пока addressForm в настройках null.
 * «Позже» = мягкий пропуск: остаётся «ты» по умолчанию, спросим через неделю
 * (не блокируем вход). Монтирует EntryFlows — в очереди после согласий и ссылки.
 * Сохранение — общий shared/src/settings/useAddressFormChoice.ts (правило №3): при
 * отказе api.updateSettings диалог НЕ закрывается, иначе выбор, не долетевший до
 * сервера, на следующей сессии перезатрётся дефолтом (см. useAddressFormChoice.ts).
 */
export function AddressFormPicker() {
  const [show, setShow] = useState(false);
  const [round, setRound] = useState(0);

  useEffect(() => {
    api.getSettings()
      .then(s => { if (shouldAskAddressForm(s.addressForm)) setShow(true); })
      .catch(() => {});
  }, []);

  // Запись листа сняла чужая навигация (navigate с replace после разбора ссылки
  // или бутстрапа) — человек не ответил: «спросили» не ставим, а открываем вопрос
  // заново новой записью (key). QA 2026-11: пикер закрывался сам, addressForm — null.
  function close(answered: boolean) {
    if (!answered) { setRound(r => r + 1); return; }
    markAddressFormAsked();
    setShow(false);
  }

  if (!show) return null;
  // Отдельный компонент: useHistorySheet (обязателен для fixed/inset:0 листов)
  // живёт, только пока диалог смонтирован.
  return <AddressFormPickerModal key={round} onClose={close} />;
}

function AddressFormPickerModal({ onClose }: { onClose: (answered: boolean) => void }) {
  const setForm = useSetAddressForm();
  // «Позже», выбор, Escape и «Назад» браузера снимают запись шагом назад (POP);
  // push/replace чужого navigate тоже её снимают, но ответом это не считается.
  const navType = useNavigationType();
  const goBack = useHistorySheet(() => onClose(navType === 'POP'));
  // onSaved — тот же goBack, что у «Назад» браузера (CLAUDE.md: после сохранения — goBack()).
  const { failed, choose } = useAddressFormChoice(
    setForm,
    api.updateSettings,
    reportClientError,
    goBack,
  );

  return (
    <Dialog label="Как удобнее общаться?" zIndex={300}>
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
