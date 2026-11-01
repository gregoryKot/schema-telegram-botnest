// Итог нажатия «Поделиться» для шитов карточек (`useShareCard`, оба фронтенда).
// `shareCanvasImage` бросает на любой неуспех, и раньше отмена системной
// шторки (человек закрыл её, ничего не выбрав) шла по пути сбоя: текст молча
// копировался в буфер и открывалась шторка с текстом. А скачанная вместо шэра
// картинка (`'downloaded'`, браузер без `navigator.share`) не давала никакого
// ответа на экране — нажатие выглядело пустым.
import { shareCanvasImage } from './shareImage';

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled' | 'failed';

/**
 * Отмена системной шторки — не сбой: ни фолбэка, ни отчёта об ошибке.
 * `navigator.share` отклоняет промис `DOMException` с именем `AbortError`;
 * проверяем имя, а не класс — `DOMException` не везде наследует `Error`.
 */
export function isShareAbort(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { name?: unknown }).name === 'AbortError'
  );
}

/** Шэр картинки со скачиванием как запасным путём; не бросает. */
export async function shareOutcome(
  canvas: HTMLCanvasElement,
  text: string,
  filename: string,
): Promise<ShareOutcome> {
  try {
    return await shareCanvasImage(canvas, text, filename, {
      downloadFallback: true,
    });
  } catch (err) {
    return isShareAbort(err) ? 'cancelled' : 'failed';
  }
}

/** Подпись главной кнопки шита: скачанная картинка — видимое «сохранена». */
export function shareButtonLabel(sharing: boolean, saved: boolean): string {
  if (sharing) return 'Готовлю картинку…';
  return saved ? '✓ Картинка сохранена' : 'Поделиться';
}
