import { useState, useCallback, useEffect, useRef } from 'react';

// Кэш выбранной формы обращения (ты/вы) в localStorage — единственная копия
// (правило №3 CLAUDE.md). Провайдер обоих фронтендов стартует с дефолта и лишь
// потом (async getSettings) узнаёт реальную форму — из-за этого вы-пользователь
// при каждом входе видел вспышку дефолтной формы. Кэш даёт синхронный старт в
// правильной форме; getSettings остаётся источником правды и перезапишет.
export type CachedAddressForm = 'ty' | 'vy';

const ADDRESS_FORM_KEY = 'address_form';

export function readCachedForm(): CachedAddressForm {
  try {
    return localStorage.getItem(ADDRESS_FORM_KEY) === 'vy' ? 'vy' : 'ty';
  } catch {
    return 'ty';
  }
}

export function cacheForm(form: CachedAddressForm): void {
  try {
    localStorage.setItem(ADDRESS_FORM_KEY, form);
  } catch {
    /* localStorage недоступен — не критично, сервер остаётся источником правды */
  }
}

/**
 * Форма обращения для AddressFormProvider обоих фронтендов (правило №3): старт
 * из кэша (нет вспышки дефолтной формы), запись кэша при каждом сете и подгрузка
 * формы из настроек (`loadForm`) — сервер остаётся источником правды. Провайдеры
 * лишь прокидывают свой `api.getSettings`, вся логика — здесь.
 */
export function useAddressFormValue(
  loadForm: () => Promise<CachedAddressForm | null | undefined>,
): [CachedAddressForm, (f: CachedAddressForm) => void] {
  const [form, setFormState] = useState<CachedAddressForm>(readCachedForm);
  const setForm = useCallback((f: CachedAddressForm) => {
    cacheForm(f);
    setFormState(f);
  }, []);
  const loadRef = useRef(loadForm);
  loadRef.current = loadForm;
  useEffect(() => {
    loadRef
      .current()
      .then((f) => {
        if (f === 'ty' || f === 'vy') setForm(f);
      })
      .catch(() => {});
  }, [setForm]);
  return [form, setForm];
}
