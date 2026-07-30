import { Inject, Injectable, Optional } from '@nestjs/common';
import { Telegraf, Context } from 'telegraf';
import { TELEGRAF_BOT } from './telegram.constants';
import { describeTelegramError } from './telegram-error';
import type { ChannelTarget } from '../channel/channel-target';

/** Env с каналом: @username или -100…id. Без него площадка выключена. */
const ENV_KEY = 'HEALTHY_ADULT_CHANNEL';

/**
 * Telegram как площадка канала «Здоровый Взрослый» — первый адаптер
 * ChannelTarget. Всё телеграм-специфичное живёт здесь: клиент, формат адреса
 * канала и разбор ошибок API.
 *
 * Безопасный дефолт: без env постинг выключен, чтобы тестовый прогон не ушёл
 * в основной канал.
 */
@Injectable()
export class TelegramChannelTarget implements ChannelTarget {
  readonly platform = 'telegram';
  readonly title = 'Telegram';
  readonly envKey = ENV_KEY;

  constructor(
    @Inject(TELEGRAF_BOT)
    @Optional()
    private readonly bot: Telegraf<Context> | null,
  ) {}

  destination(): string | null {
    const raw = process.env[ENV_KEY]?.trim();
    return raw ? raw : null;
  }

  async send(text: string, destination: string): Promise<void> {
    if (!this.bot) throw new Error('бот не инициализирован (нет BOT_TOKEN?)');
    await this.bot.telegram.sendMessage(destination, text);
  }

  /**
   * Причина — общим разборщиком: ответ API («400: chat not found») или код
   * транспорта («ETIMEDOUT»), иначе алерт обрывался на «reason:». Подсказка
   * рядом: чаще всего канал молчит из-за прав бота, а не из-за сети.
   */
  explain(err: unknown): string {
    return `${describeTelegramError(err)}\nПроверь, что бот — администратор канала с правом публикации.`;
  }
}
