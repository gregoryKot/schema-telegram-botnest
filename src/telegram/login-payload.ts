// `/start login_<КОД>` — прежняя ссылка «Войти через Telegram» с сайта.
//
// Вход на сайт через Telegram убран в 2026-11 (запрос Роскомнадзора:
// пользователей из России нельзя авторизовать через иностранный сервис). Бот
// вход не подтверждает, но ссылка ещё доедет из старой сборки приложения:
// говорим, куда идти, и показываем обычное приветствие.
import { t, type AddressForm } from '../notification/address-form';
import { hasPrefix } from './ticket-code';

/** true — payload прежней ссылки входа (любой, код не разбирается). */
export const isLoginPayload = (payload: string | undefined): boolean =>
  hasPrefix(payload, 'login_');

export function loginClosedText(form: AddressForm): string {
  return t(
    form,
    'Вход на сайт через Telegram закрыт. Открой приложение здесь, в боте: ' +
      'в «Аккаунте» добавь почту, Яндекс ID или VK ID — и входи ими на сайте. Записи на месте.',
    'Вход на сайт через Telegram закрыт. Откройте приложение здесь, в боте: ' +
      'в «Аккаунте» добавьте почту, Яндекс ID или VK ID — и входите ими на сайте. Записи на месте.',
  );
}
