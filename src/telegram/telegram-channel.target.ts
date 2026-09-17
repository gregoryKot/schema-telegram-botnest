import { Inject, Injectable, Optional } from '@nestjs/common';
import { Telegraf, Context } from 'telegraf';
import { TELEGRAF_BOT } from './telegram.constants';
import { describeTelegramError, telegramErrorCode } from './telegram-error';
import type { ChannelPost, ChannelTarget } from '../channel/channel-target';

/** Env с каналом: @username или -100…id. Без него площадка выключена. */
const ENV_KEY = 'HEALTHY_ADULT_CHANNEL';

/**
 * Повторы при сетевом сбое — как у остальных площадок (`channel-http`).
 *
 * Telegram единственный ходит мимо общего HTTP-слоя: у telegraf свой клиент,
 * и повторов у него не было вовсе. Инцидент 2026-08-09: связь до
 * api.telegram.org с хостинга моргает, пост падал с ETIMEDOUT, а соседние
 * площадки в те же секунды принимали его — то есть достаточно было попробовать
 * ещё раз.
 *
 * Повторяем ТОЛЬКО когда ответа не было. Ответ API (400/403) не повторяем:
 * запрос дошёл, и повтор рискует вторым сообщением в канале.
 */
const NETWORK_RETRIES = 2;
const RETRY_PAUSE_MS = 1500;

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Сбой транспорта: ответа не было, повторить безопасно. */
export function isTelegramNetworkError(err: unknown): boolean {
  if (telegramErrorCode(err) !== undefined) return false;
  return /ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|EPIPE|socket hang up|failed|timeout/i.test(
    describeTelegramError(err),
  );
}

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

  async send(post: ChannelPost, destination: string): Promise<void> {
    const bot = this.bot;
    if (!bot) throw new Error('бот не инициализирован (нет BOT_TOKEN?)');
    let last: unknown;
    for (let attempt = 0; attempt <= NETWORK_RETRIES; attempt++) {
      try {
        await bot.telegram.sendMessage(destination, post.text);
        return;
      } catch (err) {
        last = err;
        if (!isTelegramNetworkError(err) || attempt === NETWORK_RETRIES) break;
        await pause(RETRY_PAUSE_MS);
      }
    }
    throw last;
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
