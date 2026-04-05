import { Injectable, OnModuleInit, Inject, Optional, Logger } from '@nestjs/common';
import { Telegraf, Context, Markup } from 'telegraf';
import { TELEGRAF_BOT, MINIAPP_URL } from './telegram.constants';

const QUESTIONS = [
  {
    text: '🎯 <b>Тест: какой терапевтический подход тебе подойдёт?</b>\n\n<b>Вопрос 1 / 4</b>\nКогда тебе плохо — что обычно хочется сделать?',
    options: [
      { key: 'a', label: 'Разобраться, какая мысль за этим стоит, и проверить её' },
      { key: 'b', label: 'Понять, откуда эта рана — когда и почему появилась' },
      { key: 'c', label: 'Копнуть глубже — что это вообще значит на самом деле' },
      { key: 'd', label: 'Просто побыть с этим, не убегать и не анализировать' },
    ],
  },
  {
    text: '🎯 <b>Вопрос 2 / 4</b>\nЧто тебе кажется главным в работе над собой?',
    options: [
      { key: 'a', label: 'Конкретные техники — думать иначе, действовать иначе' },
      { key: 'b', label: 'Понять свои паттерны и потребности, которые за ними стоят' },
      { key: 'c', label: 'Разобраться в отношениях — с родителями, с собой, с другими' },
      { key: 'd', label: 'Перестать бороться с собой и начать жить по-настоящему' },
    ],
  },
  {
    text: '🎯 <b>Вопрос 3 / 4</b>\nКакое описание тебе ближе всего?',
    options: [
      { key: 'a', label: 'Мои проблемы — это во многом привычки мышления, которые можно изменить' },
      { key: 'b', label: 'Всё началось в детстве — там что-то не додали или перекрыло' },
      { key: 'c', label: 'Я и сам не понимаю, почему так реагирую — что-то бессознательное' },
      { key: 'd', label: 'Я слишком много думаю и слишком мало чувствую и живу' },
    ],
  },
  {
    text: '🎯 <b>Вопрос 4 / 4</b>\nЧего ты ждёшь от работы с психологом?',
    options: [
      { key: 'a', label: 'Инструментов: как справляться, как думать по-другому' },
      { key: 'b', label: 'Понимания: кто я, откуда мои паттерны, что мне реально нужно' },
      { key: 'c', label: 'Глубины: медленно, честно, до самого дна' },
      { key: 'd', label: 'Свободы: перестать контролировать и начать доверять себе' },
    ],
  },
];

const RESULTS: Record<string, { title: string; emoji: string; text: string; note: string }> = {
  a: {
    title: 'Когнитивно-поведенческая терапия (КПТ)',
    emoji: '🧠',
    text: 'Тебе подходит структурированный, доказательный подход. КПТ работает с конкретными мыслями и поведением: домашние задания, эксперименты, измеримые результаты. Краткосрочно и прагматично.',
    note: 'Этот дневник создан по принципам схема-терапии — надстройки над КПТ. Попробуй — многое покажется знакомым.',
  },
  b: {
    title: 'Схема-терапия',
    emoji: '🧩',
    text: 'Твой запрос — понять корни своих паттернов и изменить их через работу с потребностями. Схема-терапия объединяет КПТ, психодинамику и работу с Внутренним ребёнком. Долго, но глубоко.',
    note: 'Этот дневник именно для этого. Трекер потребностей, схемы, режимы — всё здесь.',
  },
  c: {
    title: 'Психодинамическая терапия / психоанализ',
    emoji: '🌀',
    text: 'Тебя привлекает глубина — бессознательное, ранние отношения, то, что не осознаётся. Психодинамика работает медленно, без домашних заданий, через свободные ассоциации и перенос.',
    note: 'Дневник схем может помочь замечать паттерны между сессиями — многие психодинамические терапевты это поддерживают.',
  },
  d: {
    title: 'АСТ / Гештальт',
    emoji: '🌿',
    text: 'Тебе важнее не понять, а почувствовать и принять. АСТ учит не воевать с мыслями и действовать по ценностям. Гештальт — работа через тело, контакт, «здесь и сейчас». Оба подхода про свободу, а не контроль.',
    note: 'Раздел Самопомощь в дневнике — упражнения в этом духе: письмо ребёнку, безопасное место, принятие.',
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
