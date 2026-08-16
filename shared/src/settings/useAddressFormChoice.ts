// Общая логика сохранения выбора «ты»/«вы» при первом входе (правило №3).
//
// Инцидент: оба пикера глушили провал api.updateSettings (webapp — try/catch
// с пустым телом, miniapp — console.error) и закрывали диалог как успешный.
// Локальный setForm() уже переключал интерфейс, поэтому человек видел «вы»
// применённым — а на следующей сессии getSettings() возвращал addressForm:
// null, источник правды перезаписывал кэш обратно в «ты», и диалог
// показывался заново. Выбор, который пользователь явно сделал, никогда не
// долетал до БД — классическая ложь интерфейса.
//
// Хук общий для обоих фронтендов (по образцу useAuthFailureReport в
// shared/src/host/authFailureReport.ts): экран у пикеров разный (webapp —
// центр экрана, miniapp — bottom sheet), а состояние «сохраняем/не удалось»
// одно. `updateSettings`/`setForm`/`report` — свои для каждого пакета.
import { useCallback, useState } from 'react';

export type AddressForm = 'ty' | 'vy';

/** Секция для POST /api/client-errors — src/api/client-error-section.ts KNOWN. */
export const ADDRESS_FORM_SAVE_SECTION = 'addressForm';

export interface AddressFormChoiceState {
  /** Сохранение отказало — диалог остаётся открытым, показываем строку ошибки. */
  failed: boolean;
  /** Выбрать форму. onSaved зовётся ТОЛЬКО при успехе — закрывать диалог тут. */
  choose: (form: AddressForm) => void;
}

/**
 * `updateSettings` бросает при сетевом/серверном сбое — это единственный
 * контракт, который от него требуется здесь.
 */
export function useAddressFormChoice(
  setForm: (form: AddressForm) => void,
  updateSettings: (body: { addressForm: AddressForm }) => Promise<unknown>,
  report: (payload: { section: string; message: string }) => void,
  onSaved: (form: AddressForm) => void,
): AddressFormChoiceState {
  const [failed, setFailed] = useState(false);

  const choose = useCallback(
    (form: AddressForm) => {
      // Честно: интерфейс уже переключился на выбранную форму — текущая
      // сессия реально в ней, даже если сохранение на сервер ещё не удалось.
      setForm(form);
      setFailed(false);
      void updateSettings({ addressForm: form }).then(
        () => onSaved(form),
        () => {
          report({
            section: ADDRESS_FORM_SAVE_SECTION,
            message: 'address form save failed',
          });
          setFailed(true);
        },
      );
    },
    [setForm, updateSettings, report, onSaved],
  );

  return { failed, choose };
}
