import { useTr } from '../../utils/addressForm';

export function HistoryEmpty({ onGoToToday }: { onGoToToday?: () => void }) {
  const tr = useTr();
  return (
    <div className="ds-card sd-empty">
      <div className="ds-h2 sd-empty-title">Пусто.</div>
      <div className="sd-empty-text">
        {tr('Заполни трекер сегодня – через 3–5 дней начнёт проявляться паттерн', 'Заполните трекер сегодня – через 3–5 дней начнёт проявляться паттерн')}
      </div>
      {onGoToToday && (
        <button onClick={onGoToToday} className="ds-btn">Заполнить сегодня</button>
      )}
    </div>
  );
}
