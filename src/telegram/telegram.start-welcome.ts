// Хвост `/start`: гейт согласия, вопрос о форме обращения и само приветствие.
// Вынесено из telegram.service.ts — файл давно на потолке размера (правило
// №10), а этот кусок самостоятелен: он отвечает на один вопрос «что показать
// человеку, который пришёл в бота без особого повода».
import { Context } from 'telegraf';
import { BotService } from '../bot/bot.service';
import { BotAnalyticsService } from '../bot/bot.analytics.service';
import { ADDRESS_PROMPT, CONSENT_TEXT } from './telegram.consent-text';
import {
  buildAddressKeyboard,
  buildConsentKeyboard,
  buildWelcomeKeyboard,
} from './telegram.keyboards';

export interface StartWelcomeDeps {
  botService: BotService;
  analyticsService: BotAnalyticsService;
}

// Приветствия новичка здесь нет намеренно, и это не потеря: до него ветка
// никогда не доходила. Отсутствие настроек означает, что форма обращения не
// выбрана, а её вопрос стоит выше и возвращает раньше. Приветствие человек
// видит сразу после выбора формы — в обработчике accept:(ty|vy).

/** С какой серии дней показываем её в приветствии. */
const STREAK_FROM = 3;

export async function sendStartWelcome(
  deps: StartWelcomeDeps,
  ctx: Context,
  userId: bigint,
  existingSettings: { addressForm?: string | null } | null,
): Promise<void> {
  if (!(await deps.botService.hasAcceptedDisclaimer(userId))) {
    await ctx.reply(CONSENT_TEXT, buildConsentKeyboard());
    return;
  }
  // Форма обращения ещё не выбрана — спрашиваем до приветствия.
  if (!existingSettings?.addressForm) {
    await ctx.reply(ADDRESS_PROMPT, buildAddressKeyboard());
    return;
  }
  // Дальше только те, у кого настройки есть, — значит это возвращение.
  const streak = await deps.analyticsService.getConsecutiveDays(userId);
  const name = ctx.from?.first_name ? ` ${ctx.from.first_name}` : '';
  const streakLine =
    streak >= STREAK_FROM
      ? `\n🔥 Серия: ${streak} ${streak < 5 ? 'дня' : 'дней'} подряд`
      : '';
  await ctx.reply(
    `С возвращением${name}!${streakLine}`,
    buildWelcomeKeyboard(),
  );
}
