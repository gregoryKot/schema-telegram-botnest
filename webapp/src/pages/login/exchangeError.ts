import { readHumanError } from '../../../../shared/src/api/humanizeError';

// Текст провала обмена подписи мессенджера на сессию (экран «Попробовать
// снова» в Telegram/MAX). Строка уходит и на экран, и в отчёт
// useAuthFailureReport, поэтому код ответа в ней остаётся всегда.
//
// 401/403 и прочие 4xx — тело сервера как есть: это диагностика отказа подписи
// (инцидент 2026-08-08, «Missing authentication» против «Invalid initData»),
// и её читаем мы, а не только человек. Лимит и авария сервера — человеческий
// текст: «ThrottlerException…» и HTML прокси ничего не объясняют ни человеку,
// ни нам — код ответа говорит то же самое.
export async function exchangeErrorText(res: Response): Promise<string> {
  if (res.status === 429 || res.status >= 500) {
    return `Ошибка ${res.status}: ${(await readHumanError(res, '')).message}`;
  }
  const body = await res.text().catch(() => '');
  return `Ошибка ${res.status}: ${body.slice(0, 120)}`;
}
