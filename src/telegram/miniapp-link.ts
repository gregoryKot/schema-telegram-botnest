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

/**
 * Та же ссылка там, где Telegram — второй путь, а не единственный (приглашение
 * терапевта ведёт на сайт, t.me — строкой для тех, у кого он есть): бот не
 * настроен — null, а не 503 на всё приглашение.
 */
export function optionalMiniappStartLink(startapp: string): string | null {
  return BOT_USERNAME ? miniappStartLink(startapp) : null;
}
