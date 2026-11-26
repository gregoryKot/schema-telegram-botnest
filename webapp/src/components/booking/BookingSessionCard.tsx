const fmt = (iso: string) => {
  const s = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
  return s.charAt(0).toUpperCase() + s.slice(1) + ' МСК'; // first letter only, not every word
};

const typeLabel = (t: string) => (t === 'INTRO_15' ? 'Вводная встреча' : 'Сессия');

/** Карточка «что за встреча и когда» — одинакова до и после подтверждения. */
export function BookingSessionCard({ type, durationMin, startsAt }: { type: string; durationMin: number; startsAt: string }) {
  return (
    <div className="pa-outcome-when">
      <div className="pa-outcome-when-kind">{typeLabel(type)} · {durationMin} мин</div>
      <div className="pa-outcome-when-at">{fmt(startsAt)}</div>
    </div>
  );
}
