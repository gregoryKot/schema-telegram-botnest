/* eslint-disable react-refresh/only-export-components -- файл намеренно держит компонент рядом с его константами/хуками; вынос в отдельный файл — churn ради dev-only Fast Refresh, на прод-рантайм не влияет */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../api';

/**
 * Форма обращения к пользователю: «ты» или «вы».
 * Источник — settings.addressForm (null = ещё не выбрано → используем «ты»).
 * Провайдер сам грузит настройки; picker/настройки зовут setForm для живого
 * обновления тона без перезагрузки.
 */
export type AddressForm = 'ty' | 'vy';

interface Ctx {
  form: AddressForm;
  setForm: (f: AddressForm) => void;
}

const AddressFormContext = createContext<Ctx>({
  form: 'ty',
  setForm: () => {},
});

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

export function useAddressForm(): AddressForm {
  return useContext(AddressFormContext).form;
}

export function useSetAddressForm(): (f: AddressForm) => void {
  return useContext(AddressFormContext).setForm;
}

/** Хук-резолвер: const tr = useTr(); tr('ты-текст', 'вы-текст') */
export function useTr(): (ty: string, vy: string) => string {
  const form = useAddressForm();
  return (ty, vy) => (form === 'vy' ? vy : ty);
}

/** Чистый выбор для не-React мест (селекторы данных и т.п.) */
export function pickForm(
  form: AddressForm | null | undefined,
  ty: string,
  vy: string,
): string {
  return form === 'vy' ? vy : ty;
}
