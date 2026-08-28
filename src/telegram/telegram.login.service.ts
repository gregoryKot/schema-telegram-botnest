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
import { LoginTicketService } from '../auth/login-ticket/login-ticket.service';
import { SecurityLogService } from '../auth/security-log.service';
import { resolveForm } from './telegram.reply-helpers';
import { formatUserCode, parseLoginCode } from './login-payload';
import { t, type AddressForm } from '../notification/address-form';

/** Сколько негодных кодов подряд терпим от одного человека до молчания. */
const MAX_BAD_CODES = 5;
const BAD_CODE_WINDOW_MS = 10 * 60_000;

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
  // Перебор короткого кода через чат маловероятен, но бесплатным быть не
  // должен: считаем промахи и замолкаем, а не отвечаем «не найден» бесконечно.
  private readonly badCodes = new Map<
    number,
    { count: number; until: number }
  >();

  constructor(
    @Inject(TELEGRAF_BOT)
    @Optional()
    private readonly bot: Telegraf<Context> | null,
    private readonly ticketService: LoginTicketService,
    private readonly botService: BotService,
    private readonly securityLog: SecurityLogService,
  ) {}

  onModuleInit(): void {
    if (!this.bot) return;

    this.bot.action(/^tglogin:yes:([A-Z0-9]{8})$/, async (ctx) => {
      try {
        await ctx.answerCbQuery();
        const code = ctx.match![1];
        const rawId = ctx.from?.id;
        if (!rawId) return;
        const form = await resolveForm(this.botService, rawId);
        await this.ticketService.approveLogin(code, BigInt(rawId));
        await ctx
          .editMessageText(
            t(
              form,
              '✅ Готово. Возвращайся в приложение — вход уже там.',
              '✅ Готово. Возвращайтесь в приложение — вход уже там.',
            ),
          )
          .catch(() => null);
      } catch (err) {
        this.logger.error(
          `tglogin approve failed: ${(err as Error).message}`,
          (err as Error).stack,
        );
        await ctx
          .editMessageText(
            'Не получилось подтвердить: код истёк или его уже использовали. ' +
              'Начните вход в приложении заново.',
          )
          .catch(() => null);
      }
    });

    this.bot.action(/^tglogin:no:([A-Z0-9]{8})$/, async (ctx) => {
      try {
        await ctx.answerCbQuery();
        const code = ctx.match![1];
        await this.ticketService.deny(code).catch(() => null);
        this.securityLog.log('login_ticket_denied', {
          telegramId: ctx.from?.id,
        });
        await ctx
          .editMessageText(
            'Вход отклонён. Доступ никто не получил. Если такую ссылку ' +
              'кто-то прислал — не открывайте её больше.',
          )
          .catch(() => null);
      } catch (err) {
        this.logger.error(
          `tglogin deny failed: ${(err as Error).message}`,
          (err as Error).stack,
        );
      }
    });
  }

  private tooManyBadCodes(rawId: number): boolean {
    const now = Date.now();
    const seen = this.badCodes.get(rawId);
    if (!seen || seen.until < now) return false;
    return seen.count >= MAX_BAD_CODES;
  }

  private noteBadCode(rawId: number): void {
    const now = Date.now();
    const seen = this.badCodes.get(rawId);
    const count = seen && seen.until >= now ? seen.count + 1 : 1;
    this.badCodes.set(rawId, { count, until: now + BAD_CODE_WINDOW_MS });
    if (count === MAX_BAD_CODES) {
      this.securityLog.log('login_ticket_denied', {
        telegramId: rawId,
        reason: 'too_many_bad_codes',
      });
    }
    // Карта не растёт бесконечно: протухшие записи выметаем на входе.
    if (this.badCodes.size > 1000) {
      for (const [id, v] of this.badCodes) {
        if (v.until < now) this.badCodes.delete(id);
      }
    }
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
    const form = await resolveForm(this.botService, rawId);
    const code = parseLoginCode(payload);
    const card = code ? await this.ticketService.forConfirm(code) : null;

    if (!card || !code) {
      this.noteBadCode(rawId);
      if (this.tooManyBadCodes(rawId)) return;
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
