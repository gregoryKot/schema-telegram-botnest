import { Injectable } from '@nestjs/common';
import type { ChannelPost, ChannelTarget } from '../channel-target';
import { ChannelHttpError, describeHttpError, postForm } from '../channel-http';

/** id сообщества (без минуса). Без него площадка выключена. */
const GROUP_ENV = 'HEALTHY_ADULT_VK_GROUP';
/** Ключ доступа сообщества из настроек группы (права «Стена»). */
const TOKEN_ENV = 'HEALTHY_ADULT_VK_TOKEN';
const API = 'https://api.vk.com/method/wall.post';
const API_VERSION = '5.199';

/**
 * ВКонтакте: пост на стену сообщества от имени сообщества. Токен берётся в
 * настройках самой группы — согласование приложения с VK нужно только для
 * постинга в чужие стены, а сюда постим в свою.
 */
@Injectable()
export class VkChannelTarget implements ChannelTarget {
  readonly platform = 'vk';
  readonly title = 'ВКонтакте';
  readonly envKey = GROUP_ENV;

  destination(): string | null {
    const raw = process.env[GROUP_ENV]?.trim().replace(/^-|^club/, '');
    return raw ? `club${raw}` : null;
  }

  async send(post: ChannelPost, destination: string): Promise<void> {
    const token = process.env[TOKEN_ENV]?.trim();
    if (!token) throw new Error(`нет ${TOKEN_ENV} — ключа доступа сообщества`);
    const res = await postForm(API, {
      owner_id: `-${destination.replace('club', '')}`,
      from_group: '1',
      message: post.text,
      access_token: token,
      v: API_VERSION,
    });
    // VK отвечает 200 и на отказ: ошибка лежит в теле, а не в статусе.
    const error = res.error as
      { error_code?: number; error_msg?: string } | undefined;
    if (error)
      throw new ChannelHttpError(
        error.error_code ?? 0,
        error.error_msg ?? 'VK отказал без объяснения',
      );
  }

  explain(err: unknown): string {
    return `${describeHttpError(err)}\nПроверь ключ доступа сообщества (нужны права на стену) и id группы.`;
  }
}
