import { Inject, Injectable, Optional } from '@nestjs/common';
import { Telegraf, Context } from 'telegraf';
import { TELEGRAF_BOT } from './telegram.constants';
import { describeTelegramError } from './telegram-error';
import type { ChannelPost, ChannelTarget } from '../channel/channel-target';
import { isConnectFailure } from '../channel/connect-failure';
import { sendOnce } from './telegram.send-once';
import { SEND_TIMEOUT_MS, sendBounded } from './telegram.send-bounded';

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
 * Повторяем ТОЛЬКО когда соединение не установилось (connect-failure.ts).
 * Ответ API (400/403) не повторяем: запрос дошёл, и повтор рискует вторым
 * сообщением в канале. Свой таймаут ожидания и обрыв после отправки — тоже
 * (R7, аудит 2026-11): раньше их повторяли, а пост к тому моменту мог выйти.
 */
const NETWORK_RETRIES = 2;
const RETRY_PAUSE_MS = 1500;
/**
 * Ответ 429 «слишком часто» — отдельно от сети: ждём названный срок и
 * повторяем один раз (telegram.send-once.ts). Пост — крон, а не запрос
 * человека, поэтому ждать можно дольше, чем DM админу.
 */
const RATE_LIMIT_BUDGET_MS = 30_000;
/**
 * Весь send (попытки, паузы, 429) — в этот срок, с запасом меньше тика (5 мин).
 * R7 (аудит 2026-11): у telegraf таймаут ответа 500 с — зависший пост переживал
 * тик, и следующий публиковал слот ещё раз. Попытка ждёт ≤ SEND_TIMEOUT_MS.
 */
export const SEND_DEADLINE_MS = 60_000;

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    const deadline = Date.now() + SEND_DEADLINE_MS;
    const left = () => deadline - Date.now();
    let last: unknown;
    for (let attempt = 0; attempt <= NETWORK_RETRIES; attempt++) {
      try {
        // Окно попытки — сколько осталось от срока, но не больше штатного.
        const once = () =>
          sendBounded(
            bot,
            destination,
            post.text,
            undefined,
            Math.max(1, Math.min(SEND_TIMEOUT_MS, left())),
          );
        await sendOnce(once, {
          budgetMs: Math.min(RATE_LIMIT_BUDGET_MS, left()),
        });
        return;
      } catch (err) {
        last = err;
        if (!isConnectFailure(err) || attempt === NETWORK_RETRIES) break;
        if (left() <= RETRY_PAUSE_MS) break;
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
