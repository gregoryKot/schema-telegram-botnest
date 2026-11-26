import { useMemo } from 'react';
import { AddressFormContext } from '../../utils/addressForm';
import { readCachedForm } from '../../../../shared/src/utils/addressFormCache';
import { LoginPage } from '../LoginPage';

/** /login стоит вне AddressFormProvider (настроек до входа нет), поэтому форма
 *  обращения — из кэша прошлого входа; без кэша — дефолт контекста.
 *  setForm — заглушка: переключателя формы на входе нет. */
export function LoginRoute() {
  const value = useMemo(() => ({ form: readCachedForm(), setForm: () => {} }), []);
  return (
    <AddressFormContext.Provider value={value}>
      <LoginPage />
    </AddressFormContext.Provider>
  );
}
