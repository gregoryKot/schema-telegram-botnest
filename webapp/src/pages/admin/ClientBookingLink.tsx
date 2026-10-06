import { useState } from 'react';
import { btnGhost, card } from './shared';

/** Постоянная ссылка на запись для знакомых клиентов (страница /book, BookingLinkPage). */
export const CLIENT_BOOKING_URL = 'https://kotlarewski.gr/book';

/** Владелец кидает ссылку клиенту из админки, не вспоминая адрес: строка + «Скопировать». */
export function ClientBookingLink() {
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CLIENT_BOOKING_URL);
      setCopied('ok');
    } catch {
      setCopied('fail'); // нет clipboard API / отказ браузера: ссылка рядом, её можно выделить руками
    }
  };
  return (
    <section style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-10)', flexWrap: 'wrap', fontSize: 14 }}>
        <span className="u-fg">Ссылка для клиентов:</span>
        <a href={CLIENT_BOOKING_URL} target="_blank" rel="noreferrer" className="u-link">{CLIENT_BOOKING_URL}</a>
        <button type="button" style={{ ...btnGhost, padding: '5px 12px', fontSize: 13 }} onClick={() => void copy()}>Скопировать</button>
        {copied === 'ok' && <span style={{ color: 'var(--accent-green)', fontSize: 13 }}>Скопировано ✓</span>}
        {copied === 'fail' && <span style={{ color: 'var(--accent-red)', fontSize: 13 }}>Не скопировалось – ссылку можно выделить и скопировать руками</span>}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '8px 0 0' }}>Открывает расписание сразу, по умолчанию выбрана сессия. Для знакомства: {CLIENT_BOOKING_URL}?type=intro</p>
    </section>
  );
}
