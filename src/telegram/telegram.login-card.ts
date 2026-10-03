// Карточка сверки входа в Telegram: текст и клавиатура. Чистые функции без
// Nest — вынесены из telegram.login.service.ts (правило №10).
import { Markup } from 'telegraf';
import { t, type AddressForm } from '../notification/address-form';
import { formatUserCode } from './ticket-code';

export function confirmText(
  form: AddressForm,
  code: string,
  deviceLabel: string,
): string {
  const device = deviceLabel ? `\nУстройство: ${deviceLabel}` : '';
  return (
    `🔐 <b>Вход в «Всё по схеме»</b>\n\n` +
    `Код на экране: <b>${formatUserCode(code)}</b>${device}\n\n` +
    t(
      form,
      'Совпадает с тем, что видишь в приложении? Тогда подтверждай. ' +
        'Не совпадает или вход начинал не ты — жми «Это не я».',
      'Совпадает с тем, что видите в приложении? Тогда подтверждайте. ' +
        'Не совпадает или вход начинали не вы — жмите «Это не я».',
    )
  );
}

export function confirmKeyboard(code: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Это я, войти', `tglogin:yes:${code}`)],
    [Markup.button.callback('Это не я', `tglogin:no:${code}`)],
  ]);
}
