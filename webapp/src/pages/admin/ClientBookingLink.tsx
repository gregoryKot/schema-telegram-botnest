import { btnGhost, card } from './shared';
import { useCopyText } from './useCopyText';

/** Постоянная ссылка на запись для знакомых клиентов (страница /book, BookingLinkPage). */
export const CLIENT_BOOKING_URL = 'https://kotlarewski.gr/book';

/** Владелец кидает ссылку клиенту из админки, не вспоминая адрес: строка + «Скопировать». */
export function ClientBookingLink() {
  const { copy, status } = useCopyText();
  return (
    <section style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-10)', flexWrap: 'wrap', fontSize: 14 }}>
        <span className="u-fg">Ссылка для клиентов:</span>
        <a href={CLIENT_BOOKING_URL} target="_blank" rel="noreferrer" className="u-link">{CLIENT_BOOKING_URL}</a>
        <button type="button" style={{ ...btnGhost, padding: '5px 12px', fontSize: 13 }} onClick={() => void copy(CLIENT_BOOKING_URL)}>Скопировать</button>
        {status}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '8px 0 0' }}>Открывает расписание сразу, только сессия 50 минут — для знакомых клиентов.</p>
    </section>
  );
}
