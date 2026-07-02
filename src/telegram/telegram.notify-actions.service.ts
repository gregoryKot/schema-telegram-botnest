import { Injectable, OnModuleInit, Inject, Optional, Logger } from '@nestjs/common';
import { Telegraf, Context, Markup } from 'telegraf';
import { TELEGRAF_BOT } from './telegram.constants';
import { BotService } from '../bot/bot.service';
import { NotificationCadenceService, CADENCE_LABELS } from '../notification/notification.cadence.service';
import { AddressForm, normalizeAddressForm, t } from '../notification/address-form';
import { buildWelcomeKeyboard, WELCOME_TEXT } from './telegram.service';

const WELCOME_TEXT_VY = WELCOME_TEXT.replace('Привет!', 'Здравствуйте!');

const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

function formatDay(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, day: 'numeric', month: 'numeric' }).formatToParts(d);
  const day = Number(parts.find((p) => p.type === 'day')?.value ?? d.getUTCDate());
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? d.getUTCMonth() + 1) - 1;
  return `${day} ${MONTHS[month]}`;
}

function pauseConfirmText(days: number, dateStr: string, form: AddressForm): string {
  if (days === 7) {
    return t(form,
      `Хорошо, неделю не пишу. Вернусь ${dateStr}. Если захочешь раньше — просто открой дневник, я пойму.`,
      `Хорошо, неделю не пишу. Вернусь ${dateStr}. Если захотите раньше — просто откройте дневник.`);
  }
  return t(form,
    `Хорошо, месяц тишины. Вернусь ${dateStr}. Дневник всё это время открыт — заходи когда угодно, без напоминаний.`,
    `Хорошо, месяц тишины. Вернусь ${dateStr}. Дневник всё это время открыт — заходите когда угодно, без напоминаний.`);
}

/**
 * Кнопки саморегуляции на напоминаниях: пауза / реже / сегодня не могу —
 * управление частотой в один тап, не заходя в настройки. Плюс выбор «ты/вы».
 */
@Injectable()
export class TelegramNotifyActionsService implements OnModuleInit {
  private readonly logger = new Logger(TelegramNotifyActionsService.name);

  constructor(
    @Inject(TELEGRAF_BOT) @Optional() private readonly bot: Telegraf<Context> | null,
    private readonly botService: BotService,
    private readonly cadenceService: NotificationCadenceService,
  ) {}

  private async userForm(userId: bigint): Promise<AddressForm> {
    const s = await this.botService.getUserSettings(userId);
    return normalizeAddressForm(s?.addressForm);
  }

  async onModuleInit() {
    if (!this.bot) return;

    // Выбор обращения при первом входе: addr:ty / addr:vy
    this.bot.action(/^addr:(ty|vy)$/, async (ctx) => {
      try {
        await ctx.answerCbQuery();
        const rawId = ctx.from?.id;
        if (!rawId) return;
        const form = (ctx.match as RegExpMatchArray)[1] as AddressForm;
        await this.botService.updateUserSettings(BigInt(rawId), { addressForm: form });
        const ack = t(form,
          'Договорились, на «ты». Поменять можно в любой момент в /settings.',
          'Договорились, на «вы». Поменять можно в любой момент в /settings.');
        await ctx.editMessageText(`${ack}\n\n${t(form, WELCOME_TEXT, WELCOME_TEXT_VY)}`, buildWelcomeKeyboard());
      } catch (err) {
        this.logger.error('addr action failed', err);
        await ctx.answerCbQuery('Не получилось сохранить. Попробуй ещё раз.').catch(() => null);
      }
    });

    // ⏸ Пауза → выбор срока (меняем только клавиатуру, текст сообщения остаётся)
    this.bot.action('notify:pause', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        await ctx.editMessageReplyMarkup(Markup.inlineKeyboard([
          [
            Markup.button.callback('Неделя', 'notify:pause:7'),
            Markup.button.callback('Месяц', 'notify:pause:30'),
          ],
          [Markup.button.callback('← Не сейчас', 'notify:pause:cancel')],
        ]).reply_markup);
      } catch (err) {
        this.logger.error('notify:pause failed', err);
        await ctx.answerCbQuery('Не получилось. Попробуй ещё раз.').catch(() => null);
      }
    });

    this.bot.action(/^notify:pause:(7|30)$/, async (ctx) => {
      try {
        await ctx.answerCbQuery('⏸ Пауза включена');
        const rawId = ctx.from?.id;
        if (!rawId) return;
        const userId = BigInt(rawId);
        const days = Number((ctx.match as RegExpMatchArray)[1]);
        const until = await this.cadenceService.pause(userId, days);
        const s = await this.botService.getUserSettings(userId);
        const tz = s?.notifyTimezone ?? 'Europe/Moscow';
        const form = normalizeAddressForm(s?.addressForm);
        await ctx.editMessageText(pauseConfirmText(days, formatDay(until, tz), form)).catch(() => null);
      } catch (err) {
        this.logger.error('notify:pause:days failed', err);
        await ctx.answerCbQuery('Не получилось поставить паузу.').catch(() => null);
      }
    });

    this.bot.action('notify:pause:cancel', async (ctx) => {
      try {
        await ctx.answerCbQuery('Ок, без паузы');
        await ctx.editMessageReplyMarkup(undefined).catch(() => null);
      } catch (err) {
        this.logger.error('notify:pause:cancel failed', err);
      }
    });

    // 🔕 Реже — ступень частоты вниз
    this.bot.action('notify:slower', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        const rawId = ctx.from?.id;
        if (!rawId) return;
        const userId = BigInt(rawId);
        const newLevel = await this.cadenceService.slower(userId);
        const form = await this.userForm(userId);
        const label = CADENCE_LABELS[newLevel];
        await ctx.editMessageText(
          t(form,
            `Понял, буду писать реже — ${label}. Если захочешь настроить точнее — это в /settings.`,
            `Понял, буду писать реже — ${label}. Если захотите настроить точнее — это в /settings.`),
        ).catch(() => null);
      } catch (err) {
        this.logger.error('notify:slower failed', err);
        await ctx.answerCbQuery('Не получилось сохранить.').catch(() => null);
      }
    });

    // «Сегодня не могу» — осознанный пропуск без последствий
    this.bot.action('notify:skip', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        const rawId = ctx.from?.id;
        if (!rawId) return;
        const userId = BigInt(rawId);
        await this.cadenceService.skipToday(userId);
        const form = await this.userForm(userId);
        await ctx.editMessageText(
          t(form,
            'Хорошо, сегодня пропускаем. Это не считается — завтра просто новый день.',
            'Хорошо, сегодня пропускаем. Это не считается — завтра просто новый день.'),
        ).catch(() => null);
      } catch (err) {
        this.logger.error('notify:skip failed', err);
        await ctx.answerCbQuery('Не получилось.').catch(() => null);
      }
    });
  }
}
