import { Injectable } from '@nestjs/common';
import type { ChannelPost, ChannelTarget } from '../channel-target';
import { describeHttpError, postEmpty } from '../channel-http';
import { ThreadsTokenService } from './threads-token.service';
import { threadsApi, threadsViaRelay } from './threads-api';

/** id пользователя Threads (me тоже подходит). Без него площадка выключена. */
const USER_ENV = 'HEALTHY_ADULT_THREADS_USER';
const API = '/v1.0';

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
    const container = threadsApi(
      `${API}/${destination}/threads?media_type=TEXT` +
        `&text=${encodeURIComponent(post.text)}&access_token=${token}`,
    );
    const created = await postEmpty(container.url, container.transport);
    const creationId = created.id;
    if (typeof creationId !== 'string' || !creationId)
      throw new Error('Threads не вернул id контейнера');
    const publish = threadsApi(
      `${API}/${destination}/threads_publish` +
        `?creation_id=${creationId}&access_token=${token}`,
    );
    await postEmpty(publish.url, publish.transport);
  }

  explain(err: unknown): string {
    // Сетевой отказ (ENOTFOUND/ETIMEDOUT/fetch failed) — это не про токен:
    // Threads принадлежит Meta и с российского хостинга просто недоступен.
    // Инцидент 2026-07-30: подсказка про токен увела диагностику не туда.
    const reason = describeHttpError(err);
    const network =
      /ENOTFOUND|ETIMEDOUT|ECONNREFUSED|ECONNRESET|EAI_AGAIN|CONNECT_TIMEOUT|fetch failed|не ответила/i.test(
        reason,
      );
    return network
      ? `${reason}\n${
          threadsViaRelay()
            ? 'Не отвечает ретранслятор (Cloudflare), а не Threads. Проверь, что воркер жив и HEALTHY_ADULT_THREADS_RELAY указывает на него.'
            : 'Соединение не установилось: серверы Threads с этого хостинга недоступны. Токен тут ни при чём — нужен ретранслятор (HEALTHY_ADULT_THREADS_RELAY), см. deploy/threads-relay.'
        }`
      : `${reason}\nПроверь токен Threads (живёт 60 дней) и id пользователя.`;
  }
}
