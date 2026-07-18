import { createContext, useContext } from 'react';

/**
 * Форма обращения к пользователю: «ты» или «вы».
 * Источник — settings.addressForm (null = ещё не выбрано → используем «ты»).
 * Провайдер (AddressFormProvider.tsx) грузит настройки; picker/настройки зовут
 * setForm для живого обновления тона без перезагрузки.
 */
export type AddressForm = 'ty' | 'vy';

export interface AddressFormCtx {
  form: AddressForm;
  setForm: (f: AddressForm) => void;
}

export const AddressFormContext = createContext<AddressFormCtx>({
  form: 'ty',
  setForm: () => {},
});

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
