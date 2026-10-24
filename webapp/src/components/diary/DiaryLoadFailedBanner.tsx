import '../../styles/sheet-diary.css';
import { useTr } from '../../utils/addressForm';

// Сбой ≠ пусто: НЕблокирующий баннер сверху дневника (пара к miniapp
// DiarySection/LoadErrorBanner) — отказ загрузки не должен прятать
// остальной UI: записи могли не загрузиться, но пользователь может хотеть
// создать новую запись прямо сейчас. Вынесено в отдельный файл ради
// правила №10 CLAUDE.md (DiarySection.tsx уже на потолке размера).
export function DiaryLoadFailedBanner({ onRetry }: { onRetry: () => void }) {
  const tr = useTr();
  return (
    <div role="alert" className="ds-card ds-card--row sd-banner">
      <span>
        {tr(
          'Не удалось загрузить записи дневника. Проверь соединение — записи на месте, просто не загрузились',
          'Не удалось загрузить записи дневника. Проверьте соединение — записи на месте, просто не загрузились',
        )}
      </span>
      <button onClick={onRetry} className="ds-btn ds-btn--secondary ds-btn--sm">Обновить</button>
    </div>
  );
}
