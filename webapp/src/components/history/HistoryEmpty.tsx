import { useTr } from '../../utils/addressForm';

export function HistoryEmpty({ onGoToToday }: { onGoToToday?: () => void }) {
  const tr = useTr();
  return (
    <div className="sd-empty">
      <p className="ds-empty">
        {tr('Заполни трекер сегодня – через 3–5 дней начнёт проявляться паттерн', 'Заполните трекер сегодня – через 3–5 дней начнёт проявляться паттерн')}
      </p>
      {onGoToToday && (
        <button onClick={onGoToToday} className="ds-btn">Заполнить сегодня</button>
      )}
    </div>
  );
}
