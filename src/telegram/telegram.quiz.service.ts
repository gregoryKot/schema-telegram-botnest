// Мини-тесты в боте: /tests и колбэки qz:*. Бот показывает список и интро,
// сам тест проходят в приложении: ответы и результат в Telegram не уходят
// (РКН, #1135). Старые кнопки `qz:q:…` ведут туда же.
import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { Context, Markup, Telegraf } from 'telegraf';
import { TELEGRAF_BOT, APP_URL } from './telegram.constants';
import { failCallback } from './callback-failure';
import { registerGameCommand } from './game-command';
import { BotService } from '../bot/bot.service';
import { AccountService } from '../bot/account.service';
import {
  normalizeAddressForm,
  t,
  type AddressForm,
} from '../notification/address-form';
import { buildQuizzes, getQuiz } from '../quiz/quiz-registry';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const quizUrl = (id: string): string => `${APP_URL}/tests/${id}`;

@Injectable()
export class TelegramQuizService implements OnModuleInit {
  private readonly logger = new Logger(TelegramQuizService.name);

  constructor(
    @Inject(TELEGRAF_BOT)
    @Optional()
    private readonly bot: Telegraf<Context> | null,
    private readonly botService: BotService,
    // Адрес в Telegram и номер аккаунта расходятся после слияния: писать в БД
    // по сырому ctx.from.id нельзя, сначала спрашиваем владельца привязки.
    private readonly accountService: AccountService,
  ) {}

  onModuleInit(): void {
    if (!this.bot) return;

    registerGameCommand(this.bot, this.logger); // /game — соседняя «лёгкая» точка входа
    // 'test' — алиас: «/test» набирают не реже «/tests» (прод-скрин 2026-07-26).
    this.bot.command(['tests', 'test'], async (ctx) => {
      try {
        const form = await this.getForm(ctx.from?.id);
        const { text, keyboard } = this.listView(form);
        await ctx.reply(text, { parse_mode: 'HTML', ...keyboard });
      } catch (err) {
        await failCallback(this.logger, ctx, 'tests command', err);
      }
    });

    this.bot.action('qz:list', async (ctx) => {
      try {
        await ctx.answerCbQuery().catch(() => null);
        const form = await this.getForm(ctx.from?.id);
        const { text, keyboard } = this.listView(form);
        await this.show(ctx, text, keyboard);
      } catch (err) {
        await failCallback(this.logger, ctx, 'qz:list', err);
      }
    });

    this.bot.action(/^qz:i:([a-z_]+)$/, async (ctx) => {
      try {
        await ctx.answerCbQuery().catch(() => null);
        const form = await this.getForm(ctx.from?.id);
        const quiz = getQuiz(form, (ctx.match as RegExpMatchArray)[1]);
        if (!quiz) return this.stale(ctx);
        const text =
          `${quiz.emoji} <b>${esc(quiz.title)}</b>\n\n${esc(quiz.intro)}\n\n` +
          `${quiz.questions.length} вопросов · ~2 минуты. Ответы и результат — в приложении.`;
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.webApp('▶️ Пройти в приложении', quizUrl(quiz.id))],
          [Markup.button.callback('← Все тесты', 'qz:list')],
        ]);
        await this.show(ctx, text, keyboard);
      } catch (err) {
        await failCallback(this.logger, ctx, 'qz:i', err);
      }
    });

    // Кнопка старого сообщения (`qz:q:<id>:<шаг>:<ответы>`): ответы в боте
    // больше не принимаются и не разбираются — только отправляем в приложение.
    this.bot.action(/^qz:q:([a-z_]+):/, async (ctx) => {
      try {
        await ctx.answerCbQuery().catch(() => null);
        const form = await this.getForm(ctx.from?.id);
        const quiz = getQuiz(form, (ctx.match as RegExpMatchArray)[1]);
        if (!quiz) return this.stale(ctx);
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.webApp('▶️ Пройти в приложении', quizUrl(quiz.id))],
          [Markup.button.callback('← Все тесты', 'qz:list')],
        ]);
        await this.show(
          ctx,
          `${quiz.emoji} <b>${esc(quiz.title)}</b>\n\nТест теперь проходят в приложении.`,
          keyboard,
        );
      } catch (err) {
        await failCallback(this.logger, ctx, 'qz:q', err);
      }
    });
  }

  /** Экран списка тестов — точка входа /tests и колбэка qz:list. */
  private listView(form: AddressForm) {
    const quizzes = buildQuizzes(form);
    const text =
      `🎲 <b>Мини-тесты</b>\n\n` +
      esc(
        t(
          form,
          'Лёгкие тесты на пару минут — без регистрации и подготовки. Выбирай:',
          'Лёгкие тесты на пару минут — без регистрации и подготовки. Выбирайте:',
        ),
      ) +
      '\n\n' +
      quizzes
        .map((q) => `${q.emoji} ${esc(q.title)} — ${esc(q.teaser)}`)
        .join('\n');
    const keyboard = Markup.inlineKeyboard(
      quizzes.map((q) => [
        Markup.button.callback(`${q.emoji} ${q.title}`, `qz:i:${q.id}`),
      ]),
    );
    return { text, keyboard };
  }

  /** editMessageText с фолбэком в reply (сообщение могло устареть). */
  private async show(
    ctx: Context,
    text: string,
    keyboard: ReturnType<typeof Markup.inlineKeyboard>,
  ): Promise<void> {
    await ctx
      .editMessageText(text, { parse_mode: 'HTML', ...keyboard })
      .catch(() =>
        ctx.reply(text, { parse_mode: 'HTML', ...keyboard }).catch(() => null),
      );
  }

  private async stale(ctx: Context): Promise<void> {
    await ctx
      .editMessageText('Эта кнопка устарела. Открыть тесты заново: /tests')
      .catch(() => null);
  }

  private async getForm(rawId: number | undefined): Promise<AddressForm> {
    if (!rawId) return 'ty';
    // Форму обращения читаем у аккаунта-владельца привязки: после слияния
    // настройки лежат под веб-номером, а сырой telegramId ведёт в пустоту.
    const userId = await this.accountService.canonicalUserId(rawId);
    const settings = await this.botService
      .getUserSettings(userId)
      .catch((e) => (this.logger.warn('quiz getForm failed', e), null));
    return normalizeAddressForm(settings?.addressForm);
  }
}
