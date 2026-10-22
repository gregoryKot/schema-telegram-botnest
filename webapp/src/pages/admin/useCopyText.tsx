import { reportClientError } from '../../api';
import { useCopyToClipboard } from '../../../../shared/src/utils/useCopyToClipboard';

const reportCopyFail = () => reportClientError({ message: 'admin link copy failed', section: 'admin' });

/**
 * «Скопировать» в админке: подпись исхода поверх общего useCopyToClipboard
 * (сам буфер, сброс статуса и отчёт наверх живут только там — «одна механика,
 * один компонент»). Здесь только разметка подписи, общая для ссылки на запись
 * (ClientBookingLink) и ссылки на встречу в строке брони (BookingMeetingLink).
 * Отказ буфера не выглядит как успех: ссылка рядом, её можно выделить руками.
 */
export function useCopyText() {
  // 6 с, а не 2: подсказку «выделить руками» надо успеть прочитать.
  const { copied, failed, copy } = useCopyToClipboard({ onError: reportCopyFail, resetMs: 6000 });
  const status =
    copied ? <span style={{ color: 'var(--accent-green)', fontSize: 13 }}>Скопировано ✓</span>
    : failed ? <span style={{ color: 'var(--accent-red)', fontSize: 13 }}>Не скопировалось – ссылку можно выделить и скопировать руками</span>
    : null;
  return { copy, status };
}
