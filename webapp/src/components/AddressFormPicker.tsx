import { useEffect, useState } from 'react';
import { useNavigationType } from 'react-router-dom';
import { api, reportClientError } from '../api';
import { useSetAddressForm } from '../utils/addressForm';
import { useAddressFormChoice } from '../../../shared/src/settings/useAddressFormChoice';
import { shouldAskAddressForm, markAddressFormAsked } from '../../../shared/src/settings/addressFormPrompt';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { hueStyle } from '../lib/tone';
import { Dialog } from './Dialog';
import { EntryBrand, EntryHead } from './paper/EntryHead';
import { PaperAlert } from './paper/PaperAlert';
import { ADDRESS_FORM_HUE, ENTRY_HUE } from './paper/entryLook';

/**
 * Выбор обращения («ты»/«вы») при первом входе — пока addressForm в настройках null.
 * «Позже» = мягкий пропуск: остаётся «ты» по умолчанию, спросим через неделю
 * (не блокируем вход). Монтирует EntryFlows — первым шагом очереди, до согласий:
 * иначе они звучат в форме по умолчанию до вопроса (QA 2026-11, A-З7). `onDone` — вопрос решён
 * (ответ, «Позже», не нужен или настройки не загрузились): очередь идёт дальше.
 * Сохранение — общий shared/src/settings/useAddressFormChoice.ts (правило №3): при
 * отказе api.updateSettings диалог НЕ закрывается, иначе выбор, не долетевший до
 * сервера, на следующей сессии перезатрётся дефолтом (см. useAddressFormChoice.ts).
 */
export function AddressFormPicker({ onDone }: { onDone?: () => void } = {}) {
  const [show, setShow] = useState(false);
  const [round, setRound] = useState(0);

  useEffect(() => {
    api.getSettings()
      .then(s => { if (shouldAskAddressForm(s.addressForm)) setShow(true); else onDone?.(); })
      .catch(() => {
        // Вопрос не запирает вход: очередь идёт дальше, сбой уходит наверх (№14).
        reportClientError({ message: 'address picker: настройки не загрузились', section: 'appshell.bootstrap' });
        onDone?.();
      });
  }, [onDone]);

  // Запись листа сняла чужая навигация (navigate с replace после разбора ссылки
  // или бутстрапа) — человек не ответил: «спросили» не ставим, а открываем вопрос
  // заново новой записью (key). QA 2026-11: пикер закрывался сам, addressForm — null.
  function close(answered: boolean) {
    if (!answered) { setRound(r => r + 1); return; }
    markAddressFormAsked();
    setShow(false);
    onDone?.();
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
  const { failed, choose } = useAddressFormChoice(setForm, api.updateSettings, reportClientError, goBack);

  // Первый вопрос продукта: шапка-лист персика со знаком продукта («это мы»), два равных ответа —
  // плитки бумаги без заливки: до выбора ни один не выглядит выбранным (кольца автофокуса нет — Dialog).
  return (
    <Dialog label="Как удобнее общаться?" zIndex={300} onEscape={() => goBack()} maxWidth={480}>
      <EntryHead look={{ hue: ENTRY_HUE }} art={<EntryBrand />} title="Как удобнее общаться?" />
      <p className="sk-dialog-text ef-note">Поменять можно в любой момент в настройках.</p>
      <div className="ef-forms">
        <button type="button" className="pp-paper ef-form" style={hueStyle(ADDRESS_FORM_HUE.ty)} onClick={() => choose('ty')}>
          На «ты»
        </button>
        <button type="button" className="pp-paper ef-form" style={hueStyle(ADDRESS_FORM_HUE.vy)} onClick={() => choose('vy')}>
          На «вы»
        </button>
      </div>
      {failed && (
        <PaperAlert className="ef-alert" title="Не удалось сохранить выбор." text="Проверить соединение и попробовать ещё раз — или «Позже»." />
      )}
      <button type="button" className="ds-link ef-later" onClick={goBack}>
        Позже
      </button>
    </Dialog>
  );
}
