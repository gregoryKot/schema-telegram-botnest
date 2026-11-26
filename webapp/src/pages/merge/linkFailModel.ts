// Исход экрана /link, когда сводка билета не загрузилась (docs/design/APP_2026-11.md, «Исходы служебных
// страниц»): ответ сервера 4xx — код не найден, устарел или упёрся в лимит («подожди или устарело» —
// wait); 5xx, HTML прокси и обрыв сети — сбой на нашей стороне (our_side).
export type LinkFailOutcome = 'wait' | 'our_side';

/** Ошибка запроса билета со статусом ответа: по нему экран выбирает исход, текст — как прежде. */
export class TicketHttpError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function linkFailOutcome(e: unknown): LinkFailOutcome {
  return e instanceof TicketHttpError && e.status >= 400 && e.status < 500 ? 'wait' : 'our_side';
}
