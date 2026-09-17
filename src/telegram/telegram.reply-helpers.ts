import { Markup } from 'telegraf';
import { MINIAPP_URL } from './telegram.constants';
import { BotService } from '../bot/bot.service';
import { AccountService } from '../bot/account.service';
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
export function pairJoinResultText(ok: boolean, form?: AddressForm): string {
  if (!ok) return 'Ссылка недействительна или уже использована.';
  return t(
    form,
    'Вы в паре! 🤝 Теперь будешь видеть индекс дня друг друга.',
    'Вы в паре! 🤝 Теперь будете видеть индекс дня друг друга.',
  );
}

/** Текст ретрая для accept:(ty|vy)/accept_consent — форма известна не всегда. */
export function acceptRetryText(form?: AddressForm): string {
  return t(
    form,
    'Что-то пошло не так. Попробуй нажать ещё раз.',
    'Что-то пошло не так. Попробуйте нажать ещё раз.',
  );
}

/**
 * Форма обращения по Telegram ID — для мест вне /settings (donate, therapist).
 * Номер приводим к каноническому: после слияния аккаунтов настройки человека
 * лежат под веб-номером, и чтение по сырому telegramId вернуло бы пусто, то
 * есть форму «ты» тому, кто выбрал «вы».
 */
export async function resolveForm(
  accountService: AccountService,
  botService: BotService,
  rawId: number | undefined,
): Promise<AddressForm> {
  if (!rawId) return normalizeAddressForm(undefined);
  const userId = await accountService.canonicalUserId(rawId);
  const s = await botService.getUserSettings(userId);
  return normalizeAddressForm(s?.addressForm);
}
