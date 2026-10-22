import { useState } from 'react';

/**
 * «Скопировать» в админке: текст в буфер + честная подпись исхода. Общий для
 * ссылки на запись (ClientBookingLink) и ссылки на встречу в строке брони
 * (BookingMeetingLink) — одна механика, один хук. Отказ буфера не выглядит
 * как успех: ссылка рядом, её можно выделить руками.
 */
export function useCopyText() {
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied('ok');
    } catch {
      setCopied('fail'); // нет clipboard API / отказ браузера
    }
  };
  const status =
    copied === 'ok' ? <span style={{ color: 'var(--accent-green)', fontSize: 13 }}>Скопировано ✓</span>
    : copied === 'fail' ? <span style={{ color: 'var(--accent-red)', fontSize: 13 }}>Не скопировалось – ссылку можно выделить и скопировать руками</span>
    : null;
  return { copy, status };
}
