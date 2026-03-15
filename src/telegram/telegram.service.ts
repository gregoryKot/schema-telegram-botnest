import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Optional, Logger } from '@nestjs/common';
import { Telegraf, Context, Markup } from 'telegraf';
import { TELEGRAF_BOT } from './telegram.constants';
import { BotService, NeedId, NEED_IDS } from '../bot/bot.service';

const CHANNEL = '@SchemeHappens';
const BOOKING_URL = 'https://cal.com/kotlarewski';

const WELCOME_TEXT = `Привет!

У каждого из нас есть 6 базовых групп эмоциональных потребностей. Когда они удовлетворены — нам хорошо. Когда нет — появляются тревога, усталость, раздражение.

Раз в день отмечай, насколько каждая потребность закрыта по шкале 0–10. Это помогает замечать паттерны и лучше понимать своё состояние.`;

const FAQ_MENU_TEXT = `📖 Подробнее — выбери тему:`;

const FAQ: Record<string, string> = {
  therapy: `🧠 Схематерапия

Схематерапия — метод, разработанный Джеффри Янгом. Она помогает разобраться, почему мы снова и снова попадаем в одни и те же ситуации — в отношениях, на работе, с собой.

В основе — идея о том, что в детстве у каждого из нас были базовые эмоциональные потребности. Если они не удовлетворялись, формируются схемы — устойчивые паттерны восприятия себя и мира, которые мешают жить так, как хочется.

Колесо потребностей помогает отслеживать, какие потребности сейчас закрыты, а какие — нет.`,

  attachment: `🤝 Безопасная привязанность

Потребность в безопасности, стабильности, заботе и принятии. Чувствовать, что рядом есть надёжные люди, что тебя любят и не бросят.

Когда не закрыта — тревога, недоверие, страх близости или, наоборот, цепляние за отношения.

Вопрос для рефлексии: чувствую ли я сегодня, что нахожусь в безопасности — в отношениях, в своей жизни?`,

  autonomy: `🚀 Автономия, компетентность и чувство идентичности

Потребность действовать самостоятельно, принимать решения, развиваться и ощущать себя способным. Знать, кто ты есть.

Когда не закрыта — беспомощность, зависимость от чужого мнения, потеря себя.

Вопрос для рефлексии: действовал ли я сегодня исходя из своих желаний? Есть ли ощущение, что я — это я?`,

  expression: `💬 Свобода выражать потребности и эмоции

Потребность свободно говорить о том, что чувствуешь и чего хочешь — без стыда и страха осуждения.

Когда не закрыта — подавленность, ощущение что тебя не слышат, накопленное напряжение.

Вопрос для рефлексии: мог ли я сегодня выразить то, что чувствую? Есть ли что-то невысказанное?`,

  play: `🎉 Спонтанность и игра

Потребность в радости, лёгкости, игривости. Делать что-то просто так — без цели и результата.

Когда не закрыта — серость, усталость, ощущение что живёшь на автопилоте.

Вопрос для рефлексии: было ли сегодня что-то лёгкое и радостное? Позволил ли я себе просто побыть?`,

  limits: `⚖️ Реалистичные границы и самоконтроль

Потребность в разумных границах — своих и чужих. Умение сдерживать импульсы и уважать договорённости.

Когда не закрыта — хаос, импульсивность, или наоборот — чрезмерная жёсткость к себе.

Вопрос для рефлексии: соблюдал ли я сегодня свои границы? Не было ли перегибов в ту или другую сторону?`,
};

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    @Inject(TELEGRAF_BOT) @Optional() private readonly bot: Telegraf<Context> | null,
    private readonly botService: BotService,
  ) {}

  private async editOrReply(ctx: Context, text: string, extra?: Parameters<Context['reply']>[1]) {
    try {
      await ctx.editMessageText(text, extra as any);
    } catch {
      await ctx.reply(text, extra);
    }
  }

  private buildWelcomeKeyboard() {
    return Markup.inlineKeyboard([
      [Markup.button.callback('✏️ Заполнить', 'back:needs')],
      [Markup.button.callback('📖 Подробнее', 'faq')],
    ]);
  }

  private buildFaqKeyboard() {
    const needs = this.botService.getNeeds();
    const needButtons = needs.map((n) => Markup.button.callback(n.title, `faq:${n.id}`));
    return Markup.inlineKeyboard([
      [Markup.button.callback('🧠 Схематерапия', 'faq:therapy')],
      needButtons.slice(0, 2),
      needButtons.slice(2, 4),
      needButtons.slice(4),
      [Markup.button.callback('⬅️ Назад', 'back:welcome')],
    ]);
  }

  private buildNeedsKeyboard() {
    const needs = this.botService.getNeeds();
    const buttons = needs.map((n) => Markup.button.callback(n.title, `need:${n.id}`));
    const rows: ReturnType<typeof Markup.button.callback>[][] = [];
    for (let i = 0; i < buttons.length; i += 2) {
      rows.push(buttons.slice(i, i + 2));
    }
    rows.push([Markup.button.callback('❌ Отмена', 'cancel')]);
    return Markup.inlineKeyboard(rows);
  }

  private buildRatingKeyboard(needId: NeedId) {
    const row1 = [0, 1, 2, 3, 4, 5].map((v) => Markup.button.callback(String(v), `rate:${needId}:${v}`));
    const row2 = [6, 7, 8, 9, 10].map((v) => Markup.button.callback(String(v), `rate:${needId}:${v}`));
    return Markup.inlineKeyboard([row1, row2, [Markup.button.callback('⬅️ Назад', 'back:needs')]]);
  }

  async onModuleInit() {
    if (!this.bot) {
      this.logger.warn('BOT_TOKEN not provided — bot will not start.');
      return;
    }

    this.bot.command('start', async (ctx) => {
      try {
        await ctx.reply(WELCOME_TEXT, this.buildWelcomeKeyboard());
      } catch (err) {
        this.logger.error('start command failed', err);
      }
    });

    this.bot.command('ping', async (ctx) => {
      try {
        await ctx.reply('OK');
      } catch (err) {
        this.logger.error('ping command failed', err);
      }
    });

    // Admin-only: post signup button to channel
    this.bot.command('post', async (ctx) => {
      try {
        const adminId = Number(process.env.ADMIN_ID);
        if (!adminId || ctx.from?.id !== adminId) {
          await ctx.reply('⛔ Нет доступа');
          return;
        }
        await this.bot!.telegram.sendMessage(
          CHANNEL,
          '📅 Запись на сессию — прямо по кнопке',
          {
            reply_markup: Markup.inlineKeyboard([
              Markup.button.url('📝 Записаться', BOOKING_URL),
            ]).reply_markup,
          },
        );
        await ctx.reply('✅ Пост отправлен в канал');
      } catch (err) {
        this.logger.error('post command failed', err);
        await ctx.reply('❌ Не удалось отправить пост. Убедись что бот — админ канала.').catch(() => null);
      }
    });

    this.bot.action('cancel', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        await ctx.deleteMessage();
      } catch (err) {
        this.logger.error('cancel action failed', err);
      }
    });

    this.bot.action('back:welcome', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        await this.editOrReply(ctx, WELCOME_TEXT, this.buildWelcomeKeyboard());
      } catch (err) {
        this.logger.error('back:welcome action failed', err);
      }
    });

    this.bot.action('faq', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        await this.editOrReply(ctx, FAQ_MENU_TEXT, this.buildFaqKeyboard());
      } catch (err) {
        this.logger.error('faq action failed', err);
      }
    });

    this.bot.action(/^faq:([a-z_]+)$/, async (ctx) => {
      try {
        const topic = (ctx.match as RegExpMatchArray)[1];
        const text = FAQ[topic];
        if (!text) {
          await ctx.answerCbQuery('Раздел не найден', { show_alert: true });
          return;
        }
        await ctx.answerCbQuery();
        await this.editOrReply(
          ctx,
          text,
          Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'faq')]]),
        );
      } catch (err) {
        this.logger.error('faq topic action failed', err);
        await ctx.answerCbQuery('Что-то пошло не так').catch(() => null);
      }
    });

    this.bot.action('back:needs', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        await this.editOrReply(ctx, 'Выберите потребность:', this.buildNeedsKeyboard());
      } catch (err) {
        this.logger.error('back:needs action failed', err);
      }
    });

    this.bot.action(/^need:([a-z_]+)$/, async (ctx) => {
      try {
        const needId = (ctx.match as RegExpMatchArray)[1];
        if (!NEED_IDS.includes(needId as NeedId)) {
          await ctx.answerCbQuery('Неизвестная потребность', { show_alert: true });
          return;
        }
        const need = this.botService.getNeeds().find((n) => n.id === needId)!;
        await ctx.answerCbQuery();
        await this.editOrReply(ctx, `Оцените: ${need.fullTitle}`, this.buildRatingKeyboard(needId as NeedId));
      } catch (err) {
        this.logger.error('need action failed', err);
        await ctx.answerCbQuery('Что-то пошло не так').catch(() => null);
      }
    });

    this.bot.action(/^rate:([a-z_]+):(\d{1,2})$/, async (ctx) => {
      const match = ctx.match as RegExpMatchArray;
      const needId = match[1];
      const raw = Number(match[2]);

      if (!NEED_IDS.includes(needId as NeedId) || !Number.isInteger(raw) || raw < 0 || raw > 10) {
        await ctx.answerCbQuery('Неверные данные', { show_alert: true }).catch(() => null);
        return;
      }
      const userId = ctx.from?.id;
      if (!userId) {
        await ctx.answerCbQuery('Не удалось определить пользователя', { show_alert: true }).catch(() => null);
        return;
      }

      try {
        await this.botService.saveRating(userId, needId as NeedId, raw);
        const need = this.botService.getNeeds().find((n) => n.id === needId)!;
        await ctx.answerCbQuery();
        await this.editOrReply(
          ctx,
          `✅ Записал: ${need.fullTitle} — ${raw}/10`,
          Markup.inlineKeyboard([Markup.button.callback('✏️ Ещё', 'back:needs')]),
        );
      } catch (err) {
        this.logger.error('rate action failed', err);
        await ctx.answerCbQuery('Ошибка сохранения, попробуй ещё раз', { show_alert: true }).catch(() => null);
      }
    });

    try {
      await this.bot.launch();
      this.logger.log('Bot launched');
    } catch (err) {
      this.logger.error('Failed to launch bot', err);
      throw err;
    }
  }

  async onModuleDestroy() {
    try {
      await this.bot?.stop();
      this.logger.log('Bot stopped');
    } catch (err) {
      this.logger.error('Error stopping bot', err);
    }
  }
}
