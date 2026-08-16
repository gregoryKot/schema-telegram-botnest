import { Markup } from 'telegraf';
import { MINIAPP_URL } from './telegram.constants';
import { BotService } from '../bot/bot.service';
import {
  AddressForm,
  normalizeAddressForm,
  t,
} from '../notification/address-form';

/** Единственная кнопка «Всё по схеме» — для мест без остальных кнопок welcome-экрана. */
export const MINIAPP_ONLY_KEYBOARD = Markup.inlineKeyboard([
  [Markup.button.webApp('🧠 Всё по схеме', MINIAPP_URL)],
]);

/** Текст результата пары — общий для /start?pair_ и resumePendingPair. */
export function pairJoinResultText(ok: boolean): string {
  return ok
    ? 'Вы в паре! 🤝 Теперь будете видеть индекс дня друг друга.'
    : 'Ссылка недействительна или уже использована.';
}

/** Текст ретрая для accept:(ty|vy)/accept_consent — форма известна не всегда. */
export function acceptRetryText(form?: AddressForm): string {
  return t(
    form,
    'Что-то пошло не так. Попробуй нажать ещё раз.',
    'Что-то пошло не так. Попробуйте нажать ещё раз.',
  );
}

/** Форма обращения по Telegram ID — для мест вне /settings (donate, therapist). */
export async function resolveForm(
  botService: BotService,
  rawId: number | undefined,
): Promise<AddressForm> {
  const s = rawId ? await botService.getUserSettings(BigInt(rawId)) : null;
  return normalizeAddressForm(s?.addressForm);
}
