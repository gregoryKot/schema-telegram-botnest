/**
 * Форма обращения к пользователю: «ты» или «вы».
 * null/undefined в БД = ещё не выбрана → показываем выбор при первом входе,
 * а до тех пор используем «ты» (историческое поведение).
 */
export type AddressForm = 'ty' | 'vy';

export const DEFAULT_ADDRESS_FORM: AddressForm = 'ty';

export function normalizeAddressForm(value: unknown): AddressForm {
  return value === 'vy' ? 'vy' : 'ty';
}

/** Выбор текста по форме обращения: t(form, 'ты-вариант', 'вы-вариант') */
export function t(form: AddressForm | null | undefined, tyText: string, vyText: string): string {
  return form === 'vy' ? vyText : tyText;
}
