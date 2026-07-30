import { Injectable } from '@nestjs/common';
import type { ChannelPost, ChannelTarget } from '../channel-target';
import { describeHttpError, postJson } from '../channel-http';
import { maxCaConfigured, maxDispatcher } from './max-ca';

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
    // Сертификат площадки — российского УЦ, и сбой проверки цепочки лечится не
    // токеном. Совет разный: корня нет вовсе или он есть, но не тот. Инцидент
    // 2026-07-30: общая подсказка «проверь токен и CA» отправляла искать
    // одновременно везде.
    const reason = describeHttpError(err);
    if (!/CERT|certificate/i.test(reason))
      return `${reason}\nПроверь токен бота MAX и что бот админ канала.`;
    return maxCaConfigured()
      ? `${reason}\nСертификат MAX не проверился, хотя HEALTHY_ADULT_MAX_CA задан: похоже, там не тот корень или не хватает промежуточного. Положи в переменную всю цепочку — корневой и промежуточный подряд.`
      : `${reason}\nНе задан HEALTHY_ADULT_MAX_CA: сертификат MAX выдан российским УЦ, которого нет в штатных доверенных.`;
  }
}
