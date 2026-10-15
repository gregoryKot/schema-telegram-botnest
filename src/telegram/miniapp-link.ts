import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { BOT_USERNAME, MINIAPP_APP_NAME } from './telegram.constants';

const logger = new Logger('MiniappLink');
let reported = false;

/**
 * t.me deep link мини-аппа с параметром запуска (приглашения пар и терапевта).
 * Имя бота не задано — ссылку не строим вовсе: `t.me//diary` и `t.me/undefined`
 * хуже честной ошибки. Клиенты показывают её в своих ветках ошибок.
 */
export function miniappStartLink(startapp: string): string {
  if (!BOT_USERNAME) {
    if (!reported) {
      reported = true;
      logger.error('BOT_USERNAME не задан — ссылки-приглашения не строятся');
    }
    throw new ServiceUnavailableException(
      'Ссылки-приглашения временно недоступны',
    );
  }
  return `https://t.me/${BOT_USERNAME}/${MINIAPP_APP_NAME}?startapp=${startapp}`;
}
