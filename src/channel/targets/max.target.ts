import { Injectable } from '@nestjs/common';
import type { ChannelPost, ChannelTarget } from '../channel-target';
import { describeHttpError, postJson } from '../channel-http';
import { maxDispatcher } from './max-ca';

/** id чата/канала MAX. Без него площадка выключена. */
const CHAT_ENV = 'HEALTHY_ADULT_MAX_CHAT';
/** Токен бота из @MasterBot. */
const TOKEN_ENV = 'HEALTHY_ADULT_MAX_TOKEN';
// Домен platform-api.max.ru MAX отключил 19.07.2026 (отзыв SSL-сертификатов
// российских компаний зарубежным УЦ) — весь Bot API переехал на platform-api2.
const API = 'https://platform-api2.max.ru/messages';

/**
 * MAX: сообщение в канал через Bot API — тот же контур, что у Telegram, но
 * REST-ный (chat_id в query, текст в теле). Публикация ботов там открыта
 * верифицированным юрлицам РФ, поэтому без токена площадка просто молчит.
 */
@Injectable()
export class MaxChannelTarget implements ChannelTarget {
  readonly platform = 'max';
  readonly title = 'MAX';
  readonly envKey = CHAT_ENV;

  destination(): string | null {
    const raw = process.env[CHAT_ENV]?.trim();
    return raw ? raw : null;
  }

  async send(post: ChannelPost, destination: string): Promise<void> {
    const token = process.env[TOKEN_ENV]?.trim();
    if (!token) throw new Error(`нет ${TOKEN_ENV} — токена бота MAX`);
    await postJson(
      `${API}?chat_id=${encodeURIComponent(destination)}`,
      { text: post.text },
      { authorization: token },
      { dispatcher: maxDispatcher() },
    );
  }

  explain(err: unknown): string {
    // Сертификат площадки — российского УЦ: без HEALTHY_ADULT_MAX_CA запрос
    // не доходит вовсе, и по одному «токен проверь» причину не угадать.
    return `${describeHttpError(err)}\nПроверь токен бота MAX, что бот админ канала и что задан HEALTHY_ADULT_MAX_CA.`;
  }
}
