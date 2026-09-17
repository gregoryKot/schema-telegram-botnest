import { useTr } from '../../utils/addressForm';

// Сбой ≠ пусто: НЕблокирующий баннер сверху дневника (пара к miniapp
// DiarySection/LoadErrorBanner) — отказ загрузки не должен прятать
// остальной UI: записи могли не загрузиться, но пользователь может хотеть
// создать новую запись прямо сейчас. Вынесено в отдельный файл ради
// правила №10 CLAUDE.md (DiarySection.tsx уже на потолке размера).
export function DiaryLoadFailedBanner({ onRetry }: { onRetry: () => void }) {
  const tr = useTr();
  return (
    <div
      role="alert"
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-10)', justifyContent: 'space-between', flexWrap: 'wrap',
        padding: '10px 16px', marginBottom: 20,
        background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 'var(--r-12)',
        fontSize: 13, color: 'var(--c-rose)', lineHeight: 1.5,
      }}
    >
      <span>
        {tr(
          'Не удалось загрузить записи дневника. Проверь соединение — записи на месте, просто не загрузились',
          'Не удалось загрузить записи дневника. Проверьте соединение — записи на месте, просто не загрузились',
        )}
      </span>
      <button onClick={onRetry} style={{
        flexShrink: 0, padding: '6px 14px', borderRadius: 'var(--r-10)', border: 'none', fontFamily: 'inherit',
        background: 'rgba(248,113,113,0.15)', color: 'var(--c-rose)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
      }}>
        Обновить
      </button>
    </div>
  );
}
