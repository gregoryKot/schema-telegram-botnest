// Мини-тесты в боте: /tests и колбэки qz:*. Флоу полностью stateless —
// накопленные ответы едут в callback_data (`qz:q:<id>:<шаг>:<цифры>`),
// поэтому БД не нужна и тест доступен сразу, без онбординга.
import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { Context, Markup, Telegraf } from 'telegraf';
import { TELEGRAF_BOT, MINIAPP_URL } from './telegram.constants';
import { BotService } from '../bot/bot.service';
import { AnalyticsService } from '../analytics/analytics.service';
import {
  normalizeAddressForm,
  t,
  type AddressForm,
} from '../notification/address-form';
import { buildQuizzes, getQuiz } from '../quiz/quiz-registry';
import { computeQuizResult, isValidPicks } from '../quiz/quiz-logic';
import type { Quiz } from '../quiz/quiz.types';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

@Injectable()
export class TelegramQuizService implements OnModuleInit {
  private readonly logger = new Logger(TelegramQuizService.name);

  constructor(
    @Inject(TELEGRAF_BOT)
    @Optional()
    private readonly bot: Telegraf<Context> | null,
    private readonly botService: BotService,
    private readonly analytics: AnalyticsService,
  ) {}

  onModuleInit(): void {
    if (!this.bot) return;

    this.bot.command('tests', async (ctx) => {
      try {
        const form = await this.getForm(ctx.from?.id);
        const { text, keyboard } = this.listView(form);
        await ctx.reply(text, { parse_mode: 'HTML', ...keyboard });
      } catch (err) {
        this.logger.error('tests command failed', err);
      }
    });

    this.bot.action('qz:list', async (ctx) => {
      try {
        await ctx.answerCbQuery().catch(() => null);
        const form = await this.getForm(ctx.from?.id);
        const { text, keyboard } = this.listView(form);
        await this.show(ctx, text, keyboard);
      } catch (err) {
        this.logger.error('qz:list action failed', err);
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
          `${quiz.questions.length} вопросов · ~2 минуты`;
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('▶️ Начать', `qz:q:${quiz.id}:0:`)],
          [Markup.button.callback('← Все тесты', 'qz:list')],
        ]);
        await this.show(ctx, text, keyboard);
      } catch (err) {
        this.logger.error('qz:i action failed', err);
      }
    });

    // Шаг теста: n — номер вопроса, который надо показать; picks — уже
    // выбранные варианты (по цифре на вопрос). n === questions.length → финал.
    this.bot.action(/^qz:q:([a-z_]+):(\d):(\d{0,9})$/, async (ctx) => {
      try {
        await ctx.answerCbQuery().catch(() => null);
        const rawId = ctx.from?.id;
        const form = await this.getForm(rawId);
        const m = ctx.match as RegExpMatchArray;
        const quiz = getQuiz(form, m[1]);
        const n = Number(m[2]);
        const picks = [...m[3]].map(Number);
        if (!quiz || n !== picks.length || n > quiz.questions.length) {
          return this.stale(ctx);
        }
        if (!isValidPicks(quiz, picks)) return this.stale(ctx);

        if (n === 0 && rawId) {
          void this.analytics.track(BigInt(rawId), 'quiz_started', {
            quiz: quiz.id,
            src: 'bot',
          });
        }
        if (n === quiz.questions.length) {
          return await this.showResult(ctx, quiz, picks, form, rawId);
        }

        const q = quiz.questions[n];
        const text =
          `${quiz.emoji} <b>${esc(quiz.title)}</b> — вопрос ${n + 1} из ` +
          `${quiz.questions.length}\n\n${esc(q.text)}`;
        const keyboard = Markup.inlineKeyboard([
          ...q.options.map((o, idx) => [
            Markup.button.callback(
              o.label,
              `qz:q:${quiz.id}:${n + 1}:${m[3]}${idx}`,
            ),
          ]),
          [Markup.button.callback('⏹ Выйти из теста', 'qz:list')],
        ]);
        await this.show(ctx, text, keyboard);
      } catch (err) {
        this.logger.error('qz:q action failed', err);
      }
    });
  }

  private async showResult(
    ctx: Context,
    quiz: Quiz,
    picks: number[],
    form: AddressForm,
    rawId: number | undefined,
  ): Promise<void> {
    const r = computeQuizResult(quiz, picks);
    if (!r) return this.stale(ctx);
    if (rawId) {
      void this.analytics.track(BigInt(rawId), 'quiz_completed', {
        quiz: quiz.id,
        result: r.id,
        src: 'bot',
      });
    }
    const text =
      `${r.emoji} <b>${esc(r.title)}</b>\n\n${esc(r.text)}\n\n💡 ${esc(r.hint)}\n\n` +
      esc(
        t(
          form,
          'Это игра-наблюдение, а не диагноз. Хочешь глубже — в приложении есть большой тест схем.',
          'Это игра-наблюдение, а не диагноз. Хотите глубже — в приложении есть большой тест схем.',
        ),
      );
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🎲 Другие тесты', 'qz:list')],
      [Markup.button.webApp('🧠 Большой тест схем', MINIAPP_URL)],
    ]);
    await this.show(ctx, text, keyboard);
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
    const settings = await this.botService
      .getUserSettings(BigInt(rawId))
      .catch(() => null);
    return normalizeAddressForm(settings?.addressForm);
  }
}
