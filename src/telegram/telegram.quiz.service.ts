import { Injectable, OnModuleInit, Inject, Optional, Logger } from '@nestjs/common';
import { Telegraf, Context, Markup } from 'telegraf';
import { TELEGRAF_BOT, MINIAPP_URL } from './telegram.constants';

// 6 approaches, 5 questions × 6 options (a-f), winner by frequency
// Button labels ≤ 30 chars for single-line on mobile
const QUESTIONS = [
  {
    text: '😄 <b>Тест: какая терапия тебе подойдёт?</b>\n\n<b>1 / 5</b> — Злишься на коллегу. В голове:',
    options: [
      { key: 'a', label: '📝 «Он неправ — вот список причин»' },
      { key: 'b', label: '👶 «Опять та старая рана...»' },
      { key: 'c', label: '🌀 «Напоминает мне папу...»' },
      { key: 'd', label: '🌬 «Злость — просто ощущение»' },
      { key: 'e', label: '🎭 «Хочу выразить это прямо»' },
      { key: 'f', label: '🌡 «Сначала надо успокоиться»' },
    ],
  },
  {
    text: '😄 <b>2 / 5</b> — Идеальный вечер пятницы:',
    options: [
      { key: 'a', label: '📋 Книга + план на выходные' },
      { key: 'b', label: '📓 Дневник и самокопание' },
      { key: 'c', label: '🍷 Разговор о смысле жизни' },
      { key: 'd', label: '🧘 Медитация и тишина' },
      { key: 'e', label: '🎨 Что-то руками или телом' },
      { key: 'f', label: '💬 Группа поддержки' },
    ],
  },
  {
    text: '😄 <b>3 / 5</b> — Психолог молчит 3 минуты. Ты:',
    options: [
      { key: 'a', label: '😬 Нервничаю — деньги тают' },
      { key: 'b', label: '🥺 Сам начинаю про детство' },
      { key: 'c', label: '🤨 Что он вообще наблюдает?' },
      { key: 'd', label: '🧘 Тоже молчу. Всё ок.' },
      { key: 'e', label: '😮 Чувствую что-то в теле' },
      { key: 'f', label: '😤 «Давайте уже конкретнее»' },
    ],
  },
  {
    text: '😄 <b>4 / 5</b> — Какую книгу купил бы сейчас?',
    options: [
      { key: 'a', label: '🧠 Прикладное — с упражнениями' },
      { key: 'b', label: '💔 Про детские травмы' },
      { key: 'c', label: '💭 «Толкование сновидений»' },
      { key: 'd', label: '🌿 «Сила настоящего момента»' },
      { key: 'e', label: '🎭 Про тело, эмоции, контакт' },
      { key: 'f', label: '⚖️ Про эмоции и их регуляцию' },
    ],
  },
  {
    text: '😄 <b>5 / 5</b> — Чего ждёшь от терапии?',
    options: [
      { key: 'a', label: '🛠 Чтоб выдали инструкцию' },
      { key: 'b', label: '🔍 Понять, откуда я такой' },
      { key: 'c', label: '🌀 Копать до самого дна' },
      { key: 'd', label: '🕊 Меньше воевать с собой' },
      { key: 'e', label: '💃 Почувствовать себя живым' },
      { key: 'f', label: '🌊 Держаться на волнах' },
    ],
  },
];

const RESULTS: Record<string, { title: string; emoji: string; text: string; note: string }> = {
  a: {
    title: 'Когнитивно-поведенческая терапия (КПТ)',
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
    text: 'Тебя тянет к глубине — бессознательное, сны, «почему я именно так реагирую». Психодинамика работает медленно, через свободные ассоциации и отношения с терапевтом. Без заданий.',
    note: 'Дневник схем поможет замечать паттерны между сессиями — многие психодинамические терапевты это поддерживают.',
  },
  d: {
    title: 'АСТ (Acceptance & Commitment)',
    emoji: '🌿',
    text: 'Тебе важно не победить плохие мысли, а перестать с ними воевать. АСТ учит принимать, что есть, и действовать по ценностям — даже когда внутри неспокойно.',
    note: 'Упражнения «Безопасное место» и письмо себе в разделе Самопомощь сделаны в этой логике.',
  },
  e: {
    title: 'Гештальт-терапия',
    emoji: '🎭',
    text: 'Ты хочешь чувствовать, а не только понимать. Гештальт — про тело, про «здесь и сейчас», про прямой контакт. Меньше теории, больше переживания прямо на сессии.',
    note: 'Дневник режимов и дневник эмоций в этом приложении — ближе всего к гештальт-логике.',
  },
  f: {
    title: 'ДБТ (Диалектическая поведенческая)',
    emoji: '🌊',
    text: 'Тебе откликается идея держаться, даже когда накрывает. ДБТ — это про радикальное принятие, навыки регуляции эмоций и выживание в кризисе. Очень практично и без самообвинений.',
    note: 'Инструмент «Мне сейчас плохо» в разделе Самопомощь сделан именно для таких моментов.',
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

    this.bot.action(/^quiz:(\d+):([a-f])$/, async (ctx) => {
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
          const counts: Record<string, number> = { a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 };
          for (const a of answers) counts[a] = (counts[a] ?? 0) + 1;
          const winner = (['a', 'b', 'c', 'd', 'e', 'f'] as const).reduce((m, k) => (counts[k] > counts[m] ? k : m), 'a' as string);
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
