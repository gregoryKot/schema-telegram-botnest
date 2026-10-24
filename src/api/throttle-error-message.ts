import type { ThrottlerLimitDetail } from '@nestjs/throttler';
import { plural } from '../bot/plural';

// Текст ответа 429 (аудит 2026-10, находка «сырой текст сервера на экранах
// входа»). Без этого @nestjs/throttler отдаёт «ThrottlerException: Too Many
// Requests», а экраны входа кладут message ответа на экран как есть.
//
// Срок берётся из самого счётчика, а не пишется «через минуту»: окна бывают
// от секунды до суток (час у кодовых ручек, `src/auth/auth-throttles.ts`;
// сутки у выгрузки аккаунта, `src/api/account-export.controller.ts`), и
// фиксированная минута там была бы неправдой. Текст безличный — без «ты/вы»
// и без рода, поэтому один и тот же для любого пользователя и любого клиента
// (сайт, мини-апп, бот).
const HEAD = 'Слишком много попыток подряд.';

export function throttleErrorMessage(
  detail: Pick<ThrottlerLimitDetail, 'timeToBlockExpire' | 'timeToExpire'>,
): string {
  // Блок снимается по своему сроку (обе памяти сбрасывают ключ, когда он
  // истёк), окно счётчика — запасной ответ, если блока в записи нет.
  const seconds =
    detail.timeToBlockExpire > 0
      ? detail.timeToBlockExpire
      : detail.timeToExpire;
  return `${HEAD} Повторить можно ${retryIn(seconds)}`;
}

function retryIn(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'чуть позже';
  if (seconds <= 60) return 'через минуту';
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) {
    return `через ${minutes} ${plural(minutes, 'минуту', 'минуты', 'минут')}`;
  }
  const hours = Math.ceil(minutes / 60);
  if (hours === 1) return 'через час';
  return `через ${hours} ${plural(hours, 'час', 'часа', 'часов')}`;
}
