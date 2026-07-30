import { Injectable } from '@nestjs/common';
import type { ChannelPost, ChannelTarget } from '../channel-target';
import { describeHttpError, postJson } from '../channel-http';

/** id доски. Без него площадка выключена. */
const BOARD_ENV = 'HEALTHY_ADULT_PINTEREST_BOARD';
const TOKEN_ENV = 'HEALTHY_ADULT_PINTEREST_TOKEN';
const API = 'https://api.pinterest.com/v5/pins';
/** Лимит описания пина у Pinterest — длинные фразы обрезаем, а не теряем пин. */
const DESCRIPTION_LIMIT = 500;

/**
 * Pinterest: единственная площадка канала, которой нужен не текст, а картинка
 * — пин без изображения создать нельзя. Картинку рисует бэкенд (pin-image),
 * фраза дублируется в описании: так пин находится поиском и читается без
 * загрузки картинки.
 */
@Injectable()
export class PinterestChannelTarget implements ChannelTarget {
  readonly platform = 'pinterest';
  readonly title = 'Pinterest';
  readonly envKey = BOARD_ENV;

  destination(): string | null {
    const raw = process.env[BOARD_ENV]?.trim();
    return raw ? raw : null;
  }

  async send(post: ChannelPost, destination: string): Promise<void> {
    const token = process.env[TOKEN_ENV]?.trim();
    if (!token) throw new Error(`нет ${TOKEN_ENV} — токена Pinterest`);
    const image = await post.image();
    await postJson(
      API,
      {
        board_id: destination,
        description: post.text.slice(0, DESCRIPTION_LIMIT),
        media_source: {
          source_type: 'image_base64',
          content_type: 'image/png',
          data: image.toString('base64'),
        },
      },
      { authorization: `Bearer ${token}` },
    );
  }

  explain(err: unknown): string {
    return `${describeHttpError(err)}\nПроверь токен Pinterest (нужны права pins:write) и id доски.`;
  }
}
