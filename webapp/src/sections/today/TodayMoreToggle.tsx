// Ссылка-раскрывашка «Что ещё можно сегодня ⌄». Видна только на телефоне
// (≤767px, client-today.css); на десктопе все блоки и так на виду.
export function TodayMoreToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="ct-more-toggle" aria-expanded={open} onClick={onToggle}>
      {open ? 'Свернуть' : 'Что ещё можно сегодня'}
      <span className="ct-more-chev" aria-hidden>⌄</span>
    </button>
  );
}
