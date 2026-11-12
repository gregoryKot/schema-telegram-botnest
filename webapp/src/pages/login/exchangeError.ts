import { humanizeThrown, readHumanError } from '../../../../shared/src/api/humanizeError';

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

// Обмен бросил, а не ответил (аудит 2026-10): сеть и русский текст разбирает
// общий маппер, остальное — HTML прокси на 200 (`SyntaxError: Unexpected token
// '<'…`) — раньше уходило на экран сырой строкой. Имя класса вместо текста:
// человеку не мешает, а отчёту оставляет, чем именно сломалось.
export function exchangeThrownText(err: unknown): string {
  const kind = err instanceof Error ? err.name : typeof err;
  return humanizeThrown(err, `Не удалось войти (${kind})`);
}

// На экран (слот `code` у TelegramRetry) — только короткий код: «Ошибка 401», без тела ответа (там сырой
// JSON сервера, ревью b26). Полная строка по-прежнему уходит в отчёт useAuthFailureReport. Строки без кода
// ответа (обрыв сети, «Не удалось войти (TypeError)») — человеческие и короткие, идут как есть.
export function exchangeErrorCode(text: string): string {
  const m = /^(Ошибка \d{3})(?::|$)/.exec(text);
  return m ? m[1] : text;
}
