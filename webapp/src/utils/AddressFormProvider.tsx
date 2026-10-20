import { type ReactNode } from 'react';
import { loadSettingsShared } from './settingsRequest';
import { AddressFormContext } from './addressForm';
import { useAddressFormValue } from '../../../shared/src/utils/addressFormCache';

/** Грузит форму обращения из настроек и раздаёт через контекст. */
export function AddressFormProvider({ children }: { children: ReactNode }) {
  // Вся логика формы (старт из кэша против «ты»-вспышки + подгрузка настроек) —
  // в общем shared-хуке; провайдер лишь прокидывает свой api.getSettings.
  const [form, setForm] = useAddressFormValue(() =>
    loadSettingsShared().then((s) => s.addressForm),
  );
  return (
    <AddressFormContext.Provider value={{ form, setForm }}>
      {children}
    </AddressFormContext.Provider>
  );
}
