import { Injectable, OnModuleInit, Inject, Optional, Logger } from '@nestjs/common';
import { Telegraf, Context, Markup } from 'telegraf';
import { TELEGRAF_BOT, MINIAPP_URL } from './telegram.constants';

const QUESTIONS = [
  {
    text: '🎯 <b>Тест: какой подход тебе подойдёт?</b>\n\n<b>Вопрос 1 / 4</b>\nКогда что-то идёт не так, ты скорее...',
    options: [
      { key: 'a', label: '🔍 Анализирую — что именно произошло?' },
      { key: 'b', label: '💪 Делаю что-то конкретное, чтобы стало лучше' },
      { key: 'c', label: '🤔 Хочу понять, почему это вообще происходит' },
      { key: 'd', label: '🤝 Ищу поддержку или хочу поговорить' },
    ],
  },
  {
    text: '🎯 <b>Вопрос 2 / 4</b>\nЧто тебе больше откликается?',
    options: [
      { key: 'a', label: '📓 Замечать, когда что-то внутри сработало' },
      { key: 'b', label: '📅 Выстраивать ритуалы и привычки' },
      { key: 'c', label: '📚 Читать про психологию и узнавать себя' },
      { key: 'd', label: '🫂 Чувствовать, что кто-то рядом' },
    ],
  },
  {
    text: '🎯 <b>Вопрос 3 / 4</b>\nТвой идеальный способ позаботиться о себе:',
    options: [
      { key: 'a', label: '✍️ Написать в дневник всё, что внутри' },
      { key: 'b', label: '🏃 Пробежаться, приготовить, сделать план' },
      { key: 'c', label: '🧩 Пройти тест, разобраться в паттернах' },
      { key: 'd', label: '💛 Побыть с близкими или в тепле' },
    ],
  },
  {
    text: '🎯 <b>Вопрос 4 / 4</b>\nЧто тебе обычно труднее всего?',
    options: [
      { key: 'a', label: '🧠 Не зависать в голове — просто быть' },
      { key: 'b', label: '😴 Позволить себе остановиться и отдохнуть' },
      { key: 'c', label: '❤️ Перестать искать объяснения и почувствовать' },
      { key: 'd', label: '🙏 Попросить о помощи и принять её' },
    ],
  },
];

const RESULTS: Record<string, { title: string; emoji: string; text: string; tip: string }> = {
  a: {
    title: 'Наблюдатель',
    emoji: '🔍',
    text: 'Тебе откликается осознанность — замечать, что происходит внутри, фиксировать паттерны и видеть, как ты реагируешь.',
    tip: 'Начни с дневников схем и режимов — там видно, что именно тебя триггерит и как ты привычно реагируешь.',
  },
  b: {
    title: 'Практик',
    emoji: '💪',
    text: 'Тебе важно делать конкретные вещи, а не только думать о них. Регулярность работает лучше, чем теория.',
    tip: 'Трекер потребностей — твоё место: ставишь практики, планируешь и видишь результат каждый день.',
  },
  c: {
    title: 'Исследователь',
    emoji: '🧩',
    text: 'Ты хочешь понять: откуда это всё взялось и как это называется? Знание помогает тебе меньше бояться.',
    tip: 'Пройди YSQ-тест — он покажет твои схемы. Потом загляни в колесо детства — станет понятнее, почему ты такой.',
  },
  d: {
    title: 'Связанный',
    emoji: '🤝',
    text: 'Для тебя важны отношения и тепло — к другим и к себе. Работа через заботу работает лучше, чем анализ.',
    tip: 'Попробуй письмо Уязвимому Ребёнку и упражнение «Безопасное место» — они в разделе Самопомощь.',
  },
};

@Injectable()
export class TelegramQuizService implements OnModuleInit {
  private readonly logger = new Logger(TelegramQuizService.name);
  private readonly progress = new Map<number, string[]>();

  constructor(
    @Inject(TELEGRAF_BOT) @Optional() private readonly bot: Telegraf<Context> | null,
  ) {}

  private buildQuestionKeyboard(qIndex: number) {
    return Markup.inlineKeyboard(
      QUESTIONS[qIndex].options.map(o => [Markup.button.callback(o.label, `quiz:${qIndex + 1}:${o.key}`)]),
    );
  }

  async onModuleInit() {
    if (!this.bot) return;

    this.bot.action('quiz:start', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        const userId = ctx.from?.id;
        if (!userId) return;
        this.progress.set(userId, []);
        await ctx.editMessageText(QUESTIONS[0].text, { parse_mode: 'HTML', ...this.buildQuestionKeyboard(0) } as any);
      } catch (err) {
        this.logger.error('quiz:start failed', err);
      }
    });

    this.bot.action(/^quiz:(\d):([abcd])$/, async (ctx) => {
      try {
        await ctx.answerCbQuery();
        const userId = ctx.from?.id;
        if (!userId) return;
        const qNum = Number((ctx.match as RegExpMatchArray)[1]);
        const answer = (ctx.match as RegExpMatchArray)[2];

        const answers = this.progress.get(userId) ?? [];
        answers.push(answer);
        this.progress.set(userId, answers);

        if (qNum < QUESTIONS.length) {
          await ctx.editMessageText(QUESTIONS[qNum].text, { parse_mode: 'HTML', ...this.buildQuestionKeyboard(qNum) } as any);
        } else {
          // Determine winner by frequency
          const counts: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
          for (const a of answers) counts[a] = (counts[a] ?? 0) + 1;
          const winner = (['a', 'b', 'c', 'd'] as const).reduce((m, k) => (counts[k] > counts[m] ? k : m), 'a' as string);
          const result = RESULTS[winner];
          const text = `${result.emoji} <b>Ты — ${result.title}</b>\n\n${result.text}\n\n💡 <i>${result.tip}</i>`;
          this.progress.delete(userId);
          await ctx.editMessageText(text, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [Markup.button.webApp('🧠 Открыть Схему', MINIAPP_URL)],
              [Markup.button.callback('⬅️ Главное меню', 'back:welcome')],
            ]),
          } as any);
        }
      } catch (err) {
        this.logger.error('quiz answer failed', err);
        await ctx.answerCbQuery().catch(() => null);
      }
    });
  }
}
