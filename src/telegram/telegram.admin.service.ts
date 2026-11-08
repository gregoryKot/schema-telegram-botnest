// Админская консоль бота (/stats, /zv, /testdonate, /zayavki, /broadcast +
// инлайн-кнопки заявок терапевтов), вынесена из TelegramService по правилу
// №10 (лимит размера файла). Все хендлеры защищены проверкой ADMIN_ID.
import {
  Injectable,
  OnModuleInit,
  Inject,
  Optional,
  Logger,
} from '@nestjs/common';
import { Telegraf, Context } from 'telegraf';
import { TELEGRAF_BOT } from './telegram.constants';
import { failCallback } from './callback-failure';
import { describeTelegramError } from './telegram-error';
import { BroadcastRunner } from './telegram.broadcast-runner';
import { ZvRunner } from './zv-runner';
import { renderTemplate } from '../notification/notification.templates';
import { BotAdminStatsService } from '../bot/bot.admin-stats.service';
import { StatsReportService } from '../bot/stats-report.service';
import { HealthyAdultService } from '../bot/healthy-adult.service';
import { registerStatsHandlers } from './stats-command';
import { AccountService } from '../bot/account.service';
import { TherapistRequestService } from '../therapy/therapist-request.service';
import { ChannelPublisherService } from '../channel/channel-publisher.service';
import { ChannelCheckService } from '../channel/channel-check.service';
import { adminIdNum, isAdminSender } from '../utils/admin-alert';

@Injectable()
export class TelegramAdminService implements OnModuleInit {
  private readonly logger = new Logger(TelegramAdminService.name);
  readonly broadcast = new BroadcastRunner(); // фоном: telegram.broadcast-runner.ts
  readonly zv = new ZvRunner(); // /zv фоном: zv-runner.ts

  constructor(
    @Inject(TELEGRAF_BOT)
    @Optional()
    private readonly bot: Telegraf<Context> | null,
    private readonly adminStatsService: BotAdminStatsService,
    private readonly statsReport: StatsReportService,
    private readonly healthyAdult: HealthyAdultService,
    private readonly accountService: AccountService,
    private readonly therapistRequestService: TherapistRequestService,
    private readonly publisher: ChannelPublisherService,
    private readonly channelCheck: ChannelCheckService,
  ) {}

  onModuleInit() {
    if (!this.bot) return;

    // Admin-only: preview the monthly donate reminder immediately (the real one
    // fires 1st of each month). Lets us verify text + button without waiting.
    this.bot.command('testdonate', async (ctx) => {
      try {
        if (!isAdminSender(ctx.from)) {
          await ctx.reply('⛔ Нет доступа');
          return;
        }
        const t = renderTemplate('donate_reminder', { seed: 0 });
        await ctx.reply(
          t?.text ?? 'Шаблон donate_reminder не собрался — превью нет.',
          t?.keyboard ? { reply_markup: t.keyboard.reply_markup } : {},
        );
      } catch (err) {
        // Админу — причина: превью и нужно, чтобы увидеть отказ до рассылки.
        this.logger.error('testdonate command failed', err);
        await ctx
          .reply(`❌ Превью не отправилось: ${describeTelegramError(err)}`)
          .catch(() => null);
      }
    });

    registerStatsHandlers(
      this.bot,
      {
        adminStats: this.adminStatsService,
        statsReport: this.statsReport,
        healthyAdult: this.healthyAdult,
      },
      this.logger,
    );

    // Ручная публикация фразы «Здорового Взрослого» по всем настроенным
    // площадкам — проверка связки (env + права бота), т.к. по расписанию пост
    // выходит утром/вечером в случайную минуту, а сразу после настройки — нет.
    this.bot.command('zv', async (ctx) => {
      try {
        if (!isAdminSender(ctx.from)) {
          await ctx.reply('⛔ Нет доступа');
          return;
        }
        // `/zv max` — проверка одной площадки: обычный /zv разошлёт настоящий
        // пост всем подписчикам сразу, а свежеподключённую площадку надо
        // проверять молча для остальных.
        const only = ctx.message.text.split(/\s+/)[1];
        // `/zv log` — журнал последних отправок: кто, куда и с каким исходом.
        // Раньше ответ на «почему утром пришло не всё» жил только в логах
        // хостинга (инцидент 2026-07-31).
        if (only === 'log') {
          await ctx.reply(await this.channelCheck.log());
          return;
        }
        // Фоном (E16): публикация длится дольше, чем можно держать бота.
        // Флаг «в полёте» — общий с расписанием (zv-runner.ts).
        const refused = this.zv.start(
          () =>
            only ? this.channelCheck.checkOne(only) : this.publisher.publish(),
          (text) => ctx.reply(text),
          this.logger,
          this.publisher.inFlight,
        );
        if (refused) await ctx.reply(refused);
      } catch (err) {
        this.logger.error('zv command failed', err);
        await ctx.reply(`❌ ${String(err).slice(0, 300)}`).catch(() => null);
      }
    });

    // ─── Therapist-request admin callbacks ──────────────────────────────────
    // (resumePendingPair — приватный метод TelegramService, общий для обоих
    // consent-хендлеров там же; к этому файлу отношения не имеет.)
    // Inline buttons attached to admin notification messages. Only the admin
    // ID may trigger these.
    this.bot.action(/^treq:(approve|reject):(\d+)$/, async (ctx) => {
      try {
        const adminId = adminIdNum();
        if (!adminId || ctx.from?.id !== adminId) {
          await ctx.answerCbQuery('Только админ');
          return;
        }
        const match = ctx.match as RegExpMatchArray;
        const action = match[1] as 'approve' | 'reject';
        const reqId = parseInt(match[2], 10);
        // answerCbQuery ДО обращения к БД — иначе при зависшем approve/reject
        // Telegram крутит вечный спиннер на кнопке (правило CLAUDE.md).
        await ctx.answerCbQuery(
          action === 'approve' ? '✅ Одобряю…' : '❌ Отклоняю…',
        );
        if (action === 'approve') {
          await this.therapistRequestService.approve(adminId, reqId);
          await ctx.editMessageReplyMarkup(undefined).catch(() => null);
          await ctx.reply(`Заявка #${reqId} одобрена`);
        } else {
          // Reject without reason in the inline-button path; for a reason
          // admin should reply to the notification with "/reject <id> <reason>".
          await this.therapistRequestService.reject(adminId, reqId, '');
          await ctx.editMessageReplyMarkup(undefined).catch(() => null);
          await ctx.reply(`Заявка #${reqId} отклонена`);
        }
      } catch (err) {
        await failCallback(this.logger, ctx, 'treq action', err);
      }
    });

    // Фолбэк-доступ к заявкам на роль терапевта: если пуш-уведомление не дошло
    // (напр. после переезда бота), админ всё равно видит и обрабатывает заявки.
    this.bot.command('zayavki', async (ctx) => {
      try {
        const adminId = adminIdNum();
        if (!adminId || ctx.from?.id !== adminId) {
          await ctx.reply('Только админ');
          return;
        }
        const esc = (s: string) =>
          s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        type PendingReq = {
          id: number;
          userId: bigint;
          fullName: string;
          qualification: string;
          contacts: string;
          message: string | null;
        };
        const pending = (await this.therapistRequestService.listPending(
          adminId,
        )) as PendingReq[];
        if (pending.length === 0) {
          await ctx.reply('Заявок на роль терапевта нет.');
          return;
        }
        for (const req of pending) {
          const text =
            `🩺 <b>Заявка #${req.id}</b>\n\n` +
            `<b>Имя:</b> ${esc(req.fullName)}\n` +
            `<b>Квалификация:</b> ${esc(req.qualification)}\n` +
            `<b>Контакты:</b> ${esc(req.contacts)}\n` +
            (req.message ? `<b>Сообщение:</b> ${esc(req.message)}\n` : '') +
            `<b>Telegram ID:</b> <code>${req.userId}</code>`;
          await ctx.reply(text, {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '✅ Approve',
                    callback_data: `treq:approve:${req.id}`,
                  },
                  { text: '❌ Reject', callback_data: `treq:reject:${req.id}` },
                ],
              ],
            },
          });
        }
      } catch (err) {
        this.logger.error(`zayavki command failed: ${(err as Error).message}`);
        await ctx.reply('Ошибка при получении заявок').catch(() => null);
      }
    });

    this.bot.command('broadcast', async (ctx) => {
      try {
        if (!isAdminSender(ctx.from)) {
          await ctx.reply('⛔ Нет доступа');
          return;
        }
        const text = (ctx.message as { text?: string } | undefined)?.text
          ?.slice('/broadcast '.length)
          .trim();
        if (!text) {
          await ctx.reply('Укажи текст: /broadcast <сообщение>');
          return;
        }
        const userIds = await this.accountService.getBroadcastUserIds();
        // Адрес в Telegram — не то же самое, что userId: у входа через Google,
        // почту и MAX он лежит в веб-диапазоне, и после слияния аккаунтов тоже.
        // Раньше рассылка слала прямо по userId и каждый её прогон молча метил
        // таких людей botBlockedAt.
        const chatIds = await this.accountService.telegramIdsFor(userIds);
        const started = this.broadcast.start(
          {
            bot: this.bot!,
            accountService: this.accountService,
            logger: this.logger,
          },
          userIds,
          chatIds,
          text,
          (m) => ctx.reply(m),
        );
        if (!started)
          await ctx.reply('⏳ Предыдущая рассылка ещё идёт, итог придёт сюда');
      } catch (err) {
        this.logger.error('broadcast command failed', err);
        await ctx.reply('❌ Ошибка рассылки').catch(() => null);
      }
    });
  }
}
