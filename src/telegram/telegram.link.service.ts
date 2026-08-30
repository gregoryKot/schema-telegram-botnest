// Ветка `/start link_<КОД>` — человек пришёл из САЙТА объединять аккаунты.
//
// Зеркало telegram.login.service.ts, но подтверждает другое: не «впустить в
// пустой контейнер», а «сделать этот аккаунт Telegram общим». Разные ветки,
// потому что разные последствия: вход отдаёт сессию, привязка ПЕРЕНОСИТ данные
// и уничтожает один из аккаунтов. Показать не ту карточку значит соврать
// человеку о том, что он подтверждает.
import {
  Inject,
  Injectable,
  Logger,
  Optional,
  OnModuleInit,
} from '@nestjs/common';
import { Markup, Telegraf, Context } from 'telegraf';
import { TELEGRAF_BOT } from './telegram.constants';
import { BotService } from '../bot/bot.service';
import { AccountService } from '../bot/account.service';
import { LoginTicketService } from '../auth/login-ticket/login-ticket.service';
import { TicketLinkService } from '../auth/login-ticket/ticket-link.service';
import { SecurityLogService } from '../auth/security-log.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { resolveForm } from './telegram.reply-helpers';
import { parseLinkCode } from './link-payload';
import { formatUserCode } from './ticket-code';
import { t, type AddressForm } from '../notification/address-form';
import { BadCodeCounter } from './bad-code-counter';
import { handleTicketDeny, withConfirmingUser } from './ticket-actions';

/** Сколько строк «что переедет» показываем, чтобы карточка осталась читаемой. */
const MAX_SUMMARY_ROWS = 4;

// Ключи — имена таблиц из USER_OWNED_TABLES, как их отдаёт merge.summarize.
// Показываем только то, что человек узнаёт: служебные строки (провайдеры
// входа, очередь уведомлений, события аналитики) ему ни о чём не говорят.
const SUMMARY_LABELS: Record<string, string> = {
  Rating: 'Оценки',
  Note: 'Заметки',
  SchemaDiaryEntry: 'Дневник схем',
  ModeDiaryEntry: 'Дневник режимов',
  GratitudeDiaryEntry: 'Дневник благодарности',
  UserSchemaNote: 'Карточки схем',
  UserModeNote: 'Карточки режимов',
  UserLetter: 'Письма',
  UserFlashcard: 'Карточки',
  PracticePlan: 'Планы практик',
  PracticeSession: 'Практики',
  YsqResult: 'Результаты теста',
  ChildhoodRating: 'Детские потребности',
};

/** «Оценки — 87, Дневник схем — 14» из сводки переноса. */
export function summaryLine(summary: Record<string, number>): string {
  const rows = Object.entries(summary)
    .filter(([key, n]) => n > 0 && SUMMARY_LABELS[key])
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_SUMMARY_ROWS)
    .map(([key, n]) => `${SUMMARY_LABELS[key]} — ${n}`);
  return rows.join(', ');
}

export function linkConfirmText(
  form: AddressForm,
  code: string,
  deviceLabel: string,
  summary: Record<string, number>,
): string {
  const device = deviceLabel ? `\nОткуда: ${deviceLabel}` : '';
  const moving = summaryLine(summary);
  const movingLine = moving ? `\n\nЧто переедет: ${moving}` : '';
  return (
    `🔗 <b>Объединить аккаунты</b>\n\n` +
    `Код на экране: <b>${formatUserCode(code)}</b>${device}${movingLine}\n\n` +
    t(
      form,
      'Там открыто приложение под другим входом. Подтвердишь — записи оттуда ' +
        'переедут сюда, и дальше всё будет в одном месте.\n\n' +
        'Подтверждай, только если код виден у тебя на экране прямо сейчас. ' +
        'Код прислали со стороны — жми «Это не я».',
      'Там открыто приложение под другим входом. Подтвердите — записи оттуда ' +
        'переедут сюда, и дальше всё будет в одном месте.\n\n' +
        'Подтверждайте, только если код виден у вас на экране прямо сейчас. ' +
        'Код прислали со стороны — жмите «Это не я».',
    )
  );
}

export function linkKeyboard(code: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Это я, объединить', `tglink:yes:${code}`)],
    [Markup.button.callback('Это не я', `tglink:no:${code}`)],
  ]);
}

@Injectable()
export class TelegramLinkService implements OnModuleInit {
  private readonly logger = new Logger(TelegramLinkService.name);
  private readonly badCodes = new BadCodeCounter((telegramId) =>
    this.securityLog.log('login_ticket_denied', {
      telegramId,
      reason: 'too_many_bad_link_codes',
    }),
  );

  constructor(
    @Inject(TELEGRAF_BOT)
    @Optional()
    private readonly bot: Telegraf<Context> | null,
    private readonly ticketService: LoginTicketService,
    private readonly links: TicketLinkService,
    private readonly botService: BotService,
    private readonly accountService: AccountService,
    private readonly securityLog: SecurityLogService,
    private readonly analytics: AnalyticsService,
  ) {}

  /** Форма обращения по сырому telegramId — привязка общего помощника. */
  private form(rawId: number | undefined) {
    return resolveForm(this.accountService, this.botService, rawId);
  }

  private notFound(form: AddressForm): string {
    return t(
      form,
      'Код не найден или уже истёк. Открой приложение и начни заново.',
      'Код не найден или уже истёк. Откройте приложение и начните заново.',
    );
  }

  onModuleInit(): void {
    if (!this.bot) return;

    this.bot.action(/^tglink:yes:([A-Z0-9]{8})$/, async (ctx) => {
      try {
        await ctx.answerCbQuery();
        await withConfirmingUser(
          { accountService: this.accountService, logger: this.logger },
          ctx,
          'tglink approve',
          async (code, userId) => {
            const form = await this.form(ctx.from?.id);
            const { merged } = await this.links.approve(code, userId);
            // Событие пишет сервер: подтверждение произошло здесь, а сайт
            // узнаёт об исходе только опросом и поля `merged` не видит.
            void this.analytics.track(userId, 'account_link_confirmed', {
              host: 'web',
              merged,
            });
            await ctx
              .editMessageText(
                t(
                  form,
                  '✅ Готово. Возвращайся на сайт — данные уже вместе.',
                  '✅ Готово. Возвращайтесь на сайт — данные уже вместе.',
                ),
              )
              .catch(() => null);
          },
        );
      } catch {
        // Причина уже в логе (withConfirmingUser её пишет и пробрасывает),
        // а человеку нужен исход: молчание после нажатия читается как
        // «наверное, получилось».
        await ctx
          .editMessageText(
            // Безлично: форма обращения читается из профиля, а сюда мы
            // попадаем в том числе когда прочитать её не удалось.
            'Не получилось объединить: код истёк или его уже использовали. ' +
              'Начать придётся заново — данные при этом не пострадали.',
          )
          .catch(() => null);
      }
    });

    this.bot.action(/^tglink:no:([A-Z0-9]{8})$/, async (ctx) => {
      try {
        await ctx.answerCbQuery();
        await handleTicketDeny(
          this.denyDeps(),
          ctx,
          ctx.match[1],
          'user_denied_link',
          'Объединение отклонено — доступ никто не получил. ' +
            'Если такую ссылку кто-то прислал, лучше её больше не открывать.',
        );
      } catch (err) {
        this.logger.error(
          `tglink:no failed: ${(err as Error).message}`,
          (err as Error).stack,
        );
      }
    });
  }

  private denyDeps() {
    return {
      tickets: this.ticketService,
      securityLog: this.securityLog,
      logger: this.logger,
    };
  }

  /**
   * Ветка `/start link_<КОД>`. Вызывается из TelegramService — второго
   * обработчика той же команды у telegraf быть не может.
   */
  async handleStart(
    ctx: Context,
    payload: string,
    rawId: number,
  ): Promise<void> {
    const form = await this.form(rawId);
    const code = parseLinkCode(payload);
    const found = code ? await this.ticketService.forConfirm(code) : null;
    // Билет ВХОДА, подставленный в ссылку привязки, обязан выглядеть как
    // негодный код: иначе человек подтверждал бы перенос данных там, где на
    // деле открывается чужая сессия.
    const card = found && found.intent === 'link' ? found : null;

    if (!card || !code) {
      this.badCodes.note(rawId);
      if (this.badCodes.tooMany(rawId)) return;
      await ctx.reply(this.notFound(form));
      return;
    }

    const userId = await this.accountService.canonicalUserId(rawId);
    const preview = await this.links.preview(code, userId);
    await ctx.reply(
      linkConfirmText(form, code, card.deviceLabel, preview.summary),
      { parse_mode: 'HTML', ...linkKeyboard(code) },
    );
  }
}
