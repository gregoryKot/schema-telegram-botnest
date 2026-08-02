import { Injectable } from '@nestjs/common';
import type { ChannelPost, ChannelTarget } from '../channel-target';
import { describeHttpError, postJson } from '../channel-http';
import { maxCa, maxDispatcher } from './max-ca';

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
    // При сбое TLS первым делом надо знать, каким корнем мы вообще проверяли:
    // до 2026-07-31 это было невидимо, и чинили не то.
    const ca = maxCa();
    return `${reason}\nКорень доверия: ${ca.source} — ${ca.subject}.\nНужен «Russian Trusted Root CA»: им подписана «Russian Trusted Sub CA», а ею — сертификат MAX.`;
  }
}
