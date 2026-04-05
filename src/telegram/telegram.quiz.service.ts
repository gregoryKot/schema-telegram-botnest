import { Injectable, OnModuleInit, Inject, Optional, Logger } from '@nestjs/common';
import { Telegraf, Context, Markup } from 'telegraf';
import { TELEGRAF_BOT, MINIAPP_URL } from './telegram.constants';

// Button labels must be ≤30 chars to fit on one line in Telegram mobile
const QUESTIONS = [
  {
    text: '😅 <b>Тест: какая терапия тебе подойдёт?</b>\n\n<b>1 / 4</b> — Ты злишься на коллегу. Что крутится в голове?',
    options: [
      { key: 'a', label: '📝 «Вот 5 причин, почему он неправ»' },
      { key: 'b', label: '👶 «Опять эта старая рана...»' },
      { key: 'c', label: '🌀 «Напоминает мне отца...»' },
      { key: 'd', label: '🌬 «Злость — просто ощущение»' },
    ],
  },
  {
    text: '😅 <b>2 / 4</b> — Идеальный вечер пятницы:',
    options: [
      { key: 'a', label: '📋 Книга + план на выходные' },
      { key: 'b', label: '📓 Дневник и самокопание' },
      { key: 'c', label: '🍷 Разговор о смысле жизни' },
      { key: 'd', label: '🕯 Ноль мыслей. Ноль планов.' },
    ],
  },
  {
    text: '😅 <b>3 / 4</b> — Психолог молчит 3 минуты. Ты:',
    options: [
      { key: 'a', label: '😬 Нервничаю — деньги тают' },
      { key: 'b', label: '🥺 Сам начинаю про детство' },
      { key: 'c', label: '🤨 Что он вообще наблюдает?' },
      { key: 'd', label: '🧘 Тоже молчу. Норм.' },
    ],
  },
  {
    text: '😅 <b>4 / 4</b> — Какую книгу купил бы прямо сейчас?',
    options: [
      { key: 'a', label: '🧠 «Думай медленно, решай быстро»' },
      { key: 'b', label: '💔 Что-то про детские травмы' },
      { key: 'c', label: '💭 «Толкование сновидений»' },
      { key: 'd', label: '🌿 «Сила настоящего момента»' },
    ],
  },
];

const RESULTS: Record<string, { title: string; emoji: string; text: string; note: string }> = {
  a: {
    title: 'Когнитивно-поведенческая терапия',
    emoji: '🧠',
    text: 'Ты практик — тебе нужны конкретные инструменты, домашние задания и измеримый прогресс. КПТ работает с мыслями и поведением, не уходит в дебри прошлого и даёт результат быстро.',
    note: 'Этот дневник сделан на основе схема-терапии — надстройки над КПТ. Попробуй, многое будет знакомым.',
  },
  b: {
    title: 'Схема-терапия',
    emoji: '🧩',
    text: 'Ты чувствуешь, что всё началось раньше — и хочешь разобраться в корнях. Схема-терапия объединяет КПТ, работу с Внутренним ребёнком и потребностями. Глубоко, но с практикой.',
    note: 'Этот дневник именно про это. Добро пожаловать домой 🙂',
  },
  c: {
    title: 'Психодинамическая терапия',
    emoji: '🌀',
    text: 'Тебя тянет к глубине и загадкам — бессознательное, сны, «почему я именно так реагирую». Психодинамика работает медленно, без заданий, через свободные ассоциации и отношения с терапевтом.',
    note: 'Дневник схем помогает замечать паттерны между сессиями — многие психодинамические терапевты это поддерживают.',
  },
  d: {
    title: 'АСТ / Гештальт',
    emoji: '🌿',
    text: 'Тебе важнее не понять, а почувствовать и принять. АСТ учит жить по ценностям, не воюя с мыслями. Гештальт — про тело, контакт и «здесь и сейчас». Оба подхода про свободу, не контроль.',
    note: 'Раздел Самопомощь в дневнике — упражнения именно в этом духе: безопасное место, письмо себе, принятие.',
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
          const counts: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
          for (const a of answers) counts[a] = (counts[a] ?? 0) + 1;
          const winner = (['a', 'b', 'c', 'd'] as const).reduce((m, k) => (counts[k] > counts[m] ? k : m), 'a' as string);
          const r = RESULTS[winner];
          const text = `${r.emoji} <b>${r.title}</b>\n\n${r.text}\n\n💡 <i>${r.note}</i>`;
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
