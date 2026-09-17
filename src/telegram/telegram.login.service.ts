// Вход в приложение через бота: человек жмёт «Войти через Telegram», попадает
// сюда по диплинку и подтверждает вход сверкой кода.
//
// Зачем не oauth.telegram.org. Тот путь при первом визите в конкретный браузер
// требует ввести телефон и код из Telegram — отдельный логин в Telegram Web,
// отсюда и жалоба «получается только со второй попытки». Он же держится на
// привязке домена через /setdomain в BotFather: привязка слетала и ломала вход
// у всех (инцидент 2026-08-21). Диплинк в бота не зависит ни от того, ни от
// другого, и работает из установленного приложения, куда куку внешнего
// браузера не занести.
//
// Почему сверка кода, а не молчаливое одобрение по /start. Ссылку `t.me/...`
// можно прислать кому угодно: нажав «старт», человек отдал бы сессию тому, кто
// эту ссылку сгенерировал. Поэтому бот показывает КОД, который человек видит
// на своём экране, и подпись устройства — подтверждение вслепую защищает не
// больше, чем его отсутствие. Тот же приём у GitHub device flow и Microsoft.
import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { Markup, Telegraf, Context } from 'telegraf';
import { TELEGRAF_BOT } from './telegram.constants';
import { BotService } from '../bot/bot.service';
import { AccountService } from '../bot/account.service';
import { LoginTicketService } from '../auth/login-ticket/login-ticket.service';
import { SecurityLogService } from '../auth/security-log.service';
import { resolveForm } from './telegram.reply-helpers';
import { formatUserCode, parseLoginCode } from './login-payload';
import { t, type AddressForm } from '../notification/address-form';
import { BadCodeCounter } from './bad-code-counter';
import { handleTicketDeny, withConfirmingUser } from './ticket-actions';

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

@Injectable()
export class TelegramLoginService implements OnModuleInit {
  private readonly logger = new Logger(TelegramLoginService.name);
  private readonly badCodes = new BadCodeCounter((telegramId) =>
    this.securityLog.log('login_ticket_denied', {
      telegramId,
      reason: 'too_many_bad_codes',
    }),
  );

  constructor(
    @Inject(TELEGRAF_BOT)
    @Optional()
    private readonly bot: Telegraf<Context> | null,
    private readonly ticketService: LoginTicketService,
    private readonly botService: BotService,
    private readonly accountService: AccountService,
    private readonly securityLog: SecurityLogService,
  ) {}

  /** Форма обращения по сырому telegramId — привязка общего помощника. */
  private form(rawId: number | undefined) {
    return resolveForm(this.accountService, this.botService, rawId);
  }

  onModuleInit(): void {
    if (!this.bot) return;

    this.bot.action(/^tglogin:yes:([A-Z0-9]{8})$/, async (ctx) => {
      try {
        await ctx.answerCbQuery();
        await withConfirmingUser(
          { accountService: this.accountService, logger: this.logger },
          ctx,
          'tglogin approve',
          async (code, userId) => {
            const form = await this.form(ctx.from?.id);
            await this.ticketService.approveLogin(code, userId);
            await ctx
              .editMessageText(
                t(
                  form,
                  '✅ Готово. Возвращайся в приложение — вход уже там.',
                  '✅ Готово. Возвращайтесь в приложение — вход уже там.',
                ),
              )
              .catch(() => null);
          },
        );
      } catch {
        await ctx
          .editMessageText(
            // Безлично: форма обращения читается из профиля, а сюда мы
            // попадаем в том числе когда прочитать её не удалось.
            'Не получилось подтвердить: код истёк или его уже использовали. ' +
              'Вход придётся начать заново.',
          )
          .catch(() => null);
      }
    });

    this.bot.action(/^tglogin:no:([A-Z0-9]{8})$/, async (ctx) => {
      try {
        await ctx.answerCbQuery();
        await handleTicketDeny(
          {
            tickets: this.ticketService,
            securityLog: this.securityLog,
            logger: this.logger,
          },
          ctx,
          ctx.match[1],
          'user_denied',
          'Вход отклонён — доступ никто не получил. Если такую ссылку ' +
            'кто-то прислал, лучше её больше не открывать.',
        );
      } catch (err) {
        this.logger.error(
          `tglogin:no failed: ${(err as Error).message}`,
          (err as Error).stack,
        );
      }
    });
  }

  /**
   * Ветка `/start login_<КОД>`. Вызывается из TelegramService — второго
   * обработчика той же команды у telegraf быть не может.
   */
  async handleStart(
    ctx: Context,
    payload: string,
    rawId: number,
  ): Promise<void> {
    const form = await this.form(rawId);
    const code = parseLoginCode(payload);
    const found = code ? await this.ticketService.forConfirm(code) : null;
    // Билет привязки, подставленный в ссылку входа, обязан выглядеть как
    // негодный код. Иначе человеку показали бы карточку ВХОДА, а нажатие
    // упало бы в approveLogin с «этот код не для входа» — соврали дважды:
    // сперва о смысле кода, потом о причине отказа.
    const card = found && found.intent === 'login' ? found : null;

    if (!card || !code) {
      this.badCodes.note(rawId);
      if (this.badCodes.tooMany(rawId)) return;
      await ctx.reply(
        t(
          form,
          'Код не найден или уже истёк. Открой приложение и начни вход заново.',
          'Код не найден или уже истёк. Откройте приложение и начните вход заново.',
        ),
      );
      return;
    }

    await ctx.reply(confirmText(form, code, card.deviceLabel), {
      parse_mode: 'HTML',
      ...confirmKeyboard(code),
    });
  }
}
