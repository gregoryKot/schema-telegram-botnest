import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../api';
import { AddressFormContext, type AddressForm } from './addressForm';

/** Грузит форму обращения из настроек и раздаёт через контекст. */
export function AddressFormProvider({ children }: { children: ReactNode }) {
  const [form, setForm] = useState<AddressForm>('ty');
  useEffect(() => {
    api
      .getSettings()
      .then((s) => {
        if (s.addressForm === 'ty' || s.addressForm === 'vy')
          setForm(s.addressForm);
      })
      .catch(() => {});
  }, []);
  return (
    <AddressFormContext.Provider value={{ form, setForm }}>
      {children}
    </AddressFormContext.Provider>
  );
}
