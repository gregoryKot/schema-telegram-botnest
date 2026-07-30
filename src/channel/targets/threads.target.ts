import { Injectable } from '@nestjs/common';
import type { ChannelPost, ChannelTarget } from '../channel-target';
import { describeHttpError, postEmpty } from '../channel-http';
import { ThreadsTokenService } from './threads-token.service';

/** id пользователя Threads (me тоже подходит). Без него площадка выключена. */
const USER_ENV = 'HEALTHY_ADULT_THREADS_USER';
const API = 'https://graph.threads.net/v1.0';

/**
 * Threads: публикация в два шага — сначала контейнер с текстом, потом сам
 * пост по creation_id. Один шаг ничего не публикует, поэтому оба обязаны
 * пройти, а неудача второго оставляет висеть черновик-контейнер (он протухает
 * сам через сутки, чистить нечего).
 */
@Injectable()
export class ThreadsChannelTarget implements ChannelTarget {
  readonly platform = 'threads';
  readonly title = 'Threads';
  readonly envKey = USER_ENV;

  constructor(private readonly tokens: ThreadsTokenService) {}

  destination(): string | null {
    const raw = process.env[USER_ENV]?.trim();
    return raw ? raw : null;
  }

  async send(post: ChannelPost, destination: string): Promise<void> {
    const token = await this.tokens.current();
    if (!token) throw new Error('нет токена Threads');
    const created = await postEmpty(
      `${API}/${destination}/threads?media_type=TEXT` +
        `&text=${encodeURIComponent(post.text)}&access_token=${token}`,
    );
    const creationId = created.id;
    if (typeof creationId !== 'string' || !creationId)
      throw new Error('Threads не вернул id контейнера');
    await postEmpty(
      `${API}/${destination}/threads_publish` +
        `?creation_id=${creationId}&access_token=${token}`,
    );
  }

  explain(err: unknown): string {
    // Сетевой отказ (ENOTFOUND/ETIMEDOUT/fetch failed) — это не про токен:
    // Threads принадлежит Meta и с российского хостинга просто недоступен.
    // Инцидент 2026-07-30: подсказка про токен увела диагностику не туда.
    const reason = describeHttpError(err);
    const network =
      /ENOTFOUND|ETIMEDOUT|ECONNREFUSED|ECONNRESET|EAI_AGAIN|fetch failed|не ответила/i.test(
        reason,
      );
    return network
      ? `${reason}\nСоединение не установилось: домен Threads недоступен с сервера. Токен тут ни при чём.`
      : `${reason}\nПроверь токен Threads (живёт 60 дней) и id пользователя.`;
  }
}
